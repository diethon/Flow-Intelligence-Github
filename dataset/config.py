"""
Production-Ready Machine Learning Pipeline Configuration
"""

import os

RANDOM_STATE = 42
TEST_SIZE = 0.2

# File paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "raw_pr_dataset.csv")

# Model files
KNOWN_REPO_MODEL_PATH = os.path.join(BASE_DIR, "known_repository_model.joblib")
COLD_START_MODEL_PATH = os.path.join(BASE_DIR, "cold_start_model.joblib")

# Metadata and Reports
KNOWN_REPO_METADATA_PATH = os.path.join(BASE_DIR, "known_repository_metadata.json")
COLD_START_METADATA_PATH = os.path.join(BASE_DIR, "cold_start_metadata.json")
EVAL_REPORT_PATH = os.path.join(BASE_DIR, "evaluation-report.json")
CALIBRATION_REPORT_PATH = os.path.join(BASE_DIR, "calibration-report.json")
DATA_SPLIT_REPORT_PATH = os.path.join(BASE_DIR, "data-split-report.json")
MODEL_CARD_PATH = os.path.join(BASE_DIR, "model-card.md")

# Feature configurations
FEATURE_VERSION = "3.0.0"

# Target classes
RISK_CLASSES = {
    0: "Low",
    1: "Medium",
    2: "High"
}

# Thresholds
MIN_REPOSITORY_HISTORY = 5
MIN_CONFIDENCE = 0.55
MIN_MARGIN = 0.10

# Prediction Mode: "creation_time" or "current_state"
# - "creation_time": excludes comments, review_comments, and mergeable_state to prevent leakage at opening.
# - "current_state": includes current counts of comments, review_comments, and mergeable_state indicators.
PREDICTION_MODE = "creation_time"

# Acceptance Criteria Thresholds
ACCEPTANCE_THRESHOLDS = {
    "macro_f1": 0.50,
    "high_risk_recall": 0.50,
    "log_loss_calib_check": 0.05  # Max allowed deterioration in log loss due to calibration
}

# Hyperparameter search grids
PARAM_GRIDS = {
    "RandomForest": {
        "n_estimators": [50, 100, 150],
        "max_depth": [5, 10, 15],
        "min_samples_leaf": [2, 4, 8],
        "max_features": ["sqrt", "log2"]
    },
    "GradientBoosting": {
        "n_estimators": [50, 100],
        "learning_rate": [0.05, 0.1],
        "max_depth": [3, 4],
        "min_samples_leaf": [2, 4]
    },
    "HistGradientBoosting": {
        "max_iter": [50, 100],
        "learning_rate": [0.05, 0.1],
        "max_depth": [3, 5],
        "min_samples_leaf": [20, 40]
    },
    "ExtraTrees": {
        "n_estimators": [50, 100],
        "max_depth": [5, 10, 15],
        "min_samples_leaf": [2, 4, 8],
        "max_features": ["sqrt", "log2"]
    },
    "XGBoost": {
        "n_estimators": [50, 100],
        "learning_rate": [0.05, 0.1],
        "max_depth": [3, 5],
        "min_child_weight": [1, 3]
    },
    "LightGBM": {
        "n_estimators": [50, 100],
        "learning_rate": [0.05, 0.1],
        "max_depth": [3, 5],
        "num_leaves": [15, 31]
    }
}
