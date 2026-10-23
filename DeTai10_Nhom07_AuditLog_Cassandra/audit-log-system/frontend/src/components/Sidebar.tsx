import { NavLink } from 'react-router-dom';
import { Activity, ArrowUpRight, Database, FileText, LayoutDashboard, LogOut, Play, Server, ShieldCheck, Timer, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { DEMO_MODE } from '../config/api';

export const Sidebar = () => {
  const { user, isAdmin, logout } = useAuth();
  const { isOpen, close } = useSidebar();
  const renderLink = (to: string, label: string, Icon: typeof Activity) => <NavLink end={to === '/'} key={to} to={to} onClick={close} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={18}/><span>{label}</span>{to === '/logs' && <span className="nav-tag">LOG</span>}</NavLink>;
  return <>
    {isOpen && <button className="nav-backdrop" onClick={close} aria-label="Đóng menu"/>}
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      <NavLink to="/" className="brand"><span className="brand-mark"><Database size={23}/></span><span>audit<span className="brand-light">flow</span><small>NHÓM 07 · CASSANDRA</small></span></NavLink>
      <button className="mobile-close icon-button" onClick={close} aria-label="Đóng menu"><X size={20}/></button>
      <div className="workspace-label"><span className="workspace-icon">07</span><div>Không gian dự án<small>Hệ thống Audit Log</small></div><ShieldCheck size={16}/></div>
      <nav aria-label="Điều hướng chính"><p className="nav-section">KHÔNG GIAN LÀM VIỆC</p>
        {renderLink('/', 'Tổng quan', LayoutDashboard)}{renderLink('/logs', 'Nhật ký hoạt động', FileText)}
        {renderLink('/demo', 'Thao tác demo', Play)}
        {isAdmin && <><p className="nav-section">QUẢN TRỊ</p>{renderLink('/services', 'Dịch vụ', Server)}{renderLink('/users', 'Người dùng', Users)}{renderLink('/ttl-demo', 'Demo TTL', Timer)}{renderLink('/system', 'Trạng thái hệ thống', Activity)}</>}
        <p className="nav-section">TÀI KHOẢN</p>{renderLink('/profile', 'Hồ sơ cá nhân', UserRound)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="tiny-label">APACHE CASSANDRA</span><h3>Mọi thao tác đều có dấu vết.</h3><p>Theo dõi sự kiện và lịch sử hệ thống trong một không gian.</p><NavLink to="/logs">Khám phá nhật ký <ArrowUpRight size={15}/></NavLink></div>
      <div className="sidebar-user"><span className="avatar">{(user?.full_name || user?.username || 'U')[0]}</span><div>{user?.full_name || user?.username}<small>{isAdmin ? 'Quản trị viên' : 'Người dùng'}</small></div><button onClick={logout} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={17}/></button></div>
      <p className="sidebar-version">AuditFlow v2.0 <span>{DEMO_MODE ? 'BẢN DEMO' : 'KẾT NỐI API'}</span></p></div>
    </aside>
  </>;
};
