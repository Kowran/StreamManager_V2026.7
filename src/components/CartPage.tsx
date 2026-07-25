import React, { useState, useEffect } from 'react';
import { Trash2, Minus, Plus, ShoppingCart, ArrowLeft, Loader, CheckCircle2, AlertCircle, ShieldCheck, Headphones as HeadphonesIcon, Lock } from 'lucide-react';
import { useCart } from './CartProvider';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { supabase } from '../lib/supabase';

interface CartPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function CartPage({ onBack, onSuccess }: CartPageProps) {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const { t } = useLanguage();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => lang === 'pt' ? pt : lang === 'en' ? en : es;

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
      setCreditBalance(data?.balance || 0);
    })();
  }, [user]);

  const shortfall = Math.max(0, totalPrice - creditBalance);

  const handleCheckout = async () => {
    if (!user) return;
    setProcessing(true);
    setError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      let successCount = 0;
      let lastError: string | null = null;

      for (const item of items) {
        const res = await fetch(`${supabaseUrl}/functions/v1/process-store-purchase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            product_id: item.productId,
            quantity: item.quantity,
            variation_id: item.variationId || undefined,
          }),
        });
        if (res.ok) {
          successCount++;
        } else {
          const errBody = await res.json().catch(() => ({}));
          lastError = errBody.error || `Failed to purchase ${item.name}`;
        }
      }

      if (successCount === items.length) {
        clearCart();
        setSuccess(true);
      } else if (successCount > 0) {
        setError(`${successCount}/${items.length} ${tr('itens processados com sucesso', 'items processed successfully', 'artículos procesados con éxito')}. ${lastError || ''}`);
      } else {
        setError(lastError || tr('Falha ao processar compra', 'Failed to process purchase', 'Error al procesar la compra'));
      }
    } catch (e: any) {
      setError(e.message || tr('Erro inesperado', 'Unexpected error', 'Error inesperado'));
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {tr('Compra Realizada!', 'Purchase Complete!', '¡Compra Completada!')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {tr('Seus produtos foram entregues. Acesse "Minhas Compras" para visualizar.', 'Your products have been delivered. Go to "My Purchases" to view them.', 'Tus productos han sido entregados. Ve a "Mis Compras" para verlos.')}
          </p>
          <button
            onClick={onSuccess}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors"
          >
            {tr('Ver Minhas Compras', 'View My Purchases', 'Ver Mis Compras')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {tr('Voltar', 'Back', 'Volver')}
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <ShoppingCart className="h-6 w-6" />
        {tr('Carrinho', 'Cart', 'Carrito')}
      </h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingCart className="h-20 w-20 text-gray-300 dark:text-gray-600 mb-6" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-4">
            {tr('Seu carrinho está vazio', 'Your cart is empty', 'Tu carrito está vacío')}
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            {tr('Continuar comprando', 'Continue shopping', 'Seguir comprando')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items list */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <div
                key={`${item.productId}-${item.variationId || ''}`}
                className="flex gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingCart className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                  {item.variationName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.variationName}</p>
                  )}
                  {item.seller_name && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.seller_name}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variationId)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-bold text-gray-900 dark:text-white w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variationId)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">${(item.price * item.quantity).toFixed(2)}</span>
                      <button
                        onClick={() => removeItem(item.productId, item.variationId)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{tr('Resumo do Pedido', 'Order Summary', 'Resumen del Pedido')}</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{tr('Subtotal', 'Subtotal', 'Subtotal')}</span>
                <span className="font-medium text-gray-900 dark:text-white">${totalPrice.toFixed(2)}</span>
              </div>
              {user && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{tr('Seu Saldo', 'Your Balance', 'Tu Saldo')}</span>
                  <span className={`font-medium ${creditBalance >= totalPrice ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    ${creditBalance.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between">
                <span className="font-bold text-gray-900 dark:text-white">{tr('Total', 'Total', 'Total')}</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">${totalPrice.toFixed(2)}</span>
              </div>

              {shortfall > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {tr(
                      `Saldo insuficiente. Faltam $${shortfall.toFixed(2)}. Recarregue sua carteira para continuar.`,
                      `Insufficient balance. $${shortfall.toFixed(2)} short. Top up your wallet to continue.`,
                      `Saldo insuficiente. Faltan $${shortfall.toFixed(2)}. Recarga tu billetera para continuar.`
                    )}
                  </span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {!user ? (
                <button
                  onClick={onBack}
                  className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors"
                >
                  {tr('Entrar para Comprar', 'Sign In to Buy', 'Inicia Sesión para Comprar')}
                </button>
              ) : (
                <button
                  onClick={handleCheckout}
                  disabled={processing || shortfall > 0}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${
                    processing || shortfall > 0
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:scale-[1.02]'
                  }`}
                >
                  {processing ? <Loader className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
                  {processing ? tr('Processando...', 'Processing...', 'Procesando...') : tr('Finalizar Compra', 'Checkout', 'Finalizar Compra')}
                </button>
              )}

              {/* Trust badges */}
              <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  {tr('Compra 100% protegida', '100% protected purchase', 'Compra 100% protegida')}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <HeadphonesIcon className="h-4 w-4 text-blue-500" />
                  {tr('Suporte disponível 24/7', '24/7 support available', 'Soporte disponible 24/7')}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Lock className="h-4 w-4 text-gray-500" />
                  {tr('Pagamento seguro', 'Secure payment', 'Pago seguro')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
