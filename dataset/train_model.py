import pandas as pd
import numpy as np
import json
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import joblib
import os

# Define paths
DATA_PATH = "raw_pr_dataset.csv"
MODEL_PATH = "pr-delay-risk.joblib"
EVAL_REPORT_PATH = "evaluation-report.json"
SCHEMA_PATH = "feature-schema.json" # Overwrite the mock with the real one

print("Loading dataset...")
df = pd.read_csv(DATA_PATH)

# Clean data
# Filter only merged PRs for cycle time
df = df[df['state'] == 'closed'].copy()
df['created_at'] = pd.to_datetime(df['created_at'])
df['merged_at'] = pd.to_datetime(df['merged_at'])

# Drop rows where merged_at is null
df = df.dropna(subset=['merged_at'])

# Calculate cycle time in hours
df['cycle_time_hours'] = (df['merged_at'] - df['created_at']).dt.total_seconds() / 3600

# Define delay label:
# < 24 hours: Low risk (0)
# 24 - 72 hours: Medium risk (1)
# > 72 hours: High risk (2)
def get_risk_label(hours):
    if hours < 24:
        return 0
    elif hours < 72:
        return 1
    else:
        return 2

df['risk_class'] = df['cycle_time_hours'].apply(get_risk_label)

# Feature engineering
# We will use simple numeric features: changed_files, additions, deletions, commits
features = ['changed_files', 'additions', 'deletions', 'commits']
df = df.dropna(subset=features)

X = df[features]
y = df['risk_class']

print(f"Dataset shape: {X.shape}")

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("Training RandomForestClassifier...")
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

print("Evaluating model...")
y_pred = model.predict(X_test)

# Calculate metrics
accuracy = accuracy_score(y_test, y_pred)
# Use weighted averaging since it's a multiclass problem
precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
conf_matrix = confusion_matrix(y_test, y_pred).tolist()

eval_report = {
    "accuracy": round(accuracy, 4),
    "precision": round(precision, 4),
    "recall": round(recall, 4),
    "f1Score": round(f1, 4),
    "confusionMatrix": conf_matrix,
    "classes": ["Low (<24h)", "Medium (24-72h)", "High (>72h)"]
}

with open(EVAL_REPORT_PATH, 'w') as f:
    json.dump(eval_report, f, indent=2)

print(f"Evaluation Report saved to {EVAL_REPORT_PATH}")

print("Saving model...")
joblib.dump(model, MODEL_PATH)
print(f"Model saved to {MODEL_PATH}")

# Save feature schema
feature_schema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "PR Delay Risk Feature Schema",
    "type": "object",
    "properties": {
        "changed_files": { "type": "integer" },
        "additions": { "type": "integer" },
        "deletions": { "type": "integer" },
        "commits": { "type": "integer" }
    },
    "required": ["changed_files", "additions", "deletions", "commits"]
}
with open(SCHEMA_PATH, 'w') as f:
    json.dump(feature_schema, f, indent=2)
print(f"Feature schema saved to {SCHEMA_PATH}")

print("Done!")
