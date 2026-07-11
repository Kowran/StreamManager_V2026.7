import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { Tag, Plus, Pencil, Trash2, X, Check, AlertCircle, Loader, Copy, Percent, DollarSign, Calendar, Package } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  max_uses_per_user: number;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export function AdminCouponsManager() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<{id: string; name: string}[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [couponProductCounts, setCouponProductCounts] = useState<Record<string, number>>({});

  const lang = language as 'pt' | 'en' | 'es';

  const t = {
    pt: {
      title: 'Cupons de Desconto', desc: 'Crie e gerencie cupons de desconto para os clientes',
      new: 'Novo Cupom', code: 'Codigo', description: 'Descricao', discountType: 'Tipo de Desconto',
      discountValue: 'Valor do Desconto', minOrder: 'Pedido Minimo (USDT)', maxUses: 'Usos Maximos (total)',
      maxUsesPerUser: 'Usos por Usuario', startsAt: 'Inicio', expiresAt: 'Expira em',
      active: 'Ativo', save: 'Salvar', cancel: 'Cancelar', edit: 'Editar', delete: 'Excluir',
      confirmDelete: 'Excluir este cupom?', noCoupons: 'Nenhum cupom criado ainda',
      percentage: 'Percentual (%)', fixed: 'Valor Fixo (USDT)', used: 'usado', uses: 'usos',
      statusActive: 'Ativo', statusInactive: 'Inativo', statusExpired: 'Expirado',
      noLimit: 'Sem limite', generateCode: 'Gerar Codigo', copyCode: 'Copiar codigo',
      copied: 'Copiado!', codePlaceholder: 'Ex: DESCONTO10', descPlaceholder: 'Descricao interna do cupom',
      activeCoupons: 'Cupons ativos', totalCoupons: 'Total de cupons', totalSavings: 'Desconto total concedido',
      validations: 'O cupom sera validado no momento da compra. Codigo nao diferencia maiusculas de minusculas.',
      applicableProducts: 'Produtos aplicaveis',
      allProducts: 'Todos os produtos',
      selectProducts: 'Selecionar produtos especificos',
      noProductsSelected: 'Aplicavel a todos os produtos',
      productsSelected: 'produtos selecionados',
    },
    en: {
      title: 'Discount Coupons', desc: 'Create and manage discount coupons for customers',
      new: 'New Coupon', code: 'Code', description: 'Description', discountType: 'Discount Type',
      discountValue: 'Discount Value', minOrder: 'Min Order (USDT)', maxUses: 'Max Uses (total)',
      maxUsesPerUser: 'Uses per User', startsAt: 'Starts At', expiresAt: 'Expires At',
      active: 'Active', save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete',
      confirmDelete: 'Delete this coupon?', noCoupons: 'No coupons created yet',
      percentage: 'Percentage (%)', fixed: 'Fixed Amount (USDT)', used: 'used', uses: 'uses',
      statusActive: 'Active', statusInactive: 'Inactive', statusExpired: 'Expired',
      noLimit: 'No limit', generateCode: 'Generate Code', copyCode: 'Copy code',
      copied: 'Copied!', codePlaceholder: 'Ex: DISCOUNT10', descPlaceholder: 'Internal description of the coupon',
      activeCoupons: 'Active coupons', totalCoupons: 'Total coupons', totalSavings: 'Total discount given',
      validations: 'Coupon is validated at checkout. Code is case-insensitive.',
      applicableProducts: 'Applicable products',
      allProducts: 'All products',
      selectProducts: 'Select specific products',
      noProductsSelected: 'Applies to all products',
      productsSelected: 'products selected',
    },
    es: {
      title: 'Cupones de Descuento', desc: 'Crea y gestiona cupones de descuento para clientes',
      new: 'Nuevo Cupon', code: 'Codigo', description: 'Descripcion', discountType: 'Tipo de Descuento',
      discountValue: 'Valor del Descuento', minOrder: 'Pedido Minimo (USDT)', maxUses: 'Usos Maximos (total)',
      maxUsesPerUser: 'Usos por Usuario', startsAt: 'Inicio', expiresAt: 'Expira el',
      active: 'Activo', save: 'Guardar', cancel: 'Cancelar', edit: 'Editar', delete: 'Eliminar',
      confirmDelete: '¿Eliminar este cupon?', noCoupons: 'No hay cupones creados aun',
      percentage: 'Porcentaje (%)', fixed: 'Monto Fijo (USDT)', used: 'usado', uses: 'usos',
      statusActive: 'Activo', statusInactive: 'Inactivo', statusExpired: 'Expirado',
      noLimit: 'Sin limite', generateCode: 'Generar Codigo', copyCode: 'Copiar codigo',
      copied: '¡Copiado!', codePlaceholder: 'Ej: DESCUENTO10', descPlaceholder: 'Descripcion interna del cupon',
      activeCoupons: 'Cupones activos', totalCoupons: 'Cupones totales', totalSavings: 'Descuento total otorgado',
      validations: 'El cupon se valida al comprar. El codigo no distingue mayusculas de minusculas.',
      applicableProducts: 'Productos aplicables',
      allProducts: 'Todos los productos',
      selectProducts: 'Seleccionar productos especificos',
      noProductsSelected: 'Aplicable a todos los productos',
      productsSelected: 'productos seleccionados',
    },
  }[lang];

  const emptyForm = {
    code: '', description: '', discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 10, min_order_amount: 0, max_uses: '' as string, max_uses_per_user: 1,
    starts_at: '', expires_at: '', active: true,
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchCoupons(); }, []);

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('id, name')
        .eq('active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      setAvailableProducts(data || []);
    } catch (err: any) {
      console.error('Error fetching products:', err.message);
    }
  }

  async function fetchCouponProductCounts(couponIds: string[]) {
    if (couponIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('coupon_products')
        .select('coupon_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.coupon_id] = (counts[row.coupon_id] || 0) + 1;
      });
      setCouponProductCounts(counts);
    } catch (err: any) {
      console.error('Error fetching coupon product counts:', err.message);
    }
  }

  async function fetchCoupons() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('discount_coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCoupons(data || []);
      await fetchCouponProductCounts((data || []).map((c: Coupon) => c.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setSelectedProductIds([]);
    setError(null);
    setShowModal(true);
    fetchProducts();
  }

  async function openEdit(coupon: Coupon) {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      min_order_amount: Number(coupon.min_order_amount),
      max_uses: coupon.max_uses ? String(coupon.max_uses) : '',
      max_uses_per_user: coupon.max_uses_per_user,
      starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 16) : '',
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 16) : '',
      active: coupon.active,
    });
    setError(null);
    setShowModal(true);
    await fetchProducts();
    try {
      const { data: existing } = await supabase
        .from('coupon_products')
        .select('product_id')
        .eq('coupon_id', coupon.id);
      setSelectedProductIds((existing || []).map((r: any) => r.product_id));
    } catch {
      setSelectedProductIds([]);
    }
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, code }));
  }

  async function handleSave() {
    if (!form.code.trim()) {
      setError(lang === 'pt' ? 'O codigo e obrigatorio' : lang === 'en' ? 'Code is required' : 'El codigo es obligatorio');
      return;
    }
    if (form.discount_value <= 0) {
      setError(lang === 'pt' ? 'O valor do desconto deve ser maior que zero' : lang === 'en' ? 'Discount value must be greater than zero' : 'El valor del descuento debe ser mayor que cero');
      return;
    }
    if (form.discount_type === 'percentage' && form.discount_value > 100) {
      setError(lang === 'pt' ? 'Percentual nao pode exceder 100%' : lang === 'en' ? 'Percentage cannot exceed 100%' : 'El porcentaje no puede exceder 100%');
      return;
    }

    setSaving(true);
    setError(null);

    const payload: any = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      min_order_amount: form.min_order_amount || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      max_uses_per_user: form.max_uses_per_user,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: form.active,
    };

    if (user) payload.created_by = user.id;

    try {
      let couponId = editing?.id;
      if (editing) {
        const { error } = await supabase
          .from('discount_coupons')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('discount_coupons')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        couponId = inserted.id;
      }

      // Sync coupon_products associations
      if (couponId) {
        await supabase.from('coupon_products').delete().eq('coupon_id', couponId);
        if (selectedProductIds.length > 0) {
          const rows = selectedProductIds.map(pid => ({ coupon_id: couponId, product_id: pid }));
          const { error: cpError } = await supabase.from('coupon_products').insert(rows);
          if (cpError) console.error('Error saving coupon products:', cpError.message);
        }
      }

      setShowModal(false);
      await fetchCoupons();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.confirmDelete)) return;
    try {
      const { error } = await supabase.from('discount_coupons').delete().eq('id', id);
      if (error) throw error;
      await fetchCoupons();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function getCouponStatus(coupon: Coupon): 'active' | 'inactive' | 'expired' {
    if (!coupon.active) return 'inactive';
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return 'expired';
    return 'active';
  }

  function formatDate(date: string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const activeCount = coupons.filter(c => getCouponStatus(c) === 'active').length;
  const totalSavings = coupons.reduce((sum, c) => sum + 0, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t.desc}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors font-medium"
        >
          <Plus className="h-5 w-5" />
          <span>{t.new}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t.activeCoupons}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3">
              <Tag className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{coupons.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t.totalCoupons}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3">
              <DollarSign className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {coupons.reduce((sum, c) => sum + c.used_count, 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t.used} ({t.uses})</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Coupons List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Tag className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t.noCoupons}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.code}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.discountType}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.discountValue}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.uses}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.expiresAt}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.active}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.edit}/{t.delete}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {coupons.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {coupon.code}
                          </code>
                          <button
                            onClick={() => { navigator.clipboard.writeText(coupon.code); }}
                            className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title={t.copyCode}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        {coupon.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{coupon.description}</p>
                        )}
                        {(couponProductCounts[coupon.id] || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            <Package className="h-2.5 w-2.5" />
                            {couponProductCounts[coupon.id]} {t.productsSelected}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {coupon.discount_type === 'percentage' ? <Percent className="h-3 w-3 mr-1" /> : <DollarSign className="h-3 w-3 mr-1" />}
                          {coupon.discount_type === 'percentage' ? t.percentage : t.fixed}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {coupon.discount_type === 'percentage'
                            ? `${Number(coupon.discount_value)}%`
                            : `$${Number(coupon.discount_value).toFixed(2)}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {coupon.used_count} / {coupon.max_uses ?? t.noLimit}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(coupon.expires_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : status === 'expired'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {status === 'active' ? t.statusActive : status === 'expired' ? t.statusExpired : t.statusInactive}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(coupon)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title={t.edit}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(coupon.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title={t.delete}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300">{t.validations}</p>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? t.edit : t.new}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t.code} *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder={t.codePlaceholder}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono font-bold"
                  />
                  <button
                    onClick={generateCode}
                    type="button"
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    {t.generateCode}
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t.description}
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t.descPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t.discountType}
                  </label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm(f => ({ ...f, discount_type: e.target.value as 'percentage' | 'fixed' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="percentage">{t.percentage}</option>
                    <option value="fixed">{t.fixed}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t.discountValue} *
                  </label>
                  <div className="relative">
                    {form.discount_type === 'percentage' ? (
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    ) : (
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    )}
                    <input
                      type="number"
                      min="0"
                      step={form.discount_type === 'percentage' ? '1' : '0.01'}
                      max={form.discount_type === 'percentage' ? '100' : undefined}
                      value={form.discount_value}
                      onChange={(e) => setForm(f => ({ ...f, discount_value: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${form.discount_type === 'fixed' ? 'pl-9' : 'pr-9'}`}
                    />
                  </div>
                </div>
              </div>

              {/* Min Order & Max Uses */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t.minOrder}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.min_order_amount}
                    onChange={(e) => setForm(f => ({ ...f, min_order_amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t.maxUses}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.max_uses}
                    onChange={(e) => setForm(f => ({ ...f, max_uses: e.target.value }))}
                    placeholder={t.noLimit}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Max Uses Per User */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t.maxUsesPerUser}
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.max_uses_per_user}
                  onChange={(e) => setForm(f => ({ ...f, max_uses_per_user: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t.startsAt}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm(f => ({ ...f, starts_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t.expiresAt}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) => setForm(f => ({ ...f, expires_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.active ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.active}</span>
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Package className="inline h-4 w-4 mr-1" />
                  {t.applicableProducts}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {selectedProductIds.length === 0 ? t.noProductsSelected : `${selectedProductIds.length} ${t.productsSelected}`}
                </p>
                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1 bg-white dark:bg-gray-700">
                  {availableProducts.length === 0 ? (
                    <p className="text-xs text-gray-400 p-2">{t.allProducts}</p>
                  ) : (
                    availableProducts.map(product => (
                      <label key={product.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProductIds(prev => [...prev, product.id]);
                            } else {
                              setSelectedProductIds(prev => prev.filter(id => id !== product.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{product.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {selectedProductIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds([])}
                    className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t.allProducts}
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{t.save}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
