# Kiểm thử bản Cassandra thật ngày 22 tháng 10 năm 2026

| Bộ kiểm tra | Kết quả |
| --- | --- |
| npm test | 60 đạt, 0 lỗi; bao gồm kết nối Cassandra, CRUD, query, TTL đang còn hiệu lực |
| npm run test:rbac | 52 đạt; HTTP Admin/User, token, 9 tình huống cá nhân, chống giả mạo đối tượng, lỗi ghi và quyền chuẩn bị dữ liệu hôm nay |
| npm run test:audit | 22 đạt; batch gồm nghiệp vụ và ba bảng audit, tiêm lỗi 503, cache không cập nhật sớm |
| npm run test:perf | 6 bài đạt; 900 lần ghi sự kiện và 150 truy vấn, không thao tác thất bại |
| npm run verify:defense | Đạt CRUD thử riêng, UPDATE_USER ba bản sao, dữ liệu theo ngày không trùng và TTL hết hạn cả ba bảng |
| npm run verify:shop | 80 đạt với Cassandra thật: giỏ/đơn lưu DB, giá máy chủ, request lặp/đồng thời, retry trả tiền, hủy, cách ly hai tài khoản, đối chiếu ba bảng audit |
| Backend và Frontend build | Đạt |

Tổng cộng 134 kiểm tra trong ba bộ tự động đầu tiên. Các bài hiệu năng và diễn tập sống được ghi riêng, không cộng gộp thành một con số test mới.

Bằng chứng thực tế: `.runtime/defense-verification.json` ở thư mục gốc dự án. Thao tác trên web và CQLSH được mô tả ở DEMO.md; ảnh AuditFlow-TTL-verified.jpg và AuditFlow-demo-verified.jpg lưu tại gốc.

Kiểm thử tiêm lỗi dùng các dependency được thay thế trong tiến trình thử riêng, không tắt Cassandra của người dùng. Bài kiểm tra sống tạo tài khoản/dịch vụ thử có tên riêng và dọn các đối tượng đó; log được giữ lại. TTL dùng bản ghi riêng tự hết hạn. Benchmark dùng keyspace riêng, bản ghi hết hạn sau 1 giờ.

Các bộ test hiện có một số nhãn OPERATOR/VIEWER lịch sử trong tên tình huống; phân quyền được kiểm tra và ứng dụng đang chạy chỉ dùng ADMIN và USER. Không có vai trò thứ ba trong bản demo.

Giao diện User hiện là Nếp Store. Đã thao tác thật: xem chi tiết tai nghe, mua, tăng số lượng, điền địa chỉ mẫu, tạo đơn, trả tiền bị từ chối, thử lại thành công, tải lại lịch sử đơn vẫn tồn tại. Ảnh NepStore-checkout-verified.jpg và NepStore-storefront.jpg ở gốc. Báo cáo riêng: shop-verification.json. Giỏ/đơn/tài khoản kiểm thử tạm được dọn, audit giữ để truy vết. Bộ 60 + 52 + 22 cũng đã chạy lại và đạt sau khi thêm cửa hàng.
