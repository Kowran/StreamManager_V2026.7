import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet, RefreshCw, Plus, Calendar, CheckCircle, ChevronLeft, ChevronRight,
  TrendingUp, Eye, AlertCircle, ArrowUpRight, ArrowDownRight, Gift, Sparkles,
  CreditCard, Zap, Clock, History,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
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
import { InfinitePayPaymentModal } from './InfinitePayPaymentModal';

interface UserCredit {
  balance: number;
  total_recharged: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
  reference_type?: string;
  metadata?: any;
}

interface PaymentMethodConfig {
  method_id: string;
  name: string;
  is_active: boolean;
  status: 'active' | 'hidden' | 'inactive';
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
  infinitepay: { icon: 'https://i.imgur.com/3oeBwGn.jpeg', description: 'PIX, Cartão (Brasil)', fees: 'Taxa zero no PIX', processing_time: 'Instantâneo', min_amount: 1, max_amount: 1000 },
};

const TX_META: Record<string, { icon: typeof Plus; color: string; bg: string; label: string }> = {
  recharge: { icon: Plus, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', label: 'Recarga' },
  purchase: { icon: ArrowUpRight, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/30', label: 'Compra' },
  refund: { icon: RefreshCw, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', label: 'Reembolso' },
  bonus: { icon: Gift, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', label: 'Bônus' },
  admin_adjustment: { icon: Eye, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', label: 'Ajuste Admin' },
};

function getTxMeta(type: string) {
  return TX_META[type] || { icon: Wallet, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700', label: type };
}

function tr(pt: string, en: string, es: string, lang: string) {
  return lang === 'pt' ? pt : lang === 'en' ? en : es;
}

export function CreditsManager({ presetRechargeAmount, onRechargeComplete }: { presetRechargeAmount?: number; onRechargeComplete?: () => void } = {}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [userCredit, setUserCredit] = useState<UserCredit | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [rechargeAmount, setRechargeAmount] = useState<number>(presetRechargeAmount || 10);
  const [customAmount, setCustomAmount] = useState<string>(presetRechargeAmount ? String(presetRechargeAmount) : '');
  const [currentPage, setCurrentPage] = useState(1);
  const [cashbackBalance, setCashbackBalance] = useState<number>(0);
  const [activeMethods, setActiveMethods] = useState<PaymentMethodConfig[]>([]);
  const paymentMethodsRef = useRef<HTMLDivElement>(null);
  const transactionsPerPage = 8;

  useEffect(() => {
    if (user) {
      loadUserCredit();
      loadTransactions();
      loadCashbackBalance();
      fetchActiveMethods();
    }
  }, [user]);

  useEffect(() => {
    if (presetRechargeAmount && presetRechargeAmount > 0) {
      setRechargeAmount(presetRechargeAmount);
      setCustomAmount(String(presetRechargeAmount));
      setTimeout(() => {
        paymentMethodsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [presetRechargeAmount]);

  async function loadUserCredit() {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('user_credits').select('*').eq('user_id', user.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      setUserCredit(data || { balance: 0, total_recharged: 0, total_spent: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    } catch (error) {
      console.error('Error loading user credit:', error);
    }
  }

  async function loadTransactions() {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('credit_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCashbackBalance() {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('user_sm_credits').select('balance').eq('user_id', user.id).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setCashbackBalance(data?.balance || 0);
    } catch (error) {
      console.error('Error loading cashback balance:', error);
    }
  }

  async function fetchActiveMethods() {
    try {
      const { data, error } = await supabase.from('payment_methods_config').select('method_id, name, is_active, status, display_order').eq('status', 'active').order('display_order', { ascending: true });
      if (error) throw error;
      setActiveMethods(data || []);
    } catch (error) {
      console.error('Error fetching active payment methods:', error);
    }
  }

  const quickAmounts = [5, 10, 20, 50, 100];

  function handlePaymentMethodSelect(methodId: string, amount: number) {
    const method = PAYMENT_METHOD_META[methodId];
    if (!method) return;
    if (amount < (method.min_amount || 1)) { alert(`Valor mínimo: ${method.min_amount || 1}`); return; }
    if (amount > (method.max_amount || 1000)) { alert(`Valor máximo: ${method.max_amount || 1000}`); return; }
    setSelectedPaymentMethod(methodId);
    setShowPaymentModal(true);
  }

  function handlePaymentSuccess() {
    loadUserCredit();
    loadTransactions();
    loadCashbackBalance();
    setShowPaymentModal(false);
    setSelectedPaymentMethod('');
  }

  const totalPages = Math.ceil(transactions.length / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  useEffect(() => { setCurrentPage(1); }, [transactions.length]);

  const balance = userCredit?.balance || 0;
  const totalRecharged = userCredit?.total_recharged || 0;
  const totalSpent = userCredit?.total_spent || 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Carregando...', 'Loading...', 'Cargando...', t.language)}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Hero Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-10 shadow-xl">
        {/* Decorative blobs */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-8 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <Wallet className="h-4 w-4 text-blue-300" />
              </div>
              <span className="text-sm font-medium text-slate-400">
                {tr('Saldo Disponível', 'Available Balance', 'Saldo Disponible', t.language)}
              </span>
            </div>
            <div className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white">
              {formatPrice(balance)}
            </div>
            {cashbackBalance > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                <Gift className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-xs sm:text-sm font-medium text-amber-200">
                  {tr('Cashback', 'Cashback', 'Cashback', t.language)}: {formatPrice(cashbackBalance)}
                </span>
              </div>
            )}
          </div>

          {/* Stats column */}
          <div className="flex sm:flex-col gap-3 sm:gap-3">
            <div className="flex-1 sm:flex-none rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{tr('Total Recarregado', 'Total Recharged', 'Total Recargado', t.language)}</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-white">{formatPrice(totalRecharged)}</p>
            </div>
            <div className="flex-1 sm:flex-none rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{tr('Total Gasto', 'Total Spent', 'Total Gastado', t.language)}</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-white">{formatPrice(totalSpent)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recharge Section */}
      <div ref={paymentMethodsRef} className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-5 sm:p-8 scroll-mt-20">
        <div className="flex items-center gap-3 mb-5 sm:mb-7">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {tr('Recarregar Créditos', 'Recharge Credits', 'Recargar Créditos', t.language)}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {tr('Escolha um valor e método de pagamento', 'Choose an amount and payment method', 'Elige un monto y método de pago', t.language)}
            </p>
          </div>
        </div>

        {presetRechargeAmount && presetRechargeAmount > 0 && (
          <div className="mb-5 sm:mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {tr(
                `Saldo insuficiente para sua compra. Recarregue pelo menos ${formatPrice(presetRechargeAmount)} e escolha o método de pagamento abaixo.`,
                `Insufficient balance for your purchase. Recharge at least ${formatPrice(presetRechargeAmount)} and choose a payment method below.`,
                `Saldo insuficiente para su compra. Recarga al menos ${formatPrice(presetRechargeAmount)} y elige un método de pago abajo.`,
                t.language
              )}
            </p>
          </div>
        )}

        {/* Quick Amount Selection */}
        <div className="mb-5 sm:mb-6">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
            {tr('Valores Rápidos', 'Quick Amounts', 'Montos Rápidos', t.language)}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => { setRechargeAmount(amount); setCustomAmount(String(amount)); }}
                className={`relative py-3 sm:py-3.5 rounded-xl text-center font-bold transition-all duration-200 ${
                  rechargeAmount === amount
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-105'
                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                }`}
              >
                <span className="text-base sm:text-lg">${amount}</span>
                {amount === 20 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white shadow">★</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <div className="mb-5 sm:mb-7">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {tr('Valor Personalizado', 'Custom Amount', 'Monto Personalizado', t.language)}
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 font-semibold">$</span>
              <input
                type="number"
                step="0.01"
                min="1"
                max="10000"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  const value = parseFloat(e.target.value);
                  if (value && value >= 1) setRechargeAmount(value);
                }}
                className="pl-8 pr-4 py-2.5 w-full border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-base font-medium"
                placeholder="1.00"
              />
            </div>
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {tr('Mín: $1 • Máx: $10,000', 'Min: $1 • Max: $10,000', 'Mín: $1 • Máx: $10,000', t.language)}
            </span>
          </div>
        </div>

        {/* Payment Methods */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {tr('Escolha o Método de Pagamento', 'Choose Payment Method', 'Elige el Método de Pago', t.language)}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeMethods.map((activeMethod) => {
              const method = PAYMENT_METHOD_META[activeMethod.method_id];
              if (!method) return null;
              const disabled = rechargeAmount < (method.min_amount || 1) || rechargeAmount > (method.max_amount || 1000);
              return (
                <button
                  key={activeMethod.method_id}
                  onClick={() => handlePaymentMethodSelect(activeMethod.method_id, rechargeAmount)}
                  disabled={disabled}
                  className="group p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed text-left"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0 group-hover:scale-105 transition-transform">
                      <img src={method.icon} alt={activeMethod.name} className="w-full h-full object-contain rounded-md" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{activeMethod.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{method.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="font-medium opacity-70">{tr('Taxa', 'Fees', 'Tarifa', t.language)}:</span>
                      <span>{method.fees}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 opacity-60" />
                      <span>{method.processing_time}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <History className="h-4.5 w-4.5 text-gray-600 dark:text-gray-300" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {tr('Histórico de Transações', 'Transaction History', 'Historial de Transacciones', t.language)}
            </h3>
          </div>
          <button
            onClick={loadTransactions}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={tr('Atualizar', 'Refresh', 'Actualizar', t.language)}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <Calendar className="h-7 w-7 text-gray-400" />
            </div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {tr('Nenhuma transação encontrada', 'No transactions found', 'No se encontraron transacciones', t.language)}
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {tr('Suas transações aparecerão aqui', 'Your transactions will appear here', 'Tus transacciones aparecerán aquí', t.language)}
            </p>
          </div>
        ) : (
          <>
            {/* Transaction list */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {currentTransactions.map((tx) => {
                const meta = getTxMeta(tx.type);
                const Icon = meta.icon;
                const isPositive = tx.amount >= 0;
                return (
                  <div key={tx.id} className="px-5 sm:px-6 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <Icon className={`h-5 w-5 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{meta.label}</span>
                          {tx.reference_type && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
                              {tx.reference_type}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{tx.description || '-'}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {new Date(tx.created_at).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')} · {new Date(tx.created_at).toLocaleTimeString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-sm font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isPositive ? '+' : ''}{formatPrice(tx.amount)}
                        </div>
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {tr('Saldo', 'Balance', 'Saldo', t.language)}: {formatPrice(tx.balance_after)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 order-2 sm:order-1">
                  {tr('Página', 'Page', 'Página', t.language)} {currentPage} {tr('de', 'of', 'de', t.language)} {totalPages} · {startIndex + 1}-{Math.min(endIndex, transactions.length)} {tr('de', 'of', 'de', t.language)} {transactions.length}
                </span>
                <div className="flex items-center gap-1.5 order-1 sm:order-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Modals */}
      <StripePaymentModal isOpen={showPaymentModal && selectedPaymentMethod === 'stripe'} onClose={() => setShowPaymentModal(false)} amount={rechargeAmount} onSuccess={handlePaymentSuccess} />
      <PayPalPaymentModal isOpen={showPaymentModal && selectedPaymentMethod === 'paypal'} onClose={() => setShowPaymentModal(false)} amount={rechargeAmount} onSuccess={handlePaymentSuccess} />
      <MercadoPagoPaymentModal isOpen={showPaymentModal && selectedPaymentMethod === 'mercadopago'} onClose={() => setShowPaymentModal(false)} amount={rechargeAmount} onSuccess={handlePaymentSuccess} />
      <WhatsAppPaymentModal isOpen={showPaymentModal && selectedPaymentMethod === 'whatsapp'} onClose={() => setShowPaymentModal(false)} amount={rechargeAmount} onSuccess={handlePaymentSuccess} />
      <CryptomusPaymentModal isOpen={showPaymentModal && selectedPaymentMethod === 'cryptomus'} onClose={() => setShowPaymentModal(false)} amount={rechargeAmount} onSuccess={handlePaymentSuccess} />
      <BinancePaymentModal isOpen={showPaymentModal && selectedPaymentMethod === 'binance'} onClose={() => setShowPaymentModal(false)} amount={rechargeAmount} onSuccess={handlePaymentSuccess} />
      <TripleAPaymentModal isOpen={showPaymentModal && selectedPaymentMethod === 'triplea'} onClose={() => setShowPaymentModal(false)} amount={rechargeAmount} onSuccess={handlePaymentSuccess} />
      <AsaasPaymentModal isOpen={showPaymentModal && selectedPaymentMethod === 'asaas'} onClose={() => setShowPaymentModal(false)} amount={rechargeAmount} onSuccess={handlePaymentSuccess} />
      <InfinitePayPaymentModal isOpen={showPaymentModal && selectedPaymentMethod === 'infinitepay'} onClose={() => setShowPaymentModal(false)} amount={rechargeAmount} onSuccess={handlePaymentSuccess} />
    </div>
  );
}
