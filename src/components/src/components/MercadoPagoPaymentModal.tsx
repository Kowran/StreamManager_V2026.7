import React, { useState, useEffect } from 'react';
import { X, CreditCard, QrCode, Copy, Check, Clock, AlertTriangle, RefreshCw, Smartphone, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

// Declare MercadoPago SDK types
declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface MercadoPagoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

interface PaymentData {
  id: number;
  status: string;
  payment_method_id: string;
  payment_type_id: string;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
  external_reference: string;
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  date_approved?: string;
}

export function MercadoPagoPaymentModal({ isOpen, onClose, amount, onSuccess }: MercadoPagoPaymentModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (isOpen && user) {
      // Reset state when modal opens
      setPaymentData(null);
      setError('');
      setTimeLeft(0);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (paymentData && paymentData.date_created) {
      // Set 30 minute timer for PIX payments
      const createdAt = new Date(paymentData.date_created).getTime();
      const expiryTime = createdAt + (30 * 60 * 1000); // 30 minutes
      
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const remaining = Math.max(0, expiryTime - now);
        setTimeLeft(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [paymentData]);

  async function createPixPayment() {
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mercadopago-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          payment_method: 'pix',
          payer: {
            email: user?.email,
            first_name: user?.email?.split('@')[0] || 'Usuario'
          }
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar pagamento PIX');
      }

      setPaymentData(result.payment);
      
      // Start polling for payment confirmation
      startPaymentPolling(result.payment.external_reference);

    } catch (error) {
      console.error('Error creating PIX payment:', error);
      setError(error instanceof Error ? error.message : 'Erro ao criar pagamento PIX');
    } finally {
      setLoading(false);
    }
  }

  async function createCardPayment() {
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mercadopago-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          payment_method: 'card',
          payer: {
            email: user?.email,
            first_name: user?.email?.split('@')[0] || 'Usuario'
          }
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar pagamento com cartão');
      }

      // Redirect to MercadoPago checkout page
      if (result.checkout_url) {
        window.open(result.checkout_url, '_blank');
        
        // Start polling for payment confirmation
        startPaymentPolling(result.payment_id);
        
        // Show waiting message
        setPaymentData({
          ...result,
          status: 'pending'
        });
        
        // Start polling for payment confirmation using external_reference
        startPaymentPolling(result.external_reference);
      } else {
        throw new Error('URL de checkout não recebida');
      }
    } catch (error) {
      console.error('Error creating card payment:', error);
      setError(error instanceof Error ? error.message : 'Erro ao processar pagamento com cartão');
    } finally {
      setLoading(false);
    }
  }

  function startPaymentPolling(orderId: string) {
    const pollInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-mercadopago-payment`, {
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
        
        if (result.success && result.payment && result.payment.status === 'approved') {
          clearInterval(pollInterval);
          onSuccess();
          onClose();
        } else if (result.payment && (result.payment.status === 'rejected' || result.payment.status === 'cancelled')) {
          clearInterval(pollInterval);
          setError('Pagamento foi rejeitado ou cancelado');
        } else if (!result.success || !result.payment) {
          // Handle API errors or missing payment data
          console.error('Payment check failed:', result.error || 'Payment data not found');
        }
      } catch (error) {
        console.error('Error polling payment:', error);
      }
    }, 10000); // Check every 10 seconds

    // Stop polling after 15 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 15 * 60 * 1000);
  }

  async function checkPaymentStatus() {
    if (!paymentData) return;

    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-mercadopago-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: paymentData.external_reference
        })
      });

      const result = await response.json();
      
      if (result.success && result.payment) {
        if (result.payment.status === 'approved') {
          alert('✅ Pagamento confirmado! Seus créditos foram adicionados à sua conta.');
          onSuccess();
          onClose();
          return;
        }
        if (result.payment.status === 'rejected') {
          setError('Pagamento foi rejeitado. Tente novamente.');
          return;
        }
        if (result.payment.status === 'cancelled') {
          setError('Pagamento foi cancelado.');
          return;
        }
        
        // Payment is still pending
        alert('Pagamento ainda não foi confirmado. Aguarde alguns minutos após efetuar o pagamento.');
      } else {
        alert('Erro ao verificar pagamento: ' + (result.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      alert('Erro ao verificar pagamento. Tente novamente.');
    } finally {
      setChecking(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      console.error('Error copying text:', error);
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
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Pagamento via Mercado Pago
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {!paymentData ? (
          <div className="space-y-6">
            {/* Payment Method Selection */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Escolha o método de pagamento
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setPaymentMethod('pix')}
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    paymentMethod === 'pix'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <QrCode className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <h5 className="font-medium text-gray-900 dark:text-white">PIX</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Pagamento instantâneo
                  </p>
                </button>

                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    paymentMethod === 'card'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <CreditCard className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <h5 className="font-medium text-gray-900 dark:text-white">Cartão</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Crédito ou débito
                  </p>
                </button>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-3">
                Resumo do Pagamento
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-blue-700 dark:text-blue-400 text-sm">Valor:</span>
                  <span className="ml-2 font-bold text-blue-900 dark:text-blue-200 text-lg">
                    R$ {(amount * 5.5).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700 dark:text-blue-400 text-sm">Créditos:</span>
                  <span className="ml-2 font-bold text-green-600 dark:text-green-400">
                    ${amount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700 dark:text-blue-400 text-sm">Método:</span>
                  <span className="ml-2 font-medium text-blue-900 dark:text-blue-200">
                    {paymentMethod === 'pix' ? 'PIX' : 'Cartão'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Form */}

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
              onClick={paymentMethod === 'pix' ? createPixPayment : createCardPayment}
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
                  {paymentMethod === 'pix' ? (
                    <QrCode className="h-4 w-4" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  <span>
                    {paymentMethod === 'pix' ? 'Gerar PIX' : 'Ir para Mercado Pago'}
                  </span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Payment Created - Show QR Code for PIX */}
            {paymentMethod === 'pix' && paymentData.qr_code_base64 && (
              <div className="space-y-4">
                {/* Timer */}
                {timeLeft > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center justify-center space-x-2">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-lg font-bold text-blue-800 dark:text-blue-300">
                        {formatTime(timeLeft)}
                      </span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">restantes</span>
                    </div>
                  </div>
                )}

                {/* QR Code */}
                <div className="text-center space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    Escaneie o QR Code PIX
                  </h4>
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                    <img
                      src={`data:image/png;base64,${paymentData.qr_code_base64}`}
                      alt="QR Code PIX"
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Use o app do seu banco para escanear e pagar
                  </p>
                </div>

                {/* PIX Copy and Paste */}
                {paymentData.qr_code && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Código PIX Copia e Cola
                    </h4>
                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-3">
                      <code className="text-xs text-gray-900 dark:text-white break-all flex-1 mr-3">
                        {paymentData.qr_code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(paymentData.qr_code!)}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        title="Copiar código PIX"
                      >
                        {copiedText === paymentData.qr_code ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Card Payment Status */}
            {paymentMethod === 'card' && (
              <div className="text-center space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">
                    Redirecionando para Mercado Pago
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Você será redirecionado para a página oficial do Mercado Pago para completar o pagamento com segurança.
                  </p>
                  <div className="mt-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                {paymentMethod === 'pix' ? '📱 Como Pagar com PIX' : '💳 Processamento do Cartão'}
              </h4>
              {paymentMethod === 'pix' ? (
                <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Abra o app do seu banco</li>
                  <li>Vá para a área PIX</li>
                  <li>Escolha "Pagar com QR Code" ou "Copia e Cola"</li>
                  <li>Escaneie o código ou cole o texto acima</li>
                  <li>Confirme o valor: <strong>R$ {(amount * 5.5).toFixed(2)}</strong></li>
                  <li>Finalize o pagamento</li>
                  <li>Aguarde a confirmação (geralmente instantânea)</li>
                </ol>
              ) : (
                <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Você será redirecionado para a página oficial do Mercado Pago</li>
                  <li>Escolha cartão de crédito, débito, PIX ou outros métodos</li>
                  <li>Complete o pagamento com segurança na plataforma oficial</li>
                  <li>Retorne a esta página após o pagamento</li>
                  <li>Seus créditos serão adicionados automaticamente quando confirmado</li>
                </ol>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center space-x-3">
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
                
                {paymentData.ticket_url && (
                  <a
                    href={paymentData.ticket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium rounded-lg transition-colors"
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Abrir no App
                  </a>
                )}
              </div>
              
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