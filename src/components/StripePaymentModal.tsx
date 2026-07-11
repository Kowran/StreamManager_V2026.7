import React, { useState, useEffect } from 'react';
import { X, CreditCard, Lock, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency, currencies } from './CurrencyProvider';

interface StripePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number; // amount in USD
  onSuccess: () => void;
}

interface StripeFeesCalculation {
  originalAmount: number;
  stripeFee: number;
  totalAmount: number;
  feePercentage: number;
  fixedFee: number;
}

interface PaymentElementProps {
  clientSecret: string;
  amount: number;
  fees: StripeFeesCalculation;
  onSuccess: () => void;
  onError: (error: string) => void;
}

function PaymentElement({ clientSecret, amount, fees, onSuccess, onError }: PaymentElementProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentElement, setPaymentElement] = useState<any>(null);

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        // Get Stripe publishable key from config
        const { data: configData } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'stripe_config')
          .maybeSingle();

        if (!configData?.value?.publishable_key) {
          throw new Error('Stripe não configurado');
        }

        const stripeInstance = await loadStripe(configData.value.publishable_key);
        setStripe(stripeInstance);

        if (stripeInstance && clientSecret) {
          const elementsInstance = stripeInstance.elements({
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#3b82f6',
                colorBackground: '#ffffff',
                colorText: '#1f2937',
                colorDanger: '#ef4444',
                fontFamily: 'system-ui, sans-serif',
                spacingUnit: '4px',
                borderRadius: '8px'
              }
            },
            locale: 'pt-BR'
          });
          setElements(elementsInstance);

          // Create and mount payment element with card type options
          const paymentElementInstance = elementsInstance.create('payment', {
            fields: {
              billingDetails: {
                name: 'auto',
                email: 'auto'
              }
            },
            wallets: {
              applePay: 'never',
              googlePay: 'never'
            }
          });
          setPaymentElement(paymentElementInstance);
        }
      } catch (error) {
        console.error('Error initializing Stripe:', error);
        onError('Erro ao carregar Stripe');
      }
    };

    initializeStripe();
  }, [clientSecret, onError]);

  useEffect(() => {
    if (paymentElement) {
      paymentElement.mount('#payment-element');
      
      return () => {
        paymentElement.unmount();
      };
    }
  }, [paymentElement]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      onError('Stripe não carregado');
      return;
    }

    setProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/credits?payment=success'
        },
        redirect: 'if_required'
      });

      if (error) {
        onError(error.message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      }
    } catch (error) {
      onError('Erro ao processar pagamento');
    } finally {
      setProcessing(false);
    }
  };

  if (!stripe || !elements) {
    return (
      <div className="text-center py-8">
        <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-sm text-gray-600">Carregando Stripe...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div id="payment-element">
        {/* Stripe Elements will be mounted here */}
      </div>
      
      <button
        type="submit"
        disabled={processing}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        {processing ? (
          <>
            <Loader className="h-4 w-4 animate-spin" />
            <span>Processando...</span>
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            <span>Pagar ${fees.totalAmount.toFixed(2)}</span>
          </>
        )}
      </button>
    </form>
  );
}

export function StripePaymentModal({ isOpen, onClose, amount, onSuccess }: StripePaymentModalProps) {
  const { user, session, signOut } = useAuth();
  const { t } = useLanguage();
  const { currency, rates } = useCurrency();
  const [clientSecret, setClientSecret] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fees, setFees] = useState<StripeFeesCalculation | null>(null);

  const currencyInfo = currencies.find(c => c.code === currency) || currencies[0];
  const exchangeRate = rates[currency] || 1;
  const amountInCurrency = amount * exchangeRate;

  useEffect(() => {
    if (isOpen && user && session) {
      createPaymentIntent();
    }
  }, [isOpen, user, session, amount]);

  function calculateStripeFees(amountInUserCurrency: number): StripeFeesCalculation {
    // Stripe fees: 3.9% + fixed fee (fixed fee varies by currency, using USD-equivalent)
    const feePercentage = 0.039; // 3.9%
    const fixedFeeUsd = 0.30;
    const fixedFee = fixedFeeUsd * exchangeRate; // Convert fixed fee to user currency
    
    const stripeFee = (amountInUserCurrency * feePercentage) + fixedFee;
    const totalAmount = amountInUserCurrency + stripeFee;
    
    return {
      originalAmount: amountInUserCurrency,
      stripeFee: stripeFee,
      totalAmount: totalAmount,
      feePercentage: feePercentage * 100,
      fixedFee: fixedFee
    };
  }

  async function createPaymentIntent() {
    setLoading(true);
    setError('');

    try {
      // Calculate fees
      const feesCalculation = calculateStripeFees(amount);
      setFees(feesCalculation);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: feesCalculation.totalAmount, // Charge total amount including fees (in user currency)
          original_amount: amount, // Credit original USD amount
          currency: currency.toLowerCase(), // Charge in user's currency
          description: `Recarga de créditos - ${currencyInfo.symbol} ${amountInCurrency.toFixed(2)} (+ taxas ${currencyInfo.symbol} ${feesCalculation.stripeFee.toFixed(2)})`,
          metadata: {
            user_id: user.id,
            user_email: user.email,
            type: 'credit_recharge',
            original_amount_usd: amount.toString(),
            original_amount_currency: amountInCurrency.toFixed(2),
            charge_currency: currency,
            exchange_rate: exchangeRate.toString(),
            stripe_fee: feesCalculation.stripeFee.toString(),
            stripe_fee_usd: (feesCalculation.stripeFee / exchangeRate).toString(),
            total_charged: feesCalculation.totalAmount.toString(),
            total_charged_usd: (feesCalculation.totalAmount / exchangeRate).toString()
          }
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Handle invalid authentication by signing out the user
        if (result.error === 'Invalid authentication') {
          signOut();
          return;
        }
        throw new Error(result.error || 'Erro ao criar pagamento');
      }

      if (result.success && result.client_secret) {
        setClientSecret(result.client_secret);
      } else {
        throw new Error('Resposta inválida do servidor');
      }

    } catch (error) {
      console.error('Error creating payment intent:', error);
      setError(error instanceof Error ? error.message : 'Erro ao criar pagamento');
    } finally {
      setLoading(false);
    }
  }

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Pagamento com Stripe
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Preparando pagamento...
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Erro ao Criar Pagamento
            </h4>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              {error}
            </p>
            <button
              onClick={createPaymentIntent}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : clientSecret ? (
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
                    ${amount.toFixed(2)} USD
                  </span>
                </div>
                {fees && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700 dark:text-blue-400">Taxa do Stripe:</span>
                      <span className="text-sm text-blue-800 dark:text-blue-300">
                        {currencyInfo.symbol} {fees.stripeFee.toFixed(currencyInfo.decimals)}
                      </span>
                    </div>
                    <div className="border-t border-blue-200 dark:border-blue-700 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-700 dark:text-blue-400 font-medium">Total a pagar:</span>
                        <span className="font-bold text-blue-900 dark:text-blue-200 text-lg">
                          {currencyInfo.symbol} {fees.totalAmount.toFixed(currencyInfo.decimals)} {currency}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 dark:text-blue-400">Moeda:</span>
                  <span className="text-sm text-blue-800 dark:text-blue-300">{currency} (créditos em USD)</span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                  💡 As taxas do Stripe são incluídas no valor total, mas apenas ${amount.toFixed(2)} USD será creditado como saldo
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

            {/* Payment Form */}
            <PaymentElement
              clientSecret={clientSecret}
              amount={amount}
              fees={fees}
              onSuccess={handleSuccess}
              onError={handleError}
            />

            {/* Security Info */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                🔒 Pagamento Seguro
              </h4>
              <ul className="text-xs text-green-700 dark:text-green-400 space-y-1">
                <li>• Processado com segurança pelo Stripe</li>
                <li>• Seus dados de cartão são criptografados</li>
                <li>• Não armazenamos informações do cartão</li>
                <li>• Certificação PCI DSS Level 1</li>
                <li>• Pagamento processado em {currency}</li>
                <li>• Aceita cartões de débito e crédito</li>
                <li>• Suporte a cartões internacionais</li>
                <li>• Taxas de processamento incluídas automaticamente</li>
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}