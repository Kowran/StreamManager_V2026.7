import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Coins, CreditCard, CheckCircle, AlertCircle, Loader2, Mail, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StripeConfigModal } from './StripeConfigModal';
import { PayPalConfigModal } from './PayPalConfigModal';
import { MercadoPagoConfigModal } from './MercadoPagoConfigModal';
import { CryptomusConfigModal } from './CryptomusConfigModal';
import { BinanceConfigModal } from './BinanceConfigModal';
import { TripleAConfigModal } from './TripleAConfigModal';
import { AsaasConfigModal } from './AsaasConfigModal';
import { InfinitePayConfigModal } from './InfinitePayConfigModal';
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
  const [disputeEmailConfig, setDisputeEmailConfig] = useState<{ email: string; enabled: boolean }>({ email: '', enabled: false });
  const [disputeEmailInput, setDisputeEmailInput] = useState('');
  const [disputeEmailEnabled, setDisputeEmailEnabled] = useState(false);
  const [savingDisputeEmail, setSavingDisputeEmail] = useState(false);

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

      const { data: infinitepayData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'infinitepay_config')
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
        },
        {
          id: 'infinitepay',
          name: 'InfinitePay',
          icon: <CreditCard className="w-8 h-8" />,
          description: 'PIX, Cartao de Credito (Brasil)',
          configured: !!infinitepayData?.value?.configured,
          color: 'border-indigo-500',
          hoverColor: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
          iconColor: 'text-indigo-600 dark:text-indigo-400'
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

      const { data: disputeData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'dispute_notification_email')
        .maybeSingle();

      const disputeCfg = disputeData?.value as { email?: string; enabled?: boolean } | null;
      const disputeEmail = disputeCfg?.email || '';
      const disputeEnabled = disputeCfg?.enabled || false;
      setDisputeEmailConfig({ email: disputeEmail, enabled: disputeEnabled });
      setDisputeEmailInput(disputeEmail);
      setDisputeEmailEnabled(disputeEnabled);

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
        },
        {
          id: 'dispute-email',
          name: 'Dispute Notification Email',
          icon: <ShieldCheck className="w-8 h-8" />,
          description: 'Configure email to receive dispute resolution notifications',
          configured: disputeEnabled && !!disputeEmail,
          color: 'border-amber-500',
          hoverColor: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
          iconColor: 'text-amber-600 dark:text-amber-400'
        }
      ];

      setSystemConfigs(configList);
    } catch (error) {
      console.error('Error checking system configs:', error);
    }
  };

  const saveDisputeEmailConfig = async () => {
    setSavingDisputeEmail(true);
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert({
          key: 'dispute_notification_email',
          value: { email: disputeEmailInput.trim(), enabled: disputeEmailEnabled },
          description: 'Email address to receive notifications when a dispute is resolved by admin'
        }, { onConflict: 'key' });

      if (error) throw error;

      setDisputeEmailConfig({ email: disputeEmailInput.trim(), enabled: disputeEmailEnabled });
      setMessage({ type: 'success', text: 'Dispute notification email configured successfully' });
      setTimeout(() => setMessage(null), 3000);
      setActiveModal(null);
      checkSystemConfigs();
    } catch (error) {
      console.error('Error saving dispute email config:', error);
      setMessage({ type: 'error', text: 'Failed to save dispute email configuration' });
    } finally {
      setSavingDisputeEmail(false);
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

      <InfinitePayConfigModal
        isOpen={activeModal === 'infinitepay'}
        onClose={handleModalClose}
        onSave={() => {
          showSuccessMessage('InfinitePay');
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

      {activeModal === 'dispute-email' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-500" />
                Dispute Notification Email
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <AlertCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure an email address to receive notifications when a dispute is resolved by the admin, including the decision and resolution details.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notification Email
                </label>
                <input
                  type="email"
                  value={disputeEmailInput}
                  onChange={e => setDisputeEmailInput(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dispute-email-enabled"
                  checked={disputeEmailEnabled}
                  onChange={e => setDisputeEmailEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="dispute-email-enabled" className="text-sm text-gray-700 dark:text-gray-300">
                  Enable dispute resolution email notifications
                </label>
              </div>
              <button
                onClick={saveDisputeEmailConfig}
                disabled={savingDisputeEmail}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingDisputeEmail ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                ) : (
                  <><ShieldCheck className="h-4 w-4" />Save Configuration</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
