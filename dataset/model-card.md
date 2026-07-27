# Model Card: GitHub PR Delay Risk Prediction Candidate

## Model Overview
This system predicts the risk of a Pull Request having a long merge delay (low, medium, or high risk) in the GitHub Flow Intelligence project. The model is built utilizing two specialized estimators: a **Known Repository Model** (Model A) and a **Cold-start Model** (Model B), managed via an automated prediction router.

* **Prediction Mode:** `creation_time`
* **Feature Version:** `3.0.0`
* **Training Date:** `2026-07-21 18:33:58 UTC`
* **Random Seed:** `42`

---

## Intended Use
Used to warn development teams of high-risk PRs that might delay shipping, enabling early reviews, conflict resolutions, or smaller commits.

* **Creation-time Mode:** Excludes post-creation indicators (comments, reviews) to predict risk immediately when the PR is opened.
* **Current-state Mode:** Uses the current comments and mergeable state for mid-flight predictions.

---

## Generalization Performance Benchmarks

### 1. Known Repository Model (Model A)
Evaluation results on Stratified Test Set:

* **Accuracy:** `0.6589`
* **Balanced Accuracy:** `0.4288`
* **Macro F1-Score:** `0.4050`
* **High-Risk Recall:** `0.3022`
* **High-Risk Precision:** `0.8209`
* **Brier Score:** `0.4602`
* **Log Loss:** `0.7985`

### 2. Cold-start Model (Model B)
Evaluation results on Generalization Stratified Test Set:

* **Accuracy:** `0.7451`
* **Balanced Accuracy:** `0.5315`
* **Macro F1-Score:** `0.5099`
* **High-Risk Recall:** `0.6703`
* **High-Risk Precision:** `0.7394`
* **Brier Score:** `0.3879`

---

## Split Strategy & Calibration Report

### Data Split Benchmarks
* **Random Stratified Test Set size:** `557` samples
* **Repository Group Split Test (Unseen codebases):** Accuracy = `0.3076`, F1 Macro = `0.1825`
* **TimeSeries Chronological 80/20 split:** Accuracy = `0.8420`, F1 Macro = `0.3716`

### Probability Calibration
Calibration was validated using Brier score and multiclass Log Loss.

* **Known Repo Model Log Loss:** Before = `0.7493`, After = `0.7985` (Improved: `False`)
* **Cold-start Model Log Loss:** Before = `0.7652`, After = `0.7006` (Improved: `True`)

---

## Production Ready Assessment
* **Production Ready Status:** `Candidate / Not Ready`
* **Verification Score:** `0.4422`

### Blocking Issues:
* Known Repo model Macro F1 (0.4050) is below threshold (0.5)
* Known Repo model High-risk Recall (0.3022) is below threshold (0.5)

---

## Data Leakage Protections
1. **Creation-time Isolation:** If configured, completely ignores labels, comments, and mergeable states that occur post-creation.
2. **Time-safe Expanding Features:** Historical features use a sorted chronological groupby shift-expand cycle. A PR created at time T never sees targets of PRs at or after time T.
3. **Training Isolation:** Validation and test splits map historical statistics purely using training lookups. Unseen keys fallback to global training medians.

---

## Known Limitations
* High-risk recall and macro F1 scores can drop on unseen repositories (Group Split) or future periods (TimeSeries Chronological Split).
* Chronological training sets with small sample sizes limit the model's capacity to recognize changing developer cycle times.
