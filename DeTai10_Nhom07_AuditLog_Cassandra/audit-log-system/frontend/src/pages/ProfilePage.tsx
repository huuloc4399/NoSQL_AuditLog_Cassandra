import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { 
  User as UserIcon, 
  KeyRound, 
  ShieldCheck, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Lock,
  Eye,
  EyeOff,
  Shield,
  Activity
} from 'lucide-react';
import { UserRole } from '../types';

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, role } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Show / Hide password toggles
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Compute password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '', percent: 0 };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) {
      return { score: 1, label: t('profile.strengthWeak'), color: 'bg-rose-500', textColor: 'text-rose-500 dark:text-rose-400', percent: 33 };
    }
    if (score <= 3) {
      return { score: 2, label: t('profile.strengthMedium'), color: 'bg-amber-500', textColor: 'text-amber-500 dark:text-amber-400', percent: 66 };
    }
    return { score: 3, label: t('profile.strengthStrong'), color: 'bg-emerald-500', textColor: 'text-emerald-500 dark:text-emerald-400', percent: 100 };
  };

  const strength = getPasswordStrength(newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    if (newPassword === oldPassword) {
      setError(t('profile.samePasswordError'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('profile.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.changePassword(oldPassword, newPassword);
      if (res.success) {
        setSuccess(t('profile.passwordUpdatedSuccess'));
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowOldPass(false);
        setShowNewPass(false);
        setShowConfirmPass(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeStyle = (r: UserRole) => {
    switch (r) {
      case 'ADMIN':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30';
      case 'USER':
      default:
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
    }
  };

  const userInitial = (user?.full_name || user?.username || 'A').charAt(0).toUpperCase();

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title={t('profile.title')} 
        subtitle={t('profile.subtitle')} 
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl space-y-6">
        {/* Section 1: Account Information */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors duration-200">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <UserIcon className="w-4 h-4 text-emerald-500" />
            <span>{t('profile.accountInfo')}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-extrabold text-2xl shadow-sm">
                {userInitial}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {user?.full_name || user?.username}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${getRoleBadgeStyle(role)}`}>
                    {role}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">@{user?.username}</p>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2 shadow-sm">
              <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>{t('profile.status')}: <strong className="text-emerald-600 dark:text-emerald-400">ACTIVE</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium">{t('profile.email')}</span>
              <div className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{user?.email || `${user?.username}@auditlog.internal`}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium">{t('profile.accessLevel')}</span>
              <div className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                <span>
                  {role === 'ADMIN' && 'Quản trị hệ thống, dịch vụ, người dùng và các chức năng demo'}
                  {role === 'USER' && 'Xem thống kê, tra cứu nhật ký và quản lý tài khoản cá nhân'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Security Settings (Change Password) */}
        <div id="security" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('profile.changePasswordTitle')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('profile.changePasswordSubtitle')}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{success}</div>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            {/* Current Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('profile.currentPassword')} *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showOldPass ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder={t('profile.currentPassword')}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono shadow-sm transition"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPass(!showOldPass)}
                  aria-label={showOldPass ? t('profile.hidePassword') : t('profile.showPassword')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* New Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('profile.newPassword')} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono shadow-sm transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    aria-label={showNewPass ? t('profile.hidePassword') : t('profile.showPassword')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('profile.confirmNewPassword')} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono shadow-sm transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    aria-label={showConfirmPass ? t('profile.hidePassword') : t('profile.showPassword')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Strength Visual Meter */}
            {newPassword && (
              <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">{t('profile.passwordStrength')}:</span>
                  <span className={`font-semibold ${strength.textColor}`}>{strength.label}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${strength.color} transition-all duration-300`} 
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t('profile.updatePasswordBtn')}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
