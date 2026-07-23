import React from 'react';
import { DollarSign, Clock, Zap, Shield, CreditCard, Smartphone, Coins, ArrowLeft, Info, Store, TrendingUp, Wallet, Percent } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

interface FeesPageProps {
  onBack: () => void;
}

export function FeesPage({ onBack }: FeesPageProps) {
  const { t } = useLanguage();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => (lang === 'pt' ? pt : lang === 'en' ? en : es);

  const paymentMethods = [
    { icon: CreditCard, name: tr('Cartão de Crédito/Débito', 'Credit/Debit Card', 'Tarjeta de Crédito/Débito'), fee: '3.9% + $0.30', time: tr('Instantâneo', 'Instant', 'Instantáneo'), color: 'from-blue-500 to-indigo-600' },
    { icon: DollarSign, name: 'PayPal', fee: '10% + $0.40', time: tr('Instantâneo', 'Instant', 'Instantáneo'), color: 'from-sky-500 to-blue-600' },
    { icon: Smartphone, name: 'PIX / Mercado Pago', fee: tr('Sem taxas (PIX)', 'No fees (PIX)', 'Sin comisiones (PIX)'), time: tr('Instantâneo', 'Instant', 'Instantáneo'), color: 'from-emerald-500 to-teal-600' },
    { icon: Coins, name: 'Cryptomus', fee: tr('Sem taxas', 'No fees', 'Sin comisiones'), time: tr('5-15 minutos', '5-15 minutes', '5-15 minutos'), color: 'from-amber-500 to-orange-600' },
    { icon: DollarSign, name: 'Binance Pay', fee: tr('Sem taxas', 'No fees', 'Sin comisiones'), time: tr('Instantâneo', 'Instant', 'Instantáneo'), color: 'from-yellow-500 to-amber-600' },
    { icon: DollarSign, name: 'WhatsApp Manual', fee: tr('Sem taxas', 'No fees', 'Sin comisiones'), time: tr('2-24 horas', '2-24 hours', '2-24 horas'), color: 'from-green-500 to-emerald-600' },
  ];

  return (
    <div className="w-full mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />{tr('Voltar', 'Back', 'Volver')}
      </button>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-6 sm:p-10 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {tr('Taxas e Prazos', 'Fees & Deadlines', 'Comisiones y Plazos')}
            </h1>
          </div>
          <p className="text-sm sm:text-base text-blue-100 leading-relaxed max-w-2xl">
            {tr(
              'Entenda as taxas aplicadas em cada método de pagamento e os prazos de processamento para recargas e compras.',
              'Understand the fees applied to each payment method and the processing times for recharges and purchases.',
              'Entiende las comisiones aplicadas a cada método de pago y los plazos de procesamiento para recargas y compras.'
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {paymentMethods.map((method, i) => {
          const Icon = method.icon;
          return (
            <div key={i} className="group bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${method.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">{method.name}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      <DollarSign className="h-3 w-3" />
                      {tr('Taxa', 'Fee', 'Comisión')}: {method.fee}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                      <Clock className="h-3 w-3" />
                      {tr('Prazo', 'Time', 'Plazo')}: {method.time}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{tr('Entrega Automática', 'Automatic Delivery', 'Entrega Automática')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {tr('Produtos com entrega automática são liberados instantaneamente após confirmação do pagamento.', 'Products with automatic delivery are released instantly after payment confirmation.', 'Los productos con entrega automática se liberan instantáneamente tras la confirmación del pago.')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{tr('Entrega Manual', 'Manual Delivery', 'Entrega Manual')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {tr('Produtos com entrega manual podem levar de algumas minutos a horas, dependendo do vendedor.', 'Products with manual delivery may take from a few minutes to hours, depending on the seller.', 'Los productos con entrega manual pueden tardar de unos minutos a horas, dependiendo del vendedor.')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
            <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{tr('Proteção de Compra', 'Purchase Protection', 'Protección de Compra')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {tr('O valor só é liberado ao vendedor após você confirmar o recebimento do produto.', 'The amount is only released to the seller after you confirm receipt of the product.', 'El monto solo se libera al vendedor después de que confirmas la recepción del producto.')}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-5 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
          {tr(
            'As taxas são aplicadas sobre o valor da transação e podem variar conforme o método escolhido. Recargas via PIX e criptomoedas não possuem taxas adicionais. O prazo de processamento é contado a partir da confirmação do pagamento.',
            'Fees are applied to the transaction amount and may vary depending on the chosen method. Recharges via PIX and cryptocurrencies have no additional fees. The processing time is counted from payment confirmation.',
            'Las comisiones se aplican sobre el monto de la transacción y pueden variar según el método elegido. Las recargas vía PIX y criptomonedas no tienen comisiones adicionales. El plazo de procesamiento se cuenta desde la confirmación del pago.'
          )}
        </p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{tr('Taxas e Prazos do Vendedor', 'Seller Fees & Deadlines', 'Comisiones y Plazos del Vendedor')}</h2>
            <p className="text-xs text-blue-200">{tr('Informações para vendedores da plataforma', 'Information for platform sellers', 'Información para vendedores de la plataforma')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-semibold text-white">{tr('Comissão da Plataforma', 'Platform Commission', 'Comisión de la Plataforma')}</span>
            </div>
            <p className="text-2xl font-bold text-cyan-300">5%</p>
            <p className="text-xs text-blue-200 mt-1">{tr('sobre cada venda concluída', 'on each completed sale', 'sobre cada venta completada')}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-semibold text-white">{tr('Saque Mínimo', 'Minimum Withdrawal', 'Retiro Mínimo')}</span>
            </div>
            <p className="text-2xl font-bold text-emerald-300">$10.00</p>
            <p className="text-xs text-blue-200 mt-1">{tr('valor mínimo para solicitar saque', 'minimum amount to request withdrawal', 'monto mínimo para solicitar retiro')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-300" />
              <span className="text-sm text-blue-100">{tr('Prazo de Liberação do Saque', 'Withdrawal Release Time', 'Plazo de Liberación del Retiro')}</span>
            </div>
            <span className="text-sm font-semibold text-white">{tr('3 a 7 dias úteis', '3 to 7 business days', '3 a 7 días hábiles')}</span>
          </div>
          <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-300" />
              <span className="text-sm text-blue-100">{tr('Período de Retenção', 'Hold Period', 'Período de Retención')}</span>
            </div>
            <span className="text-sm font-semibold text-white">{tr('48h após confirmação', '48h after confirmation', '48h después de la confirmación')}</span>
          </div>
          <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-300" />
              <span className="text-sm text-blue-100">{tr('Cashback ao Comprador', 'Buyer Cashback', 'Cashback al Comprador')}</span>
            </div>
            <span className="text-sm font-semibold text-white">{tr('Definido pelo vendedor', 'Set by seller', 'Definido por el vendedor')}</span>
          </div>
          <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-300" />
              <span className="text-sm text-blue-100">{tr('Taxa de Estorno', 'Chargeback Fee', 'Tarifa de Reversión')}</span>
            </div>
            <span className="text-sm font-semibold text-white">{tr('Sem taxa para o vendedor', 'No fee for seller', 'Sin tarifa para el vendedor')}</span>
          </div>
        </div>

        <div className="mt-5 bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-xs text-blue-200 leading-relaxed">
            {tr(
              'A comissão da plataforma é descontada automaticamente do saldo do vendedor no momento em que a venda é concluída. O valor restante fica disponível para saque após o período de retenção. Vendedores com nível mais alto podem ter benefícios especiais como menor comissão e saques prioritários.',
              'The platform commission is automatically deducted from the seller balance when the sale is completed. The remaining amount becomes available for withdrawal after the hold period. Higher-level sellers may receive special benefits such as lower commission and priority withdrawals.',
              'La comisión de la plataforma se descuenta automáticamente del saldo del vendedor cuando se completa la venta. El monto restante queda disponible para retiro después del período de retención. Los vendedores de nivel superior pueden recibir beneficios especiales como menor comisión y retiros prioritarios.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
