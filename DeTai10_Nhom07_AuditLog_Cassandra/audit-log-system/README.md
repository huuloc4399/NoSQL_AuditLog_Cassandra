> Bản hiện tại cập nhật 22/10/2026: chạy Cassandra thật trong WSL bằng START_REAL_DEMO.bat ở thư mục gốc. Xem README_DEMO.md và REAL_DATABASE.md ở gốc; docs/DEMO.md, docs/TESTING.md, docs/CASSANDRA_DESIGN.md và docs/PERFORMANCE.md đã cập nhật. Phần hướng dẫn Docker bên dưới là phương án cài khác và lịch sử ban đầu.

# HỆ THỐNG GIÁM SÁT AUDIT LOG VÀ LỊCH SỬ THAO TÁC HỆ THỐNG
## BÀI TẬP LỚN / ĐỒ ÁN MÔN HỌC: CƠ SỞ DỮ LIỆU NOSQL
**Công nghệ lưu trữ cốt lõi:** Apache Cassandra 4.1 (Wide-Column / Column Family NoSQL Database)  
**Kiến trúc tổng thể:** Single-Page Application (React + Vite) &harr; REST API Backend (Node.js + Express + TypeScript) &harr; Apache Cassandra Cluster (Port 9042)

---

## 1. GIỚI THIỆU TỔNG QUAN

Hệ thống được thiết kế theo tiêu chuẩn Enterprise Monitoring cho các hệ sinh thái vi dịch vụ (Microservices Architecture), giải quyết bài toán ghi nhận nhật ký thao tác (Audit Trail) với tải ghi cực lớn và truy vấn độ trễ thấp thông qua mô hình **Query-First Data Modeling** của Apache Cassandra:
- **Cơ sở dữ liệu chính:** Apache Cassandra 4.1. Tuyệt đối không sử dụng MySQL, PostgreSQL hay MongoDB; 100% dữ liệu được lưu trữ và truy vấn từ cụm Cassandra thật.
- **Backend Service:** Node.js, Express, TypeScript, `cassandra-driver`, Zod schema validation, JWT Session Authentication, Sensitive Data Masking.
- **Frontend Dashboard:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Recharts Analytics.
- **Cơ chế ghi đa bảng đồng thời (Triple-Write):** Ghi đồng thời vào cả 3 bảng Wide-Column (`audit_logs`, `audit_logs_by_service_level`, `audit_logs_by_id`) với cùng một mã định danh `log_id` duy nhất và timestamp đồng bộ.
- **Không lạm dụng `ALLOW FILTERING`:** Toàn bộ các luồng truy vấn nghiệp vụ chính đều định tuyến trực tiếp vào Partition Key xác định, thỏa mãn 100% nguyên lý NoSQL.
- **Cassandra Native TTL:** Tự động thu hồi và tiêu hủy dữ liệu log tạm sau 30 giây ở cấp độ cell/row mà không cần cronjob hay lệnh `DELETE`.

---

## 2. KIẾN TRÚC HỆ THỐNG VÀ DATA MODEL

### 2.1 Sơ đồ dòng dữ liệu (Data Flow)
```
  [ Client / Browser ]
           │
           ▼ (HTTP / JSON :5173)
  [ Frontend Dashboard ] (React 18 + Vite + Tailwind CSS)
           │
           ▼ (REST API / Bearer JWT :5000)
  [ Backend Node.js Service ] (Express + TypeScript + Zod Validation)
           │
           ▼ (Cassandra Native Binary Protocol :9042)
  [ Apache Cassandra 4.1 Cluster ] (Keyspace: audit_log_system)
         ├── audit_logs                  (PK: ((service_name, log_date), log_time, log_id))
         ├── audit_logs_by_service_level (PK: ((service_name, level, log_date), log_time, log_id))
         ├── audit_logs_by_id            (PK: (log_id))
         ├── services                    (PK: (service_id), idx_services_name)
         └── users                       (PK: (username), idx_users_id)
```

### 2.2 Đặc tả Schema bảng trong Cassandra

#### Bảng 1: `audit_logs` (Truy vấn theo Service + Date + Time Range)
```sql
CREATE TABLE audit_log_system.audit_logs (
    service_name text,
    log_date date,
    log_time timestamp,
    log_id uuid,
    level text,
    action text,
    user_id text,
    ip_address text,
    message text,
    details text,
    PRIMARY KEY ((service_name, log_date), log_time, log_id)
) WITH CLUSTERING ORDER BY (log_time DESC, log_id ASC);
```
- **Partition Key:** `(service_name, log_date)` băm dải dữ liệu theo từng ngày của mỗi dịch vụ, giới hạn kích thước partition < 100MB.
- **Clustering Key:** `log_time DESC, log_id ASC` sắp xếp vật lý dữ liệu giảm dần theo thời gian, chống ghi đè khi 2 log cùng mili-giây.

#### Bảng 2: `audit_logs_by_service_level` (Truy vấn theo Service + Level + Date)
```sql
CREATE TABLE audit_log_system.audit_logs_by_service_level (
    service_name text,
    level text,
    log_date date,
    log_time timestamp,
    log_id uuid,
    action text,
    user_id text,
    ip_address text,
    message text,
    details text,
    PRIMARY KEY ((service_name, level, log_date), log_time, log_id)
) WITH CLUSTERING ORDER BY (log_time DESC, log_id ASC);
```

#### Bảng 3: `audit_logs_by_id` (Truy vấn điểm chính xác $O(1)$ theo Log ID)
```sql
CREATE TABLE audit_log_system.audit_logs_by_id (
    log_id uuid,
    service_name text,
    log_date date,
    log_time timestamp,
    level text,
    action text,
    user_id text,
    ip_address text,
    message text,
    details text,
    PRIMARY KEY (log_id)
);
```

#### Bảng 4: `services` (Danh mục Microservices)
```sql
CREATE TABLE audit_log_system.services (
    service_id uuid,
    service_name text,
    description text,
    status boolean,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY (service_id)
);
CREATE INDEX idx_services_name ON audit_log_system.services (service_name);
```

#### Bảng 5: `users` (Tài khoản người dùng & Phân quyền RBAC)
```sql
CREATE TABLE audit_log_system.users (
    user_id uuid,
    username text,
    password_hash text,
    full_name text,
    email text,
    role text,
    status text,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY (username)
);
CREATE INDEX idx_users_id ON audit_log_system.users (user_id);
```
- **Partition Key:** `username text` tối ưu tuyệt đối cho luồng đăng nhập (Point Lookup $O(1)$ token Murmur3, không dùng `ALLOW FILTERING`).
- **Mật khẩu:** Băm một chiều bằng `bcrypt` (cost factor 10), tuyệt đối không lưu plain text.

---

## 3. DANH SÁCH FILE CQL (CASSANDRA SCRIPTS)

Toàn bộ kịch bản DDL/DML nằm trong thư mục [`database/`](file:///d:/NoSQL10/audit-log-system/database):
1. [`01_keyspace.cql`](file:///d:/NoSQL10/audit-log-system/database/01_keyspace.cql): Khởi tạo keyspace `audit_log_system` với `SimpleStrategy`, Replication Factor = 1.
2. [`02_tables.cql`](file:///d:/NoSQL10/audit-log-system/database/02_tables.cql): Tạo 4 bảng Wide-Column tuân thủ triết lý Query-First.
3. [`03_seed_services.cql`](file:///d:/NoSQL10/audit-log-system/database/03_seed_services.cql): Nạp 4 microservices chuẩn: `Auth`, `User`, `Order`, `Payment`.
4. [`04_queries.cql`](file:///d:/NoSQL10/audit-log-system/database/04_queries.cql): Tập hợp 9 câu truy vấn mẫu (Q1 &rarr; Q9) không dùng `ALLOW FILTERING`.
5. [`05_ttl_demo.cql`](file:///d:/NoSQL10/audit-log-system/database/05_ttl_demo.cql): Kịch bản demo cú pháp `USING TTL 30;` và hàm `TTL(message)`.
6. [`06_users_rbac.cql`](file:///d:/NoSQL10/audit-log-system/database/06_users_rbac.cql): Bảng quản trị người dùng, phân quyền RBAC và băm mật khẩu bcrypt.

---

## 4. YÊU CẦU MÔI TRƯỜNG & PHẦN MỀM

- **Hệ điều hành:** Windows 10 hoặc Windows 11 (64-bit).
- **Trình thông dịch lệnh:** **Windows PowerShell** (hoặc Windows Terminal).
- **Docker Desktop:** Phiên bản 4.x trở lên, sử dụng WSL 2 Backend Engine.
- **Node.js:** Phiên bản v18.0.0 trở lên (Đã kiểm thử tối ưu trên Node.js v24.x).
- **RAM tối thiểu:** 8 GB (Khuyến nghị 16 GB để phân bổ 2 GB cho JVM Cassandra).

---

## 5. HƯỚNG DẪN CÀI ĐẶT VÀ VẬN HÀNH TỪNG BƯỚC (WINDOWS POWERSHELL)

### BƯỚC 1: Khởi động Cụm Apache Cassandra qua Docker

Mở **PowerShell**, di chuyển tới thư mục dự án và bật container:

```powershell
cd d:\NoSQL10\audit-log-system

# Khởi chạy container Cassandra
docker compose up -d
```

Kiểm tra trạng thái container:
```powershell
docker ps
```
*Kết quả:* Container `cassandra_audit_node` đang chạy và bind cổng `9042:9042`.

---

### BƯỚC 2: Kiểm tra trạng thái Node với `nodetool status`

Chờ khoảng 30 giây để JVM Cassandra hoàn tất quá trình khởi động, sau đó kiểm tra ring:

```powershell
docker exec -it cassandra_audit_node nodetool status
```

**Kết quả tiêu chuẩn:**
```text
Datacenter: datacenter1
=======================
Status=Up/Down
|/ State=Normal/Leaving/Joining/Moving
--  Address     Load       Tokens  Owns (effective)  Host ID                               Rack
UN  172.19.0.2  104.36 KiB 16      100.0%            af354382-22d8-427d-9e8d-4be776791b45 rack1
```
> Trạng thái **`UN`** = **Up / Normal** biểu thị node đã sẵn sàng nhận kết nối CQL.

---

### BƯỚC 3: Khởi tạo Keyspace và Schema CQL

Chạy script tự động khởi tạo database của backend:
```powershell
npm run db:init --prefix backend
```

Hoặc nạp trực tiếp file CQL qua `cqlsh`:
```powershell
Get-Content database\01_keyspace.cql | docker exec -i cassandra_audit_node cqlsh
Get-Content database\02_tables.cql | docker exec -i cassandra_audit_node cqlsh
Get-Content database\03_seed_services.cql | docker exec -i cassandra_audit_node cqlsh
Get-Content database\06_users_rbac.cql | docker exec -i cassandra_audit_node cqlsh
```

---

### BƯỚC 4: Nạp 400 Dummy Data Phân Bố Chuẩn

Chạy script sinh dữ liệu chuẩn xác phục vụ bảo vệ đồ án:
```powershell
npm run seed:dummy
```

**Phân bố 400 bản ghi audit log thực tế:**
- **Auth (100 logs):** `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `RESET_PASSWORD`.
- **User (100 logs):** `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`, `VIEW_USER`.
- **Order (100 logs):** `CREATE_ORDER`, `UPDATE_ORDER`, `CANCEL_ORDER`, `DELETE_ORDER`.
- **Payment (100 logs):** `CREATE_PAYMENT`, `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `REFUND`.
- **Đầy đủ 3 cấp độ:** `INFO`, `WARN`, `ERROR`.
- **Phân tán thời gian:** Trải dài trên 7 ngày với timestamp mili-giây không trùng lặp.
- **Bảo mật:** Không chứa mật khẩu, token hay số thẻ ngân hàng.

---

### BƯỚC 5: Khởi động Backend REST API

Mở tab PowerShell mới:
```powershell
cd d:\NoSQL10\audit-log-system
npm run backend:dev
```
- **Port:** `http://localhost:5000`
- **Healthcheck:** `http://localhost:5000/api/health`

---

### BƯỚC 6: Khởi động Frontend Web Dashboard

Mở tab PowerShell mới:
```powershell
cd d:\NoSQL10\audit-log-system
npm run frontend:dev
```
- **URL Dashboard:** `http://localhost:5173`
- **Tài khoản Demo (RBAC 3 cấp độ):**
  - **ADMIN:** `admin` / `admin123` (Quản trị User, Services, Cluster, TTL)
  - **OPERATOR:** `operator` / `operator123` (Đọc Logs, Đọc Services, Demo Operations)
  - **VIEWER:** `viewer` / `viewer123` (Chỉ đọc Logs & Dashboard)

---

## 6. DANH SÁCH LỆNH CHẠY NHANH TỪ THƯ MỤC GỐC (ROOT RUNNERS)

Từ thư mục gốc `d:\NoSQL10\audit-log-system`, bạn có thể chạy tất cả các tác vụ qua `package.json`:

| Lệnh | Ý nghĩa chức năng |
| :--- | :--- |
| `npm run dev` | In hướng dẫn mở 2 terminal khởi động Backend & Frontend |
| `npm run backend:dev` | Chạy Backend Express ở chế độ Hot-reload (Port 5000) |
| `npm run frontend:dev` | Chạy Frontend Vite Dashboard (Port 5173) |
| `npm run build` | Biên dịch TypeScript và build bundle cho cả Backend và Frontend |
| `npm run seed:dummy` | Sinh 400 Audit Log chuẩn vào Cassandra |
| `npm run test` | Chạy bộ kiểm thử tự động (Unit validation & Cassandra integration) |
| `npm run test:perf` | Chạy bộ đo lường hiệu năng thời gian thực PT-01 &rarr; PT-06 |
| `npm run demo:ttl` | Chạy demo tự động kiểm tra tính năng TTL 30 giây trên Terminal |

---

## 7. DEMO CASSANDRA NATIVE TTL TRONG 30 GIÂY

### Cách 1: Demo trực quan trên Giao diện Web
1. Mở menu **"TTL Demo (30s)"** (`/ttl-demo`).
2. Nhấn nút **`[ Insert TTL Log (30s Lifespan) ]`**.
3. Đồng hồ đếm ngược chạy từ 30s về 0s, đồng thời hệ thống query Cassandra mỗi 2s bằng `TTL(message)`.
4. Sau 30s, Cassandra trả về 0 rows &rarr; Giao diện chuyển sang **"EXPIRED & PURGED (0 ROWS RETURNED)"**.

### Cách 2: Demo trên dòng lệnh Terminal
```powershell
npm run demo:ttl
```

### Cách 3: Demo qua CQLSH
```powershell
docker exec -i cassandra_audit_node cqlsh -u cassandra -p cassandra < database/05_ttl_demo.cql
```

---

## 8. HỆ THỐNG TÀI LIỆU DỰ ÁN (DOCUMENTATION SITEMAP)

| Tài liệu | Nội dung chi tiết |
| :--- | :--- |
| [`docs/AUTHORIZATION.md`](file:///d:/NoSQL10/audit-log-system/docs/AUTHORIZATION.md) | **Đặc tả Phân quyền RBAC, Ma trận API, Bảo mật Mật khẩu Bcrypt, An toàn Admin** |
| [`docs/DEMO.md`](file:///d:/NoSQL10/audit-log-system/docs/DEMO.md) | **Kịch bản bảo vệ đồ án chi tiết từng phút**, kịch bản Demo Auth/RBAC 3 phút |
| [`docs/API.md`](file:///d:/NoSQL10/audit-log-system/docs/API.md) | Đặc tả 100% các REST API endpoints, Request/Response mẫu, mã lỗi HTTP |
| [`docs/TESTING.md`](file:///d:/NoSQL10/audit-log-system/docs/TESTING.md) | Báo cáo chi tiết 40 ca kiểm thử tự động và kịch bản Performance Benchmark |
| [`docs/CASSANDRA_DESIGN.md`](file:///d:/NoSQL10/audit-log-system/docs/CASSANDRA_DESIGN.md) | Phân tích kiến trúc NoSQL Wide-Column, Partition Key, Denormalization |
| [`docs/TROUBLESHOOTING.md`](file:///d:/NoSQL10/audit-log-system/docs/TROUBLESHOOTING.md) | **Cẩm nang xử lý 10 lỗi thường gặp** (Docker, Port, nodetool, TTL, CORS) |
| [`docs/PERFORMANCE.md`](file:///d:/NoSQL10/audit-log-system/docs/PERFORMANCE.md) | Báo cáo số liệu đo đạc hiệu năng thời gian thực PT-01 đến PT-06 |
