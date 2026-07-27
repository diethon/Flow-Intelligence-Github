# Giai Thich Module AI Du Doan PR Delay Risk

## 1. Tong Quan

Phan "AI du doan PR" trong project nay thuc chat la mot module Machine Learning du doan rui ro Pull Request bi cham merge. Model nhan metadata cua PR, sau do tra ve nhan rui ro:

- `Low`: PR co kha nang merge nhanh, duoi 24 gio.
- `Medium`: PR co kha nang mat tu 24 den 72 gio.
- `High`: PR co kha nang mat tren 72 gio.

Module nay khong doc source code cua PR. No chi dung metadata nhu so file thay doi, additions, deletions, commits, labels, reviewer, assignee, author, repository va thoi diem tao PR.

Ket qua prediction duoc luu vao MongoDB trong collection `prDelayPredictions`, sau do duoc hien thi tren dashboard va co the tao Evidence Card neu rui ro la `Medium` hoac `High`.

## 2. Luong Chay Chinh Khi Sync PR

Luong runtime hien tai nhu sau:

```text
GitHub Sync Job
  -> Lay danh sach Pull Requests tu GitHub
  -> Upsert tung PR vao MongoDB
  -> Loc cac PR dang open
  -> Goi PredictionService.predictAndSave(repositoryId, pullRequestId)
  -> Backend build feature JSON tu document PullRequest
  -> Backend spawn Python chay dataset/inference.py
  -> inference.py doc JSON tu stdin
  -> Goi predict_pr trong dataset/predict.py
  -> Python load model va metadata
  -> Engineer features
  -> Predict xac suat Low / Medium / High
  -> Tra JSON ve Node.js
  -> Node.js luu ket qua vao prDelayPredictions
  -> Neu Medium/High thi tao Evidence Card
  -> Dashboard/Evidence page doc ket qua va hien thi
```

File trigger chinh:

- `Flow-Intelligence-Github_BE/src/modules/github/services/syncJobProcessor.service.ts`

Tai day, sau khi sync PR, code collect cac PR co state `open` vao `syncedOpenPrIds`. Sau do no lap qua tung PR va goi:

```ts
PredictionService.predictAndSave(payload.repositoryId, prId)
```

Neu ket qua la `High` hoac `Medium`, backend tiep tuc goi:

```ts
evidenceCardService.generateFromPrediction(...)
```

De tao Evidence Card cho prediction.

### 3. Dataset Va Training Pipeline

Thu muc `dataset/` chua toan bo pipeline ML bang Python.

### `dataset/config.py`

Day la file cau hinh trung tam cua pipeline ML.

Vai tro chinh:

- Khai bao duong dan dataset:
  - `raw_pr_dataset.csv`
- Khai bao duong dan model:
  - `known_repository_model.joblib`
  - `cold_start_model.joblib`
- Khai bao metadata/report:
  - `known_repository_metadata.json`
  - `cold_start_metadata.json`
  - `evaluation-report.json`
  - `calibration-report.json`
  - `data-split-report.json`
  - `model-card.md`
- Khai bao class mapping:
  - `0 = Low`
  - `1 = Medium`
  - `2 = High`
- Khai bao nguong routing:
  - `MIN_REPOSITORY_HISTORY = 5`
  - neu repository co it hon 5 PR history thi dung cold-start model.
- Khai bao nguong uncertainty:
  - `MIN_CONFIDENCE = 0.55`
  - `MIN_MARGIN = 0.10`
- Khai bao prediction mode:
  - `PREDICTION_MODE = "creation_time"`

`creation_time` co nghia la model co gang du doan tai thoi diem PR vua tao, nen tranh dung cac thong tin co the xay ra sau do nhu comments, review comments, mergeable state.

### `dataset/data_loader.py`

File nay phu trach load va phan tich dataset ban dau.

Ham chinh:

- `load_and_shuffle_dataset(filepath)`
  - Doc CSV.
  - Shuffle toan bo dataset bang `RANDOM_STATE`.
  - Muc dich la tranh bias do thu tu du lieu.

- `generate_dataset_analysis_report(df)`
  - In thong ke tong quan:
    - Tong so PR.
    - So repository.
    - Repository nao co nhieu PR.
    - Phan bo label Low/Medium/High.
    - Missing values.
    - Outlier cua cac cot numeric.
    - Correlation matrix.

File nay khong train model, chi dung de load va inspect data.

### `dataset/preprocessing.py`

File nay lam sach du lieu va chia train/test.

Ham chinh:

- `clean_dataset(df, is_training=True)`
  - Drop duplicate.
  - Parse `created_at`.
  - Neu train thi chi giu PR co `state == "closed"` va co `merged_at`.
  - Tinh `cycle_time_hours = merged_at - created_at`.
  - Bo cac row co cycle time am.
  - Gan label:
    - `< 24h`: `risk_class = 0`
    - `24h - 72h`: `risk_class = 1`
    - `> 72h`: `risk_class = 2`

- `split_stratified(df)`
  - Chia train/test ngau nhien co stratify theo `risk_class`.

- `split_by_repository(df)`
  - Chia theo repository.
  - Dung de test kha nang generalize sang repo chua tung thay.

- `split_chronological_80_20(df)`
  - Sap xep theo `created_at`.
  - 80% dau lam train, 20% sau lam test.
  - Dung de test model voi du lieu tuong lai.

- `get_rolling_window_folds(df)`
  - Tao rolling time-series folds.
  - Dung de benchmark theo thoi gian.

### `dataset/feature_engineering.py`

Day la file quan trong nhat cua ML pipeline. No bien raw PR metadata thanh numeric features de model hoc.

Nhom feature chinh:

1. PR size features
   - `changed_files`
   - `additions`
   - `deletions`
   - `commits`
   - `churn = additions + deletions`
   - `average_change_per_file`
   - `average_commit_size`

2. Time features
   - Gio tao PR.
   - Thu trong tuan.
   - Thang.
   - Tuan trong nam.
   - Co phai cuoi tuan khong.

3. Boolean features
   - Co phai draft khong.
   - Co label khong.
   - Co assignee khong.
   - Co reviewer khong.

4. Count features
   - So label.
   - So assignee.
   - So reviewer duoc request.

5. Missing/unknown indicators
   - Author unknown.
   - Repository unknown.
   - Missing reviewer info.
   - Missing label info.

6. Historical statistics
   - Trung binh cycle time cua author.
   - So PR lich su cua author.
   - Trung binh merge time cua repository.
   - Trung binh size PR cua repository.
   - Trung binh reviewer count cua repository.
   - So PR lich su cua repository.

Co hai diem rat quan trong:

- Khi train, file nay dung `shift(1).expanding()` de tinh historical features. Nghia la PR tai thoi diem T chi duoc nhin cac PR truoc T, khong duoc nhin chinh no hoac tuong lai.
- Khi inference, neu author/repo chua co trong metadata thi fallback ve global mean hoac 0.

Ham chinh:

- `fit_feature_metadata(df_train)`
  - Hoc cac thong ke lich su tu training set.
  - Luu map author/repository vao metadata.

- `engineer_features(df, metadata, is_training)`
  - Tao feature dataframe.

- `get_known_repo_features(X)`
  - Dung day du feature, bao gom historical statistics.

- `get_cold_start_features(X)`
  - Loai bo feature lich su author/repo.
  - Dung khi repo moi hoac it history.

### `dataset/training.py`

File nay chua logic train va chon model.

Ham chinh:

- `initialize_model(model_name)`
  - Khoi tao model theo ten:
    - RandomForest
    - GradientBoosting
    - HistGradientBoosting
    - ExtraTrees
    - XGBoost neu co cai
    - LightGBM neu co cai

- `calculate_composite_score(y_true, y_pred, y_prob)`
  - Tinh diem tong hop de chon model.
  - Trong so:
    - 30% Macro F1.
    - 30% High-risk recall.
    - 20% Balanced accuracy.
    - 10% MCC.
    - 10% Calibration score.

- `train_and_tune(model_name, X_train, y_train)`
  - Dung `RandomizedSearchCV`.
  - Tune hyperparameter.
  - Scoring bang `f1_macro`.

- `run_cross_validation_with_composite_score(...)`
  - Chay cross-validation.
  - Train, calibrate, predict, tinh composite score.

- `calibrate_and_fit(...)`
  - Dung `CalibratedClassifierCV` de calibrate xac suat.
  - Muc dich la probability Low/Medium/High dang tin hon.

### `dataset/evaluation.py`

File nay danh gia model.

Metric duoc tinh:

- Accuracy.
- Balanced accuracy.
- MCC.
- Weighted F1.
- Macro F1.
- ROC AUC weighted.
- Log loss.
- Brier score.
- High-risk recall.
- High-risk precision.
- Confusion matrix.
- Per-class precision/recall/F1.

File nay cung co diagnostic warnings:

- Canh bao neu high-risk recall qua thap.
- Canh bao neu class Medium khong bao gio duoc predict.
- Canh bao neu model qua lech ve majority class.

### `dataset/explainability.py`

File nay tao explainability cho model.

Co hai loai explainability:

1. Global explainability
   - `compute_permutation_importance(...)`
   - Cho biet feature nao quan trong tren tap test.

2. Local explainability
   - `explain_prediction_locally(...)`
   - Giai thich vi sao mot PR cu the bi predict Low/Medium/High.
   - Neu co `shap` thi dung SHAP.
   - Neu SHAP loi hoac khong cai thi fallback bang perturbation:
     - Thay tung feature bang gia tri baseline.
     - Xem xac suat class thay doi bao nhieu.
     - Feature nao lam thay doi manh thi dua vao `topFactors`.

Ket qua local explanation duoc tra ve dang:

```json
{
  "factor": "Churn",
  "direction": "increase",
  "strength": 0.1234,
  "rawValue": 1200,
  "baselineValue": 300
}
```

### `dataset/main.py`

Day la orchestrator train pipeline moi.

Luong train:

```text
Load raw CSV
  -> Generate dataset analysis report
  -> Clean dataset
  -> Stratified split
  -> Fit metadata tu train set
  -> Engineer features
  -> Tao feature set cho known-repo model
  -> Tao feature set cho cold-start model
  -> Chay CV cho nhieu algorithm
  -> Chon algorithm tot nhat theo composite score
  -> Tune hyperparameter
  -> Calibrate probabilities
  -> Evaluate test set
  -> Compute permutation importance
  -> Save model .joblib
  -> Save metadata .json
  -> Save evaluation/calibration/data split report
  -> Generate model-card.md
```

File nay train hai model:

- Known Repository Model:
  - Dung feature lich su author/repository.
  - File output: `known_repository_model.joblib`.

- Cold-start Model:
  - Loai bo feature lich su author/repository.
  - File output: `cold_start_model.joblib`.

### `dataset/predict.py`

Day la file inference thuc su.

Luong trong `predict_pr(raw_pr_dict)`:

1. Doc `repository` va `author` tu input.
2. Load cold-start metadata de kiem tra repo/author co trong lich su khong.
3. Neu repo unknown hoac repo history `< MIN_REPOSITORY_HISTORY`, route sang `cold_start`.
4. Neu repo du history, route sang `known_repository`.
5. Clean input bang `preprocessing.clean_dataset(..., is_training=False)`.
6. Engineer features bang metadata cua model duoc chon.
7. Align feature columns voi `selectedFeatures` trong metadata.
8. Goi `model.predict_proba`.
9. Lay class co xac suat cao nhat.
10. Neu confidence thap hoac margin giua top1/top2 qua nho thi danh dau `Uncertain`.
11. Goi explainability de lay `topFactors`.
12. Tra ket qua JSON.

Output co dang:

```json
{
  "prediction": "High",
  "suggestedRisk": "High",
  "confidence": 0.85,
  "probabilities": {
    "low": 0.05,
    "medium": 0.10,
    "high": 0.85
  },
  "topFactors": [],
  "modelType": "known_repository",
  "coldStart": false,
  "unknownRepository": false,
  "unknownAuthor": false,
  "requiresReview": false,
  "warnings": [],
  "riskLabel": "High",
  "probability": 0.85
}
```

### `dataset/inference.py`

Day la wrapper CLI de Node.js goi Python.

No:

- Doc JSON tu `stdin`.
- Parse JSON.
- Goi `predict_pr`.
- Print JSON result ra `stdout`.
- Neu loi thi print `{ "error": "..." }`.

Node.js khong import truc tiep Python module, ma spawn process Python va giao tiep bang stdin/stdout.

### `dataset/features.py` va `dataset/train_model.py`

Hai file nay co ve la pipeline cu hon.

- `features.py` co clean/feature engineering don gian hon.
- `train_model.py` train mot model `pr-delay-risk.joblib` va metadata `feature-metadata.json`.

Trong luong moi, backend inference dang dung `dataset/inference.py` -> `dataset/predict.py`, va `predict.py` load hai model:

- `known_repository_model.joblib`
- `cold_start_model.joblib`

Vi vay `features.py` va `train_model.py` nen duoc xem la legacy/phu tro neu khong con duoc goi trong runtime chinh.

## 4. Backend Prediction

### `Flow-Intelligence-Github_BE/src/services/PredictionService.ts`

Day la service Node.js ket noi backend voi Python ML.

Vai tro:

- Lay PullRequest trong MongoDB theo `pullRequestId`.
- Lay model version moi nhat co `status = "available"`.
- Build feature object tu document PR:
  - `repository`
  - `pr_number`
  - `title`
  - `author`
  - `state`
  - `created_at`
  - `draft`
  - `changed_files`
  - `additions`
  - `deletions`
  - `commits`
  - `comments`
  - `review_comments`
  - `mergeable_state`
  - `labels`
  - `requested_reviewers`
  - `assignees`
- Spawn Python:

```ts
spawn("python", [this.INFERENCE_SCRIPT], {
  cwd: path.join(__dirname, "../../../dataset")
})
```

- Ghi JSON features vao stdin cua Python.
- Doc stdout.
- Parse prediction JSON.
- Upsert ket qua vao `PrDelayPrediction`.

Ham chinh:

- `callInference(features)`
  - Goi Python va tra ve result.

- `predictAndSave(repositoryId, pullRequestId)`
  - Ham public duoc sync worker goi.
  - Vua predict vua luu DB.

### `Flow-Intelligence-Github_BE/src/models/PrDelayPrediction.ts`

Schema MongoDB cho ket qua prediction.

Field chinh:

- `repositoryId`: repo cua prediction.
- `pullRequestId`: PR duoc predict.
- `modelVersionId`: version model tham chieu.
- `probability`: xac suat cao nhat.
- `riskLabel`: `Low | Medium | High`.
- `featureSummary`: raw feature da dua vao model.
- `probabilities`: xac suat tung class.
- `topFactors`: cac factor giai thich prediction.
- `predictedAt`: thoi diem predict.

Index quan trong:

- Unique:

```ts
{ pullRequestId: 1, modelVersionId: 1 }
```

Dam bao moi PR chi co mot prediction cho moi model version.

### `Flow-Intelligence-Github_BE/src/models/ModelVersion.ts`

Schema luu thong tin model.

Field chinh:

- `version`
- `algorithm`
- `artifactPath`
- `featureSchemaPath`
- `evaluationMetrics`
- `status`
- `trainedAt`

Luu y: `PredictionService` dung `ModelVersion` de gan tham chieu DB, nhung Python van load model theo config trong `dataset/config.py`. Tuc la `artifactPath` trong DB hien khong truc tiep dieu khien Python load model nao.

### `Flow-Intelligence-Github_BE/src/controllers/prediction.controller.ts`

Controller cho API lay prediction theo PR.

Ham:

- `getPredictionByPullRequestId(req, res)`

No:

1. Doc `pullRequestId` tu route param.
2. Validate ObjectId.
3. Tim document trong `PrDelayPrediction`.
4. Populate `modelVersionId` de lay `version`.
5. Tra JSON ve frontend.

### `Flow-Intelligence-Github_BE/src/routes/prediction.routes.ts`

Khai bao route:

```ts
router.get("/:pullRequestId", ...)
```

Trong `server.ts`, router nay duoc mount:

```ts
app.use("/api/repositories", createPredictionRouter());
```

Dieu nay co nghia route thuc te dang la:

```text
GET /api/repositories/:pullRequestId
```

Trong khi frontend dang goi:

```text
GET /api/repositories/:repositoryId/predictions/:pullRequestId
```

Day la mot diem can sua neu prediction detail page bi loi.

### `Flow-Intelligence-Github_BE/src/modules/github/services/syncJobProcessor.service.ts`

Day la noi trigger prediction tu sync.

Trong `syncPullRequests(...)`:

1. Goi GitHub API lay PR.
2. Upsert PR vao MongoDB.
3. Neu PR dang `open`, them id vao `syncedOpenPrIds`.
4. Sau khi sync xong, lap qua danh sach open PR.
5. Goi `PredictionService.predictAndSave`.
6. Neu risk `Medium` hoac `High`, tao Evidence Card.

Day la entry point runtime quan trong nhat cua PR prediction.

### `Flow-Intelligence-Github_BE/src/services/evidenceCard.service.ts`

Lien quan den prediction o ham:

- `generateFromPrediction(repositoryId, input)`

Vai tro:

- Khong tao Evidence Card neu prediction la `Low`.
- Resolve PR thanh evidence item.
- Severity:
  - `High` -> `high`
  - `Medium` -> `medium`
- Confidence:
  - probability >= 0.75 -> `high`
  - con lai -> `medium`
- Tao Evidence Card co title, summary, suggested action, confidence, limitation.

## 5. AI Weekly Brief Va Prediction

### `Flow-Intelligence-Github_BE/src/services/aiPayloadBuilder.service.ts`

File nay khong chay model ML. No chi lay prediction da luu de dua vao payload cho AI Weekly Brief.

Cu the:

- Dem so prediction `High` trong window hien tai:

```ts
PrDelayPrediction.countDocuments({
  repositoryId,
  riskLabel: "High",
  predictedAt: { $gte: windowStart, $lte: windowEnd }
})
```

- Gan vao:

```ts
predictions: {
  delayedPrs
}
```

- Cung dem cho previous window de so sanh trend.

### `Flow-Intelligence-Github_BE/src/services/brief.service.ts`

File nay tao Weekly Brief bang Gemini neu co `GEMINI_API_KEY`.

Luong:

1. Goi `AiPayloadBuilderService.buildWeeklyBriefPayload`.
2. Tao prompt gom:
   - metrics
   - predictions
   - previousMetrics
   - previousPredictions
   - evidenceCards
   - limitations
3. Goi Gemini.
4. Yeu cau output strict JSON.
5. Luu vao `AiBrief`.
6. Neu loi hoac thieu API key thi fallback deterministic brief.

Vi vay:

- ML PR prediction la mot module rieng.
- Weekly Brief la LLM synthesis layer doc ket qua da duoc tong hop.

## 6. Frontend

### `Flow-Intelligence-Github_FE/src/pages/DashboardPage.tsx`

Dashboard hien thi section:

```text
PR Delay Predictions
```

No lay data tu `summary.recentPredictions`, data nay den tu backend dashboard service.

Voi moi prediction:

```tsx
<PredictionCard
  prediction={pred}
  prNumber={pred.pullRequestId?.number}
  prTitle={pred.pullRequestId?.title || ...}
/>
```

Click vao card hien tai mo link GitHub PR neu co `prUrl`.

### `Flow-Intelligence-Github_FE/src/components/PredictionCard.tsx`

Component hien thi card prediction.

No hien:

- Title PR.
- PR number.
- Badge `Low Risk`, `Medium Risk`, hoac `High Risk`.
- Breakdown xac suat Low/Medium/High.
- Thanh segmented bar mau:
  - Low: xanh.
  - Medium: vang.
  - High: do.
- Ngay predict.

Neu backend khong tra `probabilities`, component tu suy ra breakdown tu `probability` va `riskLabel`.

### `Flow-Intelligence-Github_FE/src/services/api/prediction.ts`

API client cho prediction detail.

Ham:

```ts
getPredictionByPRId(repositoryId, pullRequestId)
```

No dang goi:

```text
/repositories/${repositoryId}/predictions/${pullRequestId}
```

Can dam bao backend route khop endpoint nay.

### `Flow-Intelligence-Github_FE/src/hooks/usePrediction.ts`

React Query hook:

```ts
usePredictionDetail(repositoryId, pullRequestId)
```

Vai tro:

- Goi `predictionApi.getPredictionByPRId`.
- Cache theo key:

```ts
["prediction", repositoryId, pullRequestId]
```

- Chi fetch khi co du `repositoryId` va `pullRequestId`.

### `Flow-Intelligence-Github_FE/src/pages/EvidenceCardDetailPage.tsx`

Trang detail Evidence Card.

Neu Evidence Card co `sourceType === "prediction"`:

1. Tim evidence item co `entityType === "pull_request"`.
2. Lay `pullRequestId`.
3. Goi `usePredictionDetail(...)`.
4. Neu fetch thanh cong thi render `PredictionDetails`.

### `Flow-Intelligence-Github_FE/src/components/PredictionDetails.tsx`

Component hien chi tiet ML prediction.

Hien:

- Changed files.
- Lines added.
- Lines deleted.
- Commits.
- Probability breakdown Low/Medium/High.
- Model version.
- Computed at.

Component nay dung `featureSummary` va `probabilities` tu backend.

## 7. Seed Va Demo Data

### `Flow-Intelligence-Github_BE/src/seeds/seedAll.ts`

File seed demo data.

Lien quan prediction:

1. Tao `ModelVersion` demo:

```ts
version: "rf-v1.0.0"
algorithm: "RandomForestClassifier"
artifactPath: "dataset/pr-delay-risk.joblib"
featureSchemaPath: "dataset/feature-schema.json"
status: "available"
```

2. Lay 2 PR dau tien trong repo.
3. Tao fake predictions:
   - PR dau: `High`, probability `0.85`.
   - PR thu hai: `Medium`, probability `0.65`.
4. Insert vao `PrDelayPrediction`.

Day la du lieu demo de dashboard co prediction hien thi ngay ca khi chua chay ML runtime that.

## 8. Artefact Model Va Report

### `dataset/known_repository_model.joblib`

Model cho repository da co du history.

Dung historical features cua author/repository.

### `dataset/cold_start_model.joblib`

Model cho repository moi hoac it history.

Khong dung historical features cua author/repository.

### `dataset/known_repository_metadata.json`

Metadata cua known-repository model.

Gom:

- Feature columns.
- Feature stats.
- Author history.
- Repository history.
- Top labels.
- Evaluation metrics.
- Training timestamp.
- Feature version.

### `dataset/cold_start_metadata.json`

Metadata cua cold-start model.

Dung de:

- Route prediction.
- Kiem tra repo/author known hay unknown.
- Engineer feature luc inference.

### `dataset/model-card.md`

Tai lieu danh gia model.

Trang thai hien tai:

```text
Production Ready Status: Candidate / Not Ready
```

Ly do:

- Known Repo model Macro F1 thap hon threshold.
- Known Repo model High-risk Recall thap hon threshold.

Dieu nay co nghia model co the dung demo/candidate, nhung chua nen coi la production-ready.

## 9. Data Contract Tu Backend Sang Python

Backend gui feature JSON co dang:

```json
{
  "repository": "owner/repo",
  "pr_number": 42,
  "title": "Fix login bug",
  "author": "octocat",
  "state": "open",
  "created_at": "2026-07-21T10:00:00.000Z",
  "draft": false,
  "changed_files": 5,
  "additions": 120,
  "deletions": 30,
  "commits": 3,
  "comments": 0,
  "review_comments": 0,
  "mergeable_state": "unknown",
  "labels": "bug,backend",
  "requested_reviewers": "reviewer1,reviewer2",
  "assignees": "dev1"
}
```

Python tra ve:

```json
{
  "riskLabel": "High",
  "probability": 0.85,
  "probabilities": {
    "low": 0.05,
    "medium": 0.10,
    "high": 0.85
  },
  "topFactors": [],
  "modelType": "known_repository",
  "coldStart": false,
  "unknownRepository": false,
  "unknownAuthor": false,
  "requiresReview": false,
  "warnings": []
}
```

## 10. Diem Can Luu Y / Rui Ro Ky Thuat

### 1. Frontend va backend prediction route dang lech nhau

Frontend goi:

```text
GET /api/repositories/:repositoryId/predictions/:pullRequestId
```

Backend hien mount:

```text
GET /api/repositories/:pullRequestId
```

Neu trang Evidence Card detail khong load duoc ML detail, day la nguyen nhan kha nang cao.

Nen sua backend route thanh:

```ts
router.get("/:repoId/predictions/:pullRequestId", ...)
```

Hoac mount router rieng de khop voi frontend.

### 2. `ModelVersion.artifactPath` chua dieu khien Python load model

Backend lay latest `ModelVersion` de gan `modelVersionId`, nhung Python load model theo `dataset/config.py`.

Neu DB bao model version A nhung file config dang load model B, metadata co the lech.

### 3. Co pipeline moi va pipeline cu

`dataset/main.py` + `dataset/predict.py` la luong moi.

`dataset/train_model.py` + `dataset/features.py` co ve la luong cu.

Nen document ro hoac cleanup de tranh thanh vien nhom chay nham.

### 4. Model card bao chua production-ready

`dataset/model-card.md` ghi model la candidate/not ready vi metric chua dat nguong.

Neu trinh bay, nen noi day la model candidate cho capstone/demo, can them data/tuning truoc khi dung production.

### 5. Prediction chi trigger cho PR open khi sync pull requests

Neu PR da co trong DB nhung khong qua sync job, prediction co the chua duoc tao.

Muon manual predict can them endpoint trigger rieng hoac job rieng.

## 11. Tom Tat Ngan Gon De Trinh Bay

Module AI du doan PR gom ba lop:

1. Python ML pipeline trong `dataset/`
   - Train model tu lich su PR.
   - Tao features tu metadata PR.
   - Du doan rui ro delay Low/Medium/High.
   - Tra ve probability va top factors.

2. Backend Node.js
   - Sync PR tu GitHub.
   - Goi Python inference.
   - Luu prediction vao MongoDB.
   - Tao Evidence Card neu prediction Medium/High.
   - Cap API cho frontend.

3. Frontend React
   - Dashboard hien recent PR delay predictions.
   - Evidence detail hien feature va probability breakdown.
   - Weekly Brief dung prediction nhu mot tin hieu tong hop.

Noi ngan gon: he thong khong dung AI de doc code, ma dung ML tren metadata PR de canh bao PR co nguy co merge cham, sau do bien ket qua thanh evidence co the giai thich va hien thi tren dashboard.
