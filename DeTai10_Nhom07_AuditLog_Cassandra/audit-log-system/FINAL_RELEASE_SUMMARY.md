> Tài liệu lịch sử trước bản sửa 22/10/2026. Tham khảo README_DEMO.md và REAL_DATABASE.md tại thư mục gốc, cùng docs/DEMO.md, docs/TESTING.md, docs/CASSANDRA_DESIGN.md và docs/PERFORMANCE.md cho bản đang chạy bằng WSL.

# TỔNG KẾT BÀN GIAO PHIÊN BẢN CHÍNH THỨC (FINAL RELEASE SUMMARY)
## HỆ THỐNG AUDIT LOG & GIÁM SÁT VI DỊCH VỤ - APACHE CASSANDRA 4.1
**Mã phiên bản đóng băng:** `v1.0.0-RC` (Release Candidate)  
**Thời điểm bàn giao:** 14/10/2026  
**Đặc tả kỹ thuật:** Triết lý Query-First Data Modeling, 0% ALLOW FILTERING, Native TTL 30s, Triple-Write Parity, Phân trang Cursor `page_state`.

---

## 1. CÁC COMMAND CHÍNH XÁC ĐỂ COPY CHẠY KHI BẢO VỆ (WINDOWS POWERSHELL)

Mở **Windows PowerShell** (Run as Administrator) và chạy theo thứ tự sau:

### Bước 1: Khởi động Cụm Apache Cassandra 4.1
```powershell
cd d:\NoSQL10\audit-log-system
docker compose up -d
```

### Bước 2: Kiểm tra trạng thái Node (Chờ ~40s cho JVM sẵn sàng)
```powershell
docker exec -it cassandra_audit_node nodetool status
```
> **Dấu hiệu thành công:** Ký tự **`UN`** (**Up / Normal**), Port `9042`, Owns `100.0%`.

### Bước 3: Nạp Schema và Danh mục Dịch vụ vào Cassandra
```powershell
Get-Content database\01_keyspace.cql | docker exec -i cassandra_audit_node cqlsh
Get-Content database\02_tables.cql | docker exec -i cassandra_audit_node cqlsh
Get-Content database\03_seed_services.cql | docker exec -i cassandra_audit_node cqlsh
Get-Content database\06_users_rbac.cql | docker exec -i cassandra_audit_node cqlsh
```

### Bước 4: Nạp 400 bản ghi Dummy Data phân bố chuẩn
```powershell
npm run seed:dummy
```
> **Phân bố chuẩn:** Auth (70/20/10), User (70/20/10), Order (65/20/15), Payment (60/20/20) rải trong 7 ngày, timestamp không trùng.

### Bước 5: Khởi động Ứng dụng (Mở 2 Terminal riêng biệt)
- **Terminal 1 (Backend API - Port 5000):**
  ```powershell
  cd d:\NoSQL10\audit-log-system
  npm run backend:dev
  ```
- **Terminal 2 (Frontend Web - Port 5173):**
  ```powershell
  cd d:\NoSQL10\audit-log-system
  npm run frontend:dev
  ```

### Các lệnh kiểm thử & tiện ích khác (Chạy từ thư mục gốc):
| Lệnh | Mô tả tác vụ |
| :--- | :--- |
| `npm run test` | Chạy bộ kiểm thử tự động (**40/40 Unit & Contract Tests PASS** bao gồm AUTH-01 đến AUTH-25) |
| `npm run test:perf` | Chạy bộ đo lường hiệu năng thời gian thực PT-01 &rarr; PT-06 |
| `npm run build` | Biên dịch TypeScript sạch cho cả Backend (`tsc`) và Frontend (`vite`) |
| `npm run demo:ttl` | Chạy kịch bản kiểm chứng TTL 30s tự động trên dòng lệnh terminal |

---

## 2. THÔNG TIN TRUY CẬP VÀ TÀI KHOẢN HỆ THỐNG (RBAC)

- **Giao diện Web Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Backend API Base:** [http://localhost:5000](http://localhost:5000)
- **Kiểm tra Health Node:** [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **Kiểm tra System Status:** [http://localhost:5000/api/system/status](http://localhost:5000/api/system/status)
- **Tài khoản Đăng nhập Demo (RBAC 3 Vai trò):**
  - **Quản trị viên (ADMIN):** `admin` / `admin123` (Toàn quyền quản trị Users, Services, System Status, TTL Demo)
  - **Vận hành viên (OPERATOR):** `operator` / `operator123` (Đọc Logs, Đọc Services, Kích hoạt Demo Operations)
  - **Người xem (VIEWER):** `viewer` / `viewer123` (Chỉ đọc Audit Logs & Dashboard)
- **Cổng giao tiếp Container:** `9042` (CQL Native Protocol), `7199` (JMX Metrics)

---

## 3. CHUẨN HÓA THUẬT NGỮ KỸ THUẬT APACHE CASSANDRA

Để trả lời thuyết phục trước Hội đồng, các khái niệm kỹ thuật cốt lõi trong dự án được chuẩn hóa như sau:

1. **Partition Key & Murmur3Partitioner:**
   - Khóa phân vùng xác định vị trí node vật lý lưu trữ dữ liệu thông qua hàm băm token Murmur3 (từ $-2^{63}$ đến $2^{63}-1$).
   - Định tuyến trực tiếp tới đúng node/phân vùng, loại bỏ hoàn toàn việc phải quét toàn bộ cụm.
2. **Clustering Key:**
   - Các cột `(log_time DESC, log_id ASC)` xác định thứ tự lưu trữ vật lý của các dòng dữ liệu ngay trên ổ đĩa bên trong một partition.
   - Giúp việc đọc log mới nhất đạt tốc độ cực cao và cắt lát khoảng thời gian liên tục mà không cần sắp xếp lại trong RAM.
3. **Query-First Data Modeling:**
   - Thiết kế bảng dựa trên câu truy vấn nghiệp vụ (Access Patterns) thay vì chuẩn hóa quan hệ (3NF).
   - Tách thành 2 bảng chuyên biệt: `audit_logs` (cho truy vấn theo dịch vụ và ngày) và `audit_logs_by_service_level` (cho truy vấn theo cấp độ lỗi).
4. **Không phụ thuộc ALLOW FILTERING:**
   - 100% các câu truy vấn nghiệp vụ chính đều xác định đầy đủ khóa phân vùng, đảm bảo Cassandra không bao giờ phải quét toàn cụm hay đọc dữ liệu thừa lên RAM để lọc bỏ.
5. **Cassandra Native TTL & Tombstone:**
   - Mệnh đề `USING TTL <seconds>` gắn mốc hết hạn `Local Deletion Time` vào cell dữ liệu.
   - Khi hết thời gian sống, bản ghi lập tức không thể đọc được (được đánh dấu logic bằng Tombstone, trả về 0 rows).
6. **Compaction & Dọn dẹp vật lý:**
   - Dữ liệu hết hạn không bị xóa vật lý ngay lập tức trên đĩa. Nó chỉ được giải phóng triệt để trong chu kỳ **Compaction** khi các SSTables cũ được gộp thành SSTables mới sau thời gian `gc_grace_seconds`.
7. **Phân trang Con trỏ nhị phân (`page_state`):**
   - Sử dụng con trỏ trạng thái nhị phân do Cassandra driver quản lý, giúp việc duyệt trang sau duy trì độ trễ ổn định, không bị suy giảm hiệu năng như lệnh `OFFSET` của SQL.

---

## 4. 10 CÂU HỎI GIẢNG VIÊN CÓ THỂ HỎI VÀ CÂU TRẢ LỜI NGẮN GỌN

### Câu 1: Tại sao hệ thống Audit Log lại chọn Cassandra mà không dùng RDBMS như MySQL hay PostgreSQL?
> **Trả lời:**  
> Audit Log có đặc thù ghi cực lớn (Write-Heavy, 99% Ghi - 1% Đọc) và dữ liệu bất biến (Append-only). RDBMS dùng B-Tree index và khóa dòng (locking), khi hàng triệu log đổ về sẽ nghẽn ngẫu nhiên trên đĩa (Random I/O). Cassandra dùng cấu trúc **LSM-Tree** ghi tuần tự vào CommitLog và MemTable trên RAM, cho tốc độ ghi cực nhanh, không lock và mở rộng tuyến tính chỉ bằng cách bổ sung node.

### Câu 2: Tại sao phải tách thành bảng `audit_logs` và `audit_logs_by_service_level` mà không dùng 1 bảng rồi lọc WHERE level = 'ERROR'?
> **Trả lời:**  
> Đó là nguyên lý **Query-First** và **Denormalization**. Nếu chỉ dùng 1 bảng chính để lọc cột không nằm trong Partition Key, Cassandra bắt buộc phải dùng `ALLOW FILTERING`, đọc toàn bộ partition lên RAM rồi mới lọc bỏ. Bằng cách nhân bản sang bảng thứ hai với Partition Key `((service_name, level, log_date))`, truy vấn được định tuyến thẳng tới phân vùng chứa dữ liệu cần tìm, không quét dư thừa.

### Câu 3: Nếu ghi đồng thời vào nhiều bảng, làm sao giải quyết rủi ro ghi dở dang (Partial Write) khi một bảng thất bại?
> **Trả lời:**  
> Cassandra là hệ thống ưu tiên tính sẵn sàng (AP system) và không hỗ trợ giao dịch ACID phân tán đa bảng. Trong code backend, chúng em thực thi qua `Promise.all` với hai bảng nghiệp vụ chính. Nếu một bảng bị lỗi, toàn bộ Promise bị từ chối và báo lỗi 500 ngay lập tức. Trong kiến trúc thực tế lớn hơn, giải pháp chuẩn mực là đẩy sự kiện log vào hàng đợi Kafka/RabbitMQ kết hợp cơ chế Retry hoặc Outbox Pattern để bù trừ bất đồng bộ.

### Câu 4: Làm sao đảm bảo không bị ghi đè (upsert overwrite) nếu có 2 log sinh ra cùng một mili-giây?
> **Trả lời:**  
> Cấu trúc PRIMARY KEY của chúng em là:  
> `PRIMARY KEY ((service_name, log_date), log_time, log_id)`  
> Cột **`log_id` (TimeUUID)** nằm ở cuối Clustering Key. Do TimeUUID mang tính định danh duy nhất toàn cầu, dù hai sự kiện xảy ra ở cùng một mili-giây (`log_time` trùng nhau), Cassandra vẫn lưu thành hai dòng vật lý độc lập trong partition.

### Câu 5: Khi một log hết hạn TTL (ví dụ 30 giây), dữ liệu có bị xóa khỏi ổ đĩa ngay lập tức không?
> **Trả lời:**  
> Không. Khi hết hạn TTL, Cassandra tạo ra một điểm đánh dấu logic gọi là **Tombstone** và coordinator sẽ bỏ qua bản ghi này trong các truy vấn đọc tiếp theo (trả về 0 rows). Dữ liệu chỉ thực sự được giải phóng vật lý khỏi ổ đĩa trong quá trình **Compaction** khi các file SSTable được gộp lại sau khoảng thời gian `gc_grace_seconds`.

### Câu 6: Tại sao trong bảng `audit_logs` lại đưa `log_date` vào Partition Key mà không chỉ dùng `service_name`?
> **Trả lời:**  
> Nếu chỉ dùng `service_name` làm Partition Key, qua nhiều tháng dữ liệu của một service sẽ phình to thành hàng trăm triệu dòng (vượt ngưỡng khuyến nghị 100MB cho một partition của Cassandra), gây nghẽn JVM và chậm compaction. Việc đưa `log_date` vào `(service_name, log_date)` giới hạn kích thước mỗi phân vùng gọn gàng theo từng ngày.

### Câu 7: Làm thế nào để truy vấn log trải dài qua nhiều ngày (ví dụ từ ngày 10 đến ngày 14)?
> **Trả lời:**  
> Vì `log_date` nằm trong Partition Key nên không thể dùng `WHERE log_date BETWEEN ...`. Backend của chúng em triển khai mô hình **Scatter-Gather cấp ứng dụng**: bóc tách dải ngày thành danh sách các ngày cụ thể, bắn song song các truy vấn độc lập vào đúng từng partition tương ứng của từng ngày, sau đó merge và sort lại theo `log_time DESC` trước khi trả về cho client.

### Câu 8: Tại sao bảng `services` lại có thể dùng Secondary Index `idx_services_name`, trong khi các bảng log thì tuyệt đối tránh?
> **Trả lời:**  
> Secondary Index trong Cassandra phân tán trên nhiều node, gây tốn băng thông nếu áp dụng lên bảng dữ liệu lớn. Tuy nhiên, bảng `services` là bảng danh mục hệ thống (Metadata table) chỉ có tối đa vài chục dòng. Việc đánh index trên bảng siêu nhỏ này nằm trọn trong bộ nhớ, không ảnh hưởng hiệu năng và rất thuận tiện để kiểm tra trùng tên dịch vụ.

### Câu 9: Cơ chế phân trang trong project được cài đặt như thế nào? Tại sao không dùng OFFSET?
> **Trả lời:**  
> Cassandra không hỗ trợ lệnh `OFFSET` hiệu quả vì để bỏ qua $N$ dòng, database vẫn phải quét qua $N$ dòng đó. Hệ thống của chúng em sử dụng phân trang theo con trỏ nhị phân `page_state` từ Cassandra Native Driver. Client gửi kèm cursor base64 của trang trước, Cassandra nhảy thẳng tới vị trí tiếp theo trong SSTable mà không cần quét lại dữ liệu cũ.

### Câu 10: Cơ chế Auto Audit Log của các dịch vụ nghiệp vụ (Auth, Order, User, Payment) hoạt động thế nào?
> **Trả lời:**  
> Trong Controller của từng nghiệp vụ, khi một hành động diễn ra (như tạo đơn hàng hay đăng nhập thất bại), hệ thống tự động bóc tách ngữ cảnh (IP, User ID, Payload, User-Agent), chạy qua bộ lọc che chắn dữ liệu nhạy cảm (mật khẩu, mã thẻ, CVV), sau đó gọi hàm ghi log đồng thời xuống các bảng Cassandra và trả về mã định danh `log_id` trong phản hồi để giao diện có thể tra cứu ngay lập tức.

---

## 5. CHECKLIST TRƯỚC GIỜ BẢO VỆ

- [x] Mở Docker Desktop trước khi cắm máy vào máy chiếu.
- [x] Chạy lệnh `docker exec -it cassandra_audit_node nodetool status` thấy chữ `UN`.
- [x] Mở sẵn 2 tab terminal: Tab 1 chạy backend (`npm run backend:dev`), Tab 2 chạy frontend (`npm run frontend:dev`).
- [x] Đăng nhập sẵn màn hình Dashboard: `http://localhost:5173` (`admin` / `admin123`).
- [x] Chuẩn bị sẵn file [docs/DEMO.md](file:///d:/NoSQL10/audit-log-system/docs/DEMO.md) và tài liệu này để tự tin thuyết trình.
