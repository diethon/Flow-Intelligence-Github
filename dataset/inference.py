import sys
import json
# pyrefly: ignore [missing-import]
import joblib
import pandas as pd

MODEL_PATH = "pr-delay-risk.joblib"

def predict(input_data):
    try:
        model = joblib.load(MODEL_PATH)
        df = pd.DataFrame([input_data])
        
        proba = model.predict_proba(df)[0]
        pred_class = model.predict(df)[0]
        
        risk_labels = {0: "Low", 1: "Medium", 2: "High"}
        
        result = {
            "probability": float(max(proba)),
            "riskLabel": risk_labels[pred_class]
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    input_json = sys.stdin.read()
    if input_json:
        try:
            input_data = json.loads(input_json)
            predict(input_data)
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}))
