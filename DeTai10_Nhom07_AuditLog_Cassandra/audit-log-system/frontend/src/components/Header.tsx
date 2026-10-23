import { Link } from 'react-router-dom';
import { ChevronRight, Menu, Moon, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { DEMO_MODE } from '../config/api';
import { useEffect, useState } from 'react';
import { systemApi } from '../services/api';

interface HeaderProps { title?: string; subtitle?: string; onRefresh?: () => void; isRefreshing?: boolean }
export const Header = ({ title, onRefresh, isRefreshing }: HeaderProps) => {
  const { isAdmin, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toggle } = useSidebar();
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    if (DEMO_MODE) return;
    let active = true;
    const check = async () => {
      try { const health = await systemApi.getHealth(); if (active) setConnected(health.success === true); }
      catch { if (active) setConnected(false); }
    };
    check();
    const timer = setInterval(check, 20000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return <header className="app-header"><div className="breadcrumb"><button className="icon-button menu-toggle" onClick={toggle} aria-label="Mở menu"><Menu size={21}/></button><span>Không gian làm việc</span><ChevronRight size={14}/><strong>{title}</strong></div><div className="header-actions">
    <span className={`mode-label ${DEMO_MODE ? 'demo' : connected === true ? 'online' : connected === false ? 'offline' : ''}`}><i/>{DEMO_MODE ? 'Dữ liệu mô phỏng' : connected === true ? 'Cassandra đã kết nối' : connected === false ? 'Mất kết nối dữ liệu' : 'Đang kiểm tra kết nối'}</span>
    {onRefresh && <button className="icon-button" disabled={isRefreshing} onClick={onRefresh} aria-label="Làm mới" title="Làm mới"><RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''}/></button>}
    <button className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
    <span className="role-label"><ShieldCheck size={14}/>{isAdmin ? 'Admin' : 'User'}</span><Link to="/profile" className="avatar header-avatar" aria-label="Hồ sơ cá nhân">{(user?.full_name || user?.username || 'U')[0]}</Link>
  </div></header>;
};
