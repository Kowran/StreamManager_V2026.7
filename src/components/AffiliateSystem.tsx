import React, { useState, useEffect } from 'react';
import { Users, Link, Copy, Check, DollarSign, TrendingUp, Eye, Calendar, Gift, Share2, UserPlus, Percent, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { useNotificationContext } from './NotificationProvider';

interface AffiliateLink {
  id: string;
  user_id: string;
  code: string;
  clicks: number;
  conversions: number;
  total_earned: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface AffiliateReferral {
  id: string;
  referrer_id: string;
  referred_id: string;
  affiliate_code: string;
  registration_date: string;
  first_purchase_date?: string;
  total_spent: number;
  total_commission_earned: number;
  active: boolean;
  profiles?: {
    email: string;
    full_name?: string;
  };
}

interface AffiliateCommission {
  id: string;
  referrer_id: string;
  referred_id: string;
  recharge_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  paid_at?: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
}

export function AffiliateSystem() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { addNotification } = useNotificationContext();
  const [affiliateLink, setAffiliateLink] = useState<AffiliateLink | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'commissions'>('overview');

  useEffect(() => {
    if (user) {
      loadAffiliateData();
    }
  }, [user]);

  async function loadAffiliateData() {
    if (!user) return;

    try {
      // Load or create affiliate link
      let { data: linkData, error: linkError } = await supabase
        .from('affiliate_links')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (linkError && linkError.code !== 'PGRST116') {
        throw linkError;
      }

      // If no affiliate link exists, create one
      if (!linkData) {
        console.log('No affiliate link found, creating one for user:', user.id);
        
        // Call the database function to ensure user has affiliate link
        const { data: createResult, error: createError } = await supabase
          .rpc('ensure_user_affiliate_link', {
            p_user_id: user.id
          });

        if (createError) {
          console.error('Error creating affiliate link:', createError);
        } else {
          console.log('Affiliate link creation result:', createResult);
          
          // Reload the affiliate link
          const { data: newLinkData, error: reloadError } = await supabase
            .from('affiliate_links')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!reloadError && newLinkData) {
            linkData = newLinkData;
          }
        }
      }

      setAffiliateLink(linkData);

      // Load referrals
      const { data: referralsData, error: referralsError } = await supabase
        .from('affiliate_referrals')
        .select(`
          *,
          referred_profiles:profiles!referred_id (
            email,
            full_name
          )
        `)
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (referralsError) throw referralsError;
      
      // Map the data to match expected structure
      const mappedReferrals = (referralsData || []).map(referral => ({
        ...referral,
        profiles: referral.referred_profiles
      }));
      setReferrals(mappedReferrals);

      // Load commissions
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('affiliate_commissions')
        .select(`
          *,
          referred_profiles:profiles!referred_id (
            email,
            full_name
          )
        `)
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (commissionsError) throw commissionsError;
      
      // Map the data to match expected structure
      const mappedCommissions = (commissionsData || []).map(commission => ({
        ...commission,
        profiles: commission.referred_profiles
      }));
      setCommissions(mappedCommissions);

    } catch (error) {
      console.error('Error loading affiliate data:', error);
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

  async function toggleAffiliateLink() {
    if (!user || !affiliateLink) return;

    try {
      const { error } = await supabase
        .from('affiliate_links')
        .update({
          active: !affiliateLink.active,
          updated_at: new Date().toISOString()
        })
        .eq('id', affiliateLink.id);

      if (error) throw error;

      setAffiliateLink(prev => prev ? { ...prev, active: !prev.active } : null);

      await addNotification({
        type: 'system',
        title: affiliateLink.active ? '⏸️ Link Desativado' : '✅ Link Ativado',
        message: `Seu link de afiliado foi ${affiliateLink.active ? 'desativado' : 'ativado'} com sucesso!`,
        data: { action: 'affiliate_link_toggle' },
        priority: 'medium'
      });

    } catch (error) {
      console.error('Error toggling affiliate link:', error);
      alert('Erro ao atualizar link de afiliado');
    }
  }

  function getAffiliateUrl() {
    if (!affiliateLink) return '';
    const baseUrl = 'https://www.streammanager.com.br';
    return `${baseUrl}?ref=${affiliateLink.code}`;
  }

  function shareAffiliateLink() {
    const url = getAffiliateUrl();
    const text = t.language === 'pt' 
      ? `🎉 Junte-se ao StreamManager e ganhe créditos grátis!\n\n✅ Plataforma completa para gerenciar contas de streaming\n✅ Loja integrada com produtos premium\n✅ Sistema de créditos e pagamentos\n✅ Suporte 24/7\n\nCadastre-se usando meu link e comece agora:\n${url}\n\n#StreamManager #Streaming #Afiliados`
      : t.language === 'en'
      ? `🎉 Join StreamManager and get free credits!\n\n✅ Complete platform for managing streaming accounts\n✅ Integrated store with premium products\n✅ Credits and payment system\n✅ 24/7 support\n\nSign up using my link and start now:\n${url}\n\n#StreamManager #Streaming #Affiliates`
      : `🎉 ¡Únete a StreamManager y obtén créditos gratis!\n\n✅ Plataforma completa para gestionar cuentas de streaming\n✅ Tienda integrada con productos premium\n✅ Sistema de créditos y pagos\n✅ Soporte 24/7\n\nRegístrate usando mi enlace y comienza ahora:\n${url}\n\n#StreamManager #Streaming #Afiliados`;

    if (navigator.share) {
      navigator.share({
        title: 'StreamManager - Sistema de Afiliados',
        text: text,
        url: url
      });
    } else {
      copyToClipboard(text);
      alert(t.language === 'pt' ? 'Texto copiado! Cole onde quiser compartilhar.' :
            t.language === 'en' ? 'Text copied! Paste wherever you want to share.' :
            '¡Texto copiado! Pega donde quieras compartir.');
    }
  }

  const stats = {
    totalClicks: affiliateLink?.clicks || 0,
    totalConversions: affiliateLink?.conversions || 0,
    totalEarned: affiliateLink?.total_earned || 0,
    conversionRate: affiliateLink?.clicks ? ((affiliateLink.conversions / affiliateLink.clicks) * 100).toFixed(1) : '0.0',
    activeReferrals: referrals.filter(r => r.active).length,
    totalCommissions: commissions.length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {t.language === 'pt' ? 'Sistema de Afiliados' :
           t.language === 'en' ? 'Affiliate System' :
           'Sistema de Afiliados'}
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t.language === 'pt' ? 'Convide amigos e ganhe 5% de comissão em todas as recargas deles' :
           t.language === 'en' ? 'Invite friends and earn 5% commission on all their recharges' :
           'Invita amigos y gana 5% de comisión en todas sus recargas'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">
                {t.language === 'pt' ? 'Total Ganho' :
                 t.language === 'en' ? 'Total Earned' :
                 'Total Ganado'}
              </p>
              <p className="text-lg sm:text-xl font-bold text-green-600">{formatPrice(stats.totalEarned)}</p>
            </div>
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">
                {t.language === 'pt' ? 'Indicados' :
                 t.language === 'en' ? 'Referrals' :
                 'Referidos'}
              </p>
              <p className="text-lg sm:text-xl font-bold text-blue-600">{stats.activeReferrals}</p>
            </div>
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">
                {t.language === 'pt' ? 'Cliques' :
                 t.language === 'en' ? 'Clicks' :
                 'Clics'}
              </p>
              <p className="text-lg sm:text-xl font-bold text-purple-600">{stats.totalClicks}</p>
            </div>
            <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">
                {t.language === 'pt' ? 'Conversões' :
                 t.language === 'en' ? 'Conversions' :
                 'Conversiones'}
              </p>
              <p className="text-lg sm:text-xl font-bold text-orange-600">{stats.totalConversions}</p>
            </div>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">
                {t.language === 'pt' ? 'Taxa Conversão' :
                 t.language === 'en' ? 'Conversion Rate' :
                 'Tasa Conversión'}
              </p>
              <p className="text-lg sm:text-xl font-bold text-indigo-600">{stats.conversionRate}%</p>
            </div>
            <Percent className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">
                {t.language === 'pt' ? 'Comissões' :
                 t.language === 'en' ? 'Commissions' :
                 'Comisiones'}
              </p>
              <p className="text-lg sm:text-xl font-bold text-pink-600">{stats.totalCommissions}</p>
            </div>
            <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-pink-500" />
          </div>
        </div>
      </div>

      {/* Affiliate Link Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 mb-4">
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl font-bold mb-2">
              {t.language === 'pt' ? 'Seu Link de Afiliado' :
               t.language === 'en' ? 'Your Affiliate Link' :
               'Tu Enlace de Afiliado'}
            </h3>
            <p className="text-blue-100 text-sm sm:text-base">
              {t.language === 'pt' ? 'Compartilhe este link e ganhe 5% de comissão em cada recarga' :
               t.language === 'en' ? 'Share this link and earn 5% commission on each recharge' :
               'Comparte este enlace y gana 5% de comisión en cada recarga'}
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <Share2 className="h-8 w-8" />
            </div>
          </div>
        </div>

        {affiliateLink ? (
          <div className="space-y-3 sm:space-y-4">
            {/* Affiliate Code */}
            <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-blue-100 mb-1">
                    {t.language === 'pt' ? 'Seu Código:' :
                     t.language === 'en' ? 'Your Code:' :
                     'Tu Código:'}
                  </label>
                  <span className="text-xl sm:text-2xl font-bold font-mono break-all">{affiliateLink.code}</span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    affiliateLink.active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {affiliateLink.active ? 
                      (t.language === 'pt' ? 'Ativo' : t.language === 'en' ? 'Active' : 'Activo') :
                      (t.language === 'pt' ? 'Inativo' : t.language === 'en' ? 'Inactive' : 'Inactivo')
                    }
                  </span>
                  <button
                    onClick={toggleAffiliateLink}
                    className="w-full sm:w-auto px-3 py-1.5 sm:py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-sm font-medium transition-colors touch-manipulation"
                  >
                    {affiliateLink.active ? 
                      (t.language === 'pt' ? 'Desativar' : t.language === 'en' ? 'Deactivate' : 'Desactivar') :
                      (t.language === 'pt' ? 'Ativar' : t.language === 'en' ? 'Activate' : 'Activar')
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Affiliate URL */}
            <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4">
              <label className="block text-sm font-medium text-blue-100 mb-2">
                {t.language === 'pt' ? 'Link de Convite:' :
                 t.language === 'en' ? 'Invitation Link:' :
                 'Enlace de Invitación:'}
              </label>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <input
                  type="text"
                  value={getAffiliateUrl()}
                  readOnly
                  className="flex-1 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-lg px-3 py-2 text-white placeholder-blue-200 font-mono text-xs sm:text-sm break-all"
                />
                <button
                  onClick={() => copyToClipboard(getAffiliateUrl())}
                  className="w-full sm:w-auto px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors flex items-center justify-center space-x-2 touch-manipulation"
                >
                  {copiedText === getAffiliateUrl() ? (
                    <Check className="h-4 w-4 text-green-300" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="text-xs sm:text-sm font-medium">
                    {t.language === 'pt' ? 'Copiar' :
                     t.language === 'en' ? 'Copy' :
                     'Copiar'}
                  </span>
                </button>
              </div>
            </div>

            {/* Share Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={shareAffiliateLink}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 sm:py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors touch-manipulation"
              >
                <Share2 className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">
                  {t.language === 'pt' ? 'Compartilhar' :
                   t.language === 'en' ? 'Share' :
                   'Compartir'}
                </span>
              </button>

              <button
                onClick={() => {
                  const url = getAffiliateUrl();
                  const message = encodeURIComponent(
                    t.language === 'pt' 
                      ? `🎉 Oi! Te convido para conhecer o StreamManager, uma plataforma incrível para gerenciar contas de streaming!\n\n✅ Loja integrada\n✅ Sistema de créditos\n✅ Suporte 24/7\n\nCadastre-se pelo meu link: ${url}`
                      : t.language === 'en'
                      ? `🎉 Hi! I invite you to check out StreamManager, an amazing platform for managing streaming accounts!\n\n✅ Integrated store\n✅ Credit system\n✅ 24/7 support\n\nSign up through my link: ${url}`
                      : `🎉 ¡Hola! Te invito a conocer StreamManager, una plataforma increíble para gestionar cuentas de streaming!\n\n✅ Tienda integrada\n✅ Sistema de créditos\n✅ Soporte 24/7\n\nRegístrate con mi enlace: ${url}`
                  );
                  window.open(`https://wa.me/?text=${message}`, '_blank');
                }}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 sm:py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors touch-manipulation"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">WhatsApp</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8">
            <div className="bg-white bg-opacity-20 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h4 className="text-base sm:text-lg font-medium mb-2">
              {t.language === 'pt' ? 'Link não encontrado' :
               t.language === 'en' ? 'Link not found' :
               'Enlace no encontrado'}
            </h4>
            <p className="text-blue-100 text-xs sm:text-sm">
              {t.language === 'pt' ? 'Seu link de afiliado será criado automaticamente' :
               t.language === 'en' ? 'Your affiliate link will be created automatically' :
               'Tu enlace de afiliado se creará automáticamente'}
            </p>
          </div>
        )}
      </div>

      {/* How it Works */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3 sm:mb-4">
          {t.language === 'pt' ? '💡 Como Funciona' :
           t.language === 'en' ? '💡 How It Works' :
           '💡 Cómo Funciona'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-2 sm:p-3 rounded-full w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
            </div>
            <h4 className="text-sm sm:text-base font-medium text-blue-800 dark:text-blue-300 mb-1">
              {t.language === 'pt' ? 'Compartilhe' :
               t.language === 'en' ? 'Share' :
               'Comparte'}
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              {t.language === 'pt' ? 'Envie seu link para amigos' :
               t.language === 'en' ? 'Send your link to friends' :
               'Envía tu enlace a amigos'}
            </p>
          </div>

          <div className="text-center">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-2 sm:p-3 rounded-full w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
            </div>
            <h4 className="text-sm sm:text-base font-medium text-blue-800 dark:text-blue-300 mb-1">
              {t.language === 'pt' ? 'Cadastro' :
               t.language === 'en' ? 'Registration' :
               'Registro'}
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              {t.language === 'pt' ? 'Eles se cadastram pelo seu link' :
               t.language === 'en' ? 'They register through your link' :
               'Se registran a través de tu enlace'}
            </p>
          </div>

          <div className="text-center">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-2 sm:p-3 rounded-full w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
            </div>
            <h4 className="text-sm sm:text-base font-medium text-blue-800 dark:text-blue-300 mb-1">
              {t.language === 'pt' ? 'Recargas' :
               t.language === 'en' ? 'Recharges' :
               'Recargas'}
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              {t.language === 'pt' ? 'Eles fazem recargas na conta' :
               t.language === 'en' ? 'They make account recharges' :
               'Hacen recargas en la cuenta'}
            </p>
          </div>

          <div className="text-center">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-2 sm:p-3 rounded-full w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-bold">4</span>
            </div>
            <h4 className="text-sm sm:text-base font-medium text-blue-800 dark:text-blue-300 mb-1">
              {t.language === 'pt' ? 'Você Ganha' :
               t.language === 'en' ? 'You Earn' :
               'Tú Ganas'}
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              {t.language === 'pt' ? '5% de cada recarga deles' :
               t.language === 'en' ? '5% of each their recharge' :
               '5% de cada recarga de ellos'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-4 sm:space-x-6 lg:space-x-8 overflow-x-auto scrollbar-hide">
          {[
            { id: 'overview', name: t.language === 'pt' ? 'Visão Geral' : t.language === 'en' ? 'Overview' : 'Resumen', icon: TrendingUp },
            { id: 'referrals', name: t.language === 'pt' ? 'Indicados' : t.language === 'en' ? 'Referrals' : 'Referidos', icon: Users },
            { id: 'commissions', name: t.language === 'pt' ? 'Comissões' : t.language === 'en' ? 'Commissions' : 'Comisiones', icon: DollarSign }
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center space-x-1 sm:space-x-2 transition-colors whitespace-nowrap touch-manipulation ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <IconComponent className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Resumo do Programa' :
               t.language === 'en' ? 'Program Overview' :
               'Resumen del Programa'}
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
                  <h4 className="text-sm sm:text-base font-medium text-green-800 dark:text-green-300 mb-2">
                    💰 {t.language === 'pt' ? 'Comissão de 5%' :
                         t.language === 'en' ? '5% Commission' :
                         'Comisión del 5%'}
                  </h4>
                  <p className="text-xs sm:text-sm text-green-700 dark:text-green-400 leading-relaxed">
                    {t.language === 'pt' ? 'Ganhe 5% do valor de cada recarga que seus indicados fizerem' :
                     t.language === 'en' ? 'Earn 5% of the value of each recharge your referrals make' :
                     'Gana 5% del valor de cada recarga que hagan tus referidos'}
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                  <h4 className="text-sm sm:text-base font-medium text-blue-800 dark:text-blue-300 mb-2">
                    ⚡ {t.language === 'pt' ? 'Pagamento Instantâneo' :
                         t.language === 'en' ? 'Instant Payment' :
                         'Pago Instantáneo'}
                  </h4>
                  <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
                    {t.language === 'pt' ? 'Receba sua comissão automaticamente no seu saldo' :
                     t.language === 'en' ? 'Receive your commission automatically in your balance' :
                     'Recibe tu comisión automáticamente en tu saldo'}
                  </p>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 sm:p-4">
                  <h4 className="text-sm sm:text-base font-medium text-purple-800 dark:text-purple-300 mb-2">
                    ♾️ {t.language === 'pt' ? 'Comissão Vitalícia' :
                         t.language === 'en' ? 'Lifetime Commission' :
                         'Comisión de por Vida'}
                  </h4>
                  <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-400 leading-relaxed">
                    {t.language === 'pt' ? 'Ganhe comissão em todas as recargas futuras dos seus indicados' :
                     t.language === 'en' ? 'Earn commission on all future recharges from your referrals' :
                     'Gana comisión en todas las recargas futuras de tus referidos'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4">
                  <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-2 sm:mb-3">
                    📊 {t.language === 'pt' ? 'Suas Estatísticas' :
                         t.language === 'en' ? 'Your Statistics' :
                         'Tus Estadísticas'}
                  </h4>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t.language === 'pt' ? 'Total ganho:' :
                         t.language === 'en' ? 'Total earned:' :
                         'Total ganado:'}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-green-600">{formatPrice(stats.totalEarned)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t.language === 'pt' ? 'Usuários indicados:' :
                         t.language === 'en' ? 'Referred users:' :
                         'Usuarios referidos:'}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-blue-600">{stats.activeReferrals}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t.language === 'pt' ? 'Taxa de conversão:' :
                         t.language === 'en' ? 'Conversion rate:' :
                         'Tasa de conversión:'}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-purple-600">{stats.conversionRate}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {t.language === 'pt' ? 'Comissões pagas:' :
                         t.language === 'en' ? 'Commissions paid:' :
                         'Comisiones pagadas:'}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-orange-600">{stats.totalCommissions}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 sm:p-4">
                  <h4 className="text-sm sm:text-base font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                    💡 {t.language === 'pt' ? 'Dicas para Sucesso' :
                         t.language === 'en' ? 'Success Tips' :
                         'Consejos para el Éxito'}
                  </h4>
                  <ul className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-400 space-y-1 leading-relaxed">
                    <li>• {t.language === 'pt' ? 'Compartilhe em redes sociais' :
                           t.language === 'en' ? 'Share on social media' :
                           'Comparte en redes sociales'}</li>
                    <li>• {t.language === 'pt' ? 'Explique os benefícios da plataforma' :
                           t.language === 'en' ? 'Explain the platform benefits' :
                           'Explica los beneficios de la plataforma'}</li>
                    <li>• {t.language === 'pt' ? 'Ajude seus indicados a usar o sistema' :
                           t.language === 'en' ? 'Help your referrals use the system' :
                           'Ayuda a tus referidos a usar el sistema'}</li>
                    <li>• {t.language === 'pt' ? 'Seja ativo e engajado' :
                           t.language === 'en' ? 'Be active and engaged' :
                           'Sé activo y comprometido'}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'referrals' && (
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Seus Indicados' :
               t.language === 'en' ? 'Your Referrals' :
               'Tus Referidos'}
            </h3>

            {referrals.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <UserPlus className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
                <h4 className="mt-2 text-sm font-medium text-gray-900 dark:text-white px-4">
                  {t.language === 'pt' ? 'Nenhum indicado ainda' :
                   t.language === 'en' ? 'No referrals yet' :
                   'Aún no hay referidos'}
                </h4>
                <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-4">
                  {t.language === 'pt' ? 'Compartilhe seu link para começar a ganhar comissões' :
                   t.language === 'en' ? 'Share your link to start earning commissions' :
                   'Comparte tu enlace para empezar a ganar comisiones'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {referrals.map((referral) => (
                  <div key={referral.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">
                            {referral.profiles?.full_name || referral.profiles?.email?.split('@')[0] || 'Usuário'}
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                            {referral.profiles?.email}
                          </p>
                          <div className="flex flex-col sm:flex-row sm:items-center space-y-0.5 sm:space-y-0 sm:space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="truncate">
                              {t.language === 'pt' ? 'Cadastrou em' :
                               t.language === 'en' ? 'Registered on' :
                               'Registrado el'} {new Date(referral.registration_date).toLocaleDateString(
                                t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                              )}
                            </span>
                            {referral.first_purchase_date && (
                              <span className="truncate">
                                {t.language === 'pt' ? 'Primeira compra:' :
                                 t.language === 'en' ? 'First purchase:' :
                                 'Primera compra:'} {new Date(referral.first_purchase_date).toLocaleDateString(
                                  t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right sm:ml-3 flex-shrink-0">
                        <div className="text-base sm:text-lg font-bold text-green-600">
                          {formatPrice(referral.total_commission_earned)}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {t.language === 'pt' ? 'comissão total' :
                           t.language === 'en' ? 'total commission' :
                           'comisión total'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {formatPrice(referral.total_spent)} {t.language === 'pt' ? 'gastos' :
                                                              t.language === 'en' ? 'spent' :
                                                              'gastados'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'commissions' && (
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Histórico de Comissões' :
               t.language === 'en' ? 'Commission History' :
               'Historial de Comisiones'}
            </h3>

            {commissions.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Gift className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
                <h4 className="mt-2 text-sm font-medium text-gray-900 dark:text-white px-4">
                  {t.language === 'pt' ? 'Nenhuma comissão ainda' :
                   t.language === 'en' ? 'No commissions yet' :
                   'Aún no hay comisiones'}
                </h4>
                <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-4">
                  {t.language === 'pt' ? 'Suas comissões aparecerão aqui quando seus indicados fizerem recargas' :
                   t.language === 'en' ? 'Your commissions will appear here when your referrals make recharges' :
                   'Tus comisiones aparecerán aquí cuando tus referidos hagan recargas'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {commissions.map((commission) => (
                  <div key={commission.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div className="h-6 w-6 sm:h-8 sm:w-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                            +{formatPrice(commission.commission_amount)} {t.language === 'pt' ? 'comissão' :
                                                                         t.language === 'en' ? 'commission' :
                                                                         'comisión'}
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                            {t.language === 'pt' ? 'De' : t.language === 'en' ? 'From' : 'De'} {commission.profiles?.full_name || commission.profiles?.email?.split('@')[0] || 'Usuário'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 break-words">
                            {t.language === 'pt' ? 'Recarga de' :
                             t.language === 'en' ? 'Recharge of' :
                             'Recarga de'} {formatPrice(commission.recharge_amount)} • {(commission.commission_rate * 100).toFixed(1)}% {t.language === 'pt' ? 'comissão' :
                                                                                                                                                                    t.language === 'en' ? 'commission' :
                                                                                                                                                                    'comisión'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right sm:ml-3 flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          commission.status === 'paid' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : commission.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {commission.status === 'paid' ? 
                            (t.language === 'pt' ? 'Pago' : t.language === 'en' ? 'Paid' : 'Pagado') :
                           commission.status === 'pending' ?
                            (t.language === 'pt' ? 'Pendente' : t.language === 'en' ? 'Pending' : 'Pendiente') :
                            (t.language === 'pt' ? 'Cancelado' : t.language === 'en' ? 'Cancelled' : 'Cancelado')
                          }
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 text-center sm:text-right">
                          {new Date(commission.created_at).toLocaleDateString(
                            t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}