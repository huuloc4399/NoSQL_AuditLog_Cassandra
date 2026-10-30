# Giải thích code và cách demo theo barem Đề tài 10

Tài liệu dành cho nhóm đọc code và trình bày bảo vệ. Các nhãn `[BAREM 1]` đến `[BAREM 4]` trong source liên kết với bốn nhóm điểm của file ĐỀ TÀI 10.docx. Comment giải thích phần đã có; không phải kết quả chấm điểm hay xác nhận mọi bài kiểm thử đã chạy lại.

Đường dẫn trong bảng bên dưới tính từ thư mục `audit-log-system`. Các file BAT và thư mục `scripts` vận hành Windows nằm ở gốc dự án chính.

Khi trình bày tra cứu nhật ký, dùng tài khoản ADMIN. USER chỉ thao tác cửa hàng và hồ sơ; trang `/logs` và mọi API đọc log, chi tiết, thống kê đều bị chặn với USER (HTTP 403). Các thao tác mua hàng vẫn ghi audit để ADMIN đối chiếu trong Cassandra.

Có thể đối chiếu ngay trong website bằng nút **Mở CQL** ở góc dưới bên phải của Admin khi chạy DB thật. `CqlConsole.tsx` gửi câu lệnh đến `POST /api/admin/cql`; `cqlConsoleService.ts` kiểm tra câu lệnh đọc, bảng/cột rồi gọi Cassandra driver. `DESCRIBE TABLE` dựng phần cột, khóa chính và thứ tự clustering từ `system_schema.columns`; nội dung này không bao gồm toàn bộ tùy chọn lưu trữ của bảng như lệnh cqlsh gốc. Console không tạo bảng hoặc sửa/xóa dữ liệu; mẫu TTL đọc UUID đã tạo qua chức năng Demo TTL.

## Bản đồ đọc code

| Nhóm barem | Nội dung cần giải thích | File và hàm nên mở |
| --- | --- | --- |
| 1. Báo cáo và thiết kế CSDL, 2,5đ | 1,0đ giải trình Cassandra phù hợp; 1,5đ khóa phân vùng tổng hợp và log_time DESC | `database/01_keyspace.cql`, `02_tables.cql`; `backend/src/config/cassandra.ts`: `getCassandraClient`, `ensureKeyspaceAndTables` |
| 2. CRUD nền tảng, 2,5đ | API nhận log, kiểm tra đầu vào; Admin thêm/sửa/xóa danh mục dịch vụ | `backend/src/routes/index.ts`; `controllers/auditLogController.ts`: `createLog`; `validators/auditLogValidator.ts`; `controllers/serviceController.ts`; `services/serviceCatalogService.ts`; `frontend/src/pages/ServicesPage.tsx` |
| 3. Chức năng nâng cao, 2,5đ | TTL trực tiếp trong INSERT; lọc dịch vụ, level và dải thời gian bằng CQL | `backend/src/services/auditLogService.ts`: `createLog`, `queryLogs`, `querySingleDay`, `getTtlStatus`; `frontend/src/pages/LogExplorerPage.tsx`, `TtlDemoPage.tsx` |
| 4. Kiểm thử và demo trực quan, 2,5đ | 1,0đ dữ liệu mẫu; 1,5đ trình diễn CRUD sinh log, TTL và lọc ERROR; giải thích số đo hiệu năng | `backend/scripts/generateDummyData.ts`, `benchmarkCurrent.ts`, `runTtlDemo.ts`; `backend/src/services/demoDataService.ts`; `frontend/src/pages/OverviewPage.tsx` |

Trong VS Code, tìm toàn dự án theo `BAREM` để chuyển nhanh tới đoạn cần trình bày. Không tự chia thêm mức điểm lẻ cho TTL, query hoặc benchmark vì barem không ghi phần chia đó.

## 1. Vì sao thiết kế như vậy

`audit_logs` có khóa chính `((service_name, log_date), log_time, log_id)`. Cặp ngoặc trong cùng xác định partition key tổng hợp gồm hai trường: mỗi dịch vụ có các phân vùng theo ngày UTC, thay vì đưa toàn bộ lịch sử vào một phân vùng. `log_time DESC` đặt sự kiện mới trước trong phân vùng. `log_id` phân biệt các sự kiện trùng thời điểm.

Đối với phần giải trình 1,0 điểm, nêu đặc điểm log phát sinh liên tục, thường ghi thêm và đọc theo dịch vụ/thời gian. Cassandra ghi mutation qua CommitLog và Memtable rồi flush thành SSTable; đây là cơ chế của database, không phải thuật toán tự viết trong backend. Tham khảo [Storage Engine của Apache Cassandra 4.1](https://cassandra.apache.org/doc/4.1/cassandra/architecture/storage_engine.html). Khả năng phân vùng và mở rộng là cơ sở lựa chọn kiến trúc; kết quả demo một node chỉ chứng minh phạm vi đã chạy.

Khi lọc thêm mức độ, backend chuyển sang `audit_logs_by_service_level`, có partition key `(service_name, level, log_date)`. Khi mở một UUID, backend đọc `audit_logs_by_id`. Đây là cùng sự kiện được tổ chức theo ba mẫu truy vấn; không JOIN và không cộng ba bản thành ba sự kiện nghiệp vụ.

Máy demo có một node, RF=1, consistency ONE. Ba bảng audit không có nghĩa RF=3. `nodetool status` chỉ chứng minh trạng thái node đang chạy; không chứng minh hệ thống vẫn phục vụ nếu node đó hỏng. Các nhóm Auth/User/Order/Payment là nhãn sự kiện trong một backend, không phải bốn máy chủ microservice.

Trong CQLSH, chạy:

```sql
USE audit_log_system;
DESCRIBE TABLE audit_logs;
DESCRIBE TABLE audit_logs_by_service_level;
```

Chỉ rõ khóa và thứ tự sắp xếp. Khi dùng DbGate, có thể xem cấu trúc bảng hoặc truy vấn `system_schema.columns`. Cần chọn đủ partition key khi chứng minh thứ tự thời gian; `SELECT *` toàn bảng không bảo đảm thứ tự toàn cục.

## 2. Luồng CRUD và tự ghi log

Luồng thêm dịch vụ:

```text
ServicesPage.handleCreate
  -> servicesApi.create -> POST /api/services
  -> authenticate + authorize('ADMIN')
  -> ServiceController.create -> kiểm tra dữ liệu + mutationAudit
  -> serviceCatalogService.createService -> chuẩn bị INSERT services
  -> auditLogService.createLog -> chuẩn bị ba INSERT audit
  -> client.batch -> phản hồi thành công -> tải lại danh mục trên UI
```

Sửa/xóa dùng luồng tương tự, lần lượt với UPDATE và DELETE. `mutationAudit` lấy actor từ phiên. Các sự kiện CREATE_SERVICE, UPDATE_SERVICE và DELETE_SERVICE được ghi dưới `service_name='User'`. Xóa danh mục không xóa lịch sử audit của thao tác đó.

Trong batch, câu ghi nghiệp vụ và ba bản audit được gửi cùng nhau. Phản hồi thành công chỉ được tạo sau khi driver xác nhận. Không giải thích logged batch như giao dịch SQL có rollback và isolation nhiều partition; nếu timeout cần đọc lại trạng thái trước khi gửi lại.

Demo: thêm một dịch vụ thử, sửa mô tả rồi xóa chính dịch vụ đó. Không xóa bốn dịch vụ chuẩn. Sau mỗi bước chạy lại:

```sql
SELECT service_id, service_name, description, status
FROM audit_log_system.services;

SELECT log_time, log_id, level, action, user_id, details
FROM audit_log_system.audit_logs
WHERE service_name = 'User' AND log_date = 'NGAY_UTC'
LIMIT 20;
```

Thay `NGAY_UTC` bằng ngày trên bộ lọc web, dạng YYYY-MM-DD. Đối chiếu action, UUID và `service_id` trong details. Lưu ý secondary index tên dịch vụ không phải ràng buộc UNIQUE; kiểm tra trùng tên được thực hiện trong service của backend.

API nhận log độc lập là `POST /api/logs`. Controller kiểm tra bằng Zod rồi gọi cùng `createLog`. Payload sai level hoặc dữ liệu nhạy cảm được nhận diện bị từ chối trước khi ghi; đường ghi nội bộ còn có bước che dữ liệu.

## 3. TTL và truy vấn nâng cao

### TTL 30 giây

`TtlDemoPage.handleCreateTtlLog` gọi `POST /api/logs/ttl-demo`. Controller tạo sự kiện Auth/WARN riêng, rồi `createLog` nối `USING TTL` vào cả ba câu INSERT. UI giữ UUID để đọc lại qua `/api/logs/ttl-status/:id`.

Các timer trong React chỉ đếm và gọi API; không xóa dữ liệu database. Nút reset cũng chỉ đặt lại màn hình. Backend đọc `TTL(message)` vì message là cột không thuộc khóa chính.

1. Bấm tạo log TTL 30 giây, sao chép UUID đầy đủ.
2. Chạy truy vấn ngay: phải có một dòng, TTL còn dương.
3. Chờ khoảng 35 giây và chạy lại đúng UUID: phải có 0 dòng.

```sql
SELECT log_id, action, message, TTL(message) AS remaining_seconds
FROM audit_log_system.audit_logs_by_id
WHERE log_id = UUID_VUA_TAO;
```

Thay `UUID_VUA_TAO` bằng UUID thực và không đặt UUID trong dấu nháy. Muốn kiểm tra cả ba bản, dùng ngày/thời gian/UUID của log để SELECT thêm bảng chính và bảng theo mức độ.

Hết hạn khi truy vấn không đồng nghĩa file SSTable bị xóa ngay khỏi ổ đĩa. Ngoài ra, `getTtlStatus` hiện ghi cảnh báo khi truy vấn lỗi rồi cũng trả `found=false`; phải kiểm tra kết nối và đối chiếu CQLSH để tránh coi lỗi kết nối là TTL đạt. Comment ghi rõ giới hạn này, không thay đổi nhánh xử lý.

### Lọc lỗi theo thời gian

`LogExplorerPage` là trang đang được gắn với `/logs`. Bộ lọc chuyển thành query của GET /api/logs. Controller kiểm tra dữ liệu, rồi `querySingleDay` chọn bảng:

- Có service và level: `audit_logs_by_service_level`.
- Chỉ có service: `audit_logs`.
- Không chọn service: đọc các partition dịch vụ đang bật rồi ghép kết quả ở backend.

Ví dụ đối chiếu bộ lọc Payment + ERROR:

```sql
SELECT log_time, log_id, action, message
FROM audit_log_system.audit_logs_by_service_level
WHERE service_name = 'Payment'
  AND level = 'ERROR'
  AND log_date = 'NGAY_UTC';
```

Sau khi chọn đủ khóa phân vùng, có thể thêm `AND log_time >= 'MOC_BAT_DAU_UTC' AND log_time <= 'MOC_KET_THUC_UTC'`. Đổi các mốc thành timestamp thực. Không dùng dải `>=/<=` trên log_date để thay cách chia partition. Nhánh nhiều ngày hiện liệt kê tối đa 14 ngày, ghép kết quả giới hạn và không trả cursor tiếp theo.

Mẫu chuẩn bị cho hôm nay có thời điểm 00:00 UTC. Nếu lọc 08:00-18:00 thì có thể không thấy các mẫu đó; ban đầu nên để trống bộ lọc giờ. Các ngày 2026-10-14 và UUID trong `database/04_queries.cql` là ví dụ cũ, phải thay trước khi trình diễn.

## 4. Dữ liệu, hiệu năng và phối hợp bảo vệ

`generateDummyData.ts` chuẩn bị 400 sự kiện: mỗi nhóm Auth/User/Order/Payment có 100 và đủ ba level. Đây là số của bộ khởi tạo, không phải giới hạn tổng dữ liệu database. `seed:demo` dùng `--if-empty`; khi có log thì không nạp lại bộ 400. Phần phân công có dòng 100 log, nhưng nhóm chọn 400 theo định mức chính 200-500 log của đề tài.

`demoDataService.prepareTodayDemoData` bổ sung 48 mẫu cho ngày UTC: mỗi dịch vụ 6 INFO, 3 WARN, 3 ERROR. UUID và khóa thời gian ổn định giúp nhận diện mẫu đã có trong cùng ngày. Mẫu ngày có TTL 7 ngày, khác log TTL 30 giây dùng khi bảo vệ.

`benchmarkCurrent.ts` đo bằng `performance.now()`: 100/300/500 lần ghi sự kiện; sau đó ba kiểu truy vấn, mỗi kiểu 50 lần. Kết quả có số thành công/lỗi, thời gian trung bình, P95 và throughput. Nó dùng keyspace `audit_log_benchmark`, TTL 3.600 giây và không trộn vào Dashboard. Chạy `npm run test:perf` trong backend; đọc ngày đo trong `docs/PERFORMANCE.md` và JSON trước khi dùng số liệu trình bày.

Phân công demo:

| Thành viên | Thao tác | Bằng chứng cần quan sát |
| --- | --- | --- |
| SV1 | Giải thích schema, thêm/sửa/xóa dịch vụ trên web | Dòng danh mục đổi đúng trong services |
| SV3 | Đọc DB ngay sau từng thao tác | CREATE_SERVICE/UPDATE_SERVICE/DELETE_SERVICE dưới nhóm User; UUID khớp |
| SV2 | Tạo log TTL 30 giây và đọc lại | TTL giảm; có dòng trước hạn và 0 dòng sau hạn |
| SV3 | Lọc ERROR, giải thích dữ liệu và số đo | UUID, dịch vụ, mức độ và giờ khớp web/CQL; kết quả benchmark có nguồn/ngày |

Cửa hàng giúp tạo sự kiện Order/Payment dễ hiểu. Sản phẩm tĩnh, giỏ và đơn mẫu lưu ở localStorage; API chỉ ghi audit thật. Thanh toán là mô phỏng. Để chứng minh CRUD bảng dữ liệu thật theo barem, ưu tiên danh mục dịch vụ hoặc quản trị tài khoản.
