---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-Github-jira-tracking-2026-05-19/prd.md"
  - "_bmad-output/planning-artifacts/research/ai-software-team-behavior-tracking-mvp-research-2026-05-19.md"
  - "_bmad-output/planning-artifacts/research/market-ai-powered-software-team-behavior-tracking-github-jira-research-2026-05-19.md"
workflowType: "architecture"
project_name: "Github-jira tracking"
product_name: "AI Engineering Flow Intelligence for GitHub"
user_name: "viethoangkt"
date: "2026-05-19"
status: "complete-draft"
architecture_direction: "GitHub-only MVP; Jira deferred to Later"
---

# Architecture Decision Document: AI Engineering Flow Intelligence for GitHub

## 1. Executive Summary

MVP sẽ là một **full-stack web app dạng modular monolith** để phân tích workflow activity từ một GitHub repository. Một người đại diện kết nối repository, hệ thống backfill dữ liệu lịch sử qua GitHub API, nhận cập nhật mới bằng webhook hoặc polling fallback, tính KPI/risk rules, tạo Evidence Cards, và sinh AI Weekly Brief có bằng chứng.

Quyết định quan trọng:

- **GitHub-only MVP.** Jira chuyển sang Later để giảm rủi ro tích hợp và tránh claim sai về sprint analytics.
- **Modular monolith.** Đủ đơn giản cho capstone, nhưng module boundary rõ để mở rộng sau.
- **MongoDB là source of truth.** Lưu normalized GitHub entities, webhook events, metrics, model versions, PR-delay predictions, risk events, evidence cards và AI briefs bằng document collections có indexes rõ ràng.
- **Rule-based engine trước ML.** Mọi risk phải giải thích được bằng rule, threshold, metric và evidence.
- **AI là synthesis layer.** AI chỉ đọc structured summaries/Evidence Cards, không đọc raw code hay raw sensitive text mặc định.
- **Privacy-safe by design.** Không individual productivity score, không ranking developer, có pseudonymization và minimum group threshold.

## 2. Architecture Goals and Non-Goals

### Goals

- Cho phép kết nối một GitHub repository thật hoặc dùng sample import fallback.
- Backfill PRs, reviews, issues, commits metadata, checks trong cửa sổ 30-90 ngày.
- Nhận event mới qua GitHub webhook, với polling hoặc Sync now fallback.
- Tính KPI: PR cycle time, review pickup time, review turnaround, merge time, stale PR count, failed check rate, oversized PR count, review load concentration.
- Tính Delivery Flow Risk bằng Flow Risk Rulebook R1-R5.
- Tạo Evidence Cards cho mỗi risk/insight.
- Tạo AI Weekly Brief có evidence, confidence, limitations, recommended actions.
- Bảo vệ quyền riêng tư và tránh surveillance framing.

### Non-Goals

- Không tích hợp Jira trong MVP.
- Không đo sprint commitment, story point, sprint carryover, Jira status transition.
- Không clone source code.
- Không phân tích raw code.
- Không tạo individual productivity score.
- Không dùng insight cho HR/performance review.
- Không cần enterprise-grade RBAC/SOC2/audit immutability trong capstone.

## 3. Recommended Tech Stack

### Frontend

- **ReactJS + Vite + TypeScript**
- Charting: **Recharts** hoặc **ECharts**
- UI: Tailwind CSS + component primitives
- Auth UI: basic session login for capstone

### Backend

- **Node.js + Express.js + TypeScript**
- REST API first; GraphQL không cần cho MVP.
- Modular monolith with clear module boundaries:
  - `github-connector`
  - `event-ingestion`
  - `normalization`
  - `metrics-engine`
  - `risk-rule-engine`
  - `evidence-card-service`
  - `recommendation-catalog`
  - `ai-brief-service`
  - `privacy-guardrails`
  - `dashboard-api`

### Data and Jobs

- Database: **MongoDB**
- ODM: **Mongoose**
- Background jobs: **node-cron + MongoDB `syncJobs` collection** for capstone.
- Later option: **BullMQ + Redis** if the team wants stronger background job reliability.

### AI

- OpenAI-compatible LLM API for AI Weekly Brief.
- Deterministic template fallback if AI API is unavailable.
- AI prompt input must be structured summaries/Evidence Cards only.

### Why this stack

- One language across frontend/backend reduces capstone friction.
- MongoDB matches the required project stack and fits webhook/event-style documents well.
- Mongoose gives schema validation without forcing a relational model.
- Modular monolith avoids premature microservices while preserving clean boundaries.
- `node-cron` + MongoDB job records is enough for capstone polling/sync; Redis can be deferred.

## 4. High-Level System Architecture

```text
User Browser
    |
    v
ReactJS Web App
    |
    v
Node.js Express API / Dashboard API
    |
    +--> Auth Module
    +--> GitHub Connector
    +--> Sync Orchestrator
    +--> Webhook Receiver
    +--> Normalization Service
    +--> Metrics Engine
    +--> Risk Rule Engine
    +--> Evidence Card Service
    +--> AI Brief Service
    +--> Privacy Guardrails
    |
    v
MongoDB
    |
    +--> normalized GitHub entities
    +--> webhook events
    +--> metric snapshots
    +--> risk events
    +--> evidence cards
    +--> AI briefs

Optional:
node-cron for polling/sync jobs; BullMQ/Redis later if needed
```

## 5. Core Data Flows

### 5.1 Repository Connection Flow

```text
User selects Connect GitHub
-> GitHub App/OAuth/token flow
-> Store connection metadata and encrypted token/installation id
-> Create repository record
-> Queue initial backfill job
-> Show sync status
```

Recommended capstone choice:

- Best product shape: **GitHub App**
- Fastest capstone path: **personal access token or mocked connector**
- Acceptable fallback: sample JSON/CSV import

### 5.2 Initial Backfill Flow

```text
Backfill job starts
-> Fetch repository metadata
-> Fetch pull requests in backfill window
-> Fetch reviews per PR
-> Fetch issue records if enabled
-> Fetch commits metadata per PR
-> Fetch check runs/check suites if available
-> Normalize into database
-> Compute metric snapshots
-> Run risk rules
-> Generate evidence cards
-> Mark sync_run complete/partial/failed
```

Backfill should be incremental and resumable. Do not block the UI while sync runs.

### 5.3 Webhook Ingestion Flow

```text
GitHub sends webhook
-> Verify signature
-> Store raw event envelope
-> Deduplicate by delivery id
-> Normalize affected entity
-> Recompute impacted metrics
-> Re-run relevant risk rules
-> Update evidence cards
```

If webhook is not feasible:

```text
Scheduled polling / Sync now
-> Fetch changed PRs/issues/checks since last sync
-> Normalize changes
-> Recompute affected metrics and risks
```

### 5.4 AI Weekly Brief Flow

```text
User clicks Generate Brief
-> Backend selects current metrics, risk events, evidence cards
-> Privacy guardrails redact contributor names if enabled
-> Build structured prompt payload
-> Call AI service
-> Validate AI output has evidence references
-> Save AI brief and items
-> Return brief to UI
```

If AI fails, use deterministic template:

```text
Top risks + evidence cards + recommendations + limitations
```

## 6. Backend Module Design

### 6.1 `github-connector`

Responsibilities:

- Manage repository connection state.
- Store GitHub installation/token metadata.
- Call GitHub REST API for PRs, reviews, issues, commits metadata, checks.
- Respect GitHub API rate limits and retry transient failures.
- Expose sync coverage and missing permission warnings.

Key services:

- `GitHubAuthService`
- `GitHubApiClient`
- `GitHubBackfillService`
- `GitHubConnectionService`

### 6.2 `event-ingestion`

Responsibilities:

- Receive GitHub webhooks.
- Verify webhook signature.
- Store webhook event envelope.
- Deduplicate events.
- Dispatch normalization jobs.

Key services:

- `WebhookController`
- `WebhookSignatureVerifier`
- `WebhookEventStore`
- `WebhookDispatcher`

### 6.3 `normalization`

Responsibilities:

- Convert GitHub API/webhook payloads into stable internal entities.
- Use source IDs and repository ID for idempotency.
- Avoid storing raw code.
- Avoid storing raw comment/body text unless explicitly enabled later.

Key normalized entities:

- repository
- contributor
- pull_request
- review
- issue
- commit
- check_run
- webhook_event

### 6.4 `metrics-engine`

Responsibilities:

- Calculate flow KPIs over repository + analysis window.
- Store metric snapshots for repeatable UI/brief generation.
- Support current value and baseline comparison.

Core metrics:

- PR cycle time: PR opened -> merged/closed.
- Review pickup time: PR ready/opened -> first review submitted.
- Review turnaround time: review requested -> review submitted where available.
- Merge time: PR opened -> merged.
- Stale PR count: open PR age > configured threshold.
- Failed check rate: failed checks / total completed checks.
- Oversized PR count: changed_files/additions/deletions > thresholds.
- Review load concentration: top reviewers share of review count.

### 6.5 `risk-rule-engine`

Responsibilities:

- Evaluate Flow Risk Rulebook.
- Generate risk events with rule ID, severity, metric values, thresholds, and affected entities.
- Return insufficient-data state where needed.

MVP Rulebook:

| Rule | Trigger | Severity guidance | Evidence |
|---|---|---|---|
| R1 Stale PR Risk | Open PR age > threshold | medium/high by age/count | PR records |
| R2 Review Pickup Risk | First review wait > threshold/baseline | medium/high by delay | PR + review records |
| R3 Reviewer Concentration Risk | Top 2 reviewers handle > threshold share | medium/high by concentration | review records |
| R4 CI Friction Risk | Failed check rate > threshold | medium/high by failed checks | check_run records |
| R5 Oversized PR Risk | changed_files/additions/deletions > threshold | medium/high by size | PR records |

### 6.6 `evidence-card-service`

Responsibilities:

- Convert risk events into displayable Evidence Cards.
- Attach source records and safe recommendations.
- Suppress cards with no evidence.

Evidence Card shape:

```json
{
  "title": "Review bottleneck increased this week",
  "severity": "high",
  "metricDelta": "Median review pickup time increased from 9h to 28h",
  "evidence": [
    {"type": "pull_request", "sourceId": "PR#42", "label": "Waited 38h for first review"}
  ],
  "suggestedAction": "Assign backup reviewer for stale PRs",
  "confidence": "medium",
  "limitation": "Only GitHub PR/review data was analyzed"
}
```

### 6.7 `recommendation-catalog`

Responsibilities:

- Map rule IDs to safe process recommendations.
- Avoid HR/performance language.

Examples:

- R1 -> request update, convert to draft, close obsolete PR.
- R2 -> assign backup reviewer, set review SLA.
- R3 -> distribute review ownership, rotate reviewer.
- R4 -> inspect failed checks, rerun checks, prioritize CI fix.
- R5 -> split PR, request focused review.

### 6.8 `ai-brief-service`

Responsibilities:

- Build structured prompt payload from metrics, risk events, and Evidence Cards.
- Apply privacy redaction.
- Call LLM provider or deterministic fallback.
- Validate output references evidence.
- Store brief and brief items.

Guardrails:

- No raw source code.
- No raw PR/issue/comment bodies by default.
- No unsupported claims.
- No individual ranking or diagnosis.
- Include confidence and limitations.

### 6.9 `privacy-guardrails`

Responsibilities:

- Pseudonymize contributor names.
- Enforce minimum group threshold.
- Block individual productivity score endpoints.
- Redact prompt payload.
- Provide privacy/prohibited-use notice text to UI.

### 6.10 `dashboard-api`

Responsibilities:

- Serve dashboard summaries.
- Serve risk and evidence details.
- Serve sync status and data quality warnings.
- Serve AI brief data.

## 7. Frontend Architecture

### 7.1 Page Structure

```text
/connect
  GitHub connection, sync status, sample import fallback

/dashboard
  repository overview, KPIs, Delivery Flow Risk, bottleneck cards

/risk
  risk drivers, Flow Risk Rulebook, Evidence Cards, affected records

/brief
  AI Weekly Brief generation, output, evidence, limitations

/privacy
  data collected, AI prompt policy, no-HR-use notice, pseudonymization
```

### 7.2 Key UI Components

- `RepositoryConnectionPanel`
- `SyncStatusTimeline`
- `DataQualityBanner`
- `KpiCard`
- `FlowRiskBadge`
- `BottleneckCard`
- `EvidenceCard`
- `RulebookTable`
- `RecommendationList`
- `AiBriefPanel`
- `PromptPayloadPreview`
- `PrivacyNoticePanel`

### 7.3 UI Principles

- No individual ranking tables.
- Contributor names masked by default in AI/prompt surfaces.
- Risk statuses use text + color, never color alone.
- Every insight links to evidence.
- If data is missing, show limitation instead of empty confidence.

## 8. MongoDB Data Model

MongoDB collections should stay normalized enough for analytics, but flexible enough for GitHub webhook payloads and evidence cards. Use `ObjectId` references for high-cardinality relationships and embedded subdocuments for display-ready payloads.

### 8.1 Identity and Connection Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | Local app users | `_id`, `email`, `name`, `role`, `createdAt` |
| `githubConnections` | GitHub auth/installation metadata | `_id`, `userId`, `providerType`, `installationId`, `tokenEncrypted`, `status`, `createdAt`, `revokedAt` |
| `repositories` | Connected repositories | `_id`, `connectionId`, `githubRepoId`, `owner`, `name`, `fullName`, `defaultBranch`, `isPrivate`, `lastSyncedAt` |
| `privacySettings` | Per-repository privacy controls | `_id`, `repositoryId`, `pseudonymizeContributors`, `minimumGroupSize`, `allowRawTextForAi`, `createdAt` |

### 8.2 GitHub Entity Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `contributors` | GitHub users normalized per repository | `_id`, `repositoryId`, `githubUserId`, `loginHash`, `displayNameMasked`, `avatarUrlHash` |
| `pullRequests` | PR metadata | `_id`, `repositoryId`, `githubPrId`, `number`, `title`, `state`, `isDraft`, `authorId`, `createdAt`, `readyForReviewAt`, `mergedAt`, `closedAt`, `additions`, `deletions`, `changedFiles` |
| `reviews` | PR review metadata | `_id`, `repositoryId`, `pullRequestId`, `githubReviewId`, `reviewerId`, `state`, `submittedAt` |
| `reviewRequests` | Requested reviewers | `_id`, `repositoryId`, `pullRequestId`, `requestedReviewerId`, `requestedAt`, `removedAt` |
| `issues` | GitHub issue metadata | `_id`, `repositoryId`, `githubIssueId`, `number`, `title`, `state`, `authorId`, `createdAt`, `closedAt`, `labels` |
| `commits` | Commit metadata only | `_id`, `repositoryId`, `githubSha`, `authorId`, `committedAt`, `pullRequestId` |
| `checkRuns` | CI/check status | `_id`, `repositoryId`, `pullRequestId`, `githubCheckId`, `name`, `status`, `conclusion`, `startedAt`, `completedAt` |

### 8.3 Sync and Event Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `syncRuns` | Backfill/polling job tracking | `_id`, `repositoryId`, `type`, `status`, `startedAt`, `finishedAt`, `recordsProcessed`, `warnings`, `errorMessage` |
| `syncJobs` | Lightweight job queue for capstone | `_id`, `repositoryId`, `jobType`, `status`, `runAfter`, `attempts`, `lockedAt`, `payload`, `createdAt` |
| `webhookEvents` | Event envelope for dedupe/audit | `_id`, `repositoryId`, `githubDeliveryId`, `eventType`, `action`, `receivedAt`, `processedAt`, `status`, `payloadHash`, `payload` |
| `dataQualityWarnings` | Data quality issues | `_id`, `repositoryId`, `syncRunId`, `warningType`, `severity`, `message`, `createdAt` |

### 8.4 Analytics Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `metricSnapshots` | KPI values by window | `_id`, `repositoryId`, `windowStart`, `windowEnd`, `metricKey`, `metricValue`, `baselineValue`, `computedAt` |
| `modelVersions` | Trained PR-delay model versions | `_id`, `version`, `algorithm`, `artifactPath`, `featureSchemaPath`, `evaluationMetrics`, `status`, `trainedAt`, `createdAt` |
| `prDelayPredictions` | Per-PR delay prediction results | `_id`, `repositoryId`, `pullRequestId`, `modelVersionId`, `probability`, `riskLabel`, `featureSummary`, `predictedAt` |
| `flowRules` | Configurable rulebook | `_id`, `ruleCode`, `name`, `description`, `enabled`, `threshold`, `severityLogic` |
| `riskEvents` | Rule outputs | `_id`, `repositoryId`, `ruleCode`, `severity`, `status`, `metricValue`, `thresholdValue`, `windowStart`, `windowEnd`, `affectedEntityRefs`, `createdAt` |
| `evidenceCards` | Display-ready rule/prediction insight cards | `_id`, `repositoryId`, `riskEventId`, `predictionId`, `sourceType`, `title`, `severity`, `summary`, `suggestedAction`, `confidence`, `limitation`, `evidence`, `createdAt` |
| `recommendations` | Recommendation catalog | `_id`, `ruleCode`, `actionCode`, `title`, `description`, `safeLanguage` |

Recommended `evidenceCards.evidence` embedded shape:

```json
[
  {
    "entityType": "pull_request",
    "entityId": "ObjectId",
    "sourceLabel": "PR #42",
    "sourceUrl": "https://github.com/org/repo/pull/42",
    "summary": "Waited 38h for first review"
  }
]
```

### 8.5 AI Brief and Audit Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `aiBriefs` | Generated weekly briefs | `_id`, `repositoryId`, `windowStart`, `windowEnd`, `status`, `summary`, `confidence`, `limitations`, `items`, `createdBy`, `createdAt` |
| `aiPromptLogs` | Capstone/debug prompt transparency | `_id`, `briefId`, `promptPayload`, `redactionApplied`, `modelName`, `createdAt` |
| `auditEvents` | Basic product audit | `_id`, `userId`, `repositoryId`, `action`, `metadata`, `createdAt` |

Recommended `aiBriefs.items` embedded shape:

```json
[
  {
    "itemType": "risk",
    "title": "Review pickup delay increased",
    "body": "Median review pickup time increased from 9h to 28h.",
    "evidenceCardId": "ObjectId",
    "recommendationId": "ObjectId"
  }
]
```

### 8.6 MongoDB Indexes

Unique indexes:

- `repositories.githubRepoId`
- `pullRequests: { repositoryId: 1, number: 1 }`
- `reviews.githubReviewId`
- `commits: { repositoryId: 1, githubSha: 1 }`
- `checkRuns.githubCheckId`
- `webhookEvents.githubDeliveryId`
- `metricSnapshots: { repositoryId: 1, windowStart: 1, windowEnd: 1, metricKey: 1 }`
- `modelVersions.version`
- `prDelayPredictions: { pullRequestId: 1, modelVersionId: 1 }`

Query indexes:

- `pullRequests: { repositoryId: 1, createdAt: -1 }`
- `pullRequests: { repositoryId: 1, state: 1 }`
- `pullRequests: { repositoryId: 1, mergedAt: -1 }`
- `reviews: { pullRequestId: 1, submittedAt: 1 }`
- `reviews: { repositoryId: 1, reviewerId: 1, submittedAt: -1 }`
- `checkRuns: { repositoryId: 1, completedAt: -1 }`
- `modelVersions: { status: 1, trainedAt: -1 }`
- `prDelayPredictions: { repositoryId: 1, riskLabel: 1, predictedAt: -1 }`
- `prDelayPredictions: { pullRequestId: 1, predictedAt: -1 }`
- `riskEvents: { repositoryId: 1, severity: 1, createdAt: -1 }`
- `evidenceCards: { repositoryId: 1, severity: 1, createdAt: -1 }`
- `syncJobs: { status: 1, runAfter: 1, lockedAt: 1 }`

## 9. GitHub API and Webhook Strategy

### 9.1 Minimal GitHub Data

Use only metadata needed for analytics:

- Repository metadata.
- Pull request metadata.
- Review metadata.
- Review request metadata where available.
- Issue metadata.
- Commit metadata.
- Check run/check suite metadata.
- Webhook event envelope.

Avoid by default:

- Raw source code.
- Full PR comment body.
- Full issue body.
- Secret logs or CI logs.

### 9.2 Permissions

For a GitHub App, prefer read-only repository permissions:

- Metadata: read.
- Pull requests: read.
- Issues: read.
- Checks: read.
- Contents: read only if needed for commit metadata endpoints; do not read file contents for MVP.

For capstone, if GitHub App setup is too heavy:

- Use a fine-grained personal access token against one demo repository.
- Document that GitHub App is the intended production path.

### 9.3 Rate Limits

Backfill must be paginated and rate-limit-aware:

- Store `last_synced_at`.
- Backfill by updated timestamps where feasible.
- Avoid search endpoints unless necessary.
- Retry transient 5xx errors.
- Treat rate limit as `partial sync` and resume later.

### 9.4 Webhook Events

MVP webhook subscriptions:

- `pull_request`
- `pull_request_review`
- `pull_request_review_comment` metadata only if needed
- `issues`
- `push`
- `check_run`
- `check_suite`

Webhook handling requirements:

- Verify signature.
- Deduplicate by delivery ID.
- Store event envelope.
- Process asynchronously.
- Recompute only impacted metrics where feasible.

## 10. Rule Engine Design

### Rule Configuration Shape

```json
{
  "ruleCode": "R1",
  "name": "Stale PR Risk",
  "enabled": true,
  "threshold": {
    "openAgeHoursMedium": 72,
    "openAgeHoursHigh": 120
  },
  "evidenceEntity": "pull_request",
  "recommendationCodes": ["REQUEST_UPDATE", "ASSIGN_BACKUP_REVIEWER", "CONVERT_DRAFT"]
}
```

### Evaluation Contract

Input:

- repository ID
- analysis window
- metric snapshots
- normalized entities
- privacy settings

Output:

- risk events
- evidence records
- evidence cards
- data limitations

### Insufficient Data

Rules must return `insufficient_data` if required entities are missing. Example:

- CI Friction Risk cannot run if checks permission is missing.
- Reviewer Concentration Risk cannot run if review data is unavailable.

## 11. Evidence Cards

Evidence Cards are the bridge between analytics and product trust. They are generated by backend, then reused by dashboard and AI brief.

### Evidence Card Lifecycle

```text
risk rule fires OR high-risk prediction is produced
-> risk_event or pr_delay_prediction selected
-> evidence records linked
-> recommendation selected
-> evidence_card created
-> card appears in Risk and Evidence
-> card becomes input to AI Weekly Brief
```

### Evidence Card Requirements

- Must link to at least one GitHub entity or source metric.
- Must include limitation.
- Must include confidence.
- Must not contain unsupported psychological or performance claims.
- Must use safe recommendation language.

## 12. AI Weekly Brief Architecture

### Prompt Input Contract

AI service receives structured JSON:

```json
{
  "repository": {"name": "owner/repo", "window": "last_7_days"},
  "metrics": [
    {"key": "median_review_pickup_hours", "value": 28, "baseline": 9}
  ],
  "predictions": [
    {"pullRequest": "#42", "probability": 0.82, "riskLabel": "High", "modelVersion": "v1"}
  ],
  "evidenceCards": [
    {
      "title": "Review pickup delay increased",
      "severity": "high",
      "evidence": ["PR #42 waited 38h for first review"],
      "suggestedAction": "Assign backup reviewer",
      "limitation": "Only GitHub PR/review data was analyzed"
    }
  ],
  "prohibitedClaims": [
    "individual productivity ranking",
    "burnout diagnosis",
    "HR recommendation"
  ]
}
```

### Output Contract

AI output must include:

- Executive summary.
- Top 3 risks.
- Evidence references.
- Recommended actions.
- Confidence.
- Limitations.

Backend validation must reject or suppress brief items without evidence references.

## 13. Privacy and Security Architecture

### Privacy Guardrails

- Pseudonymize contributor names in analytics and prompts when enabled.
- Hide contributor imbalance if contributor count < minimum group size.
- Do not expose ranking/sorting by "best/worst developer".
- Label commit count and PR count as context-only if shown.
- Use workflow language, not performance language.

### Security Controls

- Encrypt GitHub tokens at rest.
- Never log tokens.
- Verify webhook signatures.
- Deduplicate webhook delivery IDs.
- Use least-privilege GitHub permissions.
- Do not store raw code.
- Do not send raw code/comment bodies to AI.

### Audit for Capstone

Minimum audit events:

- repository connected
- sync started/completed/failed
- webhook received/processed/failed
- AI brief generated
- privacy settings changed

## 14. Backend API Surface

### Connection and Sync

- `POST /api/github/connect`
- `DELETE /api/github/connections/:id`
- `POST /api/repositories/:id/sync`
- `GET /api/repositories/:id/sync-status`
- `POST /api/webhooks/github`

### Dashboard

- `GET /api/repositories/:id/dashboard?window=7d`
- `GET /api/repositories/:id/metrics?window=7d`
- `GET /api/repositories/:id/data-quality`

### Risk and Evidence

- `GET /api/repositories/:id/risk?window=7d`
- `GET /api/repositories/:id/rules`
- `GET /api/repositories/:id/evidence-cards?window=7d`
- `GET /api/evidence-cards/:id`

### AI Brief

- `POST /api/repositories/:id/briefs`
- `GET /api/repositories/:id/briefs/latest`
- `GET /api/briefs/:id`
- `GET /api/briefs/:id/prompt-preview`

### Privacy

- `GET /api/repositories/:id/privacy-settings`
- `PATCH /api/repositories/:id/privacy-settings`

## 15. Deployment Architecture

### Capstone Local/Cloud Setup

```text
ReactJS app
Node.js Express API
MongoDB
node-cron worker in API process or separate worker process
ngrok/cloudflared for webhook demo if local
OpenAI-compatible AI provider optional
```

Recommended capstone deployment:

- Frontend + backend on a single platform or VM.
- MongoDB Atlas or Docker Compose MongoDB.
- Use ngrok/cloudflared for webhook demo if running locally.
- Provide sample import if webhook endpoint is unavailable.

### Docker Compose Services

- `web`
- `api`
- `mongo`
- `worker` optional if jobs are separated

## 16. Testing Strategy

### Unit Tests

- Metrics calculations.
- Rule engine thresholds.
- Recommendation mapping.
- Privacy redaction.
- Webhook signature verification.

### Integration Tests

- GitHub API sync with mocked GitHub responses.
- Webhook event ingestion and dedupe.
- Evidence Card generation.
- AI brief deterministic fallback.

### Capstone Evaluation Tests

- Rule accuracy test: each R1-R5 has trigger and non-trigger fixture.
- Evidence coverage test: every displayed insight has evidence.
- Privacy guardrail test: no individual ranking screen/output.
- AI hallucination test: insight without evidence is suppressed.
- Webhook/polling test: new event updates dashboard metrics.
- Data quality test: missing permissions/fields create warnings.

## 17. Implementation Phasing

### Phase 1: Data Foundation

- Database schema.
- Sample import.
- Normalization.
- Basic dashboard with static seeded data.

### Phase 2: GitHub Sync

- GitHub connection.
- Backfill PRs/reviews/issues/checks.
- Sync status and data quality warnings.

### Phase 3: Metrics and Risk

- KPI engine.
- Flow Risk Rulebook R1-R5.
- Risk events and Evidence Cards.

### Phase 4: AI and Privacy

- AI Weekly Brief.
- Prompt redaction.
- Privacy settings.
- Prohibited-use notice.

### Phase 5: Webhook/Polling Demo

- Webhook receiver or polling fallback.
- Simulated event update.
- Final demo script.

## 18. Key Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| MVP integration scope | GitHub-only | Reduces complexity and avoids Jira sprint overclaiming |
| Architecture style | Modular monolith | Fast to build, easier to test, clear module boundaries |
| Database | MongoDB + Mongoose | Required project stack; flexible event and evidence documents |
| Backend | Node.js + Express.js + TypeScript | Required project stack; simple modular backend for capstone |
| Frontend | ReactJS + Vite + TypeScript | Required project stack; practical dashboard development |
| Sync strategy | API backfill + webhook/polling | History plus new event updates |
| Risk model | Rule-based | Explainable and testable |
| AI role | Evidence-based synthesis | Prevents hallucinated operational claims |
| Privacy posture | Team/repo-level analytics | Avoids surveillance/productivity scoring |

## 19. Open Technical Questions

1. Will capstone use GitHub App, OAuth app, fine-grained personal access token, or mocked connector?
2. Should webhook demo use public tunnel, hosted backend, or simulated webhook payload?
3. What exact thresholds should R1-R5 use for demo data?
4. Should contributor names be masked by default in all screens or only AI/prompt surfaces?
5. Will AI Weekly Brief be generated by hosted LLM API or deterministic fallback for demo reliability?
6. Should sync jobs run inside the API process with node-cron or as a separate worker process?

## 20. References

- GitHub REST API documentation: https://docs.github.com/en/rest
- GitHub webhook events and payloads: https://docs.github.com/en/webhooks/webhook-events-and-payloads
- GitHub App permissions: https://docs.github.com/en/rest/reference/permissions-required-for-github-apps
- GitHub REST API rate limits: https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api
