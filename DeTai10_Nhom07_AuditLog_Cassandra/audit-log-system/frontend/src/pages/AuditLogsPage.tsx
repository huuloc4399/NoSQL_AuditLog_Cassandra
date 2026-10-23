import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { logsApi, servicesApi } from '../services/api';
import { AuditLog, ServiceItem } from '../types';
import { LevelBadge } from '../components/LevelBadge';
import { LogDetailModal } from '../components/LogDetailModal';
import { 
  Search, 
  RotateCcw, 
  Filter, 
  Calendar, 
  Clock, 
  FileText, 
  AlertCircle,
  Database,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Default date in UTC YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Filter input states
  const [selectedService, setSelectedService] = useState(searchParams.get('service') || '');
  const [selectedLevel, setSelectedLevel] = useState(searchParams.get('level') || '');
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || todayStr);
  const [fromTime, setFromTime] = useState(searchParams.get('from') || '');
  const [toTime, setToTime] = useState(searchParams.get('to') || '');
  // Page size & Pagination states (Cassandra pageState / nextCursor cursor pagination)
  const [limit, setLimit] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load available services for filter dropdown
  useEffect(() => {
    servicesApi.getAll().then((res) => {
      setServices(res.data);
    }).catch((err) => {
      console.warn('Could not load service catalog:', err);
    });
  }, []);

  // Sync state from URL search params when URL changes
  useEffect(() => {
    const urlService = searchParams.get('service') || '';
    const urlLevel = searchParams.get('level') || '';
    const urlDate = searchParams.get('date') || todayStr;
    const urlFrom = searchParams.get('from') || '';
    const urlTo = searchParams.get('to') || '';

    setSelectedService(urlService);
    setSelectedLevel(urlLevel);
    setSelectedDate(urlDate);
    setFromTime(urlFrom);
    setToTime(urlTo);

    // Reset pagination on search params change
    setCurrentPage(1);
    setCursorHistory([null]);
    setNextCursor(null);

    // Fetch logs with params
    executeFetch(urlService, urlLevel, urlDate, urlFrom, urlTo, limit, null, 1, 'reset');
  }, [searchParams]);

  const executeFetch = async (
    srv: string,
    lvl: string,
    dt: string,
    from: string,
    to: string,
    lim: number,
    cursor: string | null = null,
    pageNumber: number = 1,
    direction: 'next' | 'prev' | 'reset' = 'reset'
  ) => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // Validate from and to time if both given
      if (from && to && from > to) {
        setErrorMessage("'From Time' cannot be greater than 'To Time'.");
        setLoading(false);
        return;
      }

      const params: any = {
        limit: lim,
        date: dt || todayStr,
      };
      if (srv) params.service = srv;
      if (lvl) params.level = lvl;
      if (from) params.from = from;
      if (to) params.to = to;
      if (cursor) {
        params.cursor = cursor;
        params.page_state = cursor;
      }

      const res = await logsApi.getLogs(params);
      const returnedNextCursor = res.pagination?.nextCursor !== undefined
        ? res.pagination.nextCursor
        : (res.page_state || null);

      setLogs(res.data || []);
      setNextCursor(returnedNextCursor);
      setCurrentPage(pageNumber);

      // Update cursor history according to navigation direction
      if (direction === 'next') {
        setCursorHistory((prev) => {
          const nextHist = [...prev.slice(0, pageNumber - 1), cursor];
          return nextHist;
        });
      } else if (direction === 'prev') {
        setCursorHistory((prev) => prev.slice(0, pageNumber));
      } else if (direction === 'reset') {
        setCursorHistory([null]);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Error querying Cassandra';
      setErrorMessage(msg);
      // Keep currentPage and cursorHistory intact on error
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Update URL query params for bookmarking, refresh, and back-forward navigation
    const newParams: Record<string, string> = {};
    if (selectedService) newParams.service = selectedService;
    if (selectedLevel) newParams.level = selectedLevel;
    if (selectedDate && selectedDate !== todayStr) newParams.date = selectedDate;
    if (fromTime) newParams.from = fromTime;
    if (toTime) newParams.to = toTime;

    setSearchParams(newParams);
    setCurrentPage(1);
    setCursorHistory([null]);
    setNextCursor(null);
    executeFetch(selectedService, selectedLevel, selectedDate, fromTime, toTime, limit, null, 1, 'reset');
  };

  const handleReset = () => {
    setSelectedService('');
    setSelectedLevel('');
    setSelectedDate(todayStr);
    setFromTime('');
    setToTime('');
    setErrorMessage(null);
    setSearchParams({});
    setCurrentPage(1);
    setCursorHistory([null]);
    setNextCursor(null);

    executeFetch('', '', todayStr, '', '', limit, null, 1, 'reset');
  };

  const handleNextPage = () => {
    if (!nextCursor || loading) return;
    const targetPage = currentPage + 1;
    executeFetch(
      selectedService,
      selectedLevel,
      selectedDate,
      fromTime,
      toTime,
      limit,
      nextCursor,
      targetPage,
      'next'
    );
  };

  const handlePrevPage = () => {
    if (currentPage <= 1 || loading) return;
    const targetPage = currentPage - 1;
    const targetCursor = cursorHistory[targetPage - 1] ?? null;
    executeFetch(
      selectedService,
      selectedLevel,
      selectedDate,
      fromTime,
      toTime,
      limit,
      targetCursor,
      targetPage,
      'prev'
    );
  };

  const handlePageSizeChange = (newLimit: number) => {
    setLimit(newLimit);
    setCurrentPage(1);
    setCursorHistory([null]);
    setNextCursor(null);
    executeFetch(
      selectedService,
      selectedLevel,
      selectedDate,
      fromTime,
      toTime,
      newLimit,
      null,
      1,
      'reset'
    );
  };

  const openDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title={t('logs.title')} 
        subtitle={t('logs.subtitle')} 
        onRefresh={() => executeFetch(selectedService, selectedLevel, selectedDate, fromTime, toTime, limit, cursorHistory[currentPage - 1] ?? null, currentPage, 'reset')}
        isRefreshing={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
        {/* Filter Card */}
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Query-First Filter Parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
              {/* Service Select */}
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 block mb-1.5 font-medium">{t('logs.filterService')}</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  aria-label={t('logs.filterService')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">{t('logs.allServices')}</option>
                  {services.map((s) => (
                    <option key={s.service_id} value={s.service_name}>
                      {s.service_name} {s.status ? '' : '(Inactive)'}
                    </option>
                  ))}
                  {services.length === 0 && (
                    <>
                      <option value="Auth">Auth</option>
                      <option value="User">User</option>
                      <option value="Order">Order</option>
                      <option value="Payment">Payment</option>
                    </>
                  )}
                </select>
              </div>

              {/* Severity Level Select */}
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 block mb-1.5 font-medium">{t('logs.filterLevel')}</label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  aria-label={t('logs.filterLevel')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">{t('logs.allLevels')}</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                </select>
              </div>

              {/* Date Picker */}
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 block mb-1.5 font-medium">{t('logs.filterDate')}</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  aria-label={t('logs.filterDate')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Time Range: From */}
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 block mb-1.5 font-medium">From Time</label>
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  aria-label="From Time"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Time Range: To */}
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 block mb-1.5 font-medium">To Time</label>
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  aria-label="To Time"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Action Buttons & Routing Info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  Routing:{' '}
                  {selectedService && selectedLevel ? (
                    <code className="text-emerald-600 dark:text-emerald-400">audit_logs_by_service_level ((srv, lvl, date))</code>
                  ) : selectedService ? (
                    <code className="text-sky-600 dark:text-sky-400">audit_logs ((srv, date))</code>
                  ) : (
                    <code className="text-amber-600 dark:text-amber-400">Parallel Partition Query (0 scan)</code>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label={t('logs.resetFilter')}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('logs.resetFilter')}</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  aria-label={t('logs.applyFilter')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{t('logs.applyFilter')}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Error Alert with Retry */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 flex items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400" />
              <div>
                <strong className="font-semibold text-slate-900 dark:text-white">Query Error:</strong> {errorMessage}
              </div>
            </div>
            <button
              onClick={() => handleSearch()}
              className="px-3 py-1 rounded bg-rose-500/15 dark:bg-rose-500/20 hover:bg-rose-500/25 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-200 border border-rose-500/30 font-medium shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Audit Logs Table */}
        <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors duration-200">
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/60">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Audit Log Entries</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                {logs.length} found
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>Show</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    const newLim = Number(e.target.value);
                    setLimit(newLim);
                    executeFetch(selectedService, selectedLevel, selectedDate, fromTime, toTime, newLim, null, 1);
                  }}
                  className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={400}>400</option>
                </select>
                <span>per page</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">{t('logs.colTime')} (Clustering)</th>
                  <th className="py-3 px-4">{t('logs.colService')}</th>
                  <th className="py-3 px-4">{t('logs.colLevel')}</th>
                  <th className="py-3 px-4">{t('logs.colAction')}</th>
                  <th className="py-3 px-4">{t('logs.colUser')}</th>
                  <th className="py-3 px-4">Source IP</th>
                  <th className="py-3 px-4">{t('logs.colMessage')}</th>
                  <th className="py-3 px-4 text-right">{t('logs.colDetails')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div></td>
                      <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
                      <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-14"></div></td>
                      <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
                      <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
                      <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div></td>
                      <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-56"></div></td>
                      <td className="py-3.5 px-4 text-right"><div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-12 ml-auto"></div></td>
                    </tr>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition group">
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {new Date(log.log_time).toLocaleTimeString()}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {log.log_date}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium font-mono text-[11px]">
                          {log.service_name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <LevelBadge level={log.level} size="sm" />
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {log.user_id || 'System'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs md:max-w-md truncate font-medium">
                        {log.message}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openDetail(log)}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition font-medium"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                        <FileText className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                        <span className="text-sm font-medium">{t('logs.noLogsFound')}</span>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Try adjusting the date, microservice, or severity filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <div>
                <span>{t('logs.paginationPage', 'Page')} <strong className="text-slate-900 dark:text-white font-mono">{currentPage}</strong></span>
                {nextCursor && <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">(More records available)</span>}
              </div>

              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 dark:border-slate-800 pl-3">
                <label htmlFor="pageSizeSelect" className="text-slate-500 font-medium">{t('logs.pageSize', 'Rows per page')}:</label>
                <select
                  id="pageSizeSelect"
                  value={limit}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  disabled={loading}
                  aria-label={t('logs.pageSize', 'Rows per page')}
                  className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1 || loading}
                aria-label={t('logs.paginationPrev')}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{t('logs.paginationPrev')}</span>
              </button>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={!nextCursor || loading}
                aria-label={t('logs.paginationNext')}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 font-medium"
              >
                <span>{t('logs.paginationNext')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
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
