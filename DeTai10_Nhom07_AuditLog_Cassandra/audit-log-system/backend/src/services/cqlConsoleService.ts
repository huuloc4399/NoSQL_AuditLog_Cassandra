import cassandra from 'cassandra-driver';
import { getCassandraClient } from '../config/cassandra.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

// [BAREM 1, 3, 4] Console chỉ đọc trên Cassandra thật, không thực thi lệnh hệ điều hành.
// Liệt kê rõ bảng/cột được đọc; SELECT * users cũng không được trả password_hash.
const logColumns = ['log_id', 'service_name', 'log_date', 'log_time', 'level', 'action', 'user_id', 'ip_address', 'message', 'details'];
const tables: Record<string, string[]> = {
  audit_logs: logColumns,
  audit_logs_by_service_level: logColumns,
  audit_logs_by_id: logColumns,
  services: ['service_id', 'service_name', 'description', 'status', 'created_at', 'updated_at'],
  users: ['user_id', 'username', 'full_name', 'email', 'role', 'status', 'created_at', 'updated_at'],
};
const MAX_ROWS = 100;
type Cell = string | number | boolean | null;
export interface CqlConsoleResult {
  columns: string[];
  rows: Record<string, Cell>[];
  text?: string;
  elapsedMs: number;
  truncated: boolean;
}

// Bỏ comment và nhận diện dấu ; ngoài chuỗi. Không tách bằng split(';') vì message
// có thể chứa dấu ; hoặc từ khóa như DELETE mà vẫn là dữ liệu văn bản hợp lệ.
function singleStatement(input: string): string {
  if (typeof input !== 'string' || !input.trim() || input.length > 8000) {
    throw new AppError('Nhập một câu CQL, tối đa 8.000 ký tự.', 400);
  }
  let output = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i], next = input[i + 1];
    if (ch === "'") {
      output += ch;
      if (quoted && next === "'") { output += next; i++; }
      else quoted = !quoted;
    } else if (!quoted && ((ch === '-' && next === '-') || (ch === '/' && next === '/'))) {
      while (i < input.length && input[i] !== '\n') i++;
      output += ' ';
    } else if (!quoted && ch === '/' && next === '*') {
      const end = input.indexOf('*/', i + 2);
      if (end < 0) throw new AppError('Comment CQL chưa đóng.', 400);
      i = end + 1; output += ' ';
    } else output += ch;
  }
  if (quoted) throw new AppError('Chuỗi CQL chưa đóng dấu nháy đơn.', 400);
  const unquoted = output.replace(/'(?:''|[^'])*'/g, "''").trim();
  if (/;[\s\S]*\S/.test(unquoted) || (unquoted.match(/;/g)?.length || 0) > 1) {
    throw new AppError('Mỗi lần chỉ chạy một câu CQL.', 400);
  }
  return output.trim().replace(/;\s*$/, '').trim();
}

function tableName(reference: string): string {
  const parts = reference.toLowerCase().split('.');
  if (parts.length > 2 || (parts.length === 2 && parts[0] !== env.CASSANDRA_KEYSPACE.toLowerCase())) {
    throw new AppError('Chỉ truy vấn keyspace của dự án.', 400);
  }
  const name = parts[parts.length - 1];
  if (!Object.hasOwn(tables, name)) throw new AppError('Chỉ truy vấn 5 bảng của dự án: ' + Object.keys(tables).join(', ') + '.', 400);
  return name;
}

export type ConsoleCommand = { kind: 'select'; query: string } | { kind: 'tables' } | { kind: 'describe'; table: string } | { kind: 'use' };
export function parseConsoleQuery(input: string): ConsoleCommand {
  const query = singleStatement(input);
  if (/^(?:DESCRIBE|DESC)\s+TABLES$/i.test(query)) return { kind: 'tables' };
  const describe = /^(?:DESCRIBE|DESC)\s+TABLE\s+([a-z_][a-z0-9_.]*)$/i.exec(query);
  if (describe) return { kind: 'describe', table: tableName(describe[1]) };
  const use = /^USE\s+([a-z_][a-z0-9_]*)$/i.exec(query);
  if (use) {
    if (use[1].toLowerCase() !== env.CASSANDRA_KEYSPACE.toLowerCase()) throw new AppError('Chỉ sử dụng keyspace của dự án.', 400);
    return { kind: 'use' }; // Không gửi USE xuống pool dùng chung của backend.
  }
  const select = /^SELECT\s+([\s\S]+?)\s+FROM\s+([a-z_][a-z0-9_.]*)(?=\s|$)([\s\S]*)$/i.exec(query);
  if (!select) throw new AppError('Console hỗ trợ SELECT, DESCRIBE TABLES, DESCRIBE TABLE và USE keyspace của dự án.', 400);
  const table = tableName(select[2]);
  const allowed = tables[table];
  let projection = select[1].trim();
  const outsideStrings = query.replace(/'(?:''|[^'])*'/g, "''");
  if (/\bpassword_hash\b/i.test(outsideStrings) || /"/.test(outsideStrings)) {
    throw new AppError('Dùng tên cột thông thường; không truy vấn cột mật khẩu.', 400);
  }
  if (projection === '*') projection = allowed.join(', ');
  else {
    for (const expression of projection.split(',')) {
      const match = /^\s*(?:([a-z_][a-z0-9_]*)|COUNT\(\s*(\*|1)\s*\)|(TTL|WRITETIME)\(\s*([a-z_][a-z0-9_]*)\s*\))(?:\s+AS\s+[a-z_][a-z0-9_]*)?\s*$/i.exec(expression);
      const column = match?.[1] || match?.[4];
      if (!match || (column && !allowed.includes(column.toLowerCase()))) {
        throw new AppError('Chọn cột của bảng, COUNT(*), TTL(cột) hoặc WRITETIME(cột); có thể đặt bí danh AS.', 400);
      }
    }
  }
  // SELECT luôn bắt đầu câu lệnh, chỉ một statement và FROM bảng đã cho phép.
  // Cassandra kiểm tra tiếp cú pháp WHERE, kiểu dữ liệu và khóa phân vùng.
  return { kind: 'select', query: `SELECT ${projection} FROM ${env.CASSANDRA_KEYSPACE}.${table}${select[3]}` };
}

function cell(value: unknown): Cell {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const text = typeof value === 'string' ? value : String(value);
  return text.length > 4000 ? text.slice(0, 4000) + '… [đã rút gọn]' : text;
}

export const cqlConsoleService = {
  async execute(input: string): Promise<CqlConsoleResult> {
    const command = parseConsoleQuery(input);
    const started = Date.now();
    const finish = (data: Omit<CqlConsoleResult, 'elapsedMs'>): CqlConsoleResult => ({ ...data, elapsedMs: Date.now() - started });
    if (command.kind === 'use') return finish({ columns: [], rows: [], text: `Đang sử dụng keyspace ${env.CASSANDRA_KEYSPACE}.`, truncated: false });
    const client = getCassandraClient();
    try {
      if (command.kind === 'tables') {
        const result = await client.execute('SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?', [env.CASSANDRA_KEYSPACE], { prepare: true, readTimeout: 5000 });
        return finish({ columns: ['table_name'], rows: result.rows.filter(row => Object.hasOwn(tables, row.table_name)).map(row => ({ table_name: row.table_name })).sort((a, b) => a.table_name.localeCompare(b.table_name)), truncated: false });
      }
      if (command.kind === 'describe') {
        const result = await client.execute('SELECT column_name, type, kind, position, clustering_order FROM system_schema.columns WHERE keyspace_name = ? AND table_name = ?', [env.CASSANDRA_KEYSPACE, command.table], { prepare: true, readTimeout: 5000 });
        if (!result.rows.length) throw new AppError('Bảng chưa tồn tại trong Cassandra.', 404);
        const partition = result.rows.filter(row => row.kind === 'partition_key').sort((a, b) => a.position - b.position);
        const clustering = result.rows.filter(row => row.kind === 'clustering').sort((a, b) => a.position - b.position);
        const regular = result.rows.filter(row => !['partition_key', 'clustering'].includes(row.kind)).sort((a, b) => a.column_name.localeCompare(b.column_name));
        const ordered = [...partition, ...clustering, ...regular];
        const pk = partition.length === 1 ? partition[0].column_name : `(${partition.map(row => row.column_name).join(', ')})`;
        const key = [pk, ...clustering.map(row => row.column_name)].join(', ');
        const order = clustering.length ? `\nWITH CLUSTERING ORDER BY (${clustering.map(row => `${row.column_name} ${row.clustering_order.toUpperCase()}`).join(', ')})` : '';
        const text = `CREATE TABLE ${env.CASSANDRA_KEYSPACE}.${command.table} (\n${ordered.map(row => `  ${row.column_name} ${row.type}`).join(',\n')},\n  PRIMARY KEY (${key})\n)${order};`;
        return finish({ columns: [], rows: [], text, truncated: false });
      }
      // Chỉ lấy trang đầu, không tự phân trang toàn DB; timeout độc lập với các API nghiệp vụ.
      const result = await client.execute(command.query, [], { prepare: false, fetchSize: MAX_ROWS, readTimeout: 5000, isIdempotent: true });
      const columns = (result.columns || []).map(column => column.name);
      let size = 0, clipped = false;
      const rows: Record<string, Cell>[] = [];
      for (const source of result.rows.slice(0, MAX_ROWS)) {
        const row = Object.fromEntries(columns.map(column => [column, cell(source[column])]));
        size += JSON.stringify(row).length;
        if (size > 300000) { clipped = true; break; }
        rows.push(row);
      }
      return finish({ columns, rows, truncated: clipped || Boolean(result.pageState) || result.rows.length > MAX_ROWS });
    } catch (error) {
      if (error instanceof cassandra.errors.ResponseError && [0x2000, 0x2200, 0x2300].includes(error.code)) {
        throw new AppError('CQL không hợp lệ: ' + error.message.slice(0, 500), 400);
      }
      throw error;
    }
  },
};
