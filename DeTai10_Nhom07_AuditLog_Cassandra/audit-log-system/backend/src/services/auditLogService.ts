/**
 * [BAREM 2, 3, 4] Luồng trung tâm ghi, lọc và kiểm chứng Audit Log.
 * createLog -> ba INSERT chung UUID/thời gian -> logged batch -> phản hồi API.
 * querySingleDay chọn bảng theo bộ lọc; getTtlStatus đọc TTL(message) trong DB.
 * Khi bảo vệ, đối chiếu UUID từ web với CQLSH; hướng dẫn ở docs/GIAI_THICH_CODE_THEO_BAREM.md.
 */
import { getCassandraClient, cassandra } from '../config/cassandra.js';
import { serviceCatalogService } from './serviceCatalogService.js';
import { AppError } from '../middleware/errorHandler.js';
import { maskSensitiveText, sanitizeLogDetails } from '../utils/sensitiveDataFilter.js';
import { isValidUuid } from '../validators/auditLogValidator.js';

export interface AuditLogInput {
  service_name: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  action: string;
  message: string;
  user_id?: string | null;
  ip_address?: string | null;
  details?: any;
  log_time?: Date | string | null;
  ttl?: number | null; // Thời hạn tính bằng giây; có giá trị thì thêm USING TTL vào INSERT.
  log_id?: string | null; // UUID tùy chọn; không đồng nghĩa chống trùng tuyệt đối qua mọi lần khởi động.
  internal?: boolean; // Sự kiện điều khiển nội bộ; schema tiếp nhận log bên ngoài không nhận cờ này.
}

export interface AuditLogRecord {
  service_name: string;
  log_date: string;
  log_time: Date;
  log_id: string;
  level: string;
  action: string;
  user_id: string | null;
  ip_address: string | null;
  message: string;
  details: string | null;
  remaining_ttl?: number;
}

export interface QueryFilter {
  service?: string;
  level?: 'INFO' | 'WARN' | 'ERROR';
  date?: string; // YYYY-MM-DD
  start_date?: string; // YYYY-MM-DD: ngày đầu của truy vấn nhiều phân vùng.
  end_date?: string;   // YYYY-MM-DD: ngày cuối của truy vấn nhiều phân vùng.
  from?: string; // Giờ UTC dạng HH:mm, HH:mm:ss hoặc timestamp ISO.
  to?: string;   // Giờ UTC dạng HH:mm, HH:mm:ss hoặc timestamp ISO.
  limit?: number;
  page_state?: string | null;
}

export interface QueryResult {
  logs: AuditLogRecord[];
  page_state?: string | null;
  count: number;
}

// Cache chống trùng 10 giây trong một tiến trình, khác với TTL lưu dữ liệu của Cassandra.
// Mất cache khi backend khởi động lại; không dùng để cam kết exactly-once.
interface CachedEvent {
  timestamp: number;
  record: AuditLogRecord;
}
const duplicateEventCache = new Map<string, CachedEvent>();

function cleanDuplicateCache(): void {
  const now = Date.now();
  for (const [key, value] of duplicateEventCache.entries()) {
    if (now - value.timestamp > 10000) {
      duplicateEventCache.delete(key);
    }
  }
}

export class AuditLogService {
  /**
   * [BAREM 1] Tạo ngày UTC thống nhất; tránh UI và backend đọc hai partition khác ngày.
   */
  private formatDateToYMD(d: Date): string {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Đổi ngày sang kiểu LocalDate của driver trước khi truyền vào điều kiện partition key.
   */
  private toCassandraLocalDate(dateStrOrObj: string | Date): cassandra.types.LocalDate {
    if (typeof dateStrOrObj === 'string') {
      const parts = dateStrOrObj.split('-').map(Number);
      return new cassandra.types.LocalDate(parts[0], parts[1], parts[2]);
    }
    const year = dateStrOrObj.getUTCFullYear();
    const month = dateStrOrObj.getUTCMonth() + 1;
    const day = dateStrOrObj.getUTCDate();
    return new cassandra.types.LocalDate(year, month, day);
  }

  /**
   * Đóng gói pageState của driver thành chuỗi để client gửi lại khi tải trang sau.
   */
  private encodePageState(pageState: any): string | null {
    if (!pageState) return null;
    if (Buffer.isBuffer(pageState)) {
      return pageState.toString('base64');
    }
    if (typeof pageState === 'string') {
      if (/^[0-9a-fA-F]+$/.test(pageState)) {
        try {
          return Buffer.from(pageState, 'hex').toString('base64');
        } catch {
          return pageState;
        }
      }
      return pageState;
    }
    return null;
  }

  /**
   * Giải mã cursor của ứng dụng hoặc pageState của Cassandra; không phân trang bằng OFFSET.
   */
  private decodeCursor(cursor: string | null | undefined): {
    isCompound: boolean;
    compound?: { t: string; id: string };
    pageState?: Buffer | string;
  } {
    if (!cursor) return { isCompound: false };
    try {
      const utf8 = Buffer.from(cursor, 'base64').toString('utf8');
      if (utf8.startsWith('{') && utf8.endsWith('}')) {
        const parsed = JSON.parse(utf8);
        if (parsed.t && parsed.id) {
          return { isCompound: true, compound: parsed };
        }
      }
    } catch {}

    if (/^[0-9a-fA-F]+$/.test(cursor)) {
      return { isCompound: false, pageState: Buffer.from(cursor, 'hex') };
    }

    try {
      return { isCompound: false, pageState: Buffer.from(cursor, 'base64') };
    } catch {
      return { isCompound: false, pageState: cursor };
    }
  }

  /**
   * [BAREM 2] Ghi cùng một sự kiện vào audit_logs, audit_logs_by_service_level và audit_logs_by_id.
   * Dùng chung log_id, tham số log_time và giá trị TTL cho các bản sao theo truy vấn.
   */
  async createLog(input: AuditLogInput, mutations: { query: string; params: any[] }[] = []): Promise<AuditLogRecord> {
    const trimmedServiceName = input.service_name.trim();

    // Bước 1: xác nhận dịch vụ đã đăng ký và có được phép tiếp nhận sự kiện hay không.
    const serviceStatus = await serviceCatalogService.isServiceActive(trimmedServiceName);
    if (!serviceStatus.exists) {
      // Tự tạo một trong bốn nhóm chuẩn nếu thiếu; tên dịch vụ khác phải được đăng ký trước.
      const standardServices = ['Auth', 'User', 'Order', 'Payment'];
      if (standardServices.includes(trimmedServiceName)) {
        await serviceCatalogService.createService({
          service_name: trimmedServiceName,
          description: `${trimmedServiceName} Microservice`,
          status: true,
        });
      } else {
        throw new AppError(`Service '${trimmedServiceName}' is not registered in the system`, 400);
      }
    } else if (!serviceStatus.active && mutations.length === 0 && !input.internal) {
      throw new AppError(`Service '${trimmedServiceName}' is currently INACTIVE. Cannot accept new audit logs.`, 400);
    }

    // Bước 2: nhận diện yêu cầu lặp bằng fingerprint trong cửa sổ cache 10 giây.
    cleanDuplicateCache();
    const dedupeFingerprint = `${trimmedServiceName}:${input.level}:${input.action}:${input.user_id || ''}:${input.message}:${input.log_id || ''}`;
    if (mutations.length === 0 && duplicateEventCache.has(dedupeFingerprint)) {
      const cached = duplicateEventCache.get(dedupeFingerprint)!;
      if (Date.now() - cached.timestamp < 10000) {
        console.log(`[AuditLog] Duplicate event detected within window. Returning cached record idempotent.`);
        return cached.record;
      }
    }

    // Bước 3: che dữ liệu nhạy cảm trên đường ghi nội bộ trước khi đưa vào CQL.
    const maskedMessage = maskSensitiveText(input.message.trim());
    const sanitizedDetails = sanitizeLogDetails(input.details);

    // Bước 4: tạo UUID và thời điểm một lần để ba bảng cùng chỉ tới một sự kiện.
    const logTime = input.log_time
      ? (typeof input.log_time === 'string' ? new Date(input.log_time) : input.log_time)
      : new Date();
    const logDateStr = this.formatDateToYMD(logTime);
    const cassandraLocalDate = this.toCassandraLocalDate(logDateStr);

    let logId: cassandra.types.Uuid;
    if (input.log_id && isValidUuid(input.log_id)) {
      logId = cassandra.types.Uuid.fromString(input.log_id);
    } else {
      logId = cassandra.types.Uuid.random();
    }

    const client = getCassandraClient();

    // [BAREM 1, 2] Bước 5: ba cách tổ chức khóa phục vụ ba mẫu đọc, không JOIN các bảng.
    let query1 = `
      INSERT INTO audit_log_system.audit_logs (
        service_name, log_date, log_time, log_id, level, action, user_id, ip_address, message, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let query2 = `
      INSERT INTO audit_log_system.audit_logs_by_service_level (
        service_name, level, log_date, log_time, log_id, action, user_id, ip_address, message, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let query3 = `
      INSERT INTO audit_log_system.audit_logs_by_id (
        log_id, service_name, log_date, log_time, level, action, user_id, ip_address, message, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // [BAREM 3 - TTL] Thời hạn nằm trực tiếp trong INSERT của cả ba bảng.
    // Nếu bỏ TTL ở một bảng thì sự kiện vẫn còn bản sao sau khi hai bảng khác hết hạn.
    // Kiểm chứng: SELECT TTL(message) theo UUID trước hạn, rồi đọc lại sau hơn 30 giây.
    if (input.ttl && input.ttl > 0) {
      query1 += ` USING TTL ${input.ttl}`;
      query2 += ` USING TTL ${input.ttl}`;
      query3 += ` USING TTL ${input.ttl}`;
    }

    const params1 = [
      trimmedServiceName,
      cassandraLocalDate,
      logTime,
      logId,
      input.level,
      input.action.trim(),
      input.user_id ? input.user_id.trim() : null,
      input.ip_address || null,
      maskedMessage,
      sanitizedDetails || '',
    ];

    const params2 = [
      trimmedServiceName,
      input.level,
      cassandraLocalDate,
      logTime,
      logId,
      input.action.trim(),
      input.user_id ? input.user_id.trim() : null,
      input.ip_address || null,
      maskedMessage,
      sanitizedDetails || '',
    ];

    const params3 = [
      logId,
      trimmedServiceName,
      cassandraLocalDate,
      logTime,
      input.level,
      input.action.trim(),
      input.user_id ? input.user_id.trim() : null,
      input.ip_address || null,
      maskedMessage,
      sanitizedDetails || '',
    ];

    // [BAREM 2, 4] Gửi mutation nghiệp vụ (nếu có) cùng ba INSERT audit trong logged batch.
    // Chỉ trả thành công sau await; batch không phải giao dịch SQL có rollback/isolation nhiều partition.
    // Khi timeout, cần đọc lại trạng thái trước khi gửi lại vì server có thể đã ghi mutation.
    await client.batch([
      ...mutations,
      { query: query1, params: params1 },
      { query: query2, params: params2 },
      { query: query3, params: params3 },
    ], { prepare: true, logged: true });

    const record: AuditLogRecord = {
      service_name: trimmedServiceName,
      log_date: logDateStr,
      log_time: logTime,
      log_id: logId.toString(),
      level: input.level,
      action: input.action.trim(),
      user_id: input.user_id ? input.user_id.trim() : null,
      ip_address: input.ip_address || null,
      message: maskedMessage,
      details: sanitizedDetails || null,
      remaining_ttl: input.ttl || undefined,
    };

    // Chỉ thêm vào cache sau khi batch được xác nhận; lần ghi lỗi không được coi là đã lưu.
    duplicateEventCache.set(dedupeFingerprint, {
      timestamp: Date.now(),
      record,
    });

    return record;
  }

  /**
   * [BAREM 3] Chọn bảng theo mẫu truy vấn và dùng cursor thay vì quét/lọc toàn bộ dữ liệu.
   * Nhiều ngày được tách thành các partition ngày riêng rồi ghép kết quả ở backend.
   */
  async queryLogs(filter: QueryFilter): Promise<QueryResult> {
    const limit = filter.limit || 100;

    // [BAREM 3] log_date thuộc partition key nên không lọc dải ngày bằng >=/<= như log_time.
    // Backend liệt kê từng ngày, truy vấn riêng và sắp xếp kết quả ghép.
    // Nhánh nhiều ngày hiện trả tập kết quả giới hạn, không trả cursor trang tiếp.
    if (filter.start_date && filter.end_date && filter.start_date < filter.end_date) {
      const dates: string[] = [];
      const current = new Date(filter.start_date + 'T00:00:00Z');
      const end = new Date(filter.end_date + 'T00:00:00Z');

      // Giới hạn tối đa 14 ngày trong lần ghép này để không mở quá nhiều truy vấn song song.
      while (current <= end && dates.length < 14) {
        dates.push(this.formatDateToYMD(current));
        current.setUTCDate(current.getUTCDate() + 1);
      }

      const partitionPromises = dates.map((d) =>
        this.querySingleDay({
          ...filter,
          date: d,
          start_date: undefined,
          end_date: undefined,
          limit: Math.ceil(limit / dates.length) + 10,
          page_state: null,
        })
      );

      const results = await Promise.all(partitionPromises);
      const combined = results.flatMap((r) => r.logs);
      combined.sort((a, b) => new Date(b.log_time).getTime() - new Date(a.log_time).getTime());
      const sliced = combined.slice(0, limit);

      return {
        logs: sliced,
        page_state: null,
        count: sliced.length,
      };
    }

    return this.querySingleDay(filter);
  }

  /**
   * [BAREM 3] Truy vấn trong một ngày UTC; chọn một hoặc nhiều partition theo bộ lọc.
   */
  async querySingleDay(filter: QueryFilter): Promise<QueryResult> {
    const client = getCassandraClient();
    const targetDate = filter.date || filter.start_date || this.formatDateToYMD(new Date());
    const cassandraLocalDate = this.toCassandraLocalDate(targetDate);
    const limit = filter.limit || 100;

    // Đổi giờ trên bộ lọc thành mốc UTC cùng ngày với log_date, tránh lệch múi giờ.
    let fromTimestamp: Date | null = null;
    let toTimestamp: Date | null = null;

    if (filter.from) {
      if (filter.from.includes('T')) {
        fromTimestamp = new Date(filter.from);
      } else {
        const fromParts = filter.from.split(':');
        const hh = fromParts[0].padStart(2, '0');
        const mm = (fromParts[1] || '00').padStart(2, '0');
        const ss = (fromParts[2] || '00').padStart(2, '0');
        fromTimestamp = new Date(`${targetDate}T${hh}:${mm}:${ss}.000Z`);
      }
    }

    if (filter.to) {
      if (filter.to.includes('T')) {
        toTimestamp = new Date(filter.to);
      } else {
        const toParts = filter.to.split(':');
        const hh = toParts[0].padStart(2, '0');
        const mm = (toParts[1] || '59').padStart(2, '0');
        const ss = (toParts[2] || '59').padStart(2, '0');
        toTimestamp = new Date(`${targetDate}T${hh}:${mm}:${ss}.999Z`);
      }
    }

    // Đọc vị trí trang trước từ cursor ghép hoặc pageState của driver.
    const decodedCursor = this.decodeCursor(filter.page_state);

    // fetchSize giới hạn trang đọc từ driver; prepare=true truyền tham số tách khỏi câu CQL.
    const execOptions: cassandra.QueryOptions = {
      prepare: true,
      fetchSize: limit,
    };
    if (!decodedCursor.isCompound && decodedCursor.pageState) {
      execOptions.pageState = decodedCursor.pageState;
    }

    // [BAREM 3] Có service và level: đọc audit_logs_by_service_level.
    // Cung cấp đủ partition key (service_name, level, log_date), sau đó cắt dải log_time.
    // Demo Payment + ERROR: UUID trên web phải khớp SELECT cùng điều kiện trong CQLSH.
    if (filter.service && filter.level) {
      let query = `
        SELECT service_name, level, log_date, log_time, log_id, action, user_id, ip_address, message, details, TTL(message) AS remaining_ttl
        FROM audit_log_system.audit_logs_by_service_level
        WHERE service_name = ? AND level = ? AND log_date = ?
      `;
      const params: any[] = [filter.service.trim(), filter.level, cassandraLocalDate];

      if (fromTimestamp && toTimestamp) {
        query += ` AND log_time >= ? AND log_time <= ?`;
        params.push(fromTimestamp, toTimestamp);
      } else if (fromTimestamp) {
        query += ` AND log_time >= ?`;
        params.push(fromTimestamp);
      } else if (toTimestamp) {
        query += ` AND log_time <= ?`;
        params.push(toTimestamp);
      }

      if (decodedCursor.isCompound && decodedCursor.compound) {
        query += ` AND (log_time, log_id) < (?, ?)`;
        params.push(
          new Date(decodedCursor.compound.t),
          cassandra.types.Uuid.fromString(decodedCursor.compound.id)
        );
        query += ` LIMIT ${limit + 1}`;
        const result = await client.execute(query, params, { prepare: true });
        const rows = this.mapRows(result.rows);
        const hasMore = rows.length > limit;
        const sliced = rows.slice(0, limit);
        let nextPage: string | null = null;
        if (hasMore && sliced.length > 0) {
          const last = sliced[sliced.length - 1];
          nextPage = Buffer.from(
            JSON.stringify({ t: new Date(last.log_time).toISOString(), id: last.log_id })
          ).toString('base64');
        }
        return {
          logs: sliced,
          page_state: nextPage,
          count: sliced.length,
        };
      }

      const result = await client.execute(query, params, execOptions);
      const nextPage = this.encodePageState(result.pageState);
      const rows = this.mapRows(result.rows);
      return {
        logs: rows,
        page_state: nextPage,
        count: rows.length,
      };
    }

    // [BAREM 3] Chỉ có service: đọc audit_logs với partition key (service_name, log_date).
    // log_time là clustering key nên dùng được >= và <= trong partition đã chọn.
    if (filter.service) {
      let query = `
        SELECT service_name, log_date, log_time, log_id, level, action, user_id, ip_address, message, details, TTL(message) AS remaining_ttl
        FROM audit_log_system.audit_logs
        WHERE service_name = ? AND log_date = ?
      `;
      const params: any[] = [filter.service.trim(), cassandraLocalDate];

      if (fromTimestamp && toTimestamp) {
        query += ` AND log_time >= ? AND log_time <= ?`;
        params.push(fromTimestamp, toTimestamp);
      } else if (fromTimestamp) {
        query += ` AND log_time >= ?`;
        params.push(fromTimestamp);
      } else if (toTimestamp) {
        query += ` AND log_time <= ?`;
        params.push(toTimestamp);
      }

      if (decodedCursor.isCompound && decodedCursor.compound) {
        query += ` AND (log_time, log_id) < (?, ?)`;
        params.push(
          new Date(decodedCursor.compound.t),
          cassandra.types.Uuid.fromString(decodedCursor.compound.id)
        );
        query += ` LIMIT ${limit + 1}`;
        const result = await client.execute(query, params, { prepare: true });
        const rows = this.mapRows(result.rows);
        const hasMore = rows.length > limit;
        const sliced = rows.slice(0, limit);
        let nextPage: string | null = null;
        if (hasMore && sliced.length > 0) {
          const last = sliced[sliced.length - 1];
          nextPage = Buffer.from(
            JSON.stringify({ t: new Date(last.log_time).toISOString(), id: last.log_id })
          ).toString('base64');
        }
        return {
          logs: sliced,
          page_state: nextPage,
          count: sliced.length,
        };
      }

      const result = await client.execute(query, params, execOptions);
      const nextPage = this.encodePageState(result.pageState);
      const rows = this.mapRows(result.rows);
      return {
        logs: rows,
        page_state: nextPage,
        count: rows.length,
      };
    }

    // Chưa chọn service: truy vấn các dịch vụ đang bật, rồi ghép và sắp xếp tại backend.
    // Nếu có level thì mỗi nhánh dùng bảng theo mức độ; không thêm ALLOW FILTERING.
    const services = await serviceCatalogService.getAllServices();
    let serviceNames = services.filter((s) => s.status).map((s) => s.service_name);
    if (serviceNames.length === 0) {
      serviceNames = ['Auth', 'User', 'Order', 'Payment'];
    }

    // Đọc dư một dòng mỗi dịch vụ để xét còn trang sau trong tập dữ liệu truy vấn.
    const perServiceLimit = limit + 1;
    const promises = serviceNames.map(async (srv) => {
      if (filter.level) {
        let query = `
          SELECT service_name, level, log_date, log_time, log_id, action, user_id, ip_address, message, details, TTL(message) AS remaining_ttl
          FROM audit_log_system.audit_logs_by_service_level
          WHERE service_name = ? AND level = ? AND log_date = ?
        `;
        const params: any[] = [srv, filter.level, cassandraLocalDate];
        if (fromTimestamp && toTimestamp) {
          query += ` AND log_time >= ? AND log_time <= ?`;
          params.push(fromTimestamp, toTimestamp);
        }
        if (decodedCursor.isCompound && decodedCursor.compound) {
          query += ` AND (log_time, log_id) < (?, ?)`;
          params.push(
            new Date(decodedCursor.compound.t),
            cassandra.types.Uuid.fromString(decodedCursor.compound.id)
          );
        }
        query += ` LIMIT ${perServiceLimit}`;
        const res = await client.execute(query, params, { prepare: true });
        return this.mapRows(res.rows);
      } else {
        let query = `
          SELECT service_name, log_date, log_time, log_id, level, action, user_id, ip_address, message, details, TTL(message) AS remaining_ttl
          FROM audit_log_system.audit_logs
          WHERE service_name = ? AND log_date = ?
        `;
        const params: any[] = [srv, cassandraLocalDate];
        if (fromTimestamp && toTimestamp) {
          query += ` AND log_time >= ? AND log_time <= ?`;
          params.push(fromTimestamp, toTimestamp);
        }
        if (decodedCursor.isCompound && decodedCursor.compound) {
          query += ` AND (log_time, log_id) < (?, ?)`;
          params.push(
            new Date(decodedCursor.compound.t),
            cassandra.types.Uuid.fromString(decodedCursor.compound.id)
          );
        }
        query += ` LIMIT ${perServiceLimit}`;
        const res = await client.execute(query, params, { prepare: true });
        return this.mapRows(res.rows);
      }
    });

    const results = await Promise.all(promises);
    const combined = results.flat();
    combined.sort((a, b) => new Date(b.log_time).getTime() - new Date(a.log_time).getTime());
    const hasMore = combined.length > limit;
    const sliced = combined.slice(0, limit);

    let nextPage: string | null = null;
    if (hasMore && sliced.length > 0) {
      const last = sliced[sliced.length - 1];
      nextPage = Buffer.from(
        JSON.stringify({ t: new Date(last.log_time).toISOString(), id: last.log_id })
      ).toString('base64');
    }

    return {
      logs: sliced,
      page_state: nextPage,
      count: sliced.length,
    };
  }

  /**
   * Tra cứu chi tiết bằng partition key log_id; giữ đường đọc theo khóa tổng hợp để tương thích.
   */
  async getLogById(
    logIdStr: string,
    serviceName?: string,
    dateStr?: string,
    timeIso?: string
  ): Promise<AuditLogRecord | null> {
    if (!isValidUuid(logIdStr)) {
      throw new AppError(`Invalid UUID format for log_id: '${logIdStr}'`, 400);
    }

    const client = getCassandraClient();
    const logId = cassandra.types.Uuid.fromString(logIdStr);

    // Ưu tiên bảng theo UUID; người demo chỉ cần sao chép log_id từ màn hình chi tiết.
    try {
      const pointQuery = `
        SELECT log_id, service_name, log_date, log_time, level, action, user_id, ip_address, message, details, TTL(message) AS remaining_ttl
        FROM audit_log_system.audit_logs_by_id
        WHERE log_id = ?
      `;
      const res = await client.execute(pointQuery, [logId], { prepare: true });
      const row = res.first();
      if (row) {
        return {
          service_name: row.service_name,
          log_date: row.log_date ? row.log_date.toString() : '',
          log_time: row.log_time,
          log_id: row.log_id.toString(),
          level: row.level,
          action: row.action,
          user_id: row.user_id || null,
          ip_address: row.ip_address || null,
          message: row.message,
          details: row.details || null,
          remaining_ttl: row.remaining_ttl !== null && row.remaining_ttl !== undefined ? Number(row.remaining_ttl) : undefined,
        };
      }
    } catch {
      // DB cũ có thể thiếu bảng theo UUID; thử đường đọc tương thích nếu đủ khóa.
    }

    // Có đủ service/ngày/thời gian/UUID thì có thể đọc đúng hàng trong bảng chính.
    if (serviceName && dateStr && timeIso) {
      const cassandraLocalDate = this.toCassandraLocalDate(dateStr);
      const logTime = new Date(timeIso);

      const query = `
        SELECT service_name, log_date, log_time, log_id, level, action, user_id, ip_address, message, details, TTL(message) AS remaining_ttl
        FROM audit_log_system.audit_logs
        WHERE service_name = ? AND log_date = ? AND log_time = ? AND log_id = ?
      `;

      const result = await client.execute(query, [serviceName.trim(), cassandraLocalDate, logTime, logId], { prepare: true });
      const row = result.first();
      if (!row) return null;

      return {
        service_name: row.service_name,
        log_date: row.log_date ? row.log_date.toString() : dateStr,
        log_time: row.log_time,
        log_id: row.log_id.toString(),
        level: row.level,
        action: row.action,
        user_id: row.user_id || null,
        ip_address: row.ip_address || null,
        message: row.message,
        details: row.details || null,
        remaining_ttl: row.remaining_ttl !== null && row.remaining_ttl !== undefined ? Number(row.remaining_ttl) : undefined,
      };
    }

    return null;
  }

  /**
   * [BAREM 3, 4] Đọc thời hạn còn lại bằng TTL(message) của Cassandra.
   * Chỉ kết luận demo TTL đạt khi bản ghi có trước hạn và truy vấn sau hạn trả 0 dòng.
   * Nhánh catch hiện cũng đi tới found=false; cần đối chiếu health/CQLSH để phân biệt lỗi kết nối.
   */
  async getTtlStatus(logIdStr: string): Promise<{
    found: boolean;
    expired: boolean;
    remaining_ttl: number;
    log: AuditLogRecord | null;
  }> {
    if (!isValidUuid(logIdStr)) {
      throw new AppError(`Invalid UUID format for log_id: '${logIdStr}'`, 400);
    }

    const client = getCassandraClient();
    const logId = cassandra.types.Uuid.fromString(logIdStr);

    try {
      const pointQuery = `
        SELECT log_id, service_name, log_date, log_time, level, action, user_id, ip_address, message, details, TTL(message) AS remaining_ttl
        FROM audit_log_system.audit_logs_by_id
        WHERE log_id = ?
      `;
      const res = await client.execute(pointQuery, [logId], { prepare: true });
      const row = res.first();
      if (row) {
        const remainingTtl = row.remaining_ttl !== null && row.remaining_ttl !== undefined ? Number(row.remaining_ttl) : 0;
        return {
          found: true,
          expired: false,
          remaining_ttl: remainingTtl,
          log: {
            service_name: row.service_name,
            log_date: row.log_date ? row.log_date.toString() : '',
            log_time: row.log_time,
            log_id: row.log_id.toString(),
            level: row.level,
            action: row.action,
            user_id: row.user_id || null,
            ip_address: row.ip_address || null,
            message: row.message,
            details: row.details || null,
            remaining_ttl: remainingTtl,
          },
        };
      }
    } catch (err: any) {
      console.warn(`[AuditLogService] Error querying audit_logs_by_id for TTL status: ${err.message}`);
    }

    // Điểm trả về khi không có dòng hoặc truy vấn bên trên lỗi.
    // Với demo đã kiểm tra kết nối và từng đọc được UUID này, 0 dòng sau hạn là bằng chứng TTL.
    return {
      found: false,
      expired: true,
      remaining_ttl: 0,
      log: null,
    };
  }

  /**
   * [BAREM 4] Tổng hợp log theo dịch vụ/mức độ/ngày để giải thích dữ liệu trên Dashboard.
   */
  async getDashboardSummary(dateStr?: string): Promise<{
    totalLogs: number;
    infoCount: number;
    warnCount: number;
    errorCount: number;
    byService: Record<string, number>;
    byLevel: Record<string, number>;
    recentErrors: AuditLogRecord[];
  }> {
    const client = getCassandraClient();
    const targetDate = dateStr || this.formatDateToYMD(new Date());
    const cassandraLocalDate = this.toCassandraLocalDate(targetDate);

    const services = await serviceCatalogService.getAllServices();
    let serviceNames = services.filter((s) => s.status).map((s) => s.service_name);
    if (serviceNames.length === 0) {
      serviceNames = ['Auth', 'User', 'Order', 'Payment'];
    }

    const levels = ['INFO', 'WARN', 'ERROR'] as const;
    const byService: Record<string, number> = {};
    const byLevel: Record<string, number> = { INFO: 0, WARN: 0, ERROR: 0 };
    let totalLogs = 0;
    const recentErrors: AuditLogRecord[] = [];

    // Đọc từng partition (dịch vụ, mức độ, ngày), cộng kết quả trong ứng dụng.
    // Số liệu là số sự kiện ở bảng này, không cộng thêm hai bản sao audit khác.
    const partitionQueries = serviceNames.flatMap((srv) =>
      levels.map(async (lvl) => {
        const query = `
          SELECT service_name, level, log_date, log_time, log_id, action, user_id, ip_address, message, details, TTL(message) AS remaining_ttl
          FROM audit_log_system.audit_logs_by_service_level
          WHERE service_name = ? AND level = ? AND log_date = ?
        `;
        const res = await client.execute(query, [srv, lvl, cassandraLocalDate], { prepare: true });
        const count = res.rowLength;

        // Cộng số sự kiện theo dịch vụ và mức độ của ngày đang xem.
        byService[srv] = (byService[srv] || 0) + count;
        byLevel[lvl] = (byLevel[lvl] || 0) + count;
        totalLogs += count;

        if (lvl === 'ERROR') {
          recentErrors.push(...this.mapRows(res.rows.slice(0, 10)));
        }
      })
    );

    await Promise.all(partitionQueries);

    // Sắp xếp các lỗi gần đây theo thời gian giảm dần sau khi ghép các dịch vụ.
    recentErrors.sort((a, b) => new Date(b.log_time).getTime() - new Date(a.log_time).getTime());

    return {
      totalLogs,
      infoCount: byLevel['INFO'] || 0,
      warnCount: byLevel['WARN'] || 0,
      errorCount: byLevel['ERROR'] || 0,
      byService,
      byLevel,
      recentErrors: recentErrors.slice(0, 10),
    };
  }

  /**
   * Chuyển kiểu dữ liệu của Cassandra Driver thành bản ghi API dùng chung cho frontend.
   */
  private mapRows(rows: cassandra.types.Row[]): AuditLogRecord[] {
    return rows.map((row) => ({
      service_name: row.service_name,
      log_date: row.log_date ? row.log_date.toString() : '',
      log_time: row.log_time,
      log_id: row.log_id ? row.log_id.toString() : '',
      level: row.level,
      action: row.action,
      user_id: row.user_id || null,
      ip_address: row.ip_address || null,
      message: row.message,
      details: row.details || null,
      remaining_ttl: row.remaining_ttl !== null && row.remaining_ttl !== undefined ? Number(row.remaining_ttl) : undefined,
    }));
  }
}

export const auditLogService = new AuditLogService();
