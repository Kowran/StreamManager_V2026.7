import React, { useState, useEffect } from 'react';
import { X, CreditCard, ExternalLink, RefreshCw, Clock, AlertTriangle, Loader, CheckCircle, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface PayPalPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

interface PaymentData {
  id: string;
  status: string;
  approval_url: string;
  amount: number;
  total_charged: number;
  paypal_fee: number;
  order_id: string;
  expires_at: string;
}

interface PayPalFees {
  originalAmount: number;
  paypalFee: number;
  totalAmount: number;
}

export function PayPalPaymentModal({ isOpen, onClose, amount, onSuccess }: PayPalPaymentModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (paymentData && paymentData.expires_at) {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(paymentData.expires_at).getTime();
        const remaining = Math.max(0, expiry - now);
        setTimeLeft(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [paymentData]);

  function calculatePayPalFees(amount: number): PayPalFees {
    // Fee: $0.40 + 10.00%
    const feePercentage = 0.10; // 10%
    const fixedFee = 0.40; // $0.40
    const paypalFee = (amount * feePercentage) + fixedFee;
    const totalAmount = amount + paypalFee;
    
    return {
      originalAmount: amount,
      paypalFee: paypalFee,
      totalAmount: totalAmount
    };
  }

  async function createPayment() {
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const fees = calculatePayPalFees(amount);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-paypal-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount, // Créditos que o usuário receberá
          total_charged: fees.totalAmount, // Valor total cobrado incluindo taxas
          paypal_fee: fees.paypalFee, // Taxa do PayPal
          currency: 'USD', // Sempre cobrar em USD
          description: `Recarga de créditos StreamManager - $${amount.toFixed(2)} (+ taxas $${fees.paypalFee.toFixed(2)})`,
          metadata: {
            user_id: user.id,
            user_email: user.email,
            type: 'credit_recharge',
            original_amount: amount.toString(),
            paypal_fee: fees.paypalFee.toString(),
            total_charged: fees.totalAmount.toString()
          }
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Handle specific PayPal errors with detailed messages
        if (result.details === 'PAYEE_ACCOUNT_RESTRICTED') {
          throw new Error('PayPal está temporariamente indisponível. Tente outro método de pagamento.');
        }
        
        if (result.error === 'PayPal not configured') {
          throw new Error('PayPal não está configurado. Entre em contato com o administrador.');
        }
        
        if (result.details === 'AUTHENTICATION_FAILURE') {
          throw new Error('Erro de autenticação PayPal. Verifique as configurações.');
        }
        
        throw new Error(result.message || result.error || 'Erro ao criar pagamento PayPal');
      }

      if (result.success && result.approval_url) {
        setPaymentData(result);
        
        // Open PayPal in new window
        window.open(result.approval_url, '_blank');
        
        // Start polling for payment confirmation
        startPaymentPolling(result.order_id);
      } else {
        throw new Error('Resposta inválida do servidor');
      }

    } catch (error) {
      console.error('Error creating PayPal payment:', error);
      setError(error instanceof Error ? error.message : 'Erro ao criar pagamento PayPal');
    } finally {
      setLoading(false);
    }
  }

  function startPaymentPolling(orderId: string) {
    const pollInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-paypal-payment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: orderId
          })
        });

        const result = await response.json();
        
        if (result.success && result.payment && result.payment.status === 'COMPLETED') {
          clearInterval(pollInterval);
          onSuccess();
          onClose();
        } else if (result.payment && (result.payment.status === 'CANCELLED' || result.payment.status === 'FAILED')) {
          clearInterval(pollInterval);
          setError('Pagamento foi cancelado ou falhou');
        }
      } catch (error) {
        console.error('Error polling PayPal payment:', error);
      }
    }, 10000); // Check every 10 seconds

    // Stop polling after 30 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 30 * 60 * 1000);
  }

  async function checkPaymentStatus() {
    if (!paymentData) return;

    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-paypal-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: paymentData.order_id
        })
      });

      const result = await response.json();
      
      if (result.success && result.payment) {
        if (result.payment.status === 'COMPLETED') {
          alert('✅ Pagamento confirmado! Seus créditos foram adicionados à sua conta.');
          onSuccess();
          onClose();
          return;
        }
        if (result.payment.status === 'CANCELLED') {
          setError('Pagamento foi cancelado.');
          return;
        }
        if (result.payment.status === 'FAILED') {
          setError('Pagamento falhou. Tente novamente.');
          return;
        }
        
        // Payment is still pending
        alert('Pagamento ainda não foi confirmado. Complete o pagamento na janela do PayPal.');
      } else {
        alert('Erro ao verificar pagamento: ' + (result.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Error checking PayPal payment:', error);
      alert('Erro ao verificar pagamento. Tente novamente.');
    } finally {
      setChecking(false);
    }
  }

  function formatTime(ms: number) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  if (!isOpen) return null;

  const fees = calculatePayPalFees(amount);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Pagamento via PayPal
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {!paymentData ? (
          <div className="space-y-6">
            {/* Payment Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-3">
                Resumo do Pagamento
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 dark:text-blue-400">Créditos a receber:</span>
                  <span className="font-bold text-blue-900 dark:text-blue-200">
                    ${amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 dark:text-blue-400">Taxa PayPal:</span>
                  <span className="text-blue-800 dark:text-blue-300">
                    ${fees.paypalFee.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-blue-200 dark:border-blue-700 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 dark:text-blue-400 font-medium">Total a pagar:</span>
                    <span className="font-bold text-blue-900 dark:text-blue-200 text-lg">
                      ${fees.totalAmount.toFixed(2)} USD
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                  💡 Pagamento processado em Dólar Americano (USD)
                </p>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                </div>
              </div>
            )}

            {/* Create Payment Button */}
            <button
              onClick={createPayment}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Criando pagamento...</span>
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4" />
                  <span>Pagar ${fees.totalAmount.toFixed(2)} USD</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Payment Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">
                Resumo do Pagamento
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 dark:text-blue-400">Créditos a receber:</span>
                  <span className="font-bold text-blue-900 dark:text-blue-200">
                    ${amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 dark:text-blue-400">Total cobrado:</span>
                  <span className="font-bold text-blue-900 dark:text-blue-200">
                    ${paymentData.total_charged.toFixed(2)} USD
                  </span>
                </div>
              </div>
            </div>

            {/* Timer */}
            {timeLeft > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-2">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <span className="text-lg font-bold text-orange-800 dark:text-orange-300">
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-sm text-orange-600 dark:text-orange-400">restantes</span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                </div>
              </div>
            )}

            {/* Payment Status */}
            <div className="text-center space-y-4">
              <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                <ExternalLink className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Complete o Pagamento no PayPal
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Uma nova janela foi aberta com a página oficial do PayPal. Complete o pagamento lá e retorne aqui.
                </p>
              </div>
              
              <a
                href={paymentData.approval_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir PayPal Novamente
              </a>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                💳 Como Completar o Pagamento
              </h4>
              <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Complete o pagamento na janela do PayPal que foi aberta</li>
                <li>Faça login na sua conta PayPal ou pague como convidado</li>
                <li>Confirme o pagamento de ${fees.totalAmount.toFixed(2)} USD</li>
                <li>Autorize o pagamento</li>
                <li>Retorne a esta página</li>
                <li>Clique em "Verificar Status" para confirmar</li>
                <li>Seus ${amount.toFixed(2)} créditos serão adicionados automaticamente</li>
              </ol>
            </div>

            {/* Security Info */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                🔒 Pagamento Seguro
              </h4>
              <ul className="text-xs text-green-700 dark:text-green-400 space-y-1">
                <li>• Processado com segurança pelo PayPal</li>
                <li>• Pagamento em Dólar Americano (USD)</li>
                <li>• Aceita cartões internacionais e saldo PayPal</li>
                <li>• Seus dados financeiros são protegidos</li>
                <li>• Não armazenamos informações de pagamento</li>
                <li>• Certificação de segurança internacional</li>
                <li>• Proteção ao comprador PayPal</li>
                <li>• Taxa fixa: $0.40 + 10% do valor</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={checkPaymentStatus}
                disabled={checking}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                {checking ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Verificar Status
              </button>
              
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}