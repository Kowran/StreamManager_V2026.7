import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Star, Package, ShoppingBag, TrendingUp, Calendar, Mail, User, Tag, AlertTriangle, Ban, ShieldAlert, CheckCircle, ToggleLeft, ToggleRight, Trash2, CreditCard as Edit3, Eye, ChevronRight, DollarSign, Award, MessageSquare, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

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
  balance_frozen: boolean | null;
  bio: string | null;
  cover_url: string | null;
}

interface SellerProduct {
  id: string;
  name: string;
  description: string | null;
  price_brl: number;
  price_usdt: number;
  category: string | null;
  primary_category: string | null;
  image_url: string | null;
  stock_quantity: number;
  active: boolean;
  auto_delivery: boolean;
  manual_delivery: boolean;
  renewable: boolean;
  promotion_active: boolean;
  promotional_price_usdt: number | null;
  slug: string | null;
  created_at: string;
  is_featured: boolean;
  warranty_days: number | null;
  delivery_time: string | null;
}

interface RatingItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rater_name?: string | null;
  product_name?: string | null;
  source: 'user' | 'product';
}

interface SellerStats {
  productCount: number;
  activeProductCount: number;
  totalSales: number;
  totalRevenue: number;
  completedOrders: number;
}

type Tab = 'overview' | 'products' | 'reputation' | 'profile';

type ReputationTier = 'pessimo' | 'ruim' | 'medio' | 'bom' | 'muito_bom';

const TIER_CONFIG: Record<ReputationTier, { color: string; bgColor: string; textColor: string; label: { pt: string; en: string; es: string } }> = {
  pessimo: { color: '#dc2626', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400', label: { pt: 'Péssimo', en: 'Terrible', es: 'Pésimo' } },
  ruim: { color: '#f87171', bgColor: 'bg-red-50 dark:bg-red-900/20', textColor: 'text-red-500 dark:text-red-300', label: { pt: 'Ruim', en: 'Poor', es: 'Malo' } },
  medio: { color: '#eab308', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-700 dark:text-yellow-400', label: { pt: 'Médio', en: 'Average', es: 'Medio' } },
  bom: { color: '#4ade80', bgColor: 'bg-green-50 dark:bg-green-900/20', textColor: 'text-green-600 dark:text-green-400', label: { pt: 'Bom', en: 'Good', es: 'Bueno' } },
  muito_bom: { color: '#16a34a', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-500', label: { pt: 'Muito Bom', en: 'Very Good', es: 'Muy Bueno' } },
};

function getTierFromRating(avg: number): ReputationTier {
  if (avg <= 1) return 'pessimo';
  if (avg <= 2) return 'ruim';
  if (avg <= 3) return 'medio';
  if (avg <= 4) return 'bom';
  return 'muito_bom';
}

interface SellerDetailModalProps {
  sellerId: string;
  onClose: () => void;
}

export function SellerDetailModal({ sellerId, onClose }: SellerDetailModalProps) {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SellerProduct | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const tr = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    loadProfile();
  }, [sellerId]);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, avatar_url, role, store_suspended, store_permanently_suspended, penalty_count, seller_slug, seller_level, created_at, balance_frozen, bio, cover_url')
        .eq('id', sellerId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data as SellerProfile);

      const [pCount, aCount, sales, revenue] = await Promise.all([
        supabase.from('store_products').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId),
        supabase.from('store_products').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId).eq('active', true),
        supabase.from('store_orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId).in('status', ['completed', 'paid']),
        supabase.from('store_orders').select('price_usdt, quantity').eq('seller_id', sellerId).in('status', ['completed', 'paid']),
      ]);

      const rev = (revenue.data || []).reduce((sum: number, o: any) => sum + (Number(o.price_usdt) || 0) * (Number(o.quantity) || 1), 0);
      setStats({
        productCount: pCount.count || 0,
        activeProductCount: aCount.count || 0,
        totalSales: sales.count || 0,
        totalRevenue: rev,
        completedOrders: sales.count || 0,
      });
    } catch (err) {
      console.error('Error loading seller profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts((data || []) as SellerProduct[]);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setProductsLoading(false);
    }
  }

  async function loadRatings() {
    setRatingsLoading(true);
    try {
      const [userRatingsResult, productRatingsResult] = await Promise.all([
        supabase
          .from('user_ratings')
          .select('id, rating, comment, created_at, rater_user_id')
          .eq('rated_user_id', sellerId)
          .eq('rater_role', 'customer')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('store_products')
          .select('id, name')
          .eq('seller_id', sellerId),
      ]);

      const userRatings = (userRatingsResult.data || []).map((r: any) => ({
        ...r,
        source: 'user' as const,
        product_name: null,
      }));

      const productIds = (productRatingsResult.data || []).map((p: any) => p.id);
      const productNameMap: Record<string, string> = {};
      (productRatingsResult.data || []).forEach((p: any) => { productNameMap[p.id] = p.name; });

      let productRatings: RatingItem[] = [];
      if (productIds.length > 0) {
        const { data: prData } = await supabase
          .from('product_ratings')
          .select('id, rating, comment, created_at, product_id')
          .in('product_id', productIds)
          .order('created_at', { ascending: false })
          .limit(50);

        productRatings = (prData || []).map((r: any) => ({
          ...r,
          source: 'product' as const,
          product_name: productNameMap[r.product_id] || null,
        }));
      }

      const combined = [...userRatings, ...productRatings].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRatings(combined);
    } catch (err) {
      console.error('Error loading ratings:', err);
    } finally {
      setRatingsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'products' && products.length === 0 && !productsLoading) {
      loadProducts();
    }
    if (activeTab === 'reputation' && ratings.length === 0 && !ratingsLoading) {
      loadRatings();
    }
  }, [activeTab]);

  async function toggleProductActive(product: SellerProduct) {
    setActionLoading(product.id);
    try {
      const { error } = await supabase
        .from('store_products')
        .update({ active: !product.active, updated_at: new Date().toISOString() })
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, active: !p.active } : p));
      setToast({ type: 'success', message: product.active ? tr('Produto desativado', 'Product deactivated', 'Producto desactivado') : tr('Produto ativado', 'Product activated', 'Producto activado') });
    } catch (err) {
      console.error('Error toggling product:', err);
      setToast({ type: 'error', message: tr('Erro ao atualizar produto', 'Error updating product', 'Error al actualizar producto') });
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleFeatured(product: SellerProduct) {
    setActionLoading(product.id);
    try {
      const { error } = await supabase
        .from('store_products')
        .update({ is_featured: !product.is_featured, updated_at: new Date().toISOString() })
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_featured: !p.is_featured } : p));
      setToast({ type: 'success', message: product.is_featured ? tr('Destaque removido', 'Featured removed', 'Destacado removido') : tr('Produto destacado', 'Product featured', 'Producto destacado') });
    } catch (err) {
      console.error('Error toggling featured:', err);
      setToast({ type: 'error', message: tr('Erro ao atualizar', 'Error updating', 'Error al actualizar') });
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteProduct(product: SellerProduct) {
    setActionLoading(product.id);
    try {
      const { error } = await supabase
        .from('store_products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== product.id));
      setConfirmDelete(null);
      setToast({ type: 'success', message: tr('Produto excluído', 'Product deleted', 'Producto eliminado') });
    } catch (err) {
      console.error('Error deleting product:', err);
      setToast({ type: 'error', message: tr('Erro ao excluir produto', 'Error deleting product', 'Error al eliminar producto') });
    } finally {
      setActionLoading(null);
    }
  }

  async function saveProductEdit() {
    if (!editingProduct) return;
    setActionLoading(editingProduct.id);
    try {
      const { error } = await supabase
        .from('store_products')
        .update({
          name: editingProduct.name,
          description: editingProduct.description,
          price_brl: editingProduct.price_brl,
          price_usdt: editingProduct.price_usdt,
          stock_quantity: editingProduct.stock_quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProduct.id);

      if (error) throw error;

      setProducts(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
      setEditingProduct(null);
      setToast({ type: 'success', message: tr('Produto atualizado', 'Product updated', 'Producto actualizado') });
    } catch (err) {
      console.error('Error saving product:', err);
      setToast({ type: 'error', message: tr('Erro ao salvar', 'Error saving', 'Error al guardar') });
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const penaltyCount = profile.penalty_count || 0;
  const isSuspended = !!profile.store_suspended;
  const isPermanent = !!profile.store_permanently_suspended;
  const isFrozen = !!profile.balance_frozen;
  const currentPenaltyLevel = isPermanent ? 3 : isSuspended ? 2 : penaltyCount > 0 ? 1 : 0;

  const avgRating = ratings.length > 0 ? ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length : 0;
  const tier = getTierFromRating(avgRating);
  const tierConfig = TIER_CONFIG[tier];

  const tabs: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: 'overview', label: tr('Visão Geral', 'Overview', 'Resumen'), icon: TrendingUp },
    { id: 'products', label: tr('Produtos', 'Products', 'Productos'), icon: Package },
    { id: 'reputation', label: tr('Reputação', 'Reputation', 'Reputación'), icon: Star },
    { id: 'profile', label: tr('Perfil', 'Profile', 'Perfil'), icon: User },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header with cover */}
        <div className="relative h-28 bg-gradient-to-r from-blue-500 to-cyan-500 flex-shrink-0">
          {profile.cover_url && (
            <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
          )}
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profile summary */}
        <div className="px-6 pb-4 flex-shrink-0 -mt-12 relative">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 overflow-hidden ring-4 ring-white dark:ring-gray-800">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (profile.full_name?.[0] || profile.username?.[0] || '?').toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {profile.full_name || profile.username || tr('Sem nome', 'No name', 'Sin nombre')}
              </h2>
              <p className="text-sm text-gray-500 truncate">
                {profile.username ? `@${profile.username}` : profile.email}
              </p>
            </div>
            <div className="flex items-center gap-2 pb-1 flex-wrap">
              {isPermanent ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {tr('Suspenso Permanente', 'Permanent Suspension', 'Suspensión Permanente')}
                </span>
              ) : isSuspended ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <Ban className="h-3.5 w-3.5" />
                  {tr('Suspenso', 'Suspended', 'Suspendido')}
                </span>
              ) : penaltyCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {tr('Advertência', 'Warning', 'Advertencia')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {tr('Ativo', 'Active', 'Activo')}
                </span>
              )}
              {isFrozen && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {tr('Saldo Congelado', 'Balance Frozen', 'Saldo Congelado')}
                </span>
              )}
              {profile.seller_level != null && profile.seller_level > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <Award className="h-3.5 w-3.5" />
                  {tr('Nível', 'Level', 'Nivel')} {profile.seller_level}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 flex-shrink-0">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Package} label={tr('Produtos', 'Products', 'Productos')} value={stats?.productCount ?? '...'} sub={stats ? `${stats.activeProductCount} ${tr('ativos', 'active', 'activos')}` : undefined} color="blue" />
                <StatCard icon={ShoppingBag} label={tr('Vendas', 'Sales', 'Ventas')} value={stats?.totalSales ?? '...'} color="green" />
                <StatCard icon={DollarSign} label={tr('Receita (USDT)', 'Revenue (USDT)', 'Ingresos (USDT)')} value={stats ? stats.totalRevenue.toFixed(2) : '...'} color="emerald" />
                <StatCard icon={Star} label={tr('Avaliação', 'Rating', 'Valoración')} value={ratings.length > 0 ? avgRating.toFixed(1) : '—'} sub={ratings.length > 0 ? `${ratings.length} ${tr('avaliações', 'reviews', 'reseñas')}` : undefined} color="amber" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard title={tr('Informações da Loja', 'Store Info', 'Información de Tienda')}>
                  <InfoRow icon={Mail} label={tr('Email', 'Email', 'Email')} value={profile.email || '-'} />
                  <InfoRow icon={Tag} label={tr('Slug', 'Slug', 'Slug')} value={profile.seller_slug || '-'} />
                  <InfoRow icon={Award} label={tr('Nível', 'Level', 'Nivel')} value={String(profile.seller_level ?? 0)} />
                  <InfoRow icon={Calendar} label={tr('Cadastro', 'Registered', 'Registro')} value={new Date(profile.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES')} />
                </InfoCard>

                <InfoCard title={tr('Status e Penalidades', 'Status & Penalties', 'Estado y Penalizaciones')}>
                  <InfoRow icon={AlertTriangle} label={tr('Punições', 'Penalties', 'Penalizaciones')} value={`${penaltyCount}/3`} />
                  <InfoRow icon={Ban} label={tr('Suspenso', 'Suspended', 'Suspendido')} value={isSuspended ? tr('Sim', 'Yes', 'Sí') : tr('Não', 'No', 'No')} />
                  <InfoRow icon={ShieldAlert} label={tr('Permanente', 'Permanent', 'Permanente')} value={isPermanent ? tr('Sim', 'Yes', 'Sí') : tr('Não', 'No', 'No')} />
                  <InfoRow icon={AlertTriangle} label={tr('Saldo Congelado', 'Balance Frozen', 'Saldo Congelado')} value={isFrozen ? tr('Sim', 'Yes', 'Sí') : tr('Não', 'No', 'No')} />
                </InfoCard>
              </div>

              {profile.bio && (
                <InfoCard title={tr('Bio', 'Bio', 'Bio')}>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{profile.bio}</p>
                </InfoCard>
              )}
            </div>
          )}

          {/* PRODUCTS */}
          {activeTab === 'products' && (
            <div className="space-y-3">
              {productsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                  <p className="mt-2 text-sm text-gray-500">{tr('Nenhum produto', 'No products', 'Sin productos')}</p>
                </div>
              ) : (
                products.map(product => (
                  <div key={product.id} className={`rounded-xl border p-4 ${product.active ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'}`}>
                    {editingProduct?.id === product.id ? (
                      <div className="space-y-3">
                        <input
                          value={editingProduct.name}
                          onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <textarea
                          value={editingProduct.description || ''}
                          onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">BRL</label>
                            <input
                              type="number"
                              value={editingProduct.price_brl}
                              onChange={e => setEditingProduct({ ...editingProduct, price_brl: parseFloat(e.target.value) || 0 })}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">USDT</label>
                            <input
                              type="number"
                              value={editingProduct.price_usdt}
                              onChange={e => setEditingProduct({ ...editingProduct, price_usdt: parseFloat(e.target.value) || 0 })}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">{tr('Estoque', 'Stock', 'Stock')}</label>
                            <input
                              type="number"
                              value={editingProduct.stock_quantity}
                              onChange={e => setEditingProduct({ ...editingProduct, stock_quantity: parseInt(e.target.value) || 0 })}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveProductEdit}
                            disabled={actionLoading === product.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {actionLoading === product.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                            {tr('Salvar', 'Save', 'Guardar')}
                          </button>
                          <button
                            onClick={() => setEditingProduct(null)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                          >
                            {tr('Cancelar', 'Cancel', 'Cancelar')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-full h-full p-3 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</h4>
                            {product.is_featured && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <Award className="h-2.5 w-2.5" />
                                {tr('Destaque', 'Featured', 'Destacado')}
                              </span>
                            )}
                            {!product.active && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                {tr('Inativo', 'Inactive', 'Inactivo')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>R$ {product.price_brl.toFixed(2)}</span>
                            <span>·</span>
                            <span>${product.price_usdt.toFixed(2)}</span>
                            <span>·</span>
                            <span>{tr('Estoque', 'Stock', 'Stock')}: {product.stock_quantity}</span>
                            {product.category && (<><span>·</span><span>{product.category}</span></>)}
                          </div>
                          {product.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{product.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleFeatured(product)}
                            disabled={actionLoading === product.id}
                            title={tr('Destacar', 'Feature', 'Destacar')}
                            className={`p-1.5 rounded-lg transition-colors ${product.is_featured ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                          >
                            <Award className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleProductActive(product)}
                            disabled={actionLoading === product.id}
                            title={product.active ? tr('Desativar', 'Deactivate', 'Desactivar') : tr('Ativar', 'Activate', 'Activar')}
                            className={`p-1.5 rounded-lg transition-colors ${product.active ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                          >
                            {product.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setEditingProduct(product)}
                            disabled={actionLoading === product.id}
                            title={tr('Editar', 'Edit', 'Editar')}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(product)}
                            disabled={actionLoading === product.id}
                            title={tr('Excluir', 'Delete', 'Eliminar')}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* REPUTATION */}
          {activeTab === 'reputation' && (
            <div className="space-y-4">
              {ratingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 ${ratings.length > 0 ? tierConfig.bgColor : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <span className="text-3xl font-bold" style={{ color: ratings.length > 0 ? tierConfig.color : '#9ca3af' }}>
                          {ratings.length > 0 ? avgRating.toFixed(1) : '—'}
                        </span>
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${ratings.length > 0 ? tierConfig.textColor : 'text-gray-500'}`}>
                          {ratings.length > 0 ? tr(tierConfig.label.pt, tierConfig.label.en, tierConfig.label.es) : tr('Sem Avaliações', 'No Reviews', 'Sin Reseñas')}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {ratings.length > 0
                            ? tr(`${ratings.length} avaliações`, `${ratings.length} reviews`, `${ratings.length} reseñas`)
                            : tr('Nenhuma avaliação', 'No reviews yet', 'Aún sin reseñas')}
                        </p>
                        {ratings.length > 0 && (
                          <div className="flex items-center gap-0.5 mt-2">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star
                                key={n}
                                className={`h-4 w-4 ${n <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {ratings.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                      <p className="mt-2 text-sm text-gray-500">{tr('Nenhuma avaliação encontrada', 'No ratings found', 'Sin valoraciones')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ratings.map(rating => (
                        <div key={rating.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {[1, 2, 3, 4, 5].map(n => (
                                <Star
                                  key={n}
                                  className={`h-3.5 w-3.5 ${n <= rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                                />
                              ))}
                            </div>
                            <div className="flex-1 min-w-0">
                              {rating.comment && (
                                <p className="text-sm text-gray-700 dark:text-gray-300">{rating.comment}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                <span className={`px-1.5 py-0.5 rounded-full ${rating.source === 'user' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                                  {rating.source === 'user' ? tr('Cliente', 'Customer', 'Cliente') : tr('Produto', 'Product', 'Producto')}
                                </span>
                                {rating.product_name && (
                                  <span className="truncate">· {rating.product_name}</span>
                                )}
                                <span>·</span>
                                <Clock className="h-3 w-3" />
                                <span>{new Date(rating.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <InfoCard title={tr('Dados do Vendedor', 'Seller Data', 'Datos del Vendedor')}>
                <InfoRow icon={User} label={tr('Nome', 'Name', 'Nombre')} value={profile.full_name || '-'} />
                <InfoRow icon={User} label={tr('Usuário', 'Username', 'Usuario')} value={profile.username ? `@${profile.username}` : '-'} />
                <InfoRow icon={Mail} label={tr('Email', 'Email', 'Email')} value={profile.email || '-'} />
                <InfoRow icon={Tag} label={tr('Slug da Loja', 'Store Slug', 'Slug Tienda')} value={profile.seller_slug || '-'} />
                <InfoRow icon={Award} label={tr('Nível', 'Level', 'Nivel')} value={String(profile.seller_level ?? 0)} />
                <InfoRow icon={Calendar} label={tr('Cadastrado em', 'Registered on', 'Registrado el')} value={new Date(profile.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES')} />
              </InfoCard>

              {profile.bio && (
                <InfoCard title={tr('Bio', 'Bio', 'Bio')}>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{profile.bio}</p>
                </InfoCard>
              )}

              <InfoCard title={tr('Status da Loja', 'Store Status', 'Estado de Tienda')}>
                <InfoRow icon={AlertTriangle} label={tr('Contagem de Punições', 'Penalty Count', 'Conteo de Penalizaciones')} value={`${penaltyCount}/3`} />
                <InfoRow icon={Ban} label={tr('Loja Suspensa', 'Store Suspended', 'Tienda Suspendida')} value={isSuspended ? tr('Sim', 'Yes', 'Sí') : tr('Não', 'No', 'No')} />
                <InfoRow icon={ShieldAlert} label={tr('Suspensão Permanente', 'Permanent Suspension', 'Suspensión Permanente')} value={isPermanent ? tr('Sim', 'Yes', 'Sí') : tr('Não', 'No', 'No')} />
                <InfoRow icon={AlertTriangle} label={tr('Saldo Congelado', 'Balance Frozen', 'Saldo Congelado')} value={isFrozen ? tr('Sim', 'Yes', 'Sí') : tr('Não', 'No', 'No')} />
              </InfoCard>

              <InfoCard title={tr('Estatísticas', 'Statistics', 'Estadísticas')}>
                <InfoRow icon={Package} label={tr('Total de Produtos', 'Total Products', 'Total Productos')} value={String(stats?.productCount ?? '-')} />
                <InfoRow icon={CheckCircle} label={tr('Produtos Ativos', 'Active Products', 'Productos Activos')} value={String(stats?.activeProductCount ?? '-')} />
                <InfoRow icon={ShoppingBag} label={tr('Total de Vendas', 'Total Sales', 'Total Ventas')} value={String(stats?.totalSales ?? '-')} />
                <InfoRow icon={DollarSign} label={tr('Receita Total (USDT)', 'Total Revenue (USDT)', 'Ingresos Totales (USDT)')} value={stats ? stats.totalRevenue.toFixed(2) : '-'} />
              </InfoCard>
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{tr('Excluir Produto', 'Delete Product', 'Eliminar Producto')}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {tr('Tem certeza que deseja excluir', 'Are you sure you want to delete', '¿Estás seguro de que quieres eliminar')} "{confirmDelete.name}"?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {tr('Cancelar', 'Cancel', 'Cancelar')}
              </button>
              <button
                onClick={() => deleteProduct(confirmDelete)}
                disabled={actionLoading === confirmDelete.id}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === confirmDelete.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {tr('Excluir', 'Delete', 'Eliminar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70]">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Package;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${colorMap[color] || colorMap.blue}`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <span className="text-gray-500 flex-shrink-0">{label}:</span>
      <span className="text-gray-900 dark:text-white truncate">{value}</span>
    </div>
  );
}
