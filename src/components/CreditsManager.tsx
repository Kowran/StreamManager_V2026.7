import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, RefreshCw, ArrowUpRight, ArrowDownLeft,
  CreditCard, Shield, Clock, CheckCircle, ChevronLeft, ChevronRight, Eye,
  Sparkles, Receipt, ArrowLeft, Zap, Gift, Building2, PiggyBank, BarChart3,
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
import { PagBankPaymentModal } from './PagBankPaymentModal';
import { EfiPaymentModal } from './EfiPaymentModal';

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
  pagbank: { icon: 'https://i.imgur.com/3oeBwGn.jpeg', description: 'PIX, Boleto (Brasil)', fees: 'Sem taxas (PIX)', processing_time: 'Instantâneo', min_amount: 1, max_amount: 1000 },
  efi: { icon: 'https://i.imgur.com/3oeBwGn.jpeg', description: 'PIX, Boleto (Brasil)', fees: 'Sem taxas (PIX)', processing_time: 'Instantâneo', min_amount: 1, max_amount: 1000 },
};

export function CreditsManager({ presetRechargeAmount, onRechargeComplete }: { presetRechargeAmount?: number; onRechargeComplete?: () => void } = {}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => lang === 'pt' ? pt : lang === 'en' ? en : es;

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
  const [showRechargePanel, setShowRechargePanel] = useState(false);
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
      setShowRechargePanel(true);
      setTimeout(() => {
        paymentMethodsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [presetRechargeAmount]);

  async function loadUserCredit() {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('user_credits').select('*').eq('user_id', user.id).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setUserCredit(data || { balance: 0, total_recharged: 0, total_spent: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    } catch (e) { console.error('Error loading user credit:', e); }
  }

  async function loadTransactions() {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('credit_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      setTransactions(data || []);
    } catch (e) { console.error('Error loading transactions:', e); }
    finally { setLoading(false); }
  }

  async function loadCashbackBalance() {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('user_sm_credits').select('balance').eq('user_id', user.id).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setCashbackBalance(data?.balance || 0);
    } catch (e) { console.error('Error loading cashback balance:', e); }
  }

  async function fetchActiveMethods() {
    try {
      const { data, error } = await supabase.from('payment_methods_config').select('method_id, name, is_active, status, display_order').eq('status', 'active').order('display_order', { ascending: true });
      if (error) throw error;
      setActiveMethods(data || []);
    } catch (e) { console.error('Error fetching active payment methods:', e); }
  }

  function handlePaymentMethodSelect(methodId: string, amount: number) {
    const method = PAYMENT_METHOD_META[methodId];
    if (!method) return;
    if (amount < (method.min_amount || 1)) { alert(tr(`Valor mínimo: $${method.min_amount || 1}`, `Minimum amount: $${method.min_amount || 1}`, `Monto mínimo: $${method.min_amount || 1}`)); return; }
    if (amount > (method.max_amount || 1000)) { alert(tr(`Valor máximo: $${method.max_amount || 1000}`, `Maximum amount: $${method.max_amount || 1000}`, `Monto máximo: $${method.max_amount || 1000}`)); return; }
    setSelectedPaymentMethod(methodId);
    setShowPaymentModal(true);
  }

  function handlePaymentSuccess() {
    loadUserCredit();
    loadTransactions();
    loadCashbackBalance();
    setShowPaymentModal(false);
    setSelectedPaymentMethod('');
    onRechargeComplete?.();
  }

  const quickAmounts = [5, 10, 25, 50, 100, 200];

  function getTransactionIcon(type: string) {
    switch (type) {
      case 'recharge': return <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'purchase': return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'refund': return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'bonus': return <Gift className="h-4 w-4 text-amber-500" />;
      case 'admin_adjustment': return <Eye className="h-4 w-4 text-orange-500" />;
      default: return <Receipt className="h-4 w-4 text-gray-500" />;
    }
  }

  function getTransactionColor(type: string) {
    switch (type) {
      case 'recharge': case 'refund': case 'bonus': return 'text-emerald-600 dark:text-emerald-400';
      case 'purchase': return 'text-red-500 dark:text-red-400';
      case 'admin_adjustment': return 'text-orange-500 dark:text-orange-400';
      default: return 'text-gray-500 dark:text-gray-400';
    }
  }

  function getTransactionLabel(type: string) {
    switch (type) {
      case 'recharge': return tr('Recarga', 'Recharge', 'Recarga');
      case 'purchase': return tr('Compra', 'Purchase', 'Compra');
      case 'refund': return tr('Reembolso', 'Refund', 'Reembolso');
      case 'bonus': return tr('Bônus', 'Bonus', 'Bono');
      case 'admin_adjustment': return tr('Ajuste', 'Adjustment', 'Ajuste');
      default: return type;
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  const totalPages = Math.ceil(transactions.length / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const currentTransactions = transactions.slice(startIndex, startIndex + transactionsPerPage);

  useEffect(() => { setCurrentPage(1); }, [transactions.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const balance = userCredit?.balance || 0;
  const totalRecharged = userCredit?.total_recharged || 0;
  const totalSpent = userCredit?.total_spent || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('Minha Carteira', 'My Wallet', 'Mi Billetera')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Gerencie seus créditos e transações', 'Manage your credits and transactions', 'Gestiona tus créditos y transacciones')}</p>
        </div>
      </div>

      {/* Main balance card - bank style */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-6 sm:p-8 shadow-2xl">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-4 right-6 opacity-5">
          <Building2 className="h-32 w-32 text-white" />
        </div>

        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-blue-300" />
                <p className="text-xs font-medium text-blue-300 uppercase tracking-wider">{tr('Saldo Disponível', 'Available Balance', 'Saldo Disponible')}</p>
              </div>
              <div className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                {formatPrice(balance)}
              </div>
              <p className="text-blue-300/70 text-xs mt-2">
                {tr('Atualizado em tempo real', 'Updated in real time', 'Actualizado en tiempo real')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-300 font-medium">{tr('Conta Protegida', 'Protected Account', 'Cuenta Protegida')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cashback badge */}
          {cashbackBalance > 0 && (
            <div className="inline-flex items-center gap-2 bg-amber-500/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-amber-400/30 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-xs text-amber-200 font-medium">
                {tr('Cashback', 'Cashback', 'Cashback')}: {formatPrice(cashbackBalance)}
              </span>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className="text-xs text-blue-300 font-medium">{tr('Total Recarregado', 'Total Recharged', 'Total Recargado')}</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-white">{formatPrice(totalRecharged)}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                </div>
                <span className="text-xs text-blue-300 font-medium">{tr('Total Gasto', 'Total Spent', 'Total Gastado')}</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-white">{formatPrice(totalSpent)}</p>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={() => setShowRechargePanel(!showRechargePanel)}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold transition-all hover:scale-[1.01] shadow-lg"
          >
            <Plus className="h-5 w-5" />
            {tr('Recarregar Carteira', 'Recharge Wallet', 'Recargar Billetera')}
          </button>
        </div>
      </div>

      {/* Recharge panel */}
      {showRechargePanel && (
        <div ref={paymentMethodsRef} className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-gray-900 dark:text-white">{tr('Recarregar Saldo', 'Recharge Balance', 'Recargar Saldo')}</h3>
            </div>
            <button
              onClick={() => setShowRechargePanel(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
            >
              {tr('Fechar', 'Close', 'Cerrar')}
            </button>
          </div>

          {/* Quick amounts */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {quickAmounts.map(amt => (
              <button
                key={amt}
                onClick={() => { setRechargeAmount(amt); setCustomAmount(''); }}
                className={`px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  rechargeAmount === amt && !customAmount
                    ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-md scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              {tr('Valor personalizado', 'Custom amount', 'Monto personalizado')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
              <input
                type="number"
                min="1"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  const val = parseFloat(e.target.value);
                  if (val && val > 0) setRechargeAmount(val);
                }}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
              />
            </div>
          </div>

          {/* Payment methods */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              {tr('Escolha o método de pagamento', 'Choose payment method', 'Elige el método de pago')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeMethods.length > 0 ? activeMethods.map((method) => {
                const meta = PAYMENT_METHOD_META[method.method_id];
                if (!meta) return null;
                return (
                  <button
                    key={method.method_id}
                    onClick={() => handlePaymentMethodSelect(method.method_id, rechargeAmount)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center">
                      <img src={meta.icon} alt={method.name} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{method.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  </button>
                );
              }) : (
                // Fallback: show all methods
                Object.entries(PAYMENT_METHOD_META).map(([id, meta]) => (
                  <button
                    key={id}
                    onClick={() => handlePaymentMethodSelect(id, rechargeAmount)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center">
                      <img src={meta.icon} alt={id} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate capitalize">{id}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transactions history - bank statement style */}
      <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h3 className="font-bold text-gray-900 dark:text-white">{tr('Extrato de Transações', 'Transaction Statement', 'Estado de Transacciones')}</h3>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {transactions.length} {tr('registros', 'records', 'registros')}
          </span>
        </div>

        {currentTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="h-14 w-14 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {tr('Nenhuma transação ainda', 'No transactions yet', 'Sin transacciones aún')}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {tr('Suas transações aparecerão aqui', 'Your transactions will appear here', 'Tus transacciones aparecerán aquí')}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="text-left font-medium px-5 py-3">{tr('Tipo', 'Type', 'Tipo')}</th>
                    <th className="text-left font-medium px-5 py-3">{tr('Descrição', 'Description', 'Descripción')}</th>
                    <th className="text-left font-medium px-5 py-3">{tr('Data', 'Date', 'Fecha')}</th>
                    <th className="text-right font-medium px-5 py-3">{tr('Valor', 'Amount', 'Monto')}</th>
                    <th className="text-right font-medium px-5 py-3">{tr('Saldo', 'Balance', 'Saldo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {currentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            {getTransactionIcon(tx.type)}
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{getTransactionLabel(tx.type)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 max-w-xs">
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{tx.description || '—'}</p>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(tx.created_at)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatTime(tx.created_at)}</p>
                      </td>
                      <td className={`px-5 py-3 text-right font-bold text-sm whitespace-nowrap ${getTransactionColor(tx.type)}`}>
                        {tx.type === 'purchase' ? '−' : '+'}{formatPrice(tx.amount)}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatPrice(tx.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {currentTransactions.map((tx) => (
                <div key={tx.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{getTransactionLabel(tx.type)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(tx.created_at)} · {formatTime(tx.created_at)}</p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${getTransactionColor(tx.type)}`}>
                      {tx.type === 'purchase' ? '−' : '+'}{formatPrice(tx.amount)}
                    </p>
                  </div>
                  {tx.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-10">{tx.description}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 pl-10">
                    {tr('Saldo', 'Balance', 'Saldo')}: {formatPrice(tx.balance_after)}
                  </p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {tr('Anterior', 'Previous', 'Anterior')}
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {tr('Próximo', 'Next', 'Siguiente')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment modals */}
      {showPaymentModal && selectedPaymentMethod === 'stripe' && (
        <StripePaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'paypal' && (
        <PayPalPaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'mercadopago' && (
        <MercadoPagoPaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'whatsapp' && (
        <WhatsAppPaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'cryptomus' && (
        <CryptomusPaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'binance' && (
        <BinancePaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'triplea' && (
        <TripleAPaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'asaas' && (
        <AsaasPaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'infinitepay' && (
        <InfinitePayPaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'pagbank' && (
        <PagBankPaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {showPaymentModal && selectedPaymentMethod === 'efi' && (
        <EfiPaymentModal
          isOpen={showPaymentModal}
          amount={rechargeAmount}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
