import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ChevronDown, ChevronUp, Package, Users, ShoppingBag, RefreshCw, Calendar, DollarSign, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface ExpiringItem {
  id: string;
  type: 'account' | 'profile' | 'purchase';
  name: string;
  expiresAt: string;
  daysUntilExpiry: number;
  productId?: string;
  clientName?: string;
  price?: number;
  currency?: string;
  accountId?: string;
  serviceName?: string;
}

export function ExpiringItemsChat() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ExpiringItem | null>(null);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [hideBalloon, setHideBalloon] = useState(false);

  useEffect(() => {
    if (user) {
      loadExpiringItems();
      checkHidePreference();

      const interval = setInterval(loadExpiringItems, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [user]);

  async function checkHidePreference() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('hide_expiring_balloon')
        .eq('id', user.id)
        .maybeSingle();
      setHideBalloon(data?.hide_expiring_balloon || false);
    } catch {
      setHideBalloon(false);
    }
  }

  async function loadExpiringItems() {
    if (!user) return;

    try {
      setLoading(true);
      const items: ExpiringItem[] = [];
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { data: accounts } = await supabase
        .from('streaming_accounts')
        .select('id, service_id, expiry_date, monthly_price, currency, streaming_services(name)')
        .eq('user_id', user.id)
        .not('expiry_date', 'is', null)
        .gte('expiry_date', now.toISOString())
        .lte('expiry_date', sevenDaysFromNow.toISOString());

      if (accounts) {
        accounts.forEach(account => {
          if (account.expiry_date) {
            const expiryDate = new Date(account.expiry_date);
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            items.push({
              id: account.id,
              type: 'account',
              name: (account.streaming_services as any)?.name || 'Conta',
              expiresAt: account.expiry_date,
              daysUntilExpiry,
              price: account.monthly_price,
              currency: account.currency || 'USD',
              serviceName: (account.streaming_services as any)?.name
            });
          }
        });
      }

      const { data: profiles } = await supabase
        .from('account_profiles')
        .select(`
          id,
          profile_name,
          expiry_date,
          price_paid,
          currency,
          account_id,
          clients(name),
          streaming_accounts!inner(user_id, streaming_services(name))
        `)
        .eq('streaming_accounts.user_id', user.id)
        .not('expiry_date', 'is', null)
        .gte('expiry_date', now.toISOString())
        .lte('expiry_date', sevenDaysFromNow.toISOString());

      if (profiles) {
        profiles.forEach(profile => {
          if (profile.expiry_date) {
            const expiryDate = new Date(profile.expiry_date);
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const serviceName = (profile.streaming_accounts as any)?.streaming_services?.name;
            items.push({
              id: profile.id,
              type: 'profile',
              name: profile.profile_name || 'Perfil',
              expiresAt: profile.expiry_date,
              daysUntilExpiry,
              price: profile.price_paid,
              currency: profile.currency || 'USD',
              clientName: (profile.clients as any)?.name,
              accountId: profile.account_id,
              serviceName
            });
          }
        });
      }

      const { data: purchases } = await supabase
        .from('user_purchases')
        .select('id, product_id, expires_at, purchase_price, products(name, price_usdt)')
        .eq('user_id', user.id)
        .eq('expired', false)
        .not('expires_at', 'is', null)
        .gte('expires_at', now.toISOString())
        .lte('expires_at', sevenDaysFromNow.toISOString());

      if (purchases) {
        purchases.forEach(purchase => {
          if (purchase.expires_at) {
            const expiryDate = new Date(purchase.expires_at);
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const productPrice = purchase.purchase_price || (purchase.products as any)?.price_usdt || 0;
            items.push({
              id: purchase.id,
              type: 'purchase',
              name: (purchase.products as any)?.name || 'Compra',
              expiresAt: purchase.expires_at,
              daysUntilExpiry,
              productId: purchase.product_id,
              price: productPrice,
              currency: 'USDT'
            });
          }
        });
      }

      items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

      setExpiringItems(items);

      if (items.length > 0 && !isOpen) {
        setIsOpen(true);
        setIsMinimized(false);
      }
    } catch (error) {
      console.error('Error loading expiring items:', error);
    } finally {
      setLoading(false);
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case 'account':
        return <Users className="h-4 w-4" />;
      case 'profile':
        return <Package className="h-4 w-4" />;
      case 'purchase':
        return <ShoppingBag className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'account':
        return t.language === 'pt' ? 'Conta' : t.language === 'en' ? 'Account' : 'Cuenta';
      case 'profile':
        return t.language === 'pt' ? 'Perfil' : t.language === 'en' ? 'Profile' : 'Perfil';
      case 'purchase':
        return t.language === 'pt' ? 'Compra' : t.language === 'en' ? 'Purchase' : 'Compra';
      default:
        return type;
    }
  }

  function getDaysLabel(days: number) {
    if (days === 0) {
      return t.language === 'pt' ? 'Hoje' : t.language === 'en' ? 'Today' : 'Hoy';
    }
    if (days === 1) {
      return t.language === 'pt' ? 'Amanhã' : t.language === 'en' ? 'Tomorrow' : 'Mañana';
    }
    return t.language === 'pt'
      ? `em ${days} dias`
      : t.language === 'en'
      ? `in ${days} days`
      : `en ${days} días`;
  }

  function getUrgencyColor(days: number) {
    if (days <= 1) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
    if (days <= 3) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700';
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
  }

  async function handleRenewal(item: ExpiringItem) {
    if (!user) return;

    setRenewalLoading(true);
    try {
      if (item.type === 'profile' && item.accountId) {
        const newExpiryDate = new Date(item.expiresAt);
        newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

        const { error } = await supabase
          .from('account_profiles')
          .update({
            expiry_date: newExpiryDate.toISOString().split('T')[0],
            renewal_count: (await supabase.from('account_profiles').select('renewal_count').eq('id', item.id).single()).data?.renewal_count || 0 + 1,
            last_renewal_date: new Date().toISOString().split('T')[0]
          })
          .eq('id', item.id);

        if (error) throw error;
      } else if (item.type === 'account') {
        const newExpiryDate = new Date(item.expiresAt);
        newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

        const { error } = await supabase
          .from('streaming_accounts')
          .update({
            expiry_date: newExpiryDate.toISOString().split('T')[0],
            renewal_count: (await supabase.from('streaming_accounts').select('renewal_count').eq('id', item.id).single()).data?.renewal_count || 0 + 1,
            last_renewal_date: new Date().toISOString().split('T')[0]
          })
          .eq('id', item.id);

        if (error) throw error;
      } else if (item.type === 'purchase' && item.productId) {
        const newExpiryDate = new Date(item.expiresAt);
        newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);

        const { error } = await supabase
          .from('user_purchases')
          .update({
            expires_at: newExpiryDate.toISOString(),
            expired: false
          })
          .eq('id', item.id);

        if (error) throw error;
      }

      setSelectedItem(null);
      await loadExpiringItems();
    } catch (error) {
      console.error('Error renewing item:', error);
      alert(t.language === 'pt' ? 'Erro ao renovar. Tente novamente.' : t.language === 'en' ? 'Error renewing. Try again.' : 'Error al renovar. Intente de nuevo.');
    } finally {
      setRenewalLoading(false);
    }
  }

  if (!user || expiringItems.length === 0 || hideBalloon) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 animate-pulse"
        aria-label="Ver itens expirando"
      >
        <AlertCircle className="h-6 w-6" />
        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
          {expiringItems.length}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-semibold">
              {t.language === 'pt'
                ? 'Itens Expirando'
                : t.language === 'en'
                ? 'Expiring Items'
                : 'Items Expirando'}
            </h3>
            <span className="bg-white bg-opacity-30 px-2 py-0.5 rounded-full text-sm font-bold">
              {expiringItems.length}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="hover:bg-white hover:bg-opacity-20 rounded p-1 transition-colors"
              aria-label={isMinimized ? 'Expandir' : 'Minimizar'}
            >
              {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white hover:bg-opacity-20 rounded p-1 transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              </div>
            ) : selectedItem ? (
              <div className="p-4">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4 flex items-center gap-1"
                >
                  ← {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
                </button>

                <div className={`${getUrgencyColor(selectedItem.daysUntilExpiry)} rounded-lg p-4 border mb-4`}>
                  <div className="flex items-center gap-3 mb-4">
                    {getIcon(selectedItem.type)}
                    <div>
                      <h4 className="font-semibold text-lg">{selectedItem.name}</h4>
                      <p className="text-sm opacity-75">{getTypeLabel(selectedItem.type)}</p>
                    </div>
                  </div>

                  <div className="space-y-3 bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                    {selectedItem.type === 'profile' && selectedItem.clientName && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <User className="h-4 w-4" />
                          <span>{t.language === 'pt' ? 'Cliente' : t.language === 'en' ? 'Client' : 'Cliente'}:</span>
                        </div>
                        <span className="font-medium">{selectedItem.clientName}</span>
                      </div>
                    )}

                    {selectedItem.type === 'profile' && selectedItem.serviceName && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Package className="h-4 w-4" />
                          <span>{t.language === 'pt' ? 'Serviço' : t.language === 'en' ? 'Service' : 'Servicio'}:</span>
                        </div>
                        <span className="font-medium">{selectedItem.serviceName}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Calendar className="h-4 w-4" />
                        <span>{t.language === 'pt' ? 'Vencimento' : t.language === 'en' ? 'Expiration' : 'Vencimiento'}:</span>
                      </div>
                      <span className="font-medium">
                        {new Date(selectedItem.expiresAt).toLocaleDateString(
                          t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
                          { day: '2-digit', month: '2-digit', year: 'numeric' }
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <AlertCircle className="h-4 w-4" />
                        <span>{t.language === 'pt' ? 'Faltam' : t.language === 'en' ? 'Remaining' : 'Faltan'}:</span>
                      </div>
                      <span className="font-bold">{getDaysLabel(selectedItem.daysUntilExpiry)}</span>
                    </div>

                    {selectedItem.price !== undefined && (
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-300 dark:border-gray-600">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <DollarSign className="h-4 w-4" />
                          <span>{t.language === 'pt' ? 'Valor' : t.language === 'en' ? 'Price' : 'Valor'}:</span>
                        </div>
                        <span className="font-semibold text-lg">
                          ${selectedItem.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRenewal(selectedItem)}
                  disabled={renewalLoading}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {renewalLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>{t.language === 'pt' ? 'Processando...' : t.language === 'en' ? 'Processing...' : 'Procesando...'}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5" />
                      <span>{t.language === 'pt' ? 'Renovar Agora' : t.language === 'en' ? 'Renew Now' : 'Renovar Ahora'}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {expiringItems.map(item => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => setSelectedItem(item)}
                    className={`w-full ${getUrgencyColor(item.daysUntilExpiry)} rounded-lg p-3 border transition-all hover:shadow-md cursor-pointer`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="mt-0.5">
                          {getIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs opacity-75 mt-0.5">
                            {getTypeLabel(item.type)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-xs font-bold whitespace-nowrap">
                          {getDaysLabel(item.daysUntilExpiry)}
                        </p>
                        <p className="text-xs opacity-75 mt-0.5">
                          {new Date(item.expiresAt).toLocaleDateString(
                            t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
                            { day: '2-digit', month: '2-digit' }
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!selectedItem && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900">
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                  {t.language === 'pt'
                    ? 'Clique em um item para ver detalhes e renovar'
                    : t.language === 'en'
                    ? 'Click an item to view details and renew'
                    : 'Haga clic en un elemento para ver detalles y renovar'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
