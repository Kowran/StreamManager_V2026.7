import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, RefreshCw, Plus, Calendar, Clock, CheckCircle, ChevronLeft, ChevronRight, Wallet, TrendingUp, Eye, AlertCircle } from 'lucide-react';
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
  const transactionsPerPage = 10;
  const [cashbackBalance, setCashbackBalance] = useState<number>(0);
  const [activeMethods, setActiveMethods] = useState<PaymentMethodConfig[]>([]);
  const paymentMethodsRef = React.useRef<HTMLDivElement>(null);

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
      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setUserCredit(data || {
        balance: 0,
        total_recharged: 0,
        total_spent: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error loading user credit:', error);
    }
  }

  async function loadTransactions() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

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
      const { data, error } = await supabase
        .from('user_sm_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setCashbackBalance(data?.balance || 0);
    } catch (error) {
      console.error('Error loading cashback balance:', error);
    }
  }

  const quickAmounts = [5, 10, 20, 50, 100];

  async function fetchActiveMethods() {
    try {
      const { data, error } = await supabase
        .from('payment_methods_config')
        .select('method_id, name, is_active, status, display_order')
        .eq('status', 'active')
        .order('display_order', { ascending: true });
      if (error) throw error;
      setActiveMethods(data || []);
    } catch (error) {
      console.error('Error fetching active payment methods:', error);
    }
  }

  function handlePaymentMethodSelect(methodId: string, amount: number) {
    const method = PAYMENT_METHOD_META[methodId];
    if (!method) return;

    if (amount < (method.min_amount || 1)) {
      alert(`Valor mínimo: ${method.min_amount || 1}`);
      return;
    }

    if (amount > (method.max_amount || 1000)) {
      alert(`Valor máximo: ${method.max_amount || 1000}`);
      return;
    }

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

  function getTransactionIcon(type: string) {
    switch (type) {
      case 'recharge':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'purchase':
        return <DollarSign className="h-4 w-4 text-red-600" />;
      case 'refund':
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      case 'bonus':
        return <TrendingUp className="h-4 w-4 text-purple-600" />;
      case 'admin_adjustment':
        return <Eye className="h-4 w-4 text-orange-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  }

  function getTransactionColor(type: string) {
    switch (type) {
      case 'recharge':
      case 'refund':
      case 'bonus':
        return 'text-green-600 dark:text-green-400';
      case 'purchase':
        return 'text-red-600 dark:text-red-400';
      case 'admin_adjustment':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  }

  function getTransactionLabel(type: string) {
    switch (type) {
      case 'recharge': return 'Recarga';
      case 'purchase': return 'Compra';
      case 'refund': return 'Reembolso';
      case 'bonus': return 'Bônus';
      case 'admin_adjustment': return 'Ajuste Admin';
      default: return type;
    }
  }

  // Pagination logic
  const totalPages = Math.ceil(transactions.length / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  // Reset to first page when transactions change
  useEffect(() => {
    setCurrentPage(1);
  }, [transactions.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.myCredits}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t.language === 'pt' ? 'Gerencie seus créditos e histórico de transações' :
           t.language === 'en' ? 'Manage your credits and transaction history' :
           'Gestiona tus créditos e historial de transacciones'}
        </p>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-400">
                {t.language === 'pt' ? 'Saldo Disponível' : t.language === 'en' ? 'Available Balance' : 'Saldo Disponible'}
              </h3>
            </div>
            <div className="text-4xl sm:text-5xl font-bold tracking-tight">
              {formatPrice(userCredit?.balance || 0)}
            </div>
            {cashbackBalance > 0 && (
              <p className="text-slate-400 text-xs sm:text-sm mt-3 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-yellow-500" />
                {t.language === 'pt' ? `Cashback disponível: ${formatPrice(cashbackBalance)}` : t.language === 'en' ? `Cashback available: ${formatPrice(cashbackBalance)}` : `Cashback disponible: ${formatPrice(cashbackBalance)}`}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="bg-white bg-opacity-10 p-3 rounded-xl">
              <DollarSign className="h-7 w-7 sm:h-9 sm:w-9" />
            </div>
          </div>
        </div>
      </div>


      {/* Recharge Section */}
      <div ref={paymentMethodsRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 scroll-mt-20">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
          {t.language === 'pt' ? 'Recarregar Créditos' : t.language === 'en' ? 'Recharge Credits' : 'Recargar Créditos'}
        </h3>

        {presetRechargeAmount && presetRechargeAmount > 0 && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t.language === 'pt'
                ? `Saldo insuficiente para sua compra. Recarregue pelo menos ${formatPrice(presetRechargeAmount)} e escolha o método de pagamento abaixo.`
                : t.language === 'en'
                ? `Insufficient balance for your purchase. Recharge at least ${formatPrice(presetRechargeAmount)} and choose a payment method below.`
                : `Saldo insuficiente para su compra. Recarga al menos ${formatPrice(presetRechargeAmount)} y elige un método de pago abajo.`}
            </p>
          </div>
        )}

        {/* Quick Amount Selection */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
            {t.language === 'pt' ? 'Valores Rápidos' : t.language === 'en' ? 'Quick Amounts' : 'Montos Rápidos'}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setRechargeAmount(amount)}
                className={`p-2 sm:p-3 border-2 rounded-lg text-center transition-colors ${
                  rechargeAmount === amount
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="text-base sm:text-lg font-bold">${amount}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t.language === 'pt' ? 'Valor Personalizado' : t.language === 'en' ? 'Custom Amount' : 'Monto Personalizado'}
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <div className="relative flex-1 max-w-full sm:max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="number"
                step="0.01"
                min="1"
                max="10000"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  const value = parseFloat(e.target.value);
                  if (value && value >= 1) {
                    setRechargeAmount(value);
                  }
                }}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="1.00"
              />
            </div>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {t.language === 'pt' ? 'Mín: $1 • Máx: $10,000' : t.language === 'en' ? 'Min: $1 • Max: $10,000' : 'Mín: $1 • Máx: $10,000'}
            </span>
          </div>
        </div>

        {/* Payment Methods */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
            {t.language === 'pt' ? 'Escolha o Método de Pagamento' : t.language === 'en' ? 'Choose Payment Method' : 'Elige el Método de Pago'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {activeMethods.map((activeMethod) => {
              const method = PAYMENT_METHOD_META[activeMethod.method_id];
              if (!method) return null;
              return (
              <button
                key={activeMethod.method_id}
                onClick={() => handlePaymentMethodSelect(activeMethod.method_id, rechargeAmount)}
                disabled={rechargeAmount < (method.min_amount || 1) || rechargeAmount > (method.max_amount || 1000)}
                className="p-3 sm:p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center p-1 flex-shrink-0">
                    <img src={method.icon} alt={activeMethod.name} className="w-full h-full object-contain rounded-md" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">{activeMethod.name}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{method.description}</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex justify-between gap-2">
                    <span className="flex-shrink-0">Taxa:</span>
                    <span className="text-right truncate">{method.fees}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="flex-shrink-0">Tempo:</span>
                    <span className="text-right truncate">{method.processing_time}</span>
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            {t.language === 'pt' ? 'Histórico de Transações' : t.language === 'en' ? 'Transaction History' : 'Historial de Transacciones'}
          </h3>
          <button
            onClick={loadTransactions}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h4 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Nenhuma transação encontrada' : t.language === 'en' ? 'No transactions found' : 'No se encontraron transacciones'}
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t.language === 'pt' ? 'Suas transações aparecerão aqui' : t.language === 'en' ? 'Your transactions will appear here' : 'Tus transacciones aparecerán aquí'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Saldo Após
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {currentTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {getTransactionIcon(transaction.type)}
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {getTransactionLabel(transaction.type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {transaction.description}
                          </div>
                          {transaction.reference_type && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Ref: {transaction.reference_type}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-bold ${getTransactionColor(transaction.type)}`}>
                            {transaction.amount >= 0 ? '+' : ''}{formatPrice(transaction.amount)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatPrice(transaction.balance_after)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(transaction.created_at).toLocaleDateString(
                                t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(transaction.created_at).toLocaleTimeString(
                              t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {currentTransactions.map((transaction) => (
                <div key={transaction.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      {getTransactionIcon(transaction.type)}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {getTransactionLabel(transaction.type)}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {transaction.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${getTransactionColor(transaction.type)}`}>
                        {transaction.amount >= 0 ? '+' : ''}${transaction.amount.toFixed(2)}
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Saldo: {formatPrice(transaction.balance_after)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(transaction.created_at).toLocaleDateString(
                          t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                        )} {new Date(transaction.created_at).toLocaleTimeString(
                          t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                        )}
                      </span>
                    </div>
                    {transaction.reference_type && (
                      <span>Ref: {transaction.reference_type}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {t.language === 'pt' ? 'Página' : t.language === 'en' ? 'Page' : 'Página'} {currentPage} {t.language === 'pt' ? 'de' : t.language === 'en' ? 'of' : 'de'} {totalPages}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      ({startIndex + 1}-{Math.min(endIndex, transactions.length)} {t.language === 'pt' ? 'de' : t.language === 'en' ? 'of' : 'de'} {transactions.length})
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Modals */}
      <StripePaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'stripe'}
        onClose={() => setShowPaymentModal(false)}
        amount={rechargeAmount}
        onSuccess={handlePaymentSuccess}
      />

      <PayPalPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'paypal'}
        onClose={() => setShowPaymentModal(false)}
        amount={rechargeAmount}
        onSuccess={handlePaymentSuccess}
      />

      <MercadoPagoPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'mercadopago'}
        onClose={() => setShowPaymentModal(false)}
        amount={rechargeAmount}
        onSuccess={handlePaymentSuccess}
      />

      <WhatsAppPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'whatsapp'}
        onClose={() => setShowPaymentModal(false)}
        amount={rechargeAmount}
        onSuccess={handlePaymentSuccess}
      />

      <CryptomusPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'cryptomus'}
        onClose={() => setShowPaymentModal(false)}
        amount={rechargeAmount}
        onSuccess={handlePaymentSuccess}
      />

      <BinancePaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'binance'}
        onClose={() => setShowPaymentModal(false)}
        amount={rechargeAmount}
        onSuccess={handlePaymentSuccess}
      />

      <TripleAPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'triplea'}
        onClose={() => setShowPaymentModal(false)}
        amount={rechargeAmount}
        onSuccess={handlePaymentSuccess}
      />

      <AsaasPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'asaas'}
        onClose={() => setShowPaymentModal(false)}
        amount={rechargeAmount}
        onSuccess={handlePaymentSuccess}
      />

      <InfinitePayPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'infinitepay'}
        onClose={() => setShowPaymentModal(false)}
        amount={rechargeAmount}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}