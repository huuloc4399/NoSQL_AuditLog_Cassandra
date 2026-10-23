import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DEMO_MODE } from '../config/api';

export const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<'admin' | 'user'>('admin');
  const [username, setUsername] = useState(DEMO_MODE ? 'admin' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'admin123' : '');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'Đăng nhập · Nếp Store'; }, []);
  if (isAuthenticated) return <Navigate to="/" replace/>;
  const choose = (role: 'admin' | 'user') => { setAccount(role); setUsername(role); setPassword(role === 'admin' ? 'admin123' : 'user12345'); setError(''); };
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(''); try { const res = await authApi.login(username, password); if (!res.data?.token || !res.data?.user) throw new Error('Phiên đăng nhập không hợp lệ.'); login(res.data.token, res.data.user); navigate('/', { replace: true }); } catch (err: any) { setError(err.response?.data?.message || 'Không thể đăng nhập. Kiểm tra tài khoản và kết nối API.'); } finally { setBusy(false); } };
  return <div className="login-page login-simple"><section className="login-form-side"><div className="login-form"><span className="login-icon"><LockKeyhole size={24}/></span><h2>Chào mừng trở lại</h2><p>Đăng nhập để tiếp tục.</p>
    {DEMO_MODE && <><label className="field-caption">CHỌN TÀI KHOẢN XEM THỬ</label><div className="account-picker"><button type="button" className={account === 'admin' ? 'selected' : ''} onClick={() => choose('admin')}><ShieldCheck size={21}/><strong>Admin</strong><small>Quản trị hệ thống</small></button><button type="button" className={account === 'user' ? 'selected' : ''} onClick={() => choose('user')}><UserRound size={21}/><strong>User</strong><small>Tra cứu hoạt động</small></button></div></>}
    <form onSubmit={submit}><label htmlFor="username">Tên đăng nhập</label><input id="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Nhập tên đăng nhập"/><label htmlFor="password">Mật khẩu</label><div className="password-field"><input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu"/><button type="button" className="icon-button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{error && <p role="alert" className="form-error">{error}</p>}<button className="button primary login-submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}<ArrowRight size={17}/></button></form>
    <p className="register-link">Bạn chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></p>{DEMO_MODE && <p className="demo-explanation">Tài khoản mẫu chỉ dùng để xem thử. Các thao tác trong chế độ này không ghi vào Cassandra.</p>}</div></section></div>;
};
