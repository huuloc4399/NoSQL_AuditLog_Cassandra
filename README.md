# Nếp Store và AuditFlow — Nhóm 07

Website bán hàng phục vụ demo Audit Log với Cassandra. User chọn sản phẩm, quản lý giỏ hàng, đặt đơn và thanh toán giả lập. Admin tra cứu nhật ký, quản lý người dùng, dịch vụ và theo dõi hệ thống.

## Mã nguồn và tài liệu

- [Mã nguồn](DeTai10_Nhom07_AuditLog_Cassandra/audit-log-system): React, TypeScript, Express và Cassandra.
- [Hướng dẫn chạy demo](README_DEMO.md).
- [Kịch bản mua hàng](DEMO_CUA_HANG.md).
- [Cài đặt và kết nối Cassandra](REAL_DATABASE.md).
- [Xem bảng bằng DbGate](CASSANDRA_GUI.md).

## Chạy trên máy khác

Các tiện ích Windows trong thư mục gốc phục vụ môi trường demo cục bộ đã cài WSL và Cassandra. Khi mới tải repository, cần cài Node.js và Cassandra, cài các gói của backend/frontend, rồi tạo file cấu hình backend từ `.env.example`. Xem [hướng dẫn mã nguồn](DeTai10_Nhom07_AuditLog_Cassandra/audit-log-system/README.md) và [hướng dẫn Cassandra](REAL_DATABASE.md) để thiết lập môi trường.

File `.env`, dữ liệu Cassandra, thư mục chạy tạm, thư viện đã cài và các bộ cài công cụ không được đưa vào repository. Tài khoản trong hướng dẫn là tài khoản demo. Thanh toán được giả lập, không thu tiền hay giao hàng.
