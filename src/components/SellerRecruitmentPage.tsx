import React, { useState, useEffect } from 'react';
import {
  TrendingUp, DollarSign, Shield, Zap, Users, Award, Crown,
  Gem, Medal, Sprout, Star, CheckCircle, ArrowRight, Store,
  Headphones, Lock, Sparkles, BarChart3, Wallet, Globe, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { Footer } from './Footer';

interface LevelBenefit {
  id: string;
  min_level: number;
  tier_name: string;
  admin_commission_rate: number;
  seller_commission_rate: number;
  icon: string;
  color: string;
  sort_order: number;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sprout, Award, Medal, Crown, Gem, Diamond: Gem,
};

export function SellerRecruitmentPage({ onBack, onBecomeSeller }: { onBack: () => void; onBecomeSeller: () => void }) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [benefits, setBenefits] = useState<LevelBenefit[]>([]);
  const [loading, setLoading] = useState(true);

  const lbl = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  useEffect(() => {
    loadBenefits();
  }, []);

  async function loadBenefits() {
    try {
      const { data, error } = await supabase
        .from('seller_level_benefits')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setBenefits(data || []);
    } catch (err) {
      console.error('Error loading benefits:', err);
    } finally {
      setLoading(false);
    }
  }

  const advantages = [
    {
      icon: DollarSign,
      title: lbl('Taxas Mais Baixas do Mercado', 'Lowest Fees in the Market', 'Comisiones Más Bajas del Mercado'),
      desc: lbl(
        'Comece pagando apenas 5% de taxa e reduza até 1% conforme você sobe de nível. Quanto mais você vende, menos você paga.',
        'Start paying just 5% fee and reduce down to 1% as you level up. The more you sell, the less you pay.',
        'Comienza pagando solo 5% de comisión y reduce hasta 1% a medida que subes de nivel. Cuanto más vendes, menos pagas.'
      ),
      color: 'from-green-500 to-emerald-600',
    },
    {
      icon: Shield,
      title: lbl('Pagamento Garantido', 'Guaranteed Payment', 'Pago Garantizado'),
      desc: lbl(
        'Sua comissão é protegida. Receba seu dinheiro diretamente via saque assim que a venda for confirmada.',
        'Your commission is protected. Receive your money directly via withdrawal as soon as the sale is confirmed.',
        'Tu comisión está protegida. Recibe tu dinero directamente vía retiro apenas se confirme la venta.'
      ),
      color: 'from-blue-500 to-cyan-600',
    },
    {
      icon: Zap,
      title: lbl('Venda Automática', 'Automatic Delivery', 'Venta Automática'),
      desc: lbl(
        'Sistema de entrega automática de contas e produtos digitais. Seus clientes recebem tudo na hora.',
        'Automatic delivery system for accounts and digital products. Your customers get everything instantly.',
        'Sistema de entrega automática de cuentas y productos digitales. Tus clientes reciben todo al instante.'
      ),
      color: 'from-yellow-500 to-orange-500',
    },
    {
      icon: BarChart3,
      title: lbl('Dashboard Profissional', 'Professional Dashboard', 'Panel Profesional'),
      desc: lbl(
        'Acompanhe suas vendas, lucros, taxas e estatísticas em tempo real com gráficos detalhados.',
        'Track your sales, profits, fees and statistics in real time with detailed charts.',
        'Rastrea tus ventas, ganancias, comisiones y estadísticas en tiempo real con gráficos detallados.'
      ),
      color: 'from-purple-500 to-pink-600',
    },
    {
      icon: Headphones,
      title: lbl('Suporte Dedicado', 'Dedicated Support', 'Soporte Dedicado'),
      desc: lbl(
        'Sistema de suporte integrado para atender seus clientes e resolver disputas rapidamente.',
        'Integrated support system to serve your customers and resolve disputes quickly.',
        'Sistema de soporte integrado para atender a tus clientes y resolver disputas rápidamente.'
      ),
      color: 'from-indigo-500 to-blue-600',
    },
    {
      icon: Globe,
      title: lbl('Alcance Global', 'Global Reach', 'Alcance Global'),
      desc: lbl(
        'Venda para clientes do mundo todo. Aceitamos múltiplas formas de pagamento e moedas.',
        'Sell to customers worldwide. We accept multiple payment methods and currencies.',
        'Vende a clientes de todo el mundo. Aceptamos múltiples métodos de pago y monedas.'
      ),
      color: 'from-teal-500 to-green-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
              <ArrowRight className="h-5 w-5 rotate-180" />
              <span className="font-medium">{lbl('Voltar', 'Back', 'Volver')}</span>
            </button>
            <div className="flex items-center gap-3">
              {user ? (
                <button
                  onClick={onBecomeSeller}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 font-semibold text-sm transition-all hover:scale-105 shadow-lg shadow-blue-500/25"
                >
                  {lbl('Virar Vendedor', 'Become a Seller', 'Convertirse en Vendedor')}
                </button>
              ) : (
                <button
                  onClick={onBecomeSeller}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 font-semibold text-sm transition-all hover:scale-105 shadow-lg shadow-blue-500/25"
                >
                  {lbl('Entrar / Cadastrar', 'Sign In / Sign Up', 'Entrar / Registrarse')}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">{lbl('Oportunidade Única', 'Unique Opportunity', 'Oportunidad Única')}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            {lbl(
              'Lucre Muito Vendendo na Nossa Plataforma',
              'Profit Big Selling on Our Platform',
              'Gana Mucho Vendiendo en Nuestra Plataforma'
            )}
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-8">
            {lbl(
              'Junte-se a centenas de vendedores que já faturam com as taxas mais baixas do mercado. Comece hoje e suba de nível para pagar ainda menos.',
              'Join hundreds of sellers already profiting with the lowest fees in the market. Start today and level up to pay even less.',
              'Únete a cientos de vendedores que ya están ganando con las comisiones más bajas del mercado. Comienza hoy y sube de nivel para pagar aún menos.'
            )}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onBecomeSeller}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 font-bold text-base transition-all hover:scale-105 shadow-xl shadow-blue-500/30"
            >
              {lbl('Começar Agora', 'Get Started Now', 'Comenzar Ahora')}
              <ArrowRight className="inline-block ml-2 h-5 w-5" />
            </button>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-400" />{lbl('Sem taxa de adesão', 'No signup fee', 'Sin cuota de registro')}</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-400" />{lbl('Cadastro gratuito', 'Free registration', 'Registro gratuito')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Advantages Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            {lbl('Por Que Vender Conosco?', 'Why Sell With Us?', '¿Por Qué Vender con Nosotros?')}
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {lbl(
              'Oferecemos tudo que você precisa para maximizar seus lucros',
              'Everything you need to maximize your profits',
              'Todo lo que necesitas para maximizar tus ganancias'
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {advantages.map((adv, idx) => (
            <div
              key={idx}
              className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all hover:scale-[1.02]"
            >
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${adv.color} mb-4 shadow-lg`}>
                <adv.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2">{adv.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{adv.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Level Benefits System */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">{lbl('Sistema de Níveis', 'Level System', 'Sistema de Niveles')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            {lbl('Suba de Nível, Pague Menos', 'Level Up, Pay Less', 'Sube de Nivel, Paga Menos')}
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {lbl(
              'Cada venda aumenta seu XP e seu nível. Quanto maior o nível, menor a taxa da plataforma. Simples assim.',
              'Every sale increases your XP and your level. The higher the level, the lower the platform fee. It\'s that simple.',
              'Cada venta aumenta tu XP y tu nivel. Cuanto mayor el nivel, menor la comisión de la plataforma. Así de simple.'
            )}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((benefit, idx) => {
              const Icon = ICON_MAP[benefit.icon] || Award;
              const isTop = idx === benefits.length - 1;
              return (
                <div
                  key={benefit.id}
                  className={`relative rounded-2xl p-6 border transition-all hover:scale-[1.02] ${
                    isTop
                      ? 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 shadow-xl shadow-blue-500/10'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  {isTop && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-xs font-bold text-white shadow-lg">
                      {lbl('Melhor Taxa', 'Best Rate', 'Mejor Tasa')}
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2.5 rounded-xl"
                        style={{ backgroundColor: `${benefit.color}20`, color: benefit.color }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{benefit.tier_name}</h3>
                        <p className="text-xs text-gray-400">{lbl('Nível', 'Level', 'Nivel')} {benefit.min_level}+</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <span className="text-sm text-gray-400">{lbl('Taxa da Plataforma', 'Platform Fee', 'Comisión Plataforma')}</span>
                      <span className="text-lg font-bold text-red-400">{benefit.admin_commission_rate}%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                      <span className="text-sm text-gray-400">{lbl('Você Recebe', 'You Keep', 'Tú Recibes')}</span>
                      <span className="text-lg font-bold text-green-400">{benefit.seller_commission_rate}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
          {lbl('Como Funciona', 'How It Works', 'Cómo Funciona')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: '1', title: lbl('Cadastre-se', 'Sign Up', 'Regístrate'), desc: lbl('Crie sua conta e solicite acesso como vendedor', 'Create your account and request seller access', 'Crea tu cuenta y solicita acceso como vendedor'), icon: Users },
            { step: '2', title: lbl('Cadastre Produtos', 'List Products', 'Registra Productos'), desc: lbl('Adicione seus produtos e defina os preços', 'Add your products and set prices', 'Agrega tus productos y define los precios'), icon: Store },
            { step: '3', title: lbl('Venda e Ganhe XP', 'Sell & Earn XP', 'Vende y Gana XP'), desc: lbl('Cada venda concluída aumenta seu nível', 'Each completed sale increases your level', 'Cada venta completada aumenta tu nivel'), icon: TrendingUp },
            { step: '4', title: lbl('Receba e Lucro', 'Get Paid & Profit', 'Recibe y Gana'), desc: lbl('Saque seus lucros com taxas cada vez menores', 'Withdraw your profits with increasingly lower fees', 'Retira tus ganancias con comisiones cada vez menores'), icon: Wallet },
          ].map((step, idx) => (
            <div key={idx} className="relative text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-4 shadow-lg shadow-blue-500/20">
                <step.icon className="h-7 w-7 text-white" />
              </div>
              <div className="absolute top-0 -right-2 w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-white">
                {step.step}
              </div>
              <h3 className="font-bold text-lg mb-1">{step.title}</h3>
              <p className="text-sm text-gray-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 to-cyan-600 p-8 sm:p-12 text-center shadow-2xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-[80px]" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-[80px]" />
          </div>
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {lbl('Pronto Para Começar?', 'Ready to Start?', '¿Listo para Comenzar?')}
            </h2>
            <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              {lbl(
                'Junte-se hoje e comece a vender com as taxas mais baixas do mercado. Sem custos ocultos, sem surpresas.',
                'Join today and start selling with the lowest fees in the market. No hidden costs, no surprises.',
                'Únete hoy y comienza a vender con las comisiones más bajas del mercado. Sin costos ocultos, sin sorpresas.'
              )}
            </p>
            <button
              onClick={onBecomeSeller}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-blue-600 font-bold text-base hover:bg-blue-50 transition-all hover:scale-105 shadow-xl"
            >
              {lbl('Começar a Vender Agora', 'Start Selling Now', 'Comenzar a Vender Ahora')}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
