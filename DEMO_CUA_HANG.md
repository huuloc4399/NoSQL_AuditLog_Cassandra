# Nếp Store — demo mua sắm, cập nhật 22/10/2026

Mở http://127.0.0.1:5173. Đăng nhập `user / user12345` để mua sắm; `admin / admin123` để xem Dashboard và Audit Log. Trang đăng nhập chỉ giữ biểu mẫu, đã bỏ phần giới thiệu bên trái.

## Luồng trình diễn khoảng 3 phút

1. User mở cửa hàng, tìm/lọc sản phẩm, bấm ảnh để xem chi tiết. Có bốn mặt hàng với ảnh riêng: tai nghe, bàn phím, chuột và loa.
2. Chọn **Mua ngay** hoặc **Thêm vào giỏ**. Trong giỏ, tăng/giảm số lượng hoặc xóa sản phẩm; tổng tiền cập nhật theo giá máy chủ.
3. Bấm **Tiến hành đặt hàng**, chọn **Điền thông tin mẫu**, rồi **Đặt hàng & tiếp tục**. Giỏ được chuyển thành đơn chờ thanh toán.
4. Bấm **Thanh toán** để hoàn thành giao dịch mẫu. Muốn minh họa lỗi, mở **Thử tình huống thanh toán**, chọn **Bị từ chối** hoặc **Cổng thanh toán không phản hồi**.
5. Sau lỗi, chọn **Thành công** rồi **Thử thanh toán lại** trên cùng đơn. Lịch sử giữ từng lần thử. Có thể hủy đơn chưa trả tiền sau bước xác nhận.
6. Mở **Đơn hàng của tôi**, tải lại trang hoặc đăng xuất/đăng nhập: đơn và giỏ vẫn lưu trong Cassandra theo tài khoản.
7. Admin lọc `Order` hoặc `Payment`, ngày UTC hiện tại, xem details có `order_id`, `payment_id`, `owner_user_id`, số tiền và kết quả. Luồng trả tiền lỗi → thành công dùng cùng order_id, khác payment_id.

## Đối chiếu n7.docx và đề xuất thêm

Đã đọc bản n7.docx hiện có. Chương 2.4, 3 và phần use case đã nêu tạo/cập nhật/hủy đơn, thanh toán thành công/thất bại/hoàn tiền. TC-24 đã đề xuất gửi lại request/event để tránh trùng; TC-28 đã có ghi đồng thời. Vì vậy các thao tác này không được tính là ý tưởng mới của đề án.

| Phần cụ thể hóa thêm cho trải nghiệm bán hàng | Trạng thái |
| --- | --- |
| Giỏ hàng có nhiều sản phẩm, thay đổi số lượng, xóa và tính tổng | Đã làm; ADD_TO_CART / REMOVE_FROM_CART / UPDATE_CART |
| Lưu giỏ và lịch sử đơn theo tài khoản qua nhiều phiên | Đã làm; hai bảng Cassandra mới |
| Từ chối/timeout rồi thử trả tiền lại trên cùng đơn | Đã làm; mở rộng cách trình diễn PAYMENT_FAILED / PAYMENT_SUCCESS đã có |
| Tài khoản B thử xem/trả tiền/hủy đơn của A | Đã kiểm thử API: đều 404; minh họa quyền sở hữu tài nguyên |
| Bấm đặt hàng/thanh toán lặp lại không sinh giao dịch trùng | Đã kiểm thử, áp dụng TC-24 vào nghiệp vụ; giới hạn một backend demo |

Các tình huống bán hàng chưa được đặc tả thành luồng riêng trong n7.docx, nên ưu tiên tiếp nếu mở rộng:

1. **Mã giảm giá hết hạn hoặc chưa đạt giá trị đơn tối thiểu**: nhập mã trong giỏ, hiển thị lý do không áp dụng; `COUPON_REJECTED` mức WARN. Đây là lỗi nghiệp vụ dễ hiểu cho người xem.
2. **Hai người cùng mua sản phẩm cuối cùng**: người thứ hai nhận thông báo hết hàng; `OUT_OF_STOCK` mức WARN. Cần thêm tồn kho và điều kiện ghi phù hợp, chưa triển khai trong bản này. Khác với TC-28 vốn kiểm tra nhiều log được ghi.
3. **Đổi số lượng sau khi giá sản phẩm thay đổi**: hiển thị giá mới và yêu cầu xác nhận trước đặt hàng; `PRICE_CHANGED` mức WARN. Cần phiên bản giá/danh mục có thể sửa, chưa triển khai.

## Dữ liệu và giới hạn

- Danh mục bốn mặt hàng mẫu nằm trong source backend, giá VND được tính ở máy chủ; phía khách chỉ gửi ID và số lượng 1–10. Ảnh và thông số là minh họa.
- `shop_carts`: partition theo user_id; `shop_orders`: partition theo user_id, clustering order_id. Payload JSON chứa snapshot mặt hàng, giá, trạng thái, địa chỉ mẫu và lịch sử thanh toán. Các bảng này không áp dụng TTL của Audit Log. Mẫu CQL: `database/07_shop.cql`.
- Mỗi thay đổi nghiệp vụ được gửi cùng ba bản Audit Log trong Cassandra logged batch. Đây là cơ chế hoàn tất/replay của Cassandra, không phải giao dịch SQL có rollback/isolation. Timeout cần đọc lại dữ liệu; UUID đơn và lần trả tiền giúp retry cùng yêu cầu.
- Hàng đợi theo tài khoản chỉ bảo vệ một tiến trình backend đang chạy. Chưa có distributed lock, tồn kho thật, hoàn tiền thật, cổng thanh toán, vận chuyển hay phân trang lịch sử đơn quy mô lớn.
- Thanh toán không thu tiền, không gọi ngân hàng và không nhận thông tin thẻ. Địa chỉ không đưa vào details Audit Log. Nên dùng nút điền dữ liệu mẫu.
- `npm run verify:shop` ở backend: **80 kiểm tra đạt**, gồm giá phía máy chủ, giỏ lưu DB, request lặp/đồng thời, retry, hủy, cách ly hai người dùng và đối chiếu cả ba bảng audit. Kết quả: `docs/shop-verification.json`. Tài khoản, giỏ và đơn kiểm thử tạm được dọn; audit kiểm thử được giữ.
- Đã kiểm tra trên giao diện thật: chọn tai nghe, số lượng 2, điền địa chỉ mẫu, tạo đơn `1dd562de-74e7-4c27-a8de-ec1681a25020`, trả tiền bị từ chối rồi thử thành công, tải lại lịch sử vẫn còn đơn.
- Tunnel vẫn chưa mở. Thay đổi này phục vụ bản chạy cục bộ.

Đã đối chiếu trên giao diện Admin: PAYMENT_SUCCESS của đơn 1dd562de-74e7-4c27-a8de-ec1681a25020, số tiền 2.580.000 VND, attempt=2, người thực hiện user. Ảnh NepStore-admin-audit.jpg lưu tại gốc.
Ảnh sản phẩm được tạo bằng ImageGen tích hợp; prompt và đường dẫn ở docs/PRODUCT_IMAGES.md.

