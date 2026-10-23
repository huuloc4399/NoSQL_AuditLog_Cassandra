# HƯỚNG DẪN VẬN HÀNH & KỊCH BẢN BÁO CÁO ĐỒ ÁN NOSQL
## ĐỀ TÀI 10: HỆ THỐNG GIÁM SÁT AUDIT LOG VÀ LỊCH SỬ THAO TÁC
**Học phần:** Cơ sở dữ liệu NoSQL | **Giảng viên hướng dẫn:** ThS. Trần Quang Bình  
**Nhóm thực hiện:** Nhóm 07

---

## 👥 1. PHÂN CÔNG THÀNH VIÊN VÀ VAI TRÒ BẢO VỆ (BẢNG 17.1)

| STT | Họ và tên | MSSV | Vai trò chính | Nội dung thuyết trình & Demo trọng tâm |
|---|---|---|---|---|
| **SV1** | **Nguyễn Thị Quyên** | 2001230745 | **Data Architect & CRUD Lead** | - Trình bày lý do chọn Apache Cassandra cho bài toán Write-heavy.<br>- Kiến trúc Keyspace & 3 bảng Query-First.<br>- Demo CRUD Service và chứng minh log tự sinh trong CQLSH. |
| **SV2** | **Nguyễn Hữu Lộc** | 2001230468 | **Advanced Query Specialist** | - Giải thích Partition Key & Clustering Key.<br>- Demo tính năng tự hủy log theo thời gian (TTL 30 giây).<br>- Trình bày các câu truy vấn nâng cao theo Service/Level/Time. |
| **SV3** | **Dương Chí Khải** | 2001230364 | **Fullstack Integrator & DB Tester** | - Trình bày trạng thái cụm Cassandra node (`nodetool status` -> `UN`).<br>- Demo giao diện Dashboard React và bộ lọc sự cố ERROR.<br>- Báo cáo kết quả đo kiểm hiệu năng thực tế (Bảng 13.6 & 13.7). |

---

## 📦 2. CẤU TRÚC GÓI ĐỒ ÁN ĐÓNG GÓI

```text
DeTai10_Nhom07_AuditLog_Cassandra/
├── BaoCao_DeTai10_Nhom07.docx       <- File báo cáo hoàn chỉnh (đầy đủ phân công và số liệu đo thật)
├── HUONG_DAN_SU_DUNG_VA_DEMO.md     <- Hướng dẫn này
├── START_SYSTEM.bat                 <- File 1-Click tự động chạy toàn bộ hệ thống
├── STOP_SYSTEM.bat                  <- File dừng hệ thống an toàn
└── audit-log-system/                <- Toàn bộ mã nguồn đồ án
    ├── docker-compose.yml           <- Cấu hình Apache Cassandra 4.1 container
    ├── database/                    <- 6 file kịch bản CQL (Keyspace, Tables, Seeds, TTL, RBAC)
    ├── backend/                     <- Backend Node.js TypeScript + Cassandra Driver (Port 5000)
    │   ├── src/                     <- Mã nguồn controllers, services, routes, middleware
    │   ├── scripts/                 <- Script benchmark hiệu năng (performanceTest.ts) và TTL demo
    │   └── .env                     <- File cấu hình biến môi trường kết nối CSDL
    ├── frontend/                    <- Frontend React + Vite + TailwindCSS (Port 5173)
    └── docs/                        <- Tài liệu thiết kế chi tiết và kết quả đo benchmark
```

---

## 🚀 3. HƯỚNG DẪN KHỞI CHẠY (DÀNH CHO BẠN BÈ TRONG NHÓM)

### Cách 1: Khởi động 1-Click (Khuyên dùng)
1. Đảm bảo máy tính đã cài đặt **Docker Desktop** và **Node.js** (v18 trở lên).
2. Nhấp đúp chuột vào file **`START_SYSTEM.bat`**.
3. Hệ thống sẽ tự động:
   - Khởi chạy Cassandra container trên cổng `9042`.
   - Bật Backend API tại `http://localhost:5000`.
   - Bật Frontend Dashboard tại `http://localhost:5173`.
   - Tự động mở trình duyệt web lên trang Dashboard.

### Cách 2: Khởi động thủ công bằng dòng lệnh
- **Bước 1: Chạy CSDL Cassandra:**
  ```powershell
  cd audit-log-system
  docker compose up -d
  ```
- **Bước 2: Chạy Backend:**
  ```powershell
  cd audit-log-system\backend
  npm install
  npm run dev
  ```
- **Bước 3: Chạy Frontend:**
  ```powershell
  cd audit-log-system\frontend
  npm install
  npm run dev
  ```
- **Bước 4:** Truy cập trình duyệt: `http://localhost:5173`.

---

## 🔐 4. TÀI KHOẢN ĐĂNG NHẬP PHÂN QUYỀN (RBAC)

| Tài khoản | Mật khẩu | Quyền hạn (Role) | Mô tả chi tiết |
|---|---|---|---|
| **admin** | **admin123** | **ADMIN** | Toàn quyền quản trị: thêm/sửa/xóa Service, tạo log demo, chạy TTL demo, xem toàn bộ log và trạng thái cụm. |
| **operator** | **operator123** | **OPERATOR** | Quyền vận hành: xem log, tạo log nghiệp vụ demo, xem danh mục Service. |
| **viewer** | **viewer123** | **VIEWER** | Quyền kiểm toán viên (Chỉ xem): tra cứu log, bị chặn quyền ghi để bảo vệ tính toàn vẹn dữ liệu. |

---

## 🎙️ 5. KỊCH BẢN THUYẾT TRÌNH & DEMO CHI TIẾT (3 PHÚT / NGƯỜI)

### 👩‍💻 PHẦN 1: SV1 - NGUYỄN THỊ QUYÊN (Data Architect & CRUD Lead)
1. **Lý thuyết:** Giải thích tại sao Audit Log bắt buộc phải dùng Apache Cassandra:
   - Tính chất Audit Log là **Write-heavy** (ghi liên tục hàng nghìn log/giây), phân tán và không bao giờ sửa/xóa log cũ.
   - Cassandra có cơ chế ghi vào **CommitLog** (ghi đĩa tuần tự) và **Memtable** (RAM) giúp tốc độ ghi chỉ mất 1-3 ms.
2. **Demo thao tác:**
   - Vào menu **"Dịch vụ"**: Thêm một Service mới (ví dụ: `NotificationService`).
   - Vào terminal chạy: `docker exec -it cassandra_audit_node cqlsh`
   - Gõ: `SELECT * FROM audit_log_system.services WHERE service_name = 'NotificationService';`
   - Chỉ cho thầy thấy bản ghi dịch vụ đã được lưu vào bảng Cassandra.

### 👨‍💻 PHẦN 2: SV2 - NGUYỄN HỮU LỘC (Advanced Query Specialist)
1. **Lý thuyết:** Giải thích mô hình thiết kế Query-First và cấu trúc khóa:
   - Bảng `audit_logs`: Partition Key `((service_name, log_date))` phân chia partition theo ngày để tránh partition quá lớn; Clustering Key `(log_time DESC)` giúp tự động sắp xếp log mới nhất lên đầu.
   - Bảng `audit_logs_by_service_level`: Partition Key `((service_name, level, log_date))` phục vụ lọc trực tiếp sự cố ERROR mà không dùng `ALLOW FILTERING`.
2. **Demo thao tác (TTL 30s):**
   - Vào menu **"Demo TTL 30s"** trên giao diện web.
   - Bấm nút **"Tạo log có TTL 30s"**.
   - Màn hình đếm ngược từ 30s về 0s. Khi còn hạn: log hiển thị bình thường. Sau đúng 30s: log tự động biến mất hoàn toàn khỏi bảng `audit_logs` của Cassandra mà không tốn lệnh DELETE.

### 👨‍💻 PHẦN 3: SV3 - DƯƠNG CHÍ KHẢI (Fullstack Integrator & DB Tester)
1. **Kiểm tra trạng thái cụm phân tán:**
   - Mở PowerShell gõ: `docker exec -it cassandra_audit_node nodetool status`
   - Giải thích cho thầy cờ **`UN`**: **U = Up** (Node đang sống), **N = Normal** (Hoạt động bình thường, dữ liệu sẵn sàng).
2. **Demo Dashboard & Bộ lọc sự cố:**
   - Mở trang **"Tổng quan"**: Giới thiệu các biểu đồ phân bố log theo Service và mức độ nghiêm trọng.
   - Bấm vào nút **"Filter all errors"** (hoặc vào menu *Nhật ký hệ thống* lọc *ERROR*).
   - Nhấp vào nút **Detail** của một dòng log để hiển thị popup chi tiết (IP, User Agent, JSON Details).
3. **Báo cáo kết quả đo hiệu năng thực tế:**
   - Trình bày số liệu thực tế đã đo trên Docker (Bảng 13.6 và 13.7):
     + **Tốc độ ghi:** 100 - 500 logs chỉ mất **1.82 - 3.36 ms / bản ghi** (~300 - 500 logs/giây).
     + **Tốc độ truy vấn:** Các câu truy vấn Service/Level/Time chỉ mất **3.85 - 4.56 ms**.
   - Khẳng định hệ thống đạt mọi yêu cầu khắt khe của bài toán Enterprise Audit Log.
