import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Copy, Check, User, DollarSign, Clock, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface WhatsAppPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
}

interface StoreConfig {
  social_links?: {
    whatsapp?: string;
  };
  contact_info?: {
    phone?: string;
  };
}

export function WhatsAppPaymentModal({ isOpen, onClose, amount, onSuccess }: WhatsAppPaymentModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStoreConfig();
    }
  }, [isOpen]);

  async function loadStoreConfig() {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'store_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setStoreConfig(data?.value || null);
    } catch (error) {
      console.error('Error loading store config:', error);
    } finally {
      setLoading(false);
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

  function handleWhatsAppContact() {
    const phoneNumber = storeConfig?.social_links?.whatsapp || 
                       storeConfig?.contact_info?.phone || 
                       '5584996105167';
    
    const messageText = t.language === 'pt' 
      ? `🔄 *Solicitação de Recarga de Créditos*

Olá! Gostaria de solicitar uma recarga de créditos na minha conta StreamManager.

📧 *Email da conta:* ${user?.email}
💰 *Valor solicitado:* $${amount.toFixed(2)} USD
📅 *Data da solicitação:* ${new Date().toLocaleString('pt-BR')}

Por favor, me informe:
• Métodos de pagamento disponíveis
• Instruções para transferência
• Tempo estimado para confirmação

Aguardo retorno. Obrigado!`
      : t.language === 'en'
      ? `🔄 *Credit Recharge Request*

Hello! I would like to request a credit recharge for my StreamManager account.

📧 *Account email:* ${user?.email}
💰 *Requested amount:* $${amount.toFixed(2)} USD
📅 *Request date:* ${new Date().toLocaleString('en-US')}

Please let me know:
• Available payment methods
• Transfer instructions
• Estimated confirmation time

Waiting for your response. Thank you!`
      : `🔄 *Solicitud de Recarga de Créditos*

¡Hola! Me gustaría solicitar una recarga de créditos para mi cuenta StreamManager.

📧 *Email de la cuenta:* ${user?.email}
💰 *Monto solicitado:* $${amount.toFixed(2)} USD
📅 *Fecha de solicitud:* ${new Date().toLocaleString('es-ES')}

Por favor, infórmame:
• Métodos de pago disponibles
• Instrucciones para transferencia
• Tiempo estimado para confirmación

Espero tu respuesta. ¡Gracias!`;

    const message = encodeURIComponent(messageText);
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Call onSuccess to show notification
    onSuccess();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded-lg">
              <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Recarga via WhatsApp
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Carregando informações...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Payment Summary */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-lg font-medium text-green-800 dark:text-green-300 mb-3">
                Resumo da Solicitação
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-green-700 dark:text-green-400 text-sm">Valor solicitado:</span>
                  <span className="ml-2 font-bold text-green-900 dark:text-green-200 text-lg">
                    ${amount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-green-700 dark:text-green-400 text-sm">Taxas:</span>
                  <span className="ml-2 font-bold text-green-600 dark:text-green-400">
                    $0.00
                  </span>
                </div>
                <div>
                  <span className="text-green-700 dark:text-green-400 text-sm">Total:</span>
                  <span className="ml-2 font-bold text-green-900 dark:text-green-200 text-lg">
                    ${amount.toFixed(2)}
                  </span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                <p className="text-xs text-green-600 dark:text-green-400 text-center">
                  ✅ Sem taxas adicionais • Confirmação manual pelo administrador
                </p>
              </div>
            </div>

            {/* User Information */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">
                📋 Suas Informações
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Email da conta:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-blue-900 dark:text-blue-200">
                      {user?.email}
                    </span>
                    <button
                      onClick={() => copyToClipboard(user?.email || '')}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Copiar email"
                    >
                      {copiedText === user?.email ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Valor solicitado:</span>
                  <span className="font-bold text-blue-900 dark:text-blue-200">
                    ${amount.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-400">Data da solicitação:</span>
                  <span className="text-blue-900 dark:text-blue-200">
                    {new Date().toLocaleString(
                      t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                📱 Como Funciona
              </h4>
              <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
                <li>Clique no botão abaixo para abrir o WhatsApp</li>
                <li>Uma mensagem será criada automaticamente com suas informações</li>
                <li>Envie a mensagem para nossa equipe</li>
                <li>Aguarde as instruções de pagamento</li>
                <li>Realize o pagamento conforme orientado</li>
                <li>Seus créditos serão adicionados após confirmação</li>
              </ol>
            </div>

            {/* Benefits */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                ✅ Vantagens do Pagamento Manual
              </h4>
              <ul className="text-xs text-green-700 dark:text-green-400 space-y-1">
                <li>• Sem taxas de processamento</li>
                <li>• Suporte personalizado</li>
                <li>• Múltiplas opções de pagamento</li>
                <li>• Atendimento direto via WhatsApp</li>
                <li>• Confirmação rápida durante horário comercial</li>
                <li>• Ideal para valores maiores</li>
              </ul>
            </div>

            {/* Important Notice */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                    ⏰ Tempo de Processamento
                  </h4>
                  <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
                    <li>• Horário comercial: Confirmação em até 2 horas</li>
                    <li>• Fora do horário: Confirmação no próximo dia útil</li>
                    <li>• Finais de semana: Processamento na segunda-feira</li>
                    <li>• Você receberá notificação quando confirmado</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={handleWhatsAppContact}
                className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                <span>Abrir WhatsApp</span>
              </button>
              
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>

            {/* Contact Info */}
            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              <p>
                📞 WhatsApp: {storeConfig?.social_links?.whatsapp || storeConfig?.contact_info?.phone || '+5584996105167'}
              </p>
              <p className="mt-1">
                Horário de atendimento: Segunda a Sexta, 9h às 18h
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}