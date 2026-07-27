import pandas as pd
import numpy as np

def clean_dataset(df, is_training=True):
    """
    Cleans the PR dataset, calculates targets if training, and handles missing/invalid values.
    """
    df = df.copy()
    
    # 1. Standardize and remove duplicate rows
    df = df.drop_duplicates()
    
    # 2. Convert datetime columns
    df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
    
    if is_training:
        # Filter only closed (and thus merged or closed) PRs for cycle time training
        df = df[df['state'] == 'closed'].copy()
        df['merged_at'] = pd.to_datetime(df['merged_at'], errors='coerce')
        
        # Drop rows where merged_at is null (we only predict delay risk for merged PRs in training)
        df = df.dropna(subset=['merged_at', 'created_at'])
        
        # 3. Calculate cycle time in hours
        df['cycle_time_hours'] = (df['merged_at'] - df['created_at']).dt.total_seconds() / 3600
        
        # Filter out invalid negative cycle times
        df = df[df['cycle_time_hours'] >= 0]
        
        # Define delay risk class label:
        # < 24 hours: Low risk (0)
        # 24 - 72 hours: Medium risk (1)
        # > 72 hours: High risk (2)
        def get_risk_label(hours):
            if hours < 24:
                return 0
            elif hours < 72:
                return 1
            else:
                return 2
        
        df['risk_class'] = df['cycle_time_hours'].apply(get_risk_label)
        
    return df

def count_items(val):
    """
    Helper to count elements in comma-separated strings.
    """
    if pd.isna(val) or str(val).strip() == "":
        return 0
    return len([x.strip() for x in str(val).split(",") if x.strip()])

def has_specific_label(labels_str, target_label):
    """
    Helper to check if a specific label is present in a comma-separated labels list.
    """
    if pd.isna(labels_str):
        return 0
    labels = [l.strip().lower() for l in str(labels_str).split(",")]
    return 1 if target_label.lower() in labels else 0

def engineer_features(df, metadata=None):
    """
    Performs feature engineering on raw fields.
    If metadata is None, this fits the features and returns (X, metadata).
    If metadata is provided, it uses the fitted metadata and returns X.
    """
    df = df.copy()
    X = pd.DataFrame(index=df.index)
    
    # 1. Numeric Features
    numeric_cols = ['changed_files', 'additions', 'deletions', 'commits', 'comments', 'review_comments']
    for col in numeric_cols:
        if col in df.columns:
            X[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(float)
        else:
            X[col] = 0.0

    # 2. Boolean Features
    X['draft'] = df['draft'].apply(lambda x: 1 if str(x).lower() in ['true', '1', 'yes'] else 0)
    
    X['has_labels'] = df['labels'].apply(lambda x: 1 if pd.notna(x) and str(x).strip() != "" else 0)
    X['has_assignees'] = df['assignees'].apply(lambda x: 1 if pd.notna(x) and str(x).strip() != "" else 0)
    X['has_requested_reviewers'] = df['requested_reviewers'].apply(lambda x: 1 if pd.notna(x) and str(x).strip() != "" else 0)

    # 3. Count Features
    X['label_count'] = df['labels'].apply(count_items)
    X['assignee_count'] = df['assignees'].apply(count_items)
    X['reviewer_count'] = df['requested_reviewers'].apply(count_items)

    # 4. Time Features
    created_at_dt = pd.to_datetime(df['created_at'], errors='coerce')
    X['created_hour'] = created_at_dt.dt.hour.fillna(12).astype(int)
    X['created_weekday'] = created_at_dt.dt.weekday.fillna(0).astype(int)
    X['created_month'] = created_at_dt.dt.month.fillna(1).astype(int)

    # 5. Ratio Features
    X['additions_per_file'] = X['additions'] / X['changed_files'].clip(lower=1)
    X['deletions_per_file'] = X['deletions'] / X['changed_files'].clip(lower=1)
    X['churn'] = X['additions'] + X['deletions']
    X['commits_per_file'] = X['commits'] / X['changed_files'].clip(lower=1)
    X['comments_per_commit'] = X['comments'] / X['commits'].clip(lower=1)

    metadata_out = {} if metadata is None else None

    # 6. Encoded Features: mergeable_state
    if metadata is None:
        unique_mergeable_states = sorted(list(df['mergeable_state'].dropna().unique()))
        if "unknown" not in unique_mergeable_states:
            unique_mergeable_states.append("unknown")
        metadata_out['mergeable_states'] = unique_mergeable_states
    else:
        unique_mergeable_states = metadata['mergeable_states']

    for state in unique_mergeable_states:
        col_name = f"mergeable_state_{state}"
        X[col_name] = (df['mergeable_state'] == state).astype(int)

    # 7. Encoded Features: repository (one-hot encode)
    if metadata is None:
        unique_repos = sorted(list(df['repository'].dropna().unique()))
        metadata_out['repositories'] = unique_repos
    else:
        unique_repos = metadata['repositories']

    for repo in unique_repos:
        col_name = f"repository_{repo}"
        X[col_name] = (df['repository'] == repo).astype(int)

    # 8. Top 10 Labels (extracted from training labels)
    if metadata is None:
        all_labels = []
        for l_list in df['labels'].dropna():
            all_labels.extend([x.strip() for x in str(l_list).split(",") if x.strip()])
        if all_labels:
            top_labels = list(pd.Series(all_labels).value_counts().head(10).index)
        else:
            top_labels = []
        metadata_out['top_labels'] = top_labels
    else:
        top_labels = metadata['top_labels']

    for label in top_labels:
        col_name = f"label_{label}"
        X[col_name] = df['labels'].apply(lambda x: has_specific_label(x, label))

    # 9. Author Target & Frequency Encoding
    if metadata is None:
        global_mean_cycle_time = float(df['cycle_time_hours'].mean())
        
        # Calculate counts and means per author
        author_stats = df.groupby('author')['cycle_time_hours'].agg(['count', 'mean'])
        
        # Smooth target encoding: (count * mean + weight * global_mean) / (count + weight)
        weight = 10.0
        smoothed_avg = (author_stats['count'] * author_stats['mean'] + weight * global_mean_cycle_time) / (author_stats['count'] + weight)
        
        author_avg_cycle_time = smoothed_avg.to_dict()
        author_pr_counts = author_stats['count'].to_dict()
        
        metadata_out['global_mean_cycle_time'] = global_mean_cycle_time
        metadata_out['author_avg_cycle_time'] = {str(k): float(v) for k, v in author_avg_cycle_time.items()}
        metadata_out['author_pr_counts'] = {str(k): int(v) for k, v in author_pr_counts.items()}
    else:
        global_mean_cycle_time = metadata['global_mean_cycle_time']
        author_avg_cycle_time = metadata['author_avg_cycle_time']
        author_pr_counts = metadata['author_pr_counts']

    # Map authors to frequency and average target duration
    X['author_pr_count'] = df['author'].map(author_pr_counts).fillna(0).astype(int)
    X['author_avg_cycle_time'] = df['author'].map(author_avg_cycle_time).fillna(global_mean_cycle_time).astype(float)

    # 10. Align Column Order
    if metadata is None:
        metadata_out['feature_cols'] = list(X.columns)
        return X, metadata_out
    else:
        # Align with the expected feature cols
        X = X.reindex(columns=metadata['feature_cols'], fill_value=0)
        return X
