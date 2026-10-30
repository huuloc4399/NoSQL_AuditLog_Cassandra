/**
 * [BAREM 2, 3, 4] Các hàm HTTP dùng chung giữa giao diện và backend.
 * servicesApi phục vụ CRUD; logsApi phục vụ ghi/lọc/TTL; backend mới truy cập Cassandra.
 * Ở chế độ preview, adapter thay thế phản hồi; chỉ dùng chế độ thường để chứng minh DB thật.
 */
import axios from 'axios';
import { API_BASE_URL, DEMO_MODE } from '../config/api';
import { demoAdapter } from './demoAdapter';
import { AuditLog, DashboardStats, LogFilterParams, LogResponse, ServiceItem, SystemStatusData, TtlStatusResponse } from '../types';

const api = axios.create({
  adapter: DEMO_MODE ? demoAdapter : undefined,
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Tự gắn JWT của phiên vào request cần xác thực.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('audit_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Xử lý phản hồi không còn quyền dùng phiên, yêu cầu đăng nhập lại khi phù hợp.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Đăng nhập thất bại trong kịch bản có auditLog là kết quả nghiệp vụ mô phỏng, không phải phiên hiện tại hết hạn.
    const demoBusinessFailure = error.config?.url?.startsWith('/demo/') && error.response?.data?.data?.auditLog;
    if (error.response?.status === 401 && !demoBusinessFailure && window.location.pathname !== '/login') {
      localStorage.removeItem('audit_auth_token');
      localStorage.removeItem('audit_username');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API xác thực và thông tin tài khoản hiện hành.
export const authApi = {
  register: async (data: { username: string; password: string; full_name?: string; email?: string }) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  login: async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    return res.data;
  },
  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  changePassword: async (old_password: string, new_password: string) => {
    const res = await api.put('/auth/change-password', { old_password, new_password });
    return res.data;
  },
};

// API quản lý tài khoản, chỉ ADMIN được gọi.
export const usersApi = {
  getAll: async (): Promise<{ data: import('../types').UserItem[]; count: number }> => {
    const res = await api.get('/users');
    return res.data;
  },
  create: async (data: {
    username: string;
    password: string;
    full_name?: string;
    email?: string;
    role?: import('../types').UserRole;
    status?: import('../types').UserStatus;
  }) => {
    const res = await api.post('/users', data);
    return res.data;
  },
  update: async (id: string, data: { full_name?: string; email?: string }) => {
    const res = await api.put(`/users/${id}`, data);
    return res.data;
  },
  changeRole: async (id: string, role: import('../types').UserRole) => {
    const res = await api.patch(`/users/${id}/role`, { role });
    return res.data;
  },
  changeStatus: async (id: string, status: import('../types').UserStatus) => {
    const res = await api.patch(`/users/${id}/status`, { status });
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },
};

// [BAREM 2, 3] API ghi log, lọc, chi tiết và TTL.
export const logsApi = {
  getLogs: async (params?: LogFilterParams): Promise<LogResponse> => {
    const res = await api.get('/logs', { params });
    return res.data;
  },
  getStats: async (date?: string): Promise<{ data: DashboardStats }> => {
    const res = await api.get('/logs/stats/summary', { params: { date } });
    return res.data;
  },
  getLogById: async (id: string, params?: { service?: string; date?: string; time?: string }): Promise<{ data: AuditLog }> => {
    const res = await api.get(`/logs/${id}`, { params });
    return res.data;
  },
  getDetail: async (service: string, date: string, time: string, id: string): Promise<{ data: AuditLog }> => {
    const res = await api.get('/logs/detail', { params: { service, date, time, id } });
    return res.data;
  },
  createLog: async (log: any) => {
    const res = await api.post('/logs', log);
    return res.data;
  },
  createTtlDemo: async (ttl: number = 30) => {
    const res = await api.post('/logs/ttl-demo', { ttl });
    return res.data;
  },
  checkTtlStatus: async (id: string): Promise<TtlStatusResponse> => {
    const res = await api.get(`/logs/ttl-status/${id}`);
    return res.data;
  },
};

// [BAREM 2] API CRUD danh mục dịch vụ.
export const servicesApi = {
  getAll: async (): Promise<{ data: ServiceItem[] }> => {
    const res = await api.get('/services');
    return res.data;
  },
  getById: async (id: string): Promise<{ data: ServiceItem }> => {
    const res = await api.get(`/services/${id}`);
    return res.data;
  },
  create: async (data: { service_name: string; description?: string; status?: boolean }) => {
    const res = await api.post('/services', data);
    return res.data;
  },
  update: async (id: string, data: { service_name?: string; description?: string; status?: boolean }) => {
    const res = await api.put(`/services/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/services/${id}`);
    return res.data;
  },
};

// [BAREM 4] API tạo sự kiện minh họa; không phải bảng dữ liệu mua hàng.
export const demoApi = {
  myAction: async (scenario: string) => (await api.post('/demo/my-actions', { scenario })).data,
  prepareToday: async () => (await api.post('/demo/prepare-today')).data,
  loginSuccess: async (username?: string) => {
    const res = await api.post('/demo/auth/login-success', { username });
    return res.data;
  },
  loginFailed: async (username?: string) => {
    const res = await api.post('/demo/auth/login-failed', { username });
    return res.data;
  },
  logout: async (username?: string) => {
    const res = await api.post('/demo/auth/logout', { username });
    return res.data;
  },
  createUser: async (data?: any) => {
    const res = await api.post('/demo/users', data);
    return res.data;
  },
  updateUser: async (id: string, updates?: any) => {
    const res = await api.put(`/demo/users/${id}`, { updates });
    return res.data;
  },
  deleteUser: async (id: string) => {
    const res = await api.delete(`/demo/users/${id}`);
    return res.data;
  },
  createOrder: async (data?: any) => {
    const res = await api.post('/demo/orders', data);
    return res.data;
  },
  updateOrder: async (id: string, updates?: any) => {
    const res = await api.put(`/demo/orders/${id}`, { updates });
    return res.data;
  },
  cancelOrder: async (id: string, reason?: string) => {
    const res = await api.put(`/demo/orders/${id}/cancel`, { reason });
    return res.data;
  },
  paymentSuccess: async (data?: any) => {
    const res = await api.post('/demo/payments/success', data);
    return res.data;
  },
  paymentFailed: async (data?: any) => {
    const res = await api.post('/demo/payments/failed', data);
    return res.data;
  },
  paymentRefund: async (data?: any) => {
    const res = await api.post('/demo/payments/refund', data);
    return res.data;
  },
};

// [BAREM 4] Kiểm tra API và trạng thái Cassandra thật.
export const systemApi = {
  getHealth: async (): Promise<{ success: boolean }> => {
    const res = await api.get('/health');
    return res.data;
  },
  getStatus: async (): Promise<SystemStatusData> => {
    const res = await api.get('/system/status');
    return res.data;
  },
};

export default api;

export interface CqlConsoleResult {
  columns: string[];
  rows: Record<string, string | number | boolean | null>[];
  text?: string;
  elapsedMs: number;
  truncated: boolean;
}
export const cqlApi = {
  execute: async (query: string, signal?: AbortSignal): Promise<CqlConsoleResult> => {
    const res = await api.post('/admin/cql', { query }, { signal });
    return res.data.data;
  },
};
