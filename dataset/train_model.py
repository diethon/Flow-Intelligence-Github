import pandas as pd
import numpy as np
import json
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
from sklearn.utils.class_weight import compute_sample_weight

# Import shared features module
import features

# Define paths
DATA_PATH = "raw_pr_dataset.csv"
MODEL_PATH = "pr-delay-risk.joblib"
METADATA_PATH = "feature-metadata.json"
EVAL_REPORT_PATH = "evaluation-report.json"
SCHEMA_PATH = "feature-schema.json"

# Check optional libraries
try:
    # pyrefly: ignore [missing-import]
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False

try:
    # pyrefly: ignore [missing-import]
    import lightgbm as lgb
    LGB_AVAILABLE = True
except ImportError:
    LGB_AVAILABLE = False

def load_dataset(filepath=DATA_PATH):
    print(f"Loading dataset from {filepath}...")
    return pd.read_csv(filepath)

def clean_dataset(df):
    print("Cleaning dataset...")
    return features.clean_dataset(df, is_training=True)

def engineer_features(df, metadata=None):
    return features.engineer_features(df, metadata=metadata)

def build_dataset(filepath=DATA_PATH):
    # 1. Load & Clean
    df_raw = load_dataset(filepath)
    df_clean = clean_dataset(df_raw)
    
    # 2. Prevent Repository Bias: Shuffle dataset completely
    print("Shuffling dataset to eliminate repository sequence bias...")
    df_shuffled = df_clean.sample(frac=1, random_state=42).reset_index(drop=True)
    
    X_raw = df_shuffled
    y = df_shuffled['risk_class']
    
    # 3. Stratified Split according to risk_class
    print("Splitting dataset into stratified train and test sets...")
    df_train, df_test, y_train, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # 4. Feature Engineering (fitting on train set only to avoid leakage)
    print("Engineering features (fitting mappings on train set only)...")
    X_train, metadata = engineer_features(df_train, metadata=None)
    X_test = engineer_features(df_test, metadata=metadata)
    
    # 5. Print class distributions
    print("\n" + "="*50)
    print("DATASET CLASS DISTRIBUTION")
    print("="*50)
    
    train_counts = y_train.value_counts()
    train_pcts = y_train.value_counts(normalize=True) * 100
    print("Training distribution:")
    for cls, label in [(0, "Low (<24h)"), (1, "Medium (24-72h)"), (2, "High (>72h)")]:
        count = train_counts.get(cls, 0)
        pct = train_pcts.get(cls, 0)
        print(f"  Class {cls} ({label}): {count} ({pct:.2f}%)")
        
    test_counts = y_test.value_counts()
    test_pcts = y_test.value_counts(normalize=True) * 100
    print("\nTesting distribution:")
    for cls, label in [(0, "Low (<24h)"), (1, "Medium (24-72h)"), (2, "High (>72h)")]:
        count = test_counts.get(cls, 0)
        pct = test_pcts.get(cls, 0)
        print(f"  Class {cls} ({label}): {count} ({pct:.2f}%)")
    print("="*50 + "\n")
    
    return X_train, X_test, y_train, y_test, metadata, df_shuffled

def train_models(X_train, y_train):
    print("Training models and handling class imbalance...")
    trained_models = {}
    
    # Calculate sample weights for GradientBoosting / XGBoost
    sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)
    
    # 1. Random Forest Classifier
    print("Training RandomForestClassifier...")
    rf = RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42)
    rf.fit(X_train, y_train)
    trained_models['RandomForest'] = rf
    
    # 2. Gradient Boosting Classifier (using sample weight for balance)
    print("Training GradientBoostingClassifier...")
    gb = GradientBoostingClassifier(n_estimators=100, random_state=42)
    gb.fit(X_train, y_train, sample_weight=sample_weights)
    trained_models['GradientBoosting'] = gb
    
    # 3. Hist Gradient Boosting Classifier
    print("Training HistGradientBoostingClassifier...")
    hgb = HistGradientBoostingClassifier(max_iter=100, class_weight='balanced', random_state=42)
    hgb.fit(X_train, y_train)
    trained_models['HistGradientBoosting'] = hgb
    
    # 4. Optional XGBoost
    if XGB_AVAILABLE:
        print("Training XGBoost Classifier...")
        try:
            # XGBoost requires class mapping or sample weights
            xgb_model = xgb.XGBClassifier(n_estimators=100, random_state=42, eval_metric='mlogloss')
            xgb_model.fit(X_train, y_train, sample_weight=sample_weights)
            trained_models['XGBoost'] = xgb_model
        except Exception as e:
            print(f"XGBoost training failed: {e}")
    else:
        print("XGBoost is not installed. Skipping.")
        
    # 5. Optional LightGBM
    if LGB_AVAILABLE:
        print("Training LightGBM Classifier...")
        try:
            lgb_model = lgb.LGBMClassifier(n_estimators=100, class_weight='balanced', random_state=42, verbose=-1)
            lgb_model.fit(X_train, y_train)
            trained_models['LightGBM'] = lgb_model
        except Exception as e:
            print(f"LightGBM training failed: {e}")
    else:
        print("LightGBM is not installed. Skipping.")
        
    return trained_models

def evaluate_models(models, X_test, y_test, X_train, y_train, df_shuffled):
    print("Evaluating models...")
    comparison = []
    
    for name, model in models.items():
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        rec = recall_score(y_test, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        
        comparison.append({
            'model_name': name,
            'accuracy': acc,
            'precision': prec,
            'recall': rec,
            'f1_score': f1,
            'model': model
        })
        
    df_comp = pd.DataFrame(comparison)
    print("\n" + "="*70)
    print("MODEL COMPARISON RESULTS ON TEST SET")
    print("="*70)
    print(df_comp[['model_name', 'accuracy', 'precision', 'recall', 'f1_score']].to_string(index=False))
    print("="*70 + "\n")
    
    # Select the best model based on weighted F1-Score
    best_row = df_comp.loc[df_comp['f1_score'].idxmax()]
    best_model_name = best_row['model_name']
    best_model = best_row['model']
    print(f"--> Selected Best Model: {best_model_name} with F1-Score: {best_row['f1_score']:.4f}\n")
    
    # Calculate classification report & confusion matrix for the best model
    best_y_pred = best_model.predict(X_test)
    class_rep = classification_report(y_test, best_y_pred, target_names=["Low", "Medium", "High"], output_dict=True)
    conf_matrix = confusion_matrix(y_test, best_y_pred).tolist()
    
    # Compute Top 20 Feature Importances from RandomForest model (guaranteed to have it)
    rf_model = models['RandomForest']
    importances = rf_model.feature_importances_
    features_list = list(X_test.columns)
    
    feat_imp = pd.Series(importances, index=features_list).sort_values(ascending=False)
    
    print("="*50)
    print("TOP 20 FEATURE IMPORTANCES (from Random Forest)")
    print("="*50)
    for i, (feat, imp) in enumerate(feat_imp.head(20).items()):
        print(f"{i+1:2d}. {feat:<30}: {imp:.4f}")
    print("="*50 + "\n")
    
    # Generate Evaluation Report structure
    eval_report = {
        "accuracy": round(best_row['accuracy'], 4),
        "precision": round(best_row['precision'], 4),
        "recall": round(best_row['recall'], 4),
        "f1Score": round(best_row['f1_score'], 4),
        "confusionMatrix": conf_matrix,
        "classes": ["Low (<24h)", "Medium (24-72h)", "High (>72h)"],
        "classificationReport": class_rep,
        "bestModelName": best_model_name,
        "featureImportance": {k: round(float(v), 5) for k, v in feat_imp.head(20).to_dict().items()},
        "datasetStatistics": {
            "totalRawRows": len(df_shuffled),
            "trainSize": len(X_train),
            "testSize": len(X_test),
            "featureCount": len(features_list)
        }
    }
    
    return best_model_name, best_model, eval_report

def save_model(model, metadata, eval_report):
    # Save best model
    print(f"Saving best model to {MODEL_PATH}...")
    joblib.dump(model, MODEL_PATH)
    
    # Save feature engineering metadata
    print(f"Saving feature metadata to {METADATA_PATH}...")
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=2)
        
    # Save evaluation report
    print(f"Saving evaluation report to {EVAL_REPORT_PATH}...")
    with open(EVAL_REPORT_PATH, 'w') as f:
        json.dump(eval_report, f, indent=2)
        
    # Save updated feature schema
    print(f"Saving new feature schema to {SCHEMA_PATH}...")
    feature_schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "PR Delay Risk Feature Schema",
        "type": "object",
        "properties": {
            "repository": { "type": "string" },
            "pr_number": { "type": "integer" },
            "title": { "type": "string" },
            "author": { "type": "string" },
            "state": { "type": "string" },
            "created_at": { "type": "string" },
            "draft": { "type": "boolean" },
            "changed_files": { "type": "integer" },
            "additions": { "type": "integer" },
            "deletions": { "type": "integer" },
            "commits": { "type": "integer" },
            "comments": { "type": "integer" },
            "review_comments": { "type": "integer" },
            "mergeable_state": { "type": "string" },
            "labels": { "type": "string" },
            "requested_reviewers": { "type": "string" },
            "assignees": { "type": "string" }
        },
        "required": [
            "repository", "pr_number", "title", "author", "state", "created_at",
            "changed_files", "additions", "deletions", "commits", "comments",
            "review_comments", "mergeable_state", "labels", "requested_reviewers", "assignees"
        ]
    }
    with open(SCHEMA_PATH, 'w') as f:
        json.dump(feature_schema, f, indent=2)
        
    print("All artifacts saved successfully!")

if __name__ == "__main__":
    X_train, X_test, y_train, y_test, metadata, df_shuffled = build_dataset()
    models = train_models(X_train, y_train)
    best_model_name, best_model, eval_report = evaluate_models(models, X_test, y_test, X_train, y_train, df_shuffled)
    save_model(best_model, metadata, eval_report)
    print("ML Pipeline execution completed successfully!")
