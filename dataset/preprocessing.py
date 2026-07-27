"""
Dataset Preprocessing and Splitting Regimes
"""

import pandas as pd
from sklearn.model_selection import train_test_split, GroupShuffleSplit, TimeSeriesSplit
import config
from utils import logger

def clean_dataset(df: pd.DataFrame, is_training: bool = True) -> pd.DataFrame:
    """
    Cleans the raw dataset. Standardizes formats and calculates labels if training.
    """
    df = df.copy()
    
    # 1. Drop duplicates
    df = df.drop_duplicates()
    
    # 2. Parse created_at
    if 'created_at' not in df.columns:
        df['created_at'] = pd.Timestamp.utcnow()
    df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
    df['created_at'] = df['created_at'].fillna(pd.Timestamp.utcnow())
    
    # Ensure sorted by created_at chronologically (critical for expanding features and time splits)
    df = df.sort_values('created_at').reset_index(drop=True)
    
    if is_training:
        # We only train on closed, merged PRs since risk_class is derived from merge cycle time
        df = df[df['state'] == 'closed'].copy()
        df['merged_at'] = pd.to_datetime(df['merged_at'], errors='coerce')
        df = df.dropna(subset=['merged_at'])
        
        # Calculate target cycle time
        df['cycle_time_hours'] = (df['merged_at'] - df['created_at']).dt.total_seconds() / 3600
        
        # Filter invalid cycle times
        df = df[df['cycle_time_hours'] >= 0]
        
        # Assign risk labels:
        # Low risk (0): < 24 hours
        # Medium risk (1): 24 - 72 hours
        # High risk (2): > 72 hours
        def get_risk_label(hours):
            if hours < 24:
                return 0
            elif hours < 72:
                return 1
            else:
                return 2
        df['risk_class'] = df['cycle_time_hours'].apply(get_risk_label)
        
    return df

def split_stratified(df: pd.DataFrame):
    """
    Performs standard random stratified split based on target risk_class.
    """
    logger.info("Splitting dataset: Random Stratified Split")
    train_df, test_df = train_test_split(
        df, 
        test_size=config.TEST_SIZE, 
        random_state=config.RANDOM_STATE, 
        stratify=df['risk_class']
    )
    # Ensure they are sorted by created_at after splitting so time-safe functions work
    train_df = train_df.sort_values('created_at').reset_index(drop=True)
    test_df = test_df.sort_values('created_at').reset_index(drop=True)
    return train_df, test_df

def split_by_repository(df: pd.DataFrame):
    """
    Performs group split based on the 'repository' column (Group Generalization).
    """
    logger.info("Splitting dataset: Repository-wise Group Split")
    gss = GroupShuffleSplit(n_splits=1, test_size=config.TEST_SIZE, random_state=config.RANDOM_STATE)
    
    groups = df['repository'].astype(str)
    train_idx, test_idx = next(gss.split(df, groups=groups))
    
    train_df = df.iloc[train_idx].sort_values('created_at').reset_index(drop=True)
    test_df = df.iloc[test_idx].sort_values('created_at').reset_index(drop=True)
    
    return train_df, test_df

def split_chronological_80_20(df: pd.DataFrame):
    """
    Strategy A: Chronological 80/20 Split.
    Sort by created_at, first 80% train, last 20% test.
    """
    logger.info("Splitting dataset: Chronological 80/20 Split")
    df_sorted = df.sort_values('created_at').reset_index(drop=True)
    split_idx = int(len(df_sorted) * 0.8)
    
    train_df = df_sorted.iloc[:split_idx].copy().reset_index(drop=True)
    test_df = df_sorted.iloc[split_idx:].copy().reset_index(drop=True)
    
    return train_df, test_df

def get_rolling_window_folds(df: pd.DataFrame, n_splits: int = 3):
    """
    Strategy B: Rolling Window (TimeSeriesSplit) Generator.
    Yields (train_df, test_df) sorted chronologically for each fold.
    """
    logger.info(f"Generating {n_splits} Time-Series Rolling Window folds...")
    df_sorted = df.sort_values('created_at').reset_index(drop=True)
    
    tscv = TimeSeriesSplit(n_splits=n_splits)
    for fold, (train_idx, test_idx) in enumerate(tscv.split(df_sorted)):
        train_df = df_sorted.iloc[train_idx].reset_index(drop=True)
        test_df = df_sorted.iloc[test_idx].reset_index(drop=True)
        
        # Verify sizes
        if len(train_df) < 50:
            logger.warning(f"Fold {fold+1} training size {len(train_df)} is too small (<50). Skipping this fold.")
            continue
            
        yield fold + 1, train_df, test_df
