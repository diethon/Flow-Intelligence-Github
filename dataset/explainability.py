"""
Explainable AI (XAI) Module - Global Permutation Importance & SHAP Local Explanations
"""

import pandas as pd
import numpy as np
from sklearn.inspection import permutation_importance
from utils import logger
import config

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

def get_base_estimator(calibrated_model):
    """
    Unwraps the underlying classifier estimator from CalibratedClassifierCV and FrozenEstimator wrappers.
    """
    if hasattr(calibrated_model, "calibrated_classifiers_"):
        # Take the first fitted CV fold classifier
        clf = calibrated_model.calibrated_classifiers_[0]
        est = clf.estimator
        # Unwrap FrozenEstimator wrapper if present
        if hasattr(est, "estimator"):
            return est.estimator
        return est
    return calibrated_model

def compute_permutation_importance(model, X_test, y_test) -> dict:
    """
    Computes global feature importances using permutation importance.
    """
    logger.info("Computing global Permutation Importance...")
    result = permutation_importance(
        model, X_test, y_test, 
        n_repeats=5, 
        random_state=config.RANDOM_STATE, 
        n_jobs=-1
    )
    
    importances = result.importances_mean
    features_list = list(X_test.columns)
    
    sorted_idx = np.argsort(importances)[::-1]
    sorted_importances = {features_list[i]: float(importances[i]) for i in sorted_idx}
    
    logger.info("Permutation Importance computation complete.")
    return sorted_importances

def explain_prediction_locally(model, single_sample_df: pd.DataFrame, pred_class: int, metadata: dict) -> list:
    """
    Generates local feature explanations.
    Uses SHAP TreeExplainer if available, with a fast model-agnostic local perturbation fallback.
    """
    feature_stats = metadata.get("feature_stats", {})
    feature_cols = metadata.get("featureColumns", list(single_sample_df.columns))
    
    # Ensure correct feature alignment
    single_sample_df = single_sample_df.reindex(columns=feature_cols, fill_value=0.0)
    
    # Filter out unknown/missing indicators and text categoricals from explanations
    excluded_display_features = [
        'is_unknown_author', 'is_unknown_repository', 
        'missing_reviewer_info', 'missing_label_info'
    ]
    # Also exclude repository/author specific features if they are unknown
    is_unknown_repo = single_sample_df.get('is_unknown_repository', pd.Series([0])).iloc[0] == 1
    is_unknown_author = single_sample_df.get('is_unknown_author', pd.Series([0])).iloc[0] == 1
    
    if is_unknown_repo:
        excluded_display_features.extend([
            'repository_historical_merge_time', 'repository_average_pr_size', 
            'repository_average_review_count', 'repository_pr_count'
        ])
    if is_unknown_author:
        excluded_display_features.extend([
            'author_avg_cycle_time', 'author_pr_count'
        ])
        
    factors = []
    
    if SHAP_AVAILABLE:
        try:
            # 1. Try to unwrap tree-based model for TreeExplainer
            base_est = get_base_estimator(model)
            
            # TreeExplainer is extremely fast (milliseconds)
            explainer = shap.TreeExplainer(base_est)
            raw_shap = explainer.shap_values(single_sample_df)
            
            # Extract SHAP values for the predicted class
            # Support multiple output shapes depending on SHAP/sklearn version
            if isinstance(raw_shap, list):
                # List of arrays per class, shape: (N, features)
                shap_class_values = raw_shap[pred_class][0]
            elif isinstance(raw_shap, np.ndarray) and len(raw_shap.shape) == 3:
                # 3D array, shape: (N, features, classes)
                shap_class_values = raw_shap[0, :, pred_class]
            elif isinstance(raw_shap, np.ndarray) and len(raw_shap.shape) == 2:
                # 2D array (binary classification or regression)
                shap_class_values = raw_shap[0]
            else:
                # Fallback to local perturbation
                raise ValueError("Unsupported SHAP output shape. Falling back to perturbation.")
                
            # Populate factors
            for idx, col in enumerate(feature_cols):
                if col in excluded_display_features or col.startswith("mergeable_state_") or col.startswith("repository_"):
                    continue
                    
                val_shap = float(shap_class_values[idx])
                if abs(val_shap) < 1e-4:
                    continue
                    
                raw_val = float(single_sample_df.iloc[0][col])
                mean_val = float(feature_stats.get(col, {}).get("mean", 0.0))
                
                readable_name = col.replace("_", " ").title()
                factors.append({
                    "factor": readable_name,
                    "direction": "increase" if val_shap >= 0 else "decrease",
                    "strength": round(abs(val_shap), 4),
                    "rawValue": round(raw_val, 2),
                    "baselineValue": round(mean_val, 2)
                })
                
        except Exception as e:
            logger.warning(f"SHAP local explanation failed: {e}. Falling back to perturbation XAI.")
            factors = []  # Reset and let perturbation run
            
    # 2. Perturbation-based Local XAI fallback
    # If SHAP is unavailable or failed, calculate local contribution by perturbing values to the baseline
    if not factors:
        try:
            original_probs = model.predict_proba(single_sample_df)[0]
            orig_p = original_probs[pred_class]
            
            perturbation_effects = []
            
            for col in feature_cols:
                if col in excluded_display_features or col.startswith("mergeable_state_") or col.startswith("repository_"):
                    continue
                    
                mean_val = float(feature_stats.get(col, {}).get("mean", 0.0))
                raw_val = float(single_sample_df.iloc[0][col])
                
                # Perturb sample: replace value with its baseline mean
                perturbed_df = single_sample_df.copy()
                if np.issubdtype(single_sample_df[col].dtype, np.integer):
                    val_to_set = int(round(mean_val))
                else:
                    val_to_set = mean_val
                perturbed_df.loc[perturbed_df.index[0], col] = val_to_set
                
                # Predict under perturbation
                p_probs = model.predict_proba(perturbed_df)[0]
                perturbed_p = p_probs[pred_class]
                
                # If removing the feature's value reduces class probability, the actual value increase risk
                effect = orig_p - perturbed_p
                
                if abs(effect) > 1e-4:
                    perturbation_effects.append((col, effect, raw_val, mean_val))
                    
            # Sort by absolute effect
            perturbation_effects.sort(key=lambda x: abs(x[1]), reverse=True)
            
            for col, eff, r_val, m_val in perturbation_effects[:5]:
                readable_name = col.replace("_", " ").title()
                factors.append({
                    "factor": readable_name,
                    "direction": "increase" if eff >= 0 else "decrease",
                    "strength": round(abs(eff), 4),
                    "rawValue": round(r_val, 2),
                    "baselineValue": round(m_val, 2)
                })
        except Exception as ex:
            logger.error(f"Failed to generate perturbation-based local XAI: {ex}")
            factors.append({
                "factor": "Unknown",
                "direction": "increase",
                "strength": 0.0,
                "rawValue": 0.0,
                "baselineValue": 0.0
            })
            
    # Sort final factors by strength descending, limit to top 5
    factors.sort(key=lambda x: x["strength"], reverse=True)
    return factors[:5]
