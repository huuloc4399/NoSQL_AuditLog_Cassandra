import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { LogDetailModal } from '../components/LogDetailModal';
import { Toast, ToastType } from '../components/Toast';
import { logsApi } from '../services/api';
import { AuditLog } from '../types';
import {
  Timer,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Database,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Info,
  Clock,
  Radio,
  FileCode2,
  ShieldCheck,
  Flame,
} from 'lucide-react';

type DemoPhase = 'idle' | 'active' | 'expired';

export const TtlDemoPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // State configuration
  const [ttlConfig, setTtlConfig] = useState<number>(30);
  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [autoSync, setAutoSync] = useState<boolean>(true);

  // Active Demo Log data
  const [activeLog, setActiveLog] = useState<AuditLog | null>(null);
  const [logId, setLogId] = useState<string>('');
  const [cassandraRemainingTtl, setCassandraRemainingTtl] = useState<number | null>(null);
  const [localSecondsLeft, setLocalSecondsLeft] = useState<number>(30);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');

  // Modals & Notifications
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Interval references
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean intervals on unmount
  useEffect(() => {
    return () => {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, []);

  // STEP 1: Create TTL Log
  const handleCreateTtlLog = async () => {
    try {
      setIsCreating(true);
      // Reset state
      if (localTimerRef.current) clearInterval(localTimerRef.current);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);

      const res = await logsApi.createTtlDemo(ttlConfig);
      const newLog = res.data;

      setActiveLog(newLog);
      setLogId(newLog.log_id);
      setLocalSecondsLeft(ttlConfig);
      setCassandraRemainingTtl(ttlConfig);
      setPhase('active');
      setLastCheckedAt(new Date().toLocaleTimeString());

      setToast({
        message: `✔ Record inserted into Cassandra with USING TTL ${ttlConfig}!`,
        type: 'success',
      });

      // Start local ticking interval (1 second)
      localTimerRef.current = setInterval(() => {
        setLocalSecondsLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start real Cassandra polling every 2 seconds
      startCassandraPolling(newLog.log_id);
    } catch (err: any) {
      setToast({
        message: `Failed to create TTL log: ${err.response?.data?.message || err.message}`,
        type: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // STEP 2 & 3: Poll / Query Cassandra directly using TTL(message)
  const queryCassandraDirectly = async (idToCheck: string) => {
    if (!idToCheck) return;
    try {
      setIsChecking(true);
      const status = await logsApi.checkTtlStatus(idToCheck);
      setLastCheckedAt(new Date().toLocaleTimeString());

      if (status.found && !status.expired) {
        setCassandraRemainingTtl(status.remaining_ttl);
        if (status.data) {
          setActiveLog(status.data);
        }
      } else {
        // Record has EXPIRED in Cassandra
        setCassandraRemainingTtl(0);
        setLocalSecondsLeft(0);
        setPhase('expired');
        if (localTimerRef.current) clearInterval(localTimerRef.current);
        if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      }
    } catch (err: any) {
      console.warn('Cassandra check error:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const startCassandraPolling = (targetId: string) => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      if (autoSync) {
        queryCassandraDirectly(targetId);
      }
    }, 2000);
  };

  // Reset demo
  const handleReset = () => {
    if (localTimerRef.current) clearInterval(localTimerRef.current);
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    setPhase('idle');
    setActiveLog(null);
    setLogId('');
    setCassandraRemainingTtl(null);
    setLocalSecondsLeft(ttlConfig);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Progress percentage (0% = expired, 100% = fresh)
  const progressPercent = Math.max(0, Math.min(100, Math.round((localSecondsLeft / ttlConfig) * 100)));

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title={t('ttl.title', 'Cassandra TTL Demo (Time-To-Live)')}
        subtitle={t('ttl.subtitle', 'Prove row-level automated expiration without DELETE statements or cron jobs')}
        onRefresh={() => (logId ? queryCassandraDirectly(logId) : undefined)}
        isRefreshing={isChecking}
      />

      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Banner with Architecture Context */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-100 to-emerald-500/10 dark:from-amber-500/10 dark:via-slate-800/60 dark:to-emerald-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Apache Cassandra Native Lifecycle Management</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  USING TTL 30s
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                Cassandra calculates cell expiration at write time. After 30 seconds, read queries immediately ignore the
                record, and disk space is reclaimed during compaction without application DELETE pressure.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
            <button
              onClick={() => navigate('/demo')}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5 shadow-sm"
            >
              Operations Demo
            </button>
            <button
              onClick={() => navigate('/logs')}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5 shadow-sm"
            >
              View All Logs
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 5-Step Process Visualizer */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
          <div
            className={`p-2.5 rounded-lg border flex flex-col gap-1 transition ${
              phase === 'idle'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-medium'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">Step 1</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{t('ttl.step1', 'Create TTL Log')}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">USING TTL 30</span>
          </div>

          <div
            className={`p-2.5 rounded-lg border flex flex-col gap-1 transition ${
              phase === 'active'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20 font-medium'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">Step 2</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{t('ttl.step2', 'Countdown 30s')}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Active in Memtable</span>
          </div>

          <div
            className={`p-2.5 rounded-lg border flex flex-col gap-1 transition ${
              phase === 'active'
                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 font-medium'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">Step 3</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{t('ttl.step3', 'Check Cassandra')}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">TTL(message) query</span>
          </div>

          <div
            className={`p-2.5 rounded-lg border flex flex-col gap-1 transition ${
              phase === 'active' && localSecondsLeft <= 5
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 animate-pulse font-medium'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">Step 4</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{t('ttl.step4', 'Expire Threshold')}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Tombstone active</span>
          </div>

          <div
            className={`p-2.5 rounded-lg border col-span-2 sm:col-span-1 flex flex-col gap-1 transition ${
              phase === 'expired'
                ? 'bg-rose-500/15 border-rose-500/50 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30 font-medium'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">Step 5</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{t('ttl.step5', 'Auto-Purged')}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">0 Rows Returned</span>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive Demo Controls & Countdown (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* CARD 1: Trigger / Create */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Play className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Step 1: Create TTL Audit Log</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Will be inserted into Cassandra with temporary lifespan</p>
                  </div>
                </div>

                {phase !== 'idle' && (
                  <button
                    onClick={handleReset}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select TTL Expiration Duration (Seconds):
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 30, 45, 60].map((sec) => (
                      <button
                        key={sec}
                        disabled={phase === 'active' || isCreating}
                        onClick={() => {
                          setTtlConfig(sec);
                          setLocalSecondsLeft(sec);
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                          ttlConfig === sec
                            ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                        } disabled:opacity-50`}
                      >
                        {sec}s {sec === 30 && '(Standard)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Target Microservice:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Auth</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Action:</span>
                    <span className="font-mono text-amber-600 dark:text-amber-300 font-semibold">LOGIN_FAILED</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Applied TTL Option:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">USING TTL {ttlConfig}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Affects Standard Logs:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">NO (Isolated to this test log)</span>
                  </div>
                </div>

                <button
                  onClick={handleCreateTtlLog}
                  disabled={isCreating || phase === 'active'}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                    phase === 'active'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                      : 'bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-600 hover:to-emerald-700 text-slate-950 font-bold shadow-amber-500/20 hover:scale-[1.01]'
                  }`}
                >
                  {isCreating ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>Executing CQL Insert with TTL {ttlConfig}...</span>
                    </>
                  ) : phase === 'active' ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-spin" />
                      <span>TTL Active ({localSecondsLeft}s remaining)</span>
                    </>
                  ) : (
                    <>
                      <Timer className="w-4 h-4 text-slate-950" />
                      <span>Insert TTL Log ({ttlConfig}s Lifespan)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CARD 2: Active Countdown & Real-Time Cassandra Verification */}
            {phase !== 'idle' && (
              <div
                className={`p-6 rounded-2xl border transition-all duration-300 shadow-xl ${
                  phase === 'expired'
                    ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/40 ring-1 ring-rose-500/20'
                    : 'bg-white dark:bg-slate-950/80 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        phase === 'expired'
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                      }`}
                    >
                      {phase === 'expired' ? <XCircle className="w-4 h-4" /> : <Timer className="w-4 h-4 animate-pulse" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {phase === 'expired' ? 'Step 5: Record Purged from Cassandra' : 'Step 2 & 3: Live Cassandra TTL'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {phase === 'expired'
                          ? 'Cassandra TTL engine has deleted the record'
                          : 'Queried via Cassandra TTL(message) native CQL'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                      phase === 'expired'
                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    <Radio className="w-3 h-3 animate-pulse" />
                    {phase === 'expired' ? 'EXPIRED' : 'ACTIVE IN CASSANDRA'}
                  </span>
                </div>

                {/* Big Visual Countdown Gauge */}
                <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center my-4">
                  {phase === 'active' ? (
                    <>
                      <div className="text-5xl font-mono font-extrabold text-amber-500 dark:text-amber-400 tracking-tight flex items-baseline gap-2">
                        <span>{localSecondsLeft}</span>
                        <span className="text-lg text-slate-500 dark:text-slate-400 font-sans font-medium">seconds</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                        Cassandra TTL(message) Node Read:{' '}
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {cassandraRemainingTtl !== null ? `${cassandraRemainingTtl}s` : 'Reading...'}
                        </span>
                      </p>

                      {/* Dynamic Progress Bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-4">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            localSecondsLeft <= 5
                              ? 'bg-rose-500'
                              : localSecondsLeft <= 15
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-500 dark:text-rose-400 mb-2">
                        <XCircle className="w-6 h-6" />
                      </div>
                      <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">0 ROWS RETURNED</div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md">
                        Record has been deleted automatically by Cassandra. The row is tombstoned and skipped on all
                        subsequent SELECT queries!
                      </p>
                    </>
                  )}
                </div>

                {/* Real-time Cassandra Check Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => queryCassandraDirectly(logId)}
                      disabled={isChecking}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 transition flex items-center gap-1.5 shadow"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                      Check Cassandra Now
                    </button>

                    {activeLog && (
                      <button
                        onClick={() => setIsDetailModalOpen(true)}
                        className="px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5"
                      >
                        Inspect Row Details
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSync}
                        onChange={(e) => setAutoSync(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-500 focus:ring-0 bg-white dark:bg-slate-800"
                      />
                      <span>Auto-query node (2s)</span>
                    </label>

                    {lastCheckedAt && (
                      <span className="text-[11px] font-mono text-slate-500">Last query: {lastCheckedAt}</span>
                    )}
                  </div>
                </div>

                {/* Identity Metadata Box */}
                <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Cassandra Log ID:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-800 dark:text-slate-300 font-semibold">{logId}</span>
                      <button
                        onClick={() => copyToClipboard(logId)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                        title="Copy Log ID"
                      >
                        {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Cassandra Tables Updated:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      audit_logs, audit_logs_by_service_level, audit_logs_by_id
                    </span>
                  </div>

                  {phase === 'expired' && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-rose-600 dark:text-rose-400 font-medium">Verification in UI:</span>
                      <button
                        onClick={() => navigate('/logs')}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        Check Audit Logs Table (Proof of absence)
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Real CQL Code & Examiner Defense Guide (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* CQL Statements in Action */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <FileCode2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Under The Hood: Real CQL</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Statements executed on Cassandra cluster</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>1. Write with Native TTL:</span>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-300 overflow-x-auto leading-relaxed">
                    {`INSERT INTO audit_logs (
  service_name, log_date, log_time,
  log_id, level, action, message
) VALUES (
  'Auth', toDate(now()), toTimestamp(now()),
  ?, 'WARN', 'LOGIN_FAILED', '...'
) USING TTL ${ttlConfig};`}
                  </pre>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>2. Query Remaining Lifespan:</span>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-300 overflow-x-auto leading-relaxed">
                    {`SELECT 
  log_id, action, message,
  TTL(message) AS remaining_ttl
FROM audit_logs_by_id
WHERE log_id = ${logId ? logId.slice(0, 18) + '...' : '?'};`}
                  </pre>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>3. Query After ${ttlConfig}s:</span>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-300 overflow-x-auto leading-relaxed">
                    {`-- Cassandra returns: (0 rows)
-- No DELETE statement was sent by application!`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Teacher / Defense Points */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Why Cassandra TTL for Defense</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Key theoretical points for examiners</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Zero Application Delete Pressure
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    Relational databases require periodic background workers running <code className="text-amber-600 dark:text-amber-300">DELETE WHERE date &lt; ...</code>{' '}
                    which causes table locks and write spikes. Cassandra handles this automatically at the cell level.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Tombstone & SSTable Compaction
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    Once TTL expires, the cell timestamp marks it as expired. Read queries ignore it instantly. Physical disk
                    space is reclaimed during regular Minor/Major SSTable Compaction.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Regulatory Compliance (GDPR / Retain 90d)
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    In enterprise banking audit systems, logs are assigned a default TTL of 90 to 365 days, guaranteeing
                    deterministic automated compliance without developer intervention.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {isDetailModalOpen && activeLog && (
        <LogDetailModal
          log={activeLog}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
