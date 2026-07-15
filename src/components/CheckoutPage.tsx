import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, CreditCard, Check, Lock, Shield, Loader, AlertCircle,
  CheckCircle, Package, ChevronRight, FileText, Wallet
} from 'lucide-react';
import { supabase, StoreProduct, ProductVariation } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { StripePaymentModal } from './StripePaymentModal';
import { PayPalPaymentModal } from './PayPalPaymentModal';
import { MercadoPagoPaymentModal } from './MercadoPagoPaymentModal';
import { WhatsAppPaymentModal } from './WhatsAppPaymentModal';
import { CryptomusPaymentModal } from './CryptomusPaymentModal';
import { BinancePaymentModal } from './BinancePaymentModal';
import { TripleAPaymentModal } from './TripleAPaymentModal';
import { AsaasPaymentModal } from './AsaasPaymentModal';

interface PaymentMethodConfig {
  method_id: string;
  name: string;
  is_active: boolean;
  status: 'active' | 'hidden' | 'inactive';
  display_order: number;
}

const PAYMENT_METHOD_META: Record<string, { icon: string; description: string; fees: string; processing_time: string; min_amount: number; max_amount: number }> = {
  stripe: { icon: 'https://i.imgur.com/Un7zfmo.png', description: 'Visa, Mastercard, American Express', fees: '3.9% + $0.30', processing_time: 'Instantâneo', min_amount: 1, max_amount: 1000 },
  paypal: { icon: 'https://i.imgur.com/VbyIdkc.png', description: 'PayPal, cartões internacionais', fees: '10% + $0.40', processing_time: 'Instantâneo', min_amount: 1, max_amount: 1000 },
  mercadopago: { icon: 'https://i.imgur.com/3oeBwGn.jpeg', description: 'PIX, cartão (Brasil)', fees: 'Sem taxas (PIX)', processing_time: 'Instantâneo', min_amount: 1, max_amount: 1000 },
  cryptomus: { icon: 'https://i.imgur.com/nXhq7ph.png', description: 'Criptomoedas diversas', fees: 'Sem taxas', processing_time: '5-15 minutos', min_amount: 1, max_amount: 5000 },
  binance: { icon: 'https://i.imgur.com/ylT9tJ1.png', description: 'Pagamento via Binance', fees: 'Sem taxas', processing_time: 'Instantâneo', min_amount: 1, max_amount: 10000 },
  whatsapp: { icon: 'https://i.imgur.com/Ei6JERR.png', description: 'Atendimento personalizado', fees: 'Sem taxas', processing_time: '2-24 horas', min_amount: 1, max_amount: 10000 },
  triplea: { icon: 'https://i.imgur.com/nXhq7ph.png', description: 'Bitcoin, Ethereum, USDC, USDT', fees: 'Sem taxas', processing_time: '5-15 minutos', min_amount: 1, max_amount: 5000 },
  asaas: { icon: 'https://i.imgur.com/3oeBwGn.jpeg', description: 'PIX, Boleto (Brasil)', fees: 'Sem taxas (PIX)', processing_time: 'Instantâneo', min_amount: 1, max_amount: 1000 },
};

interface CheckoutPageProps {
  productId: string;
  variationId?: string;
  quantity?: number;
  onBack: () => void;
  onSuccess: () => void;
}

type CheckoutStep = 'details' | 'processing' | 'success' | 'failed';

export function CheckoutPage({ productId, variationId, quantity = 1, onBack, onSuccess }: CheckoutPageProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [variation, setVariation] = useState<ProductVariation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMethods, setActiveMethods] = useState<PaymentMethodConfig[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [step, setStep] = useState<CheckoutStep>('details');
  const [errorMsg, setErrorMsg] = useState('');
  const [purchaseResult, setPurchaseResult] = useState<any>(null);
  const [userBalance, setUserBalance] = useState(0);

  const qty = Math.max(1, quantity);

  const loadProduct = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Produto não encontrado');
      setProduct(data);

      if (variationId) {
        const { data: vData } = await supabase
          .from('product_variations')
          .select('*')
          .eq('id', variationId)
          .maybeSingle();
        if (vData) setVariation(vData);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar produto');
    } finally {
      setLoading(false);
    }
  }, [productId, variationId]);

  const loadActiveMethods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods_config')
        .select('method_id, name, is_active, status, display_order')
        .eq('status', 'active')
        .order('display_order', { ascending: true });
      if (error) throw error;
      setActiveMethods(data || []);
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    }
  }, []);

  const loadBalance = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      setUserBalance(data?.balance || 0);
    } catch (err) {
      console.error('Error loading balance:', err);
    }
  }, [user]);

  useEffect(() => {
    loadProduct();
    loadActiveMethods();
    loadBalance();
  }, [loadProduct, loadActiveMethods, loadBalance]);

  if (!product) {
    return null;
  }

  const hasPromo = product?.promotion_active && product?.promotional_price_usdt;
  const unitPrice = variation
    ? Number(variation.price_usdt)
    : hasPromo
      ? Number(product!.promotional_price_usdt)
      : Number(product?.price_usdt ?? 0);
  const totalAmount = unitPrice * qty;
  const shortfall = Math.max(0, totalAmount - userBalance);

  function handleConfirmPayment() {
    if (!selectedMethod) return;
    if (!acceptedTerms) return;
    setShowPaymentModal(true);
  }

  async function handlePaymentSuccess() {
    setShowPaymentModal(false);
    setStep('processing');

    try {
      await loadBalance();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-store-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          product_id: productId,
          quantity: qty,
          variation_id: variationId || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Falha ao processar compra');
      }

      setPurchaseResult(result);
      setStep('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar compra após pagamento');
      setStep('failed');
    }
  }

  function handlePaymentError(err: string) {
    setErrorMsg(err || 'Pagamento falhou');
    setStep('failed');
    setShowPaymentModal(false);
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t.language === 'pt' ? 'Pagamento Aprovado!' : t.language === 'en' ? 'Payment Approved!' : '¡Pago Aprobado!'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {t.language === 'pt'
              ? 'Sua compra foi processada com sucesso. Você já pode acessar seu produto.'
              : t.language === 'en'
                ? 'Your purchase was processed successfully. You can now access your product.'
                : 'Tu compra fue procesada con éxito. Ya puedes acceder a tu producto.'}
          </p>
          <button
            onClick={onSuccess}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            {t.language === 'pt' ? 'Ver Minhas Compras' : t.language === 'en' ? 'View My Purchases' : 'Ver Mis Compras'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'failed') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t.language === 'pt' ? 'Pagamento Falhou' : t.language === 'en' ? 'Payment Failed' : 'Pago Fallido'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{errorMsg}</p>
          <div className="flex gap-3">
            <button
              onClick={() => { setStep('details'); setErrorMsg(''); }}
              className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
            >
              {t.language === 'pt' ? 'Tentar Novamente' : t.language === 'en' ? 'Try Again' : 'Intentar de Nuevo'}
            </button>
            <button
              onClick={onBack}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
            >
              {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t.language === 'pt' ? 'Processando seu pagamento...' : t.language === 'en' ? 'Processing your payment...' : 'Procesando tu pago...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.language === 'pt' ? 'Voltar ao produto' : t.language === 'en' ? 'Back to product' : 'Volver al producto'}
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
        <Package className="h-3.5 w-3.5" />
        <span>{t.language === 'pt' ? 'Loja' : t.language === 'en' ? 'Store' : 'Tienda'}</span>
        <ChevronRight className="h-3 w-3" />
        <span>{t.language === 'pt' ? 'Checkout' : t.language === 'en' ? 'Checkout' : 'Checkout'}</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t.language === 'pt' ? 'Finalizar Compra' : t.language === 'en' ? 'Checkout' : 'Finalizar Compra'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Product + Payment methods */}
        <div className="lg:col-span-3 space-y-6">
          {/* Product summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              {t.language === 'pt' ? 'Produto' : t.language === 'en' ? 'Product' : 'Producto'}
            </h2>
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                {product?.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">{product?.name}</h3>
                {variation && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{variation.name}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t.language === 'pt' ? 'Quantidade' : t.language === 'en' ? 'Quantity' : 'Cantidad'}: {qty}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                  {formatPrice(unitPrice)}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">/{t.language === 'pt' ? 'unidade' : t.language === 'en' ? 'unit' : 'unidad'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Payment methods */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              {t.language === 'pt' ? 'Método de Pagamento' : t.language === 'en' ? 'Payment Method' : 'Método de Pago'}
            </h2>
            {activeMethods.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                {t.language === 'pt' ? 'Nenhum método disponível' : t.language === 'en' ? 'No methods available' : 'Ningún método disponible'}
              </p>
            ) : (
              <div className="space-y-3">
                {activeMethods.map((m) => {
                  const meta = PAYMENT_METHOD_META[m.method_id];
                  if (!meta) return null;
                  const isSelected = selectedMethod === m.method_id;
                  return (
                    <button
                      key={m.method_id}
                      onClick={() => setSelectedMethod(m.method_id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src={meta.icon} alt={m.name} className="w-full h-full object-contain rounded-md" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta.description}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Terms acceptance */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.language === 'pt'
                  ? 'Eu li e aceito os termos e condições de compra. Compreendo que o pagamento será processado e o produto será entregue conforme as políticas da loja.'
                  : t.language === 'en'
                    ? 'I have read and accept the purchase terms and conditions. I understand that the payment will be processed and the product will be delivered according to store policies.'
                    : 'He leído y acepto los términos y condiciones de compra. Entiendo que el pago será procesado y el producto será entregado según las políticas de la tienda.'}
              </span>
            </label>
          </div>
        </div>

        {/* Right: Order summary */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 sticky top-20">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              {t.language === 'pt' ? 'Resumo do Pedido' : t.language === 'en' ? 'Order Summary' : 'Resumen del Pedido'}
            </h2>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {t.language === 'pt' ? 'Subtotal' : t.language === 'en' ? 'Subtotal' : 'Subtotal'}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">{formatPrice(unitPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {t.language === 'pt' ? 'Quantidade' : t.language === 'en' ? 'Quantity' : 'Cantidad'}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">×{qty}</span>
              </div>
              {userBalance > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t.language === 'pt' ? 'Saldo atual' : t.language === 'en' ? 'Current balance' : 'Saldo actual'}
                  </span>
                  <span className="font-medium text-green-600 dark:text-green-400">{formatPrice(userBalance)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <div className="flex justify-between items-baseline">
                <span className="text-base font-semibold text-gray-900 dark:text-white">
                  {t.language === 'pt' ? 'Total a pagar' : t.language === 'en' ? 'Total to pay' : 'Total a pagar'}
                </span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(totalAmount)}</span>
              </div>
              {shortfall > 0 && userBalance > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t.language === 'pt'
                    ? `Recarregue ${formatPrice(shortfall)} para completar a compra`
                    : t.language === 'en'
                      ? `Recharge ${formatPrice(shortfall)} to complete the purchase`
                      : `Recarga ${formatPrice(shortfall)} para completar la compra`}
                </p>
              )}
            </div>

            <button
              onClick={handleConfirmPayment}
              disabled={!selectedMethod || !acceptedTerms}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Lock className="h-4 w-4" />
              {t.language === 'pt' ? 'Pagar Agora' : t.language === 'en' ? 'Pay Now' : 'Pagar Ahora'}
            </button>

            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 dark:text-gray-500">
              <Shield className="h-3.5 w-3.5" />
              <span>{t.language === 'pt' ? 'Pagamento seguro e criptografado' : t.language === 'en' ? 'Secure encrypted payment' : 'Pago seguro y encriptado'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modals */}
      <StripePaymentModal
        isOpen={showPaymentModal && selectedMethod === 'stripe'}
        onClose={() => setShowPaymentModal(false)}
        amount={totalAmount}
        onSuccess={handlePaymentSuccess}
      />
      <PayPalPaymentModal
        isOpen={showPaymentModal && selectedMethod === 'paypal'}
        onClose={() => setShowPaymentModal(false)}
        amount={totalAmount}
        onSuccess={handlePaymentSuccess}
      />
      <MercadoPagoPaymentModal
        isOpen={showPaymentModal && selectedMethod === 'mercadopago'}
        onClose={() => setShowPaymentModal(false)}
        amount={totalAmount}
        onSuccess={handlePaymentSuccess}
      />
      <WhatsAppPaymentModal
        isOpen={showPaymentModal && selectedMethod === 'whatsapp'}
        onClose={() => setShowPaymentModal(false)}
        amount={totalAmount}
        onSuccess={handlePaymentSuccess}
      />
      <CryptomusPaymentModal
        isOpen={showPaymentModal && selectedMethod === 'cryptomus'}
        onClose={() => setShowPaymentModal(false)}
        amount={totalAmount}
        onSuccess={handlePaymentSuccess}
      />
      <BinancePaymentModal
        isOpen={showPaymentModal && selectedMethod === 'binance'}
        onClose={() => setShowPaymentModal(false)}
        amount={totalAmount}
        onSuccess={handlePaymentSuccess}
      />
      <TripleAPaymentModal
        isOpen={showPaymentModal && selectedMethod === 'triplea'}
        onClose={() => setShowPaymentModal(false)}
        amount={totalAmount}
        onSuccess={handlePaymentSuccess}
      />
      <AsaasPaymentModal
        isOpen={showPaymentModal && selectedMethod === 'asaas'}
        onClose={() => setShowPaymentModal(false)}
        amount={totalAmount}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
