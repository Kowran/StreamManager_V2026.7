import React, { useState } from 'react';
import {
  MessageCircle, TrendingUp, Shield, BookOpen, DollarSign,
  Ticket, Award, Lock, Zap, Store, Users,
  Truck, AlertTriangle, CheckCircle, Info, ArrowLeft
} from 'lucide-react';
import { SupportSystem } from './SupportSystem';
import { FeesPage } from './FeesPage';
import { useLanguage } from './LanguageProvider';
import { useTheme } from './ThemeProvider';
import { LevelIcon, type TierName } from './LevelIcon';

type HelpTab = 'tickets' | 'levels' | 'sales' | 'security' | 'tutorials' | 'fees';

export function HelpCenter() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<HelpTab>('tickets');

  const tr = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  const tabs: { id: HelpTab; label: string; icon: React.ElementType }[] = [
    { id: 'tickets', label: tr('Tickets', 'Tickets', 'Tickets'), icon: Ticket },
    { id: 'levels', label: tr('Níveis', 'Levels', 'Niveles'), icon: Award },
    { id: 'sales', label: tr('Vendas', 'Sales', 'Ventas'), icon: TrendingUp },
    { id: 'security', label: tr('Segurança', 'Security', 'Seguridad'), icon: Shield },
    { id: 'tutorials', label: tr('Tutoriais', 'Tutorials', 'Tutoriales'), icon: BookOpen },
    { id: 'fees', label: tr('Taxas', 'Fees', 'Tarifas'), icon: DollarSign },
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            {tr('Central de Ajuda', 'Help Center', 'Centro de Ayuda')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr('Encontre respostas, abra tickets e aprenda sobre a plataforma', 'Find answers, open tickets and learn about the platform', 'Encuentra respuestas, abre tickets y aprende sobre la plataforma')}
          </p>
        </div>
      </div>

      {/* Subtab bar */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-5 pb-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg border-b-2 ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'tickets' && <SupportSystem />}
        {activeTab === 'levels' && <LevelsContent tr={tr} isDark={isDark} />}
        {activeTab === 'sales' && <SalesContent tr={tr} isDark={isDark} />}
        {activeTab === 'security' && <SecurityContent tr={tr} isDark={isDark} />}
        {activeTab === 'tutorials' && <TutorialsContent tr={tr} isDark={isDark} />}
        {activeTab === 'fees' && (
          <FeesPage onBack={() => setActiveTab('tickets')} />
        )}
      </div>
    </div>
  );
}

// ─── LEVELS TAB ───
function LevelsContent({ tr, isDark }: { tr: (pt: string, en: string, es: string) => string; isDark: boolean }) {
  const buyerTiers: { name: string; tierKey: TierName; color: string; min: number; desc: string }[] = [
    { name: tr('Iniciante', 'Beginner', 'Principiante'), tierKey: 'Iniciante', color: '#8a8a8a', min: 1, desc: tr('Nível inicial para novos compradores', 'Starting level for new buyers', 'Nivel inicial para nuevos compradores') },
    { name: tr('Bronze', 'Bronze', 'Bronce'), tierKey: 'Bronze', color: '#a05a1c', min: 10, desc: tr('Compre mais para subir de nível', 'Buy more to level up', 'Compra más para subir de nivel') },
    { name: tr('Prata', 'Silver', 'Plata'), tierKey: 'Prata', color: '#8a8a8a', min: 25, desc: tr('Desbloqueia benefícios exclusivos', 'Unlocks exclusive benefits', 'Desbloquea beneficios exclusivos') },
    { name: tr('Ouro', 'Gold', 'Oro'), tierKey: 'Ouro', color: '#e0a012', min: 50, desc: tr('Cashback maior e descontos', 'Higher cashback and discounts', 'Mayor cashback y descuentos') },
    { name: tr('Diamante', 'Diamond', 'Diamante'), tierKey: 'Diamante', color: '#1f6fd6', min: 100, desc: tr('Nível máximo com todos os benefícios', 'Max level with all benefits', 'Nivel máximo con todos los beneficios') },
  ];

  const sellerTiers: { name: string; tierKey: TierName; color: string; min: number; commission: string; desc: string }[] = [
    { name: tr('Iniciante', 'Beginner', 'Principiante'), tierKey: 'Iniciante', color: '#8a8a8a', min: 1, commission: '5%', desc: tr('Comece a vender com 5% de taxa', 'Start selling with 5% fee', 'Comienza a vender con 5% de comisión') },
    { name: tr('Bronze', 'Bronze', 'Bronce'), tierKey: 'Bronze', color: '#a05a1c', min: 10, commission: '4%', desc: tr('Reduza sua taxa para 4%', 'Reduce your fee to 4%', 'Reduce tu comisión a 4%') },
    { name: tr('Prata', 'Silver', 'Plata'), tierKey: 'Prata', color: '#8a8a8a', min: 25, commission: '3.5%', desc: tr('Taxa de 3.5% conforme vende mais', '3.5% fee as you sell more', 'Comisión del 3.5% a medida que vendes más') },
    { name: tr('Ouro', 'Gold', 'Oro'), tierKey: 'Ouro', color: '#e0a012', min: 50, commission: '3%', desc: tr('Taxa reduzida para 3%', 'Fee reduced to 3%', 'Comisión reducida a 3%') },
    { name: tr('Diamante', 'Diamond', 'Diamante'), tierKey: 'Diamante', color: '#1f6fd6', min: 100, commission: '2.5%', desc: tr('Menor taxa do mercado: 2.5%', 'Lowest fee in market: 2.5%', 'La comisión más baja: 2.5%') },
  ];

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-5 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-blue-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{tr('Níveis de Comprador', 'Buyer Levels', 'Niveles de Comprador')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {buyerTiers.map((tier, i) => (
            <div key={i} className={`rounded-xl p-4 border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${tier.color}20` }}>
                  <LevelIcon tier={tier.tierKey} className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{tier.name}</p>
                  <p className="text-xs text-gray-400">Nv {tier.min}+</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{tier.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl p-5 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Store className="h-5 w-5 text-green-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{tr('Níveis de Vendedor', 'Seller Levels', 'Niveles de Vendedor')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {sellerTiers.map((tier, i) => (
            <div key={i} className={`rounded-xl p-4 border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${tier.color}20` }}>
                  <LevelIcon tier={tier.tierKey} className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{tier.name}</p>
                  <p className="text-xs text-gray-400">Nv {tier.min}+</p>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-xs font-bold text-red-500">{tr('Taxa', 'Fee', 'Comisión')}: {tier.commission}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{tier.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-400">
            {tr(
              'Cada compra ou venda concluída adiciona XP ao seu perfil. Suba de nível para desbloquear benefícios como menor taxa de comissão, maior cashback e selos exclusivos.',
              'Each completed purchase or sale adds XP to your profile. Level up to unlock benefits like lower commission fees, higher cashback, and exclusive badges.',
              'Cada compra o venta completada agrega XP a tu perfil. Sube de nivel para desbloquear beneficios como menor comisión, mayor cashback y sellos exclusivos.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SALES TAB ───
function SalesContent({ tr, isDark }: { tr: (pt: string, en: string, es: string) => string; isDark: boolean }) {
  const steps = [
    { icon: Users, title: tr('Cadastre-se', 'Sign Up', 'Regístrate'), desc: tr('Crie sua conta e solicite acesso como vendedor no painel', 'Create your account and request seller access from the dashboard', 'Crea tu cuenta y solicita acceso como vendedor en el panel') },
    { icon: Store, title: tr('Cadastre Produtos', 'List Products', 'Registra Productos'), desc: tr('Adicione seus produtos com preço, descrição e imagem', 'Add your products with price, description, and image', 'Agrega tus productos con precio, descripción e imagen') },
    { icon: Zap, title: tr('Venda Automática', 'Automatic Sales', 'Ventas Automáticas'), desc: tr('Entrega automática de contas digitais após pagamento', 'Automatic delivery of digital accounts after payment', 'Entrega automática de cuentas digitales tras el pago') },
    { icon: DollarSign, title: tr('Receba Pagamentos', 'Get Paid', 'Recibe Pagos'), desc: tr('Saque seus ganhos via Binance com taxas cada vez menores', 'Withdraw your earnings via Binance with increasingly lower fees', 'Retira tus ganancias vía Binance con comisiones cada vez menores') },
  ];

  const benefits = [
    tr('Taxa inicial de apenas 5%', 'Starting fee of just 5%', 'Comisión inicial de solo 5%'),
    tr('Entrega automática de produtos digitais', 'Automatic digital product delivery', 'Entrega automática de productos digitales'),
    tr('Painel com estatísticas em tempo real', 'Dashboard with real-time statistics', 'Panel con estadísticas en tiempo real'),
    tr('Sistema de suporte integrado para clientes', 'Integrated support system for customers', 'Sistema de soporte integrado para clientes'),
    tr('Saque via Binance Pay', 'Withdrawal via Binance Pay', 'Retiro vía Binance Pay'),
    tr('Selo de verificação e reputação', 'Verification badge and reputation', 'Sello de verificación y reputación'),
  ];

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-5 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">{tr('Como Começar a Vender', 'How to Start Selling', 'Cómo Empezar a Vender')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                  <step.icon className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                  {i + 1}
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{step.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl p-5 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">{tr('Benefícios para Vendedores', 'Seller Benefits', 'Beneficios para Vendedores')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-5 text-white text-center">
        <h3 className="text-base font-bold mb-2">{tr('Pronto para Vender?', 'Ready to Sell?', '¿Listo para Vender?')}</h3>
        <p className="text-sm text-blue-100 mb-3">
          {tr('Solicite acesso como vendedor e comece a lucrar hoje mesmo', 'Request seller access and start earning today', 'Solicita acceso como vendedor y comienza a ganar hoy')}
        </p>
      </div>
    </div>
  );
}

// ─── SECURITY TAB ───
function SecurityContent({ tr, isDark }: { tr: (pt: string, en: string, es: string) => string; isDark: boolean }) {
  const tips = [
    { icon: Lock, title: tr('Use Senhas Fortes', 'Use Strong Passwords', 'Usa Contraseñas Fuertes'), desc: tr('Combine letras maiúsculas, minúsculas, números e símbolos. Evite informações pessoais.', 'Combine uppercase, lowercase, numbers, and symbols. Avoid personal information.', 'Combina mayúsculas, minúsculas, números y símbolos. Evita información personal.') },
    { icon: Shield, title: tr('Autenticação 2FA', '2FA Authentication', 'Autenticación 2FA'), desc: tr('Ative a verificação em duas etapas para proteger sua conta contra acessos não autorizados.', 'Enable two-factor verification to protect your account against unauthorized access.', 'Habilita la verificación en dos pasos para proteger tu cuenta contra accesos no autorizados.') },
    { icon: AlertTriangle, title: tr('Nunca Compartilhe Credenciais', 'Never Share Credentials', 'Nunca Compartas Credenciales'), desc: tr('Nunca compartilhe sua senha ou código 2FA com ninguém. A equipe nunca pedirá esses dados.', 'Never share your password or 2FA code with anyone. The team will never ask for this data.', 'Nunca compartas tu contraseña o código 2FA con nadie. El equipo nunca pedirá estos datos.') },
    { icon: CheckCircle, title: tr('Confirme Recebimento', 'Confirm Receipt', 'Confirma Recepción'), desc: tr('Sempre confirme o recebimento dos produtos para liberar o pagamento ao vendedor.', 'Always confirm receipt of products to release payment to the seller.', 'Siempre confirma la recepción de productos para liberar el pago al vendedor.') },
    { icon: Info, title: tr('Comunique-se pelo Chat', 'Communicate via Chat', 'Comunícate por el Chat'), desc: tr('Toda comunicação deve ser feita pelo chat da plataforma. Não use WhatsApp ou email externo.', 'All communication must be through the platform chat. Do not use external WhatsApp or email.', 'Toda comunicación debe hacerse por el chat de la plataforma. No uses WhatsApp o email externo.') },
    { icon: Zap, title: tr('Verifique Antes de Comprar', 'Check Before Buying', 'Verifica Antes de Comprar'), desc: tr('Leia avaliações, verifique a reputação do vendedor e confira a descrição do produto.', 'Read reviews, check seller reputation, and verify product description.', 'Lee reseñas, verifica la reputación del vendedor y confirma la descripción del producto.') },
  ];

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-5 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-green-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{tr('Dicas de Segurança', 'Security Tips', 'Consejos de Seguridad')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tips.map((tip, i) => (
            <div key={i} className={`rounded-xl p-4 border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                  <tip.icon className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{tip.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {tr('Proteção ao Comprador', 'Buyer Protection', 'Protección al Comprador')}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              {tr(
                'O pagamento só é liberado ao vendedor após você confirmar o recebimento. Em caso de problema, abra uma disputa dentro de 3 dias.',
                'Payment is only released to the seller after you confirm receipt. In case of issues, open a dispute within 3 days.',
                'El pago solo se libera al vendedor después de que confirmes la recepción. En caso de problemas, abre una disputa dentro de 3 días.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TUTORIALS TAB ───
function TutorialsContent({ tr, isDark }: { tr: (pt: string, en: string, es: string) => string; isDark: boolean }) {
  const tutorials = [
    {
      icon: Store,
      title: tr('Como Comprar na Loja', 'How to Buy in the Store', 'Cómo Comprar en la Tienda'),
      steps: [
        tr('Navegue pela loja e encontre o produto desejado', 'Browse the store and find the desired product', 'Navega por la tienda y encuentra el producto deseado'),
        tr('Clique em "Comprar" e confirme a compra', 'Click "Buy" and confirm the purchase', 'Haz clic en "Comprar" y confirma la compra'),
        tr('O produto é entregue automaticamente em "Minhas Compras"', 'The product is automatically delivered in "My Purchases"', 'El producto se entrega automáticamente en "Mis Compras"'),
        tr('Acesse suas credenciais e confirme o recebimento', 'Access your credentials and confirm receipt', 'Accede a tus credenciales y confirma la recepción'),
      ],
    },
    {
      icon: DollarSign,
      title: tr('Como Recarregar Créditos', 'How to Recharge Credits', 'Cómo Recargar Créditos'),
      steps: [
        tr('Acesse "Meus Créditos" no menu', 'Go to "My Credits" in the menu', 'Ve a "Mis Créditos" en el menú'),
        tr('Escolha o valor e o método de pagamento', 'Choose the amount and payment method', 'Elige el monto y el método de pago'),
        tr('Complete o pagamento (PIX, cartão, cripto, etc.)', 'Complete the payment (PIX, card, crypto, etc.)', 'Completa el pago (PIX, tarjeta, cripto, etc.)'),
        tr('Créditos são adicionados automaticamente após confirmação', 'Credits are automatically added after confirmation', 'Los créditos se agregan automáticamente tras la confirmación'),
      ],
    },
    {
      icon: TrendingUp,
      title: tr('Como se Tornar Vendedor', 'How to Become a Seller', 'Cómo Convertirse en Vendedor'),
      steps: [
        tr('Acesse "Seja Vendedor" no painel', 'Go to "Become a Seller" in the dashboard', 'Ve a "Ser Vendedor" en el panel'),
        tr('Preencha o formulário com seus dados', 'Fill out the form with your details', 'Completa el formulario con tus datos'),
        tr('Aguarde a aprovação da administração', 'Wait for admin approval', 'Espera la aprobación del administrador'),
        tr('Comece a cadastrar produtos e vender', 'Start listing products and selling', 'Comienza a registrar productos y vender'),
      ],
    },
    {
      icon: Ticket,
      title: tr('Como Abrir um Ticket', 'How to Open a Ticket', 'Cómo Abrir un Ticket'),
      steps: [
        tr('Vá na aba "Tickets" desta Central de Ajuda', 'Go to the "Tickets" tab in this Help Center', 'Ve a la pestaña "Tickets" en este Centro de Ayuda'),
        tr('Clique em "Novo Ticket"', 'Click "New Ticket"', 'Haz clic en "Nuevo Ticket"'),
        tr('Escolha a categoria, prioridade e descreva o problema', 'Choose category, priority, and describe the issue', 'Elige categoría, prioridad y describe el problema'),
        tr('Acompanhe a resposta da equipe no chat do ticket', 'Follow the team response in the ticket chat', 'Sigue la respuesta del equipo en el chat del ticket'),
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {tutorials.map((tutorial, i) => (
        <div key={i} className={`rounded-2xl p-5 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <tutorial.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tutorial.title}</h3>
          </div>
          <ol className="space-y-2">
            {tutorial.steps.map((step, j) => (
              <li key={j} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {j + 1}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
