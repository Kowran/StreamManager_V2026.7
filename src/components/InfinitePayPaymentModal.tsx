import React, { useState, useEffect } from 'react';
import { X, QrCode, Clock, AlertTriangle, RefreshCw, Loader, ExternalLink, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

interface InfinitePayPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

export function InfinitePayPaymentModal({ isOpen, onClose, amount, onSuccess }: InfinitePayPaymentModalProps) {
  const { user } = useAuth();
  const [paymentData, setPaymentData] = useState<{ checkout_url: string; order_id: string; status: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (isOpen && user) {
      setPaymentData(null);
      setError('');
      setTimeLeft(0);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (paymentData) {
      const expiryTime = Date.now() + (30 * 60 * 1000);
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, expiryTime - now);
        setTimeLeft(remaining);
        if (remaining <= 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [paymentData]);

  async function createPayment() {
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Nao autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-infinitepay-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount })
      });

      const text = await response.text();
      let result: any;
      try { result = text ? JSON.parse(text) : {}; }
      catch { throw new Error('Erro de comunicacao com o servidor.'); }

      if (!response.ok) {
        throw new Error(result.details || result.error || result.message || 'Erro ao criar pagamento');
      }

      setPaymentData(result.payment);
      startPaymentPolling(result.payment.order_id);

      window.open(result.payment.checkout_url, '_blank');

    } catch (error) {
      console.error('Error creating InfinitePay payment:', error);
      setError(error instanceof Error ? error.message : 'Erro ao criar pagamento');
    } finally {
      setLoading(false);
    }
  }

  function startPaymentPolling(orderId: string) {
    const pollInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-infinitepay-payment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ order_id: orderId })
        });

        const pollText = await response.text();
        let result: any;
        try { result = pollText ? JSON.parse(pollText) : {}; } catch { result = {}; }

        if (result.success && result.payment && result.payment.status === 'approved') {
          clearInterval(pollInterval);
          onSuccess();
          onClose();
        }
      } catch (error) {
        console.error('Error polling payment:', error);
      }
    }, 10000);

    setTimeout(() => clearInterval(pollInterval), 15 * 60 * 1000);
  }

  async function checkPaymentStatus() {
    if (!paymentData) return;

    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Nao autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-infinitepay-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: paymentData.order_id })
      });

      const checkText = await response.text();
      let result: any;
      try { result = checkText ? JSON.parse(checkText) : {}; }
      catch { throw new Error('Erro de comunicacao com o servidor.'); }

      if (result.success && result.payment && result.payment.status === 'approved') {
        onSuccess();
        onClose();
        return;
      }

      alert('Pagamento ainda nao confirmado. Aguarde alguns minutos apos efetuar o pagamento.');
    } catch (error) {
      console.error('Error checking payment:', error);
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

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 dark:bg-indigo-900/20 p-2 rounded-lg">
              <QrCode className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Pagamento via InfinitePay (PIX)
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
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
              <h4 className="text-lg font-medium text-indigo-800 dark:text-indigo-300 mb-3">
                Resumo do Pagamento
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-indigo-700 dark:text-indigo-400 text-sm">Valor:</span>
                  <span className="ml-2 font-bold text-indigo-900 dark:text-indigo-200 text-lg">
                    R$ {(amount * 5.5).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-indigo-700 dark:text-indigo-400 text-sm">Creditos:</span>
                  <span className="ml-2 font-bold text-green-600 dark:text-green-400">
                    ${amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Como funciona o pagamento via InfinitePay
              </h4>
              <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
                <li>Clique em "Gerar PIX" abaixo</li>
                <li>Sera aberta a pagina de checkout do InfinitePay</li>
                <li>Escolha pagar com PIX ou cartao de credito</li>
                <li>Escaneie o QR Code ou copie o codigo PIX no app do seu banco</li>
                <li>Confirme o pagamento</li>
                <li>Seus creditos serao adicionados automaticamente</li>
              </ol>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                </div>
              </div>
            )}

            <button
              onClick={createPayment}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Criando pagamento...</span>
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4" />
                  <span>Gerar PIX</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                <ExternalLink className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Checkout InfinitePay Aberto!
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Uma nova aba foi aberta com a pagina de pagamento. Complete o pagamento la.
              </p>
            </div>

            <a
              href={paymentData.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4 inline mr-2" />
              Reabrir Checkout
            </a>

            {timeLeft > 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-2">
                  <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-lg font-bold text-indigo-800 dark:text-indigo-300">
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-sm text-indigo-600 dark:text-indigo-400">restantes</span>
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                Como Pagar com PIX
              </h4>
              <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Acesse a pagina de checkout do InfinitePay</li>
                <li>Escolha a opcao PIX</li>
                <li>Escaneie o QR Code ou copie o codigo PIX</li>
                <li>Confirme o valor: <strong>R$ {(amount * 5.5).toFixed(2)}</strong></li>
                <li>Finalize o pagamento no app do seu banco</li>
                <li>Aguarde a confirmacao (geralmente instantanea)</li>
              </ol>
            </div>

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
