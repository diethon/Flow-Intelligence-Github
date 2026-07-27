"""
Production-Oriented Machine Learning Pipeline Orchestration & Benchmark Runner
"""

import os
import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime

import config
import utils
import data_loader
import preprocessing
import feature_engineering
import training
import evaluation
import explainability
from utils import logger

def extract_feature_stats(X_train: pd.DataFrame) -> dict:
    stats = {}
    for col in X_train.columns:
        stats[col] = {
            "mean": float(X_train[col].mean()),
            "std": float(X_train[col].std()) if X_train[col].std() > 0 else 1.0
        }
    return stats

def train_and_save_model_type(model_type: str, X_train, y_train, X_test, y_test, raw_train_df, algos_to_test):
    """
    Orchestrates selection, tuning, calibration, and saves a specific model type.
    """
    logger.info(f"\nTraining pipeline for MODEL TYPE: {model_type.upper()}")
    
    # 1. Algorithm Selection via Cross Validation with Composite Score
    cv_results = {}
    for name in algos_to_test:
        try:
            cv_res = training.run_cross_validation_with_composite_score(name, X_train, y_train)
            cv_results[name] = cv_res["mean_composite"]
        except Exception as e:
            logger.warning(f"CV failed for {name}: {e}")
            
    if not cv_results:
        raise RuntimeError("All algorithms failed cross-validation!")
        
    best_algo = max(cv_results, key=cv_results.get)
    logger.info(f"==> Best algorithm selected for {model_type} by CV Composite Score: {best_algo} (Score: {cv_results[best_algo]:.4f})")
    
    # 2. Hyperparameter Tuning
    uncalibrated_best, best_params = training.train_and_tune(best_algo, X_train, y_train)
    
    # Fit the best uncalibrated model on full training set
    fit_params = {}
    if best_algo in ["GradientBoosting", "XGBoost"]:
        from sklearn.utils.class_weight import compute_sample_weight
        sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)
        fit_params["sample_weight"] = sample_weights
    uncalibrated_best.fit(X_train, y_train, **fit_params)
    
    # 3. Probability Calibration
    calibrated_best = training.calibrate_and_fit(uncalibrated_best, X_train, y_train)
    
    # Evaluate calibration quality
    calib_report = evaluation.evaluate_calibration_quality(uncalibrated_best, calibrated_best, X_test, y_test)
    
    # 4. Evaluate final performance on test set
    test_metrics = evaluation.calculate_metrics(calibrated_best, X_test, y_test)
    evaluation.print_evaluation_summary(test_metrics, f"{model_type} Test Set")
    
    # 5. Global Permutation Importance
    importance = explainability.compute_permutation_importance(calibrated_best, X_test, y_test)
    
    # Save artifacts
    model_path = config.KNOWN_REPO_MODEL_PATH if model_type == "known_repository" else config.COLD_START_MODEL_PATH
    meta_path = config.KNOWN_REPO_METADATA_PATH if model_type == "known_repository" else config.COLD_START_METADATA_PATH
    
    # Fit feature metadata to save
    metadata = feature_engineering.fit_feature_metadata(raw_train_df)
    metadata["featureColumns"] = list(X_train.columns)
    metadata["selectedFeatures"] = list(X_train.columns)
    metadata["feature_stats"] = extract_feature_stats(X_train)
    metadata["global_importance"] = importance
    
    # Version metadata card details
    card_meta = utils.generate_model_metadata(
        model_type=model_type,
        best_algo=best_algo,
        best_params=best_params,
        features_list=list(X_train.columns),
        df_train=raw_train_df,
        eval_results=test_metrics
    )
    metadata.update(card_meta)
    
    # Save files
    joblib.dump(calibrated_best, model_path)
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)
        
    logger.info(f"Model and metadata saved successfully for {model_type}.")
    
    return calibrated_best, test_metrics, calib_report, importance

def generate_model_card_markdown(known_metrics, cold_metrics, calib_report_known, calib_report_cold, data_split_report, production_ready, blocking_issues):
    """
    Point 14: Generates model-card.md documentation.
    """
    card = f"""# Model Card: GitHub PR Delay Risk Prediction Candidate

## Model Overview
This system predicts the risk of a Pull Request having a long merge delay (low, medium, or high risk) in the GitHub Flow Intelligence project. The model is built utilizing two specialized estimators: a **Known Repository Model** (Model A) and a **Cold-start Model** (Model B), managed via an automated prediction router.

* **Prediction Mode:** `{config.PREDICTION_MODE}`
* **Feature Version:** `{config.FEATURE_VERSION}`
* **Training Date:** `{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC`
* **Random Seed:** `{config.RANDOM_STATE}`

---

## Intended Use
Used to warn development teams of high-risk PRs that might delay shipping, enabling early reviews, conflict resolutions, or smaller commits.

* **Creation-time Mode:** Excludes post-creation indicators (comments, reviews) to predict risk immediately when the PR is opened.
* **Current-state Mode:** Uses the current comments and mergeable state for mid-flight predictions.

---

## Generalization Performance Benchmarks

### 1. Known Repository Model (Model A)
Evaluation results on Stratified Test Set:

* **Accuracy:** `{known_metrics['accuracy']:.4f}`
* **Balanced Accuracy:** `{known_metrics['balancedAccuracy']:.4f}`
* **Macro F1-Score:** `{known_metrics['f1Macro']:.4f}`
* **High-Risk Recall:** `{known_metrics['highRiskRecall']:.4f}`
* **High-Risk Precision:** `{known_metrics['highRiskPrecision']:.4f}`
* **Brier Score:** `{known_metrics['brierScore']:.4f}`
* **Log Loss:** `{known_metrics['logLoss']:.4f}`

### 2. Cold-start Model (Model B)
Evaluation results on Generalization Stratified Test Set:

* **Accuracy:** `{cold_metrics['accuracy']:.4f}`
* **Balanced Accuracy:** `{cold_metrics['balancedAccuracy']:.4f}`
* **Macro F1-Score:** `{cold_metrics['f1Macro']:.4f}`
* **High-Risk Recall:** `{cold_metrics['highRiskRecall']:.4f}`
* **High-Risk Precision:** `{cold_metrics['highRiskPrecision']:.4f}`
* **Brier Score:** `{cold_metrics['brierScore']:.4f}`

---

## Split Strategy & Calibration Report

### Data Split Benchmarks
* **Random Stratified Test Set size:** `{data_split_report['stratified']['test_size']}` samples
* **Repository Group Split Test (Unseen codebases):** Accuracy = `{data_split_report['group']['accuracy']:.4f}`, F1 Macro = `{data_split_report['group']['f1_macro']:.4f}`
* **TimeSeries Chronological 80/20 split:** Accuracy = `{data_split_report['chronological']['accuracy']:.4f}`, F1 Macro = `{data_split_report['chronological']['f1_macro']:.4f}`

### Probability Calibration
Calibration was validated using Brier score and multiclass Log Loss.

* **Known Repo Model Log Loss:** Before = `{calib_report_known['beforeCalibration']['logLoss']}`, After = `{calib_report_known['afterCalibration']['logLoss']}` (Improved: `{calib_report_known['calibrationImproved']}`)
* **Cold-start Model Log Loss:** Before = `{calib_report_cold['beforeCalibration']['logLoss']}`, After = `{calib_report_cold['afterCalibration']['logLoss']}` (Improved: `{calib_report_cold['calibrationImproved']}`)

---

## Production Ready Assessment
* **Production Ready Status:** `{"Ready" if production_ready else "Candidate / Not Ready"}`
* **Verification Score:** `{known_metrics['compositeScore']:.4f}`
"""

    if blocking_issues:
        card += "\n### Blocking Issues:\n"
        for issue in blocking_issues:
            card += f"* {issue}\n"
            
    card += """
---

## Data Leakage Protections
1. **Creation-time Isolation:** If configured, completely ignores labels, comments, and mergeable states that occur post-creation.
2. **Time-safe Expanding Features:** Historical features use a sorted chronological groupby shift-expand cycle. A PR created at time T never sees targets of PRs at or after time T.
3. **Training Isolation:** Validation and test splits map historical statistics purely using training lookups. Unseen keys fallback to global training medians.

---

## Known Limitations
* High-risk recall and macro F1 scores can drop on unseen repositories (Group Split) or future periods (TimeSeries Chronological Split).
* Chronological training sets with small sample sizes limit the model's capacity to recognize changing developer cycle times.
"""
    return card

def run_pipeline():
    logger.info("Initializing Machine Learning Production Pipeline run...")
    
    # 1. Load data
    df_raw = data_loader.load_and_shuffle_dataset(config.DATA_PATH)
    data_loader.generate_dataset_analysis_report(df_raw)
    
    # 2. Clean data
    df_clean = preprocessing.clean_dataset(df_raw, is_training=True)
    
    # 3. Stratified splits
    train_df, test_df = preprocessing.split_stratified(df_clean)
    
    # Fit initial metadata on main train split to extract label set, stats
    metadata_known = feature_engineering.fit_feature_metadata(train_df)
    metadata_cold = feature_engineering.fit_feature_metadata(train_df)
    
    # Transform train and test features
    X_train_raw = feature_engineering.engineer_features(train_df, metadata_known, is_training=True)
    X_test_raw = feature_engineering.engineer_features(test_df, metadata_known, is_training=False)
    y_train = train_df['risk_class']
    y_test = test_df['risk_class']
    
    # Get Model A (Known Repository) and Model B (Cold Start) splits
    X_train_known = feature_engineering.get_known_repo_features(X_train_raw)
    X_test_known = feature_engineering.get_known_repo_features(X_test_raw)
    
    X_train_cold = feature_engineering.get_cold_start_features(X_train_raw)
    X_test_cold = feature_engineering.get_cold_start_features(X_test_raw)
    
    # Algorithms to evaluate
    algos = ["RandomForest", "GradientBoosting", "HistGradientBoosting", "ExtraTrees"]
    if training.XGB_AVAILABLE:
        algos.append("XGBoost")
    if training.LGB_AVAILABLE:
        algos.append("LightGBM")
        
    # Train both models
    model_known, metrics_known, calib_known, imp_known = train_and_save_model_type(
        "known_repository", X_train_known, y_train, X_test_known, y_test, train_df, algos
    )
    
    model_cold, metrics_cold, calib_cold, imp_cold = train_and_save_model_type(
        "cold_start", X_train_cold, y_train, X_test_cold, y_test, train_df, algos
    )
    
    # 4. Evaluate Repository Group Split benchmark
    logger.info("\nRunning Benchmark split: Repository Group Split...")
    train_group_df, test_group_df = preprocessing.split_by_repository(df_clean)
    group_meta = feature_engineering.fit_feature_metadata(train_group_df)
    X_tr_gp = feature_engineering.get_cold_start_features(feature_engineering.engineer_features(train_group_df, group_meta, is_training=True))
    X_te_gp = feature_engineering.get_cold_start_features(feature_engineering.engineer_features(test_group_df, group_meta, is_training=False))
    
    # Train base and calibrated on group split
    uncal_gp, _ = training.train_and_tune("HistGradientBoosting", X_tr_gp, train_group_df['risk_class'])
    uncal_gp.fit(X_tr_gp, train_group_df['risk_class'])
    cal_gp = training.calibrate_and_fit(uncal_gp, X_tr_gp, train_group_df['risk_class'])
    metrics_group = evaluation.calculate_metrics(cal_gp, X_te_gp, test_group_df['risk_class'])
    
    # 5. Evaluate Chronological 80/20 split benchmark
    logger.info("\nRunning Benchmark split: Chronological 80/20 Split...")
    train_chron_df, test_chron_df = preprocessing.split_chronological_80_20(df_clean)
    chron_meta = feature_engineering.fit_feature_metadata(train_chron_df)
    X_tr_ch = feature_engineering.get_known_repo_features(feature_engineering.engineer_features(train_chron_df, chron_meta, is_training=True))
    X_te_ch = feature_engineering.get_known_repo_features(feature_engineering.engineer_features(test_chron_df, chron_meta, is_training=False))
    
    uncal_ch, _ = training.train_and_tune("HistGradientBoosting", X_tr_ch, train_chron_df['risk_class'])
    uncal_ch.fit(X_tr_ch, train_chron_df['risk_class'])
    cal_ch = training.calibrate_and_fit(uncal_ch, X_tr_ch, train_chron_df['risk_class'])
    metrics_chron = evaluation.calculate_metrics(cal_ch, X_te_ch, test_chron_df['risk_class'])
    
    # 6. Evaluate Rolling Window splits (TimeSeriesSplit)
    logger.info("\nRunning Benchmark split: Time-Series Rolling Window...")
    rolling_results = []
    for fold, tr_fold, te_fold in preprocessing.get_rolling_window_folds(df_clean, n_splits=3):
        f_meta = feature_engineering.fit_feature_metadata(tr_fold)
        X_tr_f = feature_engineering.get_known_repo_features(feature_engineering.engineer_features(tr_fold, f_meta, is_training=True))
        X_te_f = feature_engineering.get_known_repo_features(feature_engineering.engineer_features(te_fold, f_meta, is_training=False))
        
        uncal_f, _ = training.train_and_tune("HistGradientBoosting", X_tr_f, tr_fold['risk_class'])
        uncal_f.fit(X_tr_f, tr_fold['risk_class'])
        cal_f = training.calibrate_and_fit(uncal_f, X_tr_f, tr_fold['risk_class'])
        f_metrics = evaluation.calculate_metrics(cal_f, X_te_f, te_fold['risk_class'])
        
        rolling_results.append({
            "fold": fold,
            "train_size": len(tr_fold),
            "test_size": len(te_fold),
            "accuracy": f_metrics["accuracy"],
            "f1_macro": f_metrics["f1Macro"],
            "f1_weighted": f_metrics["f1Weighted"],
            "high_risk_recall": f_metrics["highRiskRecall"],
            "log_loss": f_metrics["logLoss"]
        })
        
    data_split_report = {
        "stratified": {
            "train_size": len(train_df),
            "test_size": len(test_df),
            "accuracy": metrics_known["accuracy"],
            "f1_macro": metrics_known["f1Macro"]
        },
        "group": {
            "train_repos": list(train_group_df['repository'].unique()),
            "test_repos": list(test_group_df['repository'].unique()),
            "accuracy": metrics_group["accuracy"],
            "f1_macro": metrics_group["f1Macro"]
        },
        "chronological": {
            "train_size": len(train_chron_df),
            "test_size": len(test_chron_df),
            "accuracy": metrics_chron["accuracy"],
            "f1_macro": metrics_chron["f1Macro"]
        },
        "rolling_window": rolling_results
    }
    
    # Save data split report
    with open(config.DATA_SPLIT_REPORT_PATH, 'w') as f:
        json.dump(data_split_report, f, indent=2)
        
    # Save calibration report
    with open(config.CALIBRATION_REPORT_PATH, 'w') as f:
        json.dump({
            "known_repository": calib_known,
            "cold_start": calib_cold
        }, f, indent=2)
        
    # Save evaluation report
    with open(config.EVAL_REPORT_PATH, 'w') as f:
        json.dump({
            "known_repository_metrics": metrics_known,
            "cold_start_metrics": metrics_cold
        }, f, indent=2)
        
    # 7. Check Acceptance Criteria (Point 15)
    blocking_issues = []
    
    # Threshold checks
    if metrics_known["f1Macro"] < config.ACCEPTANCE_THRESHOLDS["macro_f1"]:
        blocking_issues.append(f"Known Repo model Macro F1 ({metrics_known['f1Macro']:.4f}) is below threshold ({config.ACCEPTANCE_THRESHOLDS['macro_f1']})")
    if metrics_known["highRiskRecall"] < config.ACCEPTANCE_THRESHOLDS["high_risk_recall"]:
        blocking_issues.append(f"Known Repo model High-risk Recall ({metrics_known['highRiskRecall']:.4f}) is below threshold ({config.ACCEPTANCE_THRESHOLDS['high_risk_recall']})")
        
    # Check if calibration deteriorated log loss too much
    log_loss_det = calib_known["afterCalibration"]["logLoss"] - calib_known["beforeCalibration"]["logLoss"]
    if log_loss_det > config.ACCEPTANCE_THRESHOLDS["log_loss_calib_check"]:
        blocking_issues.append(f"Calibration worsened Log Loss by {log_loss_det:.4f} (exceeds threshold {config.ACCEPTANCE_THRESHOLDS['log_loss_calib_check']})")
        
    production_ready = len(blocking_issues) == 0
    
    # 8. Generate and save Model Card
    card_md = generate_model_card_markdown(
        metrics_known, metrics_cold, calib_known, calib_cold, data_split_report, production_ready, blocking_issues
    )
    with open(config.MODEL_CARD_PATH, 'w') as f:
        f.write(card_md)
        
    logger.info("\n" + "="*80)
    logger.info("FINAL BENCHMARK SPLIT REGIME COMPARISON")
    logger.info("="*80)
    logger.info(f"  Random Stratified       : Accuracy={metrics_known['accuracy']:.4f}, Macro F1={metrics_known['f1Macro']:.4f}")
    logger.info(f"  Repository Group Split  : Accuracy={metrics_group['accuracy']:.4f}, Macro F1={metrics_group['f1Macro']:.4f}")
    logger.info(f"  TimeSeries Chronological: Accuracy={metrics_chron['accuracy']:.4f}, Macro F1={metrics_chron['f1Macro']:.4f}")
    logger.info(f"  Production Ready Status : {production_ready} (Issues: {len(blocking_issues)})")
    logger.info("="*80 + "\n")
    
    # Save acceptance status
    print(json.dumps({
        "productionReady": production_ready,
        "blockingIssues": blocking_issues
    }, indent=2))
    
if __name__ == "__main__":
    run_pipeline()
