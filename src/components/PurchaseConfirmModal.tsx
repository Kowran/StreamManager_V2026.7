import React, { useState, useEffect } from 'react';
import { AlertCircle, X, ShoppingCart, Check, Tag, Loader, Percent, DollarSign, Mail, Lock, FileText, Zap, Phone } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { supabase } from '../lib/supabase';

interface PurchaseConfirmModalProps {
  isOpen: boolean;
  product: {
    id: string;
    name: string;
    price_usdt: number;
    image_url?: string;
    promotional_price_usdt?: number | null;
    promotion_active?: boolean;
    account_recharge?: boolean;
  };
  userBalance: number;
  cashbackBalance?: number;
  onConfirm: (couponCode?: string, rechargeData?: { email: string; password: string; extra_data: string }, useCashback?: boolean, quantity?: number, customerContact?: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface CouponValidation {
  valid: boolean;
  error?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  finalPrice?: number;
  minOrderAmount?: number;
}

export function PurchaseConfirmModal({
  isOpen,
  product,
  userBalance,
  cashbackBalance = 0,
  onConfirm,
  onCancel,
  isLoading = false
}: PurchaseConfirmModalProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; finalPrice: number; discountType: string; discountValue: number } | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [rechargeEmail, setRechargeEmail] = useState('');
  const [rechargePassword, setRechargePassword] = useState('');
  const [rechargeExtraData, setRechargeExtraData] = useState('');
  const [rechargeError, setRechargeError] = useState<string | null>(null);
  const [useCashback, setUseCashback] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [customerContact, setCustomerContact] = useState('');
  const [savedPhone, setSavedPhone] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('phone_number').eq('id', (await supabase.auth.getUser()).data.user?.id).maybeSingle();
      if (data?.phone_number) {
        setSavedPhone(data.phone_number);
        setCustomerContact(data.phone_number);
      }
    })();
  }, []);

  const hasPromo = product.promotion_active && product.promotional_price_usdt;
  const basePrice = hasPromo ? Number(product.promotional_price_usdt) : product.price_usdt;
  const unitPrice = basePrice;
  const totalPrice = unitPrice * quantity;
  const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount * quantity : 0;
  const priceAfterCoupon = appliedCoupon ? appliedCoupon.finalPrice * quantity : totalPrice;
  const cashbackToUse = useCashback ? Math.min(cashbackBalance, priceAfterCoupon) : 0;
  const effectivePrice = Math.max(0, priceAfterCoupon - cashbackToUse);
  const remainingBalance = userBalance - effectivePrice;

  const isAccountRecharge = product.account_recharge === true;

  if (!isOpen) return null;

  async function validateCoupon() {
    if (!couponCode.trim()) return;

    setValidating(true);
    setValidationError(null);
    setAppliedCoupon(null);

    try {
      const code = couponCode.trim().toUpperCase();
      const { data: coupon, error } = await supabase
        .from('discount_coupons')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (error || !coupon) {
        setValidationError(t.language === 'pt' ? 'Cupom invalido ou nao encontrado' : t.language === 'en' ? 'Invalid or not found coupon' : 'Cupon invalido o no encontrado');
        return;
      }

      if (!coupon.active) {
        setValidationError(t.language === 'pt' ? 'Este cupom esta inativo' : t.language === 'en' ? 'This coupon is inactive' : 'Este cupon esta inactivo');
        return;
      }

      if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
        setValidationError(t.language === 'pt' ? 'Este cupom ainda nao esta disponivel' : t.language === 'en' ? 'This coupon is not yet available' : 'Este cupon aun no esta disponible');
        return;
      }

      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        setValidationError(t.language === 'pt' ? 'Este cupom expirou' : t.language === 'en' ? 'This coupon has expired' : 'Este cupon ha expirado');
        return;
      }

      if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
        setValidationError(t.language === 'pt' ? 'Este cupom atingiu o limite de usos' : t.language === 'en' ? 'This coupon has reached its usage limit' : 'Este cupon ha alcanzado el limite de usos');
        return;
      }

      if (coupon.min_order_amount && basePrice < Number(coupon.min_order_amount)) {
        setValidationError(
          (t.language === 'pt' ? `Pedido minimo de $${Number(coupon.min_order_amount).toFixed(2)}` :
           t.language === 'en' ? `Minimum order of $${Number(coupon.min_order_amount).toFixed(2)}` :
           `Pedido minimo de $${Number(coupon.min_order_amount).toFixed(2)}`)
        );
        return;
      }

      // Check product-specific coupon
      const { data: couponProducts } = await supabase
        .from('coupon_products')
        .select('product_id')
        .eq('coupon_id', coupon.id);

      if (couponProducts && couponProducts.length > 0) {
        const isAllowed = couponProducts.some((cp: any) => cp.product_id === product.id);
        if (!isAllowed) {
          setValidationError(
            t.language === 'pt' ? 'Este cupom nao e valido para este produto' :
            t.language === 'en' ? 'This coupon is not valid for this product' :
            'Este cupon no es valido para este producto'
          );
          return;
        }
      }

      // Calculate discount
      let discountAmount: number;
      if (coupon.discount_type === 'percentage') {
        discountAmount = basePrice * (Number(coupon.discount_value) / 100);
      } else {
        discountAmount = Math.min(Number(coupon.discount_value), basePrice);
      }
      discountAmount = Math.round(discountAmount * 100) / 100;

      if (discountAmount <= 0) {
        setValidationError(t.language === 'pt' ? 'Desconto do cupom e zero' : t.language === 'en' ? 'Coupon discount is zero' : 'El descuento del cupon es cero');
        return;
      }

      const finalPrice = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);

      setAppliedCoupon({
        code: coupon.code,
        discountAmount,
        finalPrice,
        discountType: coupon.discount_type,
        discountValue: Number(coupon.discount_value),
      });
    } catch {
      setValidationError(t.language === 'pt' ? 'Erro ao validar cupom' : t.language === 'en' ? 'Error validating coupon' : 'Error al validar cupon');
    } finally {
      setValidating(false);
    }
  }

  function removeCoupon() {
    setCouponCode('');
    setAppliedCoupon(null);
    setValidationError(null);
  }

  function handleConfirm() {
    if (isAccountRecharge) {
      if (!rechargeEmail.trim() || !rechargePassword.trim()) {
        setRechargeError(
          t.language === 'pt' ? 'Email e senha sao obrigatorios' :
          t.language === 'en' ? 'Email and password are required' :
          'Email y contrasena son obligatorios'
        );
        return;
      }
      setRechargeError(null);
      onConfirm(appliedCoupon?.code || undefined, {
        email: rechargeEmail.trim(),
        password: rechargePassword.trim(),
        extra_data: rechargeExtraData.trim(),
      }, useCashback, quantity);
    } else {
      onConfirm(appliedCoupon?.code || undefined, undefined, useCashback, quantity, customerContact.trim() || undefined);
    }
  }

  const canConfirm = isAccountRecharge
    ? !isLoading && remainingBalance >= 0 && rechargeEmail.trim() && rechargePassword.trim() && customerContact.trim()
    : !isLoading && remainingBalance >= 0 && customerContact.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t.language === 'pt' ? 'Confirmar Compra' : t.language === 'en' ? 'Confirm Purchase' : 'Confirmar Compra'}
              </h3>
            </div>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            {product.image_url && (
              <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Customer Contact */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  {t.language === 'pt' ? 'Contato (WhatsApp/Telefone)' : t.language === 'en' ? 'Contact (WhatsApp/Phone)' : 'Contacto (WhatsApp/Teléfono)'}
                </p>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                {t.language === 'pt' ? 'Necessário para que o vendedor possa entrar em contato sobre sua entrega.' : t.language === 'en' ? 'Required so the seller can contact you about your delivery.' : 'Necesario para que el vendedor pueda contactarte sobre tu entrega.'}
              </p>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  placeholder={t.language === 'pt' ? '+55 11 99999-9999' : t.language === 'en' ? '+1 555 123-4567' : '+34 600 123 456'}
                  disabled={isLoading}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                />
              </div>
              {savedPhone && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {t.language === 'pt' ? 'Pré-preenchido com seu telefone cadastrado' : t.language === 'en' ? 'Pre-filled with your registered phone' : 'Precargado con tu telefono registrado'}
                </p>
              )}
            </div>

            {/* Account Recharge Form */}
            {isAccountRecharge && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    {t.language === 'pt' ? 'Dados da Conta para Recarga' :
                     t.language === 'en' ? 'Account Data for Recharge' :
                     'Datos de la Cuenta para Recarga'}
                  </p>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t.language === 'pt' ? 'Forneca os dados da conta que sera recarregada. A entrega sera confirmada manualmente pelo administrador.' :
                   t.language === 'en' ? 'Provide the account credentials to be recharged. Delivery will be confirmed manually by the administrator.' :
                   'Proporcione los datos de la cuenta que sera recargada. La entrega sera confirmada manualmente por el administrador.'}
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.language === 'pt' ? 'Email da conta *' : t.language === 'en' ? 'Account email *' : 'Email de la cuenta *'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={rechargeEmail}
                      onChange={(e) => { setRechargeEmail(e.target.value); setRechargeError(null); }}
                      placeholder="email@exemplo.com"
                      disabled={isLoading}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.language === 'pt' ? 'Senha da conta *' : t.language === 'en' ? 'Account password *' : 'Contrasena de la cuenta *'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={rechargePassword}
                      onChange={(e) => { setRechargePassword(e.target.value); setRechargeError(null); }}
                      placeholder="********"
                      disabled={isLoading}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.language === 'pt' ? 'Dados extras (opcional)' : t.language === 'en' ? 'Extra data (optional)' : 'Datos extras (opcional)'}
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <textarea
                      value={rechargeExtraData}
                      onChange={(e) => setRechargeExtraData(e.target.value)}
                      placeholder={t.language === 'pt' ? 'Perfil, PIN, observacoes...' : t.language === 'en' ? 'Profile, PIN, notes...' : 'Perfil, PIN, observaciones...'}
                      disabled={isLoading}
                      rows={2}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50 resize-none"
                    />
                  </div>
                </div>
                {rechargeError && (
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p className="text-xs">{rechargeError}</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {t.language === 'pt' ? 'Produto' : t.language === 'en' ? 'Product' : 'Producto'}
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {product.name}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                {/* Original Price */}
                {/* Quantity Selector */}
                {!product.manual_delivery && (
                  <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t.language === 'pt' ? 'Quantidade:' : t.language === 'en' ? 'Quantity:' : 'Cantidad:'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-bold"
                      >−</button>
                      <span className="w-10 text-center text-sm font-bold text-gray-900 dark:text-white">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-bold"
                      >+</button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t.language === 'pt' ? 'Preço unitário:' : t.language === 'en' ? 'Unit price:' : 'Precio unitario:'}
                  </span>
                  <div className="flex items-center gap-2">
                    {hasPromo && (
                      <span className="text-sm text-gray-400 line-through">
                        {formatPrice(product.price_usdt)}
                      </span>
                    )}
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatPrice(basePrice)}
                    </span>
                  </div>
                </div>

                {quantity > 1 && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t.language === 'pt' ? 'Total (' + quantity + 'x):' : t.language === 'en' ? 'Total (' + quantity + 'x):' : 'Total (' + quantity + 'x):'}
                    </span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                )}

                {/* Coupon Discount */}
                {appliedCoupon && (
                  <div className="flex items-center justify-between mb-3 animate-in fade-in slide-in-from-top-2">
                    <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <Tag className="h-4 w-4" />
                      {t.language === 'pt' ? `Cupom ${appliedCoupon.code}` : t.language === 'en' ? `Coupon ${appliedCoupon.code}` : `Cupon ${appliedCoupon.code}`}
                      <span className="text-xs">
                        ({appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}%` : `$${appliedCoupon.discountValue.toFixed(2)}`})
                      </span>
                    </span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      -{formatPrice(appliedCoupon.discountAmount)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t.language === 'pt' ? 'Saldo Atual:' : t.language === 'en' ? 'Current Balance:' : 'Saldo Actual:'}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatPrice(userBalance)}
                  </span>
                </div>

                {/* Cashback Toggle */}
                {cashbackBalance > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                          {t.language === 'pt' ? 'Usar Cashback' : t.language === 'en' ? 'Use Cashback' : 'Usar Cashback'}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {t.language === 'pt' ? `Disponível: ${formatPrice(cashbackBalance)}` : t.language === 'en' ? `Available: ${formatPrice(cashbackBalance)}` : `Disponible: ${formatPrice(cashbackBalance)}`}
                          {useCashback && cashbackToUse > 0 && ` · ${t.language === 'pt' ? 'Aplicado' : t.language === 'en' ? 'Applied' : 'Aplicado'}: -${formatPrice(cashbackToUse)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseCashback(!useCashback)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-2 ${
                          useCashback ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useCashback ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t.language === 'pt' ? 'Total a Pagar:' : t.language === 'en' ? 'Total to Pay:' : 'Total a Pagar:'}
                  </span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatPrice(effectivePrice)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t.language === 'pt' ? 'Saldo Apos:' : t.language === 'en' ? 'Balance After:' : 'Saldo Despues:'}
                  </span>
                  <span className={`text-lg font-bold ${
                    remainingBalance >= 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatPrice(remainingBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Coupon Input */}
            {!appliedCoupon ? (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.language === 'pt' ? 'Tem um cupom de desconto?' : t.language === 'en' ? 'Have a discount coupon?' : 'Tienes un cupon de descuento?'}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setValidationError(null);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && couponCode.trim() && !validating) validateCoupon(); }}
                      placeholder={t.language === 'pt' ? 'Digite o cupom' : t.language === 'en' ? 'Enter coupon code' : 'Ingresa el cupon'}
                      disabled={isLoading}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono font-medium uppercase disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={validateCoupon}
                    disabled={!couponCode.trim() || validating || isLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {validating ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>{t.language === 'pt' ? 'Aplicar' : t.language === 'en' ? 'Apply' : 'Aplicar'}</span>
                      </>
                    )}
                  </button>
                </div>
                {validationError && (
                  <div className="mt-2 flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <p className="text-xs">{validationError}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                      {t.language === 'pt' ? 'Cupom aplicado!' : t.language === 'en' ? 'Coupon applied!' : 'Cupon aplicado!'}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {appliedCoupon.code} - {t.language === 'pt' ? 'Desconto' : t.language === 'en' ? 'Discount' : 'Descuento'}: {formatPrice(appliedCoupon.discountAmount)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={removeCoupon}
                  disabled={isLoading}
                  className="text-green-600 dark:text-green-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {isAccountRecharge
                  ? (t.language === 'pt'
                      ? 'Apos a compra, o administrador ira recarregar sua conta e confirmara a entrega.'
                      : t.language === 'en'
                      ? 'After purchase, the administrator will recharge your account and confirm delivery.'
                      : 'Despues de la compra, el administrador recargara su cuenta y confirmara la entrega.')
                  : (t.language === 'pt'
                      ? 'Voce tem certeza que deseja comprar este produto?'
                      : t.language === 'en'
                      ? 'Are you sure you want to purchase this product?'
                      : 'Esta seguro de que desea comprar este producto?')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>
                    {t.language === 'pt' ? 'Processando...' : t.language === 'en' ? 'Processing...' : 'Procesando...'}
                  </span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>
                    {t.language === 'pt' ? 'Confirmar Compra' : t.language === 'en' ? 'Confirm Purchase' : 'Confirmar Compra'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
