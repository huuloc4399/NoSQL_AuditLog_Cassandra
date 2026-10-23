# Kịch bản bảo vệ Đề tài 10

Kịch bản cho bản Cassandra thật cập nhật ngày 22/10/2026. Website dùng hai vai trò ADMIN và USER. Các thời điểm trong bộ lọc và partition dùng UTC.

## Chuẩn bị trước buổi bảo vệ

1. Tại thư mục D:\NOSQL_NHOM7_AuditLog_Cassandra, chạy START_REAL_DEMO.bat. Trình khởi động giữ dữ liệu cũ, nạp bộ mẫu ban đầu nếu chưa có, rồi chuẩn bị 48 log của hôm nay từ Auth/User/Order/Payment. Bấm lại không tạo trùng.
2. Mở http://127.0.0.1:5173. Admin: admin / admin123. User: user / user12345.
3. Trong Thao tác demo, có thể bấm Chuẩn bị dữ liệu hôm nay rồi Xem lỗi hôm nay. Dữ liệu này được ghi rõ là dữ liệu mẫu trong message và details, tự hết hạn sau 7 ngày.
4. Mở OPEN_CASSANDRA.bat để có CQLSH. CHECK_CASSANDRA.bat kiểm tra node UN. CHECK_DEMO_LOGS.bat tự chọn ngày UTC hôm nay và truy vấn log User cùng lỗi Payment bằng CQLSH.

## SV1 và SV3 Thao tác và chứng minh log

SV1 đăng nhập Admin, vào Dịch vụ: thêm một dịch vụ có tên riêng cho buổi bảo vệ, sửa mô tả rồi xóa dịch vụ đó. Không xóa các dịch vụ chuẩn Auth, User, Order, Payment.

SV3 chạy CHECK_DEMO_LOGS.bat hoặc truy vấn trong CQLSH:

```sql
USE audit_log_system;
SELECT log_time, log_id, action, user_id, details FROM audit_logs
WHERE service_name = 'User' AND log_date = 'NGAY_UTC_HOM_NAY' LIMIT 12;
```

Thay NGAY_UTC_HOM_NAY bằng ngày hiển thị trên Dashboard. Chỉ ra CREATE_SERVICE, UPDATE_SERVICE, DELETE_SERVICE, UUID, actor và service_id. Các API này gộp thay đổi và ba bản sao audit trong logged batch. Có thể dùng CRUD tài khoản thử riêng: sửa họ tên/email hiện tạo UPDATE_USER; không đưa mật khẩu vào log.

## SV2 TTL 30 giây

1. Mở Demo TTL và bấm Tạo nhật ký TTL 30 giây. Sao chép UUID hiển thị.
2. Ngay trong CQLSH chạy lệnh dưới; thay UUID_VUA_TAO bằng UUID thực, bỏ phần chữ giữ chỗ.

```sql
SELECT log_id, action, TTL(message) AS remaining_ttl
FROM audit_logs_by_id WHERE log_id = UUID_VUA_TAO;
```

3. Khi còn hiệu lực có 1 dòng và TTL giảm. Sau hơn 30 giây chạy lại: 0 rows; website báo Bản ghi đã hết hạn. Giải thích USING TTL nằm trong INSERT của cả ba bảng, không phải frontend tự xóa log. Hết hạn khi đọc khác với thu hồi dung lượng vật lý sau compaction.

## SV3 Lọc lỗi trên Dashboard

Trong Nhật ký hoạt động: chọn Payment, ERROR, ngày hôm nay, và dải giờ bao trùm các sự kiện mẫu. Bấm Tìm kiếm, mở chi tiết một log. Bộ mẫu hôm nay có 3 lỗi Payment; tất cả dịch vụ có tổng cộng 12 lỗi mẫu. Số liệu có thể cao hơn nếu đã phát sinh thêm sự kiện thực.

Giải thích bảng audit_logs_by_service_level dùng partition (service_name, level, log_date) và clustering log_time DESC; không cần ALLOW FILTERING. Nếu buổi bảo vệ sang ngày UTC mới trong lúc ứng dụng vẫn mở, bấm Chuẩn bị dữ liệu hôm nay trước khi lọc.

## Kiểm tra và số liệu đi kèm

Backend: npm test (60 kiểm tra), npm run test:rbac (52 kiểm tra), npm run test:audit (22 kiểm tra tiêm lỗi), npm run verify:defense (CRUD thử riêng, kiểm tra ba bản sao và TTL). Frontend: npm run build. npm run test:perf đo 6 bài, kết quả ở PERFORMANCE.md và performance-results.json.

Ngày 22/10/2026 đã kiểm tra trên web: thêm/sửa dịch vụ, tạo TTL đến khi hết hạn, chuẩn bị dữ liệu không trùng, lọc ERROR và bộ lọc kết hợp Payment/ngày/dải giờ. API kiểm tra xóa dịch vụ, CRUD tài khoản thử riêng và đối chiếu ba bảng. CQLSH đã đọc được CREATE/UPDATE/DELETE_SERVICE cùng UPDATE_USER; TTL bản ghi từ web có lúc còn 10 giây và sau đó trả 0 dòng. Các đối tượng thử được tạo riêng rồi dọn; lịch sử audit được giữ.

Đề bài yêu cầu Audit Log, không yêu cầu giỏ hàng hoặc thanh toán thật. Các tình huống Order/Payment ở trang demo chỉ phát sinh sự kiện minh họa. Không trình bày chúng như một hệ thống bán hàng đã hoàn thiện.
