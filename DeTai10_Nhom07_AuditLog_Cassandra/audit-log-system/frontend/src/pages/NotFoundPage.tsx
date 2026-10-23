import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Database, Home, FileText } from 'lucide-react';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeToggle } from '../components/ThemeToggle';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-6 text-center relative overflow-hidden transition-colors">
      {/* Top controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Background glow accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
          <Database className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono font-bold">
            404 NOT FOUND
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('common.error', 'Trang Không Tồn Tại')}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Đường dẫn URL bạn truy cập không tồn tại hoặc đã được thay đổi cấu trúc trong hệ thống Audit Log Monitoring.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/logs"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <FileText className="w-4 h-4" />
            <span>Audit Logs</span>
          </Link>
        </div>

        <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-800">
          Apache Cassandra Wide-Column Architecture &bull; Partition Routing
        </div>
      </div>
    </div>
  );
};
