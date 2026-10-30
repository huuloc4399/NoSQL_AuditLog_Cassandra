# Cập nhật ổ dữ liệu ngày 30 tháng 10 năm 2026

Máy này hiện dùng WSL **AuditFlow-Local**, tài khoản Linux `traffic`, ổ VHD tại `D:\NOSQL_NHOM7_AuditLog_Cassandra\.runtime\wsl-local\ext4.vhdx` trên SSD nội bộ. Các file BAT tự đọc `.runtime/wsl-config.json`; tiếp tục chạy START_REAL_DEMO.bat như trước.

Đã xác định ổ USB F phát sinh lỗi đọc/ghi (Windows Disk Event 51). Cassandra báo `Input/output error` tại `conf/triggers`, rồi `Read-only file system` và tự dừng transport. Đồng thời các dump Java/WSL lớn làm đầy ổ C. Đổi mật khẩu cần ghi người dùng và audit nên làm lỗi lưu trữ bộc lộ; không khắc phục bằng cách bỏ ghi audit.

Đã sao chép nguyên VHD sang D, phục hồi journal trên bản sao bằng e2fsck và chạy kiểm tra lại với exit 0 theo [hướng dẫn phục hồi VHD của Microsoft](https://learn.microsoft.com/en-us/windows/wsl/disk-space#how-to-repair-a-vhd-mounting-error). Bản gốc trên F vẫn được giữ nguyên. Log kiểm tra, checksum bản sao trước sửa và các dump được lưu riêng trong `.runtime/recovery-20261030`. Không đưa `.runtime` lên GitHub.

Đã chuyển các dump sang D để giải phóng khoảng 11,8 GiB trên C và đặt `maxCrashDumpCount=1` trong `%UserProfile%\.wslconfig` theo [cấu hình WSL](https://learn.microsoft.com/en-us/windows/wsl/wsl-config). Cấu hình này có phạm vi toàn WSL. START_REAL_DEMO kiểm tra dung lượng ổ hệ thống, launcher kiểm tra khả năng ghi/fsync trước khi chạy Cassandra, và chờ API reconnect sau khi DB mở cổng. Foreground Cassandra được ghi PID để dừng sạch bằng SIGTERM, không khởi chạy trùng.

Đã thử trên tài khoản tạm: 5 lần đổi mật khẩu, mật khẩu cũ bị từ chối, mật khẩu mới đăng nhập được; 5 sự kiện CHANGE_PASSWORD tồn tại đủ trong 3 bảng audit, không chứa mật khẩu. Theo dõi thêm 120 giây: 123 kiểm tra health thành công, 0 lần mất kết nối. Tài khoản thử đã được xóa; các tài khoản hiện có không bị đổi mật khẩu.

# Lịch sử khôi phục khởi động ngày 27 tháng 10 năm 2026

Ổ đĩa Ubuntu gốc hiện ở `F:\BigData\traffic_rebuild\runtime\wsl\Ubuntu-22.04\ext4.vhdx`; đăng ký WSL cũ vẫn tham chiếu ổ D nên không khởi động được. Đã dùng `wsl --import-in-place` để đăng ký chính ổ đĩa hiện có dưới tên `AuditFlow-Recovered`, giữ dữ liệu và tài khoản Linux `traffic`. Không cài lại hoặc khởi tạo database mới.

Các tiện ích START_REAL_DEMO, STOP_REAL_DEMO, CHECK_CASSANDRA, OPEN_CASSANDRA và CHECK_DEMO_LOGS dùng chung `scripts/project-wsl.ps1`. Cấu hình riêng máy ở `.runtime/wsl-config.json`; máy chưa có cấu hình vẫn dùng `Ubuntu-22.04`. Có thể đặt biến `CASSANDRA_WSL_DISTRO` để chọn tên bản WSL khác. Không cần đổi bản WSL mặc định của Windows.

Đã chạy lại script bằng Windows PowerShell của file BAT: website 5173, API 5000 và Cassandra 9042 hoạt động. Đăng nhập User, thêm giỏ, đặt đơn, thanh toán lỗi rồi thành công đã đạt; bốn sự kiện được đọc lại đủ 12 bản ghi trong ba bảng Audit Log. Hai bảng cửa hàng cũ đã xóa bằng lệnh bảo trì. Hiện còn `audit_logs`, `audit_logs_by_service_level`, `audit_logs_by_id`, `services`, `users`.

Nếu sau này đổi ổ đĩa, lỗi khởi động sẽ nêu đúng đường dẫn VHDX bị thiếu thay vì báo chung “Ubuntu-22.04 WSL is required”. Giữ ổ đĩa gốc và cập nhật đăng ký/config WSL trước khi chạy lại.

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
| Môi trường | Ubuntu 22.04 trong WSL2, tên đăng ký hiện tại `AuditFlow-Recovered` |
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

Giao diện User là Nếp Store, dùng sản phẩm tĩnh và lưu giỏ/đơn mẫu trên trình duyệt. Cassandra thật giữ tài khoản, danh mục dịch vụ và Audit Log. Mua hàng và thanh toán chỉ tạo sự kiện minh họa, không thu tiền và không lưu đơn trong database.

## Dừng và chạy lại

- `STOP_REAL_DEMO.bat`: dừng các tiến trình của dự án, giữ nguyên dữ liệu.
- `START_REAL_DEMO.bat`: khởi động Cassandra, Backend và website, kiểm tra kết nối rồi mở trình duyệt.
- `START_UI_PREVIEW.bat`: chế độ mô phỏng giao diện cũ, chỉ dùng khi chủ động muốn xem thử không có database. Cần dừng bản đang dùng cổng 5173 trước khi đổi chế độ.

Các tiến trình chạy nền; log khởi động nằm tại `.runtime`. Không chạy `wsl --shutdown` trong lúc demo. Bản cục bộ một node dùng để trình diễn và kiểm thử trên máy này.

## Cửa hàng Nếp Store hiện tại
Danh mục sản phẩm nằm trong frontend; giỏ và đơn mẫu được lưu trên trình duyệt theo tài khoản và chế độ chạy. Backend chỉ tiếp nhận sự kiện mua hàng tại `POST /api/shop/events` rồi ghi ba bản Audit Log. Keyspace có năm bảng nền tảng: `users`, `services`, `audit_logs`, `audit_logs_by_service_level` và `audit_logs_by_id`.

Nếu nâng cấp từ phiên bản từng có `shop_carts` và `shop_orders`, chạy riêng `npm run db:remove-shop-tables` tại backend để bỏ hai bảng cũ. Lệnh này không chạy khi khởi động và giữ nguyên tài khoản, dịch vụ, nhật ký. CQL tương đương ở `database/07_remove_legacy_shop.cql`. Xem DEMO_CUA_HANG.md để thao tác mua hàng mô phỏng; không có thanh toán hoặc giao hàng thật.

