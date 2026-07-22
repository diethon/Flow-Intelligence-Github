# Phân công công việc chi tiết cho nhóm 5 thành viên

## 1. Mục tiêu chung

Nhóm xây dựng MVP **AI Engineering Flow Intelligence for GitHub** theo luồng:

`Kết nối/import GitHub -> chuẩn hóa dữ liệu -> tính metrics -> đánh giá risk/ML -> tạo Evidence Card -> hiển thị Dashboard -> tạo Weekly Brief`.

Mỗi thành viên chịu trách nhiệm full-stack cho phạm vi được giao. Một đầu việc chỉ có một owner chính; người khác có thể hỗ trợ nhưng owner chịu trách nhiệm tích hợp, kiểm thử và demo.

## 2. Quy tắc làm việc chung

- Mỗi người tạo branch theo mẫu `feature/<story-id>-<ten-ngan>`.
- Mỗi story phải có API hoặc UI chạy được, dữ liệu mẫu và test phù hợp.
- API owner phải cung cấp contract và mock JSON trước khi UI tích hợp.
- Không tự ý sửa schema hoặc shared component trong feature branch.
- Thay đổi database phải qua DB Coordinator và ít nhất hai người review.
- PR phải ghi rõ story, cách kiểm thử và ảnh/chứng cứ kết quả.
- Story chỉ được tính `done` sau khi merge và chạy được trong luồng chung.

## 3. Vân Anh - GitHub Connection & Sync

### Trách nhiệm chính

Đưa dữ liệu từ GitHub vào hệ thống và giữ dữ liệu được cập nhật.

### Công việc phải làm

- **E1-S1:** Khởi tạo React, Express và TypeScript; cấu hình môi trường; tạo health API.
- **E2-S1:** Làm API kết nối GitHub repository và kiểm tra token/quyền truy cập.
- **E2-S2:** Backfill pull request trong khoảng thời gian cấu hình.
- **E2-S3:** Đồng bộ reviews và review requests, liên kết đúng với PR.
- **E6-S1:** Làm trang Connect/Import/Sync Status.
- **E8-S1:** Nhận webhook GitHub, kiểm tra signature và chống xử lý trùng delivery.
- **E8-S2:** Làm chức năng `Sync now` bằng polling.
- **E8-S3:** Gọi lại metrics, prediction, risk và Evidence Card sau khi dữ liệu thay đổi.

### Sản phẩm phải bàn giao

- API `POST /api/github/connect`.
- API chạy sync và API đọc sync status.
- Endpoint webhook GitHub.
- `RepositoryConnection`, `SyncRequest`, `SyncStatus` contract.
- Mock `repository-connection.json` và `sync-status.json`.
- Trang Connect hiển thị running, success, partial và failed.

### Phối hợp

- Gửi payload GitHub mẫu cho Văn Sơn chuẩn hóa và lưu database.
- Gửi trạng thái sync cho Anh Quân dùng trong shared UI state.
- Gọi service của Hoàng Việt và Diểm Vi khi cần recompute analytics.

### Được tính là hoàn thành khi

- Có thể kết nối hoặc dùng mock token.
- Backfill tạo được dữ liệu PR/review không trùng.
- `Sync now` cập nhật được dữ liệu mới.
- Webhook trùng delivery ID không tạo dữ liệu trùng.
- Trang Connect hiển thị đúng trạng thái và lỗi quyền truy cập.

## 4. Văn Sơn - Data Import & Evidence

### Trách nhiệm chính

Chuẩn hóa dữ liệu GitHub, hỗ trợ import dữ liệu demo và cung cấp Evidence Card.

### Công việc phải làm

- **E1-S2, E1-S3 cùng nhóm:** Thiết kế schema, validation và index MongoDB; trong Sprint 1 là DB Coordinator.
- **E2-S4:** Đồng bộ issues, commits metadata và check runs; không lưu raw code/raw body mặc định.
- **E2-S6:** Import JSON/CSV mẫu, validate và upsert vào collection chuẩn hóa.
- **E5-S4:** Sinh và lưu Evidence Card từ risk event hoặc prediction có rủi ro cao.
- **E6-S3:** Làm trang Risk & Evidence và chi tiết Evidence Card.

### Sản phẩm phải bàn giao

- Schema/fixture cho GitHub entities và `evidenceCards`.
- API import JSON/CSV và kết quả validation.
- API danh sách/chi tiết Evidence Card.
- `ImportResult`, normalized entity DTO và `EvidenceCard` contract.
- Mock `sample-import-result.json` và `evidence-cards.json`.
- Trang Risk & Evidence có link tới bản ghi GitHub liên quan.

### Phối hợp

- Nhận payload GitHub từ Vân Anh.
- Nhận risk event từ Diểm Vi và prediction từ Hoàng Việt.
- Diểm Vi đóng góp Risk Drivers cho trang E6-S3.
- Hoàng Việt đóng góp Prediction Details cho trang E6-S3.

### Được tính là hoàn thành khi

- Import cùng một file hai lần không tạo bản ghi trùng.
- File sai schema trả về lỗi theo từng dòng/trường.
- Evidence Card luôn có evidence, confidence, limitation và suggested action.
- Card không có bằng chứng không được hiển thị.
- Người dùng drill-down được từ risk tới GitHub record.

## 5. Hoàng Việt - PR Delay Machine Learning

### Trách nhiệm chính

Xây dựng mô hình dự đoán nguy cơ pull request bị chậm review và cung cấp kết quả cho backend/UI.

### Công việc phải làm

- **E4-S1:** Chuẩn bị và làm sạch tập dữ liệu PR.
- **E4-S2:** Xây feature engineering dùng chung cho train và inference.
- **E4-S3:** Huấn luyện baseline Logistic Regression và/hoặc Random Forest.
- **E4-S4:** Đánh giá Accuracy, Precision, Recall, F1 và Confusion Matrix.
- **E4-S5:** Lưu model, feature schema và evaluation report.
- **E4-S6:** Làm prediction service trả probability và nhãn Low/Medium/High.
- **E4-S7:** Phối hợp lưu prediction theo PR, model version và feature summary.
- **E5-S6:** Viết test cho prediction và evidence được tạo từ prediction.
- Đóng góp Prediction Cards cho **E6-S2** và Prediction Details cho **E6-S3**.

### Sản phẩm phải bàn giao

- Dataset đã làm sạch và tài liệu nguồn dữ liệu.
- `feature-schema.json`.
- `pr-delay-risk.joblib`.
- `evaluation-report.json`.
- Script/service inference.
- `ModelStatus`, `PredictionRequest`, `PredictionResult` contract.
- Mock `pr-delay-predictions.json`.

### Phối hợp

- Nhận normalized PR fixture từ Văn Sơn.
- Gửi prediction contract và mock cho Văn Sơn, Diểm Vi và UI.
- Thống nhất với Diểm Vi cách prediction ảnh hưởng tới risk/evidence.

### Được tính là hoàn thành khi

- Có thể train lại model bằng một lệnh được tài liệu hóa.
- Train và inference dùng đúng cùng feature schema.
- Thiếu model hoặc feature không làm backend crash.
- Mỗi prediction có model version, probability và risk label.
- Nếu ML chưa sẵn sàng, hệ thống vẫn chạy rule-based risk bình thường.

## 6. Diểm Vi - Metrics & Delivery Risk

### Trách nhiệm chính

Biến dữ liệu GitHub thành KPI, bottleneck, Delivery Flow Risk và đề xuất hành động.

### Công việc phải làm

- **E3-S1:** Tính PR cycle time, merge time, open PR và stale PR.
- **E3-S2:** Tính review pickup, review turnaround và review load concentration.
- **E3-S3:** Tính failed check rate và oversized PR.
- **E3-S4:** Hỗ trợ cửa sổ hiện tại 7 ngày và so sánh kỳ trước.
- **E3-S5:** Viết unit test cho metrics và trường hợp thiếu dữ liệu.
- **E5-S1:** Cài đặt Flow Risk Rulebook R1-R5.
- **E5-S2:** Tạo và lưu risk events.
- **E5-S3:** Ánh xạ rule với recommendation an toàn.
- **E5-S5:** Chặn insight không có evidence.
- **E6-S2:** Làm Team Flow Dashboard.
- **E6-S4:** Làm Flow Risk Rulebook UI.
- Đóng góp Risk Drivers cho **E6-S3**.

### Sản phẩm phải bàn giao

- Metrics service và metric snapshot.
- Rule engine R1-R5 và insufficient-data behavior.
- Risk API, Dashboard API và Rulebook API.
- `DashboardSummary`, `RiskEvent`, `RulebookItem` contract.
- Mock `dashboard-summary.json` và `rulebook.json`.
- Dashboard hiển thị KPI, risk, bottleneck và last sync.

### Phối hợp

- Nhận normalized queries từ Văn Sơn.
- Nhận prediction summary từ Hoàng Việt.
- Gửi risk events cho Văn Sơn tạo Evidence Card.
- Thống nhất contract Dashboard/Risk với Anh Quân.

### Được tính là hoàn thành khi

- Metric cho ra kết quả đúng với fixture đã biết.
- Dữ liệu thiếu được ghi là `insufficient data`, không mặc định thành an toàn.
- Mỗi risk driver chỉ tới metric và affected records.
- Recommendation không chứa đánh giá năng suất hoặc ngôn ngữ HR.
- Dashboard drill-down được tới Risk & Evidence.

## 7. Anh Quân - Data Quality, AI Brief, Privacy & Shared UI

### Trách nhiệm chính

Hoàn thiện trải nghiệm dùng chung, chất lượng dữ liệu, quyền riêng tư, Weekly Brief và luồng demo end-to-end.

### Công việc phải làm

- **E1-S4:** Tạo prototype session, app shell, routing, theme và component primitives.
- **E2-S5:** Tổng hợp sync status thành Data Quality: Good, Partial hoặc Poor.
- **E6-S5:** Làm loading, empty, partial-data và error state dùng chung.
- **E7-S1:** Tạo structured payload chỉ chứa metrics, predictions, Evidence Cards và limitations.
- **E7-S2:** Redact/pseudonymize dữ liệu nhạy cảm.
- **E7-S3:** Làm API tạo AI Weekly Brief.
- **E7-S4:** Làm deterministic fallback khi AI lỗi.
- **E7-S5:** Làm giao diện tạo và xem Weekly Brief.
- **E7-S6:** Làm Privacy page và prohibited-use notice.
- **E8-S4:** Tạo fixture demo cho các tình huống rủi ro.
- **E8-S5:** Ghép và chạy bộ test end-to-end chung; mỗi người vẫn tự viết test module của mình.
- Đóng góp Data Quality panel cho **E6-S1**.

### Sản phẩm phải bàn giao

- App shell, navigation và shared UI components.
- Data Quality API/panel.
- Privacy redaction service và Privacy page.
- Weekly Brief API/UI và fallback.
- `DataQualityReport`, `WeeklyBrief`, `PrivacySettings` và API error format.
- Mock `data-quality.json` và `weekly-brief.json`.
- Demo fixtures và E2E flow.

### Phối hợp

- Review mọi thay đổi app shell/shared component.
- Nhận sync data từ Vân Anh, evidence từ Văn Sơn, prediction từ Hoàng Việt và dashboard/risk từ Diểm Vi.
- Yêu cầu từng thành viên cung cấp fixture và test cho module của họ trước khi chạy E2E.

### Được tính là hoàn thành khi

- Mọi màn hình có loading, empty, partial và error state.
- AI không nhận raw source code hoặc raw comment body.
- Insight không có evidence không xuất hiện trong brief.
- AI lỗi vẫn tạo được báo cáo fallback.
- Luồng demo chạy được từ Connect/Import tới Dashboard, Evidence, Brief và Privacy.

## 8. Database chung

### Owner và quy trình

- **Sprint 1 DB Coordinator:** Văn Sơn.
- **Sprint 2:** Vân Anh.
- **Sprint 3:** Diểm Vi.
- **Sprint 4:** Hoàng Việt.
- **Sprint 5:** Anh Quân.
- Chỉ DB Coordinator triển khai thay đổi schema/index đã được duyệt.
- Mọi database PR cần ít nhất hai reviewer, gồm ít nhất một người sử dụng collection đó.

### Chia collection đề xuất

| Người đề xuất | Collection/nhóm dữ liệu |
|---|---|
| Vân Anh | `repositories`, `githubConnections`, `syncRuns`, `syncJobs`, `webhookEvents` |
| Văn Sơn | GitHub normalized entities, `evidenceCards` |
| Hoàng Việt | `modelVersions`, `prDelayPredictions` |
| Diểm Vi | `metricSnapshots`, `flowRules`, `riskEvents`, `recommendations` |
| Anh Quân | `users`, `dataQualityWarnings`, `privacySettings`, `aiBriefs`, `aiPromptLogs`, `auditEvents` |

## 9. Thứ tự triển khai theo sprint

### Sprint 1 - Foundation và contract

- Vân Anh: scaffold app; connection/sync contracts và mock.
- Văn Sơn: schema/index; normalized/evidence contracts và fixtures; DB Coordinator.
- Hoàng Việt: dataset plan, feature schema và prediction mock.
- Diểm Vi: dashboard/risk/rulebook contracts và mock.
- Anh Quân: app shell, routing, shared states, privacy/error contract.

**Mốc bắt buộc:** frontend chạy được bằng mock API; contract của cả 5 người được chốt.

### Sprint 2 - Thu thập dữ liệu và xử lý nền

- Vân Anh: GitHub connection, PR backfill và review sync.
- Văn Sơn: metadata/check sync và sample import.
- Hoàng Việt: dataset và feature engineering.
- Diểm Vi: PR/review/CI metrics.
- Anh Quân: data quality aggregation và shared UI states.

### Sprint 3 - ML, risk và UI chính

- Vân Anh: hoàn thiện sync status API/UI.
- Văn Sơn: persistence cho risk/prediction và khung Evidence Card.
- Hoàng Việt: train và evaluate model.
- Diểm Vi: Rulebook R1-R5, risk events và recommendations.
- Anh Quân: privacy redaction và tích hợp shared navigation/states.

### Sprint 4 - Tích hợp Dashboard và Evidence

- Vân Anh: Connect/Sync Status hoàn chỉnh và `Sync now`.
- Văn Sơn: Evidence Card service và Risk/Evidence page.
- Hoàng Việt: model artifact và prediction service.
- Diểm Vi: Dashboard, Risk API và Rulebook UI.
- Anh Quân: Weekly Brief backend, fallback và Privacy page.

### Sprint 5 - Luồng end-to-end

- Vân Anh: webhook và recompute orchestration.
- Văn Sơn: hoàn thiện import/evidence integration.
- Hoàng Việt: prediction/evidence tests và Prediction UI contribution.
- Diểm Vi: hoàn thiện dashboard/risk integration.
- Anh Quân: Weekly Brief UI, demo fixtures và E2E integration.

### Sprint 6 - Ổn định và demo

- Cả nhóm sửa lỗi tích hợp, bổ sung test, kiểm tra privacy và chuẩn bị demo.
- Mỗi người demo module của mình; Anh Quân chạy luồng demo tổng.

## 10. Dependency phải bàn giao sớm

| Provider | Consumer | Phải bàn giao |
|---|---|---|
| Vân Anh | Văn Sơn | GitHub payload mẫu và source ID rules |
| Văn Sơn | Hoàng Việt, Diểm Vi | Normalized schema, fixture và query shape |
| Hoàng Việt | Văn Sơn, Diểm Vi, Anh Quân | Prediction contract và mock JSON |
| Diểm Vi | Văn Sơn, Anh Quân | Risk, Dashboard, Rulebook contract và mock JSON |
| Văn Sơn | Anh Quân | Evidence Card và import result contract |
| Vân Anh | Anh Quân | Sync status và common error contract |
| Anh Quân | Cả nhóm | App shell, route registry và shared component rules |

## 11. Definition of Done cho mọi thành viên

Một story chỉ hoàn thành khi đáp ứng đủ:

- Chạy được theo acceptance criteria.
- Có validation và xử lý lỗi.
- Có loading/empty/partial/error state nếu là UI.
- Có unit/integration test phù hợp.
- Không làm lộ secret hoặc dữ liệu bị cấm.
- Có mock/fixture để người khác tích hợp.
- Có hướng dẫn chạy và kiểm thử trong PR.
- Được review, merge và xác nhận trong luồng end-to-end.

## 12. Việc cần làm ngay

1. Tạo repository và các branch/module nền.
2. Văn Sơn tổ chức buổi chốt database schema Sprint 1.
3. Cả 5 người chốt API contracts và mock JSON trước khi code UI/backend độc lập.
4. Mỗi người nhận story Sprint 1 của mình và cập nhật trạng thái: `backlog -> in-progress -> review -> done`.
