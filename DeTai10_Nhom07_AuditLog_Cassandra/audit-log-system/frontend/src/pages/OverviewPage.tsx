/**
 * [BAREM 4] Dashboard Admin tổng hợp dữ liệu ngày đang chọn từ API thật ở chế độ thường.
 * getStats lấy số sự kiện; getLogs lấy dữ liệu hiển thị, không cộng ba bảng audit vào tổng.
 * Đối chiếu dữ liệu thống kê với các partition dịch vụ/level/ngày trong CQLSH.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, CircleAlert, FileText, RefreshCw, TriangleAlert } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Header } from '../components/Header';
import { LogTable } from '../components/LogTable';
import { LogDetailModal } from '../components/LogDetailModal';
import { logsApi } from '../services/api';
import { AuditLog, DashboardStats } from '../types';
import { useAuth } from '../context/AuthContext';
import { auditDate } from '../utils/date';

export const OverviewPage = () => {
  const { user, isAdmin } = useAuth();
  const [date, setDate] = useState(auditDate);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [updated, setUpdated] = useState('');
  const load = async () => { setBusy(true); setError(''); try { const [summary, events] = await Promise.all([logsApi.getStats(date), logsApi.getLogs({ date, limit: 500 })]); setStats(summary.data); setLogs(events.data); setUpdated(new Date().toLocaleTimeString('vi-VN')); } catch { setError('Không tải được dữ liệu. Kiểm tra kết nối Backend và Cassandra rồi thử lại.'); } finally { setBusy(false); } };
  useEffect(() => { load(); }, [date]);
  const trend = Array.from({ length: 12 }, (_, i) => ({ hour: `${String(i * 2).padStart(2, '0')}:00`, INFO: 0, WARN: 0, ERROR: 0 }));
  logs.forEach(log => { const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(log.log_time))) % 24; trend[Math.floor(hour / 2)][log.level]++; });
  const metrics = [
    { label: 'Tổng nhật ký', value: stats?.totalLogs, Icon: FileText, tone: 'neutral', hint: 'Sự kiện trong ngày', level: '' },
    { label: 'Thông tin', value: stats?.infoCount, Icon: CheckCircle2, tone: 'green', hint: 'Hoạt động được ghi nhận', level: 'INFO' },
    { label: 'Cảnh báo', value: stats?.warnCount, Icon: TriangleAlert, tone: 'amber', hint: 'Sự kiện cần theo dõi', level: 'WARN' },
    { label: 'Lỗi hệ thống', value: stats?.errorCount, Icon: CircleAlert, tone: 'red', hint: 'Sự kiện cần kiểm tra', level: 'ERROR' }
  ];
  const total = stats?.totalLogs || 0;
  return <><Header title="Tổng quan"/><div className="page-content"><div className="page-heading"><div><span className="eyebrow">KHÔNG GIAN GIÁM SÁT</span><h1>Tổng quan hệ thống<span className="heading-dot">.</span></h1><p>Xin chào {user?.full_name || user?.username}, đây là hoạt động của hệ thống hôm nay.</p></div><div className="heading-actions"><label className="date-picker"><CalendarDays size={16}/><input aria-label="Ngày thống kê" type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}/></label><button className="button" onClick={load} disabled={busy}><RefreshCw size={15} className={busy ? 'animate-spin' : ''}/>Làm mới</button></div></div>
    {error && <div className="error-panel" role="alert">{error}<button onClick={load}>Thử lại</button></div>}
    <div className="stats-grid">{metrics.map(({ label, value, Icon, tone, hint, level }) => <Link key={label} to={`/logs?date=${date}${level ? `&level=${level}` : ''}`} className={`stat-card ${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={18}/></span></div><div className="stat-number">{busy ? '…' : value?.toLocaleString('vi-VN') ?? '—'}<span>{level || 'LOGS'}</span></div><div className="stat-bottom"><span><i/>{hint}</span><ArrowUpRight size={16}/></div></Link>)}</div>
    <div className="charts-grid"><section className="panel trend-panel"><div className="panel-heading"><div><h2>Lưu lượng nhật ký</h2><p>Phân bố sự kiện trong ngày theo mức độ</p></div><span className="soft-tag">Mỗi 2 giờ</span></div><div className="chart-legend"><span><i style={{ background: '#159c79' }}/>INFO</span><span><i style={{ background: '#edaf46' }}/>WARN</span><span><i style={{ background: '#e37474' }}/>ERROR</span></div><div className="trend-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 10, right: 8, bottom: 0, left: -23 }}><defs><linearGradient id="info-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#159c79" stopOpacity={.2}/><stop offset="100%" stopColor="#159c79" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--border)"/><XAxis dataKey="hour" tickLine={false} axisLine={false} minTickGap={30} tick={{ fontSize: 10, fill: '#8b9497' }}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8b9497' }}/><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4e8e5', fontSize: 12, color: '#213630' }}/><Area type="monotone" dataKey="INFO" stroke="#159c79" strokeWidth={2.5} fill="url(#info-fill)"/><Area type="monotone" dataKey="WARN" stroke="#edaf46" strokeWidth={2} fill="transparent"/><Area type="monotone" dataKey="ERROR" stroke="#e37474" strokeWidth={2} fill="transparent"/></AreaChart></ResponsiveContainer></div><div className="chart-footer"><Activity size={13}/>{logs.length < total ? `Biểu đồ từ ${logs.length} nhật ký mới nhất trong ngày` : 'Dữ liệu theo thời gian phát sinh sự kiện'}<span>UTC</span></div></section>
    <section className="panel service-panel"><div className="panel-heading"><div><h2>Hoạt động theo dịch vụ</h2><p>Phân bổ nhật ký trong ngày</p></div><span className="soft-tag">{Object.keys(stats?.byService || {}).length} dịch vụ</span></div><div className="service-bars">{Object.entries(stats?.byService || {}).map(([name, count]) => <Link to={`/logs?service=${name}&date=${date}`} key={name}><div><span className={`service-block ${name.toLowerCase()}`}>{name.slice(0, 1)}</span><strong>{name}<small>{({ Auth: 'Xác thực', User: 'Người dùng', Order: 'Đơn hàng', Payment: 'Thanh toán' } as Record<string, string>)[name] || 'Dịch vụ'}</small></strong><b>{count}<small>{total ? Math.round(count / total * 100) : 0}%</small></b></div><div className="progress-track"><i style={{ width: `${total ? count / total * 100 : 0}%` }} className={name.toLowerCase()}/></div></Link>)}{!busy && !Object.keys(stats?.byService || {}).length && <p className="muted">Chưa có hoạt động trong ngày này.</p>}</div><Link className="panel-footer-link" to={isAdmin ? '/services' : '/logs'}>{isAdmin ? 'Quản lý danh mục dịch vụ' : 'Xem nhật ký dịch vụ'}<ArrowRight size={15}/></Link></section></div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Nhật ký gần đây <span className="soft-tag">{logs.length > 6 ? '6 mới nhất' : logs.length}</span></h2><p>Theo dõi những sự kiện vừa được ghi nhận</p></div><Link className="text-link" to={`/logs?date=${date}`}>Xem tất cả<ArrowRight size={15}/></Link></div><LogTable logs={error ? [] : logs.slice(0, 6)} loading={busy} onSelect={setSelected}/></section>
    <footer className="page-footer"><span>AuditFlow · Hệ thống giám sát Audit Log</span><span>{updated ? `Cập nhật lúc ${updated}` : 'Chưa cập nhật'}</span></footer></div><LogDetailModal log={selected} isOpen={!!selected} onClose={() => setSelected(null)}/></>;
};
