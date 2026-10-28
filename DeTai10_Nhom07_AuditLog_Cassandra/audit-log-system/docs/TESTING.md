# Kiểm thử demo

## Kiểm tra trước khi cập nhật GitHub — ngày 28 tháng 10 năm 2026

- Backend `npm run build`: đạt.
- Frontend `npm run build`: đạt.
- `npm run test:shop`: 72 kiểm tra đạt.
- `npm run test:audit`: 22 kiểm tra đạt bằng tiêm lỗi.
- `npm run test:rbac`: 52 kiểm tra HTTP/phân quyền đạt.

Ba bộ test trên chạy trong tiến trình thử với các dependency database được thay thế, không ghi Cassandra thật. Kết quả kiểm tra Cassandra và luồng mua hàng với API thật ngày 27/10 được ghi riêng ở phần dưới.

## Cửa hàng tại giao diện — ngày 27 tháng 10 năm 2026

Sản phẩm, giỏ và đơn mẫu thuộc trình duyệt. Backend không khởi tạo/đọc/ghi bảng cửa hàng, chỉ nhận `POST /api/shop/events` và ghi ba bản Audit Log. Không giữ bảng `shop_orders`, nên không bổ sung bảng đơn vào SRS.

| Bộ kiểm tra | Kết quả |
| --- | --- |
| Backend và Frontend build | Đạt |
| `npm run test:shop` | 72 đạt: giỏ/đơn cục bộ, tách tài khoản và chế độ, yêu cầu lặp/đồng thời trong cùng client, thanh toán lại, hủy, lỗi Audit Log, API xác thực và từ chối giả mạo; batch chỉ có ba bảng audit |
| `npm run test:audit` | 22 đạt bằng tiêm lỗi; không ghi vào Cassandra thật |
| Trình duyệt ở chế độ xem thử | Đạt: bốn sản phẩm và ảnh; thêm giỏ, đặt đơn, thanh toán lỗi rồi thành công, tải lại giữ đơn; ghi đủ bốn loại sự kiện với mã đơn tương ứng; không có lỗi JavaScript |
| Khởi động qua Windows PowerShell của START_REAL_DEMO.bat | Đạt: Cassandra 4.1.12, API 5000 và website 5173; chạy lại giữ dữ liệu, không nạp trùng 48 log hôm nay |
| Mua hàng với API/Cassandra thật sau khôi phục WSL | Đạt: đăng nhập, bốn ảnh, thêm giỏ, tạo đơn, trả tiền lỗi rồi thành công, tải lại; không gọi API giỏ/đơn cũ; đọc lại bốn sự kiện đủ 12 bản ghi trong ba bảng audit |
| `npm run db:remove-shop-tables` | Đạt: đã xóa hai bảng cũ; schema còn đúng năm bảng nền tảng |

Bộ 72 kiểm tra HTTP dùng dịch vụ/driver được thay thế trong tiến trình thử. Phần mua hàng với API thật được kiểm tra riêng sau khi đăng ký lại ổ đĩa Ubuntu gốc tại F: dưới tên `AuditFlow-Recovered`; bằng chứng cục bộ `.runtime/recovered-real-ui.json` và ảnh cùng tên tại gốc dự án. Lệnh dọn bảng cũ chỉ xóa `shop_carts` và `shop_orders`, giữ tài khoản, dịch vụ và nhật ký. Kết quả ngày 22/10 dưới đây thuộc phiên bản cũ.

## Cassandra thật — ngày 22 tháng 10 năm 2026

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
