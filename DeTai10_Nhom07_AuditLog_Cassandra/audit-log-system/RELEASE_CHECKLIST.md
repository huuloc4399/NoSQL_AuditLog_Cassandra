> Tài liệu lịch sử trước bản sửa 22/10/2026. Tham khảo README_DEMO.md và REAL_DATABASE.md tại thư mục gốc, cùng docs/DEMO.md, docs/TESTING.md, docs/CASSANDRA_DESIGN.md và docs/PERFORMANCE.md cho bản đang chạy bằng WSL.

# BẢNG KIỂM TRA PHÁT HÀNH DỰ ÁN (RELEASE CHECKLIST)
## Distributed Audit Log & Monitoring System
**Release Candidate Version:** `v1.0.0-RC`  
**Ngày kiểm toán & đóng băng:** 14/10/2026  
**Cơ sở dữ liệu cốt lõi:** Apache Cassandra 4.1 (NoSQL Wide-Column Store)  
**Kiến trúc:** Clean Architecture (React TypeScript + Node.js Express + Cassandra Driver)

---

## 1. BẢNG TỔNG HỢP TRẠNG THÁI KIỂM TOÁN (20/20 HẠNG MỤC)

| STT | Hạng mục kiểm tra Release Candidate | Trạng thái | Bằng chứng kỹ thuật / File thực thi | Ghi chú vận hành |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **Backend Build** | **PASS** | `npm run build --prefix backend` (`tsc`) hoàn thành với **Exit code 0**. Không có lỗi TypeScript. | Thư mục `backend/dist` được biên dịch sạch. |
| **2** | **Frontend Build** | **PASS** | `npm run build --prefix frontend` (`vite build`) hoàn thành với **Exit code 0**. 2288 modules transformed. | Thư mục `frontend/dist` sẵn sàng cho production. |
| **3** | **Automated Tests** | **PASS** | `npm run test` vượt qua **40/40 ca kiểm thử** (15 Unit/Validation + 25 Auth & RBAC Contracts AUTH-01 &rarr; AUTH-25). | 100% Green, 0% Failed. |
| **4** | **Cassandra Health Check** | **PASS** | Endpoint `/api/health` và `/api/system/status` kiểm tra truy vấn `SELECT cluster_name FROM system.local`. | [cassandra.ts](file:///d:/NoSQL10/audit-log-system/backend/src/config/cassandra.ts#L181-L201) |
| **5** | **Kiểm tra CQL Scripts** | **PASS** | Đầy đủ 6 file `.cql` chuẩn cú pháp Cassandra 4.1 trong thư mục [database/](file:///d:/NoSQL10/audit-log-system/database): `01_keyspace`, `02_tables`, `03_seed_services`, `04_queries`, `05_ttl_demo`, `06_users_rbac`. | Không chứa lỗi cú pháp CQL. |
| **6** | **Kiểm tra `nodetool status`** | **PASS** | Container `cassandra_audit_node` bind đúng port JMX `7199` và CQL `9042`. Lệnh kiểm tra node sẵn sàng: `docker exec -it cassandra_audit_node nodetool status`. | Trạng thái chuẩn: `UN` (Up / Normal). |
| **7** | **Auto Audit Log** | **PASS** | Đủ 12 hành vi nghiệp vụ sinh log tự động (Auth, User, Order, Payment) trong [demoController.ts](file:///d:/NoSQL10/audit-log-system/backend/src/controllers/demoController.ts). Đăng nhập đúng sinh `LOGIN_SUCCESS`, sai sinh `LOGIN_FAILED`. | Không dùng log giả lập. |
| **8** | **CRUD Service Catalog** | **PASS** | Đầy đủ API `GET`, `POST`, `PUT`, `DELETE` cho bảng `services`. Service inactive chặn hoàn toàn ghi log mới ở cấp độ backend (HTTP 400). | [serviceCatalogService.ts](file:///d:/NoSQL10/audit-log-system/backend/src/services/serviceCatalogService.ts) |
| **9** | **Bộ lọc Service + Level + Time** | **PASS** | Áp dụng đúng triết lý Query-First: lọc theo `audit_logs` khi có Service + Date, hoặc lọc theo `audit_logs_by_service_level` khi có Level. **0% ALLOW FILTERING**. | [auditLogService.ts](file:///d:/NoSQL10/audit-log-system/backend/src/services/auditLogService.ts#L225-L350) |
| **10** | **Cassandra Native TTL 30s** | **PASS** | Kiểm tra ghi tham số `USING TTL 30`, đọc giá trị `TTL(message)` giảm dần từng giây và tự động biến mất hoàn toàn trên cả CQL lẫn giao diện Web [TtlDemoPage.tsx](file:///d:/NoSQL10/audit-log-system/frontend/src/pages/TtlDemoPage.tsx). | [05_ttl_demo.cql](file:///d:/NoSQL10/audit-log-system/database/05_ttl_demo.cql) |
| **11** | **400 Dummy Logs chuẩn tỷ lệ** | **PASS** | Script [generateDummyData.ts](file:///d:/NoSQL10/audit-log-system/backend/scripts/generateDummyData.ts) tạo đúng 400 bản ghi: Auth (70/20/10), User (70/20/10), Order (65/20/15), Payment (60/20/20) rải trong 7 ngày, timestamp không trùng. | Ghi đồng thời với cùng 1 `log_id`. |
| **12** | **Demo Operations Page** | **PASS** | Giao diện điều khiển 12 nút bấm nghiệp vụ thật tại `/demo`, có banner kết quả tức thì, hiển thị `Log ID`, nút xem chi tiết log trực tiếp và làm mới Dashboard. | [DemoOperationsPage.tsx](file:///d:/NoSQL10/audit-log-system/frontend/src/pages/DemoOperationsPage.tsx) |
| **13** | **README & DEMO Documentation** | **PASS** | Tài liệu [README.md](file:///d:/NoSQL10/audit-log-system/README.md) và [docs/DEMO.md](file:///d:/NoSQL10/audit-log-system/docs/DEMO.md) khớp 100% với cấu trúc thư mục, lệnh PowerShell và hợp đồng API. | Sẵn sàng cho hội đồng bảo vệ. |
| **14** | **Cassandra Users Table & Query-First** | **PASS** | Bảng `audit_log_system.users` với `PRIMARY KEY (username)`. Truy vấn tìm user lúc đăng nhập là point lookup $O(1)$ token Murmur3, **0% ALLOW FILTERING**. | [06_users_rbac.cql](file:///d:/NoSQL10/audit-log-system/database/06_users_rbac.cql) |
| **15** | **Case-Insensitive Username & 409 Conflict** | **PASS** | Chuẩn hóa `.trim().toLowerCase()`. Ngăn `admin`, `Admin`, `ADMIN` tạo thành tài khoản khác. Trả HTTP `409 Conflict` khi trùng lặp. | [authController.ts](file:///d:/NoSQL10/audit-log-system/backend/src/controllers/authController.ts#L48-L54) |
| **16** | **Password Security & Bcrypt Cost 10** | **PASS** | Mật khẩu tối thiểu 8 ký tự, băm bằng `bcryptjs` cost factor 10. `SafeUser` triệt để không bao giờ trả về `password_hash`. Mật khẩu không bao giờ xuất hiện trong log/console. | [userService.ts](file:///d:/NoSQL10/audit-log-system/backend/src/services/userService.ts#L251-L260) |
| **17** | **Public Self-Registration Enforces VIEWER** | **PASS** | `POST /api/auth/register` luôn ép `role: 'VIEWER'`, ngăn chặn hoàn toàn tấn công leo thang đặc quyền từ Frontend/API. | [authController.ts](file:///d:/NoSQL10/audit-log-system/backend/src/controllers/authController.ts#L56-L64) |
| **18** | **Role Validation & Phân biệt 401 / 403** | **PASS** | Chỉ cho phép `ADMIN`, `OPERATOR`, `VIEWER` và `ACTIVE`, `INACTIVE`. Trả `401 Unauthorized` cho token lỗi/hết hạn/account inactive, trả `403 Forbidden` khi role không đủ quyền. | [auth.ts](file:///d:/NoSQL10/audit-log-system/backend/src/middleware/auth.ts) |
| **19** | **Admin Safety & Bảo vệ Last Admin** | **PASS** | Chặn Admin tự xóa/tự khóa mình. Hàm `countActiveAdmins()` bảo vệ không cho phép xóa, khóa hoặc giáng quyền tài khoản ADMIN đang hoạt động cuối cùng. | [userService.ts](file:///d:/NoSQL10/audit-log-system/backend/src/services/userService.ts#L279-L397) |
| **20** | **Stateless JWT Logout & Audit Governance** | **PASS** | Server ghi nhận sự kiện `LOGOUT` vào Cassandra, client xóa token khỏi localStorage. Mọi thao tác quản trị user (`REGISTER_USER`, `CHANGE_PASSWORD`, `CHANGE_USER_ROLE`, `DISABLE_USER`, `DELETE_USER`) đều sinh Audit Log đầy đủ. | [docs/AUTHORIZATION.md](file:///d:/NoSQL10/audit-log-system/docs/AUTHORIZATION.md) |

---

## 2. THÔNG TIN TRUY CẬP HỆ THỐNG & TÀI KHOẢN QUẢN TRỊ (RBAC)

- **Giao diện Web Dashboard (Frontend):** `http://localhost:5173`
- **Địa chỉ Backend REST API:** `http://localhost:5000`
- **Health Check Endpoint:** `http://localhost:5000/api/health`
- **System Status Endpoint:** `http://localhost:5000/api/system/status`
- **Tài khoản đăng nhập Demo (RBAC 3 Cấp độ):**
  - **Quản trị viên (ADMIN):** `admin` / `admin123` (Toàn quyền quản trị Users, Services, System Status, TTL Demo)
  - **Vận hành viên (OPERATOR):** `operator` / `operator123` (Đọc Logs, Đọc Services, Kích hoạt Demo Operations)
  - **Người xem (VIEWER):** `viewer` / `viewer123` (Chỉ đọc Audit Logs & Dashboard)
- **Cổng giao tiếp Cassandra:** `9042` (CQL Native Protocol), `7199` (JMX Monitoring)

---

## 3. COMMAND KHỞI CHẠY DỰ ÁN TỪ ĐẦU (WINDOWS POWERSHELL)

Chạy tuần tự các lệnh sau trong cửa sổ **PowerShell** (Run as Administrator) để khởi động toàn bộ môi trường từ con số 0:

```powershell
# 1. Di chuyển vào thư mục dự án
cd d:\NoSQL10\audit-log-system

# 2. Khởi chạy Docker Container Cassandra 4.1
docker compose up -d

# 3. Đợi khoảng 40 giây cho JVM Cassandra sẵn sàng, sau đó kiểm tra ring:
docker exec -it cassandra_audit_node nodetool status

# 4. Chạy migration schema vào Cassandra
Get-Content database\01_keyspace.cql | docker exec -i cassandra_audit_node cqlsh
Get-Content database\02_tables.cql | docker exec -i cassandra_audit_node cqlsh
Get-Content database\03_seed_services.cql | docker exec -i cassandra_audit_node cqlsh
Get-Content database\06_users_rbac.cql | docker exec -i cassandra_audit_node cqlsh

# 5. Nạp 400 bản ghi Dummy Data phân bố chuẩn
npm run seed:dummy

# 6. Khởi động ứng dụng (Mở trên 2 terminal riêng biệt):
# Terminal 1: Khởi động Backend API (Port 5000)
npm run backend:dev

# Terminal 2: Khởi động Frontend Web Dashboard (Port 5173)
npm run frontend:dev

# (Lưu ý: Nếu chạy 'npm run dev' tại thư mục gốc, hệ thống sẽ in hướng dẫn này)
```

---

## 4. KỊCH BẢN THUYẾT TRÌNH BẢO VỆ CHUẨN (HỘI ĐỒNG NO-SQL)

### Giai đoạn 1: Mở đầu & Chứng minh cụm Cassandra thực tế (Phút 00 - 02)
1. Mở PowerShell chạy lệnh:
   ```powershell
   docker exec -it cassandra_audit_node nodetool status
   ```
2. Chỉ vào trạng thái **`UN`** (**Up / Normal**), Port `9042`, giải thích vòng băm phân tán Murmur3Partitioner.
3. Đăng nhập vào web [http://localhost:5173](http://localhost:5173) bằng tài khoản `admin` / `admin123`.
4. Mở trang **System Status** (`/system`) để trình diễn kết nối Cassandra Client driver trực tiếp.

### Giai đoạn 2: Trình diễn Demo Operations & Auto Audit Logging (Phút 02 - 05)
1. Truy cập trang **Demo Operations** (`/demo`).
2. Nhấn nút **Create Order** trong nhóm ORDER hoặc **Login Failed** trong nhóm AUTH.
3. Chỉ vào banner phản hồi ngay lập tức: Action, Service, Level, và `Log ID` (TimeUUID).
4. Nhấn nút **View generated log** để mở Modal JSON chi tiết: Chứng minh dữ liệu được trích xuất từ database thật, các trường nhạy cảm như password/token/thẻ ngân hàng đã được mã hóa tự động thành `***REDACTED***`.

### Giai đoạn 3: Chứng minh mô hình Query-First & Phân trang Cursor (Phút 05 - 07)
1. Mở trang **Audit Logs** (`/logs`).
2. Trình diễn bộ lọc: Chọn Dịch vụ: `Payment`, Cấp độ: `ERROR`.
3. Giải thích với Giám khảo: *"Truy vấn này chạy thẳng vào bảng chuyên biệt `audit_logs_by_service_level` với Partition Key `((service_name, level, log_date), log_time, log_id)`. Truy vấn định tuyến trực tiếp qua hàm băm Murmur3Partitioner, không quét toàn bảng, không sử dụng `ALLOW FILTERING`."*
4. Thực hiện chuyển trang: Chỉ ra cơ chế phân trang bằng con trỏ nhị phân `page_state` của Cassandra, khắc phục triệt để nhược điểm của lệnh `OFFSET` trong RDBMS.

### Giai đoạn 4: Trình diễn tính năng Native TTL 30 giây (Phút 07 - 09)
1. Truy cập trang **TTL Demo** (`/ttl-demo`).
2. Bấm nút **Create 30s TTL Log**.
3. Quan sát đồng hồ đếm ngược và bảng dữ liệu trích xuất trực tiếp hàm `TTL(message)` từ Cassandra.
4. Khi đồng hồ về 0, bấm **Verify Cassandra**: Bản ghi lập tức không thể đọc được (được đánh dấu logic bằng Tombstone, 0 rows returned). Dữ liệu vật lý sẽ được thu hồi hoàn toàn khỏi ổ đĩa trong chu kỳ Compaction kế tiếp mà không cần tiến trình background worker hay cron job nào của backend.

### Giai đoạn 5: Hỏi & Đáp và Kết luận (Phút 09 - 10)
- Trình bày file [docs/PERFORMANCE.md](file:///d:/NoSQL10/audit-log-system/docs/PERFORMANCE.md) và [docs/CASSANDRA_DESIGN.md](file:///d:/NoSQL10/audit-log-system/docs/CASSANDRA_DESIGN.md).
- Sẵn sàng trả lời các câu hỏi về cơ chế ghi tuần tự LSM-Tree, MemTable, CommitLog, SSTable và chiến lược xử lý Partial Write trong kiến trúc phân tán AP.

---

## 5. CAM KẾT ĐÓNG BĂNG PHIÊN BẢN (RELEASE FREEZE SIGN-OFF)

- [x] Không còn thay đổi Database Schema (`database/*.cql`).
- [x] Không còn thay đổi REST API Contracts (`/api/*`).
- [x] Không còn mã nguồn thừa hay câu lệnh `ALLOW FILTERING` trong backend.
- [x] Frontend không sử dụng bất kỳ mock/fake array nào cho Audit Log.
- [x] Bộ đóng gói Release Candidate `v1.0.0-RC` đã sẵn sàng để nghiệm thu.
