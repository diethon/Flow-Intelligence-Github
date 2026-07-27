"""
Feature Engineering Module with Time-Safe Expanding Features and Prediction Modes
"""

import pandas as pd
import numpy as np
import config
from utils import logger

def count_items(val):
    if pd.isna(val) or str(val).strip() == "":
        return 0
    return len([x.strip() for x in str(val).split(",") if x.strip()])

def has_specific_label(labels_str, target_label):
    if pd.isna(labels_str):
        return 0
    labels = [l.strip().lower() for l in str(labels_str).split(",")]
    return 1 if target_label.lower() in labels else 0

def fit_feature_metadata(df_train: pd.DataFrame) -> dict:
    """
    Fits and extracts historical statistical mappings strictly chronologically on the training set
    to prevent future-data leakage.
    """
    metadata = {}
    
    # Sort chronologically to extract time-safe summaries
    df_sorted = df_train.sort_values('created_at').copy()
    
    # 1. Global medians/means (robust cold-start fallbacks)
    global_mean_cycle = float(df_sorted['cycle_time_hours'].median()) if 'cycle_time_hours' in df_sorted.columns else 24.0
    global_mean_churn = float((df_sorted['additions'] + df_sorted['deletions']).median())
    global_mean_reviewer_count = float(df_sorted['requested_reviewers'].apply(count_items).mean())
    
    metadata['global_mean_cycle_time'] = global_mean_cycle
    metadata['global_mean_churn'] = global_mean_churn
    metadata['global_mean_reviewer_count'] = global_mean_reviewer_count
    
    # 2. Time-safe expanding statistics
    # Compute the historical averages per author and repo *within the training set* chronologically
    df_sorted['churn'] = df_sorted['additions'] + df_sorted['deletions']
    df_sorted['reviewer_count'] = df_sorted['requested_reviewers'].apply(count_items)
    
    # Expanding author statistics (shift(1) ensures no current-row leakage)
    author_cycle_times = df_sorted.groupby('author')['cycle_time_hours'].transform(lambda x: x.shift(1).expanding().mean())
    author_pr_counts = df_sorted.groupby('author')['created_at'].transform(lambda x: x.shift(1).expanding().count()).fillna(0)
    
    # Expanding repository statistics
    repo_cycle_times = df_sorted.groupby('repository')['cycle_time_hours'].transform(lambda x: x.shift(1).expanding().mean())
    repo_churn = df_sorted.groupby('repository')['churn'].transform(lambda x: x.shift(1).expanding().mean())
    repo_reviewers = df_sorted.groupby('repository')['reviewer_count'].transform(lambda x: x.shift(1).expanding().mean())
    repo_pr_counts = df_sorted.groupby('repository')['created_at'].transform(lambda x: x.shift(1).expanding().count()).fillna(0)
    
    # Put expanding series back into sorted df to grab the *latest* values at the end of training
    df_sorted['exp_author_avg_cycle'] = author_cycle_times
    df_sorted['exp_author_count'] = author_pr_counts
    df_sorted['exp_repo_avg_cycle'] = repo_cycle_times
    df_sorted['exp_repo_churn'] = repo_churn
    df_sorted['exp_repo_reviewers'] = repo_reviewers
    df_sorted['exp_repo_count'] = repo_pr_counts
    
    # Save the final (most recent) values for each author and repository
    author_avg_cycle_map = {}
    author_count_map = {}
    for author, group in df_sorted.groupby('author'):
        # Get the last non-null value, or global median if no history exists
        last_cycle = group['exp_author_avg_cycle'].dropna().iloc[-1] if group['exp_author_avg_cycle'].dropna().shape[0] > 0 else global_mean_cycle
        last_count = int(group['exp_author_count'].iloc[-1])
        author_avg_cycle_map[str(author)] = float(last_cycle)
        author_count_map[str(author)] = last_count
        
    repo_stats = {}
    for repo, group in df_sorted.groupby('repository'):
        last_cycle = group['exp_repo_avg_cycle'].dropna().iloc[-1] if group['exp_repo_avg_cycle'].dropna().shape[0] > 0 else global_mean_cycle
        last_churn = group['exp_repo_churn'].dropna().iloc[-1] if group['exp_repo_churn'].dropna().shape[0] > 0 else global_mean_churn
        last_reviewers = group['exp_repo_reviewers'].dropna().iloc[-1] if group['exp_repo_reviewers'].dropna().shape[0] > 0 else global_mean_reviewer_count
        last_count = int(group['exp_repo_count'].iloc[-1])
        
        repo_stats[str(repo)] = {
            "historical_merge_time": float(last_cycle),
            "average_pr_size": float(last_churn),
            "average_review_count": float(last_reviewers),
            "pr_count": last_count
        }
        
    metadata['author_avg_cycle_time'] = author_avg_cycle_map
    metadata['author_pr_counts'] = author_count_map
    metadata['repository_statistics'] = repo_stats
    
    # 3. Top 10 Labels (extracted from training labels)
    top_labels = []
    if 'labels' in df_sorted.columns:
        all_labels = []
        for l_list in df_sorted['labels'].dropna():
            all_labels.extend([x.strip() for x in str(l_list).split(",") if x.strip()])
        if all_labels:
            top_labels = list(pd.Series(all_labels).value_counts().head(10).index)
    metadata['top_labels'] = top_labels
    
    # 4. Save unique mergeable states (only for current_state mode)
    if 'mergeable_state' in df_sorted.columns:
        metadata['mergeable_states'] = sorted(list(df_sorted['mergeable_state'].dropna().unique()))
    else:
        metadata['mergeable_states'] = ["unknown"]
        
    return metadata

def sanitize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    Replaces special characters in feature column names with underscores.
    """
    new_cols = []
    for col in df.columns:
        new_col = str(col)
        for char in ['/', ':', ',', ' ', '{', '}', '[', ']', '"', '\'', '(', ')', '=', '-']:
            new_col = new_col.replace(char, '_')
        while '__' in new_col:
            new_col = new_col.replace('__', '_')
        new_col = new_col.strip('_')
        new_cols.append(new_col)
    df.columns = new_cols
    return df

def engineer_features(df: pd.DataFrame, metadata: dict, is_training: bool = False) -> pd.DataFrame:
    """
    Transforms raw fields into leakage-free features.
    If is_training=True, calculates time-safe expanding features dynamically.
    If is_training=False, maps historical statistics using pre-fitted training metadata.
    """
    df = df.copy()
    
    # Ensure chronological order during training expanding feature extraction
    if is_training:
        df = df.sort_values('created_at').copy()
        
    X = pd.DataFrame(index=df.index)
    
    # 1. Base PR Size Features
    X['changed_files'] = pd.to_numeric(df['changed_files'], errors='coerce').fillna(0).astype(float)
    X['additions'] = pd.to_numeric(df['additions'], errors='coerce').fillna(0).astype(float)
    X['deletions'] = pd.to_numeric(df['deletions'], errors='coerce').fillna(0).astype(float)
    X['commits'] = pd.to_numeric(df['commits'], errors='coerce').fillna(0).astype(float)
    X['churn'] = X['additions'] + X['deletions']
    X['average_change_per_file'] = X['churn'] / X['changed_files'].clip(lower=1)
    X['average_commit_size'] = X['churn'] / X['commits'].clip(lower=1)
    
    # 2. Time Features
    created_at_dt = pd.to_datetime(df['created_at'], errors='coerce')
    X['created_hour'] = created_at_dt.dt.hour.fillna(12).astype(int)
    X['weekday'] = created_at_dt.dt.weekday.fillna(0).astype(int)
    X['month'] = created_at_dt.dt.month.fillna(1).astype(int)
    X['week_of_year'] = created_at_dt.dt.isocalendar().week.fillna(1).astype(int)
    X['is_weekend'] = X['weekday'].apply(lambda w: 1 if w >= 5 else 0)
    
    # 3. Boolean Features
    X['draft'] = df['draft'].apply(lambda x: 1 if str(x).lower() in ['true', '1', 'yes'] else 0)
    X['has_label'] = df['labels'].apply(lambda x: 1 if pd.notna(x) and str(x).strip() != "" else 0)
    X['has_assignee'] = df['assignees'].apply(lambda x: 1 if pd.notna(x) and str(x).strip() != "" else 0)
    X['has_reviewer'] = df['requested_reviewers'].apply(lambda x: 1 if pd.notna(x) and str(x).strip() != "" else 0)
    
    # 4. Count Features
    X['label_count'] = df['labels'].apply(count_items)
    X['assignee_count'] = df['assignees'].apply(count_items)
    X['reviewer_count'] = df['requested_reviewers'].apply(count_items)
    
    # 5. Missing / Unknown Indicators
    # Check if author/repo are empty/unknown strings
    def is_empty_or_unknown(val):
        if pd.isna(val): return True
        val_str = str(val).strip().lower()
        return val_str in ["", "unknown", "none", "null", "undefined"]
        
    if is_training:
        X['is_unknown_author'] = df['author'].apply(lambda a: 1 if is_empty_or_unknown(a) else 0)
        X['is_unknown_repository'] = df['repository'].apply(lambda r: 1 if is_empty_or_unknown(r) else 0)
    else:
        author_pr_counts = metadata.get('author_pr_counts', {})
        repo_stats = metadata.get('repository_statistics', {})
        X['is_unknown_author'] = df['author'].apply(
            lambda a: 1 if (is_empty_or_unknown(a) or str(a) not in author_pr_counts) else 0
        )
        X['is_unknown_repository'] = df['repository'].apply(
            lambda r: 1 if (is_empty_or_unknown(r) or str(r) not in repo_stats) else 0
        )
    X['missing_reviewer_info'] = df['requested_reviewers'].apply(lambda r: 1 if pd.isna(r) else 0)
    X['missing_label_info'] = df['labels'].apply(lambda l: 1 if pd.isna(l) else 0)
    
    # 6. Mode-based Features (comments, review_comments, mergeable_state)
    if config.PREDICTION_MODE == "current_state":
        # In current state mode, these are safe to use as they reflect the state *at prediction time*
        X['comments'] = pd.to_numeric(df['comments'], errors='coerce').fillna(0).astype(float)
        X['review_comments'] = pd.to_numeric(df['review_comments'], errors='coerce').fillna(0).astype(float)
        X['comments_per_commit'] = X['comments'] / X['commits'].clip(lower=1)
        
        # Mergeable State One-hot
        unique_mergeable = metadata.get('mergeable_states', ['unknown'])
        for state in unique_mergeable:
            col_name = f"mergeable_state_{state}"
            X[col_name] = (df['mergeable_state'] == state).astype(int)
            
    # 7. Top Label Indicators
    top_labels = metadata.get('top_labels', [])
    for label in top_labels:
        col_name = f"label_{label}"
        X[col_name] = df['labels'].apply(lambda x: has_specific_label(x, label))
        
    # 8. Historical statistics mapping (Time-safe)
    global_mean_cycle = metadata['global_mean_cycle_time']
    global_mean_churn = metadata['global_mean_churn']
    global_mean_review = metadata['global_mean_reviewer_count']
    
    if is_training:
        # IN TRAINING: Extract expanding historical statistics to ensure zero leakage
        # Shift(1) guarantees that row t's features are computed purely on rows 0 to t-1
        df = df.copy()
        df['churn'] = df['additions'] + df['deletions']
        df['reviewer_count'] = df['requested_reviewers'].apply(count_items)
        
        # Author averages
        X['author_avg_cycle_time'] = (
            df.groupby('author')['cycle_time_hours']
              .transform(lambda x: x.shift(1).expanding().mean())
              .fillna(global_mean_cycle)
        )
        X['author_pr_count'] = (
            df.groupby('author')['created_at']
              .transform(lambda x: x.shift(1).expanding().count())
              .fillna(0)
              .astype(int)
        )
        
        # Repository averages
        X['repository_historical_merge_time'] = (
            df.groupby('repository')['cycle_time_hours']
              .transform(lambda x: x.shift(1).expanding().mean())
              .fillna(global_mean_cycle)
        )
        X['repository_average_pr_size'] = (
            df.groupby('repository')['churn']
              .transform(lambda x: x.shift(1).expanding().mean())
              .fillna(global_mean_churn)
        )
        X['repository_average_review_count'] = (
            df.groupby('repository')['reviewer_count']
              .transform(lambda x: x.shift(1).expanding().mean())
              .fillna(global_mean_review)
        )
        X['repository_pr_count'] = (
            df.groupby('repository')['created_at']
              .transform(lambda x: x.shift(1).expanding().count())
              .fillna(0)
              .astype(int)
        )
    else:
        # IN VALIDATION/INFERENCE: Map directly using the fitted lookup statistics
        repo_stats = metadata.get('repository_statistics', {})
        author_avg_cycle_time = metadata.get('author_avg_cycle_time', {})
        author_pr_counts = metadata.get('author_pr_counts', {})
        
        # Author lookup
        X['author_avg_cycle_time'] = df['author'].apply(
            lambda a: author_avg_cycle_time.get(str(a), global_mean_cycle) if not is_empty_or_unknown(a) else global_mean_cycle
        )
        X['author_pr_count'] = df['author'].apply(
            lambda a: author_pr_counts.get(str(a), 0) if not is_empty_or_unknown(a) else 0
        )
        
        # Repository lookup
        def get_repo_stat(repo_name, stat_key, fallback):
            repo_str = str(repo_name)
            if not is_empty_or_unknown(repo_name) and repo_str in repo_stats:
                return repo_stats[repo_str][stat_key]
            return fallback
            
        X['repository_historical_merge_time'] = df['repository'].apply(
            lambda r: get_repo_stat(r, 'historical_merge_time', global_mean_cycle)
        )
        X['repository_average_pr_size'] = df['repository'].apply(
            lambda r: get_repo_stat(r, 'average_pr_size', global_mean_churn)
        )
        X['repository_average_review_count'] = df['repository'].apply(
            lambda r: get_repo_stat(r, 'average_review_count', global_mean_review)
        )
        X['repository_pr_count'] = df['repository'].apply(
            lambda r: get_repo_stat(r, 'pr_count', 0)
        )
        
    # Sanitize feature column names to prevent LightGBM character faults
    X = sanitize_column_names(X)
    
    return X

def get_known_repo_features(X: pd.DataFrame) -> pd.DataFrame:
    """
    Returns features for Model A (Known Repository model), which includes historical stats.
    """
    return X.copy()

def get_cold_start_features(X: pd.DataFrame) -> pd.DataFrame:
    """
    Returns features for Model B (Cold-start model), explicitly excluding repo/author historical statistics
    to enforce generalizability to new projects/developers.
    """
    cols_to_exclude = [
        'author_avg_cycle_time', 'author_pr_count', 
        'repository_historical_merge_time', 'repository_average_pr_size', 
        'repository_average_review_count', 'repository_pr_count'
    ]
    # Sanitize excluded names
    sanitized_exclude = []
    for col in cols_to_exclude:
        # Standard replacement matching sanitize_column_names behavior
        new_col = col.replace('-', '_').replace('/', '_')
        sanitized_exclude.append(new_col)
        
    valid_cols = [c for c in X.columns if c not in sanitized_exclude]
    return X[valid_cols].copy()
