# Flow Intelligence for GitHub

Flow Intelligence là hệ thống theo dõi luồng phát triển phần mềm từ dữ liệu GitHub. Ứng dụng tổng hợp KPI, phát hiện bottleneck/rủi ro, tạo Evidence Cards, dự đoán Pull Request chậm và sinh báo cáo tuần bằng AI.

## Chức năng chính

- Kết nối repository bằng GitHub OAuth và đồng bộ Pull Request, review, check run.
- Dashboard KPI và tình trạng chất lượng dữ liệu.
- Theo dõi Review/CI Metrics theo khoảng thời gian.
- Phát hiện rủi ro theo rulebook và cung cấp Evidence Cards.
- Dự đoán nguy cơ Pull Request bị trễ.
- Tạo AI Weekly Brief, có chế độ fallback khi dịch vụ AI không khả dụng.
- So sánh hai Weekly Brief để theo dõi KPI tăng/giảm, risk mới/đã giải quyết và tín hiệu hiệu quả của recommendation.
- Xuất báo cáo tuần gồm Weekly Brief, KPI và Evidence Cards dưới dạng CSV hoặc PDF.
- Quản lý cài đặt quyền riêng tư trước khi gửi dữ liệu tới AI.

## Công nghệ sử dụng

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Query, Recharts |
| Backend | Node.js, Express 5, TypeScript, Mongoose |
| Database | MongoDB |
| GitHub | OAuth, REST API, Webhooks |
| AI | Google Gemini, deterministic fallback |
| Kiểm thử | Jest, Vitest, Testing Library |

## Cấu trúc thư mục

```text
Flow-Intelligence-Github/
├── Flow-Intelligence-Github_FE/   # React frontend
├── Flow-Intelligence-Github_BE/   # Express API và worker đồng bộ
├── dataset/                       # Model, dữ liệu và script ML
├── architecture.md                # Tài liệu kiến trúc
├── mongodb-database-design.md     # Thiết kế MongoDB
└── README.md
```

## Yêu cầu môi trường

- Node.js 20 trở lên.
- npm.
- MongoDB 6 trở lên, chạy local hoặc MongoDB Atlas.
- GitHub OAuth App nếu sử dụng kết nối GitHub thật.
- Gemini API key là tùy chọn. Không có key, Weekly Brief sẽ sử dụng nội dung fallback.

## 1. Tải và cài đặt dependencies

```bash
git clone <repository-url>
cd Flow-Intelligence-Github

cd Flow-Intelligence-Github_BE
npm install

cd ../Flow-Intelligence-Github_FE
npm install
```

## 2. Cấu hình backend

Tạo file `Flow-Intelligence-Github_BE/.env`:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3001

MONGODB_URI=mongodb://127.0.0.1:27017/flow_intelligence

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Ít nhất 32 ký tự
JWT_SECRET=replace_with_a_secret_of_at_least_32_characters
ENCRYPTION_KEY=replace_with_an_encryption_key_32_chars
ENCRYPTION_SALT=replace_with_a_random_salt

CORS_ORIGIN=http://localhost:5173

# Tùy chọn: dùng một key
GEMINI_API_KEY=your_gemini_api_key

# Tùy chọn: model chính và model thử lại khi model chính không khả dụng
GEMINI_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite

# Hoặc nhiều key, phân cách bằng dấu phẩy
# GEMINI_API_KEYS=key_one,key_two,key_three
```

Không commit file `.env` hoặc API key lên Git. Các file môi trường đã được loại trừ trong `.gitignore`.

### Cấu hình GitHub OAuth App

Trong GitHub, mở **Settings → Developer settings → OAuth Apps** và tạo OAuth App:

- Homepage URL: `http://localhost:5173`
- Authorization callback URL: `http://localhost:3001/api/auth/github/callback`

Sao chép Client ID và Client Secret vào `.env` của backend.

## 3. Khởi tạo dữ liệu mẫu

Đảm bảo MongoDB đang chạy, sau đó:

```bash
cd Flow-Intelligence-Github_BE
npm run seed
```

> **Cảnh báo:** script seed xóa dữ liệu hiện có trong các collection vận hành trước khi thêm dữ liệu mẫu. Chỉ chạy với database phát triển hoặc database dành riêng cho demo.

Script seed tạo repository, contributor, Pull Request, review, check run, KPI, risk event, Evidence Card và prediction mẫu.

## 4. Chạy ứng dụng

Mở hai terminal riêng.

Terminal backend:

```bash
cd Flow-Intelligence-Github_BE
npm run dev
```

Backend mặc định chạy tại `http://localhost:3001`. Kiểm tra trạng thái bằng:

```text
http://localhost:3001/api/health
```

Terminal frontend:

```bash
cd Flow-Intelligence-Github_FE
npm run dev
```

Mở `http://localhost:5173`. Vite tự chuyển tiếp các request `/api` tới backend ở cổng `3001`.

## 5. Luồng sử dụng cơ bản

1. Đăng nhập bằng GitHub.
2. Kết nối hoặc chọn repository.
3. Chạy đồng bộ dữ liệu GitHub và theo dõi trạng thái tại trang Sync Status.
4. Xem KPI, bottleneck và chất lượng dữ liệu trên Dashboard.
5. Xem Review/CI Metrics, Risk và Evidence Cards.
6. Mở **AI Weekly Brief**, chọn khoảng ngày và nhấn **Generate**.
7. Nhấn **Compare Periods**, chọn hai giai đoạn đã có Brief và nhấn **Compare periods** để xem tiến độ thay đổi.
8. Nhấn **Export CSV** để tải dữ liệu dạng bảng.
9. Nhấn **Export PDF**, sau đó chọn **Save as PDF** trong hộp thoại in của trình duyệt. Nếu không mở được, cho phép pop-up cho địa chỉ frontend.

PDF và CSV bao gồm Executive Summary, nội dung Weekly Brief, KPI, Evidence Cards trong khoảng báo cáo, confidence, recommendations và limitations.

## Các lệnh thường dùng

### Backend

```bash
npm run dev              # Chạy development server với watch mode
npm run build            # Biên dịch TypeScript vào dist
npm start                # Chạy backend đã build
npm run typecheck        # Kiểm tra TypeScript
npm test                 # Chạy toàn bộ Jest tests
npm run test:unit        # Chạy unit tests
npm run test:integration # Chạy integration tests
npm run seed             # Tạo lại dữ liệu demo
```

### Frontend

```bash
npm run dev       # Chạy Vite development server
npm run build     # Type-check và build production
npm run preview   # Xem thử production build
npm run lint      # Chạy ESLint
npm test          # Chạy Vitest
```

## Build production

```bash
cd Flow-Intelligence-Github_BE
npm run build
npm start
```

Trong terminal khác:

```bash
cd Flow-Intelligence-Github_FE
npm run build
npm run preview
```

Khi triển khai thật, cấu hình web server phục vụ thư mục frontend `dist`, chuyển tiếp `/api` tới backend và đặt `CORS_ORIGIN` đúng domain frontend.

## API chính

| Nhóm | Prefix |
| --- | --- |
| Health check | `/api/health` |
| Authentication | `/api/auth` |
| GitHub và repository | `/api/github`, `/api/repositories` |
| Dashboard | `/api/dashboard` |
| Review/CI Metrics | `/api/metrics` |
| Risk | `/api/risk` |
| Evidence Cards | `/api/repositories/:id/evidence-cards` |
| Weekly Brief | `/api/repositories/:id/briefs` |
| Prediction | `/api/repositories/:id/predictions` |

Phần lớn API nghiệp vụ yêu cầu JWT trong header:

```http
Authorization: Bearer <access-token>
```

## Xử lý sự cố

### Backend báo `Invalid environment variables`

Kiểm tra các biến bắt buộc trong `.env`. `JWT_SECRET` phải có ít nhất 32 ký tự.

### Không kết nối được MongoDB

- Kiểm tra MongoDB service đang chạy.
- Kiểm tra `MONGODB_URI` và quyền truy cập nếu dùng Atlas.
- Với Atlas, bảo đảm IP hiện tại đã được cho phép.

### Frontend nhận lỗi API hoặc 401

- Kiểm tra backend đang chạy ở cổng `3001`.
- Đăng nhập lại để tạo access token mới.
- Kiểm tra `CORS_ORIGIN` và cấu hình proxy trong `Flow-Intelligence-Github_FE/vite.config.ts`.

### Weekly Brief dùng fallback

Kiểm tra `GEMINI_API_KEY`/`GEMINI_API_KEYS`, hạn mức API và kết nối mạng. Brief fallback vẫn có thể được xuất PDF hoặc CSV.

### Không xuất được PDF

Cho phép pop-up cho `localhost:5173`, nhấn **Export PDF** lại và chọn **Save as PDF** trong hộp thoại in.

## Tài liệu bổ sung

- [Kiến trúc hệ thống](architecture.md)
- [Thiết kế MongoDB](mongodb-database-design.md)
- [Use cases và backlog](github-only-mvp-use-cases-flows-backlog.md)
- [Phân công công việc](phan-cong-cong-viec-chi-tiet-5-thanh-vien.md)

## Bảo mật

- Không đưa access token, GitHub secret, JWT secret hoặc AI key vào source code.
- Dùng HTTPS và secret mạnh ở production.
- Đổi toàn bộ secret mẫu trước khi triển khai.
- Không chạy dữ liệu seed trên database production.
