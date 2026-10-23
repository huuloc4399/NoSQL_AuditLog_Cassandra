import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, ArrowLeft, Lock, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AccessDeniedPageProps {
  requiredRoles?: string[];
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ requiredRoles = ['ADMIN'] }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, role } = useAuth();

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden space-y-6 transition-colors duration-200">
        {/* Glow decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 dark:text-rose-400 mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono font-semibold">
            <Lock className="w-3.5 h-3.5" />
            HTTP 403 FORBIDDEN
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('accessDenied.title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t('accessDenied.subtitle')}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs space-y-2 text-left">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">{t('profile.accountInfo')}:</span>
            <span className="text-slate-900 dark:text-white font-medium">{user?.username || 'Authenticated User'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">{t('accessDenied.currentRole')}</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              {role}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">{t('accessDenied.requiredRole')}</span>
            <span className="text-rose-600 dark:text-rose-400 font-mono font-medium text-[11px]">
              {requiredRoles.join(' or ')}
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('accessDenied.goBack')}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('accessDenied.goBack')}
          </button>
          <button
            onClick={() => navigate('/')}
            aria-label={t('accessDenied.dashboard')}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
          >
            <LayoutDashboard className="w-4 h-4" />
            {t('accessDenied.dashboard')}
          </button>
        </div>
      </div>
    </div>
  );
};
