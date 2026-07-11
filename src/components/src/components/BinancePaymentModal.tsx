import React, { useState, useEffect } from 'react';
import { X, Copy, CheckCircle, Clock, QrCode, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import QRCodeLib from 'qrcode';

interface BinancePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

interface BinanceConfig {
  is_active: boolean;
}

export function BinancePaymentModal({ isOpen, onClose, amount, onSuccess }: BinancePaymentModalProps) {
  const { user, session } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [status, setStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [configEnabled, setConfigEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkBinanceConfig();
    }
  }, [isOpen]);

  useEffect(() => {
    if (orderId && status === 'pending') {
      const interval = setInterval(checkPaymentStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [orderId, status]);

  const checkBinanceConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('binance_config')
        .select('is_active')
        .maybeSingle();

      if (error) throw error;
      setConfigEnabled(data?.is_active || false);

      if (!data?.is_active) {
        setError('Pagamentos via Binance Pay não estão disponíveis no momento');
      }
    } catch (err) {
      console.error('Error checking Binance config:', err);
      setError('Erro ao verificar configuração do Binance Pay');
    }
  };

  const createPayment = async () => {
    if (!user || !session || !configEnabled) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-binance-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          amount: amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar pagamento');
      }

      setPaymentUrl(data.payment_url);
      setOrderId(data.order_id);

      if (data.qr_image_url) {
        setQrCode(data.qr_image_url);
      } else {
        const qr = await QRCodeLib.toDataURL(data.payment_url);
        setQrCode(qr);
      }

    } catch (err: any) {
      console.error('Error creating Binance payment:', err);
      const errorMsg = err.message || t.paymentCreationError;

      if (errorMsg.includes('Failed to create Binance payment') ||
          errorMsg.includes('geo') ||
          errorMsg.includes('region') ||
          errorMsg.includes('location')) {
        setError(t.binanceGeoBlockError);
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!orderId || !session) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-binance-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await response.json();

      if (data.status === 'completed') {
        setStatus('completed');
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else if (data.status === 'failed') {
        setStatus('failed');
        setError('Pagamento falhou ou foi cancelado');
      }
    } catch (err) {
      console.error('Error checking payment status:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setPaymentUrl('');
    setOrderId('');
    setQrCode('');
    setStatus('pending');
    setError('');
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🪙</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Binance Pay</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Valor: ${amount.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {!paymentUrl && !loading && !error && configEnabled && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Como funciona</h3>
                <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Clique em "Gerar Pagamento"</li>
                  <li>Escaneie o QR Code com o app Binance</li>
                  <li>Confirme o pagamento no Binance Pay</li>
                  <li>Aguarde a confirmação automática</li>
                </ol>
              </div>

              <button
                onClick={createPayment}
                className="w-full py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                Gerar Pagamento
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Gerando pagamento...</p>
            </div>
          )}

          {paymentUrl && status === 'pending' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border-2 border-yellow-600">
                <div className="flex justify-center mb-4">
                  {qrCode && (
                    <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                  )}
                </div>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Escaneie o QR Code com o app Binance
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ou copie o link de pagamento:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(paymentUrl)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                    Aguardando pagamento
                  </p>
                  <p className="text-xs text-yellow-800 dark:text-yellow-400 mt-1">
                    A confirmação é automática. Não feche esta janela.
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Pagamento Confirmado!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Seus créditos foram adicionados à sua conta
              </p>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Pagamento Falhou
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                O pagamento não foi concluído. Tente novamente.
              </p>
              <button
                onClick={() => {
                  setPaymentUrl('');
                  setOrderId('');
                  setQrCode('');
                  setStatus('pending');
                  setError('');
                }}
                className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>

        {paymentUrl && status === 'pending' && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
