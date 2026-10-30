import { useEffect, useRef, useState } from 'react';
import { Check, Copy, LoaderCircle, Minus, Play, Terminal, X } from 'lucide-react';
import { cqlApi, CqlConsoleResult } from '../services/api';
import { auditDate } from '../utils/date';
import './CqlConsole.css';

const templates = [
  { id: 'errors', label: 'Payment · ERROR hôm nay' },
  { id: 'orders', label: 'Thao tác giỏ hàng / đơn hàng' },
  { id: 'management', label: 'Nhật ký quản trị' },
  { id: 'services', label: 'Danh mục dịch vụ' },
  { id: 'users', label: 'Tài khoản & phân quyền' },
  { id: 'count', label: 'Đếm lỗi Payment' },
  { id: 'tables', label: 'Danh sách bảng' },
  { id: 'schema', label: 'Cấu trúc bảng audit_logs' },
  { id: 'ttl', label: 'Kiểm tra TTL theo UUID' },
];
function makeQuery(template: string, date: string, id: string): string {
  switch (template) {
    case 'orders': return `SELECT log_time, log_id, level, action, user_id, message\nFROM audit_logs\nWHERE service_name = 'Order'\n  AND log_date = '${date}'\nLIMIT 30;`;
    case 'management': return `SELECT log_time, log_id, action, user_id, message\nFROM audit_logs\nWHERE service_name = 'User'\n  AND log_date = '${date}'\nLIMIT 30;`;
    case 'services': return 'SELECT service_id, service_name, description, status\nFROM services;';
    case 'users': return 'SELECT username, full_name, role, status\nFROM users;';
    case 'count': return `SELECT COUNT(*) AS total_errors\nFROM audit_logs_by_service_level\nWHERE service_name = 'Payment'\n  AND level = 'ERROR'\n  AND log_date = '${date}';`;
    case 'tables': return 'DESCRIBE TABLES;';
    case 'schema': return 'DESCRIBE TABLE audit_logs;';
    case 'ttl': return `SELECT log_id, log_time, action, message,\n       TTL(message) AS remaining_seconds\nFROM audit_logs_by_id\nWHERE log_id = ${id.trim() || 'UUID_CUA_LOG'};`;
    default: return `SELECT log_time, log_id, level, action, user_id, message\nFROM audit_logs_by_service_level\nWHERE service_name = 'Payment'\n  AND level = 'ERROR'\n  AND log_date = '${date}'\nLIMIT 30;`;
  }
}

// [BAREM 1, 3, 4] Truy vấn đi qua API có RBAC; dữ liệu không được lưu vào localStorage.
export function CqlConsole() {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState('errors');
  const [date, setDate] = useState(auditDate);
  const [uuid, setUuid] = useState('');
  const [query, setQuery] = useState(() => makeQuery('errors', auditDate(), ''));
  const [lastQuery, setLastQuery] = useState('');
  const [result, setResult] = useState<CqlConsoleResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (open) editor.current?.focus();
  }, [open]);
  useEffect(() => () => { pending.current?.abort(); clearTimeout(copyTimer.current); }, []);
  const minimize = () => { setOpen(false); launcher.current?.focus(); };
  const choose = (id: string, selectedDate = date, selectedUuid = uuid) => {
    setTemplate(id); setQuery(makeQuery(id, selectedDate, selectedUuid)); setError(''); setCopied(false);
  };
  const run = async () => {
    if (pending.current || !query.trim()) return;
    if (/\bUUID_CUA_LOG\b/.test(query)) { setError('Nhập UUID của bản ghi TTL hoặc thay UUID_CUA_LOG trong câu lệnh.'); return; }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError(''); setResult(null); setLastQuery(query);
    try { const data = await cqlApi.execute(query, controller.signal); if (!controller.signal.aborted) setResult(data); }
    catch (e: any) {
      if (!controller.signal.aborted) setError(e.response?.data?.error || e.response?.data?.message || 'Không truy vấn được Cassandra. Kiểm tra kết nối rồi thử lại.');
    } finally {
      if (!controller.signal.aborted) { setBusy(false); pending.current = null; }
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(query); setCopied(true); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2000); }
    catch { setError('Trình duyệt chưa cho phép sao chép. Bạn có thể chọn câu lệnh và nhấn Ctrl + C.'); }
  };
  const dated = ['errors', 'orders', 'management', 'count'].includes(template);
  return <>
    {open && <section id="admin-cql-console" className="cql-console" role="dialog" aria-labelledby="cql-console-title" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); minimize(); }
    }}>
      <header className="cql-console-header">
        <div><span className="cql-console-icon"><Terminal size={20}/></span><div><h2 id="cql-console-title">CQL Console</h2><p>Cassandra thật <span>·</span> Chỉ đọc <span>·</span> UTC</p></div></div>
        <button className="icon-button" aria-label="Thu gọn CQL" title="Thu gọn (Esc)" onClick={minimize}><Minus size={20}/></button>
      </header>
      <div className="cql-console-body">
        <div className="cql-console-presets">
          <label>Truy vấn mẫu<select value={template} onChange={event => choose(event.target.value)}>{templates.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          {dated && <label>Ngày UTC<input type="date" required value={date} onChange={event => { if (event.target.value) { setDate(event.target.value); choose(template, event.target.value); } }}/></label>}
          {template === 'ttl' && <label className="cql-console-uuid">UUID bản ghi TTL<input value={uuid} placeholder="Dán UUID từ trang Demo TTL" onChange={event => { setUuid(event.target.value); choose(template, date, event.target.value); }}/></label>}
        </div>
        <label className="cql-editor-label" htmlFor="cql-query">Câu lệnh CQL <span>SELECT · DESCRIBE · USE</span></label>
        <div className="cql-editor">
          <span className="cql-editor-prompt" aria-hidden="true">cql&gt;</span>
          <textarea id="cql-query" ref={editor} value={query} spellCheck={false} maxLength={8000} onChange={event => { setQuery(event.target.value); setCopied(false); }} onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void run(); }
          }}/>
        </div>
        <div className="cql-console-actions">
          <span>Ctrl + Enter để chạy · Tối đa 100 dòng</span>
          <button className="button" onClick={() => void copy()} aria-label="Sao chép CQL" title="Sao chép câu lệnh">{copied ? <Check size={15}/> : <Copy size={15}/>}</button>
          <button className="button primary" onClick={() => void run()} disabled={busy || !query.trim()}>{busy ? <LoaderCircle size={15} className="animate-spin"/> : <Play size={15}/>}<span>{busy ? 'Đang chạy…' : 'Chạy CQL'}</span></button>
        </div>
        <div className="cql-console-output" aria-busy={busy}>
          <div className="cql-output-heading"><strong>Kết quả truy vấn</strong><span role="status">{busy ? 'Đang truy vấn Cassandra…' : result ? `${result.text ? 'Hoàn tất' : `${result.rows.length} dòng`} · ${result.elapsedMs} ms` : 'Sẵn sàng'}</span></div>
          {error && <div className="cql-console-error" role="alert"><X size={16}/><span>{error}</span></div>}
          {!busy && result && <>
            {lastQuery !== query && <p className="cql-output-note">Kết quả của câu lệnh đã chạy trước khi bạn chỉnh sửa.</p>}
            {result.text ? <pre className="cql-schema-output">{result.text}</pre> : <div className="cql-result-scroll"><table className="cql-result-table"><thead><tr>{result.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{result.rows.map((row, i) => <tr key={i}>{result.columns.map(column => <td key={column}>{row[column] == null ? <span className="cql-null">null</span> : String(row[column])}</td>)}</tr>)}</tbody></table>{!result.rows.length && <p className="cql-empty-result">(0 rows) · Không có bản ghi phù hợp.</p>}</div>}
            {result.truncated && <p className="cql-output-note">Kết quả đã được giới hạn. Thêm điều kiện WHERE hoặc LIMIT để thu hẹp truy vấn.</p>}
          </>}
          {!result && !error && !busy && <p className="cql-console-empty">Chọn truy vấn mẫu hoặc nhập CQL, sau đó nhấn Chạy CQL.<br/>Dữ liệu được đọc trực tiếp từ 5 bảng của dự án.</p>}
        </div>
      </div>
    </section>}
    <button ref={launcher} className={`cql-console-launcher ${open ? 'is-open' : ''}`} aria-expanded={open} aria-controls="admin-cql-console" onClick={() => open ? minimize() : setOpen(true)}><Terminal size={19}/><span>{open ? 'Thu gọn CQL' : 'Mở CQL'}</span>{busy && <LoaderCircle size={15} className="animate-spin"/>}</button>
  </>;
}
