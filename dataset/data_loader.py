"""
Data Loader and Dataset Analysis Module
"""

import pandas as pd
import numpy as np
from utils import logger
import config

def load_and_shuffle_dataset(filepath=config.DATA_PATH):
    """
    Loads raw CSV data and shuffles it completely to prevent sequence bias.
    """
    logger.info(f"Loading raw dataset from {filepath}...")
    df = pd.read_csv(filepath)
    logger.info(f"Loaded {len(df)} raw rows.")
    
    # Shuffle completely
    df_shuffled = df.sample(frac=1.0, random_state=config.RANDOM_STATE).reset_index(drop=True)
    logger.info("Dataset shuffled completely.")
    return df_shuffled

def generate_dataset_analysis_report(df):
    """
    Generates and prints a comprehensive dataset statistics report before training.
    """
    logger.info("Generating Dataset Analysis Report...")
    
    report = []
    report.append("="*60)
    report.append("DATASET ANALYSIS REPORT")
    report.append("="*60)
    
    # Basic Stats
    total_prs = len(df)
    unique_repos = df['repository'].nunique() if 'repository' in df.columns else 0
    report.append(f"Total Pull Requests: {total_prs}")
    report.append(f"Total Unique Repositories: {unique_repos}")
    
    # Top Repositories
    if 'repository' in df.columns:
        report.append("\nTop Repositories by PR Count:")
        repo_counts = df['repository'].value_counts()
        for repo, cnt in repo_counts.items():
            pct = (cnt / total_prs) * 100
            report.append(f"  - {repo}: {cnt} ({pct:.2f}%)")
            
    # Class Distribution (if target is present or calculated)
    # We'll calculate class distribution on closed PRs where merged_at is not null
    if 'state' in df.columns and 'created_at' in df.columns and 'merged_at' in df.columns:
        closed_prs = df[df['state'] == 'closed'].copy()
        closed_prs['created_at'] = pd.to_datetime(closed_prs['created_at'], errors='coerce')
        closed_prs['merged_at'] = pd.to_datetime(closed_prs['merged_at'], errors='coerce')
        closed_prs = closed_prs.dropna(subset=['merged_at', 'created_at'])
        cycle_times = (closed_prs['merged_at'] - closed_prs['created_at']).dt.total_seconds() / 3600
        cycle_times = cycle_times[cycle_times >= 0]
        
        classes = []
        for ct in cycle_times:
            if ct < 24: classes.append(0)
            elif ct < 72: classes.append(1)
            else: classes.append(2)
            
        classes_series = pd.Series(classes)
        class_counts = classes_series.value_counts()
        class_pcts = classes_series.value_counts(normalize=True) * 100
        
        report.append("\nTarget Class Distribution (on clean closed PRs):")
        labels = {0: "Low (<24h)", 1: "Medium (24-72h)", 2: "High (>72h)"}
        for cls, name in labels.items():
            cnt = class_counts.get(cls, 0)
            pct = class_pcts.get(cls, 0)
            report.append(f"  - Class {cls} ({name}): {cnt} ({pct:.2f}%)")
            
    # Missing Values
    report.append("\nMissing Values per Column:")
    missing = df.isna().sum()
    for col, val in missing.items():
        if val > 0:
            pct = (val / total_prs) * 100
            report.append(f"  - {col}: {val} ({pct:.2f}%)")
    if missing.sum() == 0:
        report.append("  - None (no missing values found)")
        
    # Outlier Detection using IQR for numeric features
    numeric_cols = ['changed_files', 'additions', 'deletions', 'commits', 'comments', 'review_comments']
    report.append("\nOutlier Detection (IQR Method):")
    for col in numeric_cols:
        if col in df.columns:
            series = pd.to_numeric(df[col], errors='coerce').fillna(0)
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            outliers = series[(series < lower_bound) | (series > upper_bound)]
            pct = (len(outliers) / total_prs) * 100
            report.append(f"  - {col}: {len(outliers)} outliers detected ({pct:.2f}%) [Range: {series.min()} to {series.max()}]")

    # Feature Distribution
    report.append("\nFeature Distribution Statistics:")
    for col in numeric_cols:
        if col in df.columns:
            series = pd.to_numeric(df[col], errors='coerce').fillna(0)
            report.append(
                f"  - {col:<15}: mean={series.mean():.2f}, std={series.std():.2f}, "
                f"min={series.min():.2f}, 50%={series.median():.2f}, max={series.max():.2f}"
            )

    # Correlation Matrix
    report.append("\nCorrelation Matrix (Numeric Features):")
    existing_numeric = [col for col in numeric_cols if col in df.columns]
    if existing_numeric:
        corr = df[existing_numeric].apply(pd.to_numeric, errors='coerce').corr()
        report.append(corr.to_string())
        
    report.append("="*60)
    
    # Print report
    print("\n".join(report))
    print("\n")
    return "\n".join(report)
