import React, { useState, useEffect } from 'react';
import { Instagram, Youtube, MessageCircle, Mail, Globe, Heart, Twitter, Send, Music2, X, Cookie, HelpCircle, FileText, ShoppingCart, Shield, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface SiteSettings {
  site_name?: string;
  footer_logo_url?: string;
  footer_text?: string;
  copyright_text?: string;
  contact_email?: string;
  social_links?: {
    instagram?: string;
    youtube?: string;
    whatsapp?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

interface StoreConfig {
  store_name?: string;
  store_logo_url?: string;
  copyright?: string;
  social_links?: {
    whatsapp?: string;
  };
  contact_info?: {
    phone?: string;
  };
}

type LegalDoc = 'faq' | 'terms' | 'purchase' | 'privacy' | 'about';

const COOKIE_CONSENT_KEY = 'cookie_consent_v1';

interface FooterProps {
  navigationLinks?: { id: string; name: string; icon: typeof HelpCircle }[];
  onNavigate?: (id: string) => void;
}

export function Footer({ navigationLinks = [], onNavigate }: FooterProps) {
  const { t, language } = useLanguage();
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [openDoc, setOpenDoc] = useState<LegalDoc | null>(null);
  const [openFaqItem, setOpenFaqItem] = useState<number | null>(null);
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  const lang = language;

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!stored) {
        const timer = setTimeout(() => setShowCookieBanner(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  async function loadSettings() {
    try {
      const { data: siteData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'site_settings')
        .maybeSingle();

      const { data: storeData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'store_config')
        .maybeSingle();

      setSiteSettings(siteData?.value || null);
      setStoreConfig(storeData?.value || null);
    } catch (error) {
      console.error('Error loading footer settings:', error);
    }
  }

  function handleCookieChoice(accepted: boolean) {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ accepted, date: new Date().toISOString() }));
    } catch {
      // localStorage unavailable
    }
    setShowCookieBanner(false);
  }

  const siteName = siteSettings?.site_name || storeConfig?.store_name || 'StreamManager';
  const footerLogo = siteSettings?.footer_logo_url || siteSettings?.header_logo_url || storeConfig?.store_logo_url;
  const contactEmail = siteSettings?.contact_email || 'support@streammanager.com.br';
  const currentYear = new Date().getFullYear();
  const copyrightText = siteSettings?.copyright_text ||
    storeConfig?.copyright ||
    `© ${currentYear} ${siteName}. ${lang === 'pt' ? 'Todos os direitos reservados.' : lang === 'en' ? 'All rights reserved.' : 'Todos los derechos reservados.'}`;

  const social = { ...siteSettings?.social_links, ...storeConfig?.social_links };

  const socialLinks = [
    { name: 'Instagram', url: social.instagram, icon: Instagram, color: 'hover:text-pink-500' },
    { name: 'YouTube', url: social.youtube, icon: Youtube, color: 'hover:text-red-500' },
    { name: 'Twitter', url: social.twitter, icon: Twitter, color: 'hover:text-blue-400' },
    { name: 'Telegram', url: social.telegram, icon: Send, color: 'hover:text-blue-500' },
    {
      name: 'WhatsApp',
      url: (() => {
        const phoneNumber = social.whatsapp || storeConfig?.contact_info?.phone || '5584996105167';
        const message = encodeURIComponent(
          lang === 'pt'
            ? `Olá! Gostaria de saber mais sobre o ${siteName}.`
            : lang === 'en'
            ? `Hello! I would like to know more about ${siteName}.`
            : `¡Hola! Me gustaría saber más sobre ${siteName}.`
        );
        return `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${message}`;
      })(),
      icon: MessageCircle,
      color: 'hover:text-green-500'
    },
    { name: 'Discord', url: social.discord, icon: Music2, color: 'hover:text-indigo-400' },
  ].filter(link => link.url);

  const tr = (pt: string, en: string, es: string) => (lang === 'pt' ? pt : lang === 'en' ? en : es);

  const legalLinks: { key: LegalDoc; label: string; icon: typeof HelpCircle }[] = [
    { key: 'faq', label: tr('FAQ', 'FAQ', 'FAQ'), icon: HelpCircle },
    { key: 'terms', label: tr('Termos de Uso', 'Terms of Use', 'Términos de Uso'), icon: FileText },
    { key: 'purchase', label: tr('Termos de Compra', 'Purchase Terms', 'Términos de Compra'), icon: ShoppingCart },
    { key: 'privacy', label: tr('Política de Privacidade', 'Privacy Policy', 'Política de Privacidad'), icon: Shield },
    { key: 'about', label: tr('Sobre Nós', 'About Us', 'Sobre Nosotros'), icon: Info },
  ];

  const faqItems = [
    {
      q: tr('Como faço uma compra?', 'How do I make a purchase?', '¿Cómo hago una compra?'),
      a: tr(
        'Navegue pela loja, selecione o produto desejado e clique em "Comprar". Siga as etapas de pagamento para concluir sua compra.',
        'Browse the store, select the desired product and click "Buy". Follow the payment steps to complete your purchase.',
        'Navega por la tienda, selecciona el producto deseado y haz clic en "Comprar". Sigue los pasos de pago para completar tu compra.'
      ),
    },
    {
      q: tr('Quais formas de pagamento são aceitas?', 'What payment methods are accepted?', '¿Qué métodos de pago se aceptan?'),
      a: tr(
        'Aceitamos cartão de crédito, Pix, boleto, PayPal e criptomoedas. A disponibilidade pode variar conforme sua região.',
        'We accept credit card, Pix, bank slip, PayPal and cryptocurrencies. Availability may vary by region.',
        'Aceptamos tarjeta de crédito, Pix, boleto, PayPal y criptomonedas. La disponibilidad puede variar según tu región.'
      ),
    },
    {
      q: tr('Como recebo meu produto após o pagamento?', 'How do I receive my product after payment?', '¿Cómo recibo mi producto después del pago?'),
      a: tr(
        'Após a confirmação do pagamento, o produto é entregue automaticamente na seção "Minhas Compras". Você receberá uma notificação por e-mail.',
        'After payment confirmation, the product is automatically delivered in the "My Purchases" section. You will receive an email notification.',
        'Después de la confirmación del pago, el producto se entrega automáticamente en la sección "Mis Compras". Recibirás una notificación por correo.'
      ),
    },
    {
      q: tr('Posso solicitar reembolso?', 'Can I request a refund?', '¿Puedo solicitar un reembolso?'),
      a: tr(
        'Reembolsos são analisados caso a caso. Contate o suporte em até 7 dias após a compra, conforme o Código de Defesa do Consumidor.',
        'Refunds are analyzed case by case. Contact support within 7 days of purchase, in accordance with consumer protection laws.',
        'Los reembolsos se analizan caso por caso. Contacta con soporte dentro de los 7 días posteriores a la compra, conforme a las leyes de protección al consumidor.'
      ),
    },
    {
      q: tr('Como funciona a garantia dos produtos?', 'How does the product warranty work?', '¿Cómo funciona la garantía de los productos?'),
      a: tr(
        'Todos os produtos possuem garantia especificada na página do produto. Em caso de defeito, contate o suporte para substituição.',
        'All products have a warranty specified on the product page. In case of defect, contact support for replacement.',
        'Todos los productos tienen una garantía especificada en la página del producto. En caso de defecto, contacta con soporte para el reemplazo.'
      ),
    },
    {
      q: tr('Como me torno um vendedor?', 'How do I become a seller?', '¿Cómo me convierto en vendedor?'),
      a: tr(
        'Acesse "Tornar-se Vendedor" no seu painel e preencha o formulário. Nossa equipe avaliará sua solicitação.',
        'Go to "Become a Seller" in your dashboard and fill out the form. Our team will evaluate your request.',
        'Ve a "Convertirse en Vendedor" en tu panel y completa el formulario. Nuestro equipo evaluará tu solicitud.'
      ),
    },
  ];

  const legalContent: Record<LegalDoc, { title: string; body: React.ReactNode }> = {
    faq: {
      title: tr('Perguntas Frequentes', 'Frequently Asked Questions', 'Preguntas Frecuentes'),
      body: (
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <div key={i} className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/40">
              <button
                onClick={() => setOpenFaqItem(openFaqItem === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-700/40 transition-colors"
              >
                <span className="text-sm font-medium text-gray-100">{item.q}</span>
                {openFaqItem === i ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              </button>
              {openFaqItem === i && (
                <div className="px-4 pb-4 pt-1">
                  <p className="text-sm text-gray-300 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ),
    },
    terms: {
      title: tr('Termos de Uso', 'Terms of Use', 'Términos de Uso'),
      body: (
        <div className="prose prose-invert max-w-none space-y-4 text-sm text-gray-300 leading-relaxed">
          <h3 className="text-white font-semibold text-base">{tr('1. Aceitação dos Termos', '1. Acceptance of Terms', '1. Aceptación de los Términos')}</h3>
          <p>{tr(
            `Ao acessar e utilizar ${siteName}, você concorda com estes Termos de Uso. Se não concordar com qualquer parte, não utilize a plataforma.`,
            `By accessing and using ${siteName}, you agree to these Terms of Use. If you do not agree with any part, do not use the platform.`,
            `Al acceder y utilizar ${siteName}, aceptas estos Términos de Uso. Si no estás de acuerdo con alguna parte, no utilices la plataforma.`
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('2. Uso da Plataforma', '2. Platform Use', '2. Uso de la Plataforma')}</h3>
          <p>{tr(
            'Você concorda em utilizar a plataforma apenas para fins legítimos, sem violar leis aplicáveis ou direitos de terceiros. É proibido o uso para fraude, pirataria ou atividades ilícitas.',
            'You agree to use the platform only for legitimate purposes, without violating applicable laws or third-party rights. Use for fraud, piracy or illegal activities is prohibited.',
            'Te comprometes a utilizar la plataforma solo con fines legítimos, sin violar leyes aplicables o derechos de terceros. Se prohíbe el uso para fraude, piratería o actividades ilícitas.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('3. Conta de Usuário', '3. User Account', '3. Cuenta de Usuario')}</h3>
          <p>{tr(
            'Você é responsável pela segurança de sua conta e por todas as atividades realizadas nela. Mantenha suas credenciais confidenciais.',
            'You are responsible for the security of your account and for all activities carried out on it. Keep your credentials confidential.',
            'Eres responsable de la seguridad de tu cuenta y de todas las actividades realizadas en ella. Mantén tus credenciales confidenciales.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('4. Propriedade Intelectual', '4. Intellectual Property', '4. Propiedad Intelectual')}</h3>
          <p>{tr(
            `Todo o conteúdo, marcas, logotipos e design de ${siteName} são de propriedade exclusiva da plataforma. A reprodução não autorizada é proibida.`,
            `All content, trademarks, logos and design of ${siteName} are the exclusive property of the platform. Unauthorized reproduction is prohibited.`,
            `Todo el contenido, marcas, logotipos y diseño de ${siteName} son propiedad exclusiva de la plataforma. La reproducción no autorizada está prohibida.`
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('5. Limitação de Responsabilidade', '5. Limitation of Liability', '5. Limitación de Responsabilidad')}</h3>
          <p>{tr(
            'A plataforma não se responsabiliza por danos indiretos, lucros cessantes ou perda de dados decorrentes do uso do serviço.',
            'The platform is not liable for indirect damages, loss of profits or data loss arising from the use of the service.',
            'La plataforma no se responsabiliza por daños indirectos, pérdida de ganancias o pérdida de datos derivados del uso del servicio.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('6. Modificações', '6. Modifications', '6. Modificaciones')}</h3>
          <p>{tr(
            'Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entram em vigor imediatamente após sua publicação.',
            'We reserve the right to modify these terms at any time. Changes take effect immediately upon publication.',
            'Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entran en vigor inmediatamente después de su publicación.'
          )}</p>
        </div>
      ),
    },
    purchase: {
      title: tr('Termos de Compra', 'Purchase Terms', 'Términos de Compra'),
      body: (
        <div className="prose prose-invert max-w-none space-y-4 text-sm text-gray-300 leading-relaxed">
          <h3 className="text-white font-semibold text-base">{tr('1. Processo de Compra', '1. Purchase Process', '1. Proceso de Compra')}</h3>
          <p>{tr(
            'A compra é confirmada após a aprovação do pagamento. O produto é disponibilizado na sua conta assim que o pagamento for validado.',
            'The purchase is confirmed after payment approval. The product is made available in your account as soon as payment is validated.',
            'La compra se confirma tras la aprobación del pago. El producto se pone a disposición en tu cuenta en cuanto se valida el pago.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('2. Preços e Pagamentos', '2. Prices and Payments', '2. Precios y Pagos')}</h3>
          <p>{tr(
            'Todos os preços estão em moeda local, salvo indicação em contrário. Reservamo-nos o direito de alterar preços sem aviso prévio, mas compras em andamento mantêm o preço acordado.',
            'All prices are in local currency, unless otherwise indicated. We reserve the right to change prices without notice, but ongoing purchases maintain the agreed price.',
            'Todos los precios están en moneda local, salvo indicación en contrario. Nos reservamos el derecho de cambiar precios sin previo aviso, pero las compras en curso mantienen el precio acordado.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('3. Entrega', '3. Delivery', '3. Entrega')}</h3>
          <p>{tr(
            'Produtos digitais são entregues instantaneamente após confirmação do pagamento. Produtos físicos seguem o prazo informado na página do produto.',
            'Digital products are delivered instantly after payment confirmation. Physical products follow the deadline informed on the product page.',
            'Los productos digitales se entregan instantáneamente tras la confirmación del pago. Los productos físicos siguen el plazo informado en la página del producto.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('4. Reembolso e Cancelamento', '4. Refund and Cancellation', '4. Reembolso y Cancelación')}</h3>
          <p>{tr(
            'Compras de produtos digitais podem ser reembolsadas em até 7 dias caso o produto não funcione conforme descrito. Cancelamentos antes da entrega são permitidos.',
            'Digital product purchases can be refunded within 7 days if the product does not work as described. Cancellations before delivery are allowed.',
            'Las compras de productos digitales pueden ser reembolsadas en un plazo de 7 días si el producto no funciona como se describe. Las cancelaciones antes de la entrega están permitidas.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('5. Garantia', '5. Warranty', '5. Garantía')}</h3>
          <p>{tr(
            'A garantia de cada produto está descrita em sua página. Em caso de defeito dentro do período de garantia, oferecemos substituição sem custo.',
            'The warranty for each product is described on its page. In case of defect within the warranty period, we offer free replacement.',
            'La garantía de cada producto se describe en su página. En caso de defecto dentro del período de garantía, ofrecemos reemplazo sin costo.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('6. Disputas', '6. Disputes', '6. Disputas')}</h3>
          <p>{tr(
            'Em caso de divergência, contate o suporte. Se não resolvido, você pode abrir uma disputa e nossa equipe mediará a resolução.',
            'In case of disagreement, contact support. If not resolved, you can open a dispute and our team will mediate the resolution.',
            'En caso de desacuerdo, contacta con soporte. Si no se resuelve, puedes abrir una disputa y nuestro equipo mediará la resolución.'
          )}</p>
        </div>
      ),
    },
    privacy: {
      title: tr('Política de Privacidade', 'Privacy Policy', 'Política de Privacidad'),
      body: (
        <div className="prose prose-invert max-w-none space-y-4 text-sm text-gray-300 leading-relaxed">
          <h3 className="text-white font-semibold text-base">{tr('1. Dados Coletados', '1. Data Collected', '1. Datos Recopilados')}</h3>
          <p>{tr(
            'Coletamos nome, e-mail, dados de pagamento e informações de navegação necessárias para o funcionamento da plataforma.',
            'We collect name, email, payment data and browsing information necessary for the platform to function.',
            'Recopilamos nombre, correo electrónico, datos de pago e información de navegación necesarios para el funcionamiento de la plataforma.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('2. Uso dos Dados', '2. Data Usage', '2. Uso de los Datos')}</h3>
          <p>{tr(
            'Seus dados são utilizados para processar compras, fornecer suporte, enviar notificações relevantes e melhorar nossos serviços.',
            'Your data is used to process purchases, provide support, send relevant notifications and improve our services.',
            'Tus datos se utilizan para procesar compras, proporcionar soporte, enviar notificaciones relevantes y mejorar nuestros servicios.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('3. Cookies', '3. Cookies', '3. Cookies')}</h3>
          <p>{tr(
            'Utilizamos cookies para melhorar sua experiência, lembrar preferências e analisar o tráfego do site. Você pode aceitar ou recusar o uso de cookies não essenciais.',
            'We use cookies to improve your experience, remember preferences and analyze site traffic. You can accept or decline the use of non-essential cookies.',
            'Utilizamos cookies para mejorar tu experiencia, recordar preferencias y analizar el tráfico del sitio. Puedes aceptar o rechazar el uso de cookies no esenciales.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('4. Compartilhamento de Dados', '4. Data Sharing', '4. Compartición de Datos')}</h3>
          <p>{tr(
            'Não vendemos seus dados. Compartilhamos informações apenas com processadores de pagamento e quando exigido por lei.',
            'We do not sell your data. We share information only with payment processors and when required by law.',
            'No vendemos tus datos. Compartimos información solo con procesadores de pago y cuando lo exige la ley.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('5. Seus Direitos', '5. Your Rights', '5. Tus Derechos')}</h3>
          <p>{tr(
            'Você tem o direito de acessar, corrigir ou excluir seus dados. Para exercer esses direitos, contate-nos pelo e-mail de suporte.',
            'You have the right to access, correct or delete your data. To exercise these rights, contact us via the support email.',
            'Tienes derecho a acceder, corregir o eliminar tus datos. Para ejercer estos derechos, contáctanos a través del correo de soporte.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('6. Segurança', '6. Security', '6. Seguridad')}</h3>
          <p>{tr(
            'Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia e acesso restrito.',
            'We adopt technical and organizational measures to protect your data, including encryption and restricted access.',
            'Adoptamos medidas técnicas y organizativas para proteger tus datos, incluyendo cifrado y acceso restringido.'
          )}</p>
        </div>
      ),
    },
    about: {
      title: tr('Sobre Nós', 'About Us', 'Sobre Nosotros'),
      body: (
        <div className="prose prose-invert max-w-none space-y-4 text-sm text-gray-300 leading-relaxed">
          <p>{tr(
            `${siteName} é uma plataforma dedicada a conectar vendedores e compradores de produtos digitais de forma segura, rápida e transparente.`,
            `${siteName} is a platform dedicated to connecting sellers and buyers of digital products in a secure, fast and transparent way.`,
            `${siteName} es una plataforma dedicada a conectar vendedores y compradores de productos digitales de forma segura, rápida y transparente.`
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('Nossa Missão', 'Our Mission', 'Nuestra Misión')}</h3>
          <p>{tr(
            'Oferecer uma experiência de compra e venda simplificada, com segurança e confiabilidade, empowering nossa comunidade.',
            'Offer a simplified buying and selling experience, with security and reliability, empowering our community.',
            'Ofrecer una experiencia de compra y venta simplificada, con seguridad y confiabilidad, empoderando a nuestra comunidad.'
          )}</p>
          <h3 className="text-white font-semibold text-base">{tr('Nossos Valores', 'Our Values', 'Nuestros Valores')}</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>{tr('Transparência em todas as transações', 'Transparency in all transactions', 'Transparencia en todas las transacciones')}</li>
            <li>{tr('Segurança e proteção de dados', 'Security and data protection', 'Seguridad y protección de datos')}</li>
            <li>{tr('Suporte de qualidade aos usuários', 'Quality user support', 'Soporte de calidad a los usuarios')}</li>
            <li>{tr('Inovação constante da plataforma', 'Constant platform innovation', 'Innovación constante de la plataforma')}</li>
          </ul>
          <h3 className="text-white font-semibold text-base">{tr('Contato', 'Contact', 'Contacto')}</h3>
          <p>{tr(
            `Para dúvidas, sugestões ou parcerias, entre em contato através do e-mail ${contactEmail}.`,
            `For questions, suggestions or partnerships, contact us via email at ${contactEmail}.`,
            `Para dudas, sugerencias o alianzas, contáctanos a través del correo ${contactEmail}.`
          )}</p>
        </div>
      ),
    },
  };

  return (
    <>
      <footer className="bg-gray-900 text-white border-t border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main footer grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 py-10">
            {/* Brand column */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-3">
                {footerLogo ? (
                  <img
                    src={footerLogo}
                    alt="Logo"
                    className="h-7 w-7 object-contain rounded"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`bg-gradient-to-r from-blue-500 to-cyan-600 p-1.5 rounded ${footerLogo ? 'hidden' : ''}`}>
                  <Globe className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-base">{siteName}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                {tr(
                  'Sua plataforma de produtos digitais com segurança e confiança.',
                  'Your digital products platform with security and trust.',
                  'Tu plataforma de productos digitales con seguridad y confianza.'
                )}
              </p>
              {/* Social */}
              {socialLinks.length > 0 && (
                <div className="flex items-center space-x-3">
                  {socialLinks.map((s) => {
                    const Icon = s.icon;
                    return (
                      <a
                        key={s.name}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-gray-400 ${s.color} transition-colors duration-200 transform hover:scale-110`}
                        title={s.name}
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation links column */}
            <div className="md:col-span-1">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                {tr('Navegação', 'Navigation', 'Navegación')}
              </h4>
              <ul className="space-y-2.5">
                {navigationLinks.length > 0 ? navigationLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <li key={link.id}>
                      <button
                        onClick={() => onNavigate?.(link.id)}
                        className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors group"
                      >
                        <Icon className="h-3.5 w-3.5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                        <span>{link.name}</span>
                      </button>
                    </li>
                  );
                }) : (
                  <>
                    <li>
                      <a
                        href="#community"
                        className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors group"
                      >
                        <HelpCircle className="h-3.5 w-3.5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                        <span>{tr('Comunidade', 'Community', 'Comunidad')}</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="#affiliates"
                        className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors group"
                      >
                        <HelpCircle className="h-3.5 w-3.5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                        <span>{tr('Afiliados', 'Affiliates', 'Afiliados')}</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="#accounts"
                        className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors group"
                      >
                        <HelpCircle className="h-3.5 w-3.5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                        <span>{tr('Streaming', 'Streaming', 'Streaming')}</span>
                      </a>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Legal links column */}
            <div className="md:col-span-1">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                {tr('Links Úteis', 'Useful Links', 'Enlaces Útiles')}
              </h4>
              <ul className="space-y-2.5">
                {legalLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <li key={link.key}>
                      <button
                        onClick={() => { setOpenDoc(link.key); setOpenFaqItem(null); }}
                        className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors group"
                      >
                        <Icon className="h-3.5 w-3.5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                        <span>{link.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Contact column */}
            <div className="md:col-span-1">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                {tr('Contato', 'Contact', 'Contacto')}
              </h4>
              <div className="space-y-2.5">
                <a
                  href={`mailto:${contactEmail}`}
                  className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 text-gray-500" />
                  <span className="break-all">{contactEmail}</span>
                </a>
                {social.whatsapp && (
                  <a
                    href={`https://wa.me/${social.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-gray-500" />
                    <span>{tr('WhatsApp', 'WhatsApp', 'WhatsApp')}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Newsletter / follow column */}
            <div className="md:col-span-1">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                {tr('Comunidade', 'Community', 'Comunidad')}
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                {tr(
                  'Junte-se à nossa comunidade e fique por dentro das novidades.',
                  'Join our community and stay up to date with news.',
                  'Únete a nuestra comunidad y mantente al día con las novedades.'
                )}
              </p>
              {socialLinks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {socialLinks.slice(0, 4).map((s) => {
                    const Icon = s.icon;
                    return (
                      <a
                        key={s.name}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all duration-200"
                        title={s.name}
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-800 py-5">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0">
              <div className="text-xs text-gray-400 text-center md:text-left">
                {copyrightText}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <button
                  onClick={() => setOpenDoc('privacy')}
                  className="hover:text-white transition-colors"
                >
                  {tr('Privacidade', 'Privacy', 'Privacidad')}
                </button>
                <span className="text-gray-700">|</span>
                <button
                  onClick={() => setShowCookieBanner(true)}
                  className="flex items-center space-x-1 hover:text-white transition-colors"
                >
                  <Cookie className="h-3 w-3" />
                  <span>{tr('Cookies', 'Cookies', 'Cookies')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tagline */}
          {(siteSettings?.footer_text || lang) && (
            <div className="pb-5 text-center">
              <p className="text-xs text-gray-500 flex items-center justify-center space-x-1">
                {siteSettings?.footer_text ? (
                  <span>{siteSettings.footer_text}</span>
                ) : (
                  <>
                    <span>
                      {lang === 'pt' ? 'Feito com' : lang === 'en' ? 'Made with' : 'Hecho con'}
                    </span>
                    <Heart className="h-3 w-3 text-red-500 animate-pulse" />
                    <span>
                      {lang === 'pt' ? 'para a comunidade de streaming' : lang === 'en' ? 'for the streaming community' : 'para la comunidad de streaming'}
                    </span>
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </footer>

      {/* Legal Document Modal */}
      {openDoc && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setOpenDoc(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">{legalContent[openDoc].title}</h2>
              <button
                onClick={() => setOpenDoc(null)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              {legalContent[openDoc].body}
            </div>
          </div>
        </div>
      )}

      {/* Cookie Consent Banner */}
      {showCookieBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[70] animate-in slide-in-from-bottom duration-300">
          <div className="max-w-7xl mx-auto m-4 p-5 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-start space-x-3 flex-1">
                <div className="flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-lg">
                  <Cookie className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-200 leading-relaxed">
                    {tr(
                      'Utilizamos cookies para melhorar sua experiência e analisar o tráfego. Você pode aceitar ou recusar os cookies não essenciais.',
                      'We use cookies to improve your experience and analyze traffic. You can accept or decline non-essential cookies.',
                      'Utilizamos cookies para mejorar tu experiencia y analizar el tráfico. Puedes aceptar o rechazar las cookies no esenciales.'
                    )}
                  </p>
                  <button
                    onClick={() => { setOpenDoc('privacy'); }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors mt-1 underline"
                  >
                    {tr('Saiba mais na Política de Privacidade', 'Learn more in our Privacy Policy', 'Más info en la Política de Privacidad')}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => handleCookieChoice(false)}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
                >
                  {tr('Recusar', 'Decline', 'Rechazar')}
                </button>
                <button
                  onClick={() => handleCookieChoice(true)}
                  className="flex-1 sm:flex-none px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg transition-all shadow-lg shadow-cyan-500/20"
                >
                  {tr('Aceitar', 'Accept', 'Aceptar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
