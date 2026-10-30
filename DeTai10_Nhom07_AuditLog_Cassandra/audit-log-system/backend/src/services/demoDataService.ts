/**
 * [BAREM 4] Chuẩn bị 48 log của ngày UTC hiện tại: 4 dịch vụ x 12 mẫu.
 * Mỗi dịch vụ có 6 INFO, 3 WARN, 3 ERROR; đây là phần bổ sung, khác bộ khởi tạo 400 log.
 * Mẫu đặt lúc 00:00 UTC nên khi demo lọc cả ngày hoặc để trống bộ lọc giờ.
 * TTL 7 ngày của mẫu hôm nay khác TTL 30 giây của màn hình bảo vệ.
 */
import { v5 as uuidv5 } from 'uuid';
import { getCassandraClient, cassandra } from '../config/cassandra.js';
import { serviceCatalogService } from './serviceCatalogService.js';
import { auditLogService } from './auditLogService.js';

let preparation: Promise<{ date: string; added: number; existing: number; skipped: string[] }> | null = null;

// UUID cố định theo ngày/dịch vụ/vị trí giúp lần chuẩn bị sau nhận diện mẫu đã có.
export function prepareTodayDemoData() {
  if (preparation) return preparation;
  preparation = prepare().finally(() => { preparation = null; });
  return preparation;
}

async function prepare() {
  const now = new Date(); const date = now.toISOString().slice(0, 10);
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const result = { date, added: 0, existing: 0, skipped: [] as string[] };
  const client = getCassandraClient();
  for (const service of ['Auth', 'User', 'Order', 'Payment']) {
    let record = await serviceCatalogService.getServiceByName(service);
    if (!record) record = await serviceCatalogService.createService({ service_name: service, description: `${service} demo service`, status: true });
    if (!record.status) { result.skipped.push(service); continue; }
    for (let i = 0; i < 12; i++) {
      const id = uuidv5(`auditflow-demo/${date}/${service}/${i}`, uuidv5.DNS);
      const found = await client.execute('SELECT log_id FROM audit_logs_by_id WHERE log_id = ?',
        [cassandra.types.Uuid.fromString(id)], { prepare: true });
      if (found.rowLength) { result.existing++; continue; }
      const level = (i < 6 ? 'INFO' : i < 9 ? 'WARN' : 'ERROR') as 'INFO' | 'WARN' | 'ERROR';
      const actions = { Auth: 'LOGIN_SUCCESS', User: 'UPDATE_USER', Order: 'CREATE_ORDER', Payment: 'PAYMENT_SUCCESS' };
      await auditLogService.createLog({ service_name: service, level,
        action: level === 'ERROR' ? `${service.toUpperCase()}_DEMO_ERROR` : actions[service as keyof typeof actions],
        // Giữ cả khóa đầy đủ ổn định để các lần chuẩn bị cùng mẫu ghi về cùng một hàng.
        // Mốc đầu ngày thuộc đúng partition UTC hiện tại và không nằm trong tương lai.
        log_id: id, log_time: new Date(midnight),
        user_id: 'demo_sample', message: `[Dữ liệu mẫu ${date}] ${service} ${level} #${i + 1}`,
        details: { demo_sample: true, sample_date: date, scenario: `${service}/${level}`, slot: i, prepared_at: now.toISOString() },
        ttl: 7 * 24 * 3600,
      });
      result.added++;
    }
  }
  return result;
}
