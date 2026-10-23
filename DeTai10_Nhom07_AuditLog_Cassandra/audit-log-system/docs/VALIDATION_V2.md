> Tài liệu lịch sử trước bản sửa 22/10/2026. Tham khảo README_DEMO.md và REAL_DATABASE.md tại thư mục gốc, cùng docs/DEMO.md, docs/TESTING.md, docs/CASSANDRA_DESIGN.md và docs/PERFORMANCE.md cho bản đang chạy bằng WSL.

# Kiểm tra phiên bản giao diện hai vai trò

Ngày kiểm tra: 20/10/2026.

| Nội dung | Kết quả |
| --- | --- |
| Frontend TypeScript và build chế độ demo | Đạt |
| Frontend TypeScript và build chế độ API | Đạt |
| Backend TypeScript build | Đạt |
| Bộ kiểm thử sẵn có, phần chạy không cần DB | 40 đạt, 0 lỗi |
| Kiểm thử HTTP thực qua router và middleware | 29 đạt, 0 lỗi |
| Đăng nhập Admin và User, khôi phục phiên | Đạt trên trình duyệt |
| User mở trực tiếp `/users` | Bị từ chối, vai trò yêu cầu ADMIN |
| Bộ lọc Payment + ERROR | Chỉ trả log Payment ERROR |
| Phân trang | Trang 1 có 15 dòng, trang 2 có 5 dòng cho bộ lọc trên |
| Xem chi tiết nhật ký | Có ID, dịch vụ, giờ UTC, user, IP và details |
| Thêm dịch vụ Notification | Lưu thành công và xuất hiện trong danh mục |
| Xuất CSV | File tải xuống có 15 dòng và 6 cột đúng trang hiện tại |
| TTL mô phỏng 30 giây | Từ tồn tại chuyển sang hết hạn, thời gian còn lại 0 |
| Bố cục máy tính và điện thoại | Đã xem tại 1440px và 390px; đã sửa tràn ngang ngoài bảng |
| Cassandra thật, CQLSH, nodetool, TTL thật | Chưa chạy lại; kết nối 127.0.0.1:9042 bị từ chối |

Kiểm thử HTTP dùng router, controller và middleware thật, thay phụ thuộc cơ sở dữ liệu bằng đối tượng kiểm thử trong tiến trình riêng. Không coi đây là kết quả kiểm thử tích hợp Cassandra.

Các lỗi cập nhật nóng tạm thời trong khi thay đổi module đã được khắc phục bằng tải lại trang với nguồn cuối cùng. Bản build cuối cùng dùng mô-đun dashboard tải riêng để giảm dung lượng tải ban đầu.
