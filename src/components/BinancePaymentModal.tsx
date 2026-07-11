import React, { useState, useEffect } from 'react';
import { X, Copy, CheckCircle, Clock, AlertTriangle, Search } from 'lucide-react';
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

type Step = 'init' | 'qr' | 'confirm' | 'verifying' | 'completed' | 'failed';

export function BinancePaymentModal({ isOpen, onClose, amount, onSuccess }: BinancePaymentModalProps) {
  const { user, session } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('init');
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [internalOrderId, setInternalOrderId] = useState(''); // prepayId from Binance
  const [qrCode, setQrCode] = useState('');
  const [userOrderId, setUserOrderId] = useState(''); // typed by user
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedBinanceId, setCopiedBinanceId] = useState(false);
  const [configEnabled, setConfigEnabled] = useState(false);
  const [binanceId, setBinanceId] = useState('1145829605');

  useEffect(() => {
    if (isOpen) {
      checkBinanceConfig();
    }
  }, [isOpen]);

  const checkBinanceConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('binance_config')
        .select('is_active, binance_id')
        .maybeSingle();
      if (error) throw error;
      setConfigEnabled(data?.is_active || false);
      if (data?.binance_id) setBinanceId(data.binance_id);
      if (!data?.is_active) {
        setError('Pagamentos via Binance Pay não estão disponíveis no momento');
      }
    } catch {
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
        body: JSON.stringify({ user_id: user.id, amount }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao criar pagamento');

      if (data.geo_blocked) {
        // Geo-blocked: show static QR, user pays manually and enters Order ID
        setPaymentUrl('');
        setInternalOrderId(data.order_id);
        setQrCode('/photo_2026-07-11_11-04-20.jpg');
        setStep('qr');
        return;
      }

      setPaymentUrl(data.payment_url);
      setInternalOrderId(data.order_id);

      let qrSrc: string;
      try {
        qrSrc = data.qr_image_url || (await QRCodeLib.toDataURL(data.payment_url));
      } catch {
        qrSrc = '/photo_2026-07-11_11-04-20.jpg';
      }
      setQrCode(qrSrc);
      setStep('qr');
    } catch (err: any) {
      const msg = err.message || t.paymentCreationError;
      if (msg.includes('geo') || msg.includes('region') || msg.includes('location') || msg.includes('country') || msg.includes('restricted')) {
        // Geo-blocked: show static QR and allow user to enter Order ID manually
        setQrCode('/photo_2026-07-11_11-04-20.jpg');
        setStep('qr');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async () => {
    if (!session) return;
    const trimmed = userOrderId.trim();
    if (!trimmed) {
      setError('Digite o ID da ordem gerado pelo Binance Pay.');
      return;
    }

    setStep('verifying');
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-binance-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: internalOrderId,
          user_order_id: trimmed,
        }),
      });

      const data = await response.json();

      if (data.status === 'completed') {
        setStep('completed');
        setTimeout(() => onSuccess(), 2000);
      } else if (data.status === 'failed') {
        setStep('failed');
        setError('Pagamento falhou ou foi cancelado.');
      } else {
        // still pending / not confirmed
        setStep('confirm');
        setError('Pagamento ainda não confirmado pela Binance. Verifique o ID e tente novamente.');
      }
    } catch (err: any) {
      setStep('confirm');
      setError(err.message || 'Erro ao verificar pagamento.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyBinanceId = () => {
    navigator.clipboard.writeText(binanceId);
    setCopiedBinanceId(true);
    setTimeout(() => setCopiedBinanceId(false), 2000);
  };

  const handleClose = () => {
    setStep('init');
    setPaymentUrl('');
    setInternalOrderId('');
    setQrCode('');
    setUserOrderId('');
    setError('');
    setCopied(false);
    setCopiedBinanceId(false);
    onClose();
  };

  const resetToConfirm = () => {
    setStep('qr');
    setPaymentUrl('');
    setInternalOrderId('');
    setQrCode('');
    setUserOrderId('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <span className="text-xl">🪙</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Binance Pay</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Valor: ${amount.toFixed(2)} USDT</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Step: init */}
          {step === 'init' && !loading && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Como funciona</h3>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
                  <li>Clique em <strong>Gerar Pagamento</strong></li>
                  <li>Escaneie o QR Code com o app Binance ou abra o link</li>
                  <li>Conclua o pagamento no app Binance Pay</li>
                  <li>Copie o <strong>Order ID</strong> exibido pela Binance e cole aqui</li>
                  <li>Clique em <strong>Verificar Pagamento</strong> para liberar seus créditos</li>
                </ol>
              </div>
              {configEnabled && (
                <button
                  onClick={createPayment}
                  className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Gerar Pagamento
                </button>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Gerando pagamento...</p>
            </div>
          )}

          {/* Step: qr — show QR and ask user to pay, then advance to confirm */}
          {step === 'qr' && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="border-2 border-yellow-400 dark:border-yellow-600 rounded-xl p-4 flex flex-col items-center gap-3 bg-white dark:bg-gray-700">
                {qrCode && <img src={qrCode} alt="QR Code Binance Pay" className="w-48 h-48" />}
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Escaneie com o app <strong>Binance</strong>
                </p>
              </div>

              {/* Binance ID for manual deposits */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <label className="block text-xs font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                  Binance ID para depósito
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={binanceId}
                    readOnly
                    className="flex-1 px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono font-bold"
                  />
                  <button
                    onClick={copyBinanceId}
                    className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors flex-shrink-0 flex items-center gap-1"
                  >
                    {copiedBinanceId ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedBinanceId ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-400">
                  Abra o app Binance, vá em <strong>Transferir → Enviar</strong>, cole este Binance ID e envie o valor de <strong>${amount.toFixed(2)} USDT</strong>.
                </p>
              </div>

              {/* Geo-block info banner */}
              {!paymentUrl && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
                  <strong>Atenção:</strong> Devido a restrições regionais, escaneie o QR code acima na Binance App ou use o Binance ID para depósito, e digite o ID do pedido na próxima etapa para confirmar seu pagamento.
                </div>
              )}

              {/* Payment link — only when dynamically generated */}
              {paymentUrl && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Ou abra o link de pagamento:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                  />
                  <button
                    onClick={() => copyToClipboard(paymentUrl)}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors flex-shrink-0"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              )}

              <button
                onClick={() => { setStep('confirm'); setError(''); }}
                className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors"
              >
                Já paguei — Confirmar pagamento
              </button>
            </div>
          )}

          {/* Step: confirm — user enters their Binance Order ID */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">Confirmação de pagamento</p>
                    <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                      Após concluir o pagamento no Binance Pay, abra o histórico de ordens e copie o <strong>Order ID</strong> gerado pela Binance. Cole abaixo para confirmar.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Order ID do Binance Pay
                </label>
                <input
                  type="text"
                  value={userOrderId}
                  onChange={e => { setUserOrderId(e.target.value); setError(''); }}
                  placeholder="Ex: 987654321012345678"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Encontre o Order ID no app Binance em <em>Carteira → Histórico → Binance Pay</em>.
                </p>
              </div>

              <button
                onClick={verifyPayment}
                disabled={!userOrderId.trim()}
                className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                Verificar Pagamento
              </button>

              <button
                onClick={() => setStep('qr')}
                className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Voltar ao QR Code
              </button>
            </div>
          )}

          {/* Step: verifying */}
          {step === 'verifying' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">Verificando pagamento...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Consultando a Binance para confirmar sua transação.
              </p>
            </div>
          )}

          {/* Step: completed */}
          {step === 'completed' && (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Pagamento Confirmado!</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Seus créditos foram adicionados à sua conta.</p>
            </div>
          )}

          {/* Step: failed */}
          {step === 'failed' && (
            <div className="text-center py-8 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pagamento não confirmado</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Não foi possível confirmar seu pagamento. Verifique o Order ID e tente novamente.
              </p>
              <button
                onClick={resetToConfirm}
                className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>

        {/* Footer cancel button while on qr/confirm steps */}
        {(step === 'qr' || step === 'confirm') && (
          <div className="px-6 pb-6">
            <button
              onClick={handleClose}
              className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
