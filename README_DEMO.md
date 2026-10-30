# AuditFlow demo với Cassandra thật

Bản cập nhật 22/10/2026 đáp ứng các nhóm chức năng trong ĐỀ TÀI 10.docx: tiếp nhận và tra cứu Audit Log, quản lý dịch vụ, TTL 30 giây và demo Cassandra. Hai vai trò: ADMIN và USER.

## Mở ứng dụng

Chạy START_DEMO.bat hoặc START_REAL_DEMO.bat rồi mở http://127.0.0.1:5173.

| Vai trò | Tài khoản | Mật khẩu demo |
| --- | --- | --- |
| Admin | admin | admin123 |
| User | user | user12345 |

Cassandra 4.1.12 chạy trong Ubuntu 22.04 WSL2 (tên đăng ký `AuditFlow-Recovered` trên máy này) tại 127.0.0.1:9042, keyspace audit_log_system. Bộ mẫu ban đầu có 400 log từ 4 dịch vụ. Mỗi lần khởi động chuẩn bị thêm 48 log mẫu của ngày UTC hiện tại, đủ INFO/WARN/ERROR; chạy lại cùng ngày không tạo trùng. Mẫu theo ngày tự hết hạn sau 7 ngày, dữ liệu cũ được giữ nguyên.

## User chạy demo

Trang nhật ký, thống kê log và API `/api/logs` chỉ dành cho **ADMIN**. **USER** không có liên kết nhật ký trong cửa hàng; truy cập thẳng `/logs` sẽ báo không có quyền, gọi API tra cứu nhận HTTP 403. Các thao tác mua hàng của USER vẫn được ghi audit để ADMIN tra cứu.

Admin có nút **Mở CQL** ở góc dưới bên phải trong chế độ kết nối thật. Chọn truy vấn mẫu hoặc nhập `SELECT`, `DESCRIBE TABLES`, `DESCRIBE TABLE tên_bảng`, `USE audit_log_system`, rồi nhấn **Chạy CQL** hoặc **Ctrl + Enter**. Các mẫu ngày dùng UTC hiện tại; mẫu TTL nhận UUID từ trang Demo TTL. Cửa sổ có thể thu gọn bằng nút dấu trừ hoặc Esc. Console chỉ đọc 5 bảng dự án, tối đa 100 dòng mỗi lần, không trả cột mật khẩu; API `POST /api/admin/cql` kiểm tra quyền ADMIN. Các thao tác thêm/sửa/xóa vẫn thực hiện trên giao diện nghiệp vụ để ghi audit. Chạy `npm run test:cql` trong backend để kiểm thử console.

Đăng nhập User sẽ mở **Nếp Store**: xem bốn sản phẩm có ảnh, chọn mua, chỉnh giỏ hàng, điền địa chỉ mẫu, đặt hàng rồi thanh toán giả lập. Có lịch sử đơn, hủy đơn chưa trả tiền, tình huống trả tiền bị từ chối/timeout và thử lại. Giỏ và đơn mẫu lưu trên trình duyệt theo tài khoản; các thao tác gửi Audit Log về Cassandra. Không thu tiền hay giao hàng. Admin vẫn mở Dashboard Audit Log. Trang đăng nhập đã bỏ phần giới thiệu, chỉ giữ biểu mẫu. Chi tiết và đề xuất sau khi đọc n7.docx: **DEMO_CUA_HANG.md**.

## Các tiện ích

Sản phẩm, giỏ và đơn là dữ liệu mô phỏng ở giao diện. Cassandra chỉ giữ năm bảng nền tảng cho Audit Log, dịch vụ và tài khoản; không tạo bảng sản phẩm hoặc bảng cửa hàng. Lịch sử đơn không đồng bộ sang máy khác.

- STOP_REAL_DEMO.bat: dừng tiến trình của dự án, giữ database.
- OPEN_CASSANDRA.bat: mở CQLSH tương tác.
- CHECK_CASSANDRA.bat: kiểm tra node UN và số bản ghi.
- CHECK_DEMO_LOGS.bat: CQLSH đọc log CRUD người dùng/dịch vụ và lỗi Payment của hôm nay.
- OPEN_CASSANDRA_GUI.bat: mở DbGate đã cài trên máy này, kết nối AuditFlow - Cassandra local.
- START_UI_PREVIEW.bat: bản mô phỏng riêng, không dùng để chứng minh database thật.
- START_NGROK_DEMO.bat: khởi động demo Cassandra thật, build giao diện chia sẻ rồi mở ngrok. Link hiện trong cửa sổ và lưu ở `.runtime/ngrok-url.txt`; chạy lại dùng tunnel đang có trên cổng 5180.
- STOP_NGROK_DEMO.bat: dừng ngrok do dự án quản lý, giữ website và database cục bộ. STOP_REAL_DEMO.bat cũng dừng ngrok trước khi dừng ứng dụng.

## Chia sẻ demo bằng ngrok

Để chạy liên tục, dùng `START_CONTINUOUS_DEMO.bat`. Windows Task Scheduler chạy tiến trình giám sát độc lập với cửa sổ BAT và Codex, không giới hạn thời gian chạy. Tiến trình kiểm tra API/Cassandra, giao diện, máy chủ chia sẻ và ngrok mỗi 20 giây, gọi lại launcher khi có lỗi; tiến trình API/giao diện/chia sẻ bị treo chỉ được thay sau ba lần kiểm tra thất bại. Ngrok tự kết nối lại khi mạng trở lại. Trong thời gian giám sát, Windows được yêu cầu giữ máy thức; không thay đổi cấu hình nguồn toàn hệ thống. Trạng thái ở `.runtime/demo-supervisor.status.json`, nhật ký ở `.runtime/demo-supervisor.log`, link ở `.runtime/ngrok-url.txt`. Chạy lại BAT sẽ dùng tiến trình giám sát đang có. `STOP_NGROK_DEMO.bat` dừng giám sát trước khi đóng tunnel; `STOP_REAL_DEMO.bat` dừng toàn bộ demo và giữ dữ liệu. Giữ Windows đăng nhập, nguồn điện và Internet; mất điện/mạng, đăng xuất, khởi động lại hoặc chủ động Sleep vẫn có thể làm gián đoạn. Task được khởi chạy theo yêu cầu, không tự bật sau khi đăng nhập/khởi động lại; chạy lại BAT khi cần.

Trên máy đã cài ngrok và cấu hình tài khoản, nhấp đúp `START_NGROK_DEMO.bat`; không cần mở riêng các cửa sổ Node.js/ngrok. Script mở trình duyệt tới link HTTPS `/login`. Có thể đóng cửa sổ BAT sau khi link xuất hiện, nhưng giữ máy bật và có Internet trong lúc test. Nếu ngrok hiển thị trang cảnh báo, chọn Visit Site.

Giao diện chia sẻ phục vụ trên `127.0.0.1:5180` và chuyển tiếp `/api` tới backend 5000. Không sửa token ngrok hoặc đưa cấu hình tài khoản vào mã nguồn. Nếu ngrok chưa có trong PATH hoặc chưa xác thực, cài/cấu hình ngrok trên máy trước. Khi mở tunnel bằng tay, đóng ở cửa sổ đã chạy ngrok; script dừng chỉ đóng tiến trình khớp PID, thời gian khởi động và đường dẫn đã ghi của dự án.

Để chạy từ PowerShell mà không mở trình duyệt: `./START_NGROK_DEMO.bat -NoBrowser`. Thêm `-SkipBuild` chỉ khi `dist-api` đã được build từ code hiện tại. Đây là link dùng chung bộ dữ liệu demo và phân quyền hiện có của ứng dụng.

## Các điểm đã hoàn thiện

Đọc code theo barem: xem `DeTai10_Nhom07_AuditLog_Cassandra/audit-log-system/docs/GIAI_THICH_CODE_THEO_BAREM.md`. Tìm `BAREM` trong source để thấy comment tiếng Việt về khóa bảng, CRUD và ghi audit, TTL, bộ lọc, dữ liệu mẫu và hiệu năng; tài liệu kèm luồng gọi hàm và các câu CQL để kiểm chứng.

Sửa tài khoản có UPDATE_USER. Thay đổi người dùng/dịch vụ và ba bản sao audit được gộp vào logged batch; không bỏ qua lỗi ghi. API trả lỗi khi chưa được Cassandra xác nhận, cache không cập nhật sớm. Có nút Chuẩn bị dữ liệu hôm nay và Xem lỗi hôm nay. Kết quả đo hiệu năng đã cập nhật đúng WSL.

Đã đạt 134 kiểm tra tự động (60 chức năng/tích hợp, 52 HTTP/phân quyền, 22 tiêm lỗi), 6 bài hiệu năng và bài diễn tập sống với CQLSH. Backend/Frontend build thành công.

Cập nhật cửa hàng ngày 27/10: đã bỏ phần lưu giỏ/đơn trong Cassandra và các API nghiệp vụ tương ứng, giữ endpoint ghi sự kiện. `npm run test:shop` đạt 72 kiểm tra cho dữ liệu trình duyệt và API Audit Log; `npm run test:audit` đạt 22 kiểm tra. Kết quả 80 kiểm tra sống trong docs/shop-verification.json thuộc phiên bản cũ lưu giỏ/đơn ở DB, không dùng để xác nhận kiến trúc hiện tại. Đã khôi phục WSL, chạy thành công `npm run db:remove-shop-tables` và xác nhận còn năm bảng nền tảng. Luồng mua hàng với API thật đã đạt; bốn sự kiện đều có đủ ba bản sao trong Cassandra. Chi tiết đường dẫn ổ đĩa và cấu hình WSL ở REAL_DATABASE.md.

## Tài liệu hiện tại

REAL_DATABASE.md: vị trí database và vận hành. CASSANDRA_GUI.md: xem bảng trên Windows. DANH_GIA_DE_TAI_10.md: đối chiếu yêu cầu sau sửa. Mã nguồn tại DeTai10_Nhom07_AuditLog_Cassandra/audit-log-system; docs/DEMO.md là kịch bản bảo vệ, docs/CASSANDRA_DESIGN.md là thiết kế, docs/PERFORMANCE.md và JSON là số đo mới, docs/TESTING.md là phạm vi kiểm thử.

Các tài liệu phát hành cũ có thông báo lịch sử ở đầu; ưu tiên bộ tài liệu nêu trên. File Word/ZIP gốc được giữ nguyên. ZIP mã nguồn cập nhật là AuditFlow_Cassandra_Real_Demo.zip, không bao gồm node_modules, mật khẩu cấu hình .env, dữ liệu WSL hay bộ cài DbGate. DbGate đã có sẵn trên máy này; máy khác có thể tải Community từ trang chính thức theo CASSANDRA_GUI.md.

Đề bài tập trung vào Audit Log. Cửa hàng tạo bối cảnh nghiệp vụ để demo; giá, ảnh, thanh toán và giao hàng đều là minh họa. Không có cổng thanh toán hay quản lý kho thật. Tunnel chỉ hoạt động khi đã chạy công cụ chia sẻ và máy vẫn có Internet.
