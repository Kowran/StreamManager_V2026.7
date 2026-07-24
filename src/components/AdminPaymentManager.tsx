import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, TrendingUp, AlertCircle, CheckCircle, Clock, X, RefreshCw, Eye, Power, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

interface Payment {
  id: string;
  user_id: string;
  order_id: string;
  amount_usd: number;
  currency: string;
  status: string;
  payment_method: string;
  stripe_fee?: number;
  total_charged?: number;
  created_at: string;
  updated_at: string;
  user_email?: string;
}

interface PaymentStats {
  total_payments: number;
  total_amount: number;
  pending_payments: number;
  completed_payments: number;
  failed_payments: number;
}

interface PaymentMethodConfig {
  id: string;
  method_id: string;
  name: string;
  is_active: boolean;
  status: 'active' | 'hidden' | 'inactive';
  display_order: number;
}

const METHOD_ICONS: Record<string, string> = {
  stripe: 'https://i.imgur.com/Un7zfmo.png',
  paypal: 'https://i.imgur.com/VbyIdkc.png',
  mercadopago: 'https://i.imgur.com/3oeBwGn.jpeg',
  cryptomus: 'https://i.imgur.com/nXhq7ph.png',
  binance: 'https://i.imgur.com/ylT9tJ1.png',
  whatsapp: 'https://i.imgur.com/Ei6JERR.png',
  triplea: 'https://i.imgur.com/nXhq7ph.png',
  asaas: 'https://i.imgur.com/3oeBwGn.jpeg',
  infinitepay: 'https://i.imgur.com/3oeBwGn.jpeg',
};

export default function AdminPaymentManager() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    total_payments: 0,
    total_amount: 0,
    pending_payments: 0,
    completed_payments: 0,
    failed_payments: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [methodConfigs, setMethodConfigs] = useState<PaymentMethodConfig[]>([]);
  const [togglingMethod, setTogglingMethod] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    active: { label: 'Ativo', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-300 dark:border-green-700', dot: 'bg-green-500' },
    hidden: { label: 'Oculto', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', dot: 'bg-amber-500' },
    inactive: { label: 'Desativado', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-300 dark:border-red-700', dot: 'bg-red-500' },
  };

  useEffect(() => {
    fetchStripePayments();
    fetchStats();
    fetchMethodConfigs();
  }, [filter]);

  async function fetchMethodConfigs() {
    try {
      const { data, error } = await supabase
        .from('payment_methods_config')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      setMethodConfigs(data || []);
    } catch (error) {
      console.error('Error fetching payment method configs:', error);
    }
  }

  async function toggleMethod(methodId: string, currentActive: boolean) {
    setTogglingMethod(methodId);
    try {
      const newStatus = currentActive ? 'inactive' : 'active';
      const { error } = await supabase
        .from('payment_methods_config')
        .update({ is_active: !currentActive, status: newStatus, updated_at: new Date().toISOString() })
        .eq('method_id', methodId);
      if (error) throw error;
      setMethodConfigs(prev =>
        prev.map(m => m.method_id === methodId ? { ...m, is_active: !currentActive, status: newStatus } : m)
      );
    } catch (error) {
      console.error('Error toggling payment method:', error);
      alert('Erro ao alterar status do método de pagamento');
    } finally {
      setTogglingMethod(null);
    }
  }

  async function updateMethodStatus(methodId: string, newStatus: 'active' | 'hidden' | 'inactive') {
    setUpdatingStatus(methodId);
    try {
      const { error } = await supabase
        .from('payment_methods_config')
        .update({ status: newStatus, is_active: newStatus === 'active', updated_at: new Date().toISOString() })
        .eq('method_id', methodId);
      if (error) throw error;
      setMethodConfigs(prev =>
        prev.map(m => m.method_id === methodId ? { ...m, status: newStatus, is_active: newStatus === 'active' } : m)
      );
    } catch (error) {
      console.error('Error updating payment method status:', error);
      alert('Erro ao alterar status do método de pagamento');
    } finally {
      setUpdatingStatus(null);
    }
  }

  const fetchStripePayments = async () => {
    try {
      setLoading(true);
      
      // First, fetch payments
      let paymentsQuery = supabase
        .from('stripe_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        paymentsQuery = paymentsQuery.eq('status', filter);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;

      if (paymentsError) throw paymentsError;

      if (!paymentsData || paymentsData.length === 0) {
        setPayments([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(paymentsData.map(p => p.user_id))];
      
      // Fetch user profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to email
      const userEmailMap = new Map();
      profilesData?.forEach(profile => {
        userEmailMap.set(profile.id, profile.email);
      });

      // Combine payments with user emails
      const formattedPayments = paymentsData.map(payment => ({
        ...payment,
        user_email: userEmailMap.get(payment.user_id) || 'Unknown',
        payment_method: 'stripe'
      }));

      setPayments(formattedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: stripeData, error: stripeError } = await supabase
        .from('stripe_payments')
        .select('status, amount_usd');

      if (stripeError) throw stripeError;

      const stats = (stripeData || []).reduce((acc, payment) => {
        acc.total_payments++;
        acc.total_amount += parseFloat(payment.amount_usd || '0');

        switch (payment.status) {
          case 'pending':
            acc.pending_payments++;
            break;
          case 'paid':
          case 'approved':
            acc.completed_payments++;
            break;
          case 'failed':
          case 'cancelled':
          case 'expired':
            acc.failed_payments++;
            break;
        }

        return acc;
      }, {
        total_payments: 0,
        total_amount: 0,
        pending_payments: 0,
        completed_payments: 0,
        failed_payments: 0
      });

      setStats(stats);
    } catch (error) {
      console.error('Error fetching payment stats:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
      case 'cancelled':
      case 'expired':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'cancelled':
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciar Pagamentos</h2>
        <button
          onClick={() => {
            fetchStripePayments();
            fetchStats();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </button>
      </div>

      {/* Payment Methods Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Power className="h-5 w-5 text-blue-600" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            Métodos de Pagamento
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Controle o status de cada método: <span className="font-medium text-green-600 dark:text-green-400">Ativo</span> (visível e usável), <span className="font-medium text-amber-600 dark:text-amber-400">Oculto</span> (não exibido aos clientes) ou <span className="font-medium text-red-600 dark:text-red-400">Desativado</span> (exibido mas bloqueado).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {methodConfigs.map((method) => {
            const statusInfo = STATUS_CONFIG[method.status] || STATUS_CONFIG.inactive;
            return (
            <div
              key={method.method_id}
              className={`flex flex-col p-3 rounded-lg border transition-colors ${statusInfo.border} ${statusInfo.bg}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center p-1 flex-shrink-0">
                    <img src={METHOD_ICONS[method.method_id] || ''} alt={method.name} className="w-full h-full object-contain rounded-md" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{method.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${statusInfo.dot}`} />
                      <p className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {(['active', 'hidden', 'inactive'] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const isSelected = method.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => updateMethodStatus(method.method_id, s)}
                      disabled={updatingStatus === method.method_id || isSelected}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? `${cfg.border} ${cfg.bg} ${cfg.color} cursor-default`
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <CreditCard className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Pagamentos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_payments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Valor Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.total_amount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pendentes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending_payments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Confirmados</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed_payments}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        {['all', 'pending', 'paid', 'failed', 'cancelled', 'expired'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {status === 'all' ? 'Todos' :
             status === 'pending' ? 'Pendentes' :
             status === 'paid' ? 'Pagos' :
             status === 'failed' ? 'Falharam' :
             status === 'cancelled' ? 'Cancelados' :
             status === 'expired' ? 'Expirados' :
             status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Payment ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Créditos / Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Método
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                    {payment.order_id?.slice(0, 8) + '...'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {payment.user_email || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div>
                      <div className="font-medium text-green-600">
                        {formatCurrency(payment.amount_usd)} créditos
                      </div>
                      {payment.total_charged && payment.total_charged !== payment.amount_usd && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Total: {formatCurrency(payment.total_charged)}
                          {payment.stripe_fee && (
                            <span className="text-red-600"> (taxa: {formatCurrency(payment.stripe_fee)})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(payment.status)}
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payment.status)}`}>
                        {payment.status === 'paid' ? 'Pago' :
                         payment.status === 'pending' ? 'Pendente' :
                         payment.status === 'failed' ? 'Falhou' :
                         payment.status === 'cancelled' ? 'Cancelado' :
                         payment.status === 'expired' ? 'Expirado' :
                         payment.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <span className="capitalize">{payment.payment_method}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatDate(payment.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedPayment(payment)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payments.length === 0 && (
          <div className="text-center py-12">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {filter === 'all' ? 'Nenhum pagamento encontrado' : `Nenhum pagamento ${filter} encontrado`}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {filter === 'all'
                ? 'Nenhum pagamento Stripe foi feito ainda.'
                : `Nenhum pagamento ${filter} encontrado.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Detalhes do Pagamento</h3>
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Payment ID
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                      {selectedPayment.id}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Order ID
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                      {selectedPayment.order_id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email do Usuário</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedPayment.user_email || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Créditos Recebidos
                    </label>
                    <p className="mt-1 text-sm font-bold text-green-600">
                      {formatCurrency(selectedPayment.amount_usd)}
                    </p>
                    {selectedPayment.total_charged && selectedPayment.total_charged !== selectedPayment.amount_usd && (
                      <div className="mt-1">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Total Cobrado: {formatCurrency(selectedPayment.total_charged)}</p>
                        {selectedPayment.stripe_fee && (
                          <p className="text-xs text-red-600 dark:text-red-400">Taxa Stripe: {formatCurrency(selectedPayment.stripe_fee)}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <div className="mt-1 flex items-center">
                      {getStatusIcon(selectedPayment.status)}
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedPayment.status)}`}>
                        {selectedPayment.status === 'paid' ? 'Pago' :
                         selectedPayment.status === 'pending' ? 'Pendente' :
                         selectedPayment.status === 'failed' ? 'Falhou' :
                         selectedPayment.status === 'cancelled' ? 'Cancelado' :
                         selectedPayment.status === 'expired' ? 'Expirado' :
                         selectedPayment.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Método de Pagamento</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                      Stripe (Cartão)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Criado em</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedPayment.created_at)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Atualizado em</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedPayment.updated_at)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}