-- ============================================================================
-- [BAREM 1 - 1,5đ] Thiết kế bảng theo mẫu truy vấn của màn hình tra cứu.
-- Đối chiếu runtime trong backend/src/config/cassandra.ts; bảng users ở 06_users_rbac.cql.
-- DESCRIBE TABLE audit_logs trong CQLSH để chỉ partition key và log_time DESC.
-- ============================================================================

USE audit_log_system;

-- ----------------------------------------------------------------------------
-- Bảng 1: audit_logs, đọc theo dịch vụ/ngày và cắt dải thời gian trong ngày.
-- Partition key tổng hợp (service_name, log_date): chia lịch sử mỗi dịch vụ theo ngày UTC.
-- Clustering: log_time DESC cho log mới trước trong partition; log_id ASC phân biệt hàng.
-- UUID bổ sung giúp hai sự kiện trùng mili giây vẫn có khóa khác nhau.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log_system.audit_logs (
    service_name text,
    log_date date,
    log_time timestamp,
    log_id uuid,
    level text,
    action text,
    user_id text,
    ip_address text,
    message text,
    details text,
    PRIMARY KEY ((service_name, log_date), log_time, log_id)
) WITH CLUSTERING ORDER BY (log_time DESC, log_id ASC)
  AND comment = 'Audit logs partitioned by service and calendar date';

-- ----------------------------------------------------------------------------
-- [BAREM 3] Bảng 2: thêm mức độ vào khóa để lọc INFO/WARN/ERROR bằng đúng partition.
-- Partition key (service_name, level, log_date); truy vấn không cần ALLOW FILTERING.
-- Clustering: log_time DESC cho log mới trước trong partition; log_id ASC phân biệt hàng.
-- Demo Payment + ERROR + ngày: đối chiếu cùng UUID giữa bảng này và giao diện.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log_system.audit_logs_by_service_level (
    service_name text,
    level text,
    log_date date,
    log_time timestamp,
    log_id uuid,
    action text,
    user_id text,
    ip_address text,
    message text,
    details text,
    PRIMARY KEY ((service_name, level, log_date), log_time, log_id)
) WITH CLUSTERING ORDER BY (log_time DESC, log_id ASC)
  AND comment = 'Audit logs partitioned by service, level, and calendar date';

-- ----------------------------------------------------------------------------
-- [BAREM 2] Bảng 3: danh mục dịch vụ do Admin quản lý qua CRUD.
-- Khóa chính service_id kiểu UUID, dùng trong thao tác sửa/xóa.
-- Index hỗ trợ tra tên; việc kiểm tra trùng tên nằm ở serviceCatalogService.ts.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log_system.services (
    service_id uuid,
    service_name text,
    description text,
    status boolean,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY (service_id)
) WITH comment = 'Catalog of registered microservices for audit tracking';

-- Secondary index không phải ràng buộc UNIQUE như trong hệ quản trị quan hệ.
CREATE INDEX IF NOT EXISTS idx_services_name ON audit_log_system.services (service_name);

-- ----------------------------------------------------------------------------
-- Bảng 4: bản sao theo UUID để mở chi tiết log và quan sát TTL của một sự kiện.
-- Partition key log_id: cung cấp đủ khóa để đọc một log, không cam kết độ trễ cố định.
-- Phục vụ GET /api/logs/:id và kiểm chứng SELECT TTL(message) WHERE log_id = UUID.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log_system.audit_logs_by_id (
    log_id uuid,
    service_name text,
    log_date date,
    log_time timestamp,
    level text,
    action text,
    user_id text,
    ip_address text,
    message text,
    details text,
    PRIMARY KEY (log_id)
) WITH comment = 'Audit logs partitioned by unique log_id for direct O(1) point lookups';
