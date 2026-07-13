import React, { useState, useEffect } from 'react';
import { X, Shield, Crown, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { AdminAPI } from '../lib/adminApi';
import { useLanguage } from './LanguageProvider';

export const ADMIN_PAGES = [
  { id: 'admin-users', labelPt: 'Gerenciar Usuários', labelEn: 'Manage Users', labelEs: 'Gestionar Usuarios', section: 'users' },
  { id: 'accounts-access', labelPt: 'Acessos de Contas', labelEn: 'Account Access', labelEs: 'Acceso a Cuentas', section: 'users' },
  { id: 'admin-payments', labelPt: 'Confirmar Pagamentos', labelEn: 'Confirm Payments', labelEs: 'Confirmar Pagos', section: 'financial' },
  { id: 'admin-credits', labelPt: 'Gerenciar Créditos', labelEn: 'Manage Credits', labelEs: 'Gestionar Créditos', section: 'financial' },
  { id: 'admin-sales', labelPt: 'Gerenciar Vendas', labelEn: 'Manage Sales', labelEs: 'Gestionar Ventas', section: 'financial' },
  { id: 'admin-withdrawals', labelPt: 'Gestão de Saques', labelEn: 'Withdrawal Management', labelEs: 'Gestión de Retiros', section: 'financial' },
  { id: 'admin-products', labelPt: 'Gerenciar Produtos', labelEn: 'Manage Products', labelEs: 'Gestionar Productos', section: 'products' },
  { id: 'admin-smm-providers', labelPt: 'Provedores SMM', labelEn: 'SMM Providers', labelEs: 'Proveedores SMM', section: 'products' },
  { id: 'admin-smm', labelPt: 'Configurar Serviços SMM', labelEn: 'Configure SMM Services', labelEs: 'Configurar Servicios SMM', section: 'products' },
  { id: 'admin-smm-orders', labelPt: 'Pedidos SMM', labelEn: 'SMM Orders', labelEs: 'Pedidos SMM', section: 'products' },
  { id: 'sellers', labelPt: 'Vendedores', labelEn: 'Sellers', labelEs: 'Vendedores', section: 'products' },
  { id: 'services', labelPt: 'Serviços', labelEn: 'Services', labelEs: 'Servicios', section: 'products' },
  { id: 'seller-requests', labelPt: 'Solicitações de Vendedores', labelEn: 'Seller Requests', labelEs: 'Solicitudes de Vendedores', section: 'products' },
  { id: 'admin-notifications', labelPt: 'Enviar Notificações', labelEn: 'Send Notifications', labelEs: 'Enviar Notificaciones', section: 'support' },
  { id: 'admin-popups', labelPt: 'Gerenciar Pop-ups', labelEn: 'Manage Popups', labelEs: 'Gestionar Pop-ups', section: 'support' },
  { id: 'admin-announcements', labelPt: 'Anúncios', labelEn: 'Announcements', labelEs: 'Anuncios', section: 'support' },
  { id: 'admin-banners', labelPt: 'Banners', labelEn: 'Banners', labelEs: 'Banners', section: 'support' },
  { id: 'admin-flying-balloons', labelPt: 'Balões Voadores', labelEn: 'Flying Balloons', labelEs: 'Globos Voladores', section: 'support' },
  { id: 'admin-coupons', labelPt: 'Cupons de Desconto', labelEn: 'Discount Coupons', labelEs: 'Cupones de Descuento', section: 'financial' },
  { id: 'admin-community', labelPt: 'Gerenciar Comunidade', labelEn: 'Manage Community', labelEs: 'Gestionar Comunidad', section: 'support' },
  { id: 'admin-support', labelPt: 'Gerenciar Suporte', labelEn: 'Manage Support', labelEs: 'Gestionar Soporte', section: 'support' },
  { id: 'admin-netflix-accounts', labelPt: 'Contas Netflix', labelEn: 'Netflix Accounts', labelEs: 'Cuentas Netflix', section: 'support' },
  { id: 'admin-settings', labelPt: 'Configurações', labelEn: 'Settings', labelEs: 'Configuraciones', section: 'support' },
] as const;

const SECTIONS = {
  users: { labelPt: 'Gestão de Usuários', labelEn: 'User Management', labelEs: 'Gestión de Usuarios' },
  financial: { labelPt: 'Gestão Financeira', labelEn: 'Financial Management', labelEs: 'Gestión Financiera' },
  products: { labelPt: 'Gestão de Produtos', labelEn: 'Product Management', labelEs: 'Gestión de Productos' },
  support: { labelPt: 'Suporte e Configurações', labelEn: 'Support & Settings', labelEs: 'Soporte y Configuración' },
};

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AdminPermissionsModal({ userId, userName, onClose, onSaved }: Props) {
  const { language } = useLanguage();
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = language as 'pt' | 'en' | 'es';
  const labelKey = lang === 'pt' ? 'labelPt' : lang === 'en' ? 'labelEn' : 'labelEs';

  useEffect(() => {
    loadExistingPermissions();
  }, [userId]);

  async function loadExistingPermissions() {
    setLoading(true);
    try {
      const result = await AdminAPI.getAdminPermissions(userId);
      if (result.data) {
        setIsSuperAdmin(result.data.is_super_admin ?? false);
        setSelectedPages(new Set(result.data.pages ?? []));
      }
    } catch {
      // No existing permissions - start fresh with all enabled
      setSelectedPages(new Set(ADMIN_PAGES.map(p => p.id)));
    } finally {
      setLoading(false);
    }
  }

  const togglePage = (pageId: string) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const toggleSection = (section: string) => {
    const sectionPages = ADMIN_PAGES.filter(p => p.section === section).map(p => p.id);
    const allSelected = sectionPages.every(id => selectedPages.has(id));
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (allSelected) sectionPages.forEach(id => next.delete(id));
      else sectionPages.forEach(id => next.add(id));
      return next;
    });
  };

  const selectAll = () => setSelectedPages(new Set(ADMIN_PAGES.map(p => p.id)));
  const deselectAll = () => setSelectedPages(new Set());

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await AdminAPI.updateAdminPermissions(userId, Array.from(selectedPages), isSuperAdmin);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error saving permissions');
    } finally {
      setSaving(false);
    }
  };

  const sectionEntries = Object.entries(SECTIONS) as [string, typeof SECTIONS[keyof typeof SECTIONS]][];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-xl">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {lang === 'pt' ? 'Permissões Admin' : lang === 'en' ? 'Admin Permissions' : 'Permisos Admin'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{userName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Super Admin Toggle */}
            <div className="p-4 mx-6 mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsSuperAdmin(!isSuperAdmin)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${isSuperAdmin ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isSuperAdmin ? 'translate-x-7' : 'translate-x-1'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {lang === 'pt' ? 'Super Admin (Acesso Total)' : lang === 'en' ? 'Super Admin (Full Access)' : 'Super Admin (Acceso Total)'}
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {lang === 'pt' ? 'Acessa todas as páginas sem restrições' : lang === 'en' ? 'Access all pages without restrictions' : 'Accede a todas las páginas sin restricciones'}
                  </p>
                </div>
              </label>
            </div>

            {!isSuperAdmin && (
              <>
                {/* Quick actions */}
                <div className="flex items-center gap-2 px-6 pt-4">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">
                    {lang === 'pt' ? 'Selecionar:' : lang === 'en' ? 'Select:' : 'Seleccionar:'}
                  </span>
                  <button
                    onClick={selectAll}
                    className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium"
                  >
                    {lang === 'pt' ? 'Todos' : lang === 'en' ? 'All' : 'Todos'}
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-xs px-2.5 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    {lang === 'pt' ? 'Nenhum' : lang === 'en' ? 'None' : 'Ninguno'}
                  </button>
                  <span className="ml-auto text-xs text-gray-400">
                    {selectedPages.size}/{ADMIN_PAGES.length} {lang === 'pt' ? 'páginas' : lang === 'en' ? 'pages' : 'páginas'}
                  </span>
                </div>

                {/* Page checkboxes by section */}
                <div className="overflow-y-auto flex-1 px-6 py-3 space-y-4">
                  {sectionEntries.map(([sectionKey, sectionLabel]) => {
                    const pages = ADMIN_PAGES.filter(p => p.section === sectionKey);
                    const allSelected = pages.every(p => selectedPages.has(p.id));
                    const someSelected = pages.some(p => selectedPages.has(p.id));

                    return (
                      <div key={sectionKey} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <button
                          onClick={() => toggleSection(sectionKey)}
                          className="flex items-center gap-2 mb-3 group w-full"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            allSelected
                              ? 'bg-blue-600 border-blue-600'
                              : someSelected
                              ? 'bg-blue-200 border-blue-400 dark:bg-blue-900/40 dark:border-blue-500'
                              : 'border-gray-300 dark:border-gray-500'
                          }`}>
                            {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
                            {someSelected && !allSelected && <div className="w-2 h-0.5 bg-blue-600 dark:bg-blue-400" />}
                          </div>
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {sectionLabel[labelKey]}
                          </span>
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {pages.map(page => (
                            <label
                              key={page.id}
                              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-600 cursor-pointer transition-colors"
                            >
                              <div
                                onClick={() => togglePage(page.id)}
                                className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                  selectedPages.has(page.id)
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'border-gray-300 dark:border-gray-500 hover:border-blue-400'
                                }`}
                              >
                                {selectedPages.has(page.id) && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span
                                onClick={() => togglePage(page.id)}
                                className="text-sm text-gray-700 dark:text-gray-300 select-none"
                              >
                                {page[labelKey]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {isSuperAdmin && (
              <div className="flex items-center justify-center p-8 text-center">
                <div>
                  <Crown className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {lang === 'pt'
                      ? 'Este administrador terá acesso completo a todas as páginas administrativas.'
                      : lang === 'en'
                      ? 'This administrator will have full access to all admin pages.'
                      : 'Este administrador tendrá acceso completo a todas las páginas administrativas.'}
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-6 mb-2 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors disabled:opacity-50"
              >
                {lang === 'pt' ? 'Cancelar' : lang === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {lang === 'pt' ? 'Salvando...' : lang === 'en' ? 'Saving...' : 'Guardando...'}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {lang === 'pt' ? 'Salvar Permissões' : lang === 'en' ? 'Save Permissions' : 'Guardar Permisos'}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
