import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { demoApi, logsApi } from '../services/api';
import { LevelBadge } from '../components/LevelBadge';
import { LogDetailModal } from '../components/LogDetailModal';
import { AuditLog } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  KeyRound, 
  UserPlus, 
  ShoppingCart, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  Sparkles,
  Zap,
  Eye,
  RefreshCw,
  Copy,
  Check,
  LogOut,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Timer
} from 'lucide-react';

interface ExecutionResult {
  title: string;
  service: string;
  actionName: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  success: boolean;
  httpStatus: number;
  data: any;
  auditLog?: AuditLog;
  timestamp: string;
  statusText: string;
}

export const DemoOperationsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Detail Modal state for inspecting the generated log
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // TTL Countdown state
  const [ttlSeconds, setTtlSeconds] = useState<number | null>(null);
  const [ttlLogId, setTtlLogId] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (ttlSeconds !== null && ttlSeconds > 0) {
      timer = setInterval(() => {
        setTtlSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [ttlSeconds]);

  const handleCopyLogId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const executeAction = async (
    name: string,
    service: string,
    actionName: string,
    expectedLevel: 'INFO' | 'WARN' | 'ERROR',
    apiCall: () => Promise<any>
  ) => {
    try {
      setLoadingAction(name);
      const res = await apiCall();
      const auditLog: AuditLog | undefined = res.data?.auditLog;

      setLastResult({
        title: name,
        service,
        actionName,
        level: expectedLevel,
        success: res.success ?? true,
        httpStatus: 200,
        data: res.data,
        auditLog,
        timestamp: new Date().toLocaleTimeString(),
        statusText: 'Committed to Cassandra (audit_logs & audit_logs_by_service_level)',
      });
    } catch (err: any) {
      const auditLog: AuditLog | undefined = err.response?.data?.data?.auditLog;
      const status = err.response?.status || 500;
      setLastResult({
        title: name,
        service,
        actionName,
        level: expectedLevel,
        success: false,
        httpStatus: status,
        data: err.response?.data || err.message,
        auditLog,
        timestamp: new Date().toLocaleTimeString(),
        statusText: status === 401 || status === 402 
          ? 'Business failure handled & Audit Log recorded in Cassandra'
          : 'Operation error',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTtlDemo = async () => {
    try {
      setLoadingAction('TTL_DEMO');
      const res = await logsApi.createTtlDemo(30);
      setTtlSeconds(30);
      setTtlLogId(res.data?.log_id);
      setLastResult({
        title: 'Cassandra Native TTL Injection',
        service: 'Auth',
        actionName: 'LOGIN_FAILED',
        level: 'WARN',
        success: true,
        httpStatus: 201,
        data: res.data,
        auditLog: res.data,
        timestamp: new Date().toLocaleTimeString(),
        statusText: 'Saved with USING TTL 30; Auto-evicts in 30 seconds',
      });
    } catch (err: any) {
      setLastResult({
        title: 'TTL Demo Failed',
        service: 'Auth',
        actionName: 'LOGIN_FAILED',
        level: 'ERROR',
        success: false,
        httpStatus: 500,
        data: err.message,
        timestamp: new Date().toLocaleTimeString(),
        statusText: 'TTL injection failed',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const openLogDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title={t('demo.title', 'Live Demo Operations')} 
        subtitle={t('demo.subtitle', 'Trigger Business Transactions & Inspect Automated Cassandra Dual-Write Audit Logs in Real Time')} 
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 flex-1">
        {/* Banner with Direct Navigation to Dashboard */}
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-emerald-50 via-white to-white dark:from-emerald-950/40 dark:via-slate-950 dark:to-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm mb-1">
              <Zap className="w-4 h-4" />
              <span>Real-Time Cassandra Auto Audit Logging Defense Console</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 max-w-2xl leading-relaxed">
              Nhấn bất kỳ nút chức năng bên dưới để kích hoạt giao dịch vi dịch vụ thật. Backend tự động ghi đồng bộ
              vào 3 bảng Query-First của Cassandra (<code className="text-emerald-600 dark:text-emerald-300">audit_logs</code>,{' '}
              <code className="text-emerald-600 dark:text-emerald-300">audit_logs_by_service_level</code>,{' '}
              <code className="text-emerald-600 dark:text-emerald-300">audit_logs_by_id</code>) với cùng một UUID duy nhất.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <button
              onClick={() => navigate('/ttl-demo')}
              className="px-3.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-1.5 transition shadow-sm font-medium"
              title="Mở màn hình demo Cassandra TTL 30 giây"
            >
              <Timer className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>TTL Demo (30s)</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition shadow-sm font-medium"
              title="Mở Dashboard kiểm tra tổng số log vừa nhảy"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Refresh Dashboard</span>
            </button>
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-medium">
              Live API
            </span>
          </div>
        </div>

        {/* Live Execution Result Banner */}
        {lastResult && (
          <div className="p-5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl animate-in fade-in duration-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {lastResult.success ? (
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{lastResult.title}</h4>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                      HTTP {lastResult.httpStatus}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono">
                      {lastResult.statusText}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono block mt-0.5">
                    Executed at {lastResult.timestamp}
                  </span>
                </div>
              </div>

              {/* Action Buttons for the Generated Log */}
              {lastResult.auditLog && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => openLogDetail(lastResult.auditLog!)}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View generated log</span>
                  </button>

                  <button
                    onClick={() => navigate(`/logs?service=${lastResult.auditLog!.service_name}&date=${lastResult.auditLog!.log_date}`)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-800"
                  >
                    <span>Inspect in Audit Logs</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => navigate('/')}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Go to Dashboard</span>
                  </button>
                </div>
              )}
            </div>

            {/* Generated Audit Log Metadata Grid */}
            {lastResult.auditLog ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-sans block mb-1">Generated UUID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate">{lastResult.auditLog.log_id}</span>
                    <button
                      onClick={() => handleCopyLogId(lastResult.auditLog!.log_id)}
                      className="text-slate-400 hover:text-emerald-500 transition"
                      title="Copy Log ID"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-sans block mb-1">Microservice</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{lastResult.auditLog.service_name}</span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-sans block mb-1">Severity Level</span>
                  <LevelBadge level={lastResult.auditLog.level} size="sm" />
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-sans block mb-1">Triggered Action</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{lastResult.auditLog.action}</span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-sans block mb-1">Cassandra Timestamp</span>
                  <span className="text-slate-700 dark:text-slate-300">{new Date(lastResult.auditLog.log_time).toLocaleTimeString()}</span>
                </div>

                <div className="sm:col-span-2 lg:col-span-5 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                  <span className="text-slate-500 text-[10px] uppercase font-sans block mb-0.5">Recorded Message</span>
                  <p className="text-slate-700 dark:text-slate-300 font-sans text-xs">{lastResult.auditLog.message}</p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 p-2">
                Response data: <code className="text-slate-800 dark:text-slate-200">{JSON.stringify(lastResult.data)}</code>
              </div>
            )}
          </div>
        )}

        {/* 4 Microservices Operational Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ================================================================= */}
          {/* GROUP 1: AUTH OPERATIONS (Login Success, Login Failed, Logout)   */}
          {/* ================================================================= */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AUTH Microservice</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Identity verification and credential checks</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono">
                Service: Auth
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Simulates authentication flows and logs audit trails with session fingerprints.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              {/* 1. Login Success */}
              <button
                onClick={() => executeAction('Login Success', 'Auth', 'LOGIN_SUCCESS', 'INFO', () => demoApi.loginSuccess('alice_wonder'))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Login Success</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">INFO</span>
                </div>
                <p className="text-[11px] text-slate-500">Password & 2FA sign in</p>
              </button>

              {/* 2. Login Failed */}
              <button
                onClick={() => executeAction('Login Failed', 'Auth', 'LOGIN_FAILED', 'WARN', () => demoApi.loginFailed('unknown_intruder'))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">Login Failed</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">WARN</span>
                </div>
                <p className="text-[11px] text-slate-500">Simulate bad password</p>
              </button>

              {/* 3. Logout */}
              <button
                onClick={() => executeAction('Logout', 'Auth', 'LOGOUT', 'INFO', () => demoApi.logout('alice_wonder'))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">Logout</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">INFO</span>
                </div>
                <p className="text-[11px] text-slate-500">Graceful session termination</p>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* GROUP 2: USER OPERATIONS (Create User, Update User, Delete User)  */}
          {/* ================================================================= */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">USER Microservice</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">User accounts and profile lifecycle management</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono">
                Service: User
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Triggers customer profile provisioning, address modifications, and admin deletions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              {/* 1. Create User */}
              <button
                onClick={() => executeAction('Create User', 'User', 'CREATE_USER', 'INFO', () => demoApi.createUser())}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Create User</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">INFO</span>
                </div>
                <p className="text-[11px] text-slate-500">Register new customer</p>
              </button>

              {/* 2. Update User */}
              <button
                onClick={() => executeAction('Update User', 'User', 'UPDATE_USER', 'INFO', () => demoApi.updateUser('usr_john_77', { city: 'Hanoi', phone: '+84901234567' }))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Update User</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">INFO</span>
                </div>
                <p className="text-[11px] text-slate-500">Update address & phone</p>
              </button>

              {/* 3. Delete User */}
              <button
                onClick={() => executeAction('Delete User', 'User', 'DELETE_USER', 'WARN', () => demoApi.deleteUser('usr_john_77'))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400">Delete User</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">WARN</span>
                </div>
                <p className="text-[11px] text-slate-500">Soft-delete user account</p>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* GROUP 3: ORDER OPERATIONS (Create Order, Update Order, Cancel)    */}
          {/* ================================================================= */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">ORDER Microservice</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Checkout fulfillment and cart cancellations</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 font-mono">
                Service: Order
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Generates audit footprints for purchase placements, logistics updates, and cancellations.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              {/* 1. Create Order */}
              <button
                onClick={() => executeAction('Create Order', 'Order', 'CREATE_ORDER', 'INFO', () => demoApi.createOrder({ amount: 189.5 }))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Create Order</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">INFO</span>
                </div>
                <p className="text-[11px] text-slate-500">Place order $189.50</p>
              </button>

              {/* 2. Update Order */}
              <button
                onClick={() => executeAction('Update Order', 'Order', 'UPDATE_ORDER', 'INFO', () => demoApi.updateOrder('ORD-88123', { status: 'PREPARING_SHIPMENT', carrier: 'VNPost' }))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Update Order</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">INFO</span>
                </div>
                <p className="text-[11px] text-slate-500">Update courier VNPost</p>
              </button>

              {/* 3. Cancel Order */}
              <button
                onClick={() => executeAction('Cancel Order', 'Order', 'CANCEL_ORDER', 'WARN', () => demoApi.cancelOrder('ORD-88123', 'Customer changed delivery address'))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">Cancel Order</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">WARN</span>
                </div>
                <p className="text-[11px] text-slate-500">Pre-shipment void order</p>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* GROUP 4: PAYMENT OPERATIONS (Success, Failed, Refund)             */}
          {/* ================================================================= */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">PAYMENT Microservice</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Card processing, declines, and chargeback refunds</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono">
                Service: Payment
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Simulates financial settlements, card declines, and customer refund transactions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              {/* 1. Payment Success */}
              <button
                onClick={() => executeAction('Payment Success', 'Payment', 'PAYMENT_SUCCESS', 'INFO', () => demoApi.paymentSuccess({ amount: 189.5, gateway: 'Stripe' }))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Payment Success</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">INFO</span>
                </div>
                <p className="text-[11px] text-slate-500">Capture $189.50 (Stripe)</p>
              </button>

              {/* 2. Payment Failed */}
              <button
                onClick={() => executeAction('Payment Failed', 'Payment', 'PAYMENT_FAILED', 'ERROR', () => demoApi.paymentFailed({ error_code: 'CARD_DECLINED', error_message: 'Insufficient balance' }))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-slate-900 dark:hover:bg-rose-950/40 border border-rose-300 dark:border-rose-500/40 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300 group-hover:text-rose-800 dark:group-hover:text-rose-200">Payment Failed</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">ERROR</span>
                </div>
                <p className="text-[11px] text-rose-600/80 dark:text-rose-300/80">Simulate card declined</p>
              </button>

              {/* 3. Refund */}
              <button
                onClick={() => executeAction('Refund', 'Payment', 'REFUND', 'INFO', () => demoApi.paymentRefund({ amount: 50.0 }))}
                disabled={loadingAction !== null}
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Refund</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">INFO</span>
                </div>
                <p className="text-[11px] text-slate-500">Partial refund $50.00</p>
              </button>
            </div>
          </div>
        </div>

        {/* SECTION: CASSANDRA NATIVE TTL LIVE DEMO */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-950 border border-amber-500/30 relative overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  <span>Cassandra Native TTL (Time-To-Live) Live Demonstration</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
                    USING TTL 30
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Minh chứng tính năng tự động thu hồi dữ liệu của Apache Cassandra mà không cần cron job hoặc lệnh DELETE.
                </p>
              </div>
            </div>

            <button
              onClick={handleTtlDemo}
              disabled={loadingAction !== null}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-xs font-semibold text-slate-950 flex items-center gap-2 transition disabled:opacity-50 shadow-sm shrink-0 self-start sm:self-auto"
            >
              <Sparkles className="w-4 h-4" />
              <span>Insert 30s TTL Demo Log</span>
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-400 font-medium block mb-1">1. Ghi dữ liệu (Injection)</span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Thực thi: <code className="text-slate-700 dark:text-slate-300">INSERT ... USING TTL 30;</code> ghi đồng thời vào 3 bảng query-first.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-400 font-medium block mb-1">2. Đồng hồ đếm ngược (Active Countdown)</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-300">
                  {ttlSeconds !== null ? `${ttlSeconds}s` : '--'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {ttlSeconds !== null && ttlSeconds > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active in Cassandra</span>
                  ) : ttlSeconds === 0 ? (
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">Row Expired & Evicted</span>
                  ) : (
                    'Ready to trigger'
                  )}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-400 font-medium block mb-1">3. Tự động dọn rác (Automated Eviction)</span>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Sau 30 giây, Cassandra tự đánh dấu hết hạn và thu hồi cell khi Compaction chạy ngầm mà không để lại rác Tombstones.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Direct Modal for Log Inspection */}
      <LogDetailModal 
        log={selectedLog} 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)} 
      />
    </div>
  );
};

export default DemoOperationsPage;
