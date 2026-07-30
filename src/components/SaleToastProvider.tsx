import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShoppingBag, X, CheckCircle2, TrendingUp } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { supabase } from '../lib/supabase';

interface SaleToast {
  id: string;
  productName: string;
  quantity: number;
  total: number;
  customerName: string;
  timestamp: number;
}

export function SaleToastProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [toasts, setToasts] = useState<SaleToast[]>([]);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  const tr = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  const playSaleSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const start = now + i * 0.12;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch { /* ignore audio errors */ }
  }, []);

  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  const addToast = useCallback((toast: SaleToast) => {
    setToasts(prev => [...prev, toast]);
    playSaleSound();
    setTimeout(() => removeToast(toast.id), 6000);
  }, [playSaleSound, removeToast]);

  useEffect(() => {
    if (!user) return;

    // Seed known orders so we don't fire toasts for pre-existing sales
    const seedKnownOrders = async () => {
      try {
        const { data } = await supabase
          .from('store_orders')
          .select('id')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) {
          data.forEach((row: any) => knownOrderIds.current.add(row.id));
        }
      } catch { /* ignore */ }
    };

    seedKnownOrders();

    const channel = supabase
      .channel(`sale-toast:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'store_orders', filter: `seller_id=eq.${user.id}` },
        async (payload) => {
          const order = payload.new as any;
          if (!order || knownOrderIds.current.has(order.id)) return;
          knownOrderIds.current.add(order.id);

          let productName = tr('Produto', 'Product', 'Producto');
          try {
            const { data: product } = await supabase
              .from('store_products')
              .select('name')
              .eq('id', order.product_id)
              .maybeSingle();
            if (product?.name) productName = product.name;
          } catch { /* use fallback */ }

          addToast({
            id: order.id,
            productName,
            quantity: order.quantity || 1,
            total: Number(order.total_usdt) || 0,
            customerName: order.customer_name || tr('Cliente', 'Customer', 'Cliente'),
            timestamp: Date.now(),
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, addToast, tr]);

  return (
    <>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-green-200 dark:border-green-800/60 overflow-hidden animate-[slideIn_0.3s_ease-out]"
            style={{ animation: 'saleToastIn 0.35s cubic-bezier(0.16,1,0.3,1)' }}
          >
            <div className="flex items-stretch">
              {/* Accent bar */}
              <div className="w-1.5 bg-gradient-to-b from-green-400 to-emerald-600 flex-shrink-0" />
              <div className="flex items-start gap-3 p-3.5 flex-1 min-w-0">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg shadow-md shadow-green-500/20 flex-shrink-0">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {tr('Nova venda!', 'New sale!', 'Nueva venta!')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 truncate font-medium">
                    {toast.productName}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-0.5">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="font-bold text-green-600 dark:text-green-400">
                        ${toast.total.toFixed(2)}
                      </span>
                    </span>
                    <span>·</span>
                    <span>{toast.customerName}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 flex-shrink-0 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-0.5 bg-gray-100 dark:bg-gray-700">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500"
                style={{ animation: 'saleToastProgress 6s linear forwards' }}
              />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes saleToastIn {
          from { opacity: 0; transform: translateX(120%) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes saleToastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
}
