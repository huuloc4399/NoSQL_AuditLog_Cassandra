import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { DEMO_MODE } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { StoreLayout } from '../pages/ShopPages';
import { useEffect } from 'react';
export const MainLayout = () => {
  const { isAdmin } = useAuth();
  useEffect(() => { document.title = isAdmin ? 'AuditFlow · Quản trị' : 'Nếp Store · Mua sắm mỗi ngày'; }, [isAdmin]);
  if (!isAdmin) return <StoreLayout/>;
  return <div className="app-shell"><Sidebar/><main className="app-main">{DEMO_MODE && <div className="demo-banner">CHẾ ĐỘ XEM THỬ · Dữ liệu được mô phỏng trên trình duyệt. Chưa kết nối Cassandra.</div>}<Outlet/></main></div>;
};
