import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Search, Ban, CheckCircle, Loader2, AlertTriangle, X,
  ShoppingBag, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AdminAPI } from '../lib/adminApi';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface SellerProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  store_suspended: boolean | null;
  seller_slug: string | null;
  seller_level: number | null;
  created_at: string;
}

interface SellerStats {
  productCount: number;
  activeProductCount: number;
  totalSales: number;
}

export function AdminSellersStoresManager() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [suspendModal, setSuspendModal] = useState<SellerProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [statsMap, setStatsMap] = useState<Record<string, SellerStats>>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    loadSellers();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  async function loadSellers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, avatar_url, role, store_suspended, seller_slug, seller_level, created_at')
        .eq('role', 'seller')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSellers(data || []);

      const stats: Record<string, SellerStats> = {};
      await Promise.all((data || []).slice(0, 50).map(async (s) => {
        try {
          const { count: productCount } = await supabase
            .from('store_products')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', s.id);

          const { count: activeProductCount } = await supabase
            .from('store_products')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', s.id)
            .eq('active', true);

          const { count: totalSales } = await supabase
            .from('store_orders')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', s.id)
            .in('status', ['completed', 'paid']);

          stats[s.id] = {
            productCount: productCount || 0,
            activeProductCount: activeProductCount || 0,
            totalSales: totalSales || 0,
          };
        } catch { /* ignore individual stat errors */ }
      }));
      setStatsMap(stats);
    } catch (error) {
      console.error('Error loading sellers:', error);
      setToast({ type: 'error', message: lbl('Erro ao carregar vendedores', 'Error loading sellers', 'Error al cargar vendedores') });
    } finally {
      setLoading(false);
    }
  }

  async function handleSuspend() {
    if (!suspendModal || !user) return;
    setActionLoading(suspendModal.id);
    try {
      const result = await AdminAPI.suspendStore(suspendModal.id, suspendReason || undefined);
      if (!result.success) throw new Error(result.error || 'Failed');

      setSellers(prev => prev.map(s =>
        s.id === suspendModal.id ? { ...s, store_suspended: true } : s
      ));
      setToast({ type: 'success', message: lbl('Loja suspensa com sucesso', 'Store suspended successfully', 'Tienda suspendida con éxito') });
      setSuspendModal(null);
      setSuspendReason('');
    } catch (error) {
      console.error('Error suspending store:', error);
      setToast({ type: 'error', message: lbl('Erro ao suspender loja', 'Error suspending store', 'Error al suspender tienda') });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnsuspend(seller: SellerProfile) {
    if (!user) return;
    if (!confirm(lbl('Reativar a loja deste vendedor?', 'Reactivate this seller\'s store?', '¿Reactivar la tienda de este vendedor?'))) return;
    setActionLoading(seller.id);
    try {
      const result = await AdminAPI.unsuspendStore(seller.id);
      if (!result.success) throw new Error(result.error || 'Failed');

      setSellers(prev => prev.map(s =>
        s.id === seller.id ? { ...s, store_suspended: false } : s
      ));
      setToast({ type: 'success', message: lbl('Loja reativada com sucesso', 'Store reactivated successfully', 'Tienda reactivada con éxito') });
    } catch (error) {
      console.error('Error reactivating store:', error);
      setToast({ type: 'error', message: lbl('Erro ao reativar loja', 'Error reactivating store', 'Error al reactivar tienda') });
    } finally {
      setActionLoading(null);
    }
  }

  const filteredSellers = sellers.filter(s => {
    const matchesSearch =
      (s.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.username?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'active' ? !s.store_suspended :
      filter === 'suspended' ? !!s.store_suspended : true;
    return matchesSearch && matchesFilter;
  });

  const suspendedCount = sellers.filter(s => s.store_suspended).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Store className="h-6 w-6 text-blue-500" />
            {lbl('Vendedores e Lojas', 'Sellers & Stores', 'Vendedores y Tiendas')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lbl('Suspenda ou reative lojas de vendedores', 'Suspend or reactivate seller stores', 'Suspende o reactiva tiendas de vendedores')}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{sellers.length}</p>
            <p className="text-xs text-gray-500">{lbl('Total', 'Total', 'Total')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-red-500">{suspendedCount}</p>
            <p className="text-xs text-gray-500">{lbl('Suspensos', 'Suspended', 'Suspendidos')}</p>
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={lbl('Buscar por nome, usuário ou email...', 'Search by name, username or email...', 'Buscar por nombre, usuario o email...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {([
            { id: 'all', label: lbl('Todos', 'All', 'Todos') },
            { id: 'active', label: lbl('Ativos', 'Active', 'Activos') },
            { id: 'suspended', label: lbl('Suspensos', 'Suspended', 'Suspendidos') },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === f.id
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sellers list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {lbl('Vendedor', 'Seller', 'Vendedor')}
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {lbl('Produtos', 'Products', 'Productos')}
                </th>
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {lbl('Vendas', 'Sales', 'Ventas')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {lbl('Status', 'Status', 'Estado')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {lbl('Ações', 'Actions', 'Acciones')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSellers.map((seller) => {
                const stats = statsMap[seller.id];
                const isSuspended = !!seller.store_suspended;
                const isExpanded = expandedRow === seller.id;
                return (
                  <React.Fragment key={seller.id}>
                    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isSuspended ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : seller.id)}
                          className="flex items-center gap-3 text-left"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                            {seller.avatar_url ? (
                              <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (seller.full_name?.[0] || seller.username?.[0] || '?').toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {seller.full_name || seller.username || lbl('Sem nome', 'No name', 'Sin nombre')}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {seller.username ? `@${seller.username}` : seller.email || '-'}
                            </p>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        </button>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {stats ? (
                          <span>{stats.activeProductCount} <span className="text-gray-400">/ {stats.productCount}</span></span>
                        ) : '...'}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {stats?.totalSales ?? '...'}
                      </td>
                      <td className="px-4 py-3">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <Ban className="h-3 w-3" />
                            {lbl('Suspenso', 'Suspended', 'Suspendido')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="h-3 w-3" />
                            {lbl('Ativo', 'Active', 'Activo')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isSuspended ? (
                            <button
                              onClick={() => handleUnsuspend(seller)}
                              disabled={actionLoading === seller.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === seller.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                              {lbl('Reativar', 'Reactivate', 'Reactivar')}
                            </button>
                          ) : (
                            <button
                              onClick={() => { setSuspendModal(seller); setSuspendReason(''); }}
                              disabled={actionLoading === seller.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              {lbl('Suspender', 'Suspend', 'Suspender')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-700/20">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">{lbl('Email', 'Email', 'Email')}</p>
                              <p className="text-gray-900 dark:text-white truncate">{seller.email || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{lbl('Slug da loja', 'Store slug', 'Slug tienda')}</p>
                              <p className="text-gray-900 dark:text-white truncate">{seller.seller_slug || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{lbl('Nível vendedor', 'Seller level', 'Nivel vendedor')}</p>
                              <p className="text-gray-900 dark:text-white">{seller.seller_level ?? 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{lbl('Cadastro', 'Registered', 'Registro')}</p>
                              <p className="text-gray-900 dark:text-white">{new Date(seller.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES')}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredSellers.length === 0 && (
          <div className="text-center py-12">
            <Store className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{lbl('Nenhum vendedor encontrado', 'No sellers found', 'No se encontraron vendedores')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {lbl('Ajuste a busca ou o filtro', 'Adjust the search or filter', 'Ajusta la búsqueda o el filtro')}
            </p>
          </div>
        )}
      </div>

      {/* Suspend modal */}
      {suspendModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSuspendModal(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {lbl('Suspender Loja', 'Suspend Store', 'Suspender Tienda')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {suspendModal.full_name || suspendModal.username}
                  </p>
                </div>
                <button onClick={() => setSuspendModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {lbl(
                    'O vendedor não poderá criar, editar ou excluir produtos, nem receber novas vendas. Ele continua podendo comprar de outros vendedores e acessar a conta. A loja pode ser reativada a qualquer momento.',
                    'The seller won\'t be able to create, edit, or delete products, or receive new sales. They can still buy from other sellers and access their account. The store can be reactivated at any time.',
                    'El vendedor no podrá crear, editar ni eliminar productos, ni recibir nuevas ventas. Todavía podrá comprar de otros vendedores y acceder a su cuenta. La tienda puede reactivarse en cualquier momento.'
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {lbl('Motivo (opcional)', 'Reason (optional)', 'Motivo (opcional)')}
                </label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={3}
                  placeholder={lbl('Descreva o motivo da suspensão...', 'Describe the reason for suspension...', 'Describe el motivo de la suspensión...')}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setSuspendModal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {lbl('Cancelar', 'Cancel', 'Cancelar')}
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={actionLoading === suspendModal.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === suspendModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  {lbl('Confirmar Suspensão', 'Confirm Suspension', 'Confirmar Suspensión')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-in fade-in slide-in-from-bottom-4">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
