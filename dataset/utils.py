"""
Utility module for logging, metadata extraction, and model versioning
"""

import logging
import subprocess
import os
import hashlib
from datetime import datetime
import config

def setup_logging():
    """
    Configure pipeline logging
    """
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[
            logging.StreamHandler()
        ]
    )
    logger = logging.getLogger()
    if len(logger.handlers) > 1:
        logger.handlers = logger.handlers[:1]
    return logging.getLogger("ml_pipeline")

logger = setup_logging()

def get_git_commit():
    """
    Retrieve the current git commit hash
    """
    try:
        commit_hash = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], 
            stderr=subprocess.DEVNULL,
            cwd=config.BASE_DIR
        ).decode("utf-8").strip()
        return commit_hash
    except Exception:
        return "unknown_or_no_git_repo"

def calculate_dataset_hash(filepath=config.DATA_PATH):
    """
    Computes MD5 hash of the dataset file
    """
    if not os.path.exists(filepath):
        return "file_not_found"
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def generate_model_metadata(
    model_type: str,
    best_algo: str,
    best_params: dict,
    features_list: list,
    df_train,
    eval_results: dict
) -> dict:
    """
    Generates extensive metadata for model versioning and cards
    """
    import pandas as pd
    created_at_dates = pd.to_datetime(df_train['created_at']) if 'created_at' in df_train.columns else None
    min_date = created_at_dates.min().isoformat() if created_at_dates is not None and not pd.isna(created_at_dates.min()) else "unknown"
    max_date = created_at_dates.max().isoformat() if created_at_dates is not None and not pd.isna(created_at_dates.max()) else "unknown"
    
    repos = list(df_train['repository'].dropna().unique()) if 'repository' in df_train.columns else []
    
    # Import pandas dynamically inside function to avoid circular dependency issues
    import pandas as pd

    return {
        "modelType": model_type,
        "algorithm": best_algo,
        "bestParameters": best_params,
        "trainingTimestamp": datetime.utcnow().isoformat() + "Z",
        "gitCommit": get_git_commit(),
        "randomSeed": config.RANDOM_STATE,
        "featureVersion": config.FEATURE_VERSION,
        "predictionMode": config.PREDICTION_MODE,
        "datasetHash": calculate_dataset_hash(),
        "numberOfRows": len(df_train),
        "repositoriesUsed": repos,
        "dateRange": {
            "min": min_date,
            "max": max_date
        },
        "selectedFeatures": features_list,
        "evaluationMetrics": eval_results
    }
