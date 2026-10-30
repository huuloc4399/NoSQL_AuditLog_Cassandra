-- ============================================================================
-- [BAREM 3, 4] Các mẫu SELECT để đối chiếu bộ lọc trên web với Cassandra.
-- Ngày 2026-10-14 và UUID bên dưới là ví dụ cũ; thay bằng ngày/UUID thực trước khi demo.
-- Các mẫu hôm nay nằm lúc 00:00 UTC; chọn cả ngày để không vô tình lọc mất dữ liệu.
-- ============================================================================

USE audit_log_system;

-- ----------------------------------------------------------------------------
-- Q1: lọc dịch vụ và ngày, dùng đầy đủ partition key của bảng chính.
-- Bảng sử dụng: audit_logs.
-- Khóa phân vùng: (service_name, log_date).
-- ----------------------------------------------------------------------------
SELECT service_name, log_date, log_time, log_id, level, action, user_id, ip_address, message
FROM audit_log_system.audit_logs
WHERE service_name = 'Payment'
  AND log_date = '2026-10-14'
LIMIT 50;

-- ----------------------------------------------------------------------------
-- Q2: chọn partition dịch vụ/ngày rồi giới hạn log_time theo dải giờ UTC.
-- Bảng sử dụng: audit_logs.
-- Khóa phân vùng: (service_name, log_date).
-- log_time là clustering key nên nhận điều kiện >= và <= trong partition này.
-- ----------------------------------------------------------------------------
SELECT service_name, log_date, log_time, log_id, level, action, user_id, message
FROM audit_log_system.audit_logs
WHERE service_name = 'Auth'
  AND log_date = '2026-10-14'
  AND log_time >= '2026-10-14 08:00:00+0000'
  AND log_time <= '2026-10-14 18:00:00+0000';

-- ----------------------------------------------------------------------------
-- Q3: Payment + ERROR + ngày, đúng tình huống lọc lỗi trong kịch bản bảo vệ.
-- Bảng sử dụng: audit_logs_by_service_level, đã đưa level vào partition key.
-- Khóa phân vùng: (service_name, level, log_date).
-- Truy vấn định vị theo khóa; không dùng nhận xét này thay cho kết quả đo hiệu năng.
-- ----------------------------------------------------------------------------
SELECT service_name, level, log_date, log_time, log_id, action, user_id, message, details
FROM audit_log_system.audit_logs_by_service_level
WHERE service_name = 'Payment'
  AND level = 'ERROR'
  AND log_date = '2026-10-14';

-- ----------------------------------------------------------------------------
-- Q4: kết hợp đầy đủ dịch vụ, mức độ, ngày và dải giờ như bộ lọc trên web.
-- Bảng sử dụng: audit_logs_by_service_level, đã đưa level vào partition key.
-- Khóa phân vùng: (service_name, level, log_date).
-- Giới hạn dải clustering key log_time sau khi đã chọn đủ khóa phân vùng.
-- ----------------------------------------------------------------------------
SELECT service_name, level, log_date, log_time, log_id, action, user_id, message
FROM audit_log_system.audit_logs_by_service_level
WHERE service_name = 'Payment'
  AND level = 'ERROR'
  AND log_date = '2026-10-14'
  AND log_time >= '2026-10-14 00:00:00+0000'
  AND log_time <= '2026-10-14 23:59:59+0000';

-- ----------------------------------------------------------------------------
-- Q5: log INFO của nhóm User; thay ngày bằng ngày thực của sự kiện cần kiểm tra.
-- ----------------------------------------------------------------------------
SELECT service_name, level, log_date, log_time, log_id, action, user_id, message
FROM audit_log_system.audit_logs_by_service_level
WHERE service_name = 'User'
  AND level = 'INFO'
  AND log_date = '2026-10-14'
LIMIT 20;

-- ----------------------------------------------------------------------------
-- Q6: log WARN của Auth, chẳng hạn đăng nhập thất bại.
-- ----------------------------------------------------------------------------
SELECT service_name, level, log_date, log_time, log_id, action, user_id, ip_address, message
FROM audit_log_system.audit_logs_by_service_level
WHERE service_name = 'Auth'
  AND level = 'WARN'
  AND log_date = '2026-10-14';

-- ----------------------------------------------------------------------------
-- Q7: tra cứu chính xác một hàng bằng đầy đủ khóa chính của bảng audit_logs.
-- ----------------------------------------------------------------------------
-- Sao chép log_time và log_id từ màn hình chi tiết rồi thay vào ví dụ:
-- SELECT * FROM audit_log_system.audit_logs
-- WHERE service_name = 'Order' AND log_date = '2026-10-14' AND log_time = '...' AND log_id = ...;

-- ----------------------------------------------------------------------------
-- Q8: truy vấn nhiều ngày phải xem từng ngày như một partition riêng.
-- log_date thuộc khóa phân vùng; không cắt dải ngày bằng >=/<= như clustering key.
-- Các partition khác ngày có thể cùng nằm trên một node; bản demo hiện chỉ có một node.
-- Ví dụ không phù hợp với cách đọc theo khóa:
--   SELECT * FROM audit_logs WHERE service_name = 'Auth' AND log_date >= '2026-10-10' AND log_date <= '2026-10-14';
-- Không dùng câu trên trong đường truy vấn lõi và không thêm ALLOW FILTERING để né thiết kế.
-- Liệt kê một tập ngày nhỏ bằng IN, hoặc truy vấn từng ngày từ backend như bên dưới:
-- ----------------------------------------------------------------------------
SELECT service_name, log_date, log_time, log_id, level, action, user_id, message
FROM audit_log_system.audit_logs
WHERE service_name = 'Auth'
  AND log_date IN ('2026-10-13', '2026-10-14')
LIMIT 100;

-- auditLogService.queryLogs hiện liệt kê tối đa 14 ngày và ghép kết quả trong ứng dụng.
-- Đây là giới hạn của bản demo, không phải bằng chứng đã kiểm thử tải production.

-- ----------------------------------------------------------------------------
-- Q9: tra UUID trong bảng audit_logs_by_id để kiểm chứng một sự kiện từ web/API.
-- Bảng sử dụng: audit_logs_by_id.
-- Khóa phân vùng: log_id; UUID ví dụ dưới đây cần đổi sang mã có thật.
-- ----------------------------------------------------------------------------
SELECT log_id, service_name, log_date, log_time, level, action, user_id, ip_address, message, details
FROM audit_log_system.audit_logs_by_id
WHERE log_id = 99999999-9999-9999-9999-999999999999;

