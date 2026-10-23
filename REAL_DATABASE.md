# Cập nhật vận hành ngày 22 tháng 10 năm 2026

START_REAL_DEMO.bat hiện tự chuẩn bị 48 log mẫu của hôm nay (UTC) sau khi bảo toàn dữ liệu cũ. Có thể bấm Chuẩn bị dữ liệu hôm nay trong Thao tác demo khi buổi trình bày sang ngày mới. Dữ liệu cùng ngày có UUID cố định, không tạo trùng, TTL 7 ngày. Các log mẫu được đánh dấu rõ trong nội dung và details.

Thay đổi người dùng/dịch vụ, đăng ký và đổi mật khẩu được ghi cùng ba bản sao audit bằng logged batch. Đã bổ sung UPDATE_USER cho họ tên/email, bỏ các nhánh bỏ qua lỗi. Logged batch không có isolation nhiều partition như giao dịch SQL; nếu timeout cần đọc lại trạng thái trước khi thử lại.

Chạy CHECK_DEMO_LOGS.bat để CQLSH kiểm chứng sự kiện và lỗi Payment theo ngày UTC hiện tại. OPEN_CASSANDRA_GUI.bat mở DbGate trên Windows. Backend có npm run verify:defense để diễn tập bằng đối tượng thử riêng và kiểm tra TTL hết hạn cả ba bảng; npm run test:perf ghi kết quả mới tại docs/PERFORMANCE.md và docs/performance-results.json, dùng keyspace benchmark riêng với TTL 1 giờ.

Đã đạt 134 kiểm tra tự động và 6 bài hiệu năng trên WSL. Hướng dẫn bảo vệ cập nhật tại docs/DEMO.md. Các thông tin kỹ thuật bên dưới mô tả cài đặt cục bộ đã thực hiện; số log tăng theo các thao tác và các lần kiểm tra.

---

# Demo với Cassandra thật

## Mở website

Website đang chạy tại http://127.0.0.1:5173 và dùng API thật tại http://127.0.0.1:5000/api. Nếu đã dừng hoặc khởi động lại máy, chạy `START_DEMO.bat` hoặc `START_REAL_DEMO.bat`.

| Vai trò | Tài khoản | Mật khẩu mẫu |
| --- | --- | --- |
| Admin | admin | admin123 |
| User | user | user12345 |

Các tài khoản trên được lưu trong bảng `audit_log_system.users` với mật khẩu bcrypt. Bản chạy thật không dùng cơ chế đăng nhập hoặc ghi tài khoản dự phòng trong bộ nhớ khi Cassandra lỗi.

## Cấu hình hiện tại

| Thuộc tính | Giá trị |
| --- | --- |
| Môi trường | Ubuntu-22.04 trong WSL2, trên máy này |
| Phiên bản Cassandra | 4.1.12 |
| Cụm | AuditFlow Demo |
| Endpoint | 127.0.0.1:9042 |
| Datacenter | datacenter1 |
| Keyspace | audit_log_system |
| Bộ nhớ heap | 768 MB |
| Thư mục runtime và dữ liệu trong Ubuntu | `/home/traffic/.local/share/auditflow-cassandra/apache-cassandra-4.1.12` |

Cassandra được tải từ Apache và kiểm tra SHA-256 trước khi giải nén. Cài đặt nằm trong thư mục riêng của dự án trong Ubuntu, không thay Java của Windows và không yêu cầu Docker. Dữ liệu không nằm trong bộ nhớ trình duyệt và vẫn còn sau khi dừng các tiến trình.

## Kiểm chứng khi demo

1. Đăng nhập Admin, mở **Trạng thái hệ thống**: phải thấy “Đã kết nối”, `audit_log_system`, phiên bản `4.1.12`.
2. Mở **Thao tác demo**, tạo đơn hàng hoặc phát sinh sự kiện thanh toán. Nhật ký được ghi qua API vào Cassandra.
3. Mở **Nhật ký hoạt động** để lọc hoặc xem chi tiết sự kiện. Có 400 log mẫu được nạp ban đầu; các thao tác và kiểm thử mới sẽ bổ sung log.
4. Mở **Demo TTL**, tạo bản ghi TTL 30 giây và quan sát sự kiện hết hạn từ kết quả API đọc Cassandra.
5. Chạy `CHECK_CASSANDRA.bat` để xem `nodetool status`, thông tin cụm và số bản ghi trực tiếp qua CQLSH.

Trong thư mục `DeTai10_Nhom07_AuditLog_Cassandra/audit-log-system/backend`, có thể chạy:

```powershell
npm run verify:database
npm test
npm run test:rbac
npm run demo:ttl
```

`verify:database` đăng nhập qua HTTP, tạo một sự kiện qua API và kiểm tra cùng mã log trong cả ba bảng Cassandra, đồng thời đối chiếu tài khoản API với bản ghi đã lưu. Báo cáo không chứa token hay mật khẩu, nằm tại `.runtime/real-database-verification.json` ở thư mục dự án chính.

## Kết quả đã kiểm tra trên máy này

- Node ở trạng thái `UN` (Up/Normal), cụm `AuditFlow Demo`, Cassandra `4.1.12`.
- API health trả `UP` từ truy vấn Cassandra thật.
- Đã nạp 400 log mẫu vào ba bảng; chạy lại file khởi động không nạp trùng dữ liệu.
- Đã ghi sự kiện qua HTTP và đối chiếu thành công cả ba bản sao Cassandra.
- Sau khi khởi động lại Backend, tài khoản, phiên đăng nhập và log vẫn đọc được.
- Bản ghi TTL có thời gian còn lại 30 giây lúc mới tạo; sau 32 giây truy vấn không còn bản ghi.
- Bộ kiểm thử hiện có: 60 đạt, 0 lỗi, bao gồm kiểm thử tích hợp Cassandra.
- Bộ kiểm thử HTTP/phân quyền độc lập: 52 đạt, 0 lỗi.

Các sản phẩm và đơn hàng của website bán hàng chưa được triển khai trong bước kết nối này. Bản đang chạy là giao diện AuditFlow hiện có, dùng Cassandra thật cho tài khoản, danh mục dịch vụ và Audit Log. Những tình huống nghiệp vụ trên trang “Thao tác demo” tạo sự kiện minh họa; đây chưa phải một hệ thống thanh toán thật.

## Dừng và chạy lại

- `STOP_REAL_DEMO.bat`: dừng các tiến trình của dự án, giữ nguyên dữ liệu.
- `START_REAL_DEMO.bat`: khởi động Cassandra, Backend và website, kiểm tra kết nối rồi mở trình duyệt.
- `START_UI_PREVIEW.bat`: chế độ mô phỏng giao diện cũ, chỉ dùng khi chủ động muốn xem thử không có database. Cần dừng bản đang dùng cổng 5173 trước khi đổi chế độ.

Các tiến trình chạy nền; log khởi động nằm tại `.runtime`. Không chạy `wsl --shutdown` trong lúc demo. Bản cục bộ một node dùng để trình diễn và kiểm thử trên máy này.

## Cửa hàng Nếp Store (22/10/2026)
Backend khởi tạo thêm shop_carts và shop_orders trong cùng keyspace audit_log_system. Giỏ/đơn được lưu theo user_id; tải lại trang hoặc đăng nhập lại vẫn còn. Các lần đặt hàng/thanh toán/hủy sinh Audit Log thật. Xem DEMO_CUA_HANG.md và database/07_shop.cql. Không có thanh toán hay giao hàng thật.

