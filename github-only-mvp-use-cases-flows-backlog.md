---
title: "GitHub-only MVP Use Cases, Flows, Backlog, and Sprint Plan"
project_name: "Github-jira tracking"
product_name: "AI Engineering Flow Intelligence for GitHub"
source_architecture: "_bmad-output/planning-artifacts/architecture.md"
scope: "GitHub-only MVP; Jira excluded"
date: "2026-06-08"
<<<<<<< HEAD
=======
last_updated: "2026-06-09"
>>>>>>> origin/vanson
---

# GitHub-only MVP Use Cases, Flows, Backlog, and Sprint Plan

## 1. Scope Boundary

MVP focuses only on GitHub repository workflow analytics.

Included:

- GitHub repository connection or token-based prototype connection.
- Initial GitHub API backfill for pull requests, reviews, issues metadata, commits metadata, and check runs.
- Webhook ingestion or polling / Sync now fallback.
- Normalization into MongoDB.
- Metrics engine for GitHub flow KPIs.
<<<<<<< HEAD
=======
- Dataset preparation and supervised ML training for PR review-delay prediction.
- ML inference that predicts delay risk for GitHub pull requests.
>>>>>>> origin/vanson
- Risk rule engine using R1-R5 Flow Risk Rulebook.
- Evidence Cards linked to GitHub records.
- AI Weekly Brief generated from structured metrics and Evidence Cards.
- Privacy guardrails: no individual productivity score, no HR or medical inference.

Excluded:

- Jira integration.
- Sprint commitment, story points, Jira status transition, carryover, backlog, or velocity analytics.
- Raw source code analysis.
- Individual productivity ranking.
- Burnout diagnosis.
<<<<<<< HEAD
=======
- LLM fine-tuning, deep learning, and online model retraining.
>>>>>>> origin/vanson
- Enterprise RBAC, SOC 2, SAML SSO, billing, or organization-wide analytics.

## 2. MVP Use Case List

| ID | Use Case | Primary Actor | Priority | Difficulty | Suggested Owner | Main Modules |
|---|---|---|---|---|---|---|
<<<<<<< HEAD
| UC-01 | Connect GitHub repository | Engineering Manager | Must | Hard | Strong Dev 1 | GitHub Connector, Dashboard API |
| UC-02 | Disconnect repository and clear synced data | Engineering Manager | Should | Medium | Strong Dev 1 | GitHub Connector, Repository API |
| UC-03 | Run initial GitHub backfill | Engineering Manager / System | Must | Hard | Strong Dev 1 | GitHub Connector, Sync Orchestrator, Normalization |
| UC-04 | Normalize GitHub entities into MongoDB | System | Must | Hard | Strong Dev 2 | Normalization, MongoDB Models |
| UC-05 | View sync status | Engineering Manager | Must | Easy | Junior Dev 1 | Sync Jobs, Dashboard API, UI |
| UC-06 | View data quality warnings | Engineering Manager | Must | Medium | Junior Dev 1 | Data Quality, Dashboard API, UI |
| UC-07 | Run manual Sync now fallback | Engineering Manager | Should | Medium | Strong Dev 1 | Sync Orchestrator, GitHub Connector |
| UC-08 | Receive GitHub webhook update | GitHub / System | Should | Hard | Strong Dev 2 | Webhook Receiver, Normalization |
| UC-09 | Calculate PR flow metrics | System | Must | Hard | Strong Dev 3 | Metrics Engine |
| UC-10 | Calculate review and CI metrics | System | Must | Hard | Strong Dev 3 | Metrics Engine |
| UC-11 | View Team Flow Dashboard | Engineering Manager | Must | Medium | Junior Dev 2 | Dashboard API, Metrics Engine, UI |
| UC-12 | View bottleneck summary | Engineering Manager | Must | Medium | Junior Dev 2 | Dashboard API, Risk Summary, UI |
| UC-13 | Evaluate Delivery Flow Risk rules | System | Must | Hard | Strong Dev 3 | Risk Rule Engine |
| UC-14 | View Flow Risk Rulebook | Engineering Manager | Must | Easy | Junior Dev 2 | Rulebook API, UI |
| UC-15 | Generate Evidence Cards | System | Must | Hard | Strong Dev 2 | Evidence Card Service |
| UC-16 | View Evidence Card details | Engineering Manager | Must | Medium | Junior Dev 2 | Evidence API, UI |
| UC-17 | Generate AI Weekly Brief | Engineering Manager | Must | Hard | Strong Dev 3 | AI Brief Service, Privacy Guardrails |
| UC-18 | Use deterministic brief fallback when AI fails | System | Must | Medium | Strong Dev 3 | AI Brief Service |
| UC-19 | Manage privacy settings and prohibited-use notice | Engineering Manager | Should | Easy | Junior Dev 1 | Privacy Guardrails, UI |
| UC-20 | Import sample GitHub-style data for demo fallback | Engineering Manager | Should | Medium | Junior Dev 1 | Sample Import, Normalization |

## 2.1 Suggested 5-Member Responsibility Split

| Team Member | Skill Level | Main Ownership | Use Cases |
|---|---|---|---|
| Strong Dev 1 | High | GitHub connection, backfill, manual sync | UC-01, UC-02, UC-03, UC-07 |
| Strong Dev 2 | High | Normalization, webhook, Evidence Cards | UC-04, UC-08, UC-15 |
| Strong Dev 3 | High | Metrics, risk rules, AI brief | UC-09, UC-10, UC-13, UC-17, UC-18 |
| Junior Dev 1 | Lower | Sync/data quality UI, privacy UI, sample import support | UC-05, UC-06, UC-19, UC-20 |
| Junior Dev 2 | Lower | Dashboard, bottleneck, rulebook, evidence UI | UC-11, UC-12, UC-14, UC-16 |

Difficulty guide:

- Easy: mostly UI, display, simple API integration, or static policy content.
- Medium: requires API + UI coordination, validation, or moderate backend logic.
- Hard: requires external integration, data normalization, analytics calculation, rule evaluation, webhook processing, or AI output validation.
=======
| UC-01 | Connect GitHub repository | Engineering Manager | Must | Hard | Vân Anh | GitHub Connector, Dashboard API |
| UC-02 | Run initial GitHub backfill | Engineering Manager / System | Must | Hard | Vân Anh | GitHub Connector, Sync Orchestrator, Normalization |
| UC-03 | Normalize GitHub entities into MongoDB | System | Must | Hard | Văn Sơn | Normalization, MongoDB Models |
| UC-04 | View sync status and data quality | Engineering Manager | Must | Easy | Anh Quân | Sync Jobs, Data Quality, UI |
| UC-05 | Run manual Sync now fallback | Engineering Manager | Should | Medium | Vân Anh | Sync Orchestrator, GitHub Connector |
| UC-06 | Receive GitHub webhook update | GitHub / System | Should | Hard | Vân Anh | Webhook Receiver, Normalization |
| UC-07 | Prepare and validate PR training dataset | ML Engineer / System | Must | Hard | Hoàng Việt | Dataset Pipeline, Feature Schema |
| UC-08 | Train and evaluate PR delay model | ML Engineer / System | Must | Hard | Hoàng Việt | ML Training Pipeline |
| UC-09 | Predict PR review-delay risk | System | Must | Hard | Hoàng Việt | ML Inference Service |
| UC-10 | Calculate GitHub flow metrics | System | Must | Hard | Diểm Vi | Metrics Engine |
| UC-11 | View Team Flow Dashboard | Engineering Manager | Must | Medium | Diểm Vi | Dashboard API, Metrics Engine, UI |
| UC-12 | View PR delay predictions and bottlenecks | Engineering Manager | Must | Medium | Hoàng Việt | Prediction API, Risk Summary, UI |
| UC-13 | Evaluate Delivery Flow Risk rules | System | Must | Hard | Diểm Vi | Risk Rule Engine |
| UC-14 | View Flow Risk Rulebook | Engineering Manager | Must | Easy | Diểm Vi | Rulebook API, UI |
| UC-15 | Generate Evidence Cards from rules and predictions | System | Must | Hard | Văn Sơn | Evidence Card Service |
| UC-16 | View Evidence Card details | Engineering Manager | Must | Medium | Văn Sơn | Evidence API, UI |
| UC-17 | Generate AI Weekly Brief | Engineering Manager | Must | Hard | Anh Quân | AI Brief Service, Privacy Guardrails |
| UC-18 | Use deterministic brief fallback when AI fails | System | Must | Medium | Anh Quân | AI Brief Service |
| UC-19 | Manage privacy settings and prohibited-use notice | Engineering Manager | Should | Easy | Anh Quân | Privacy Guardrails, UI |
| UC-20 | Import sample GitHub-style data for demo fallback | Engineering Manager | Should | Medium | Văn Sơn | Sample Import, Normalization |

## 2.1 Active 5-Member Responsibility Split

This responsibility split follows the vertical-slice allocation used by `team-allocation-5-members.md` and `phan-cong-cong-viec-chi-tiet-5-thanh-vien.md`. Each member owns backend, UI, contracts, tests, and database proposals for the assigned feature group; shared screens list one accountable owner and named contributors.

| Team Member | Layer Ownership | Scope Type | Primary Responsibilities | Backup / Pairing Responsibility | Related Use Cases |
|---|---|---|---|---|---|
| Vân Anh | Repository Connection & Sync | MVP Required | App scaffold, GitHub connection, backfill, review sync, Connect/Sync UI, polling, webhook, and recompute orchestration. | Publish GitHub payload, connection, and sync contracts; pair with Văn Sơn on normalization. | UC-01, UC-02, UC-05, UC-06 |
| Văn Sơn | Data Import & Evidence | MVP Required | MongoDB schema coordination, normalized metadata, sample import, Evidence Card generation/storage, and Risk/Evidence UI. | Publish normalized fixtures and evidence contracts; consume risk and prediction outputs. | UC-03, UC-15, UC-16, UC-20 |
| Hoàng Việt | PR Delay Machine Learning | MVP Required | Dataset, feature engineering, model training/evaluation, prediction service/storage, prediction UI contributions, and prediction evidence tests. | Publish model/prediction contracts for Văn Sơn, Diểm Vi, and Anh Quân. | UC-07, UC-08, UC-09, UC-12 |
| Diểm Vi | Metrics & Delivery Risk | MVP Required | Metrics Engine, Rule Engine, recommendation catalog, Dashboard, Risk API, Rulebook, and risk-driver contribution. | Publish dashboard/risk/rulebook contracts; consume normalized data and prediction summaries. | UC-10, UC-11, UC-13, UC-14 |
| Anh Quân | Data Quality, AI Brief & Privacy | MVP Required | Data-quality aggregation, shared UI states, privacy redaction, AI Weekly Brief backend/UI, deterministic fallback, app shell, demo fixtures, and E2E integration. | Publish data-quality, brief, privacy, and common error contracts. | UC-04, UC-17, UC-18, UC-19 |

Scope labels:

- **MVP Required:** must work for the final demo, including model training, evaluation, inference, and stored predictions.
- **Runtime fallback:** if the trained model artifact is temporarily unavailable, rule-based risk and deterministic brief keep the application usable while the UI reports the missing-model limitation.

Vertical-slice ownership rules:

- Each story and shared screen has one accountable owner; cross-slice contributors are named explicitly.
- Every backend/API owner must publish mock JSON by Sprint 1 or early Sprint 2.
- UI owners build against mock APIs first, then swap to real APIs when ready.
- ML remains under Hoàng Việt; metrics and rules remain under Diểm Vi; AI Brief and privacy remain under Anh Quân.
- Rule-based risk and deterministic brief remain the runtime fallback if the model service or artifact is unavailable.
>>>>>>> origin/vanson

## 3. Use Case Descriptions

### UC-01: Connect GitHub Repository

**Goal:** Engineering Manager connects one GitHub repository so the system can analyze GitHub workflow metadata.

**Preconditions:**

- User is logged in to the app.
- User has permission to connect or provide read-only access to a GitHub repository.

**Main Flow:**

1. User opens Connect page.
2. User selects GitHub connection method: GitHub App, OAuth, or prototype token.
3. Backend validates credentials and requested permissions.
4. Backend creates `githubConnections` and `repositories` records.
5. Backend creates default `privacySettings`.
6. System queues initial backfill job.
7. UI shows sync status.

**Alternates / Edge Cases:**

- Missing permission: show warning and mark sync coverage as partial.
- Invalid token: reject connection and show clear error.
- Repository already connected: reuse or ask user to reconnect.

**Postconditions:**

- Repository exists in MongoDB.
- Initial backfill job is queued.
- User can view sync progress.

<<<<<<< HEAD
### UC-02: Disconnect Repository and Clear Synced Data

**Goal:** Engineering Manager disconnects a repository and removes synced metadata when the repository is no longer used for analytics.

**Main Flow:**

1. User opens repository settings.
2. User chooses disconnect repository.
3. System asks for confirmation.
4. Backend revokes or marks connection inactive.
5. Backend deletes or archives synced analytics data based on MVP policy.
6. UI confirms the repository is disconnected.

**Postconditions:**

- Repository no longer appears in active dashboard.
- GitHub token/connection is no longer usable.

### UC-03: Run Initial GitHub Backfill
=======
### UC-02: Run Initial GitHub Backfill
>>>>>>> origin/vanson

**Goal:** System imports historical GitHub metadata for the selected repository.

**Preconditions:**

- Repository is connected.
- Valid GitHub access is available.

**Main Flow:**

1. Sync Orchestrator starts a `syncRuns` record.
2. GitHub Connector fetches repository metadata.
3. Connector fetches pull requests in the configured 30-90 day window.
4. Connector fetches reviews, review requests, issues metadata, commits metadata, and check runs where available.
5. Normalization Service upserts records into MongoDB using source IDs.
6. Metrics Engine calculates KPI snapshots.
7. Risk Rule Engine evaluates R1-R5.
8. Evidence Card Service creates cards for triggered rules.
9. Sync run is marked success, partial, or failed.

**Alternates / Edge Cases:**

- GitHub rate limit reached: mark partial sync and resume later.
- Checks permission missing: create data quality warning; R4 returns insufficient data.
- Duplicate records: source IDs prevent duplication.

**Postconditions:**

- Normalized GitHub data is stored.
- Metrics, risk events, and Evidence Cards are available.

<<<<<<< HEAD
### UC-04: Normalize GitHub Entities into MongoDB
=======
### UC-03: Normalize GitHub Entities into MongoDB
>>>>>>> origin/vanson

**Goal:** System converts GitHub API/webhook payloads into stable internal MongoDB entities.

**Main Flow:**

1. System receives GitHub payloads from backfill, polling, webhook, or sample import.
2. Normalization maps source IDs to internal records.
3. Contributors, PRs, reviews, review requests, issues, commits, and checks are upserted.
4. Raw code and raw comment bodies are excluded by default.
5. Duplicate entities are ignored or updated idempotently.

**Postconditions:**

- MongoDB contains clean, queryable GitHub metadata.
- Analytics can use stable internal references.

<<<<<<< HEAD
### UC-05: View Sync Status

**Goal:** User understands whether dashboard and AI output can be trusted.
=======
### UC-04: View Sync Status and Data Quality

**Goal:** User understands whether dashboard, prediction, and AI output can be trusted.
>>>>>>> origin/vanson

**Main Flow:**

1. User opens Connect or Dashboard page.
<<<<<<< HEAD
2. UI requests `/api/repositories/:id/sync-status`.
3. Backend returns latest sync status, last sync time, records processed, and current job state.
4. UI displays pending, running, success, partial, or failed.

### UC-06: View Data Quality Warnings

**Goal:** User sees limitations that affect metric and AI reliability.

**Main Flow:**

1. User opens Dashboard or Connect page.
2. UI requests `/api/repositories/:id/data-quality`.
3. Backend returns warnings and missing coverage.
4. UI displays Good, Partial, or Poor data quality.
=======
2. UI requests sync status and data quality.
3. Backend returns job state, last sync time, processed records, warnings, and missing coverage.
4. UI displays pending, running, success, partial, or failed plus Good, Partial, or Poor data quality.
>>>>>>> origin/vanson

**Key Warnings:**

- Missing checks permission.
- Failed or partial backfill.
- Duplicate webhook ignored.
- No review data found.
- Invalid timestamps in sample/imported data.
<<<<<<< HEAD

### UC-07: Run Manual Sync Now Fallback
=======
- Prediction unavailable because model artifact or required features are missing.

### UC-05: Run Manual Sync Now Fallback
>>>>>>> origin/vanson

**Goal:** User manually refreshes GitHub data when webhook is unavailable or delayed.

**Main Flow:**

1. User clicks Sync now.
2. Backend creates a polling sync job.
3. GitHub Connector fetches records updated since the last sync.
4. Normalization upserts changed entities.
5. Metrics, risks, and Evidence Cards refresh.
6. UI shows updated sync status.

<<<<<<< HEAD
### UC-08: Receive GitHub Webhook Update
=======
### UC-06: Receive GitHub Webhook Update
>>>>>>> origin/vanson

**Goal:** System updates analytics after GitHub sends a repository event.

**Main Flow:**

1. GitHub sends webhook to `/api/webhooks/github`.
2. Webhook Receiver verifies signature.
3. System deduplicates by delivery ID.
4. Event envelope is stored.
5. Affected entity is normalized.
6. Metrics and risk rules are recomputed for impacted window.
7. Evidence Cards are updated.

**Fallback:**

<<<<<<< HEAD
- If webhook endpoint is not feasible, use UC-07 manual Sync now.

### UC-09: Calculate PR Flow Metrics

**Goal:** System computes repeatable GitHub flow KPIs for dashboard, risk rules, and AI brief.
=======
- If webhook endpoint is not feasible, use UC-05 manual Sync now.

### UC-07: Prepare and Validate PR Training Dataset

**Goal:** ML engineer prepares a reproducible supervised dataset for PR review-delay prediction.

**Main Flow:**

1. Team selects a PR-focused public dataset or crawls GitHub PR metadata from public repositories.
2. Dataset pipeline loads raw PR records.
3. Pipeline removes rows missing required timestamps or required feature fields.
4. Pipeline creates label `delayed = time_to_first_review_hours > 24`.
5. Pipeline creates features such as additions, deletions, changed files, commit count, reviewer count, created hour, weekday, and weekend flag.
6. Pipeline saves cleaned dataset and `feature-schema.json`.

**Postconditions:**

- A cleaned dataset exists for training.
- Dataset does not use raw source code or individual productivity labels.

### UC-08: Train and Evaluate PR Delay Model

**Goal:** System trains and evaluates a supervised ML model for PR review-delay risk.

**Main Flow:**

1. Training script loads cleaned dataset and feature schema.
2. Script splits data into train/test sets, preferably time-aware if timestamps support it.
3. Script trains baseline Logistic Regression and/or main Random Forest model.
4. Script evaluates Accuracy, Precision, Recall, F1-score, and Confusion Matrix.
5. Script saves `pr-delay-risk.joblib`, `feature-schema.json`, and `evaluation-report.json`.

**Postconditions:**

- Model artifact and evaluation report are available for backend inference and capstone reporting.

### UC-09: Predict PR Review-Delay Risk

**Goal:** Backend predicts delay risk for active GitHub pull requests.

**Main Flow:**

1. Backend reads normalized PR/review/check metadata.
2. Prediction service builds features using the same `feature-schema.json`.
3. Python model script or inference service loads `pr-delay-risk.joblib`.
4. Service returns probability and risk label: Low, Medium, or High.
5. Backend stores prediction result and uses it in risk/evidence surfaces.

**Postconditions:**

- Active PRs can show ML delay probability.
- Prediction is treated as decision support, not absolute truth.

### UC-10: Calculate GitHub Flow Metrics

**Goal:** System computes repeatable GitHub flow KPIs for dashboard, risk rules, prediction context, and AI brief.
>>>>>>> origin/vanson

**Metrics:**

- Open PR count.
- PR cycle time.
- Merge time.
- Stale PR count.
- Oversized PR count.
<<<<<<< HEAD

**Postconditions:**

- `metricSnapshots` are stored for the selected analysis window.
- Missing data creates limitations instead of fabricated values.

### UC-10: Calculate Review and CI Metrics

**Goal:** System computes review and CI metrics that identify collaboration and pipeline bottlenecks.

**Metrics:**

=======
>>>>>>> origin/vanson
- Review pickup time.
- Review turnaround time.
- Review load concentration.
- Failed check rate.

**Postconditions:**

<<<<<<< HEAD
- Review and CI metric snapshots are stored.
- Missing review/check data creates data quality warnings or insufficient-data states.
=======
- `metricSnapshots` are stored for the selected analysis window.
- Missing data creates data quality warnings or insufficient-data states.
>>>>>>> origin/vanson

### UC-11: View Team Flow Dashboard

**Goal:** Engineering Manager sees repository health and bottlenecks in under 5 minutes.

**Main Flow:**

1. User opens Dashboard.
2. Backend returns repository overview, KPI cards, Delivery Flow Risk, top bottlenecks, and data quality.
3. UI displays KPIs with text labels and evidence links.
4. User clicks a bottleneck to open Risk and Evidence.

**Postconditions:**

- User can identify the top GitHub workflow bottleneck.

<<<<<<< HEAD
### UC-12: View Bottleneck Summary

**Goal:** Engineering Manager sees the top GitHub workflow bottlenecks without reading raw GitHub screens.
=======
### UC-12: View PR Delay Predictions and Bottlenecks

**Goal:** Engineering Manager sees the PRs and bottleneck categories most likely to slow down GitHub delivery flow.
>>>>>>> origin/vanson

**Main Flow:**

1. User opens Dashboard.
<<<<<<< HEAD
2. Backend ranks bottlenecks by active risk severity and affected entity count.
3. UI shows bottleneck cards for stale PRs, review delay, reviewer concentration, CI friction, and oversized PRs.
4. User clicks a bottleneck to drill into Risk and Evidence.
=======
2. Backend returns active PR delay predictions, rule-based bottlenecks, and affected entity count.
3. UI shows high-risk PRs plus bottleneck cards for stale PRs, review delay, reviewer concentration, CI friction, and oversized PRs.
4. User clicks a prediction or bottleneck to drill into Risk and Evidence.
>>>>>>> origin/vanson

### UC-13: Evaluate Delivery Flow Risk

**Goal:** System estimates GitHub delivery flow risk using explainable rules.

**MVP Rules:**

- R1: Stale PR Risk.
- R2: Review Pickup Risk.
- R3: Reviewer Concentration Risk.
- R4: CI Friction Risk.
- R5: Oversized PR Risk.

**Postconditions:**

- `riskEvents` are created with rule code, severity, metric value, threshold, affected entities, and limitations.

### UC-14: View Flow Risk Rulebook

**Goal:** User can inspect the exact rules used to calculate Delivery Flow Risk.

**Main Flow:**

1. User opens Risk and Evidence page.
2. User opens Flow Risk Rulebook.
3. UI displays rule ID, trigger condition, threshold, severity logic, evidence type, and recommended action category.

**Postconditions:**

- Capstone evaluator can verify the risk engine without reading source code.

<<<<<<< HEAD
### UC-15: Generate Evidence Cards

**Goal:** System creates evidence-backed cards for triggered risks.

**Main Flow:**

1. Risk Rule Engine creates a risk event.
2. Evidence Card Service selects affected GitHub entities.
3. Service attaches safe recommendation from the recommendation catalog.
4. Service stores title, summary, severity, evidence, confidence, and limitation.
=======
### UC-15: Generate Evidence Cards from Rules and Predictions

**Goal:** System creates evidence-backed cards for triggered rules and high-risk ML predictions.

**Main Flow:**

1. Risk Rule Engine creates a risk event or ML Prediction Service returns high delay probability.
2. Evidence Card Service selects affected GitHub entities and relevant metric/prediction values.
3. Service attaches safe recommendation from the recommendation catalog.
4. Service stores title, summary, severity, evidence, confidence, model/rule source, and limitation.
>>>>>>> origin/vanson
5. Cards without evidence are suppressed.

**Postconditions:**

<<<<<<< HEAD
- Risk and AI surfaces can reuse the same Evidence Cards.
=======
- Dashboard, Risk, and AI surfaces can reuse the same Evidence Cards.
>>>>>>> origin/vanson

### UC-16: View Evidence Card Details

**Goal:** Engineering Manager verifies why a risk was triggered.

**Main Flow:**

1. User opens Risk and Evidence page.
2. UI requests risk events, rulebook, and Evidence Cards.
3. Backend returns risk drivers, evidence links, rule thresholds, confidence, limitations, and suggested actions.
4. User opens an Evidence Card and sees source PR/review/check references.

**Postconditions:**

- Every displayed insight has at least one evidence link or source metric.

### UC-17: Generate AI Weekly Brief

**Goal:** Engineering Manager generates a weekly management summary grounded in evidence.

**Main Flow:**

1. User opens AI Weekly Brief page.
2. User clicks Generate Brief.
3. Backend reads metric snapshots, risk events, Evidence Cards, and privacy settings.
4. Privacy Guardrails redact contributor names where enabled.
5. AI Brief Service builds structured prompt payload.
6. AI provider returns summary, top risks, recommendations, confidence, and limitations.
7. Backend validates evidence references.
8. Backend stores `aiBriefs` and optional `aiPromptLogs`.
9. UI displays the brief with evidence links.

**Fallback:**

- If AI API fails, use UC-18 deterministic fallback.

### UC-18: Use Deterministic Brief Fallback When AI Fails

**Goal:** System still produces a useful weekly brief when AI provider is unavailable.

**Main Flow:**

1. AI call fails, times out, or is disabled.
2. Backend selects top Evidence Cards by severity.
3. Backend builds a deterministic brief with summary, top risks, recommendations, and limitations.
4. UI labels the brief as fallback-generated.

**Postconditions:**

- Demo path remains reliable even without AI API.

### UC-19: Manage Privacy Settings and Prohibited-Use Notice

**Goal:** User controls privacy-safe analytics behavior.

**Main Flow:**

1. User opens Privacy page.
2. UI displays collected data, AI prompt policy, and prohibited-use notice.
3. User toggles contributor pseudonymization or views minimum group threshold.
4. Backend updates `privacySettings`.

**Guardrails:**

- No individual productivity ranking.
- No burnout diagnosis.
- No HR recommendation.
- No raw source code or raw comment bodies sent to AI by default.

### UC-20: Import Sample GitHub-style Data

**Goal:** Capstone demo can proceed without live GitHub credentials.

**Main Flow:**

1. User uploads JSON/CSV sample dataset.
2. System validates schema and dates.
3. Normalization stores GitHub-style entities.
4. Metrics, risks, and Evidence Cards are generated.
5. UI labels data source as sample/imported.

## 4. Main User Flows

### Flow A: Connect Repository to Dashboard

1. User logs in.
2. User opens Connect.
3. User connects GitHub repository.
4. System starts initial backfill.
5. User watches sync status.
6. System normalizes data.
<<<<<<< HEAD
7. System calculates metrics and risk.
8. User opens Dashboard.
9. User sees KPIs, Delivery Flow Risk, top bottleneck, and data quality.

### Flow B: Investigate Risk Through Evidence

1. User sees High or Medium Delivery Flow Risk on Dashboard.
2. User clicks risk badge or bottleneck card.
3. System opens Risk and Evidence page.
4. User reviews triggered rule, threshold, metric value, affected PRs/checks/reviews.
=======
7. System calculates metrics, predicts PR delay risk, and evaluates rule-based risk.
8. User opens Dashboard.
9. User sees KPIs, ML delay predictions, Delivery Flow Risk, top bottleneck, and data quality.

### Flow B: Investigate Risk Through Evidence

1. User sees High or Medium Delivery Flow Risk or a High PR Delay Prediction on Dashboard.
2. User clicks risk badge, prediction, or bottleneck card.
3. System opens Risk and Evidence page.
4. User reviews triggered rule or model prediction, threshold/probability, metric value, and affected PRs/checks/reviews.
>>>>>>> origin/vanson
5. User opens Evidence Card.
6. User chooses safe workflow action, such as assign backup reviewer or inspect failed check.

### Flow C: Generate Weekly Brief

1. User opens AI Weekly Brief page.
2. System checks if metrics and Evidence Cards exist.
3. User clicks Generate.
4. System applies privacy redaction.
5. System calls AI provider or deterministic fallback.
6. System validates evidence references.
7. User reads summary, top risks, recommendations, confidence, and limitations.

### Flow D: Update Data After New GitHub Activity

1. New PR/review/check event occurs in GitHub.
2. GitHub sends webhook or user clicks Sync now.
3. System deduplicates and normalizes changed entity.
4. Metrics Engine recomputes affected snapshots.
<<<<<<< HEAD
5. Risk Rule Engine refreshes risk events.
6. Evidence Cards update.
7. Dashboard and Risk pages show fresh data.
=======
5. ML Prediction Service refreshes PR delay predictions.
6. Risk Rule Engine refreshes risk events.
7. Evidence Cards update.
8. Dashboard and Risk pages show fresh data.

### Flow E: Train and Use PR Delay Model

1. Team prepares PR training dataset from public PR data or crawled GitHub metadata.
2. Training script cleans data and creates label `delayed`.
3. Training script creates features and trains the model.
4. Training script saves model artifact and evaluation report.
5. Backend loads model artifact through prediction service.
6. Active PRs receive delay probability and Low/Medium/High risk label.
7. High-risk predictions appear in Dashboard, Evidence Cards, and AI Weekly Brief.
>>>>>>> origin/vanson

## 5. Sequence Diagrams

### 5.1 Repository Connection and Initial Backfill

```mermaid
sequenceDiagram
  actor EM as Engineering Manager
  participant FE as React Web App
  participant API as Express API
  participant GC as GitHub Connector
  participant GH as GitHub API
  participant DB as MongoDB
  participant ME as Metrics Engine
<<<<<<< HEAD
=======
  participant ML as ML Prediction Service
>>>>>>> origin/vanson
  participant RE as Risk Rule Engine
  participant EC as Evidence Card Service

  EM->>FE: Connect GitHub repository
  FE->>API: POST /api/github/connect
  API->>GC: Validate credentials and repo access
  GC->>GH: Fetch repository metadata
  GH-->>GC: Repository metadata
  GC->>DB: Store connection and repository
  API->>DB: Create syncRun and syncJob
  API-->>FE: Connection accepted, sync started

  GC->>GH: Fetch PRs, reviews, issues, commits, checks
  GH-->>GC: GitHub metadata payloads
  GC->>DB: Upsert normalized entities
  GC->>DB: Mark syncRun success/partial
  GC->>ME: Compute metrics
  ME->>DB: Store metricSnapshots
<<<<<<< HEAD
  ME->>RE: Evaluate R1-R5
=======
  ME->>ML: Predict PR delay risk
  ML->>DB: Store prediction results
  ME->>RE: Evaluate R1-R5 with metrics/predictions
>>>>>>> origin/vanson
  RE->>DB: Store riskEvents
  RE->>EC: Generate Evidence Cards
  EC->>DB: Store evidenceCards
  FE->>API: GET /api/repositories/:id/dashboard
  API-->>FE: KPIs, risk, evidence count, data quality
```

### 5.2 Webhook Update Flow

```mermaid
sequenceDiagram
  participant GH as GitHub
  participant WH as Webhook Receiver
  participant DB as MongoDB
  participant NS as Normalization Service
  participant ME as Metrics Engine
<<<<<<< HEAD
=======
  participant ML as ML Prediction Service
>>>>>>> origin/vanson
  participant RE as Risk Rule Engine
  participant EC as Evidence Card Service

  GH->>WH: POST pull_request/review/check event
  WH->>WH: Verify signature
  WH->>DB: Check delivery ID
  alt Duplicate delivery
    WH->>DB: Mark duplicate ignored
  else New delivery
    WH->>DB: Store webhook event envelope
    WH->>NS: Normalize affected entity
    NS->>DB: Upsert normalized record
    NS->>ME: Recompute impacted metrics
    ME->>DB: Update metricSnapshots
<<<<<<< HEAD
=======
    ME->>ML: Recompute impacted predictions
    ML->>DB: Update prediction results
>>>>>>> origin/vanson
    ME->>RE: Re-evaluate impacted rules
    RE->>DB: Update riskEvents
    RE->>EC: Refresh Evidence Cards
    EC->>DB: Update evidenceCards
  end
```

### 5.3 Dashboard, Risk, and Evidence Flow

```mermaid
sequenceDiagram
  actor EM as Engineering Manager
  participant FE as React Web App
  participant API as Dashboard API
  participant DB as MongoDB
  participant PG as Privacy Guardrails

  EM->>FE: Open Dashboard
  FE->>API: GET /api/repositories/:id/dashboard?window=7d
<<<<<<< HEAD
  API->>DB: Read metricSnapshots, riskEvents, dataQualityWarnings
  API->>PG: Apply visibility rules
  PG-->>API: Redacted/allowed dashboard data
  API-->>FE: Dashboard KPIs and top bottlenecks
=======
  API->>DB: Read metricSnapshots, predictions, riskEvents, dataQualityWarnings
  API->>PG: Apply visibility rules
  PG-->>API: Redacted/allowed dashboard data
  API-->>FE: Dashboard KPIs, PR delay predictions, and top bottlenecks
>>>>>>> origin/vanson

  EM->>FE: Click risk driver
  FE->>API: GET /api/repositories/:id/evidence-cards?window=7d
  API->>DB: Read evidenceCards and affected entities
  API->>PG: Apply masking/minimum group threshold
  API-->>FE: Evidence Cards with limitations and recommendations
```

### 5.4 AI Weekly Brief Flow

```mermaid
sequenceDiagram
  actor EM as Engineering Manager
  participant FE as React Web App
  participant API as Express API
  participant AB as AI Brief Service
  participant PG as Privacy Guardrails
  participant DB as MongoDB
  participant AI as AI Provider

  EM->>FE: Click Generate Weekly Brief
  FE->>API: POST /api/repositories/:id/briefs
  API->>AB: Generate brief for window
  AB->>DB: Read metrics, riskEvents, evidenceCards
  AB->>PG: Redact prompt payload
  PG-->>AB: Structured safe prompt payload
  AB->>AI: Send structured prompt
  alt AI succeeds
    AI-->>AB: Brief summary with evidence references
    AB->>AB: Validate evidence references
  else AI unavailable
    AB->>AB: Build deterministic fallback brief
  end
  AB->>DB: Store aiBrief and prompt log
  API-->>FE: Brief, top risks, recommendations, limitations
```

<<<<<<< HEAD
=======
### 5.5 PR Delay Model Training and Inference Flow

```mermaid
sequenceDiagram
  actor ML as ML Engineer
  participant DS as Dataset Pipeline
  participant TR as Training Script
  participant FS as Feature Schema
  participant MA as Model Artifact
  participant API as Express API
  participant PY as Python Predict Script
  participant DB as MongoDB

  ML->>DS: Load PR dataset or crawled GitHub PR metadata
  DS->>DS: Clean rows and create delayed label
  DS->>FS: Save feature-schema.json
  DS->>TR: Provide cleaned training dataset
  TR->>TR: Train Logistic Regression / Random Forest
  TR->>TR: Evaluate Accuracy, Precision, Recall, F1
  TR->>MA: Save pr-delay-risk.joblib
  TR->>DB: Store evaluation summary or model version metadata

  API->>DB: Read active normalized PR metadata
  API->>PY: Predict with feature values
  PY->>MA: Load model artifact
  PY-->>API: Return delay probability and risk label
  API->>DB: Store PR prediction result
```

>>>>>>> origin/vanson
## 6. Implementation Backlog

### Epic E1: Project Foundation and MongoDB Data Model

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E1-S1 | Scaffold React + Express + TypeScript modular monolith | Must | Frontend and backend run locally; shared env config exists; basic health endpoint works. |
<<<<<<< HEAD
| E1-S2 | Define MongoDB/Mongoose schemas | Must | Schemas exist for repositories, connections, contributors, PRs, reviews, issues, commits, checkRuns, syncRuns, metricSnapshots, riskEvents, evidenceCards, aiBriefs, privacySettings. |
=======
| E1-S2 | Define MongoDB/Mongoose schemas | Must | Schemas exist for users, repositories, githubConnections, privacySettings, contributors, pullRequests, reviews, reviewRequests, issues, commits, checkRuns, syncRuns, syncJobs, webhookEvents, dataQualityWarnings, metricSnapshots, flowRules, modelVersions, prDelayPredictions, riskEvents, evidenceCards, recommendations, aiBriefs, aiPromptLogs, and auditEvents according to MVP/Should-have scope. |
>>>>>>> origin/vanson
| E1-S3 | Add repository and sync job indexes | Must | Unique indexes prevent duplicate GitHub entities; query indexes support dashboard/risk queries. |
| E1-S4 | Add basic local user/session prototype | Should | User can access Connect/Dashboard pages with a prototype session. |

### Epic E2: GitHub Sync and Normalization

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E2-S1 | Implement GitHub connection endpoint | Must | `POST /api/github/connect` stores one repository connection and validates credentials or mock token. |
| E2-S2 | Implement initial PR backfill | Must | System fetches PR metadata within backfill window and stores normalized PRs. |
| E2-S3 | Implement reviews and review requests sync | Must | Reviews and requested reviewers are normalized and linked to PRs. |
| E2-S4 | Implement issues, commits metadata, and checks sync | Must | Metadata is stored without raw code or raw body ingestion by default. |
| E2-S5 | Implement sync status and data quality warnings | Must | UI/API exposes success, partial, failed, missing permissions, last synced time, and records processed. |
| E2-S6 | Implement sample GitHub-style import fallback | Should | JSON/CSV sample data can populate normalized collections for demo. |

### Epic E3: Metrics Engine

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E3-S1 | Calculate PR and merge metrics | Must | PR cycle time, merge time, open PR count, stale PR count are stored as `metricSnapshots`. |
| E3-S2 | Calculate review metrics | Must | Review pickup time, review turnaround time, and review load concentration are computed. |
| E3-S3 | Calculate CI and PR size metrics | Must | Failed check rate and oversized PR count are computed or marked insufficient data. |
| E3-S4 | Add baseline/window support | Should | Metrics support current 7d window and optional previous-window comparison. |
| E3-S5 | Add metrics unit tests | Must | Each metric has normal, missing-data, and edge-case tests. |

<<<<<<< HEAD
### Epic E4: Risk Rule Engine and Evidence Cards

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E4-S1 | Implement Flow Risk Rulebook R1-R5 | Must | Each rule has rule code, threshold, severity, affected entities, and insufficient-data behavior. |
| E4-S2 | Store risk events | Must | Triggered rules create `riskEvents` with metric value, threshold, severity, and affected entity refs. |
| E4-S3 | Implement recommendation catalog | Must | Each rule maps to safe workflow recommendations without HR/performance language. |
| E4-S4 | Generate Evidence Cards | Must | Each triggered risk creates at least one Evidence Card with evidence, confidence, limitation, and suggested action. |
| E4-S5 | Suppress unsupported insights | Must | Cards without evidence are not shown and cannot feed AI brief. |
| E4-S6 | Add rule accuracy tests | Must | Each R1-R5 has one fixture that triggers it and one fixture that does not. |

### Epic E5: Dashboard and Risk UI

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E5-S1 | Build Connect / Sync Status page | Must | User can connect/import, start sync, and see sync/data quality status. |
| E5-S2 | Build Team Flow Dashboard | Must | Dashboard shows repository overview, KPI cards, Delivery Flow Risk, top bottlenecks, and last sync time. |
| E5-S3 | Build Risk and Evidence page | Must | User can view risk drivers, rule thresholds, Evidence Cards, and affected GitHub records. |
| E5-S4 | Build Flow Risk Rulebook UI | Must | Rule IDs, trigger conditions, severity, evidence type, and action category are visible. |
| E5-S5 | Add empty/loading/error states | Must | UI handles no data, partial sync, poor data quality, and API errors. |

### Epic E6: AI Weekly Brief and Privacy Guardrails

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E6-S1 | Build structured prompt payload generator | Must | Prompt contains only metrics, Evidence Cards, limitations, and prohibited claims. |
| E6-S2 | Implement privacy redaction | Must | Contributor names can be pseudonymized; raw code/comment bodies are excluded by default. |
| E6-S3 | Implement AI brief generation endpoint | Must | `POST /api/repositories/:id/briefs` returns top risks, summary, recommendations, confidence, limitations. |
| E6-S4 | Add deterministic fallback brief | Must | If AI API fails, system generates a brief from top Evidence Cards. |
| E6-S5 | Build AI Weekly Brief UI | Must | User can generate, view, and inspect evidence-linked brief items. |
| E6-S6 | Build Privacy page / notice | Should | User sees data collected, AI prompt policy, no-HR-use notice, and masking status. |

### Epic E7: Webhook/Polling and Demo Hardening

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E7-S1 | Implement GitHub webhook receiver | Should | Endpoint verifies signature, stores event envelope, deduplicates delivery ID, and dispatches normalization. |
| E7-S2 | Implement polling / Sync now fallback | Must | User can refresh changed GitHub records without webhook. |
| E7-S3 | Recompute impacted analytics after updates | Must | New PR/review/check updates refresh metrics, risks, and Evidence Cards. |
| E7-S4 | Add capstone demo fixtures | Must | Seed data demonstrates stale PR, review delay, reviewer concentration, CI friction, and oversized PR. |
| E7-S5 | Add capstone evaluation tests | Must | Tests cover sync, metrics, rules, evidence coverage, privacy guardrails, and AI fallback. |

## 6.1 Backlog Ownership Guide for 5 Members

| Member | Recommended Stories | Difficulty Mix | Notes |
|---|---|---|---|
| Strong Dev 1 | E2-S1, E2-S2, E2-S5, E7-S2 | Hard + Medium | Own GitHub connection, backfill, sync status API, and manual Sync now. |
| Strong Dev 2 | E1-S2, E1-S3, E2-S3, E2-S4, E4-S4, E7-S1 | Hard + Medium | Own MongoDB model quality, normalization, webhook, and Evidence Card generation. |
| Strong Dev 3 | E3-S1, E3-S2, E3-S3, E4-S1, E4-S2, E6-S1, E6-S3, E6-S4 | Hard | Own metrics engine, risk rules, and AI brief logic. |
| Junior Dev 1 | E1-S4, E2-S6, E5-S1, E6-S2, E6-S6 | Easy + Medium | Own sample import UI/support, sync/data-quality display, privacy notice, and redaction UI checks with support from Strong Dev 2/3. |
| Junior Dev 2 | E5-S2, E5-S3, E5-S4, E5-S5, E6-S5 | Easy + Medium | Own dashboard/risk/brief screens using APIs created by stronger backend owners. |

Workload balancing rule:

- Strong members should own backend logic that can break correctness: GitHub sync, normalization, metrics, risk rules, AI validation.
- Lower-skill members should own UI surfaces, status displays, static rulebook/privacy content, and sample/demo workflows.
- Pair junior members with strong owners for integration points, especially sample import normalization and AI privacy redaction.

## 7. Sprint Breakdown for Coding

Assumption: five coding sprints, each 1-2 weeks depending on team capacity. Jira is excluded.
=======
### Epic E4: PR Delay ML Model

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E4-S1 | Prepare PR training dataset | Must | Training dataset contains required PR metadata fields, generated `delayed` label, and no raw source code. |
| E4-S2 | Build feature engineering script | Must | Script outputs model-ready features and `feature-schema.json`; train and inference use the same feature names. |
| E4-S3 | Train baseline and main model | Must | Logistic Regression baseline and/or Random Forest model can be trained reproducibly from the cleaned dataset. |
| E4-S4 | Evaluate model | Must | Evaluation report includes Accuracy, Precision, Recall, F1-score, and Confusion Matrix. |
| E4-S5 | Save model artifacts | Must | `pr-delay-risk.joblib`, `feature-schema.json`, and `evaluation-report.json` are saved under a documented model folder. |
| E4-S6 | Implement prediction service | Must | Backend can call Python prediction script/service and receive delay probability plus Low/Medium/High risk label. |
| E4-S7 | Store prediction results | Must | Prediction result is stored per PR with model version, probability, label, and feature summary. |

### Epic E5: Risk Rule Engine and Evidence Cards

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E5-S1 | Implement Flow Risk Rulebook R1-R5 | Must | Each rule has rule code, threshold, severity, affected entities, and insufficient-data behavior. |
| E5-S2 | Store risk events | Must | Triggered rules create `riskEvents` with metric value, threshold, severity, and affected entity refs. |
| E5-S3 | Implement recommendation catalog | Must | Each rule maps to safe workflow recommendations without HR/performance language. |
| E5-S4 | Generate Evidence Cards | Must | Each triggered rule or high-risk prediction creates at least one Evidence Card with evidence, confidence, limitation, and suggested action. |
| E5-S5 | Suppress unsupported insights | Must | Cards without evidence are not shown and cannot feed AI brief. |
| E5-S6 | Add rule and prediction evidence tests | Must | Each R1-R5 has trigger/non-trigger fixtures; high prediction probability creates evidence while missing features create limitation. |

### Epic E6: Dashboard and Risk UI

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E6-S1 | Build Connect / Sync Status page | Must | User can connect/import, start sync, and see sync/data quality status. |
| E6-S2 | Build Team Flow Dashboard | Must | Dashboard shows repository overview, KPI cards, PR delay predictions, Delivery Flow Risk, top bottlenecks, and last sync time. |
| E6-S3 | Build Risk and Evidence page | Must | User can view rule drivers, ML prediction drivers, Evidence Cards, and affected GitHub records. |
| E6-S4 | Build Flow Risk Rulebook UI | Must | Rule IDs, trigger conditions, severity, evidence type, and action category are visible. |
| E6-S5 | Add empty/loading/error states | Must | UI handles no data, partial sync, missing model artifact, poor data quality, and API errors. |

### Epic E7: AI Weekly Brief and Privacy Guardrails

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E7-S1 | Build structured prompt payload generator | Must | Prompt contains only metrics, prediction summaries, Evidence Cards, limitations, and prohibited claims. |
| E7-S2 | Implement privacy redaction | Must | Contributor names can be pseudonymized; raw code/comment bodies are excluded by default. |
| E7-S3 | Implement AI brief generation endpoint | Must | `POST /api/repositories/:id/briefs` returns top risks, prediction highlights, summary, recommendations, confidence, limitations. |
| E7-S4 | Add deterministic fallback brief | Must | If AI API fails, system generates a brief from top Evidence Cards and prediction results. |
| E7-S5 | Build AI Weekly Brief UI | Must | User can generate, view, and inspect evidence-linked brief items. |
| E7-S6 | Build Privacy page / notice | Should | User sees data collected, AI prompt policy, no-HR-use notice, and masking status. |

### Epic E8: Webhook/Polling and Demo Hardening

| Story | Title | Priority | Acceptance Criteria |
|---|---|---|---|
| E8-S1 | Implement GitHub webhook receiver | Should | Endpoint verifies signature, stores event envelope, deduplicates delivery ID, and dispatches normalization. |
| E8-S2 | Implement polling / Sync now fallback | Must | User can refresh changed GitHub records without webhook. |
| E8-S3 | Recompute impacted analytics after updates | Must | New PR/review/check updates refresh metrics, predictions, risks, and Evidence Cards. |
| E8-S4 | Add capstone demo fixtures | Must | Seed data demonstrates stale PR, review delay, reviewer concentration, CI friction, oversized PR, and high ML delay prediction. |
| E8-S5 | Add capstone evaluation tests | Must | Tests cover sync, metrics, model inference, rules, evidence coverage, privacy guardrails, and AI fallback. |

## 6.1 Backlog Ownership Guide for 5 Members

This section mirrors the active vertical-slice allocation in `team-allocation-5-members.md`. Database stories E1-S2 and E1-S3 remain Team Shared, with one rotating DB Coordinator implementing reviewed schema proposals.

### Layer Ownership Matrix

| Owner | Vertical Slice | Owned Stories | Main Deliverables |
|---|---|---|---|
| Team Shared | MongoDB foundation | E1-S2, E1-S3 | Schema, validation, indexes, seed data, and reviewed migration changes. |
| Vân Anh | Repository Connection & Sync | E1-S1; E2-S1, E2-S2, E2-S3; E6-S1; E8-S1, E8-S2, E8-S3 | App scaffold, GitHub connection/backfill/review sync, Connect/Sync UI, polling/webhook updates, recompute orchestration. |
| Văn Sơn | Data Import & Evidence | E2-S4, E2-S6; E5-S4; E6-S3 | Normalized metadata/check sync, sample import, Evidence Card service/storage, Risk & Evidence page. |
| Hoàng Việt | PR Delay Machine Learning | E4-S1 through E4-S7; E5-S6; contributor E6-S2/E6-S3 | Dataset/features, model training/evaluation/artifacts, prediction service/storage, prediction evidence tests and UI details. |
| Diểm Vi | Metrics & Delivery Risk | E3-S1 through E3-S5; E5-S1, E5-S2, E5-S3, E5-S5; E6-S2, E6-S4; contributor E6-S3 | Metrics, risk events, Rulebook R1-R5, recommendations, Dashboard, Rulebook UI, and risk drivers. |
| Anh Quân | Data Quality, AI Brief & Privacy | E1-S4; E2-S5; E6-S5; E7-S1 through E7-S6; E8-S4; E8-S5 integration | App shell, data quality, shared states, privacy, AI Weekly Brief/fallback, demo fixtures, and E2E integration. |

### MVP Scope and Runtime Fallback

| Category | Must Demo? | Owner | Notes |
|---|---|---|---|
| GitHub connection/backfill/sync | Yes | Vân Anh | Can use token/prototype connection if GitHub App is too heavy. |
| Normalized MongoDB data and sample import | Yes | Văn Sơn | Provides stable data for metrics, rules, evidence, and demo fallback. |
| Metrics and Rule Engine R1-R5 | Yes | Diểm Vi | Required for Dashboard and rule-based fallback. |
| Evidence Cards | Yes | Văn Sơn owner; Diểm Vi and Hoàng Việt contributors | Must support rule-based cards even without ML. |
| Dashboard and Rulebook | Yes | Diểm Vi | Uses prediction contributions from Hoàng Việt. |
| Data Quality, Brief, Privacy, shared states | Yes | Anh Quân | Deterministic brief must work without an external AI provider. |
| ML Prediction | Yes | Hoàng Việt | Training, evaluation, inference, and stored predictions are required; runtime failure falls back to rule-based risk. |

### Dependency Map

| Provider | Consumer | Dependency | Mitigation |
|---|---|---|---|
| Vân Anh | Văn Sơn | GitHub payload shape for PRs, reviews, issues, commits, checks. | Publish sample GitHub payload JSON in Sprint 1. |
| Văn Sơn | Hoàng Việt, Diểm Vi | Normalized schema, fixtures, and query shape. | Publish normalized fixtures and repository-scoped queries in Sprint 1. |
| Hoàng Việt | Văn Sơn, Diểm Vi, Anh Quân | Prediction result and model-availability contract. | Publish prediction mock JSON; rule-based behavior remains available. |
| Diểm Vi | Văn Sơn, Anh Quân | Dashboard, risk, rulebook, and recommendation contracts. | Publish Mock API JSON in Sprint 1. |
| Văn Sơn | Anh Quân | Evidence Card and sample import contracts. | Anh Quân uses mock cards/results until integration. |
| Vân Anh | Anh Quân | Sync status and common error contract. | Agree on status components and common error conventions in Sprint 1. |

### Remaining Bottlenecks

| Bottleneck | Risk | Mitigation |
|---|---|---|
| Cross-slice analytics flow spans Văn Sơn, Hoàng Việt, Diểm Vi, and Anh Quân | Contract mismatch may block integration. | Freeze normalized, prediction, evidence, dashboard, and brief mock contracts in Sprint 1. |
| GitHub live integration may fail or hit rate limits | Demo instability. | Văn Sơn sample import and Anh Quân demo fixtures must be ready before relying on live sync. |
| Frontend may wait for backend APIs | UI delay and idle frontend work. | Mock API files must be available from Sprint 1. Frontend builds against mock responses, then switches to real endpoints. |
| Evidence Cards depend on rules, predictions, persistence, and UI | Risk page may be blocked. | Văn Sơn owns the slice; Diểm Vi and Hoàng Việt publish inputs early and contribute details. |
| AI provider may fail or be unavailable | Weekly brief demo can break. | Deterministic fallback brief is MVP Required. |

### Mock API Strategy From Sprint 1

Frontend must not wait for production backend implementation. Create mock JSON files or mock endpoints with the same shape as planned APIs:

| Mock Contract | Owner | Used By |
|---|---|---|
| `mock/repository-connection.json` | Vân Anh | Vân Anh Connect UI |
| `mock/sync-status.json` | Vân Anh | Vân Anh Sync Status UI; Anh Quân Data Quality panel |
| `mock/data-quality.json` | Anh Quân | Vân Anh Connect/Sync page and shared states |
| `mock/sample-import-result.json` | Văn Sơn | Văn Sơn import UI and Vân Anh Connect/Sync page |
| `mock/dashboard-summary.json` | Diểm Vi | Diểm Vi Dashboard UI |
| `mock/pr-delay-predictions.json` | Hoàng Việt | Hoàng Việt prediction UI contribution; Diểm Vi Dashboard |
| `mock/evidence-cards.json` | Văn Sơn with Diểm Vi/Hoàng Việt inputs | Văn Sơn Risk & Evidence UI; Anh Quân Brief |
| `mock/rulebook.json` | Diểm Vi | Diểm Vi Rulebook UI |
| `mock/weekly-brief.json` | Anh Quân | Anh Quân Weekly Brief UI |

### Balanced Member Task Breakdown

These tasks balance work across 3-4 months. UI members start with Mock API data in Sprint 1, while backend/data/analytics members publish contracts early.

| Member | Sprint | Tasks |
|---|---|---|
| Vân Anh | Sprint 1 | Scaffold app; define GitHub connection/sync contracts and mocks. |
| Vân Anh | Sprint 2 | Implement GitHub connection, PR backfill, and review sync. |
| Vân Anh | Sprint 3 | Complete sync status API behavior. |
| Vân Anh | Sprint 4 | Complete Connect/Sync Status UI and Sync now. |
| Vân Anh | Sprint 5 | Implement webhook and impacted-analytics recompute orchestration. |
| Vân Anh | Sprint 6 | Stabilize rate limits and live/demo sync path. |
| Văn Sơn | Sprint 1 | Coordinate schemas/indexes; publish normalized/evidence contracts and fixtures. |
| Văn Sơn | Sprint 2 | Implement issues/commits/checks sync and sample import. |
| Văn Sơn | Sprint 3 | Prepare persistence and Evidence Card foundation. |
| Văn Sơn | Sprint 4 | Implement Evidence Card service and Risk/Evidence page. |
| Văn Sơn | Sprint 5 | Complete import/evidence integration. |
| Văn Sơn | Sprint 6 | Validate duplicate handling and evidence query contracts. |
| Hoàng Việt | Sprint 1 | Define dataset, feature schema, prediction contract, and mock. |
| Hoàng Việt | Sprint 2 | Prepare dataset and feature engineering pipeline. |
| Hoàng Việt | Sprint 3 | Train and evaluate the model. |
| Hoàng Việt | Sprint 4 | Save artifacts and implement prediction service/storage. |
| Hoàng Việt | Sprint 5 | Add prediction/evidence tests and Prediction UI contributions. |
| Hoàng Việt | Sprint 6 | Stabilize reproducibility and missing-model behavior. |
| Diểm Vi | Sprint 1 | Define dashboard, risk, rulebook contracts and mocks. |
| Diểm Vi | Sprint 2 | Implement PR, review, CI, and PR-size metrics. |
| Diểm Vi | Sprint 3 | Implement Rulebook R1-R5, risk events, recommendations, and suppression. |
| Diểm Vi | Sprint 4 | Implement Dashboard, Risk API, and Rulebook UI. |
| Diểm Vi | Sprint 5 | Complete dashboard/risk/evidence integration. |
| Diểm Vi | Sprint 6 | Stabilize analytics and insufficient-data behavior. |
| Anh Quân | Sprint 1 | Build app shell, routing, shared states, and privacy/error contracts. |
| Anh Quân | Sprint 2 | Implement data-quality aggregation and shared UI states. |
| Anh Quân | Sprint 3 | Implement privacy redaction and shared navigation/states. |
| Anh Quân | Sprint 4 | Implement Weekly Brief backend/fallback and Privacy page. |
| Anh Quân | Sprint 5 | Complete Weekly Brief UI, demo fixtures, and E2E integration. |
| Anh Quân | Sprint 6 | Stabilize responsive UI, privacy guardrails, and final demo flow. |

## 7. Sprint Breakdown for Coding

Assumption: six coding sprints, each 1-2 weeks depending on team capacity. Jira is excluded.
>>>>>>> origin/vanson

### Sprint 1: Foundation and Data Model

**Goal:** App skeleton and database foundation are ready.

**Build:**

- React + Vite + TypeScript frontend.
- Node.js + Express + TypeScript backend.
- MongoDB connection and Mongoose schemas.
- Core indexes and seed script.
- Basic navigation: Connect, Dashboard, Risk, Brief, Privacy.

**Done when:**

- Local app starts.
- Health endpoint works.
- Schemas and indexes are created.
- Seeded repository data can be inserted.

### Sprint 2: GitHub Sync Foundation

**Goal:** Repository connection and initial GitHub metadata sync work.

**Build:**

- GitHub connection/token prototype.
- Initial backfill for PRs.
- Reviews/review requests sync.
- Checks, commits metadata, issues metadata sync.
- Sync status and data quality warnings.
- Sample import fallback.

**Done when:**

- One repository can be connected or imported.
- Sync run stores normalized entities.
- Data quality status is visible.

<<<<<<< HEAD
### Sprint 3: Metrics Engine and Dashboard

**Goal:** Manager can see GitHub flow health.
=======
### Sprint 3: Metrics Engine and ML Dataset

**Goal:** Core analytics and ML dataset foundation are ready.
>>>>>>> origin/vanson

**Build:**

- PR cycle time, merge time, stale PR count.
- Review pickup and turnaround metrics.
- Failed check rate and oversized PR metrics.
- Review load concentration.
- Metric snapshots.
<<<<<<< HEAD
- Dashboard KPI cards and bottleneck summary.

**Done when:**

- Dashboard loads in under 3 seconds for seeded demo data.
- Metrics have unit tests.
- Missing data shows limitations.

### Sprint 4: Risk Rules and Evidence Cards

**Goal:** Risks are explainable and traceable.

**Build:**

=======
- Dataset preparation script.
- Feature engineering script and `feature-schema.json`.
- Label generation: `delayed = time_to_first_review_hours > 24`.

**Done when:**

- Metrics have unit tests.
- Missing data shows limitations.
- Cleaned training dataset and feature schema are generated.

### Sprint 4: ML Model, Risk Rules, and Evidence Cards

**Goal:** Delay predictions and rule-based risks are explainable and traceable.

**Build:**

- Train Logistic Regression baseline and/or Random Forest model.
- Evaluation report with Accuracy, Precision, Recall, F1, and Confusion Matrix.
- Save `pr-delay-risk.joblib`.
- Backend prediction service calling Python script/service.
>>>>>>> origin/vanson
- R1 Stale PR Risk.
- R2 Review Pickup Risk.
- R3 Reviewer Concentration Risk.
- R4 CI Friction Risk.
- R5 Oversized PR Risk.
- Risk events.
<<<<<<< HEAD
- Recommendation catalog.
- Evidence Card generation and Risk/Evidence UI.
- Rulebook UI.

**Done when:**

- Each R1-R5 rule has trigger and non-trigger tests.
- Every displayed risk has at least one evidence link.
- User can drill from dashboard bottleneck to Evidence Card.

### Sprint 5: AI Weekly Brief, Privacy, and Demo Hardening

**Goal:** Capstone-ready workflow from sync to evidence-backed brief.

**Build:**

=======
- PR delay prediction records.
- Recommendation catalog.
- Evidence Card generation from rules and predictions.

**Done when:**

- Model artifact can predict Low/Medium/High delay risk.
- Evaluation report exists for capstone report.
- Each R1-R5 rule has trigger and non-trigger tests.
- Every displayed risk has at least one evidence link.
- High-risk prediction can create an Evidence Card.

### Sprint 5: Dashboard, Risk UI, AI Weekly Brief, and Privacy

**Goal:** User-facing workflow works from dashboard to evidence-backed brief.

**Build:**

- Dashboard KPI cards, PR delay prediction cards, and bottleneck summary.
- Risk/Evidence UI.
- Rulebook UI.
>>>>>>> origin/vanson
- Structured prompt payload.
- Privacy redaction and prohibited-claim instructions.
- AI provider call and deterministic fallback.
- AI Weekly Brief UI.
- Privacy notice page.
<<<<<<< HEAD
- Sync now fallback.
- Optional webhook receiver.
=======

**Done when:**

- Dashboard loads in under 3 seconds for seeded demo data.
- User can drill from dashboard prediction/bottleneck to Evidence Card.
- User can generate an evidence-backed weekly brief.
- AI failure still returns deterministic brief.
- No UI shows individual productivity ranking.

### Sprint 6: Webhook, Sync Fallback, Testing, and Demo Hardening

**Goal:** Capstone-ready demo path is stable.

**Build:**

- Sync now fallback.
- Optional webhook receiver.
- Recompute impacted metrics, predictions, risks, and Evidence Cards after updates.
>>>>>>> origin/vanson
- Demo fixtures and evaluation tests.

**Done when:**

<<<<<<< HEAD
- User can generate an evidence-backed weekly brief.
- AI failure still returns deterministic brief.
- No UI shows individual productivity ranking.
- Demo path works end to end: connect/import -> dashboard -> risk evidence -> AI brief -> privacy notice.
=======
- Demo path works end to end: connect/import -> dashboard -> PR prediction/risk evidence -> AI brief -> privacy notice.
- Tests cover sync, metrics, ML inference, rules, evidence coverage, privacy guardrails, and AI fallback.
>>>>>>> origin/vanson

## 8. Recommended Build Order

1. MongoDB schemas and seed data.
2. Sample import fallback.
3. GitHub connection and PR backfill.
4. Reviews/checks/issues/commits metadata sync.
5. Sync status and data quality.
6. Metrics engine.
<<<<<<< HEAD
7. Dashboard.
8. Risk Rulebook R1-R5.
9. Evidence Cards and recommendations.
10. AI Weekly Brief with deterministic fallback.
11. Privacy guardrails.
12. Webhook or Sync now update path.
13. Capstone demo fixtures and tests.
=======
7. Dataset preparation and feature engineering.
8. Model training, evaluation, and saved artifact.
9. ML prediction service.
10. Dashboard.
11. Risk Rulebook R1-R5.
12. Evidence Cards and recommendations.
13. AI Weekly Brief with deterministic fallback.
14. Privacy guardrails.
15. Webhook or Sync now update path.
16. Capstone demo fixtures and tests.
>>>>>>> origin/vanson

## 9. Traceability to Architecture Modules

| Architecture Module | Covered By |
|---|---|
<<<<<<< HEAD
| `github-connector` | UC-01, UC-02, UC-03, UC-07, Epic E2 |
| `event-ingestion` | UC-08, Epic E7 |
| `normalization` | UC-04, UC-08, UC-20, Epic E2 |
| `metrics-engine` | UC-09, UC-10, UC-11, Epic E3 |
| `risk-rule-engine` | UC-12, UC-13, UC-14, Epic E4 |
| `evidence-card-service` | UC-15, UC-16, UC-17, Epic E4 |
| `recommendation-catalog` | UC-15, UC-16, Epic E4 |
| `ai-brief-service` | UC-17, UC-18, Epic E6 |
| `privacy-guardrails` | UC-17, UC-19, Epic E6 |
| `dashboard-api` | UC-05, UC-06, UC-11, UC-12, UC-14, UC-16, UC-17, Epic E5 |
=======
| `github-connector` | UC-01, UC-02, UC-05, Epic E2 |
| `event-ingestion` | UC-06, Epic E8 |
| `normalization` | UC-03, UC-06, UC-20, Epic E2 |
| `dataset-pipeline` | UC-07, Epic E4 |
| `ml-training-pipeline` | UC-08, Epic E4 |
| `ml-prediction-service` | UC-09, UC-12, UC-15, Epic E4 |
| `metrics-engine` | UC-10, UC-11, Epic E3 |
| `risk-rule-engine` | UC-13, UC-14, Epic E5 |
| `evidence-card-service` | UC-15, UC-16, UC-17, Epic E5 |
| `recommendation-catalog` | UC-15, UC-16, Epic E5 |
| `ai-brief-service` | UC-17, UC-18, Epic E7 |
| `privacy-guardrails` | UC-17, UC-19, Epic E7 |
| `dashboard-api` | UC-04, UC-11, UC-12, UC-14, UC-16, UC-17, Epic E6 |
>>>>>>> origin/vanson
