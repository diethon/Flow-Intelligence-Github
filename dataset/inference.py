"""
ML Pipeline Inference Runner - Entry point for prediction
"""

import sys
import json
import os

# Append current directory to path to ensure modules import correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from predict import predict_pr

def main():
    input_json = sys.stdin.read()
    if not input_json or not input_json.strip():
        print(json.dumps({"error": "No input received"}))
        return
        
    try:
        input_data = json.loads(input_json)
        prediction_result = predict_pr(input_data)
        print(json.dumps(prediction_result))
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
