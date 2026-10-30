-- ============================================================================
-- [BAREM 1 - 1,0đ] Khởi tạo keyspace lưu dữ liệu Audit Log.
-- Cassandra tổ chức dữ liệu theo partition và cột, thiết kế bảng theo mẫu truy vấn.
-- SimpleStrategy phục vụ môi trường demo một node; không chứng minh chịu lỗi nhiều node.
-- RF=1: một bản sao trên cụm; ba bảng audit không có nghĩa là RF=3.
-- ============================================================================

CREATE KEYSPACE IF NOT EXISTS audit_log_system
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
} AND durable_writes = true;

DESCRIBE KEYSPACE audit_log_system;
