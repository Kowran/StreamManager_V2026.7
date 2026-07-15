import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Coins, CreditCard, CheckCircle, AlertCircle, Loader2, Mail, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StripeConfigModal } from './StripeConfigModal';
import { PayPalConfigModal } from './PayPalConfigModal';
import { MercadoPagoConfigModal } from './MercadoPagoConfigModal';
import { CryptomusConfigModal } from './CryptomusConfigModal';
import { BinanceConfigModal } from './BinanceConfigModal';
import { TripleAConfigModal } from './TripleAConfigModal';
import { AsaasConfigModal } from './AsaasConfigModal';
import { ImapConfigModal } from './ImapConfigModal';
import { SmtpConfigModal } from './SmtpConfigModal';

interface PaymentGateway {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  configured: boolean;
  color: string;
  hoverColor: string;
  iconColor: string;
}

interface SystemConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  configured: boolean;
  color: string;
  hoverColor: string;
  iconColor: string;
}

export default function AdminSettingsManager() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [systemConfigs, setSystemConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  useEffect(() => {
    checkConfiguredGateways();
    checkSystemConfigs();
  }, []);

  const checkConfiguredGateways = async () => {
    try {
      setLoading(true);

      const { data: stripeData } = await supabase
        .from('stripe_config')
        .select('id')
        .maybeSingle();

      const { data: paypalData } = await supabase
        .from('paypal_config')
        .select('id')
        .maybeSingle();

      const { data: mercadopagoData } = await supabase
        .from('mercadopago_config')
        .select('id')
        .maybeSingle();

      const { data: cryptomusData } = await supabase
        .from('cryptomus_config')
        .select('id')
        .maybeSingle();

      const { data: binanceData } = await supabase
        .from('binance_config')
        .select('id')
        .maybeSingle();

      const { data: tripleaData } = await supabase
        .from('triplea_config')
        .select('id')
        .maybeSingle();

      const { data: asaasData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'asaas_config')
        .maybeSingle();

      const gatewayList: PaymentGateway[] = [
        {
          id: 'stripe',
          name: 'Stripe',
          icon: <CreditCard className="w-8 h-8" />,
          description: 'Credit/Debit Cards, Apple Pay, Google Pay',
          configured: !!stripeData,
          color: 'border-blue-500',
          hoverColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
          iconColor: 'text-blue-600 dark:text-blue-400'
        },
        {
          id: 'paypal',
          name: 'PayPal',
          icon: <DollarSign className="w-8 h-8" />,
          description: 'PayPal Balance, Credit/Debit Cards',
          configured: !!paypalData,
          color: 'border-blue-400',
          hoverColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
          iconColor: 'text-blue-500 dark:text-blue-300'
        },
        {
          id: 'mercadopago',
          name: 'Mercado Pago',
          icon: <CreditCard className="w-8 h-8" />,
          description: 'PIX, Cards, Boleto (Latin America)',
          configured: !!mercadopagoData,
          color: 'border-cyan-500',
          hoverColor: 'hover:bg-cyan-50 dark:hover:bg-cyan-900/20',
          iconColor: 'text-cyan-600 dark:text-cyan-400'
        },
        {
          id: 'cryptomus',
          name: 'Cryptomus',
          icon: <Coins className="w-8 h-8" />,
          description: 'Multiple Cryptocurrencies, Low Fees',
          configured: !!cryptomusData,
          color: 'border-orange-500',
          hoverColor: 'hover:bg-orange-50 dark:hover:bg-orange-900/20',
          iconColor: 'text-orange-600 dark:text-orange-400'
        },
        {
          id: 'binance',
          name: 'Binance Pay',
          icon: <Coins className="w-8 h-8" />,
          description: 'Crypto Payments via Binance',
          configured: !!binanceData,
          color: 'border-yellow-500',
          hoverColor: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
          iconColor: 'text-yellow-600 dark:text-yellow-400'
        },
        {
          id: 'triplea',
          name: 'Triple-A',
          icon: <Coins className="w-8 h-8" />,
          description: 'Stablecoin Payments (USDC, USDT)',
          configured: !!tripleaData,
          color: 'border-purple-500',
          hoverColor: 'hover:bg-purple-50 dark:hover:bg-purple-900/20',
          iconColor: 'text-purple-600 dark:text-purple-400'
        },
        {
          id: 'asaas',
          name: 'Asaas',
          icon: <CreditCard className="w-8 h-8" />,
          description: 'PIX, Boleto Bancario (Brasil)',
          configured: !!asaasData?.value?.configured,
          color: 'border-blue-500',
          hoverColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
          iconColor: 'text-blue-600 dark:text-blue-400'
        }
      ];

      setGateways(gatewayList);
    } catch (error) {
      console.error('Error checking gateways:', error);
      setMessage({ type: 'error', text: 'Failed to load payment gateways' });
    } finally {
      setLoading(false);
    }
  };

  const checkSystemConfigs = async () => {
    try {
      const { data: imapData } = await supabase
        .from('imap_config')
        .select('id')
        .maybeSingle();

      const { data: smtpData } = await supabase
        .from('smtp_config')
        .select('id, enabled')
        .maybeSingle();

      const configList: SystemConfig[] = [
        {
          id: 'imap',
          name: 'IMAP Email',
          icon: <Mail className="w-8 h-8" />,
          description: 'Configure IMAP server for email checking',
          configured: !!imapData,
          color: 'border-green-500',
          hoverColor: 'hover:bg-green-50 dark:hover:bg-green-900/20',
          iconColor: 'text-green-600 dark:text-green-400'
        },
        {
          id: 'smtp',
          name: 'SMTP Email',
          icon: <Send className="w-8 h-8" />,
          description: 'Configure SMTP server for seller sale email notifications',
          configured: !!smtpData,
          color: 'border-emerald-500',
          hoverColor: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
          iconColor: 'text-emerald-600 dark:text-emerald-400'
        }
      ];

      setSystemConfigs(configList);
    } catch (error) {
      console.error('Error checking system configs:', error);
    }
  };

  const handleModalClose = () => {
    setActiveModal(null);
    checkConfiguredGateways();
    checkSystemConfigs();
  };

  const showSuccessMessage = (gatewayName: string) => {
    setMessage({ type: 'success', text: `${gatewayName} configured successfully` });
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading payment gateways...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure payment methods and system preferences
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/10">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Gateways</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Configure payment methods to accept payments from customers
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gateways.map((gateway) => (
              <button
                key={gateway.id}
                onClick={() => setActiveModal(gateway.id)}
                className={`group relative p-5 border-2 rounded-xl transition-all duration-200 text-left ${
                  gateway.configured
                    ? `${gateway.color} bg-opacity-5`
                    : 'border-gray-300 dark:border-gray-600'
                } ${gateway.hoverColor} hover:shadow-md hover:scale-[1.02]`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={gateway.iconColor}>
                    {gateway.icon}
                  </div>
                  {gateway.configured && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Active
                    </div>
                  )}
                </div>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-1.5 text-base">
                  {gateway.name}
                </h4>

                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {gateway.description}
                </p>

                {!gateway.configured && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Click to configure
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">Payment Gateway Information</p>
                <p className="text-blue-700 dark:text-blue-400">
                  Configure at least one payment gateway to start accepting payments.
                  You can enable multiple gateways to offer more payment options to your customers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-transparent dark:from-green-900/10">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Configuration</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Configure system settings and integrations
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemConfigs.map((config) => (
              <button
                key={config.id}
                onClick={() => setActiveModal(config.id)}
                className={`group relative p-5 border-2 rounded-xl transition-all duration-200 text-left ${
                  config.configured
                    ? `${config.color} bg-opacity-5`
                    : 'border-gray-300 dark:border-gray-600'
                } ${config.hoverColor} hover:shadow-md hover:scale-[1.02]`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={config.iconColor}>
                    {config.icon}
                  </div>
                  {config.configured && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Active
                    </div>
                  )}
                </div>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-1.5 text-base">
                  {config.name}
                </h4>

                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {config.description}
                </p>

                {!config.configured && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Click to configure
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <StripeConfigModal
        isOpen={activeModal === 'stripe'}
        onClose={handleModalClose}
        onSave={() => {
          showSuccessMessage('Stripe');
          handleModalClose();
        }}
      />

      <PayPalConfigModal
        isOpen={activeModal === 'paypal'}
        onClose={handleModalClose}
        onSave={() => {
          showSuccessMessage('PayPal');
          handleModalClose();
        }}
      />

      <MercadoPagoConfigModal
        isOpen={activeModal === 'mercadopago'}
        onClose={handleModalClose}
        onSave={() => {
          showSuccessMessage('Mercado Pago');
          handleModalClose();
        }}
      />

      <CryptomusConfigModal
        isOpen={activeModal === 'cryptomus'}
        onClose={handleModalClose}
        onSave={() => {
          showSuccessMessage('Cryptomus');
          handleModalClose();
        }}
      />

      {activeModal === 'binance' && (
        <BinanceConfigModal
          onClose={handleModalClose}
          onSave={() => {
            showSuccessMessage('Binance Pay');
            handleModalClose();
          }}
        />
      )}

      {activeModal === 'triplea' && (
        <TripleAConfigModal
          isOpen={true}
          onClose={handleModalClose}
          onSave={() => {
            showSuccessMessage('Triple-A');
            handleModalClose();
          }}
        />
      )}

      <AsaasConfigModal
        isOpen={activeModal === 'asaas'}
        onClose={handleModalClose}
        onSave={() => {
          showSuccessMessage('Asaas');
          handleModalClose();
        }}
      />

      <ImapConfigModal
        isOpen={activeModal === 'imap'}
        onClose={handleModalClose}
        onSave={() => {
          showSuccessMessage('IMAP Email');
          handleModalClose();
        }}
      />

      <SmtpConfigModal
        isOpen={activeModal === 'smtp'}
        onClose={handleModalClose}
        onSave={() => {
          showSuccessMessage('SMTP Email');
          handleModalClose();
        }}
      />
    </div>
  );
}
