# Phân công use case cho nhóm 5 người

## 1. Mô hình phân chia

Nhóm được chia theo **vertical slice**: mỗi thành viên phải thực hiện đầy đủ UI, API và business logic cho nhóm use case của mình. Không có một người chỉ làm frontend hoặc chỉ làm backend.

Database là phần sở hữu chung của cả nhóm:

- Cả 5 người cùng thiết kế schema, index, quan hệ collection, seed data và migration.
- Mỗi thay đổi database có một người trực tiếp triển khai, nhưng phải được ít nhất hai thành viên khác review.
- Không có hai pull request database được merge cùng lúc.
- Business logic vẫn nằm trong module tính năng, không đặt trong model hoặc controller dùng chung.

Quy đổi khối lượng tham khảo: Hard = 3 điểm, Medium = 2 điểm, Easy = 1 điểm.

## 2. Phân công use case

| Thành viên | Nhóm tính năng | Use case | Điểm | UI bắt buộc |
|---|---|---|---:|---|
| Vân Anh | Repository Connection & Sync | UC-01, UC-02, UC-05, UC-06 | 11 | Connect Repository, Sync Now, tiến trình sync và trạng thái webhook |
| Văn Sơn | Data Import & Evidence | UC-03, UC-15, UC-16, UC-20 | 10 | Import dữ liệu mẫu, kết quả validation, danh sách và chi tiết Evidence Card |
| Hoàng Việt | PR Delay Machine Learning | UC-07, UC-08, UC-09, UC-12 | 11 | Trạng thái model, kết quả đánh giá, danh sách dự đoán và chi tiết PR có rủi ro |
| Diểm Vi | Metrics & Delivery Risk | UC-10, UC-11, UC-13, UC-14 | 10 | Team Flow Dashboard, KPI cards, Risk Summary và Rulebook |
| Anh Quân | Data Quality, AI Brief & Privacy | UC-04, UC-17, UC-18, UC-19 | 7 + 4 điểm shared | Data Quality panel, AI Weekly Brief, fallback state và Privacy Settings |

Anh Quân có điểm use case thấp hơn nhưng nhận thêm 4 điểm quy đổi cho shared UI foundation, accessibility, responsive layout và tích hợp navigation/E2E. Tổng tải ước lượng của năm người lần lượt là 11, 10, 11, 10 và 11 điểm.

## 3. Trách nhiệm full-stack của từng người

### Vân Anh - Repository Connection & Sync

- UI: Connect Repository, Sync Now, sync progress, webhook status.
- Backend: GitHub connection, initial backfill, polling và webhook receiver.
- Database chung: đề xuất fields/index cho `repositories`, `githubConnections`, `syncRuns`, `syncJobs`, `webhookEvents`.
- Contract cung cấp: `RepositoryConnection`, `SyncRequest`, `SyncStatus`.

### Văn Sơn - Data Import & Evidence

- UI: upload JSON/CSV, validation result, Evidence Card list/detail.
- Backend: normalization, sample import, Evidence Card generation và query.
- Database chung: đề xuất fields/index cho GitHub entities và `evidenceCards`.
- Contract cung cấp: `ImportResult`, normalized entity DTO, `EvidenceCard`.

### Hoàng Việt - PR Delay Machine Learning

- UI: model availability/evaluation, prediction list, risk filter và PR prediction detail.
- Backend: dataset pipeline, training/evaluation, inference và prediction API.
- Database chung: đề xuất fields/index cho `modelVersions` và `prDelayPredictions`.
- Contract cung cấp: `ModelStatus`, `PredictionRequest`, `PredictionResult`.

### Diểm Vi - Metrics & Delivery Risk

- UI: dashboard KPI, bottleneck cards, Delivery Flow Risk và Rulebook.
- Backend: metrics engine, R1-R5 rule engine và recommendation catalog.
- Database chung: đề xuất fields/index cho `metricSnapshots`, `flowRules`, `riskEvents` và `recommendations`.
- Contract cung cấp: `DashboardSummary`, `RiskEvent`, `RulebookItem`.

### Anh Quân - Data Quality, AI Brief & Privacy

- UI: data quality warnings, Weekly Brief, fallback label, privacy settings; đồng thời quản lý layout/navigation chung.
- Backend: data-quality aggregation, prompt payload, privacy redaction, AI brief và deterministic fallback.
- Database chung: đề xuất fields/index cho `users`, `dataQualityWarnings`, `privacySettings`, `aiBriefs`, `aiPromptLogs` và `auditEvents`.
- Contract cung cấp: `DataQualityReport`, `WeeklyBrief`, `PrivacySettings`.

## 4. Phân công backlog story

Các story database E1-S2 và E1-S3 là **Team Shared**. Các story còn lại có đúng một owner để tránh trùng trách nhiệm.

| Owner | Story |
|---|---|
| Team Shared - Database | E1-S2, E1-S3; mỗi sprint chỉ định một DB Coordinator triển khai, cả nhóm cùng thiết kế/review |
| Vân Anh | E1-S1; E2-S1, E2-S2, E2-S3; owner E6-S1; E8-S1, E8-S2, E8-S3 |
| Văn Sơn | E2-S4, E2-S6; E5-S4; owner E6-S3 |
| Hoàng Việt | E4-S1, E4-S2, E4-S3, E4-S4, E4-S5, E4-S6, E4-S7; contributor Prediction UI của E6-S2; E5-S6 |
| Diểm Vi | E3-S1, E3-S2, E3-S3, E3-S4, E3-S5; E5-S1, E5-S2, E5-S3, E5-S5; owner E6-S2 và E6-S4 |
| Anh Quân | E1-S4; E2-S5; E6-S5; E7-S1, E7-S2, E7-S3, E7-S4, E7-S5, E7-S6; E8-S4; E8-S5 E2E integration |

Các story UI tổng hợp vẫn có đúng một người accountable:

- E6-S1: Vân Anh là owner; Văn Sơn đóng góp Sample Import và Anh Quân đóng góp Data Quality panel.
- E6-S2: Diểm Vi là owner; Hoàng Việt đóng góp Prediction cards.
- E6-S3: Văn Sơn là owner; Diểm Vi đóng góp Risk Drivers và Hoàng Việt đóng góp Prediction Details.
- E8-S5: mỗi người viết test cho module của mình; Anh Quân chịu trách nhiệm ghép và chạy bộ E2E chung.

## 5. Quy trình làm database chung

1. Người phụ trách tính năng tạo database proposal gồm collection, fields, index và dữ liệu mẫu.
2. Cả nhóm review proposal trong một buổi ngắn trước khi code.
3. DB Coordinator luân phiên theo sprint; chỉ người này triển khai proposal trên branch `database/<feature>`.
4. Ít nhất hai người khác review pull request, trong đó có một consumer của collection.
5. Merge database trước, sau đó các branch tính năng cập nhật từ `main`.
6. Không sửa trực tiếp schema từ branch UI/API nếu proposal chưa được duyệt.

Lịch DB Coordinator đề xuất: Sprint 1 - Văn Sơn; Sprint 2 - Vân Anh; Sprint 3 - Diểm Vi; Sprint 4 - Hoàng Việt; Sprint 5 - Anh Quân; Sprint 6 quay lại Văn Sơn.

Database Definition of Done:

- Có validation và default value rõ ràng.
- Có unique/query index cần thiết.
- Có seed hoặc fixture tối thiểu.
- Có kiểm tra duplicate/idempotency.
- Không lưu raw source code hoặc raw comment body mặc định.
- Thay đổi breaking phải có migration hoặc backward-compatible period.

## 6. Quy tắc tránh xung đột UI

- Anh Quân tạo app shell, routing, theme và component primitives trong Sprint 1.
- Mỗi thành viên chỉ sở hữu page/component thuộc nhóm tính năng của mình.
- Component dùng chung được đề xuất qua pull request riêng; không tự sửa component shared trong feature PR.
- Anh Quân review thay đổi app shell/shared component; owner của tính năng vẫn tự xây UI page của mình.
- Route registry và API client chỉ được thay đổi qua pull request nhỏ, merge trước feature UI để tránh nhiều người sửa cùng file.
- UI không tự tính metric, prediction hoặc risk; chỉ render contract từ backend.
- Mỗi tính năng phải có loading, empty, partial-data và error state.

## 7. Contract phải chốt trong Sprint 1

1. Vân Anh: `RepositoryConnection`, `SyncStatus`.
2. Văn Sơn: normalized entity DTO, `ImportResult`, `EvidenceCard`.
3. Hoàng Việt: `ModelStatus`, `PredictionResult`.
4. Diểm Vi: `DashboardSummary`, `RiskEvent`, `RulebookItem`.
5. Anh Quân: `DataQualityReport`, `WeeklyBrief`, `PrivacySettings`, API error format.

Thay đổi contract phải được cả provider và consumer review. Mock JSON phải được tạo cùng contract để các thành viên phát triển UI và backend song song.

## 8. Thứ tự tích hợp

1. Cả nhóm hoàn thành database foundation và contract; Anh Quân hoàn thành UI foundation.
2. Vân Anh và Văn Sơn hoàn thành connect/import đến normalized MongoDB.
3. Hoàng Việt và Diểm Vi phát triển từ fixture; tất cả thành viên làm UI từ mock API của chính tính năng.
4. Tích hợp metrics và rule-based risk trước, sau đó tích hợp ML prediction.
5. Tích hợp Evidence Card trước AI Weekly Brief.
6. Sample import, Sync Now và deterministic brief fallback phải hoạt động trước khi demo webhook hoặc AI thật.

## 9. Ma trận truy vết Use Case - Story - Collection

| Use case | Owner | Story chính | Collection chính |
|---|---|---|---|
| UC-01 | Vân Anh | E2-S1, E6-S1 | `users`, `githubConnections`, `repositories`, `auditEvents` |
| UC-02 | Vân Anh | E2-S2 | `syncJobs`, `syncRuns`, `pullRequests` |
| UC-03 | Văn Sơn | E1-S2; normalization in E2-S2, E2-S3, E2-S4 | `contributors`, `pullRequests`, `reviews`, `reviewRequests`, `issues`, `commits`, `checkRuns` |
| UC-04 | Anh Quân | E2-S5; contributor E6-S1 | `syncRuns`, `dataQualityWarnings` |
| UC-05 | Vân Anh | E8-S2, E6-S1 | `syncJobs`, `syncRuns` |
| UC-06 | Vân Anh | E8-S1, E8-S3 | `webhookEvents`, `syncJobs`, normalized GitHub collections |
| UC-07 | Hoàng Việt | E4-S1, E4-S2 | `pullRequests`, `reviews`, `checkRuns` |
| UC-08 | Hoàng Việt | E4-S3, E4-S4, E4-S5 | `modelVersions` |
| UC-09 | Hoàng Việt | E4-S6, E4-S7 | `modelVersions`, `prDelayPredictions` |
| UC-10 | Diểm Vi | E3-S1, E3-S2, E3-S3, E3-S4, E3-S5 | `pullRequests`, `reviews`, `checkRuns`, `metricSnapshots` |
| UC-11 | Diểm Vi | E6-S2 | `repositories`, `syncRuns`, `metricSnapshots`, `prDelayPredictions`, `riskEvents` |
| UC-12 | Hoàng Việt | E4-S6, E4-S7; contributor E6-S2/E6-S3 | `pullRequests`, `prDelayPredictions`, `evidenceCards` |
| UC-13 | Diểm Vi | E5-S1, E5-S2, E5-S3, E5-S5 | `metricSnapshots`, `flowRules`, `riskEvents`, `recommendations` |
| UC-14 | Diểm Vi | E6-S4 | `flowRules`, `recommendations` |
| UC-15 | Văn Sơn | E5-S4, E5-S6 | `riskEvents`, `prDelayPredictions`, `recommendations`, `evidenceCards` |
| UC-16 | Văn Sơn | E6-S3 | `evidenceCards`, normalized GitHub collections |
| UC-17 | Anh Quân | E7-S1, E7-S2, E7-S3, E7-S5 | `privacySettings`, `metricSnapshots`, `prDelayPredictions`, `evidenceCards`, `aiBriefs`, `aiPromptLogs` |
| UC-18 | Anh Quân | E7-S4 | `prDelayPredictions`, `evidenceCards`, `aiBriefs` |
| UC-19 | Anh Quân | E7-S2, E7-S6 | `privacySettings`, `contributors`, `aiPromptLogs`, `auditEvents` |
| UC-20 | Văn Sơn | E2-S6 | normalized GitHub collections, `syncRuns`, `dataQualityWarnings` |

Mỗi thay đổi use case phải cập nhật đồng thời owner, story và collection trong ma trận này, sau đó phản ánh sang backlog và database design.
