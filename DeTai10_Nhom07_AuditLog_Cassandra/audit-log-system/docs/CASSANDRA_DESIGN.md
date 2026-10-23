# Thiết kế dữ liệu Cassandra cho AuditFlow

Phiên bản vận hành được kiểm tra ngày 22/10/2026: Cassandra 4.1.12 trong Ubuntu 22.04 WSL2, cluster AuditFlow Demo, datacenter1, một node, RF=1, consistency ONE. Đây là cấu hình demo cục bộ; chưa chứng minh tính sẵn sàng hoặc chịu lỗi của cụm nhiều node.

## Vì sao chọn Cassandra

Audit Log có lượng ghi liên tục, dữ liệu tăng theo thời gian và các truy vấn thường biết trước dịch vụ, ngày, mức độ hoặc UUID. Cassandra ghi qua CommitLog và Memtable rồi flush ra SSTable; mô hình phân vùng và các bảng theo truy vấn phù hợp với những mẫu truy cập này. Khả năng mở rộng cần được đo trên cấu hình thực tế, không suy ra từ bài đo một node. Không khẳng định Cassandra luôn nhanh hơn mọi hệ quản trị quan hệ.

## Các bảng theo truy vấn

| Bảng | Partition Key | Clustering Key | Mục đích |
| --- | --- | --- | --- |
| audit_logs | (service_name, log_date) | log_time DESC, log_id ASC | Nhật ký dịch vụ theo ngày và khoảng giờ |
| audit_logs_by_service_level | (service_name, level, log_date) | log_time DESC, log_id ASC | Lọc trực tiếp INFO/WARN/ERROR |
| audit_logs_by_id | log_id | Không có | Xem chi tiết theo UUID |
| services | service_id | Không có | Danh mục dịch vụ; index service_name cho bảng danh mục nhỏ |
| users | username | Không có | Tài khoản, mật khẩu băm bcrypt và vai trò ADMIN/USER |

Chia partition theo ngày tránh dồn toàn bộ lịch sử của một dịch vụ vào một partition. Thêm log_id sau log_time phân biệt các sự kiện có cùng timestamp. Ngày và giờ tra cứu dùng UTC, được ghi rõ trên giao diện.

Ví dụ truy vấn chính:

```sql
SELECT * FROM audit_logs_by_service_level
WHERE service_name = 'Payment' AND level = 'ERROR' AND log_date = '2026-10-22'
  AND log_time >= '2026-10-22T01:00:00Z'
  AND log_time <= '2026-10-22T22:59:59Z';
```

Các bộ lọc chính định tuyến theo khóa phân vùng; không dùng ALLOW FILTERING. Khi chọn tất cả dịch vụ, backend truy vấn từng partition của các dịch vụ rồi gộp kết quả. Truy vấn nhiều ngày giới hạn tối đa 14 ngày ở backend; giao diện chính chọn một ngày và dải giờ. Dữ liệu lớn cần giới hạn kích thước partition, số truy vấn song song và tải Dashboard phù hợp.

## Ghi dữ liệu và Audit Log

AuditLogService tạo một UUID và timestamp chung rồi dùng client.batch với prepare=true và logged=true cho cả ba bảng log. Không bỏ qua lỗi ở audit_logs_by_id.

Các API quản lý người dùng, đăng ký, đổi mật khẩu và quản lý dịch vụ truyền thêm mutation nghiệp vụ vào cùng logged batch với ba bản sao audit. Cache người dùng chỉ cập nhật sau khi batch được xác nhận. Thay đổi họ tên/email có sự kiện UPDATE_USER với người thực hiện, đối tượng và danh sách trường đã sửa. Mật khẩu và password_hash không đưa vào chi tiết audit.

Logged batch hỗ trợ phát lại các mutation đã được chấp nhận; không phải giao dịch SQL có rollback và isolation giữa mọi partition. Timeout có thể để trạng thái chưa xác định: API trả lỗi thay vì báo thành công, và cần đọc lại dữ liệu trước khi gửi lại. Cache hiện phục vụ một backend demo; chạy nhiều backend cần thiết kế đồng bộ cache và kiểm soát đồng thời riêng.

Nguồn chính thức về giới hạn batch: https://cassandra.apache.org/doc/stable/cassandra/developing/cql/dml.html

## TTL và tính bất biến

Cả ba INSERT đều gắn USING TTL khi đầu vào có TTL. Demo TTL dùng 30 giây, kiểm tra TTL(message) và truy vấn lại sau khi hết hạn. Không có bộ hẹn giờ frontend hoặc cron dùng DELETE để giả lập hết hạn trong chế độ thật.

Dữ liệu hết TTL không còn được trả về khi đọc. Việc thu hồi dung lượng vật lý phụ thuộc compaction, tombstone và điều kiện dọn dẹp; không có cam kết xóa vật lý tức thì sau 30 giây. Các log không truyền TTL vẫn được lưu theo cấu hình bảng hiện tại. 48 log mẫu theo ngày có TTL 7 ngày; dữ liệu benchmark có TTL 1 giờ.

Ứng dụng không cung cấp API sửa/xóa nội dung Audit Log. Điều đó không có nghĩa Cassandra tự chống sửa đổi hoặc cung cấp bằng chứng mật mã: người có quyền truy cập database vẫn có thể sửa dữ liệu. Local demo chưa cấu hình xác thực CQL, nên chỉ dùng cục bộ; triển khai thật cần phân quyền database, xác thực, TLS, sao lưu và vận hành cụm phù hợp.

## Hiệu năng đã đo

Xem PERFORMANCE.md và performance-results.json được tạo lại ngày 22/10/2026. Benchmark có 3 mức ghi (100/300/500 sự kiện) và 3 kiểu truy vấn, đo trên Cassandra WSL thực tế. Nó dùng keyspace audit_log_benchmark riêng, không trộn dữ liệu đo vào ứng dụng. Không suy diễn benchmark nhỏ thành khả năng chịu tải sản xuất.
