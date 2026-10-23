POST /api/demo/my-actions (ADMIN hoặc USER): body chỉ nhận scenario thuộc LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, UPDATE_USER, CREATE_ORDER, UPDATE_ORDER, CANCEL_ORDER, PAYMENT_SUCCESS, PAYMENT_FAILED. Trả 201 và data.auditLog. Actor/owner được lấy từ phiên đăng nhập; trường bổ sung hoặc tình huống ngoài danh sách bị từ chối 400. Đây là sự kiện mô phỏng, không thay đổi hồ sơ/đơn hàng hoặc xử lý thanh toán thật. Các endpoint demo quản trị cũ vẫn chỉ dành cho ADMIN.

# API cập nhật ngày 22 tháng 10 năm 2026

POST /api/demo/prepare-today (ADMIN): chuẩn bị 48 nhật ký mẫu cho ngày UTC hiện tại; trả data.date, data.added, data.existing, data.skipped. Bấm lại cùng ngày không tạo trùng. USER nhận 403.

PUT /api/users/:id hiện ghi UPDATE_USER; CRUD người dùng/dịch vụ gộp dữ liệu và ba bản sao audit trong logged batch. Lỗi database được chuyển tới error handler 503/500, không bỏ qua lỗi ghi. Khi timeout cần đọc lại dữ liệu trước khi gửi lại. Các sự kiện quản trị và đăng nhập vẫn được audit khi dịch vụ chuẩn bị tắt; cờ nội bộ không được chấp nhận từ API tiếp nhận log.

Phần đặc tả bên dưới mô tả các endpoint nền tảng; vai trò hiện tại chỉ là ADMIN và USER. Sử dụng backend/src/routes/index.ts và docs/AUTHORIZATION.md để đối chiếu quyền hiện hành.

# HỆ THỐNG AUDIT LOG - ĐẶC TẢ TÀI LIỆU RESTFUL API (API SPECIFICATION)
## CƠ SỞ DỮ LIỆU: APACHE CASSANDRA 4.1 WIDE-COLUMN STORE

---

## 1. THÔNG TIN CHUNG
- **Base URL:** `http://localhost:5000/api`
- **Giao thức:** HTTP/1.1 - Định dạng Payload: `application/json; charset=utf-8`
- **Xác thực (Authentication):** Bearer Token (JWT - JSON Web Token) truyền qua Header:  
  `Authorization: Bearer <jwt_token>`
- **Chuẩn mã trạng thái HTTP:**
  - `200 OK`: Truy vấn hoặc cập nhật thành công.
  - `201 Created`: Tạo mới bản ghi audit log hoặc dịch vụ thành công.
  - `400 Bad Request`: Dữ liệu đầu vào vi phạm schema Zod, sai định dạng UUID, hoặc chứa dữ liệu nhạy cảm (passwords/tokens/credit card).
  - `401 Unauthorized`: Token không hợp lệ hoặc đã hết hạn.
  - `404 Not Found`: Không tìm thấy bản ghi (hoặc bản ghi đã bị Cassandra TTL tự động tiêu hủy).
  - `503 Service Unavailable`: Cơ sở dữ liệu Cassandra tạm thời không kết nối được.

---

## 2. NHÓM API HỆ THỐNG & SỨC KHỎE (SYSTEM & HEALTH)

### 2.1 Kiểm tra trạng thái kết nối Cassandra
- **Endpoint:** `GET /health`
- **Mô tả:** Health check endpoint dùng cho load balancer và Docker healthcheck.
- **Phản hồi khi Cassandra hoạt động (200 OK):**
```json
{
  "success": true,
  "status": "UP",
  "service": "Audit Log Backend API",
  "cassandra": {
    "cluster_name": "AuditLogCluster",
    "release_version": "4.1.8",
    "data_center": "datacenter1",
    "rack": "rack1"
  },
  "timestamp": "2026-10-14T12:00:00.000Z"
}
```
- **Phản hồi khi Cassandra mất kết nối (503 Service Unavailable):**
```json
{
  "success": false,
  "status": "DEGRADED",
  "message": "Database temporarily unavailable",
  "error": "All host(s) tried for query failed. First host tried, 127.0.0.1:9042: Error: connect ECONNREFUSED"
}
```

### 2.2 Thông tin chẩn đoán hệ thống
- **Endpoint:** `GET /system/status`
- **Mô tả:** Trả về thông tin chi tiết về JVM, cluster topology và cấu hình node.

---

## 3. NHÓM API XÁC THỰC & PHÂN QUYỀN (AUTHENTICATION & RBAC)

### 3.1 Đăng ký tài khoản mới (Public)
- **Endpoint:** `POST /auth/register`
- **Mô tả:** Đăng ký tài khoản người dùng mới (vai trò mặc định: `VIEWER`). Tự động băm mật khẩu bằng **bcrypt (cost factor 10)** và sinh 1 Audit Log `REGISTER_USER` (INFO).
- **Request Body:**
```json
{
  "username": "auditor_john",
  "password": "secure_password_123",
  "full_name": "John Auditor",
  "email": "john@auditlog.internal"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "user_id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "username": "auditor_john",
      "full_name": "John Auditor",
      "email": "john@auditlog.internal",
      "role": "VIEWER",
      "status": "ACTIVE"
    }
  }
}
```

### 3.2 Đăng nhập người dùng (Public)
- **Endpoint:** `POST /auth/login`
- **Mô tả:** Xác thực tài khoản bằng bcrypt, sinh JWT token (thời hạn 24h) và tự động ghi nhận 1 Audit Log `LOGIN_SUCCESS` (INFO) hoặc `LOGIN_FAILED` (WARN) vào Cassandra.
- **Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "user_id": "11111111-2222-3333-4444-555555555555",
      "username": "admin",
      "full_name": "System Administrator",
      "email": "admin@auditlog.internal",
      "role": "ADMIN",
      "status": "ACTIVE"
    }
  }
}
```

### 3.3 Đăng xuất (Authenticated)
- **Endpoint:** `POST /auth/logout`
- **Headers:** `Authorization: Bearer <token>`
- **Mô tả & Bản chất kiến trúc:** 
  Hệ thống sử dụng JWT stateless không dùng blacklist server-side để duy trì hiệu năng cao nhất. Do đó, request `POST /api/auth/logout` phía server chủ yếu ghi nhận sự kiện `LOGOUT` (INFO) vào Cassandra Audit Log; phía Frontend thực hiện xóa token JWT khỏi `localStorage` để kết thúc phiên làm việc.
- **Lưu ý về Token Storage:**
  `localStorage` được sử dụng cho phạm vi demo môn học. Trong môi trường production thực tế, nên cân nhắc giải pháp **HttpOnly + Secure + SameSite Cookie** để loại bỏ rủi ro token bị đánh cắp qua tấn công Cross-Site Scripting (XSS).
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 3.4 Xác thực phiên làm việc hiện tại
- **Endpoint:** `GET /auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** Trả về thông tin đầy đủ về người dùng đang đăng nhập.

### 3.5 Thay đổi mật khẩu (Authenticated)
- **Endpoint:** `PUT /auth/change-password`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "old_password": "old_secret_123",
  "new_password": "new_secret_456"
}
```
- **Mô tả:** Kiểm tra mật khẩu cũ, băm mật khẩu mới bằng bcrypt và ghi nhận 1 Audit Log `CHANGE_PASSWORD` (INFO). Mật khẩu không bao giờ được ghi vào log.
- **Response (200 OK):** `{"success": true, "message": "Password changed successfully"}`

---

## 3.6 NHÓM API QUẢN TRỊ NGƯỜI DÙNG (USER MANAGEMENT - ADMIN ONLY)
*Tất cả các endpoint trong nhóm này yêu cầu Header `Authorization: Bearer <token>` với vai trò `ADMIN`. Các vai trò khác (`OPERATOR`, `VIEWER`) sẽ nhận mã lỗi `403 Forbidden`.*

- `GET /users`: Liệt kê tất cả người dùng (không trả về password_hash).
- `POST /users`: Tạo người dùng mới với vai trò chỉ định (`ADMIN`, `OPERATOR`, `VIEWER`).
- `PUT /users/:id`: Cập nhật thông tin họ tên, email.
- `PATCH /users/:id/role`: Thay đổi quyền hạn (sinh Audit Log `CHANGE_USER_ROLE` - WARN).
- `PATCH /users/:id/status`: Khóa hoặc kích hoạt tài khoản (`ACTIVE` / `INACTIVE`).
- `DELETE /users/:id`: Xóa tài khoản (sinh Audit Log `DELETE_USER` - WARN).

---

## 4. NHÓM API QUẢN LÝ AUDIT LOG (CORE AUDIT LOGS)

### 4.1 Truy vấn Audit Log (Query-First Routing & Phân trang Cursor)
- **Endpoint:** `GET /logs`
- **Query Parameters:**
  - `service` *(tùy chọn)*: Tên vi dịch vụ (`Auth` | `User` | `Order` | `Payment`).
  - `level` *(tùy chọn)*: Mức độ nghiêm trọng (`INFO` | `WARN` | `ERROR`).
  - `date` *(tùy chọn)*: Ngày truy vấn theo định dạng `YYYY-MM-DD` (mặc định là ngày hiện tại UTC).
  - `start_date` & `end_date` *(tùy chọn)*: Khoảng ngày cho cơ chế Scatter-Gather đa phân vùng (tối đa 14 ngày).
  - `from` & `to` *(tùy chọn)*: Khoảng thời gian trong ngày (`HH:mm` hoặc `HH:mm:ss`).
  - `limit` *(tùy chọn)*: Số bản ghi tối đa trên một trang (mặc định: `100`, tối đa `1000`).
  - `page_state` *(tùy chọn)*: Chuỗi hex đại diện cho con trỏ nhị phân (PagingState) của Cassandra.
- **Cơ chế định tuyến thông minh (Query-First Routing):**
  - Khi có cả `service` và `level`: Tự động đọc từ bảng **`audit_logs_by_service_level`** với Partition Key `((service_name, level, log_date))` &rarr; **0% ALLOW FILTERING**.
  - Khi chỉ có `service`: Đọc từ bảng **`audit_logs`** với Partition Key `((service_name, log_date))` &rarr; **0% ALLOW FILTERING**.
  - Khi truy vấn nhiều ngày (`start_date`, `end_date`): Phân rã thành các truy vấn đơn ngày song song theo nguyên lý Scatter-Gather và sắp xếp lại kết quả theo `log_time DESC`.
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Audit logs retrieved successfully",
  "data": [
    {
      "service_name": "Order",
      "log_date": "2026-10-14",
      "log_time": "2026-10-14T10:15:30.125Z",
      "log_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "level": "INFO",
      "action": "CREATE_ORDER",
      "user_id": "usr_buyer_99",
      "ip_address": "192.168.1.15",
      "message": "Order created successfully for customer 'usr_buyer_99' with total 450000 VND",
      "details": "{\"order_id\":\"ORD-9912\",\"total_amount\":450000}"
    }
  ],
  "count": 1,
  "page_state": "00080000018c454e6049664c48"
}
```

### 4.2 Lấy chi tiết một Audit Log theo UUID (Point Query $O(1)$)
- **Endpoint:** `GET /logs/:id`
- **Mô tả:** Truy vấn bản ghi chính xác theo UUID trực tiếp từ bảng chuyên biệt `audit_logs_by_id`.
- **Response (200 OK):** Trả về toàn bộ chi tiết bản ghi.
- **Response (404 Not Found):** Nếu không tồn tại hoặc đã hết hạn TTL trong Cassandra.

### 4.3 Kiểm tra trạng thái TTL thời gian thực
- **Endpoint:** `GET /logs/ttl-status/:id`
- **Mô tả:** Gọi trực tiếp hàm Cassandra CQL `TTL(message)` để lấy chính xác số giây còn lại trước khi bản ghi bị thu hồi.
- **Phản hồi khi bản ghi còn hiệu lực (200 OK):**
```json
{
  "success": true,
  "found": true,
  "expired": false,
  "remaining_ttl": 24,
  "data": { ... },
  "message": "Record active in Cassandra. TTL(message) = 24s remaining."
}
```
- **Phản hồi khi bản ghi đã hết hạn trong Cassandra (200 OK):**
```json
{
  "success": true,
  "found": false,
  "expired": true,
  "remaining_ttl": 0,
  "data": null,
  "message": "Record has expired in Apache Cassandra (0 rows returned)."
}
```

### 4.4 Tạo Audit Log thủ công (Triple-Write)
- **Endpoint:** `POST /logs`
- **Mô tả:** Ghi đồng thời vào cả 3 bảng `audit_logs`, `audit_logs_by_service_level` và `audit_logs_by_id` với cùng một UUID duy nhất. Tự động che giấu dữ liệu nhạy cảm.
- **Request Body:**
```json
{
  "service_name": "Auth",
  "level": "WARN",
  "action": "LOGIN_FAILED",
  "message": "Failed sign-in attempt from IP 192.168.1.50",
  "user_id": "usr_test",
  "details": { "attempt": 3 },
  "ttl": 30
}
```
- **Response (201 Created):** Trả về bản ghi vừa được ghi nhận thành công vào Cassandra.

### 4.5 Tạo Log Demo TTL 30 giây
- **Endpoint:** `POST /logs/ttl-demo`
- **Request Body:** `{"ttl": 30}` (tùy chọn truyền số giây).
- **Response (201 Created):** Trả về bản ghi với mệnh đề `USING TTL 30;` áp dụng trong Cassandra.

### 4.6 Thống kê tổng hợp Dashboard
- **Endpoint:** `GET /logs/stats/summary`
- **Query Parameters:** `date` *(tùy chọn)*
- **Response (200 OK):** Thống kê tổng số log, số lượng theo từng mức độ (INFO/WARN/ERROR), phân bố theo từng vi dịch vụ và danh sách 5 lỗi gần nhất.

---

## 5. NHÓM API QUẢN TRỊ DANH MỤC VI DỊCH VỤ (SERVICES)

- `GET /services`: Lấy danh sách tất cả microservices đang đăng ký trong bảng `services`.
- `POST /services`: Đăng ký vi dịch vụ mới (`service_name`, `description`, `status`).
- `GET /services/:id`: Lấy thông tin chi tiết một dịch vụ theo UUID.
- `PUT /services/:id`: Cập nhật trạng thái (`status: false` để ngừng nhận log) hoặc mô tả.
- `DELETE /services/:id`: Xóa dịch vụ khỏi hệ thống.

---

## 6. NHÓM API DEMO NGHIỆP VỤ (AUTO AUDIT LOG TRIGGERS)

Các API này đại diện cho các hành vi nghiệp vụ thực tế của các vi dịch vụ. Khi gọi các API này, Backend tự động sinh và ghi đồng bộ Audit Log vào Apache Cassandra:

| Phương thức | Endpoint | Thao tác nghiệp vụ | Action Audit Log | Level |
| :--- | :--- | :--- | :--- | :---: |
| `POST` | `/demo/auth/login-success` | Đăng nhập tài khoản thành công | `LOGIN_SUCCESS` | `INFO` |
| `POST` | `/demo/auth/login-failed` | Đăng nhập sai mật khẩu | `LOGIN_FAILED` | `WARN` |
| `POST` | `/demo/auth/logout` | Đăng xuất khỏi hệ thống | `LOGOUT` | `INFO` |
| `POST` | `/demo/users` | Tạo mới người dùng | `CREATE_USER` | `INFO` |
| `PUT` | `/demo/users/:id` | Cập nhật hồ sơ người dùng | `UPDATE_USER` | `INFO` |
| `DELETE` | `/demo/users/:id` | Xóa người dùng | `DELETE_USER` | `WARN` |
| `POST` | `/demo/orders` | Đặt hàng thành công | `CREATE_ORDER` | `INFO` |
| `PUT` | `/demo/orders/:id` | Thay đổi địa chỉ nhận hàng | `UPDATE_ORDER` | `INFO` |
| `PUT` | `/demo/orders/:id/cancel`| Hủy đơn hàng | `CANCEL_ORDER` | `WARN` |
| `POST` | `/demo/payments/success` | Thanh toán hóa đơn thành công | `PAYMENT_SUCCESS` | `INFO` |
| `POST` | `/demo/payments/failed` | Thanh toán thất bại (Gateway Timeout)| `PAYMENT_FAILED` | `ERROR` |
| `POST` | `/demo/payments/refund` | Hoàn tiền giao dịch | `REFUND` | `INFO` |
# Cửa hàng bổ sung ngày 22/10/2026

Các endpoint `/api/shop/*` đều yêu cầu JWT và chỉ thao tác giỏ/đơn của tài khoản hiện tại, kể cả khi người gọi là Admin. UUID người dùng không nhận từ request. Response `{ data: ... }`; lỗi dùng handler chung (400 validation, 401 phiên, 404 đơn không thuộc mình, 409 chuyển trạng thái không hợp lệ, 503 DB).

| Method | Endpoint | Body/chức năng |
| --- | --- | --- |
| GET | `/api/shop/products` | Danh mục mẫu, giá VND và đường dẫn ảnh |
| GET / PUT | `/api/shop/cart` | PUT `{ items: [{ product_id, quantity }] }`, tối đa bốn ID khác nhau, số lượng 1–10 |
| GET / POST | `/api/shop/orders` | GET lịch sử của mình; POST `{ order_id: UUID, shipping: { name, phone, address } }`, lấy giỏ từ DB, tính giá máy chủ, lưu đơn và làm trống giỏ |
| GET | `/api/shop/orders/:id` | Chi tiết đơn của mình |
| POST | `/api/shop/orders/:id/pay` | `{ attempt_id: UUID, outcome: 'success' / 'declined' / 'timeout' }` — giả lập, không thu tiền |
| POST | `/api/shop/orders/:id/cancel` | `{}` — chỉ hủy đơn chưa thanh toán |

Gửi lại order_id hoặc attempt_id đã dùng không tạo thao tác lặp. Một đơn tối đa 10 lần thử thanh toán. Cơ chế tuần tự theo tài khoản chỉ dành cho một tiến trình backend demo. Business write và ba audit INSERT cùng logged batch; không có bảo đảm SQL rollback/isolation. Xem DEMO_CUA_HANG.md tại gốc cho phạm vi và luồng UI. `/demo` của User chuyển về cửa hàng; API personal demo cũ vẫn giữ tương thích.
