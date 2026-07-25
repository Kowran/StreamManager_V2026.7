import React from 'react';
import { X, Trash2, Minus, Plus, ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from './CartProvider';
import { useLanguage } from './LanguageProvider';

export function CartDrawer({ onCheckout }: { onCheckout: () => void }) {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, totalPrice, totalItems } = useCart();
  const { t } = useLanguage();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => lang === 'pt' ? pt : lang === 'en' ? en : es;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      <div className="fixed inset-y-0 right-0 w-full max-w-md z-50 bg-white dark:bg-gray-800 shadow-2xl flex flex-col transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {tr('Carrinho', 'Cart', 'Carrito')}
            {totalItems > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {totalItems}
              </span>
            )}
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {tr('Seu carrinho está vazio', 'Your cart is empty', 'Tu carrito está vacío')}
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr('Continuar comprando', 'Continue shopping', 'Seguir comprando')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variationId || ''}`}
                  className="flex gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                    {item.variationName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.variationName}</p>
                    )}
                    {item.seller_name && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{item.seller_name}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variationId)}
                          className="p-1 rounded-md text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-bold text-gray-900 dark:text-white w-7 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variationId)}
                          className="p-1 rounded-md text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeItem(item.productId, item.variationId)}
                          className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">{tr('Total', 'Total', 'Total')}</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">${totalPrice.toFixed(2)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold shadow-lg transition-all hover:scale-[1.02]"
            >
              {tr('Finalizar Compra', 'Checkout', 'Finalizar Compra')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
