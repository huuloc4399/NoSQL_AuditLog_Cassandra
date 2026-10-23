import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { logsApi } from '../services/api';
import { DashboardStats, AuditLog } from '../types';
import { LevelBadge } from '../components/LevelBadge';
import { LogDetailModal } from '../components/LogDetailModal';
import { 
  FileText, 
  Info, 
  AlertTriangle, 
  AlertOctagon, 
  TrendingUp, 
  Server, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Link } from 'react-router-dom';

const LEVEL_COLORS: Record<string, string> = {
  INFO: '#38bdf8',
  WARN: '#fbbf24',
  ERROR: '#f43f5e',
};

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await logsApi.getStats();
      setStats(res.data);
    } catch (err: any) {
      console.error('Failed to load dashboard statistics:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Không thể kết nối đến cơ sở dữ liệu Cassandra';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const openLogDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  // Prepare chart data
  const serviceChartData = stats?.byService
    ? Object.entries(stats.byService).map(([name, count]) => ({ name, count }))
    : [];

  const levelChartData = stats?.byLevel
    ? Object.entries(stats.byLevel).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title={t('dashboard.title')} 
        subtitle={t('dashboard.subtitle')} 
        onRefresh={fetchStats}
        isRefreshing={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 flex-1">
        {/* Error Banner with Retry */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400" />
              <div>
                <strong className="font-semibold text-slate-900 dark:text-white">Database Degraded / Error:</strong>{' '}
                <span>{error}</span>
              </div>
            </div>
            <button
              onClick={fetchStats}
              className="px-3.5 py-1.5 rounded-lg bg-rose-500/15 dark:bg-rose-500/20 hover:bg-rose-500/25 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-200 border border-rose-500/30 font-medium flex items-center justify-center gap-1.5 transition self-start sm:self-auto shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Top 4 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: TOTAL LOGS */}
          <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('dashboard.totalLogs')}</span>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                {loading ? '...' : (stats?.totalLogs ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">records</span>
            </div>
            <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Persisted across Wide-Column tables</span>
            </div>
          </div>

          {/* Card 2: INFO */}
          <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-sky-500/30 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">{t('dashboard.infoLogs')}</span>
              <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Info className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                {loading ? '...' : (stats?.infoCount ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">events</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Standard business operations
            </div>
          </div>

          {/* Card 3: WARN */}
          <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/30 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('dashboard.warnLogs')}</span>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                {loading ? '...' : (stats?.warnCount ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">warnings</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Failed logins, cancellations, rate limits
            </div>
          </div>

          {/* Card 4: ERROR */}
          <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-950 border border-rose-300 dark:border-rose-500/40 shadow-sm relative overflow-hidden group hover:border-rose-500/60 transition bg-gradient-to-br from-rose-500/5 dark:from-rose-950/20 to-transparent">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">{t('dashboard.errorLogs')}</span>
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 dark:border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <AlertOctagon className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-300 font-mono">
                {loading ? '...' : (stats?.errorCount ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-rose-600/80 dark:text-rose-400/80 font-medium">errors</span>
            </div>
            <div className="mt-2 text-xs text-rose-600/80 dark:text-rose-400/80">
              Payment declines, lockouts, system faults
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Logs by Service */}
          <div className="lg:col-span-2 p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  {t('dashboard.serviceDistribution')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Partitioned across Auth, User, Order, Payment</p>
              </div>
              <Link to="/logs" className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 flex items-center gap-1 font-medium">
                {t('dashboard.viewAllLogs')} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 animate-pulse">
                  Loading chart metrics...
                </div>
              ) : serviceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#38bdf8' }}
                    />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No chart data available
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Logs by Severity Level */}
          <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors duration-200">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                Severity Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ratio of INFO, WARN, and ERROR</p>
            </div>

            <div className="h-52 w-full flex items-center justify-center">
              {loading ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 animate-pulse">
                  Loading severity...
                </div>
              ) : levelChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={levelChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {levelChartData.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={LEVEL_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-slate-500">No severity data</div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-auto grid grid-cols-3 gap-2 pt-4 border-t border-slate-200 dark:border-slate-800/80 text-center">
              <div>
                <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold block">INFO</span>
                <span className="text-xs font-mono text-slate-800 dark:text-slate-200">{stats?.infoCount || 0}</span>
              </div>
              <div>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold block">WARN</span>
                <span className="text-xs font-mono text-slate-800 dark:text-slate-200">{stats?.warnCount || 0}</span>
              </div>
              <div>
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold block">ERROR</span>
                <span className="text-xs font-mono text-slate-800 dark:text-slate-200">{stats?.errorCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Critical Errors Table */}
        <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                {t('dashboard.recentActivity')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Queried directly from <code className="text-slate-700 dark:text-slate-300">audit_logs_by_service_level</code> where level = 'ERROR'
              </p>
            </div>
            <Link 
              to="/logs?level=ERROR" 
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-500 dark:hover:text-rose-300 flex items-center gap-1 font-medium self-start sm:self-auto shrink-0"
            >
              Filter all errors <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">{t('logs.colTime')}</th>
                  <th className="py-3 px-4">{t('logs.colService')}</th>
                  <th className="py-3 px-4">{t('logs.colAction')}</th>
                  <th className="py-3 px-4">{t('logs.colUser')}</th>
                  <th className="py-3 px-4">{t('logs.colMessage')}</th>
                  <th className="py-3 px-4 text-right">{t('logs.colDetails')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div></td>
                      <td className="py-3 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
                      <td className="py-3 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
                      <td className="py-3 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
                      <td className="py-3 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
                      <td className="py-3 px-4 text-right"><div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-14 ml-auto"></div></td>
                    </tr>
                  ))
                ) : stats?.recentErrors && stats.recentErrors.length > 0 ? (
                  stats.recentErrors.map((log) => (
                    <tr key={log.log_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                        {new Date(log.log_time).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                          {log.service_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {log.user_id || 'System'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-md truncate font-medium">
                        {log.message}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openLogDetail(log)}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      No critical error logs found for today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <LogDetailModal 
        log={selectedLog} 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
};
