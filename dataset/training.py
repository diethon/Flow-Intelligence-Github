"""
Training, Hyperparameter Tuning, Probability Calibration, and Composite Scoring
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, GroupKFold
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, HistGradientBoostingClassifier, ExtraTreesClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import f1_score, recall_score, balanced_accuracy_score, matthews_corrcoef
import config
from utils import logger

# Check optional libraries
try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False

try:
    import lightgbm as lgb
    LGB_AVAILABLE = True
except ImportError:
    LGB_AVAILABLE = False

def initialize_model(model_name: str):
    """
    Instantiates the base classifier by name with default class balancing.
    """
    if model_name == "RandomForest":
        return RandomForestClassifier(class_weight="balanced", random_state=config.RANDOM_STATE)
    elif model_name == "GradientBoosting":
        return GradientBoostingClassifier(random_state=config.RANDOM_STATE)
    elif model_name == "HistGradientBoosting":
        return HistGradientBoostingClassifier(class_weight="balanced", random_state=config.RANDOM_STATE)
    elif model_name == "ExtraTrees":
        return ExtraTreesClassifier(class_weight="balanced", random_state=config.RANDOM_STATE)
    elif model_name == "XGBoost" and XGB_AVAILABLE:
        return xgb.XGBClassifier(random_state=config.RANDOM_STATE, eval_metric="mlogloss")
    elif model_name == "LightGBM" and LGB_AVAILABLE:
        return lgb.LGBMClassifier(class_weight="balanced", random_state=config.RANDOM_STATE, verbose=-1)
    else:
        raise ValueError(f"Unknown or unavailable model name: {model_name}")

def brier_score_multiclass(y_true, y_prob) -> float:
    """
    Computes the multiclass Brier score (mean squared error of probability predictions).
    """
    n_samples, n_classes = y_prob.shape
    y_true_onehot = np.zeros((n_samples, n_classes))
    for i, val in enumerate(y_true):
        # Handle cases where y_true contains values outside the probability classes range (safety check)
        if 0 <= val < n_classes:
            y_true_onehot[i, val] = 1.0
    return float(np.mean(np.sum((y_prob - y_true_onehot) ** 2, axis=1)))

def calculate_composite_score(y_true, y_pred, y_prob) -> dict:
    """
    Computes the composite model selection score:
    - 30% Macro F1
    - 30% High-risk Recall (class 2)
    - 20% Balanced Accuracy
    - 10% Normalized MCC (shifted from [-1, 1] to [0, 1])
    - 10% Calibration Score (derived from multiclass Brier Score, where 0 is worst, 1 is best)
    """
    # 1. Macro F1
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    
    # 2. High-risk Recall (class 2)
    # Average='binary' can be used if we filter for class 2.
    y_true_high = (y_true == 2).astype(int)
    y_pred_high = (y_pred == 2).astype(int)
    high_risk_recall = recall_score(y_true_high, y_pred_high, zero_division=0)
    high_risk_precision = float(np.mean(y_true[y_pred == 2] == 2)) if np.any(y_pred == 2) else 0.0
    
    # 3. Balanced Accuracy
    bal_acc = balanced_accuracy_score(y_true, y_pred)
    
    # 4. MCC (normalized to [0, 1])
    mcc = matthews_corrcoef(y_true, y_pred)
    normalized_mcc = (mcc + 1.0) / 2.0
    
    # 5. Calibration Score (1.0 - Brier_Score/2.0 since Brier score maxes out at 2.0)
    brier = brier_score_multiclass(y_true, y_prob)
    calibration_score = 1.0 - (brier / 2.0)
    
    composite = (
        0.30 * macro_f1
        + 0.30 * high_risk_recall
        + 0.20 * bal_acc
        + 0.10 * normalized_mcc
        + 0.10 * calibration_score
    )
    
    return {
        "composite": float(composite),
        "macro_f1": float(macro_f1),
        "high_risk_recall": float(high_risk_recall),
        "high_risk_precision": float(high_risk_precision),
        "balanced_accuracy": float(bal_acc),
        "mcc": float(mcc),
        "brier_score": float(brier),
        "calibration_score": float(calibration_score)
    }

def train_and_tune(model_name: str, X_train, y_train) -> tuple:
    """
    Performs hyperparameter tuning using RandomizedSearchCV.
    Tuned on the composite-score-related weighted F1.
    """
    logger.info(f"Tuning hyperparameters for {model_name}...")
    base_model = initialize_model(model_name)
    param_dist = config.PARAM_GRIDS.get(model_name, {})
    
    fit_params = {}
    if model_name in ["GradientBoosting", "XGBoost"]:
        sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)
        fit_params["sample_weight"] = sample_weights
        
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=config.RANDOM_STATE)
    
    search = RandomizedSearchCV(
        estimator=base_model,
        param_distributions=param_dist,
        n_iter=6,
        cv=cv,
        scoring="f1_macro", # Tune for macro F1 to benefit composite metrics
        random_state=config.RANDOM_STATE,
        n_jobs=-1,
        error_score="raise"
    )
    
    search.fit(X_train, y_train, **fit_params)
    logger.info(f"Best params for {model_name}: {search.best_params_}")
    return search.best_estimator_, search.best_params_

def run_cross_validation_with_composite_score(model_name: str, X, y, groups=None) -> dict:
    """
    Runs 5-fold cross-validation, performing base training, calibration, and calculating
    out-of-fold composite scores. Ensures model selection is validation-driven.
    """
    logger.info(f"Running 5-fold Cross Validation with Composite Score for {model_name}...")
    
    if groups is not None:
        cv = GroupKFold(n_splits=5)
        splits = cv.split(X, y, groups=groups)
    else:
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=config.RANDOM_STATE)
        splits = cv.split(X, y)
        
    fold_results = []
    
    X_arr = X.to_numpy() if isinstance(X, pd.DataFrame) else np.array(X)
    y_arr = y.to_numpy() if isinstance(y, pd.Series) else np.array(y)
    
    for fold, (train_idx, val_idx) in enumerate(splits):
        X_tr, X_val = X_arr[train_idx], X_arr[val_idx]
        y_tr, y_val = y_arr[train_idx], y_arr[val_idx]
        
        # Fit base model
        model = initialize_model(model_name)
        
        fit_params = {}
        if model_name in ["GradientBoosting", "XGBoost"]:
            sample_weights = compute_sample_weight(class_weight='balanced', y=y_tr)
            fit_params["sample_weight"] = sample_weights
            
        model.fit(X_tr, y_tr, **fit_params)
        
        # Calibrate on train fold
        calibrated = calibrate_and_fit(model, X_tr, y_tr)
        
        # Predict on validation fold
        preds = calibrated.predict(X_val)
        probs = calibrated.predict_proba(X_val)
        
        # Evaluate composite score
        scores = calculate_composite_score(y_val, preds, probs)
        fold_results.append(scores)
        
    # Aggregate scores
    agg_results = {}
    metric_keys = ["composite", "macro_f1", "high_risk_recall", "high_risk_precision", "balanced_accuracy", "mcc", "brier_score"]
    for key in metric_keys:
        vals = [f[key] for f in fold_results]
        agg_results[f"mean_{key}"] = float(np.mean(vals))
        agg_results[f"std_{key}"] = float(np.std(vals))
        
    logger.info(
        f"{model_name} CV Composite Score: {agg_results['mean_composite']:.4f} ± {agg_results['std_composite']:.4f} "
        f"(Macro F1: {agg_results['mean_macro_f1']:.4f}, High Recall: {agg_results['mean_high_risk_recall']:.4f})"
    )
    
    return agg_results

def calibrate_and_fit(model, X_train, y_train):
    """
    Calibrates prediction probabilities using CalibratedClassifierCV.
    Uses FrozenEstimator if training class count is extremely small (preventing fold size crashes).
    """
    class_counts = pd.Series(y_train).value_counts()
    min_class_size = class_counts.min() if len(class_counts) > 0 else 0
    
    if len(class_counts) < 3 or min_class_size < 5:
        # Dynamic fallback: fit base model and wrap in FrozenEstimator
        fit_params = {}
        if type(model).__name__ in ["GradientBoostingClassifier", "XGBClassifier"]:
            sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)
            fit_params["sample_weight"] = sample_weights
            
        model.fit(X_train, y_train, **fit_params)
        
        frozen_model = FrozenEstimator(model)
        calibrated = CalibratedClassifierCV(estimator=frozen_model, method="sigmoid")
        calibrated.fit(X_train, y_train)
    else:
        # Standard calibration using 5-fold CV internally
        calibrated = CalibratedClassifierCV(estimator=model, method="sigmoid", cv=5, n_jobs=-1)
        calibrated.fit(X_train, y_train)
        
    return calibrated
