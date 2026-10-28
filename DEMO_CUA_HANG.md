# Nếp Store — demo giao diện và Audit Log

Cập nhật 27/10/2026: cửa hàng chỉ tạo bối cảnh thao tác cho đề tài Audit Log. Không có bảng sản phẩm, giỏ hàng hoặc đơn hàng trong thiết kế hiện tại. Không giữ `shop_orders`, vì vậy không cần bổ sung bảng đơn hàng vào SRS `n7.docx`.

## Luồng trình diễn

1. Mở ứng dụng, đăng nhập User và xem bốn sản phẩm có ảnh. Tìm, lọc, sắp xếp hoặc mở chi tiết.
2. Thêm sản phẩm vào giỏ, tăng/giảm số lượng hoặc xóa. Giá và tổng tiền là dữ liệu mẫu tính tại giao diện.
3. Chọn **Tiến hành đặt hàng**, **Điền thông tin mẫu**, rồi **Đặt hàng & tiếp tục**.
4. Chọn thanh toán thành công, bị từ chối hoặc timeout. Sau lỗi có thể thử lại trên cùng đơn; có thể hủy đơn chưa thanh toán.
5. Mở **Đơn hàng của tôi**, tải lại trang: đơn vẫn có trên cùng trình duyệt và tài khoản. Máy khác không có lịch sử này; xóa dữ liệu trình duyệt sẽ mất giỏ và đơn mẫu.
6. Admin lọc `Order` hoặc `Payment` trong Audit Log, chọn ngày UTC hiện tại và xem `order_id`, `payment_id`, `owner_user_id`, số tiền mẫu, kết quả và lần thử. Không cần bảng nghiệp vụ để tạo nhật ký.

## Dữ liệu được giữ ở đâu

- `frontend/src/services/shopProducts.json`: tên, ảnh, mô tả, giá và thông số mẫu.
- `frontend/src/services/shopClient.ts`: giỏ, thông tin nhận hàng mẫu, lịch sử đơn và các lần thanh toán được lưu bằng localStorage, tách theo tài khoản và chế độ chạy.
- `POST /api/shop/events`: gửi sự kiện tới backend ở chế độ thường. Backend xác thực JWT, lấy người thực hiện từ phiên đăng nhập, kiểm tra cấu trúc và ghi ba bản Audit Log hiện có trong Cassandra. Không nhận danh tính, phân quyền hoặc địa chỉ nhận hàng từ payload nhật ký.
- Các sự kiện cửa hàng gồm `ADD_TO_CART`, `REMOVE_FROM_CART`, `UPDATE_CART`, `CREATE_ORDER`, `CANCEL_ORDER`, `PAYMENT_SUCCESS`, `PAYMENT_FAILED`.
- Giỏ/đơn cục bộ chỉ cập nhật sau khi API xác nhận nhật ký. Khi API lỗi, giao diện giữ trạng thái trước thao tác và cho thử lại. Ghi localStorage và ghi Audit Log là hai thao tác riêng, không có bảo đảm giao dịch nguyên tử hoặc đồng bộ nhiều tab/máy.
- Nhật ký được đánh dấu `simulated: true`, `source: BROWSER_SHOP`. Số tiền và kết quả do giao diện mô phỏng cung cấp, không phải bằng chứng giao dịch ngân hàng hoặc giá bán được máy chủ xác nhận. Thanh toán không thu tiền.

## Cassandra và bỏ bảng cũ

Ứng dụng chỉ cần năm bảng nền tảng: `audit_logs`, `audit_logs_by_service_level`, `audit_logs_by_id`, `services`, `users`. Hai bảng cửa hàng không còn được khởi tạo hoặc đọc/ghi. API giỏ/đơn cũ đã gỡ, chỉ còn endpoint ghi sự kiện.

Với database của phiên bản trước, chạy `npm run db:remove-shop-tables` tại backend để bỏ riêng `shop_carts` và `shop_orders`. Lệnh này không chạy tự động khi mở ứng dụng; không xóa tài khoản, dịch vụ hoặc Audit Log. CQL tương đương ở `database/07_remove_legacy_shop.cql`.

Đã khôi phục WSL từ ổ đĩa gốc ở F: dưới tên `AuditFlow-Recovered` và xóa thành công hai bảng cũ ngày 27/10. Kiểm tra schema xác nhận còn đúng năm bảng nền tảng. Đã thao tác mua hàng trên API thật và đọc lại đủ bốn sự kiện ở cả ba bảng Audit Log; giỏ/đơn chỉ có trong trình duyệt.

## Kiểm chứng

`npm run test:shop` kiểm tra mô phỏng cục bộ, tách tài khoản/chế độ, yêu cầu lặp, thanh toán, hủy và đường HTTP ghi nhật ký bằng dependency thử riêng. `npm run test:audit` kiểm tra batch và lỗi ghi. Phạm vi và kết quả hiện hành ở `docs/TESTING.md`; kết quả giỏ/đơn lưu Cassandra ngày 22/10 là lịch sử của bản cũ.

Ảnh mẫu ở `frontend/public/products`; nguồn và prompt ở `docs/PRODUCT_IMAGES.md`. Bản xem thử bằng `START_UI_PREVIEW.bat` mô phỏng cả Audit Log trong trình duyệt và có banner riêng; chế độ thường gửi nhật ký tới Cassandra thật, không tự chuyển sang nhật ký giả khi mất DB.
