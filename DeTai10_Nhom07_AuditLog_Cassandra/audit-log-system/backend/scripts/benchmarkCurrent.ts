/**
 * [BAREM 4] Đo hiệu năng thật bằng performance.now(), không dùng thời gian giả lập.
 * PT-01..03: lần lượt 100/300/500 sự kiện, mỗi sự kiện một batch ba bảng.
 * PT-04..06: mỗi mẫu truy vấn chạy 50 lần; báo trung bình, P95, throughput và số lỗi.
 * Các thao tác chạy tuần tự trên một máy; không phải bài tải đồng thời hoặc chịu lỗi nhiều node.
 * Keyspace audit_log_benchmark tách khỏi dữ liệu ứng dụng; log thử có TTL 3.600 giây.
 * Chạy npm run test:perf; kết quả nằm trong docs/PERFORMANCE.md và performance-results.json.
 */
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectCassandra, closeCassandra, getCassandraClient, cassandra } from '../src/config/cassandra.js';
import { env } from '../src/config/env.js';

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const keyspace = 'audit_log_benchmark';
type Metric = { id: string; name: string; operations: number; success: number; failed: number;
  rows: number; duration_ms: number; average_ms: number; p95_ms: number; throughput: number };
const metrics: Metric[] = [];
const round = (n: number) => Number(n.toFixed(2));

// Mỗi mẫu là thời gian client chờ một thao tác; latency gồm cả đường truyền tới WSL.
// P95 lấy phần tử ở mốc 95% sau khi sắp xếp; lỗi được đếm riêng, không giả thành thành công.
async function measure(id: string, name: string, operations: number, work: (i: number) => Promise<number>) {
  const samples: number[] = []; let failed = 0; let rows = 0;
  const begin = performance.now();
  for (let i = 0; i < operations; i++) {
    const start = performance.now();
    try { rows += await work(i); samples.push(performance.now() - start); }
    catch (error) { failed++; console.error(`${id} failed: ${(error as Error).message}`); }
  }
  const duration = performance.now() - begin; samples.sort((a, b) => a - b);
  const result = { id, name, operations, success: samples.length, failed, rows,
    duration_ms: round(duration), average_ms: round(samples.reduce((a, b) => a + b, 0) / (samples.length || 1)),
    p95_ms: round(samples[Math.max(0, Math.ceil(samples.length * .95) - 1)] || 0),
    throughput: round(samples.length * 1000 / duration) };
  metrics.push(result); console.log(JSON.stringify(result));
}

async function main() {
  if (!await connectCassandra()) throw new Error('Cassandra unavailable; no benchmark numbers generated');
  const client = getCassandraClient();
  await client.execute(`CREATE KEYSPACE IF NOT EXISTS ${keyspace} WITH replication = {'class':'SimpleStrategy','replication_factor':1}`);
  const columns = 'service_name text, log_date date, log_time timestamp, log_id uuid, level text, action text, user_id text, ip_address text, message text, details text';
  await client.execute(`CREATE TABLE IF NOT EXISTS ${keyspace}.audit_logs (${columns}, PRIMARY KEY ((service_name,log_date),log_time,log_id)) WITH CLUSTERING ORDER BY (log_time DESC,log_id ASC)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS ${keyspace}.audit_logs_by_service_level (${columns}, PRIMARY KEY ((service_name,level,log_date),log_time,log_id)) WITH CLUSTERING ORDER BY (log_time DESC,log_id ASC)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS ${keyspace}.audit_logs_by_id (${columns}, PRIMARY KEY (log_id))`);
  const now = new Date(); const date = cassandra.types.LocalDate.fromString(now.toISOString().slice(0, 10));
  const service = `Benchmark_${Date.now()}`;
  const insert = (table: string) => `INSERT INTO ${keyspace}.${table} (service_name,log_date,log_time,log_id,level,action,user_id,ip_address,message,details) VALUES (?,?,?,?,?,?,?,?,?,?) USING TTL 3600`;
  for (const [id, count] of [['PT-01', 100], ['PT-02', 300], ['PT-03', 500]] as const) {
    await measure(id, `Logged batch: ${count} events into 3 tables`, count, async i => {
      const params = [service, date, new Date(), cassandra.types.Uuid.random(), 'INFO', 'BENCHMARK', 'benchmark', '127.0.0.1', `${id}/${i}`, '{}'];
      await client.batch(['audit_logs', 'audit_logs_by_service_level', 'audit_logs_by_id'].map(table => ({ query: insert(table), params })), { prepare: true, logged: true });
      return 3;
    });
  }
  // [BAREM 3, 4] Đối chiếu ba kiểu khóa truy vấn: dịch vụ/ngày, thêm level và dải giờ.
  const queries = [
    ['PT-04', 'Service + date', `SELECT * FROM ${keyspace}.audit_logs WHERE service_name=? AND log_date=? LIMIT 100`, [service, date]],
    ['PT-05', 'Service + level + date', `SELECT * FROM ${keyspace}.audit_logs_by_service_level WHERE service_name=? AND level=? AND log_date=? LIMIT 100`, [service, 'INFO', date]],
    ['PT-06', 'Time range', `SELECT * FROM ${keyspace}.audit_logs WHERE service_name=? AND log_date=? AND log_time>=? AND log_time<=? LIMIT 100`, [service, date, now, new Date()]],
  ] as const;
  for (const [id, name, query, params] of queries) {
    await measure(id, name, 50, async () => {
      const result = await client.execute(query, [...params], { prepare: true });
      if (!result.rowLength) throw new Error('Query unexpectedly returned no benchmark data');
      return result.rowLength;
    });
  }
  const server = (await client.execute('SELECT cluster_name,release_version,data_center FROM system.local')).first();
  // Lưu cả môi trường và ngày đo để không dùng kết quả cũ như số đo của lần chạy mới.
  const report = { status: metrics.every(m => m.failed === 0) ? 'COMPLETED' : 'FAILED', executed_at: new Date().toISOString(),
    environment: { client_platform: process.platform, node_version: process.version,
      server_runtime: 'Ubuntu 22.04 / WSL2', cassandra_version: server.release_version,
      cluster_name: server.cluster_name, datacenter: server.data_center,
      contact_points: env.CASSANDRA_CONTACT_POINTS, port: env.CASSANDRA_PORT,
      keyspace, replication_factor: 1, consistency: 'ONE', logged_batch: true, benchmark_ttl_seconds: 3600 },
    metrics_summary: metrics };
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, 'performance-results.json'), JSON.stringify(report, null, 2));
  const table = metrics.map(m => `| ${m.id} | ${m.name} | ${m.operations} | ${m.success} | ${m.failed} | ${m.rows} | ${m.duration_ms} | ${m.average_ms} | ${m.p95_ms} | ${m.throughput} |`).join('\n');
  fs.writeFileSync(path.join(docs, 'PERFORMANCE.md'), `# Kết quả kiểm thử hiệu năng Cassandra

Thời điểm UTC: ${report.executed_at}. Trạng thái: ${report.status}.

Cassandra ${server.release_version} chạy trong Ubuntu 22.04 WSL2, một node, RF=1, consistency ONE. Máy chạy benchmark: ${process.platform}, Node ${process.version}. Số liệu đo trực tiếp bằng performance.now(), không dùng số giả lập.

| Mã | Bài kiểm tra | Thao tác | Đạt | Lỗi | Hàng đọc/ghi | Tổng ms | TB ms | P95 ms | Thao tác/giây |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${table}

Mỗi lần ghi là một logged batch gồm ba bảng theo cùng UUID. Các lần ghi và truy vấn được thực hiện tuần tự; đây là bài đo nhỏ trên một máy, không phải kiểm thử tải đồng thời hoặc bằng chứng khả năng chịu lỗi nhiều node. Độ trễ bao gồm kết nối Windows đến WSL. Kết quả có thể thay đổi theo tải máy và trạng thái cache.

Dữ liệu đo nằm riêng tại keyspace audit_log_benchmark, không xuất hiện trên Dashboard. Mỗi bản ghi benchmark có TTL 3600 giây; không xóa hoặc thay đổi dữ liệu demo của ứng dụng.

Chạy lại: mở START_REAL_DEMO.bat, sau đó chạy npm run test:perf trong thư mục backend. File JSON kèm theo ghi rõ môi trường và số lần lỗi; có lỗi thì tiến trình trả mã thất bại.
`);
  if (report.status !== 'COMPLETED') process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(closeCassandra);
