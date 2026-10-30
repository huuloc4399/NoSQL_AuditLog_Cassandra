/**
 * [BAREM 3, 4] Màn hình tra cứu đang được App.tsx gắn với đường dẫn /logs.
 * Các ô dịch vụ/level/ngày/giờ được chuyển thành query của GET /api/logs.
 * Ngày và giờ trong demo dùng UTC. Lọc Payment + ERROR rồi đối chiếu UUID với database.
 * Trang và API tra cứu chỉ cho ADMIN truy cập; bộ lọc không thay thế kiểm tra quyền ở backend.
 */
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Filter, RotateCcw, Search } from 'lucide-react';
import { Header } from '../components/Header';
import { LogTable } from '../components/LogTable';
import { LogDetailModal } from '../components/LogDetailModal';
import { logsApi, servicesApi } from '../services/api';
import { AuditLog, LogFilterParams } from '../types';
import { auditDate as localDate } from '../utils/date';
import { useAuth } from '../context/AuthContext';

export const LogExplorerPage = () => {
  const [params, setParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const [service, setService] = useState(params.get('service') || '');
  const [date, setDate] = useState(params.get('date') || localDate());
  const [from, setFrom] = useState(params.get('from') || '');
  const [to, setTo] = useState(params.get('to') || '');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [services, setServices] = useState(['Auth', 'User', 'Order', 'Payment']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const request = useRef(0);
  const query = (): LogFilterParams => Object.fromEntries(params.entries());
  // Cursor là vị trí trang kế tiếp do API trả; request tăng dần giúp bỏ phản hồi đến muộn.
  const load = async (cursor: string | null = null, target = 0) => { const id = ++request.current; setBusy(true); setError(''); try { const res = await logsApi.getLogs({ date: localDate(), ...query(), limit: 15, cursor }); if (request.current !== id) return; setLogs(res.data); setNext(res.pagination?.nextCursor ?? res.page_state ?? null); setPage(target); if (target === 0) setCursors([null]); } catch { if (request.current === id) { setError('Không tải được nhật ký. Kiểm tra kết nối và thử lại.'); setLogs([]); setNext(null); } } finally { if (request.current === id) setBusy(false); } };
  useEffect(() => { if (isAdmin) servicesApi.getAll().then(res => setServices(res.data.map(s => s.service_name))).catch(() => {}); }, [isAdmin]);
  useEffect(() => { setService(params.get('service') || ''); setDate(params.get('date') || localDate()); setFrom(params.get('from') || ''); setTo(params.get('to') || ''); load(); }, [params]);
  // Lưu bộ lọc trên URL để tải lại/trình diễn lại cùng điều kiện; backend vẫn kiểm tra dữ liệu lần nữa.
  const applyFilters = (level = params.get('level') || '') => {
    if (!date) { setError('Vui lòng chọn ngày ghi nhận.'); return; }
    if (from && to && from > to) { setError('Thời gian bắt đầu phải nhỏ hơn hoặc bằng thời gian kết thúc.'); return; }
    const next = new URLSearchParams(Object.fromEntries(Object.entries({ service, level, date, from, to }).filter(([, value]) => value)));
    if (next.toString() === params.toString()) load(); else setParams(next);
  };
  const submit = (e: FormEvent) => { e.preventDefault(); applyFilters(); };
  // Chỉ xuất các dòng của trang đang hiển thị, không phải xuất toàn bộ Cassandra.
  const exportCsv = () => { const fields: (keyof AuditLog)[] = ['log_time', 'service_name', 'level', 'action', 'user_id', 'message']; const cell = (v: unknown) => { const text = String(v ?? ''); return `"${(/^[=+@\-\t\r\n]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`; }; const csv = '\uFEFF' + [fields.join(','), ...logs.map(log => fields.map(f => cell(log[f])).join(','))].join('\r\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); const a = document.createElement('a'); a.href = url; a.download = `audit-logs-${params.get('date') || localDate()}-trang-${page + 1}.csv`; a.click(); URL.revokeObjectURL(url); };
  return <><Header title="Nhật ký hoạt động" onRefresh={() => load(cursors[page], page)} isRefreshing={busy}/><div className="page-content"><div className="page-heading"><div><span className="eyebrow">TRA CỨU & TRUY VẾT</span><h1>Nhật ký hoạt động<span className="heading-dot">.</span></h1><p>Tìm hiểu ai đã làm gì, vào thời điểm nào trong hệ thống.</p></div><button className="button" onClick={exportCsv} disabled={busy || !logs.length}><Download size={16}/>Xuất trang CSV</button></div>
    <form className="panel filter-panel" onSubmit={submit}><div className="filter-title"><Filter size={16}/><strong>Bộ lọc nhật ký</strong><span>Thu hẹp kết quả theo nhu cầu</span></div><fieldset className="log-level-filter">
      <legend>Mức độ log</legend>
      <div className="log-level-options">
        {[{ value: '', label: 'Tất cả', description: '' }, { value: 'INFO', label: 'INFO', description: 'Thông tin' }, { value: 'WARN', label: 'WARN', description: 'Cảnh báo' }, { value: 'ERROR', label: 'ERROR', description: 'Lỗi' }].map(option => (
          <button key={option.value} type="button" className={`log-level-option ${option.value.toLowerCase() || 'all'}`} aria-pressed={(params.get('level') || '') === option.value} disabled={busy} onClick={() => applyFilters(option.value)}>
            {option.value && <span className="log-level-dot" aria-hidden="true"/>}
            <strong>{option.label}</strong>{option.description && <span>{option.description}</span>}
          </button>
        ))}
      </div>
      <p>Chọn mức độ để lọc ngay theo dịch vụ và thời gian bên dưới.</p>
    </fieldset><div className="filter-grid log-explorer-fields"><label>Dịch vụ<select value={service} onChange={e => setService(e.target.value)}><option value="">Tất cả dịch vụ</option>{services.map(s => <option key={s}>{s}</option>)}</select></label><label>Ngày ghi nhận<input type="date" required value={date} onChange={e => setDate(e.target.value)}/></label><label>Từ giờ<input type="time" value={from} onChange={e => setFrom(e.target.value)}/></label><label>Đến giờ<input type="time" value={to} onChange={e => setTo(e.target.value)}/></label></div><div className="filter-bottom"><span>Kết quả được sắp xếp từ mới nhất · UTC</span><button className="button" type="button" onClick={() => { setService(''); setDate(localDate()); setFrom(''); setTo(''); if (!params.toString()) load(); else setParams({}); }}><RotateCcw size={15}/>Đặt lại</button><button className="button primary" disabled={busy}><Search size={16}/>Tìm kiếm</button></div></form>
    {error && <div className="error-panel" role="alert">{error}</div>}<section className="panel"><div className="panel-heading"><div><h2>Kết quả tra cứu <span className="soft-tag">{busy ? '…' : `${logs.length} nhật ký`}</span></h2><p>{params.get('level') ? `Mức độ ${params.get('level')} · ` : ''}{params.get('service') || 'Tất cả dịch vụ'}</p></div><span className="soft-tag">15 dòng / trang</span></div><LogTable logs={logs} loading={busy} onSelect={setSelected}/><div className="pagination"><span>Trang {page + 1} · {logs.length} kết quả trên trang này</span><button className="button" disabled={busy || page === 0} onClick={() => load(cursors[page - 1], page - 1)}><ChevronLeft size={16}/>Trước</button><button className="button" disabled={busy || !next} onClick={() => { const c = next; setCursors(prev => [...prev.slice(0, page + 1), c]); load(c, page + 1); }}>Sau<ChevronRight size={16}/></button></div></section><footer className="page-footer"><span>Audit Log chỉ được tra cứu, không chỉnh sửa nội dung.</span></footer></div><LogDetailModal log={selected} isOpen={!!selected} onClose={() => setSelected(null)}/></>;
};
