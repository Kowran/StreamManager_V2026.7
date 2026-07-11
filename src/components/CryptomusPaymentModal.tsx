import React, { useState, useEffect } from 'react';
import { X, Copy, CheckCircle, Loader, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

interface CryptomusPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

export function CryptomusPaymentModal({ isOpen, onClose, amount, onSuccess }: CryptomusPaymentModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      createPayment();
    } else {
      setPaymentUrl('');
      setOrderId('');
    }
  }, [isOpen]);

  async function createPayment() {
    if (!user) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-cryptomus-payment`,
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
        const errorMessage = result.error || 'Erro ao criar pagamento';
        if (errorMessage.includes('não configurado') || errorMessage.includes('not configured')) {
          throw new Error('⚠️ Cryptomus não está configurado. Por favor, contate o administrador para configurar este método de pagamento nas configurações do sistema.');
        }
        throw new Error(errorMessage);
      }

      setPaymentUrl(result.url);
      setOrderId(result.order_id);
      startPaymentCheck(result.order_id);
    } catch (error: any) {
      console.error('Error creating payment:', error);
      alert(error.message || 'Erro ao criar pagamento');
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function startPaymentCheck(orderId: string) {
    setChecking(true);
    const interval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-cryptomus-payment`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ order_id: orderId }),
          }
        );

        const result = await response.json();

        if (result.status === 'paid') {
          clearInterval(interval);
          setChecking(false);
          onSuccess();
          alert('Pagamento confirmado!');
          onClose();
        }
      } catch (error) {
        console.error('Error checking payment:', error);
      }
    }, 5000);

    setTimeout(() => {
      clearInterval(interval);
      setChecking(false);
    }, 600000);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Pagamento Cryptomus
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Criando pagamento...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Valor a pagar: <span className="font-bold">${amount.toFixed(2)}</span>
              </p>
            </div>

            {paymentUrl && (
              <>
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>Abrir Página de Pagamento</span>
                  <ExternalLink className="h-5 w-5" />
                </a>

                {checking && (
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Aguardando confirmação...</span>
                  </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  O pagamento será confirmado automaticamente após a transação
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
