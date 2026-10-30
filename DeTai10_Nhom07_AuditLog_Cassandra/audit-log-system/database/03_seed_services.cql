-- ============================================================================
-- [BAREM 2, 4] Danh mục bốn nhóm sự kiện chuẩn để chuẩn bị dữ liệu demo.
-- Auth, User, Order, Payment là nhãn dịch vụ; không phải bốn máy chủ triển khai độc lập.
-- Cả bốn được đặt status=true. Script SQL dùng UUID cố định cho khởi tạo thủ công.
-- Khi ứng dụng đã có danh mục, ưu tiên seed:demo có kiểm tra tồn tại trong backend.
-- ============================================================================

USE audit_log_system;

-- 1. Auth: sự kiện đăng nhập, đăng xuất và xác thực.
INSERT INTO audit_log_system.services (
    service_id, service_name, description, status, created_at, updated_at
) VALUES (
    11111111-1111-1111-1111-111111111111,
    'Auth',
    'Authentication, Session & OAuth2 Authorization Service',
    true,
    toTimestamp(now()),
    toTimestamp(now())
);

-- 2. User: thao tác tài khoản và quản trị danh mục.
INSERT INTO audit_log_system.services (
    service_id, service_name, description, status, created_at, updated_at
) VALUES (
    22222222-2222-2222-2222-222222222222,
    'User',
    'User Identity & Profile Administration Service',
    true,
    toTimestamp(now()),
    toTimestamp(now())
);

-- 3. Order: sự kiện thao tác giỏ/đơn mẫu.
INSERT INTO audit_log_system.services (
    service_id, service_name, description, status, created_at, updated_at
) VALUES (
    33333333-3333-3333-3333-333333333333,
    'Order',
    'E-commerce Order Processing & Fulfillment Service',
    true,
    toTimestamp(now()),
    toTimestamp(now())
);

-- 4. Payment: sự kiện kết quả thanh toán mô phỏng.
INSERT INTO audit_log_system.services (
    service_id, service_name, description, status, created_at, updated_at
) VALUES (
    44444444-4444-4444-4444-444444444444,
    'Payment',
    'Financial Transactions & Payment Gateway Integration Service',
    true,
    toTimestamp(now()),
    toTimestamp(now())
);

-- Kiểm chứng: danh mục phải có đủ bốn tên chuẩn và trạng thái đang bật.
SELECT service_id, service_name, status, description FROM audit_log_system.services;
