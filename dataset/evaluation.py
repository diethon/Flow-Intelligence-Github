"""
Advanced Model Evaluation and Probability Calibration Assessment
"""

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, log_loss, confusion_matrix, classification_report,
    matthews_corrcoef, balanced_accuracy_score, brier_score_loss
)
from utils import logger
import training

def expected_calibration_error(y_true, y_prob, n_bins=10) -> float:
    """
    Computes Expected Calibration Error (ECE) for multiclass predictions.
    """
    confidences = np.max(y_prob, axis=1)
    predictions = np.argmax(y_prob, axis=1)
    accuracies = (predictions == y_true)
    
    ece = 0.0
    n_samples = len(y_true)
    
    for i in range(n_bins):
        bin_lower = i / n_bins
        bin_upper = (i + 1) / n_bins
        
        # Binary mask for samples in current probability bin
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)
        
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += prop_in_bin * np.abs(avg_confidence_in_bin - accuracy_in_bin)
            
    return float(ece)

def evaluate_calibration_quality(uncalibrated_model, calibrated_model, X_test, y_test) -> dict:
    """
    Compares Log Loss, Brier Score, and Expected Calibration Error before and after calibration.
    """
    logger.info("Evaluating probability calibration quality...")
    
    # 1. Before Calibration metrics
    try:
        y_prob_uncal = uncalibrated_model.predict_proba(X_test)
        loss_uncal = log_loss(y_test, y_prob_uncal)
        brier_uncal = training.brier_score_multiclass(y_test, y_prob_uncal)
        ece_uncal = expected_calibration_error(y_test, y_prob_uncal)
    except Exception as e:
        logger.warning(f"Failed to compute uncalibrated probabilities: {e}")
        # If uncalibrated model does not support predict_proba, mock or default
        loss_uncal, brier_uncal, ece_uncal = 999.0, 2.0, 1.0

    # 2. After Calibration metrics
    y_prob_cal = calibrated_model.predict_proba(X_test)
    loss_cal = log_loss(y_test, y_prob_cal)
    brier_cal = training.brier_score_multiclass(y_test, y_prob_cal)
    ece_cal = expected_calibration_error(y_test, y_prob_cal)
    
    # Brier Score improvement is the primary indicator
    calibration_improved = bool(brier_cal < brier_uncal or loss_cal < loss_uncal)
    
    report = {
        "beforeCalibration": {
            "logLoss": round(loss_uncal, 4),
            "brierScore": round(brier_uncal, 4),
            "ece": round(ece_uncal, 4)
        },
        "afterCalibration": {
            "logLoss": round(loss_cal, 4),
            "brierScore": round(brier_cal, 4),
            "ece": round(ece_cal, 4)
        },
        "calibrationImproved": calibration_improved
    }
    
    logger.info(f"Calibration Evaluation: Improved={calibration_improved} "
                f"(LogLoss: {loss_uncal:.4f} -> {loss_cal:.4f}, ECE: {ece_uncal:.4f} -> {ece_cal:.4f})")
    
    return report

def calculate_metrics(model, X_test, y_test) -> dict:
    """
    Calculates extensive metrics including per-class metrics and composite scoring metrics.
    """
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)
    
    # General metrics
    acc = accuracy_score(y_test, y_pred)
    bal_acc = balanced_accuracy_score(y_test, y_pred)
    mcc = matthews_corrcoef(y_test, y_pred)
    loss = log_loss(y_test, y_prob)
    
    # F1 score types
    f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    
    try:
        roc_auc_ovr = roc_auc_score(y_test, y_prob, multi_class="ovr", average="weighted")
    except Exception:
        roc_auc_ovr = 0.0
        
    conf_matrix = confusion_matrix(y_test, y_pred).tolist()
    
    # Per-Class Precision, Recall, F1
    rep_dict = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    
    per_class_metrics = {}
    class_map = {"0": "low", "1": "medium", "2": "high"}
    
    for str_key, clean_key in class_map.items():
        if str_key in rep_dict:
            per_class_metrics[clean_key] = {
                "precision": round(rep_dict[str_key]["precision"], 4),
                "recall": round(rep_dict[str_key]["recall"], 4),
                "f1": round(rep_dict[str_key]["f1-score"], 4),
                "support": int(rep_dict[str_key]["support"])
            }
        else:
            per_class_metrics[clean_key] = {"precision": 0.0, "recall": 0.0, "f1": 0.0, "support": 0}
            
    # Highlight structural predictions problems (Point 8)
    highlights = []
    high_recall = per_class_metrics["high"]["recall"]
    if high_recall < 0.50:
        highlights.append(f"WARNING: High-risk class recall is critically low ({high_recall:.2f}). Important delays might go unnoticed.")
        
    medium_support = per_class_metrics["medium"]["support"]
    medium_predictions_count = int(np.sum(y_pred == 1))
    if medium_support > 0 and medium_predictions_count == 0:
        highlights.append("CRITICAL: Medium class is never predicted by the model (class starvation).")
        
    # Check if the model simply favors the majority class
    class_counts = pd.Series(y_test).value_counts(normalize=True)
    majority_class = class_counts.index[0]
    majority_pct = class_counts.iloc[0]
    majority_pred_pct = np.mean(y_pred == majority_class)
    
    if majority_pred_pct > 0.85 and majority_pct < 0.70:
        highlights.append(f"WARNING: Model is highly biased towards majority class {majority_class} (predicts it {majority_pred_pct*100:.1f}% of the time vs actual {majority_pct*100:.1f}%).")
        
    # Calculate composite score metrics
    comp_scores = training.calculate_composite_score(y_test, y_pred, y_prob)
    
    metrics = {
        "accuracy": round(float(acc), 4),
        "balancedAccuracy": round(float(bal_acc), 4),
        "matthewsCorrelationCoefficient": round(float(mcc), 4),
        "f1Weighted": round(float(f1_weighted), 4),
        "f1Macro": round(float(f1_macro), 4),
        "rocAucWeighted": round(float(roc_auc_ovr), 4),
        "logLoss": round(float(loss), 4),
        "brierScore": round(comp_scores["brier_score"], 4),
        "highRiskRecall": round(comp_scores["high_risk_recall"], 4),
        "highRiskPrecision": round(comp_scores["high_risk_precision"], 4),
        "compositeScore": round(comp_scores["composite"], 4),
        "confusionMatrix": conf_matrix,
        "perClassMetrics": per_class_metrics,
        "highlights": highlights
    }
    
    return metrics

def print_evaluation_summary(metrics: dict, dataset_name: str = "Test Set"):
    """
    Prints a detailed summary of key evaluation metrics.
    """
    print(f"\n" + "="*60)
    print(f"EVALUATION METRICS SUMMARY: {dataset_name.upper()}")
    print("="*60)
    print(f"  Accuracy                : {metrics['accuracy']:.4f}")
    print(f"  Balanced Accuracy       : {metrics['balancedAccuracy']:.4f}")
    print(f"  MCC                     : {metrics['matthewsCorrelationCoefficient']:.4f}")
    print(f"  Weighted F1-Score       : {metrics['f1Weighted']:.4f}")
    print(f"  Macro F1-Score          : {metrics['f1Macro']:.4f}")
    print(f"  High-Risk Recall        : {metrics['highRiskRecall']:.4f}")
    print(f"  High-Risk Precision     : {metrics['highRiskPrecision']:.4f}")
    print(f"  Log Loss                : {metrics['logLoss']:.4f}")
    print(f"  Brier Score             : {metrics['brierScore']:.4f}")
    print(f"  Composite Score (CV)    : {metrics['compositeScore']:.4f}")
    
    print("\n  Per-Class Metrics:")
    for cls in ["low", "medium", "high"]:
        m = metrics["perClassMetrics"][cls]
        print(f"    - {cls.capitalize():<8}: Precision={m['precision']:.4f}, Recall={m['recall']:.4f}, F1={m['f1']:.4f} (Support={m['support']})")
        
    if metrics["highlights"]:
        print("\n  Diagnostic Highlights:")
        for h in metrics["highlights"]:
            print(f"    * {h}")
    print("="*60 + "\n")
