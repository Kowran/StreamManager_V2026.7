import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Store,
  X,
  User,
  Phone,
  Mail,
  Calendar,
  ShoppingBag,
  Bitcoin,
  MessageSquare,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SellerRequestFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function SellerRequestForm({ onClose, onSuccess }: SellerRequestFormProps) {
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [storeName, setStoreName] = useState('');
  const [productExamples, setProductExamples] = useState('');
  const [binanceId, setBinanceId] = useState('');
  const [binanceUsername, setBinanceUsername] = useState('');
  const [motivation, setMotivation] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted) {
      setError('Você precisa aceitar os termos de uso para enviar a solicitação.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error: insertError } = await supabase
        .from('seller_requests')
        .insert({
          user_id: user.id,
          full_name: fullName,
          whatsapp_number: whatsapp,
          email: email,
          birth_date: birthDate,
          store_name: storeName,
          product_examples: productExamples,
          binance_id: binanceId,
          binance_username: binanceUsername,
          motivation: motivation,
          terms_accepted: termsAccepted,
          business_name: storeName,
          description: motivation,
          contact_info: whatsapp,
          status: 'pending',
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors';

  const labelClass =
    'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Solicitar Permissão para Vender</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Dados Pessoais */}
          <div>
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3">
              Dados Pessoais
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Nome Completo</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Data de Nascimento</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>WhatsApp</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className={inputClass}
                    placeholder="+55 11 99999-9999"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dados da Loja */}
          <div>
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3">
              Dados da Loja
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nome da Loja</label>
                <div className="relative">
                  <Store className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className={inputClass}
                    placeholder="Nome da sua loja"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Exemplos de Produtos que Vende</label>
                <div className="relative">
                  <ShoppingBag className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <textarea
                    value={productExamples}
                    onChange={(e) => setProductExamples(e.target.value)}
                    rows={3}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors resize-none"
                    placeholder="Ex: Contas Netflix, Spotify, jogos digitais..."
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dados Binance */}
          <div>
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3">
              Dados da Conta Binance
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Binance ID</label>
                <div className="relative">
                  <Bitcoin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={binanceId}
                    onChange={(e) => setBinanceId(e.target.value)}
                    className={inputClass}
                    placeholder="Seu Binance ID"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Nome de Usuário Binance</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={binanceUsername}
                    onChange={(e) => setBinanceUsername(e.target.value)}
                    className={inputClass}
                    placeholder="Seu usuário na Binance"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Motivação */}
          <div>
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3">
              Motivação
            </h3>
            <div>
              <label className={labelClass}>Motivo pelo qual quer ser vendedor</label>
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={4}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors resize-none"
                  placeholder="Explique por que você deseja se tornar vendedor em nossa plataforma..."
                  required
                />
              </div>
            </div>
          </div>

          {/* Termos de Uso */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTerms(!showTerms)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            >
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                Términos y Condiciones para Vendedores
              </span>
              {showTerms ? (
                <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              )}
            </button>

            {showTerms && (
              <div className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 space-y-2 max-h-64 overflow-y-auto">
                <p className="text-gray-700 dark:text-gray-300 italic">
                  Para garantizar la mejor experiencia tanto para ti como para nuestros clientes, te compartimos nuestras normas fundamentales. ¡Por favor, léelas con atención!
                </p>

                <p><strong className="text-gray-900 dark:text-white">🚫 Calidad garantizada:</strong> Está estrictamente prohibida la venta de productos defectuosos. Nuestro objetivo es ofrecer siempre lo mejor.</p>

                <p><strong className="text-gray-900 dark:text-white">🛡️ Garantía obligatoria:</strong> Todos los productos vendidos en nuestro sitio web deben contar con un periodo de garantía obligatorio de 30 días.</p>

                <p><strong className="text-gray-900 dark:text-white">⏱️ Atención de garantías:</strong> En caso de que un cliente reporte un problema, deberás gestionar y proporcionar la solución de garantía en un plazo máximo de 24 horas.</p>

                <p><strong className="text-gray-900 dark:text-white">💰 Liberación de pagos:</strong> El reembolso o liberación del dinero de tus ventas se efectuará únicamente 3 días después de que el cliente haya confirmado la compra.</p>

                <p><strong className="text-gray-900 dark:text-white">💳 Pagos y transferencias:</strong> Es indispensable que cuentes con una cuenta de Binance activa, ya que por este medio procesaremos todos tus pagos.</p>

                <p><strong className="text-gray-900 dark:text-white">💸 Plazos de retiro:</strong> Al solicitar el retiro de tus ganancias, el depósito se realizará en un periodo de 24 a 48 horas (en días hábiles).</p>

                <p><strong className="text-gray-900 dark:text-white">🔒 Operaciones exclusivas:</strong> Está estrictamente prohibido operar, realizar transacciones o desviar ventas fuera de nuestro sitio web. El incumplimiento de esta norma causará la pérdida permanente de tu cuenta, sin derecho a reclamaciones.</p>

                <p><strong className="text-gray-900 dark:text-white">📱 Comunicación oficial:</strong> Debes contar con WhatsApp y formar parte de nuestro canal oficial de vendedores para mantenerte al tanto de las novedades y recibir soporte.</p>

                <p><strong className="text-gray-900 dark:text-white">⭐ Servicio de excelencia:</strong> Esperamos de ti una buena disponibilidad y que siempre ofrezcas una atención al cliente de primera calidad.</p>

                <p><strong className="text-gray-900 dark:text-white">✅ Aceptación de las normas:</strong> Al iniciar tus ventas en nuestro sitio web, confirmas que aceptas y te comprometes a cumplir todos nuestros términos de uso y condiciones.</p>

                <p className="text-gray-500 dark:text-gray-500 italic pt-1">
                  Nota: Si tienes alguna duda sobre cualquiera de estos puntos, ¡estamos aquí para ayudarte! Escríbenos y lo resolveremos enseguida. ¡Mucho éxito en tus ventas!
                </p>
              </div>
            )}
          </div>

          {/* Checkbox de aceitação */}
          <label className="flex items-start space-x-3 cursor-pointer group">
            <div className="flex items-center h-5 mt-0.5">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300 select-none">
              Li e concordo com os <strong className="text-gray-900 dark:text-white">Términos y Condiciones para Vendedores</strong> e me comprometo a cumplir todos los términos de uso y condiciones.
            </span>
          </label>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Enviar Solicitação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
