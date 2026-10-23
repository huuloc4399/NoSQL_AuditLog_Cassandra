# Kết quả kiểm thử hiệu năng Cassandra

Thời điểm UTC: 2026-10-22T12:55:46.790Z. Trạng thái: COMPLETED.

Cassandra 4.1.12 chạy trong Ubuntu 22.04 WSL2, một node, RF=1, consistency ONE. Máy chạy benchmark: win32, Node v24.14.1. Số liệu đo trực tiếp bằng performance.now(), không dùng số giả lập.

| Mã | Bài kiểm tra | Thao tác | Đạt | Lỗi | Hàng đọc/ghi | Tổng ms | TB ms | P95 ms | Thao tác/giây |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PT-01 | Logged batch: 100 events into 3 tables | 100 | 100 | 0 | 300 | 509.04 | 5.09 | 5.82 | 196.45 |
| PT-02 | Logged batch: 300 events into 3 tables | 300 | 300 | 0 | 900 | 1105.05 | 3.68 | 4.77 | 271.48 |
| PT-03 | Logged batch: 500 events into 3 tables | 500 | 500 | 0 | 1500 | 1473.93 | 2.95 | 3.78 | 339.23 |
| PT-04 | Service + date | 50 | 50 | 0 | 5000 | 197.82 | 3.95 | 4.96 | 252.75 |
| PT-05 | Service + level + date | 50 | 50 | 0 | 5000 | 156.08 | 3.12 | 3.83 | 320.35 |
| PT-06 | Time range | 50 | 50 | 0 | 5000 | 139.97 | 2.8 | 3.49 | 357.21 |

Mỗi lần ghi là một logged batch gồm ba bảng theo cùng UUID. Các lần ghi và truy vấn được thực hiện tuần tự; đây là bài đo nhỏ trên một máy, không phải kiểm thử tải đồng thời hoặc bằng chứng khả năng chịu lỗi nhiều node. Độ trễ bao gồm kết nối Windows đến WSL. Kết quả có thể thay đổi theo tải máy và trạng thái cache.

Dữ liệu đo nằm riêng tại keyspace audit_log_benchmark, không xuất hiện trên Dashboard. Mỗi bản ghi benchmark có TTL 3600 giây; không xóa hoặc thay đổi dữ liệu demo của ứng dụng.

Chạy lại: mở START_REAL_DEMO.bat, sau đó chạy npm run test:perf trong thư mục backend. File JSON kèm theo ghi rõ môi trường và số lần lỗi; có lỗi thì tiến trình trả mã thất bại.
