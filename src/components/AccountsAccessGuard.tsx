import React, { useState, useEffect } from 'react';
import { Lock, CreditCard, Calendar, Star, Check, AlertCircle } from 'lucide-react';
import { supabase, hasAccountsAccess, getUserAccountsAccess } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { useNotifications } from '../hooks/useNotifications';

interface AccountsAccess {
  id: string;
  access_type: string;
  purchased_at: string;
  expires_at?: string;
  duration_days: number;
  price_paid: number;
  active: boolean;
  days_remaining: number;
}

interface AccountsAccessGuardProps {
  children: React.ReactNode;
}

export function AccountsAccessGuard({ children }: AccountsAccessGuardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { addNotification } = useNotifications();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessInfo, setAccessInfo] = useState<AccountsAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [userCredit, setUserCredit] = useState<{ balance: number } | null>(null);

  useEffect(() => {
    if (user) {
      checkAccess();
      loadUserCredit();
    }
  }, [user]);

  async function checkAccess() {
    if (!user) return;

    try {
      const hasAccessResult = await hasAccountsAccess(user.id);
      setHasAccess(hasAccessResult);

      if (hasAccessResult) {
        const accessData = await getUserAccountsAccess(user.id);
        setAccessInfo(accessData);
      }
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserCredit() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setUserCredit(data || { balance: 0 });
    } catch (error) {
      console.error('Error loading user credit:', error);
      setUserCredit({ balance: 0 });
    }
  }

  async function handlePurchaseAccess() {
    if (!user || !userCredit) return;

    const accessPrice = 5.00;
    
    if (userCredit.balance < accessPrice) {
      alert('Saldo insuficiente. Você precisa de $5.00 para comprar o acesso ao gerenciador de contas.');
      return;
    }

    setPurchasing(true);

    try {
      // Get the accounts access product
      const { data: products, error: productError } = await supabase
        .from('store_products')
        .select('*')
        .ilike('name', '%account%manager%')
        .eq('active', true);

      if (productError) throw productError;

      // Find or create the accounts access product
      let product = products?.find(p => 
        p.name.toLowerCase().includes('account') && 
        p.name.toLowerCase().includes('manager')
      );

      if (!product) {
        // Create the product if it doesn't exist
        const { data: newProduct, error: createError } = await supabase
          .from('store_products')
          .insert([{
            name: 'Accounts Manager Access',
            description: 'Access to the streaming accounts management system for 30 days',
            price_brl: accessPrice * 5.5,
            price_usdt: accessPrice,
            category: 'access',
            auto_delivery: true,
            active: true
          }])
          .select()
          .single();

        if (createError) throw createError;
        product = newProduct;
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('store_orders')
        .insert([{
          user_id: user.id,
          product_id: product.id,
          quantity: 1,
          total_brl: accessPrice * 5.5,
          total_usdt: accessPrice,
          status: 'pending',
          customer_email: user.email,
          customer_name: user.email,
          delivery_data: {
            product_name: product.name,
            access_type: 'accounts_manager',
            duration_days: 30
          }
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create credit transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert([{
          user_id: user.id,
          type: 'purchase',
          amount: accessPrice,
          balance_before: userCredit.balance,
          balance_after: userCredit.balance - accessPrice,
          description: 'Compra: Acesso ao Gerenciador de Contas (30 dias)',
          reference_id: order.id,
          reference_type: 'accounts_access',
          metadata: {
            product_name: product.name,
            access_duration: 30,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        }]);

      if (transactionError) throw transactionError;

      // Update order status
      const { error: updateOrderError } = await supabase
        .from('store_orders')
        .update({ status: 'paid' })
        .eq('id', order.id);

      if (updateOrderError) throw updateOrderError;

      // Create accounts access record
      const { error: accessError } = await supabase
        .from('accounts_access_purchases')
        .insert([{
          user_id: user.id,
          order_id: order.id,
          purchased_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          active: true
        }]);

      if (accessError) throw accessError;

      // Create delivery record
      const { error: deliveryError } = await supabase
        .from('store_deliveries')
        .insert([{
          order_id: order.id,
          product_id: product.id,
          user_id: user.id,
          delivery_content: {
            product_name: product.name,
            access_type: 'accounts_manager',
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            instructions: 'Seu acesso ao Gerenciador de Contas foi ativado! Você pode agora gerenciar suas contas de streaming por 30 dias. O acesso expira automaticamente após este período.',
            features: [
              'Gerenciar contas de streaming',
              'Criar e editar perfis',
              'Acompanhar status das contas',
              'Controlar datas de expiração'
            ]
          },
          delivery_method: 'system',
          delivery_status: 'delivered'
        }]);

      if (deliveryError) throw deliveryError;

      // Refresh access status
      await checkAccess();
      await loadUserCredit();

      // Create success notification for access purchase
      await addNotification({
        type: 'system',
        title: '🎉 Acesso Ativado!',
        message: 'Seu acesso ao Gerenciador de Contas foi ativado com sucesso! Válido por 30 dias.',
        data: {
          access_type: 'accounts_manager',
          duration_days: 30,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          price_paid: accessPrice
        },
        priority: 'high'
      });
    } catch (error) {
      console.error('Error purchasing access:', error);
      alert('Erro ao processar compra. Tente novamente.');
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (hasAccess) {
    return (
      <div className="space-y-4">
        {/* Access status banner */}
        {accessInfo && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-lg">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-300">
                    {t.language === 'pt' ? 'Acesso ao Gerenciador Ativo' : t.language === 'en' ? 'Active Manager Access' : 'Acceso al Gestor Activo'}
                  </h3>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                    {t.language === 'pt' ? 'Expira em' : t.language === 'en' ? 'Expires on' : 'Expira el'} {accessInfo.expires_at ? new Date(accessInfo.expires_at).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES') : 'N/A'} {accessInfo.expires_at && t.language === 'pt' ? 'às' : t.language === 'en' ? 'at' : 'a las'} {accessInfo.expires_at ? new Date(accessInfo.expires_at).toLocaleTimeString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES') : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-600 dark:text-green-400">
                  {(() => {
                    if (!accessInfo.expires_at) {
                      return t.accessExpired || 'Access expired';
                    }
                    
                    const now = new Date();
                    const expires = new Date(accessInfo.expires_at);
                    const diffTime = expires.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays <= 0) {
                      return t.accessExpired;
                    } else if (diffDays === 1) {
                      return `1 ${t.dayRemaining}`;
                    } else {
                      return `${diffDays} ${t.daysRemaining}`;
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
        {children}
      </div>
    );
  }

  // Access denied - show purchase option
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-8 text-white text-center">
          <div className="bg-white bg-opacity-20 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t.premiumAccessRequired}</h2>
          <p className="text-blue-100">
            {t.language === 'pt' ? 'Desbloqueie o Gerenciador de Streaming' : t.language === 'en' ? 'Unlock the Streaming Manager' : 'Desbloquea el Gestor de Streaming'}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Features */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t.language === 'pt' ? 'O que você terá acesso:' : t.language === 'en' ? 'What you get access to:' : 'A qué tendrás acceso:'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                t.language === 'pt' ? 'Gerenciar contas de streaming' : t.language === 'en' ? 'Manage streaming accounts' : 'Gestionar cuentas de streaming',
                t.language === 'pt' ? 'Criar e editar perfis' : t.language === 'en' ? 'Create and edit profiles' : 'Crear y editar perfiles',
                t.language === 'pt' ? 'Acompanhar status das contas' : t.language === 'en' ? 'Track account status' : 'Seguir estado de cuentas',
                t.language === 'pt' ? 'Controlar datas de expiração' : t.language === 'en' ? 'Control expiry dates' : 'Controlar fechas de expiración',
                t.language === 'pt' ? 'Organizar por serviços' : t.language === 'en' ? 'Organize by services' : 'Organizar por servicios',
                t.language === 'pt' ? 'Histórico completo' : t.language === 'en' ? 'Complete history' : 'Historial completo'
              ].map((feature, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="bg-green-100 dark:bg-green-900/20 p-1 rounded-full">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">$5.00</span>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div>{t.language === 'pt' ? 'por 30 dias' : t.language === 'en' ? 'for 30 days' : 'por 30 días'}</div>
                </div>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="h-4 w-4" />
                <span>{t.validFor30Days}</span>
              </div>
            </div>
          </div>

          {/* Current balance */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {t.language === 'pt' ? 'Saldo Atual' : t.language === 'en' ? 'Current Balance' : 'Saldo Actual'}
                </span>
              </div>
              <span className="text-lg font-bold text-blue-900 dark:text-blue-200">
                {formatPrice(userCredit?.balance || 0)}
              </span>
            </div>
          </div>

          {/* Purchase button or insufficient balance warning */}
          {(userCredit?.balance || 0) >= 5.00 ? (
            <button
              onClick={handlePurchaseAccess}
              disabled={purchasing}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {purchasing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" />
                  <span>{t.language === 'pt' ? 'Comprar Acesso por' : t.language === 'en' ? 'Buy Access for' : 'Comprar Acceso por'} $5.00</span>
                </>
              )}
             </button>
          ) : (
            <>
              <button
                disabled
                className="w-full bg-gray-400 text-white font-medium py-3 px-6 rounded-lg cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Lock className="h-4 w-4" />
                <span>{t.language === 'pt' ? 'Saldo Insuficiente' : t.language === 'en' ? 'Insufficient Balance' : 'Saldo Insuficiente'}</span>
              </button>
              
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                {t.language === 'pt' ? 'Recarregue créditos na seção "Meus Créditos"' : t.language === 'en' ? 'Recharge credits in the "My Credits" section' : 'Recarga créditos en la sección "Mis Créditos"'}
              </p>
            </>
          )}

          {/* Additional info */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>✓ {t.language === 'pt' ? 'Ativação instantânea' : t.language === 'en' ? 'Instant activation' : 'Activación instantánea'}</p>
            <p>✓ {t.language === 'pt' ? 'Válido por 30 dias exatos' : t.language === 'en' ? 'Valid for exactly 30 days' : 'Válido por exactamente 30 días'}</p>
            <p>✓ {t.language === 'pt' ? 'Renovação disponível' : t.language === 'en' ? 'Renewal available' : 'Renovación disponible'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}