"""
Production Prediction API Router and Inference Module
"""

import os
import json
import joblib
import pandas as pd
import numpy as np
import config
import preprocessing
import feature_engineering
import explainability
from utils import logger

# Cache to store loaded models and metadata
_model_cache = {}
_metadata_cache = {}

def is_empty_or_unknown(val):
    if pd.isna(val): return True
    val_str = str(val).strip().lower()
    return val_str in ["", "unknown", "none", "null", "undefined"]

def load_prediction_artifacts(model_type: str):
    """
    Loads and caches the specified model type ("known_repository" or "cold_start").
    """
    global _model_cache, _metadata_cache
    
    if model_type == "known_repository":
        model_path = config.KNOWN_REPO_MODEL_PATH
        meta_path = config.KNOWN_REPO_METADATA_PATH
    else:
        model_type = "cold_start"  # Force default
        model_path = config.COLD_START_MODEL_PATH
        meta_path = config.COLD_START_METADATA_PATH
        
    if model_type not in _model_cache:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}. Train the model first.")
        _model_cache[model_type] = joblib.load(model_path)
        
    if model_type not in _metadata_cache:
        if not os.path.exists(meta_path):
            raise FileNotFoundError(f"Metadata file not found at {meta_path}. Train the model first.")
        with open(meta_path, 'r') as f:
            _metadata_cache[model_type] = json.load(f)
            
    return _model_cache[model_type], _metadata_cache[model_type]

def predict_pr(raw_pr_dict: dict) -> dict:
    """
    Production prediction API with dual-model routing, uncertainty flags,
    missing value validations, and SHAP explainability.
    """
    # 1. Extract and validate Repository and Author
    repo_name = raw_pr_dict.get("repository", "")
    author_name = raw_pr_dict.get("author", "")
    
    # Load cold_start metadata first to inspect repository statistics
    _, cs_metadata = load_prediction_artifacts("cold_start")
    
    unknown_repo = is_empty_or_unknown(repo_name) or str(repo_name) not in cs_metadata.get("repository_statistics", {})
    unknown_author = is_empty_or_unknown(author_name) or str(author_name) not in cs_metadata.get("author_avg_cycle_time", {})
    
    warnings = []
    if unknown_repo:
        warnings.append("Repository history was unavailable")
    if unknown_author:
        warnings.append("Author history was unavailable")
        
    # Check history count
    repo_history_count = 0
    if not unknown_repo:
        # Check in the statistics stored in metadata
        repo_stats = cs_metadata.get("repository_statistics", {}).get(str(repo_name), {})
        repo_history_count = repo_stats.get("pr_count", 0)
        
    # 2. Dual-Model Routing
    if unknown_repo or repo_history_count < config.MIN_REPOSITORY_HISTORY:
        model_type = "cold_start"
        cold_start = True
        if not unknown_repo:
            warnings.append(f"Repository has insufficient history ({repo_history_count} PRs). Using Cold-start model.")
    else:
        model_type = "known_repository"
        cold_start = False
        
    # Check if repo is known but author is new/unknown
    if model_type == "known_repository" and not unknown_author:
        author_pr_counts = cs_metadata.get("author_pr_counts", {})
        if str(author_name) not in author_pr_counts:
            unknown_author = True
            warnings.append("Author history was unavailable. Using fallback author priors (partial cold-start).")
            
    # Load routed model and metadata
    model, metadata = load_prediction_artifacts(model_type)
    
    # 3. Clean and Engineer features
    df = pd.DataFrame([raw_pr_dict])
    df_cleaned = preprocessing.clean_dataset(df, is_training=False)
    df_engineered = feature_engineering.engineer_features(df_cleaned, metadata=metadata)
    
    # Select Model A vs Model B feature lists
    if model_type == "cold_start":
        df_engineered = feature_engineering.get_cold_start_features(df_engineered)
    else:
        df_engineered = feature_engineering.get_known_repo_features(df_engineered)
        
    # Align feature columns with training set
    feature_cols = metadata["selectedFeatures"]
    df_engineered = df_engineered.reindex(columns=feature_cols, fill_value=0.0)
    
    # 4. Predict probabilities (Calibrated)
    probs = model.predict_proba(df_engineered)[0]
    
    # Sort class probabilities
    pred_idx = int(probs.argmax())
    probs_desc = sorted(probs, reverse=True)
    top1_prob = probs_desc[0]
    top2_prob = probs_desc[1] if len(probs_desc) > 1 else 0.0
    margin = top1_prob - top2_prob
    
    # Risk label mappings
    risk_labels = {0: "Low", 1: "Medium", 2: "High"}
    base_prediction = risk_labels[pred_idx]
    
    # 5. Uncertainty & Low-Confidence Checks
    prediction = base_prediction
    requires_review = False
    
    if top1_prob < config.MIN_CONFIDENCE or margin < config.MIN_MARGIN:
        prediction = "Uncertain"
        requires_review = True
        
    # 6. Local XAI explanations
    top_factors = explainability.explain_prediction_locally(model, df_engineered, pred_idx, metadata)
    
    # Probabilities map
    probabilities_map = {
        "low": round(float(probs[0]), 4),
        "medium": round(float(probs[1]), 4),
        "high": round(float(probs[2]), 4)
    }
    
    return {
        "prediction": prediction,
        "suggestedRisk": base_prediction,
        "confidence": round(float(top1_prob), 4),
        "probabilities": probabilities_map,
        "topFactors": top_factors,
        "modelType": model_type,
        "coldStart": cold_start,
        "unknownRepository": unknown_repo,
        "unknownAuthor": unknown_author,
        "requiresReview": requires_review,
        "warnings": warnings,
        # Backward compatibility fields
        "riskLabel": prediction if prediction != "Uncertain" else base_prediction,
        "probability": round(float(top1_prob), 4)
    }
