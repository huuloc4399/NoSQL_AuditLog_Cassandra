# Xem Cassandra bằng giao diện Windows

Mở `OPEN_CASSANDRA_GUI.bat` trong thư mục dự án. Đây là DbGate Community 7.3.2, bản Windows chạy riêng, miễn phí.

1. Trong phần Connections bên trái, mở **AuditFlow - Cassandra local**.
2. Mở database **audit_log_system** rồi mở danh sách **Tables**.
3. Nhấp đúp vào bảng, hoặc chọn **Open data** trong menu chuột phải, để xem dữ liệu dạng hàng/cột. Chọn phần cấu trúc bảng để xem các cột và khóa.
4. Dùng nút làm mới khi vừa thao tác trên website để xem dữ liệu mới.

Các bảng hiện có: `audit_logs`, `audit_logs_by_id`, `audit_logs_by_service_level`, `services`, `users`.

Kết nối đã lưu sẵn:

| Mục | Giá trị |
| --- | --- |
| Loại database | Cassandra |
| Server | 127.0.0.1 |
| Port | 9042 |
| Local data center | datacenter1 |
| Database / keyspace | audit_log_system |
| Username / password | Để trống cho cấu hình demo cục bộ này |

Kết nối mặc định ở chế độ xem dữ liệu (Read only). Nếu cần chỉnh sửa, có thể đổi trong phần Edit connection của DbGate.

DbGate chạy trên Windows và kết nối đến Cassandra thật đang chạy trong Ubuntu WSL2. Cassandra không kèm giao diện quản trị; DbGate là ứng dụng riêng để xem và truy vấn dữ liệu. Không có bản sao dữ liệu thứ hai.

Nếu không kết nối được, mở `START_REAL_DEMO.bat` để khởi động Cassandra và website, rồi kết nối lại trong DbGate. Đóng DbGate không làm dừng Cassandra.

Ứng dụng: `D:\NOSQL_NHOM7_AuditLog_Cassandra\tools\DbGate\DbGate.exe`.

Kết nối đã lưu: `.runtime\dbgate-workspace\connections.jsonl`. Cấu hình cửa sổ: `.runtime\dbgate-profile`.

Nguồn chính thức: https://www.dbgate.io/download-community/

Bản tải: https://github.com/dbgate/dbgate/releases/tag/v7.3.2

SHA256 của ZIP Windows x64: `be05ba046bf1532ac1ccd6b7acdd7bebac1224d295780b5be2bf65b724de1eea`.

Truy vấn xem dữ liệu mẫu trong CQL editor:

```sql
SELECT * FROM audit_log_system.services;
SELECT username, full_name, role, status FROM audit_log_system.users;
SELECT service_name, log_time, level, action, message
FROM audit_log_system.audit_logs LIMIT 20;
```
