# Chia sẻ demo qua Cloudflare

Đã chuẩn bị cloudflared 2026.10.3 từ bản phát hành chính thức và kiểm tra SHA256. Tunnel chưa được mở: bước tạo đường dẫn công khai đang chờ người dùng xác nhận phạm vi dữ liệu được chia sẻ theo yêu cầu của bộ duyệt tự động.

START_SHARE_DEMO.bat khởi động website/Cassandra, build giao diện và mở Cloudflare Quick Tunnel. Link tạm thời được in ra màn hình và lưu tại .runtime/cloudflare-url.txt sau khi tạo thành công.

Bản chia sẻ phục vụ giao diện đã build cùng API qua một URL HTTPS. Giao diện dùng API tương đối /api; không cần người test truy cập localhost của họ. Cổng chia sẻ cục bộ là 127.0.0.1:5180. Cloudflare không được cấu hình chuyển tiếp cổng CQL 9042 hoặc cổng quản lý Cassandra.

Người có link có thể mở trang đăng nhập. Sau khi đăng nhập, quyền truy cập tương ứng với tài khoản hiện có: User có thể xem log và chạy tình huống mẫu cá nhân; Admin có quyền quản lý dịch vụ/tài khoản và chạy các chức năng demo quản trị. Các thao tác dùng chung database demo trên máy này. Người test có thể tự đăng ký tài khoản User riêng.

STOP_SHARE_DEMO.bat đóng tunnel và máy chủ chia sẻ, giữ website cục bộ và Cassandra. STOP_REAL_DEMO.bat cũng đóng tunnel trước khi dừng ứng dụng. Các trình dừng kiểm tra đúng PID, thời điểm khởi chạy và đường dẫn trước khi dừng tiến trình.

Giữ máy thức và có Internet trong lúc nhóm test. Quick Tunnel dùng tên miền trycloudflare.com ngẫu nhiên; mở một tunnel mới có thể nhận URL khác. Đây là đường dẫn kiểm thử tạm thời, không phải hosting cố định.

Nguồn chính thức: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/

Cloudflared: https://github.com/cloudflare/cloudflared/releases/tag/2026.10.3

SHA256 Windows amd64: 76b2805253d0d6ffacb092a7acfbee99e7af6917835c0c5410e23f3ef5052da2
