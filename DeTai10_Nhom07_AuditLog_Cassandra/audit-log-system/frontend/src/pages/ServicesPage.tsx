import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { servicesApi } from '../services/api';
import { ServiceItem } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { ToastContainer, ToastMessage } from '../components/Toast';
import { 
  Server, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  X,
  AlertCircle
} from 'lucide-react';

export const ServicesPage: React.FC = () => {
  const { t } = useTranslation();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [activeService, setActiveService] = useState<ServiceItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setPageError(null);
      const res = await servicesApi.getAll();
      setServices(res.data);
    } catch (err: any) {
      console.error('Failed to load services:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Cannot load services catalog';
      setPageError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const addToast = (type: 'success' | 'error' | 'info' | 'warning', message: string, title?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const openAddModal = () => {
    setFormName('');
    setFormDescription('');
    setFormStatus(true);
    setFormError(null);
    setIsAddOpen(true);
  };

  const openEditModal = (service: ServiceItem) => {
    setActiveService(service);
    setFormName(service.service_name);
    setFormDescription(service.description);
    setFormStatus(service.status);
    setFormError(null);
    setIsEditOpen(true);
  };

  const openDeleteModal = (service: ServiceItem) => {
    setActiveService(service);
    setIsDeleteOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Service Name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await servicesApi.create({
        service_name: formName.trim(),
        description: formDescription.trim(),
        status: formStatus,
      });
      setIsAddOpen(false);
      addToast('success', `Microservice '${formName}' registered in Cassandra catalog.`, 'Service Created');
      fetchServices();
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeService) return;

    try {
      setIsSubmitting(true);
      setFormError(null);
      await servicesApi.update(activeService.service_id, {
        service_name: formName.trim(),
        description: formDescription.trim(),
        status: formStatus,
      });
      setIsEditOpen(false);
      addToast('success', `Service '${formName}' updated successfully.`, 'Service Updated');
      fetchServices();
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!activeService) return;

    try {
      setIsSubmitting(true);
      await servicesApi.delete(activeService.service_id);
      setIsDeleteOpen(false);
      addToast('info', `Service '${activeService.service_name}' removed from catalog.`, 'Service Deleted');
      fetchServices();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      addToast('error', `Failed to delete service: ${msg}`, 'Deletion Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title={t('services.title')} 
        subtitle={t('services.subtitle')} 
        onRefresh={fetchServices}
        isRefreshing={loading}
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
        {/* Page Error Banner */}
        {pageError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 flex items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400" />
              <div>
                <strong className="font-semibold text-slate-900 dark:text-white">Service Catalog Error:</strong> {pageError}
              </div>
            </div>
            <button
              onClick={fetchServices}
              className="px-3 py-1 rounded bg-rose-500/15 dark:bg-rose-500/20 hover:bg-rose-500/25 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-200 border border-rose-500/30 font-medium shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Registered Microservices
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inactive microservices automatically reject incoming audit logs at the backend validation layer.
            </p>
          </div>

          <button
            onClick={openAddModal}
            aria-label={t('services.addService')}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-2 transition shadow-sm self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('services.addService')}</span>
          </button>
        </div>

        {/* Services Table */}
        <div className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">{t('services.serviceName')}</th>
                  <th className="py-3.5 px-4">{t('services.description')}</th>
                  <th className="py-3.5 px-4">{t('services.status')}</th>
                  <th className="py-3.5 px-4">Created At</th>
                  <th className="py-3.5 px-4">Updated At</th>
                  <th className="py-3.5 px-4 text-right">{t('services.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div></td>
                      <td className="py-4 px-4 text-right"><div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-16 ml-auto"></div></td>
                    </tr>
                  ))
                ) : services.length > 0 ? (
                  services.map((svc) => (
                    <tr key={svc.service_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition">
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm font-mono">
                          {svc.service_name}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300 max-w-xs md:max-w-md truncate">
                        {svc.description || <span className="text-slate-400 dark:text-slate-600 italic">No description</span>}
                      </td>
                      <td className="py-4 px-4">
                        {svc.status ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('services.active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            {t('services.inactive')}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {svc.created_at ? new Date(svc.created_at).toLocaleDateString() : '--'}
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {svc.updated_at ? new Date(svc.updated_at).toLocaleDateString() : '--'}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(svc)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                            title={t('services.edit')}
                            aria-label={`${t('services.edit')} ${svc.service_name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(svc)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 transition"
                            title={t('services.delete')}
                            aria-label={`${t('services.delete')} ${svc.service_name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      No services currently registered in Cassandra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Service Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden p-6 transition-colors duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('services.addService')}</h3>
              <button onClick={() => setIsAddOpen(false)} aria-label="Close modal" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 text-sm">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 block mb-1 font-medium">{t('services.serviceName')} *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Inventory"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 block mb-1 font-medium">{t('services.description')}</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Service responsibility and purpose"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="statusAdd"
                  checked={formStatus}
                  onChange={(e) => setFormStatus(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-emerald-600 focus:ring-0"
                />
                <label htmlFor="statusAdd" className="text-xs text-slate-700 dark:text-slate-300">
                  Active (Allow incoming audit logs)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {isEditOpen && activeService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden p-6 transition-colors duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('services.edit')}</h3>
              <button onClick={() => setIsEditOpen(false)} aria-label="Close modal" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 mt-4 text-sm">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 block mb-1 font-medium">{t('services.serviceName')} *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 dark:text-slate-400 block mb-1 font-medium">{t('services.description')}</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="statusEdit"
                  checked={formStatus}
                  onChange={(e) => setFormStatus(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-emerald-600 focus:ring-0"
                />
                <label htmlFor="statusEdit" className="text-xs text-slate-700 dark:text-slate-300">
                  Active (Allow incoming audit logs)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal using ConfirmModal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        title="Delete Microservice"
        message={`Are you sure you want to remove '${activeService?.service_name}' from the Cassandra services catalog? Existing audit logs in Cassandra will remain preserved.`}
        confirmText="Yes, Delete Service"
        cancelText={t('common.cancel')}
        isDanger={true}
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteOpen(false)}
      />

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
