import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { usersApi } from '../services/api';
import { UserItem, UserRole, UserStatus } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  Eye, 
  EyeOff,
  Activity, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  Search, 
  Lock, 
  RefreshCw,
  Mail,
  User as UserIcon,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UserManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('USER');
  const [formStatus, setFormStatus] = useState<UserStatus>('ACTIVE');

  // Notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await usersApi.getAll();
      setUsers(res.data || []);
    } catch (err: any) {
      setToast({
        message: err.response?.data?.error || 'Failed to load user catalog',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formPassword.length < 8) {
      setToast({
        message: 'Password must be at least 8 characters long',
        type: 'error',
      });
      return;
    }
    try {
      await usersApi.create({
        username: formUsername,
        password: formPassword,
        full_name: formFullName,
        email: formEmail,
        role: formRole,
        status: formStatus,
      });
      setToast({ message: `User '${formUsername}' registered successfully`, type: 'success' });
      setShowAddModal(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setToast({
        message: err.response?.data?.error || err.response?.data?.message || 'Failed to create user',
        type: 'error',
      });
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await usersApi.update(selectedUser.user_id, {
        full_name: formFullName,
        email: formEmail,
      });
      setToast({ message: `Profile for '${selectedUser.username}' updated`, type: 'success' });
      setShowEditModal(false);
      fetchUsers();
    } catch (err: any) {
      setToast({
        message: err.response?.data?.error || 'Failed to update user',
        type: 'error',
      });
    }
  };

  const handleChangeRole = async (newRole: UserRole) => {
    if (!selectedUser) return;
    try {
      await usersApi.changeRole(selectedUser.user_id, newRole);
      setToast({ message: `Role for '${selectedUser.username}' changed to ${newRole}`, type: 'success' });
      setShowRoleModal(false);
      fetchUsers();
    } catch (err: any) {
      setToast({
        message: err.response?.data?.error || 'Failed to change role',
        type: 'error',
      });
    }
  };

  const handleToggleStatus = async (targetUser: UserItem) => {
    const newStatus: UserStatus = targetUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await usersApi.changeStatus(targetUser.user_id, newStatus);
      setToast({
        message: `Account '${targetUser.username}' is now ${newStatus}`,
        type: 'success',
      });
      fetchUsers();
    } catch (err: any) {
      setToast({
        message: err.response?.data?.error || 'Failed to change user status',
        type: 'error',
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await usersApi.delete(selectedUser.user_id);
      setToast({ message: `User '${selectedUser.username}' deleted permanently`, type: 'success' });
      setShowDeleteModal(false);
      fetchUsers();
    } catch (err: any) {
      setToast({
        message: err.response?.data?.error || 'Failed to delete user',
        type: 'error',
      });
    }
  };

  const resetForm = () => {
    setFormUsername('');
    setFormPassword('');
    setShowFormPassword(false);
    setFormFullName('');
    setFormEmail('');
    setFormRole('USER');
    setFormStatus('ACTIVE');
  };

  const openEditModal = (u: UserItem) => {
    setSelectedUser(u);
    setFormFullName(u.full_name);
    setFormEmail(u.email);
    setShowEditModal(true);
  };

  const openRoleModal = (u: UserItem) => {
    setSelectedUser(u);
    setFormRole(u.role);
    setShowRoleModal(true);
  };

  const openDeleteModal = (u: UserItem) => {
    setSelectedUser(u);
    setShowDeleteModal(true);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <ShieldCheck className="w-3 h-3" />
            ADMIN
          </span>
        );
      case 'USER':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Eye className="w-3 h-3" />
            USER
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        onRefresh={fetchUsers}
        isRefreshing={loading}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by username, name, or email..."
              aria-label="Filter users"
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            aria-label={t('users.addUser')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('users.addUser')}</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">{t('users.role')}</th>
                  <th className="px-6 py-3.5">{t('users.status')}</th>
                  <th className="px-6 py-3.5">{t('users.createdAt')}</th>
                  <th className="px-6 py-3.5 text-right">{t('users.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-500 dark:text-emerald-400" />
                        <span>Loading user directory...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No users match the search filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = currentUser?.username === u.username;
                    return (
                      <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold shrink-0">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                {u.username}
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">{u.full_name || '—'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          {u.email}
                        </td>

                        <td className="px-6 py-3.5">
                          {getRoleBadge(u.role)}
                        </td>

                        <td className="px-6 py-3.5">
                          <button
                            onClick={() => !isSelf && handleToggleStatus(u)}
                            disabled={isSelf}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                            } ${isSelf ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            title={isSelf ? 'Cannot disable self' : `Click to set ${u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}`}
                            aria-label={`Toggle status for ${u.username}`}
                          >
                            {u.status === 'ACTIVE' ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            <span>{u.status}</span>
                          </button>
                        </td>

                        <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openRoleModal(u)}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700 transition"
                              title={t('users.changeRole')}
                              aria-label={`${t('users.changeRole')} for ${u.username}`}
                            >
                              Role
                            </button>
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                              title={t('users.editProfile')}
                              aria-label={`${t('users.editProfile')} for ${u.username}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(u)}
                              disabled={isSelf}
                              className={`p-1.5 rounded text-rose-600 dark:text-rose-400 border border-rose-500/20 transition ${
                                isSelf ? 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : 'bg-rose-500/10 hover:bg-rose-500/20'
                              }`}
                              title={isSelf ? 'Cannot delete your own account' : t('users.deleteUser')}
                              aria-label={`${t('users.deleteUser')} ${u.username}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 transition-colors duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                {t('users.addUser')}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="e.g. ops_manager"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Min 8 characters (hashed with bcrypt)"
                    aria-label="Password"
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    aria-label={showFormPassword ? t('auth.hidePassword', 'Ẩn mật khẩu') : t('auth.showPassword', 'Hiện mật khẩu')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition focus:outline-none"
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Full Name</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="e.g. Operations Manager"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. ops@auditlog.internal"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Assign Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="USER">USER (Tra cứu nhật ký)</option>
                    <option value="ADMIN">ADMIN (Full Root Access)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as UserStatus)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/20 transition"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 transition-colors duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                Edit Profile: @{selectedUser.username}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Full Name</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-medium block mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 transition-colors duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                {t('users.changeRole')}
              </h3>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select new RBAC access privilege for <strong className="text-slate-900 dark:text-white">@{selectedUser.username}</strong>:
            </p>

            <div className="space-y-2">
              {(['ADMIN', 'USER'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleChangeRole(r)}
                  className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition ${
                    selectedUser.role === r
                      ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 font-bold'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    {r === 'ADMIN' && <ShieldCheck className="w-4 h-4 text-purple-500 dark:text-purple-400" />}
                    {r === 'USER' && <Eye className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
                    <span>{r}</span>
                  </div>
                  {selectedUser.role === r && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-200">
                      Current
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <ConfirmModal
          isOpen={showDeleteModal}
          title={t('users.confirmDelete')}
          message={`Are you sure you want to permanently delete user account '${selectedUser.username}'? This action cannot be undone.`}
          confirmText={t('users.deleteUser')}
          cancelText={t('common.cancel')}
          onConfirm={handleDeleteUser}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
};
