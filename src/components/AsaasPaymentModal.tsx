import React, { useState, useEffect } from 'react';
import { X, CreditCard, QrCode, Copy, Check, Clock, AlertTriangle, RefreshCw, Loader, FileText, User, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface AsaasPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

interface PaymentData {
  id: string;
  status: string;
  external_reference: string;
  qr_code?: string;
  qr_code_base64?: string;
  invoice_url?: string;
  billing_type: string;
}

function sanitizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

function formatCpf(value: string): string {
  const digits = sanitizeCpf(value).slice(0, 11);
  if (digits.length > 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  } else if (digits.length > 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  } else if (digits.length > 3) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  return digits;
}

export function AsaasPaymentModal({ isOpen, onClose, amount, onSuccess }: AsaasPaymentModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto'>('pix');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [customerName, setCustomerName] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      setPaymentData(null);
      setError('');
      setTimeLeft(0);
      setCustomerName('');
      setCustomerCpf('');
      setFormError('');
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (paymentData) {
      const expiryTime = Date.now() + (30 * 60 * 1000);
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, expiryTime - now);
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [paymentData]);

  function validateForm(): boolean {
    setFormError('');
    const name = customerName.trim();
    if (name.length < 3) {
      setFormError('Por favor, informe seu nome completo.');
      return false;
    }
    if (name.trim().split(/\s+/).length < 2) {
      setFormError('Por favor, informe nome e sobrenome.');
      return false;
    }
    const cpfDigits = sanitizeCpf(customerCpf);
    if (cpfDigits.length !== 11) {
      setFormError('Por favor, informe um CPF valido com 11 digitos.');
      return false;
    }
    return true;
  }

  async function createPayment() {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Nao autenticado');
      }

      const [firstName, ...rest] = customerName.trim().split(/\s+/);
      const lastName = rest.join(' ');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-asaas-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          payment_method: paymentMethod,
          payer: {
            email: user?.email,
            first_name: firstName,
            last_name: lastName,
            cpf: sanitizeCpf(customerCpf),
          }
        })
      });

      const text = await response.text();
      let result: any;
      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Erro de comunicação com o servidor. Tente novamente.');
      }

      if (!response.ok) {
        throw new Error(result.details || result.error || result.message || 'Erro ao criar pagamento');
      }

      setPaymentData(result.payment);
      startPaymentPolling(result.payment.external_reference);

    } catch (error) {
      console.error('Error creating Asaas payment:', error);
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

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-asaas-payment`, {
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
        } else if (result.payment && ['REFUNDED', 'OVERDUE'].includes(result.payment.status)) {
          clearInterval(pollInterval);
          setError('Pagamento expirado ou reembolsado');
        }
      } catch (error) {
        console.error('Error polling payment:', error);
      }
    }, 10000);

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
        throw new Error('Nao autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-asaas-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: paymentData.external_reference })
      });

      const checkText = await response.text();
      let result: any;
      try { result = checkText ? JSON.parse(checkText) : {}; } catch {
        throw new Error('Erro de comunicação com o servidor. Tente novamente.');
      }

      if (result.success && result.payment) {
        if (result.payment.status === 'approved') {
          alert('Pagamento confirmado! Seus creditos foram adicionados.');
          onSuccess();
          onClose();
          return;
        }
        if (['REFUNDED', 'OVERDUE'].includes(result.payment.status)) {
          setError('Pagamento expirado ou reembolsado.');
          return;
        }
        alert('Pagamento ainda nao confirmado. Aguarde alguns minutos apos efetuar o pagamento.');
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
            Pagamento via Asaas
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
                Escolha o metodo de pagamento
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
                    Pagamento instantaneo
                  </p>
                </button>

                <button
                  onClick={() => setPaymentMethod('boleto')}
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    paymentMethod === 'boleto'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <FileText className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <h5 className="font-medium text-gray-900 dark:text-white">Boleto</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Vencimento em 1 dia util
                  </p>
                </button>
              </div>
            </div>

            {/* Customer Data Form */}
            <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                <User className="h-4 w-4 mr-2 text-gray-500" />
                Dados do comprador
              </h4>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome completo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Digite seu nome completo"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CPF
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={customerCpf}
                    onChange={(e) => setCustomerCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Obrigatorio para gerar cobrancas via Asaas.
                </p>
              </div>

              {formError && (
                <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                  {formError}
                </div>
              )}
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
                  <span className="text-blue-700 dark:text-blue-400 text-sm">Creditos:</span>
                  <span className="ml-2 font-bold text-green-600 dark:text-green-400">
                    ${amount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700 dark:text-blue-400 text-sm">Metodo:</span>
                  <span className="ml-2 font-medium text-blue-900 dark:text-blue-200">
                    {paymentMethod === 'pix' ? 'PIX' : 'Boleto'}
                  </span>
                </div>
              </div>
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
                    <FileText className="h-4 w-4" />
                  )}
                  <span>
                    {paymentMethod === 'pix' ? 'Gerar PIX' : 'Gerar Boleto'}
                  </span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* PIX QR Code */}
            {paymentMethod === 'pix' && paymentData.qr_code_base64 && (
              <div className="space-y-4">
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

                {paymentData.qr_code && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Codigo PIX Copia e Cola
                    </h4>
                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-3">
                      <code className="text-xs text-gray-900 dark:text-white break-all flex-1 mr-3">
                        {paymentData.qr_code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(paymentData.qr_code!)}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        title="Copiar codigo PIX"
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

            {/* Boleto */}
            {paymentMethod === 'boleto' && paymentData.invoice_url && (
              <div className="text-center space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                  <h4 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">
                    Boleto Gerado!
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                    Clique no botao abaixo para visualizar e imprimir seu boleto bancario.
                  </p>
                  <a
                    href={paymentData.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Abrir Boleto
                  </a>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                {paymentMethod === 'pix' ? 'Como Pagar com PIX' : 'Como Pagar o Boleto'}
              </h4>
              {paymentMethod === 'pix' ? (
                <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Abra o app do seu banco</li>
                  <li>Va para a area PIX</li>
                  <li>Escolha "Pagar com QR Code" ou "Copia e Cola"</li>
                  <li>Escaneie o codigo ou cole o texto acima</li>
                  <li>Confirme o valor: <strong>R$ {(amount * 5.5).toFixed(2)}</strong></li>
                  <li>Finalize o pagamento</li>
                  <li>Aguarde a confirmacao (geralmente instantanea)</li>
                </ol>
              ) : (
                <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Abra o boleto clicando no botao acima</li>
                  <li>Pague no seu internet banking ou em uma agencia bancaria</li>
                  <li>O credito e adicionado apos o pagamento ser confirmado (1 dia util)</li>
                </ol>
              )}
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
