import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { systemApi } from '../services/api';
import { SystemStatusData } from '../types';
import { 
  Database, 
  Server, 
  Terminal, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Cpu, 
  HardDrive,
  Layers,
  ShieldCheck
} from 'lucide-react';

export const SystemStatusPage: React.FC = () => {
  const { t } = useTranslation();
  const [statusData, setStatusData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const start = Date.now();
      const data = await systemApi.getStatus();
      setLatency(Date.now() - start);
      setStatusData(data);
    } catch (err: any) {
      console.error('Failed to load system status:', err);
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Cannot connect to Cassandra backend API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const nodetoolCommand = 'docker exec -it cassandra_audit_node nodetool status';
  const cqlshCommand = 'docker exec -it cassandra_audit_node cqlsh';

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title={t('system.title', 'Cassandra System Status & Node Health')} 
        subtitle={t('system.subtitle', 'Wide-Column Distributed Storage Cluster Diagnostics')} 
        onRefresh={fetchStatus}
        isRefreshing={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
        {/* Error Alert with Retry */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400" />
              <div>
                <strong className="font-semibold text-slate-900 dark:text-white">System Error:</strong> {error}
              </div>
            </div>
            <button
              onClick={fetchStatus}
              className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 border border-rose-500/30 font-medium shrink-0 transition"
            >
              Thử lại (Retry)
            </button>
          </div>
        )}

        {/* Node Connectivity Overview */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{t('system.cluster', 'Apache Cassandra 4.1 Cluster')}</span>
                  {statusData?.cassandra.connected ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> UN (Up / Normal)
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-400 font-mono font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Node Offline
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cluster: <span className="text-slate-800 dark:text-slate-200 font-mono">{statusData?.cassandra.details?.cluster_name || 'AuditLogCluster'}</span> &bull; 
                  Keyspace: <span className="text-slate-800 dark:text-slate-200 font-mono">audit_log_system</span>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 block">Ping Latency</span>
              <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {latency !== null ? `${latency} ms` : '--'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px] mb-1">{t('system.host', 'Host Endpoint')}</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold">127.0.0.1:9042</span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px] mb-1">{t('system.datacenter', 'Data Center')}</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold">
                {statusData?.cassandra.details?.data_center || 'datacenter1'}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px] mb-1">{t('system.rack', 'Rack Location')}</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold">
                {statusData?.cassandra.details?.rack || 'rack1'}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px] mb-1">{t('system.version', 'Release Version')}</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold">
                {statusData?.cassandra.details?.release_version || '4.1'}
              </span>
            </div>
          </div>
        </div>

        {/* nodetool status Explanation Box */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white text-sm font-semibold">
            <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('system.nodetool', 'Nodetool Cluster Verification (Defense Demo)')}</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            In Apache Cassandra, <code className="text-emerald-600 dark:text-emerald-400">nodetool status</code> displays the state and topology of all nodes in the ring.
            The status flag <strong className="text-emerald-600 dark:text-emerald-400 font-mono">UN</strong> represents:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold font-mono flex items-center justify-center shrink-0">
                U
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Up</span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">The node process is alive, listening on port 9042, and participating in gossip protocol.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold font-mono flex items-center justify-center shrink-0">
                N
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Normal</span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">The node is in normal operational state (not leaving, joining, or bootstrapping).</p>
              </div>
            </div>
          </div>

          {/* Copyable Terminal Commands */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">PowerShell / Command Prompt command to run nodetool:</span>
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-xs text-emerald-700 dark:text-emerald-300">
              <code>{nodetoolCommand}</code>
              <button
                onClick={() => copyToClipboard(nodetoolCommand, 'nodetool')}
                className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                title="Copy Command"
              >
                {copiedCmd === 'nodetool' ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">Interactive CQL Shell command:</span>
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-xs text-emerald-700 dark:text-emerald-300">
              <code>{cqlshCommand}</code>
              <button
                onClick={() => copyToClipboard(cqlshCommand, 'cqlsh')}
                className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                title="Copy Command"
              >
                {copiedCmd === 'cqlsh' ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Data Architecture Reference */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white text-sm font-semibold">
            <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>{t('system.models', 'Cassandra Wide-Column Data Models in this System')}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-xs block">
                Table: audit_logs
              </span>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                <strong>Partition Key:</strong> <code className="text-slate-800 dark:text-slate-200 font-mono font-semibold">((service_name, log_date))</code>
              </p>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                <strong>Clustering Columns:</strong> <code className="text-slate-800 dark:text-slate-200 font-mono font-semibold">log_time DESC, log_id ASC</code>
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Optimized for retrieving all operations for a specific microservice on a given date, ordered newest first with time-slice support.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-sky-600 dark:text-sky-400 font-mono text-xs block">
                Table: audit_logs_by_service_level
              </span>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                <strong>Partition Key:</strong> <code className="text-slate-800 dark:text-slate-200 font-mono font-semibold">((service_name, level, log_date))</code>
              </p>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">
                <strong>Clustering Columns:</strong> <code className="text-slate-800 dark:text-slate-200 font-mono font-semibold">log_time DESC, log_id ASC</code>
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Query-First table optimized for immediate filtering by Service + Severity Level (e.g. Payment ERRORs) without ALLOW FILTERING.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SystemStatusPage;
