import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Search, Ban, CheckCircle, Loader2, AlertTriangle, X,
  ShoppingBag, Eye, ChevronDown, ChevronUp, ShieldAlert, Gavel,
  RotateCcw, FileText, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AdminAPI } from '../lib/adminApi';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { SellerDetailModal } from './SellerDetailModal';

interface SellerProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  store_suspended: boolean | null;
  store_permanently_suspended: boolean | null;
  penalty_count: number | null;
  seller_slug: string | null;
  seller_level: number | null;
  created_at: string;
}

interface SellerStats {
  productCount: number;
  activeProductCount: number;
  totalSales: number;
}

interface PenaltyRecord {
  id: string;
  penalty_level: number;
  reason: string | null;
  applied_by: string | null;
  applied_at: string;
  reverted_by: string | null;
  reverted_at: string | null;
  revert_reason: string | null;
  is_active: boolean;
}

const PENALTY_CONFIG: Record<number, {
  label: { pt: string; en: string; es: string };
  shortLabel: { pt: string; en: string; es: string };
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
}> = {
  1: {
    label: { pt: 'Advertência', en: 'Warning', es: 'Advertencia' },
    shortLabel: { pt: 'Aviso', en: 'Warning', es: 'Aviso' },
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-300 dark:border-amber-700',
    icon: AlertTriangle,
  },
  2: {
    label: { pt: 'Suspensão', en: 'Suspension', es: 'Suspensión' },
    shortLabel: { pt: 'Suspenso', en: 'Suspended', es: 'Suspendido' },
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-300 dark:border-orange-700',
    icon: Ban,
  },
  3: {
    label: { pt: 'Suspensão Permanente', en: 'Permanent Suspension', es: 'Suspensión Permanente' },
    shortLabel: { pt: 'Permanente', en: 'Permanent', es: 'Permanente' },
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-300 dark:border-red-700',
    icon: ShieldAlert,
  },
};

export function AdminSellersStoresManager() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'penalized'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [penaltyModal, setPenaltyModal] = useState<SellerProfile | null>(null);
  const [penaltyLevel, setPenaltyLevel] = useState<1 | 2 | 3>(1);
  const [penaltyReason, setPenaltyReason] = useState('');
  const [revertModal, setRevertModal] = useState<SellerProfile | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [historyModal, setHistoryModal] = useState<SellerProfile | null>(null);
  const [penaltyHistory, setPenaltyHistory] = useState<PenaltyRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statsMap, setStatsMap] = useState<Record<string, SellerStats>>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<string | null>(null);
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
        .select('id, full_name, username, email, avatar_url, role, store_suspended, store_permanently_suspended, penalty_count, seller_slug, seller_level, created_at')
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

  async function loadPenaltyHistory(sellerId: string) {
    setHistoryLoading(true);
    try {
      const result = await AdminAPI.getPenalties(sellerId);
      if (result.success) {
        setPenaltyHistory(result.data?.penalties || []);
      }
    } catch (error) {
      console.error('Error loading penalty history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleApplyPenalty() {
    if (!penaltyModal || !user) return;
    setActionLoading(penaltyModal.id);
    try {
      const result = await AdminAPI.applyPenalty(penaltyModal.id, penaltyLevel, penaltyReason || undefined);
      if (!result.success) throw new Error(result.error || 'Failed');

      setSellers(prev => prev.map(s => {
        if (s.id !== penaltyModal.id) return s;
        const newCount = (s.penalty_count || 0) + 1;
        return {
          ...s,
          penalty_count: newCount,
          store_suspended: penaltyLevel >= 2 ? true : s.store_suspended,
          store_permanently_suspended: penaltyLevel === 3 ? true : s.store_permanently_suspended,
        };
      }));

      const config = PENALTY_CONFIG[penaltyLevel];
      setToast({
        type: 'success',
        message: lbl(
          `Punição Nível ${penaltyLevel} (${config.label.pt}) aplicada com sucesso`,
          `Level ${penaltyLevel} penalty (${config.label.en}) applied successfully`,
          `Penalización Nivel ${penaltyLevel} (${config.label.es}) aplicada con éxito`
        )
      });
      setPenaltyModal(null);
      setPenaltyReason('');
      setPenaltyLevel(1);
    } catch (error) {
      console.error('Error applying penalty:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setToast({ type: 'error', message: `${lbl('Erro ao aplicar punição', 'Error applying penalty', 'Error al aplicar penalización')}: ${errMsg}` });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevertPenalty() {
    if (!revertModal || !user) return;
    setActionLoading(revertModal.id);
    try {
      const result = await AdminAPI.revertPenalty(revertModal.id, revertReason || undefined);
      if (!result.success) throw new Error(result.error || 'Failed');

      setSellers(prev => prev.map(s => {
        if (s.id !== revertModal.id) return s;
        const newCount = Math.max(0, (s.penalty_count || 0) - 1);
        const wasPermanent = s.store_permanently_suspended;
        const wasSuspended = s.store_suspended;
        return {
          ...s,
          penalty_count: newCount,
          store_suspended: newCount >= 2 ? wasSuspended : false,
          store_permanently_suspended: newCount >= 3 ? wasPermanent : false,
        };
      }));

      setToast({
        type: 'success',
        message: lbl('Punição revertida com sucesso', 'Penalty reverted successfully', 'Penalización revertida con éxito')
      });
      setRevertModal(null);
      setRevertReason('');
    } catch (error) {
      console.error('Error reverting penalty:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setToast({ type: 'error', message: `${lbl('Erro ao reverter punição', 'Error reverting penalty', 'Error al revertir penalización')}: ${errMsg}` });
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
      filter === 'active' ? !s.store_suspended && !(s.penalty_count && s.penalty_count > 0) :
      filter === 'suspended' ? !!s.store_suspended :
      filter === 'penalized' ? !!(s.penalty_count && s.penalty_count > 0) : true;
    return matchesSearch && matchesFilter;
  });

  const suspendedCount = sellers.filter(s => s.store_suspended).length;
  const penalizedCount = sellers.filter(s => s.penalty_count && s.penalty_count > 0).length;

  function getPenaltyStatus(seller: SellerProfile): { level: number; label: string; color: string; bgColor: string; icon: typeof AlertTriangle } | null {
    const count = seller.penalty_count || 0;
    if (count === 0) return null;
    const level = seller.store_permanently_suspended ? 3 : seller.store_suspended ? 2 : 1;
    const config = PENALTY_CONFIG[level];
    return {
      level,
      label: lbl(config.label.pt, config.label.en, config.label.es),
      color: config.color,
      bgColor: config.bgColor,
      icon: config.icon,
    };
  }

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
            {lbl('Gerencie punições e suspensões de lojas', 'Manage store penalties and suspensions', 'Gestiona penalizaciones y suspensiones de tiendas')}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{sellers.length}</p>
            <p className="text-xs text-gray-500">{lbl('Total', 'Total', 'Total')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-amber-500">{penalizedCount}</p>
            <p className="text-xs text-gray-500">{lbl('Punidos', 'Penalized', 'Penalizados')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-red-500">{suspendedCount}</p>
            <p className="text-xs text-gray-500">{lbl('Suspensos', 'Suspended', 'Suspendidos')}</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">{lbl('Sistema de Punições - 3 Níveis', 'Penalty System - 3 Levels', 'Sistema de Penalizaciones - 3 Niveles')}</p>
            <ul className="space-y-0.5 text-xs">
              <li><b>{lbl('Nível 1', 'Level 1', 'Nivel 1')}</b> — {lbl('Advertência: o vendedor recebe um aviso visível no painel de reputação', 'Warning: seller receives a visible warning in reputation panel', 'Advertencia: el vendedor recibe un aviso visible en el panel de reputación')}</li>
              <li><b>{lbl('Nível 2', 'Level 2', 'Nivel 2')}</b> — {lbl('Suspensão: anúncios ocultados automaticamente e vendas suspensas', 'Suspension: listings auto-hidden and sales suspended', 'Suspensión: anuncios ocultados automáticamente y ventas suspendidas')}</li>
              <li><b>{lbl('Nível 3', 'Level 3', 'Nivel 3')}</b> — {lbl('Suspensão permanente: saldo congelado, saques bloqueados', 'Permanent suspension: balance frozen, withdrawals blocked', 'Suspensión permanente: saldo congelado, retiros bloqueados')}</li>
            </ul>
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
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-wrap">
          {([
            { id: 'all', label: lbl('Todos', 'All', 'Todos') },
            { id: 'active', label: lbl('Ativos', 'Active', 'Activos') },
            { id: 'penalized', label: lbl('Punidos', 'Penalized', 'Penalizados') },
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
                  {lbl('Punições', 'Penalties', 'Penalizaciones')}
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
                const penaltyStatus = getPenaltyStatus(seller);
                const isSuspended = !!seller.store_suspended;
                const isPermanent = !!seller.store_permanently_suspended;
                const isExpanded = expandedRow === seller.id;
                const penaltyCount = seller.penalty_count || 0;
                const PenaltyIcon = penaltyStatus?.icon || CheckCircle;
                return (
                  <React.Fragment key={seller.id}>
                    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                      isPermanent ? 'bg-red-50/50 dark:bg-red-900/10' :
                      isSuspended ? 'bg-orange-50/50 dark:bg-orange-900/10' :
                      penaltyCount > 0 ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''
                    }`}>
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
                        {penaltyCount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex gap-0.5">
                              {[1, 2, 3].map(n => (
                                <div
                                  key={n}
                                  className={`w-2 h-5 rounded-sm ${n <= penaltyCount ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                                />
                              ))}
                            </div>
                            <span className={`text-xs font-medium ${penaltyStatus?.color}`}>
                              {penaltyCount}/3
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">0/3</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {penaltyStatus ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${penaltyStatus.bgColor} ${penaltyStatus.color}`}>
                            <PenaltyIcon className="h-3 w-3" />
                            {penaltyStatus.label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="h-3 w-3" />
                            {lbl('Ativo', 'Active', 'Activo')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => setDetailModal(seller.id)}
                            disabled={actionLoading === seller.id}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
                            title={lbl('Ver Detalhes', 'View Details', 'Ver Detalles')}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setHistoryModal(seller); loadPenaltyHistory(seller.id); }}
                            disabled={actionLoading === seller.id}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                            title={lbl('Histórico', 'History', 'Historial')}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                          {penaltyCount > 0 && !isPermanent && (
                            <button
                              onClick={() => { setRevertModal(seller); setRevertReason(''); }}
                              disabled={actionLoading === seller.id}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                              title={lbl('Reverter Punição', 'Revert Penalty', 'Revertir Penalización')}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {penaltyCount > 0 && isPermanent && (
                            <button
                              onClick={() => { setRevertModal(seller); setRevertReason(''); }}
                              disabled={actionLoading === seller.id}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                              title={lbl('Reverter Punição', 'Revert Penalty', 'Revertir Penalización')}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {penaltyCount < 3 && (
                            <button
                              onClick={() => { setPenaltyModal(seller); setPenaltyReason(''); setPenaltyLevel(1); }}
                              disabled={actionLoading === seller.id}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                              title={lbl('Aplicar Punição', 'Apply Penalty', 'Aplicar Penalización')}
                            >
                              <Gavel className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-700/20">
                        <td colSpan={6} className="px-4 py-4">
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

      {/* Apply Penalty Modal */}
      {penaltyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPenaltyModal(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <Gavel className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {lbl('Aplicar Punição', 'Apply Penalty', 'Aplicar Penalización')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {penaltyModal.full_name || penaltyModal.username}
                  </p>
                </div>
                <button onClick={() => setPenaltyModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {lbl('Selecione o nível da punição. Você pode pular diretamente para qualquer nível.', 'Select the penalty level. You can skip directly to any level.', 'Selecciona el nivel de penalización. Puedes saltar directamente a cualquier nivel.')}
              </p>

              {/* Penalty Level Selector */}
              <div className="space-y-2">
                {([1, 2, 3] as const).map(level => {
                  const config = PENALTY_CONFIG[level];
                  const Icon = config.icon;
                  const isSelected = penaltyLevel === level;
                  const descriptions: Record<number, { pt: string; en: string; es: string }> = {
                    1: {
                      pt: 'Apenas um aviso. O vendedor vê a advertência no painel de reputação.',
                      en: 'Just a warning. The seller sees the warning in their reputation panel.',
                      es: 'Solo una advertencia. El vendedor ve el aviso en su panel de reputación.',
                    },
                    2: {
                      pt: 'Anúncios ocultados automaticamente. Vendas suspensas. A loja pode ser reativada.',
                      en: 'Listings auto-hidden. Sales suspended. The store can be reactivated.',
                      es: 'Anuncios ocultados automáticamente. Ventas suspendidas. La tienda puede reactivarse.',
                    },
                    3: {
                      pt: 'Suspensão permanente. Saldo congelado. Saques bloqueados. Irreversível parcialmente.',
                      en: 'Permanent suspension. Balance frozen. Withdrawals blocked.',
                      es: 'Suspensión permanente. Saldo congelado. Retiros bloqueados.',
                    },
                  };
                  return (
                    <button
                      key={level}
                      onClick={() => setPenaltyLevel(level)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? `${config.borderColor} ${config.bgColor}`
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                          <Icon className={`h-4.5 w-4.5 ${config.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400">NÍVEL {level}</span>
                            <span className={`text-sm font-bold ${config.color}`}>
                              {lbl(config.label.pt, config.label.en, config.label.es)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                            {lbl(descriptions[level].pt, descriptions[level].en, descriptions[level].es)}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? `${config.borderColor} ${config.bgColor}` : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <div className={`w-2.5 h-2.5 rounded-full ${config.color.replace('text-', 'bg-')}`} />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {lbl('Motivo', 'Reason', 'Motivo')}
                </label>
                <textarea
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  rows={3}
                  placeholder={lbl('Descreva o motivo da punição...', 'Describe the reason for the penalty...', 'Describe el motivo de la penalización...')}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setPenaltyModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {lbl('Cancelar', 'Cancel', 'Cancelar')}
              </button>
              <button
                onClick={handleApplyPenalty}
                disabled={actionLoading === penaltyModal.id}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === penaltyModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
                {lbl('Confirmar Punição', 'Confirm Penalty', 'Confirmar Penalización')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Penalty Modal */}
      {revertModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRevertModal(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {lbl('Reverter Punição', 'Revert Penalty', 'Revertir Penalización')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {revertModal.full_name || revertModal.username}
                  </p>
                </div>
                <button onClick={() => setRevertModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  {lbl(
                    'A punição mais recente será revertida. Se a loja estava suspensa, os anúncios serão reativados. Se o saldo estava congelado, será liberado.',
                    'The most recent penalty will be reverted. If the store was suspended, listings will be reactivated. If the balance was frozen, it will be released.',
                    'La penalización más reciente será revertida. Si la tienda estaba suspendida, los anuncios serán reactivados. Si el saldo estaba congelado, será liberado.'
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {lbl('Motivo da reversão (opcional)', 'Revert reason (optional)', 'Motivo de reversión (opcional)')}
                </label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  rows={3}
                  placeholder={lbl('Descreva o motivo da reversão...', 'Describe the reason for reverting...', 'Describe el motivo de la reversión...')}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setRevertModal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {lbl('Cancelar', 'Cancel', 'Cancelar')}
                </button>
                <button
                  onClick={handleRevertPenalty}
                  disabled={actionLoading === revertModal.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === revertModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {lbl('Confirmar Reversão', 'Confirm Revert', 'Confirmar Reversión')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Penalty History Modal */}
      {historyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setHistoryModal(null)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {lbl('Histórico de Punições', 'Penalty History', 'Historial de Penalizaciones')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {historyModal.full_name || historyModal.username}
                  </p>
                </div>
                <button onClick={() => setHistoryModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                </div>
              ) : penaltyHistory.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-10 w-10 text-green-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    {lbl('Nenhuma punição registrada', 'No penalties recorded', 'Ninguna penalización registrada')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {penaltyHistory.map((penalty) => {
                    const config = PENALTY_CONFIG[penalty.penalty_level];
                    const Icon = config.icon;
                    return (
                      <div key={penalty.id} className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                            <Icon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-bold ${config.color}`}>
                                {lbl(config.label.pt, config.label.en, config.label.es)}
                              </span>
                              <span className="text-xs text-gray-400">Nível {penalty.penalty_level}</span>
                              {penalty.is_active ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  {lbl('Ativa', 'Active', 'Activa')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  {lbl('Revertida', 'Reverted', 'Revertida')}
                                </span>
                              )}
                            </div>
                            {penalty.reason && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{penalty.reason}</p>
                            )}
                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
                              <Clock className="h-3 w-3" />
                              {new Date(penalty.applied_at).toLocaleString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES')}
                            </div>
                            {penalty.reverted_at && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-[10px] text-green-600 dark:text-green-400">
                                  {lbl('Revertida em', 'Reverted on', 'Revertida el')} {new Date(penalty.reverted_at).toLocaleString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES')}
                                </p>
                                {penalty.revert_reason && (
                                  <p className="text-xs text-gray-500 mt-0.5">{penalty.revert_reason}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seller Detail Modal */}
      {detailModal && (
        <SellerDetailModal sellerId={detailModal} onClose={() => setDetailModal(null)} />
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
