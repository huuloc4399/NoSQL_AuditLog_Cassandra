import { AxiosAdapter, AxiosError } from 'axios';
import { AuditLog, AuditLevel, ServiceItem, UserItem, UserRole } from '../types';

// Explicit browser-only simulation. Never selected in the normal API build.
interface DemoUser extends UserItem { password: string }
interface DemoState { users: DemoUser[]; services: ServiceItem[]; logs: AuditLog[]; expires: Record<string, number> }
const KEY = 'auditflow_demo_v3';
const day = (time: Date) => time.toISOString().slice(0, 10);
const safe = ({ password: _password, ...user }: DemoUser) => user;
const now = () => new Date().toISOString();
function seed(): DemoState {
  const names = ['Auth', 'User', 'Order', 'Payment'];
  const descriptions = ['Xác thực và bảo vệ phiên đăng nhập', 'Quản lý thông tin người dùng', 'Theo dõi vòng đời đơn hàng', 'Xử lý thanh toán và hoàn tiền'];
  const services = names.map((service_name, i) => ({ service_id: crypto.randomUUID(), service_name, description: descriptions[i], status: true, created_at: now(), updated_at: now() }));
  const makeUser = (username: string, password: string, full_name: string, role: UserRole): DemoUser => ({ user_id: crypto.randomUUID(), username, password, full_name, role, email: `${username}@auditflow.demo`, status: 'ACTIVE', created_at: now(), updated_at: now() });
  const logs: AuditLog[] = [];
  const distribution = [70, 70, 65, 60];
  const actions = [ ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'AUTH_ERROR'], ['UPDATE_USER', 'VIEW_USER', 'USER_UPDATE_FAILED'], ['CREATE_ORDER', 'CANCEL_ORDER', 'ORDER_FAILED'], ['PAYMENT_SUCCESS', 'PAYMENT_RETRY', 'PAYMENT_FAILED'] ];
  const messages = [ ['Đăng nhập thành công', 'Đăng nhập thất bại, vui lòng kiểm tra', 'Không thể xác thực phiên đăng nhập'], ['Cập nhật thông tin người dùng', 'Yêu cầu truy cập cần được kiểm tra', 'Không thể cập nhật tài khoản'], ['Đơn hàng được tạo thành công', 'Đơn hàng đã được hủy', 'Xử lý đơn hàng không thành công'], ['Thanh toán đã hoàn tất', 'Kết nối chậm, đang thử lại thanh toán', 'Cổng thanh toán không phản hồi'] ];
  // Match the backend's UTC partition date and the SRS distribution.
  const start = new Date(`${day(new Date())}T00:00:00Z`).getTime();
  const elapsed = Math.max(0, Date.now() - start - 1000);
  names.forEach((service_name, s) => { for (let i = 0; i < 100; i++) { const n = (i * 37) % 100; const index = n < distribution[s] ? 0 : n < distribution[s] + 20 ? 1 : 2; const log_time = new Date(start + elapsed * (i * 4 + s + 1) / 401).toISOString(); logs.push({ log_id: crypto.randomUUID(), service_name, log_time, log_date: day(new Date(log_time)), level: (['INFO', 'WARN', 'ERROR'] as AuditLevel[])[index], action: actions[s][index], user_id: ['admin', 'user', 'nguyen.loc', 'thi.quyen', 'chi.khai'][i % 5], ip_address: `192.168.1.${10 + i % 12}`, message: messages[s][index], details: JSON.stringify({ source: 'BROWSER_DEMO', request_id: `req-${s}-${i}`, resource_id: `DEMO-${1000 + i}`, duration_ms: 12 + i % 80 }) }); } });
  return { users: [makeUser('admin', 'admin123', 'Quản trị viên', 'ADMIN'), makeUser('user', 'user12345', 'Người dùng demo', 'USER')], services, logs: logs.sort((a, b) => b.log_time.localeCompare(a.log_time)), expires: {} };
}
function read(): DemoState { try { const saved = localStorage.getItem(KEY); if (saved) return JSON.parse(saved); } catch { /* Reset invalid demo data. */ } const state = seed(); localStorage.setItem(KEY, JSON.stringify(state)); return state; }
export const demoAdapter: AxiosAdapter = async config => {
  await new Promise(resolve => setTimeout(resolve, 140));
  const state = read();
  const expired = new Set(Object.entries(state.expires).filter(([, until]) => until <= Date.now()).map(([id]) => id));
  state.logs = state.logs.filter(log => !expired.has(log.log_id));
  const path = (config.url || '').split('?')[0];
  const method = (config.method || 'get').toLowerCase();
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data || {};
  const respond = (data: unknown, status = 200) => ({ data, status, statusText: 'Demo', headers: {}, config });
  const fail = (message: string, status = 400): never => { throw new AxiosError(message, String(status), config, undefined, respond({ success: false, message, error: message }, status)); };
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const ok = (data: unknown, message = 'Thao tác thành công', status = 200) => { save(); return respond({ success: true, message, data }, status); };
  const event = (service_name: string, action: string, level: AuditLevel = 'INFO', message = 'Thao tác demo được ghi nhận', user_id = 'admin') => { const log: AuditLog = { log_id: crypto.randomUUID(), service_name, level, action, user_id, log_time: now(), log_date: day(new Date()), message, ip_address: '127.0.0.1', details: JSON.stringify({ source: 'BROWSER_DEMO' }) }; state.logs.unshift(log); return log; };
  const validRole = (value: unknown): value is UserRole => value === 'ADMIN' || value === 'USER';
  if (path === '/auth/login' && method === 'post') { const user = state.users.find(u => u.username === String(body.username).trim().toLowerCase() && u.password === body.password); if (!user || user.status !== 'ACTIVE') fail('Sai tên đăng nhập, mật khẩu hoặc tài khoản đã bị khóa.', 401); const token = `demo-${crypto.randomUUID()}`; sessionStorage.setItem(token, user!.user_id); event('Auth', 'LOGIN_SUCCESS', 'INFO', 'Đăng nhập bản demo thành công', user!.username); return ok({ token, user: safe(user!) }); }
  const createUser = (role: UserRole) => { const username = String(body.username || '').trim().toLowerCase(); if (username.length < 3 || String(body.password || '').length < 8) fail('Tên đăng nhập cần ít nhất 3 ký tự, mật khẩu ít nhất 8 ký tự.'); if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) fail('Email không hợp lệ.'); if (state.users.some(u => u.username === username)) fail('Tên đăng nhập đã tồn tại.', 409); const user: DemoUser = { user_id: crypto.randomUUID(), username, password: body.password, full_name: body.full_name || username, email: body.email || `${username}@auditflow.demo`, role, status: body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', created_at: now(), updated_at: now() }; state.users.push(user); event('Auth', 'REGISTER_USER', 'INFO', `Tạo tài khoản ${username}`); return user; };
  if (path === '/auth/register' && method === 'post') return ok({ user: safe(createUser('USER')) }, 'Đăng ký thành công', 201);
  const token = String(config.headers.Authorization || '').replace(/^Bearer /, '');
  const sessionUser = sessionStorage.getItem(token);
  const current = state.users.find(u => u.user_id === sessionUser && u.status === 'ACTIVE');
  if (!current) fail('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', 401);
  const actor = current!;
  if (path === '/shop/events' && method === 'post') {
    const action = String(body.action);
    if (!['ADD_TO_CART', 'REMOVE_FROM_CART', 'UPDATE_CART', 'CREATE_ORDER', 'CANCEL_ORDER', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED'].includes(action)) fail('Thao tác cửa hàng không hợp lệ.');
    const log = event(action.startsWith('PAYMENT') ? 'Payment' : 'Order', action, action === 'PAYMENT_FAILED' ? 'ERROR' : action === 'CANCEL_ORDER' ? 'WARN' : 'INFO', `Thao tác mua sắm mẫu: ${action}`, actor.username);
    log.details = JSON.stringify({ ...body, simulated: true, source: 'BROWSER_SHOP', owner_user_id: actor.user_id });
    return ok({ auditLog: log }, 'Đã ghi nhật ký xem thử', 201);
  }
  if (path === '/demo/my-actions' && method === 'post') {
    const scenarios = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'UPDATE_USER', 'CREATE_ORDER', 'UPDATE_ORDER', 'CANCEL_ORDER', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED'];
    if (!scenarios.includes(body.scenario) || Object.keys(body).some(key => key !== 'scenario')) fail('Tình huống demo không hợp lệ.');
    const action = body.scenario as string;
    const service = action.startsWith('PAYMENT') ? 'Payment' : action.includes('ORDER') ? 'Order' : action === 'UPDATE_USER' ? 'User' : 'Auth';
    const level: AuditLevel = action === 'PAYMENT_FAILED' ? 'ERROR' : ['LOGIN_FAILED', 'CANCEL_ORDER'].includes(action) ? 'WARN' : 'INFO';
    const log = event(service, action, level, `[Demo cá nhân] ${actor.username}: ${action}`, actor.username);
    log.details = JSON.stringify({ source: 'BROWSER_DEMO', simulated: true, owner_user_id: actor.user_id, resource_id: `DEMO-${actor.user_id}` });
    return ok({ auditLog: log }, 'Đã tạo sự kiện mẫu cho tài khoản hiện tại', 201);
  }
  const readable = method === 'get' && (path === '/logs' || /^\/logs\/(stats\/summary|detail|[a-f0-9-]+)$/.test(path) || path === '/auth/me');
  if (!readable && !path.startsWith('/auth/') && actor.role !== 'ADMIN') fail('Chức năng này chỉ dành cho Admin.', 403);
  if (path === '/auth/me') return ok({ user: safe(actor) });
  if (path === '/auth/logout') { event('Auth', 'LOGOUT', 'INFO', 'Đăng xuất bản demo', actor.username); sessionStorage.removeItem(token); return ok(null); }
  if (path === '/auth/change-password' && method === 'put') { if (body.old_password !== actor.password) fail('Mật khẩu hiện tại không đúng.'); if (String(body.new_password || '').length < 8 || body.new_password === actor.password) fail('Mật khẩu mới cần ít nhất 8 ký tự và khác mật khẩu hiện tại.'); actor.password = body.new_password; event('Auth', 'CHANGE_PASSWORD', 'INFO', 'Đổi mật khẩu thành công', actor.username); return ok(null); }
  if (path === '/logs/stats/summary') { const items = state.logs.filter(l => l.log_date === (config.params?.date || day(new Date()))); return ok({ totalLogs: items.length, infoCount: items.filter(l => l.level === 'INFO').length, warnCount: items.filter(l => l.level === 'WARN').length, errorCount: items.filter(l => l.level === 'ERROR').length, byService: Object.fromEntries(state.services.map(s => [s.service_name, items.filter(l => l.service_name === s.service_name).length])), byLevel: Object.fromEntries(['INFO', 'WARN', 'ERROR'].map(level => [level, items.filter(l => l.level === level).length])), recentErrors: items.filter(l => l.level === 'ERROR').slice(0, 10) }); }
  if (path === '/logs/ttl-demo' && method === 'post') { const ttl = Number(body.ttl || 30); if (!Number.isInteger(ttl) || ttl < 1 || ttl > 86400) fail('TTL không hợp lệ.'); const log = event('Auth', 'TTL_DEMO', 'INFO', `Bản ghi demo hết hạn sau ${ttl} giây`, actor.username); state.expires[log.log_id] = Date.now() + ttl * 1000; log.remaining_ttl = ttl; return ok(log); }
  if (path.startsWith('/logs/ttl-status/')) { const id = path.split('/').pop()!; const log = state.logs.find(l => l.log_id === id); const remaining = Math.max(0, Math.ceil(((state.expires[id] || 0) - Date.now()) / 1000)); save(); return respond({ success: true, found: !!log && remaining > 0, expired: remaining === 0, remaining_ttl: remaining, data: log ? { ...log, remaining_ttl: remaining } : null }); }
  if (path === '/logs' && method === 'get') { const p = config.params || {}; if (p.from && p.to && p.from > p.to) fail('Khoảng thời gian không hợp lệ.'); let items = state.logs.filter(l => (!p.service || l.service_name === p.service) && (!p.level || l.level === p.level) && l.log_date === (p.date || day(new Date()))); const time = (l: AuditLog) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(l.log_time)); items = items.filter(l => (!p.from || time(l) >= p.from) && (!p.to || time(l) <= p.to)); const offset = Number(p.cursor || p.page_state || 0); const limit = Math.min(Number(p.limit) || 15, 500); const next = offset + limit < items.length ? String(offset + limit) : null; save(); return respond({ success: true, data: items.slice(offset, offset + limit), count: items.length, page_state: next, pagination: { limit, nextCursor: next, hasNext: !!next } }); }
  if (path.startsWith('/logs/') && method === 'get') { const id = path === '/logs/detail' ? config.params?.id : path.split('/').pop(); const log = state.logs.find(l => l.log_id === id); if (!log) fail('Nhật ký không tồn tại hoặc đã hết hạn.', 404); return ok(log); }
  if (path === '/logs' && method === 'post') { if (!['INFO', 'WARN', 'ERROR'].includes(body.level) || !body.service_name || !body.action || !body.message) fail('Nhật ký không hợp lệ.'); return ok(event(body.service_name, body.action, body.level, body.message, actor.username), 'Đã tạo nhật ký demo', 201); }
  if (path === '/services' && method === 'get') return ok(state.services);
  if (path === '/services' && method === 'post' || path.startsWith('/services/') && method === 'put') { const name = String(body.service_name || '').trim(); const target = path.split('/')[2]; if (!name) fail('Tên dịch vụ không được để trống.'); if (state.services.some(s => s.service_name.toLowerCase() === name.toLowerCase() && s.service_id !== target)) fail('Tên dịch vụ đã tồn tại.', 409); let service = state.services.find(s => s.service_id === target); if (method === 'put' && !service) fail('Không tìm thấy dịch vụ.', 404); if (service) Object.assign(service, { service_name: name, description: body.description || '', status: body.status !== false, updated_at: now() }); else { service = { service_id: crypto.randomUUID(), service_name: name, description: body.description || '', status: body.status !== false, created_at: now(), updated_at: now() }; state.services.push(service); } event('User', method === 'put' ? 'UPDATE_SERVICE' : 'CREATE_SERVICE', 'INFO', `Cập nhật danh mục dịch vụ: ${name}`, actor.username); return ok(service); }
  if (path.startsWith('/services/')) { const item = state.services.find(s => s.service_id === path.split('/')[2]); if (!item) fail('Không tìm thấy dịch vụ.', 404); if (method === 'delete') { state.services = state.services.filter(s => s !== item); event('User', 'DELETE_SERVICE', 'WARN', `Xóa dịch vụ ${item!.service_name}`, actor.username); } return ok(item); }
  if (path === '/users' && method === 'get') { save(); return respond({ success: true, data: state.users.map(safe), count: state.users.length }); }
  if (path === '/users' && method === 'post') { if (body.role && !validRole(body.role)) fail('Vai trò không hợp lệ.'); return ok(safe(createUser(body.role || 'USER'))); }
  if (path.startsWith('/users/')) { const [, , id, field] = path.split('/'); const target = state.users.find(u => u.user_id === id); if (!target) fail('Không tìm thấy người dùng.', 404); const user = target!; if (user === actor && (method === 'delete' || field === 'role' && body.role !== 'ADMIN' || field === 'status' && body.status !== 'ACTIVE')) fail('Bạn không thể xóa, hạ quyền hoặc khóa tài khoản đang sử dụng.'); if (user.role === 'ADMIN' && user.status === 'ACTIVE' && state.users.filter(u => u.role === 'ADMIN' && u.status === 'ACTIVE').length === 1 && (method === 'delete' || field === 'role' && body.role !== 'ADMIN' || field === 'status' && body.status !== 'ACTIVE')) fail('Cần giữ ít nhất một Admin hoạt động.'); if (field === 'role') { if (!validRole(body.role)) fail('Vai trò không hợp lệ.'); user.role = body.role; } else if (field === 'status') { if (!['ACTIVE', 'INACTIVE'].includes(body.status)) fail('Trạng thái không hợp lệ.'); user.status = body.status; } else if (method === 'delete') state.users = state.users.filter(u => u !== user); else if (method === 'put') { user.full_name = body.full_name ?? user.full_name; user.email = body.email ?? user.email; } event('User', method === 'delete' ? 'DELETE_USER' : field === 'role' ? 'CHANGE_USER_ROLE' : field === 'status' ? 'CHANGE_USER_STATUS' : 'UPDATE_USER', 'INFO', `Cập nhật tài khoản ${user.username}`, actor.username); return ok(safe(user)); }
  if (path.startsWith('/demo/')) { const parts = path.split('/'); const service = ({ auth: 'Auth', users: 'User', orders: 'Order', payments: 'Payment' } as Record<string, string>)[parts[2]] || 'Auth'; const action = parts[2] === 'auth' ? (parts[3] || 'login-success').replace(/-/g, '_').toUpperCase() : parts[2] === 'payments' ? `PAYMENT_${(parts[3] || 'success').toUpperCase()}` : `${method === 'post' ? 'CREATE' : method === 'delete' ? 'DELETE' : parts[4] === 'cancel' ? 'CANCEL' : 'UPDATE'}_${service.toUpperCase()}`; const level: AuditLevel = action.includes('FAILED') ? service === 'Payment' ? 'ERROR' : 'WARN' : action.includes('DELETE') || action.includes('CANCEL') || action.includes('REFUND') ? 'WARN' : 'INFO'; const log = event(service, action, level, `Thao tác ${action} đã được mô phỏng`, actor.username); return ok({ auditLog: log, id: crypto.randomUUID() }); }
  if (path === '/system/status') return ok({ simulated: true });
  return fail('Chức năng không tồn tại trong chế độ demo.', 404);
};
