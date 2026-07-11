import React, { useState, useEffect } from 'react';
import { X, Loader, ExternalLink, Coins, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface TripleAPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

export function TripleAPaymentModal({ isOpen, onClose, amount, onSuccess }: TripleAPaymentModalProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      createPayment();
    } else {
      setPaymentUrl('');
      setOrderId('');
      setPaymentId('');
      setError('');
    }
  }, [isOpen]);

  async function createPayment() {
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-triplea-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || 'Error creating payment';
        if (errorMessage.includes('not configured') || errorMessage.includes('nao configurado')) {
          throw new Error(language === 'pt'
            ? 'Triple-A nao esta configurado. Por favor, contate o administrador.'
            : 'Triple-A is not configured. Please contact the administrator.');
        }
        throw new Error(errorMessage);
      }

      setPaymentUrl(result.url);
      setOrderId(result.order_id);
      setPaymentId(result.payment_id);
      startPaymentCheck(result.order_id);
    } catch (error: any) {
      console.error('Error creating Triple-A payment:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function startPaymentCheck(orderId: string) {
    setChecking(true);
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('triplea_payments')
          .select('status')
          .eq('order_id', orderId)
          .single();

        if (data?.status === 'completed') {
          clearInterval(interval);
          setChecking(false);
          onSuccess();
          onClose();
        }
      } catch (error) {
        console.error('Error checking Triple-A payment:', error);
      }
    }, 5000);

    setTimeout(() => {
      clearInterval(interval);
      setChecking(false);
    }, 600000);
  }

  if (!isOpen) return null;

  const translations = {
    title: language === 'pt' ? 'Pagamento Triple-A' : language === 'en' ? 'Triple-A Payment' : 'Pago Triple-A',
    creatingPayment: language === 'pt' ? 'Criando pagamento...' : 'Creating payment...',
    amountToPay: language === 'pt' ? 'Valor a pagar:' : 'Amount to pay:',
    openPaymentPage: language === 'pt' ? 'Abrir Pagina de Pagamento' : 'Open Payment Page',
    waitingConfirmation: language === 'pt' ? 'Aguardando confirmacao...' : 'Waiting for confirmation...',
    autoConfirmation: language === 'pt'
      ? 'O pagamento sera confirmado automaticamente apos a transacao na blockchain'
      : 'Payment will be confirmed automatically after blockchain transaction',
    payWithCrypto: language === 'pt' ? 'Pague com criptomoedas' : 'Pay with cryptocurrencies',
    supportedCoins: language === 'pt' ? 'Bitcoin, Ethereum, USDC, USDT e mais' : 'Bitcoin, Ethereum, USDC, USDT and more',
    close: language === 'pt' ? 'Fechar' : 'Close',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 dark:bg-purple-900/20 p-2 rounded-lg">
              <Coins className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {translations.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader className="h-12 w-12 text-purple-600 animate-spin mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{translations.creatingPayment}</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {translations.close}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <p className="text-sm text-purple-800 dark:text-purple-300">
                {translations.amountToPay} <span className="font-bold text-lg">${amount.toFixed(2)}</span>
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {translations.payWithCrypto}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {translations.supportedCoins}
              </p>
            </div>

            {paymentUrl && (
              <>
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  <span>{translations.openPaymentPage}</span>
                  <ExternalLink className="h-5 w-5" />
                </a>

                {checking && (
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>{translations.waitingConfirmation}</span>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-400 text-center">
                    {translations.autoConfirmation}
                  </p>
                </div>

                {paymentId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center font-mono">
                    ID: {paymentId}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
