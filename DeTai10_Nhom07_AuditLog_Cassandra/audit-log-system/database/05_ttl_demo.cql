-- ============================================================================
-- [BAREM 3, 4] Minh họa cú pháp TTL tự hết hạn của Cassandra.
-- Dữ liệu hết hạn do USING TTL; không dùng timer frontend hoặc lệnh DELETE để chứng minh.
-- TTL tính bằng giây và được gắn trực tiếp vào INSERT.
-- Đây là ví dụ SQL thủ công; các now() ở ba INSERT có thể tạo log_time khác nhau.
-- Để đối chiếu ba bản cùng timestamp, ưu tiên màn hình TTL hoặc npm run demo:ttl qua createLog.
--
-- Cách chạy trong môi trường Docker cũ:
--   docker exec -i cassandra_audit_node cqlsh -u cassandra -p cassandra < database/05_ttl_demo.cql
-- Trên máy WSL: mở START_REAL_DEMO.bat, sau đó chạy tại backend:
--   npm run demo:ttl
-- ============================================================================

USE audit_log_system;

-- ----------------------------------------------------------------------------
-- Bước 1: tạo bản ghi thử riêng, thời hạn 30 giây.
-- Dùng chung UUID và cùng giá trị TTL ở ba bản sao theo truy vấn.
-- ----------------------------------------------------------------------------
INSERT INTO audit_log_system.audit_logs (
    service_name,
    log_date,
    log_time,
    log_id,
    level,
    action,
    user_id,
    ip_address,
    message,
    details
) VALUES (
    'Auth',
    toDate(now()),
    toTimestamp(now()),
    11111111-2222-3333-4444-555555555555,
    'WARN',
    'LOGIN_FAILED',
    'usr_ttl_demo',
    '192.168.1.99',
    'Temporary TTL Demo Log - Auto-expires in 30 seconds',
    '{"reason": "Cassandra TTL Defense Demo", "ttl_seconds": 30}'
) USING TTL 30;

-- Ghi thêm bản theo dịch vụ/mức độ/ngày, cùng UUID và TTL.
INSERT INTO audit_log_system.audit_logs_by_service_level (
    service_name,
    level,
    log_date,
    log_time,
    log_id,
    action,
    user_id,
    ip_address,
    message,
    details
) VALUES (
    'Auth',
    'WARN',
    toDate(now()),
    toTimestamp(now()),
    11111111-2222-3333-4444-555555555555,
    'LOGIN_FAILED',
    'usr_ttl_demo',
    '192.168.1.99',
    'Temporary TTL Demo Log - Auto-expires in 30 seconds',
    '{"reason": "Cassandra TTL Defense Demo", "ttl_seconds": 30}'
) USING TTL 30;

-- Ghi thêm bản theo UUID để đọc trực tiếp và quan sát thời hạn.
INSERT INTO audit_log_system.audit_logs_by_id (
    log_id,
    service_name,
    log_date,
    log_time,
    level,
    action,
    user_id,
    ip_address,
    message,
    details
) VALUES (
    11111111-2222-3333-4444-555555555555,
    'Auth',
    toDate(now()),
    toTimestamp(now()),
    'WARN',
    'LOGIN_FAILED',
    'usr_ttl_demo',
    '192.168.1.99',
    'Temporary TTL Demo Log - Auto-expires in 30 seconds',
    '{"reason": "Cassandra TTL Defense Demo", "ttl_seconds": 30}'
) USING TTL 30;

-- ----------------------------------------------------------------------------
-- Bước 2: đọc ngay khi còn hạn; phải thấy một dòng và TTL(message) đang giảm.
-- TTL() đọc thời hạn của cột dữ liệu không thuộc khóa chính.
-- Khi chỉ SELECT các khóa chính thì không thể biết còn bao nhiêu giây TTL.
-- ----------------------------------------------------------------------------
SELECT 
    log_id,
    service_name, 
    log_date, 
    log_time, 
    level, 
    action, 
    message, 
    TTL(message) AS remaining_seconds_ttl
FROM audit_log_system.audit_logs_by_id
WHERE log_id = 11111111-2222-3333-4444-555555555555;

-- ----------------------------------------------------------------------------
-- Bước 3: chờ hơn 30 giây, nên đệm thêm vài giây, rồi chạy lại cùng UUID.
-- Kết quả mong đợi:
-- (0 rows)
-- 0 dòng là bằng chứng hết hạn khi truy vấn; không đồng nghĩa file dữ liệu bị xóa ngay khỏi đĩa.
-- Khi bảo vệ cần có cả kết quả trước hạn và sau hạn, cùng trạng thái kết nối DB bình thường.
-- ----------------------------------------------------------------------------
SELECT 
    log_id,
    service_name, 
    log_date, 
    log_time, 
    level, 
    action, 
    message
FROM audit_log_system.audit_logs_by_id
WHERE log_id = 11111111-2222-3333-4444-555555555555;
