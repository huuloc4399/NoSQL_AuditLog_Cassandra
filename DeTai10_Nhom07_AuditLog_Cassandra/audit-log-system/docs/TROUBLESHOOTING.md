> Tài liệu lịch sử trước bản sửa 22/10/2026. Tham khảo README_DEMO.md và REAL_DATABASE.md tại thư mục gốc, cùng docs/DEMO.md, docs/TESTING.md, docs/CASSANDRA_DESIGN.md và docs/PERFORMANCE.md cho bản đang chạy bằng WSL.

# CẨM NANG XỬ LÝ SỰ CỐ VẬN HÀNH (TROUBLESHOOTING GUIDE)
## HỆ THỐNG AUDIT LOG - APACHE CASSANDRA & REST API MONITORING

Tài liệu này tổng hợp 10 sự cố phổ biến nhất có thể gặp phải trong quá trình cài đặt, vận hành thử nghiệm hoặc bảo vệ đồ án trực tiếp trên Windows PowerShell, cùng nguyên nhân gốc rễ và câu lệnh khắc phục tức thì.

---

## MỤC LỤC
1. [Sự cố 1: Docker Desktop không chạy / npipe error](#1-sự-cố-1-docker-desktop-không-chạy--npipe-error)
2. [Sự cố 2: Cassandra chưa ready / Connection Refused 9042](#2-sự-cố-2-cassandra-chưa-ready--connection-refused-9042)
3. [Sự cố 3: cqlsh không vào được](#3-sự-cố-3-cqlsh-không-vào-được)
4. [Sự cố 4: Backend báo lỗi Cassandra connection error (HTTP 503)](#4-sự-cố-4-backend-báo-lỗi-cassandra-connection-error-http-503)
5. [Sự cố 5: Lỗi CORS khi Frontend gọi Backend API](#5-sự-cố-5-lỗi-cors-khi-frontend-gọi-backend-api)
6. [Sự cố 6: Xung đột cổng Port Conflict (5000, 5173, 9042)](#6-sự-cố-6-xung-đột-cổng-port-conflict-5000-5173-9042)
7. [Sự cố 7: Lỗi npm / Cache node_modules](#7-sự-cố-7-lỗi-npm--cache-node_modules)
8. [Sự cố 8: Frontend API Error (Network Error, 401 Unauthorized, 404)](#8-sự-cố-8-frontend-api-error-network-error-401-unauthorized-404)
9. [Sự cố 9: Lệnh nodetool không chạy / JMX Connection Refused](#9-sự-cố-9-lệnh-nodetool-không-chạy--jmx-connection-refused)
10. [Sự cố 10: TTL không biến mất đúng lúc / Lệch giờ Docker](#10-sự-cố-10-ttl-không-biến-mất-đúng-lúc--lệch-giờ-docker)

---

### 1. Sự cố 1: Docker Desktop không chạy / npipe error

#### Triệu chứng:
Khi gõ `docker ps` hoặc `docker compose up -d`, PowerShell báo lỗi:
```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine: 
The system cannot find the file specified.
```

#### Nguyên nhân:
Ứng dụng Docker Desktop chưa được khởi động trên Windows hoặc tiến trình WSL2 engine bị treo ngầm.

#### Cách xử lý (PowerShell):
1. **Khởi chạy Docker Desktop từ PowerShell:**
   ```powershell
   Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
   ```
2. **Khởi động lại subsystem WSL2 nếu Docker bị đơ:**
   ```powershell
   wsl --shutdown
   ```
   Sau đó mở lại Docker Desktop và chờ icon cá voi chuyển sang màu xanh (Engine Running).
3. **Kiểm tra kết nối lại:**
   ```powershell
   docker version
   docker ps
   ```

---

### 2. Sự cố 2: Cassandra chưa ready / Connection Refused 9042

#### Triệu chứng:
Backend hoặc các script kiểm thử báo lỗi:
```text
All host(s) tried for query failed. First host tried, 127.0.0.1:9042: 
Error: connect ECONNREFUSED 127.0.0.1:9042
```

#### Nguyên nhân:
Apache Cassandra chạy trên nền Java Virtual Machine (JVM). Khi container vừa khởi động, Cassandra mất khoảng **25 - 45 giây** để:
- Phân bổ bộ nhớ Heap/Off-Heap.
- Nạp commitlog và phục hồi memtable.
- Khởi động Gossip protocol và JMX port 7199.
- Mở cổng lắng nghe CQL native protocol trên port 9042.

#### Cách xử lý (PowerShell):
1. **Xem log tiến trình khởi động của Cassandra theo thời gian thực:**
   ```powershell
   docker logs -f cassandra_audit_node
   ```
2. **Dấu hiệu nhận biết Cassandra đã sẵn sàng 100%:**
   Khi trong log xuất hiện dòng chữ:
   ```text
   Startup complete
   Listening for CQL clients on /0.0.0.0:9042 (native protocol)...
   ```
3. **Kiểm tra trạng thái node qua nodetool:**
   ```powershell
   docker exec -it cassandra_audit_node nodetool status
   ```
   Nếu xuất hiện chữ **`UN`** (Up / Normal) tức là Cassandra đã sẵn sàng nhận kết nối.

---

### 3. Sự cố 3: cqlsh không vào được

#### Triệu chứng:
Gõ `cqlsh` ngoài terminal bị báo lỗi `command not found`, hoặc:
```text
Connection error: ('Unable to connect to any servers', {'127.0.0.1': 9042})
```

#### Nguyên nhân:
- `cqlsh` là công cụ dòng lệnh Python đi kèm bên trong Cassandra, không cài mặc định trên môi trường Windows host.
- Hoặc kết nối bị từ chối do truyền thiếu thông số container.

#### Cách xử lý (PowerShell):
Luôn chạy `cqlsh` **thông qua Docker container**:

```powershell
# Chạy trực tiếp vào shell CQL của container
docker exec -it cassandra_audit_node cqlsh

# Nếu Cassandra bật xác thực (Authentication), chỉ định tài khoản mặc định:
docker exec -it cassandra_audit_node cqlsh -u cassandra -p cassandra

# Chạy một câu truy vấn nhanh mà không cần vào chế độ tương tác:
docker exec -it cassandra_audit_node cqlsh -e "SELECT cluster_name, release_version FROM system.local;"
```

---

### 4. Sự cố 4: Backend báo lỗi Cassandra connection error (HTTP 503)

#### Triệu chứng:
Backend Express khởi động báo lỗi `[Cassandra] Connection Failed` hoặc khi gọi `/api/health` nhận về:
```json
{
  "success": false,
  "status": "DEGRADED",
  "message": "Database temporarily unavailable"
}
```

#### Nguyên nhân:
1. Container Cassandra chưa chạy hoặc chưa bind port `9042:9042` ra host.
2. File cấu hình `.env` của Backend trỏ sai địa chỉ IP hoặc sai tên Keyspace.
3. Keyspace `audit_log_system` chưa được tạo trong Cassandra.

#### Cách xử lý (PowerShell):
1. **Kiểm tra file cấu hình `backend/.env`:**
   ```env
   PORT=5000
   CASSANDRA_CONTACT_POINTS=127.0.0.1
   CASSANDRA_PORT=9042
   CASSANDRA_LOCAL_DATA_CENTER=datacenter1
   CASSANDRA_KEYSPACE=audit_log_system
   ```
2. **Khởi tạo lại Keyspace và các bảng nếu chưa có:**
   ```powershell
   cd d:\NoSQL10\audit-log-system
   npm run db:init --prefix backend
   ```
   Hoặc nạp thủ công file schema CQL:
   ```powershell
   Get-Content database\01_keyspace.cql | docker exec -i cassandra_audit_node cqlsh
   Get-Content database\02_tables.cql | docker exec -i cassandra_audit_node cqlsh
   ```

---

### 5. Sự cố 5: Lỗi CORS khi Frontend gọi Backend API

#### Triệu chứng:
Console trên trình duyệt báo đỏ:
```text
Access to XMLHttpRequest at 'http://localhost:5000/api/...' from origin 'http://localhost:5173'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

#### Nguyên nhân:
- Frontend chạy trên cổng khác (ví dụ `5174` do cổng `5173` bị chiếm) trong khi Backend chỉ cho phép cổng `5173`.
- Biến môi trường `VITE_API_BASE_URL` trong Frontend trỏ sai URL.

#### Cách xử lý (PowerShell):
1. **Kiểm tra `frontend/.env`:**
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```
2. **Kiểm tra `backend/.env`:**
   ```env
   CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
   ```
3. Khởi động lại Backend để nạp cấu hình CORS mới:
   ```powershell
   cd d:\NoSQL10\audit-log-system\backend
   npm run dev
   ```

---

### 6. Sự cố 6: Xung đột cổng Port Conflict (5000, 5173, 9042)

#### Triệu chứng:
Backend báo lỗi:
```text
Error: listen EADDRINUSE: address already in use :::5000
```
Hoặc Docker báo:
```text
Bind for 0.0.0.0:9042 failed: port is already allocated
```

#### Nguyên nhân:
Có tiến trình Node.js hoặc container cũ đang chạy ngầm chiếm dụng cổng.

#### Cách xử lý (PowerShell):
Sử dụng các lệnh PowerShell sau để tìm PID và giải phóng cổng ngay lập tức:

```powershell
# 1. Tìm và giải phóng cổng 5000 (Backend Express)
$proc5000 = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($proc5000) { Stop-Process -Id $proc5000 -Force; Write-Host "✔ Đã dừng tiến trình chiếm port 5000 (PID: $proc5000)" }

# 2. Tìm và giải phóng cổng 5173 (Frontend Vite)
$proc5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($proc5173) { Stop-Process -Id $proc5173 -Force; Write-Host "✔ Đã dừng tiến trình chiếm port 5173 (PID: $proc5173)" }

# 3. Tìm và giải phóng cổng 9042 (Cassandra)
$proc9042 = Get-NetTCPConnection -LocalPort 9042 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($proc9042) { Stop-Process -Id $proc9042 -Force; Write-Host "✔ Đã giải phóng port 9042 (PID: $proc9042)" }
```

---

### 7. Sự cố 7: Lỗi npm / Cache node_modules

#### Triệu chứng:
Khi chạy `npm run build` hoặc `npm run dev` bị lỗi:
```text
Rollup failed to resolve import / Cannot find module
```

#### Nguyên nhân:
Thư mục cache `node_modules` hoặc cache của Vite bị xung đột sau khi cập nhật mã nguồn.

#### Cách xử lý (PowerShell):
Dọn dẹp cache và cài đặt lại sạch sẽ:

```powershell
# Dọn dẹp Backend
cd d:\NoSQL10\audit-log-system\backend
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm install
npm run build

# Dọn dẹp Frontend
cd d:\NoSQL10\audit-log-system\frontend
Remove-Item -Recurse -Force node_modules, package-lock.json, dist -ErrorAction SilentlyContinue
npm install
npm run build
```

---

### 8. Sự cố 8: Frontend API Error (Network Error, 401 Unauthorized, 404)

#### Triệu chứng:
- **Network Error:** Giao diện hiển thị banner đỏ không tải được dữ liệu.
- **401 Unauthorized:** Giao diện đột ngột chuyển hướng về trang `/login`.
- **404 Not Found:** Không tìm thấy bản ghi chi tiết.

#### Cách xử lý:
1. **Khắc phục Network Error:**
   - Kiểm tra Backend xem có đang chạy tại `http://localhost:5000` không bằng cách mở trình duyệt vào: `http://localhost:5000/api/health`.
2. **Khắc phục 401 Unauthorized:**
   - Phiên đăng nhập JWT đã hết hạn (thời hạn 24 giờ).
   - Mở Console trình duyệt (F12) -> Application -> Local Storage -> Xóa `audit_auth_token` -> Đăng nhập lại với `admin` / `admin123`.
3. **Khắc phục 404 Not Found trên bản ghi TTL:**
   - Đây là hành vi **chính xác** của hệ thống: Khi bản ghi có TTL hết hạn (sau 30s), Cassandra tự động tiêu hủy row nên API trả về 404 là đúng thiết kế NoSQL.

---

### 9. Sự cố 9: Lệnh nodetool không chạy / JMX Connection Refused

#### Triệu chứng:
Khi chạy `nodetool status`, terminal báo lỗi:
```text
nodetool: Failed to connect to '127.0.0.1:7199' - ConnectException: 'Connection refused'
```

#### Nguyên nhân:
- JMX (Java Management Extensions) của Cassandra chạy nội bộ trong container và cần thời gian khởi động sau khi JVM boot.
- Hoặc bạn đang chạy lệnh nodetool trực tiếp từ PowerShell của Windows thay vì thông qua container Docker.

#### Cách xử lý (PowerShell):
Luôn truyền qua `docker exec`:

```powershell
# Chạy nodetool status bên trong container:
docker exec -it cassandra_audit_node nodetool status

# Kiểm tra thông số bộ nhớ và info của node:
docker exec -it cassandra_audit_node nodetool info

# Kiểm tra mô hình bảng và phân vùng:
docker exec -it cassandra_audit_node nodetool tablestats audit_log_system
```

---

### 10. Sự cố 10: TTL không biến mất đúng lúc / Lệch giờ Docker

#### Triệu chứng:
Đã quá 30 giây nhưng truy vấn SELECT vẫn còn thấy bản ghi, hoặc bản ghi biến mất ngay lập tức sau 1-2 giây.

#### Nguyên nhân kỹ thuật NoSQL:
1. **Lệch đồng hồ (Clock Skew) giữa Windows và WSL2/Docker:**
   Cassandra tính toán thời điểm hết hạn dựa trên:  
   $$\text{Expiration Time} = \text{Server Epoch Seconds} + \text{TTL}$$  
   Nếu máy tính Windows sleep hoặc hibernate, đồng hồ máy ảo WSL2 trong Docker có thể bị lệch so với giờ hệ thống.
2. **Cơ chế Compaction của Cassandra:**
   Bản ghi hết hạn TTL sẽ bị **bỏ qua ngay lập tức ở tầng đọc (Read Query)**. Về mặt vật lý trên ổ cứng (SSTable), dữ liệu sẽ được giải phóng hoàn toàn khi chu kỳ Minor/Major Compaction diễn ra (dựa theo cấu hình `gc_grace_seconds`).

#### Cách xử lý (PowerShell):
1. **Kiểm tra giờ hiện tại của container Cassandra so với Windows host:**
   ```powershell
   Get-Date -Format "yyyy-MM-dd HH:mm:ss"
   docker exec -it cassandra_audit_node date
   ```
2. **Nếu bị lệch giờ, đồng bộ lại thời gian Docker:**
   ```powershell
   wsl --shutdown
   docker compose restart
   ```
3. **Chạy lại kịch bản kiểm tra TTL chuẩn xác:**
   ```powershell
   npm run demo:ttl
   ```

---

> [!TIP]
> **Checklist 30 giây trước khi bắt đầu thuyết trình bảo vệ:**
> 1. `docker ps` &rarr; Container `cassandra_audit_node` đang chạy.
> 2. `docker exec -it cassandra_audit_node nodetool status` &rarr; Hiện **`UN`**.
> 3. `curl http://localhost:5000/api/health` &rarr; Hiện `{"status":"UP"}`.
> 4. Trình duyệt mở sẵn `http://localhost:5173` &rarr; Đã đăng nhập vào Dashboard.
