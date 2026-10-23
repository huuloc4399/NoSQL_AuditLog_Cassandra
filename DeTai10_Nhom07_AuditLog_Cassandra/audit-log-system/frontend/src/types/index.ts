export type AuditLevel = 'INFO' | 'WARN' | 'ERROR';

export interface AuditLog {
  service_name: string;
  log_date: string;
  log_time: string;
  log_id: string;
  level: AuditLevel;
  action: string;
  user_id: string | null;
  ip_address: string | null;
  message: string;
  details: string | null;
  remaining_ttl?: number;
}

export interface ServiceItem {
  service_id: string;
  service_name: string;
  description: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalLogs: number;
  infoCount: number;
  warnCount: number;
  errorCount: number;
  byService: Record<string, number>;
  byLevel: Record<string, number>;
  recentErrors: AuditLog[];
}

export interface LogFilterParams {
  service?: string;
  level?: string;
  date?: string;
  from?: string;
  to?: string;
  limit?: number;
  page_state?: string | null;
  cursor?: string | null;
  pageState?: string | null;
}

export interface PaginationMeta {
  limit: number;
  nextCursor: string | null;
  hasNext: boolean;
}

export interface LogResponse {
  success: boolean;
  message: string;
  data: AuditLog[];
  count: number;
  page_state?: string | null;
  pagination?: PaginationMeta;
}

export interface SystemStatusData {
  success: boolean;
  cassandra: {
    connected: boolean;
    contactPoints: string[];
    port: number;
    keyspace: string;
    datacenter: string;
    details?: {
      cluster_name: string;
      release_version: string;
      data_center: string;
      rack: string;
    };
    error?: string;
  };
  systemInfo: {
    uptime_seconds: number;
    node_version: string;
    memory_usage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
    nodetool_help: string;
  };
}

export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface UserItem {
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  user_id?: string;
  username: string;
  full_name?: string;
  email?: string;
  role: UserRole;
  status?: UserStatus;
  token?: string;
}

export interface TtlStatusResponse {
  success: boolean;
  found: boolean;
  expired: boolean;
  remaining_ttl: number;
  data?: AuditLog | null;
  message?: string;
}
