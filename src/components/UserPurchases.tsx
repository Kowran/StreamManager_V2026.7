import React, { useState, useEffect } from 'react';
import { Package, Eye, Calendar, CreditCard, X, Copy, Check, Clock, AlertTriangle, ChevronLeft, ChevronRight, Star, RefreshCw, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { ProductRatingModal } from './ProductRatingModal';
import RenewalPromptModal from './RenewalPromptModal';
import { PurchaseHelpModal } from './PurchaseHelpModal';

interface UserPurchase {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  purchase_price: number;
  credentials: any;
  purchase_date: string;
  expires_at?: string;
  expired?: boolean;
  created_at: string;
  read_accounts?: number[];
  store_products?: {
    image_url?: string;
    category: string;
  };
  store_orders?: {
    status: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    discount_amount?: number;
    cashback_used?: number;
    coupon_id?: string | null;
  };
}

  function calculateExpiryDate(purchaseDate: string): Date {
    const purchase = new Date(purchaseDate);
    return new Date(purchase.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias
  }

  function isExpired(purchaseDate: string): boolean {
    const expiryDate = calculateExpiryDate(purchaseDate);
    return new Date() > expiryDate;
  }

  function isCancelled(purchase: UserPurchase): boolean {
    return purchase.store_orders?.status === 'cancelled';
  }

  function getDaysRemaining(purchaseDate: string): number {
    const expiryDate = calculateExpiryDate(purchaseDate);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getExpiryStatus(purchaseDate: string) {
    const daysRemaining = getDaysRemaining(purchaseDate);
    
    if (daysRemaining <= 0) {
      return {
        status: 'expired',
        label: 'Expirado',
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: AlertTriangle,
        iconColor: 'text-red-500'
      };
    } else if (daysRemaining <= 3) {
      return {
        status: 'expiring',
        label: `Expira em ${daysRemaining}d`,
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
        icon: Clock,
        iconColor: 'text-yellow-500'
      };
    } else if (daysRemaining <= 7) {
      return {
        status: 'warning',
        label: `${daysRemaining} dias restantes`,
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
        icon: Clock,
        iconColor: 'text-orange-500'
      };
    } else {
      return {
        status: 'active',
        label: `${daysRemaining} dias restantes`,
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        icon: Clock,
        iconColor: 'text-green-500'
      };
    }
  }

  function getCancelledStatus() {
    return {
      status: 'cancelled',
      label: 'Cancelado',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      icon: X,
      iconColor: 'text-red-500'
    };
  }

export function UserPurchases() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState<UserPurchase | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, number[]>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const purchasesPerPage = 5;
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedPurchaseForRating, setSelectedPurchaseForRating] = useState<UserPurchase | null>(null);
  const [userRatings, setUserRatings] = useState<Record<string, boolean>>({});
  const [renewalLoading, setRenewalLoading] = useState<string | null>(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedPurchaseForRenewal, setSelectedPurchaseForRenewal] = useState<UserPurchase | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedPurchaseForHelp, setSelectedPurchaseForHelp] = useState<{ id: string; product_id: string; order_id: string; product_name: string; purchase_price: number } | null>(null);
  const [sellerIdForHelp, setSellerIdForHelp] = useState<string | null>(null);
  const [helpTicketStatuses, setHelpTicketStatuses] = useState<Record<string, { status: string; escalated: boolean }>>({});

  useEffect(() => {
    if (user) {
      loadUserPurchases();
      loadUserRatings();
    }
  }, [user]);

  async function loadHelpTicketStatuses(purchasesData: any[]) {
    if (!user || purchasesData.length === 0) return;
    try {
      const orderIds = purchasesData.map(p => p.order_id).filter(Boolean);
      if (orderIds.length === 0) return;
      const { data } = await supabase
        .from('seller_support_tickets')
        .select('order_id, status, escalated')
        .eq('customer_id', user.id)
        .in('order_id', orderIds);
      if (data) {
        const map: Record<string, { status: string; escalated: boolean }> = {};
        for (const t of data) {
          if (t.order_id) map[t.order_id] = { status: t.status, escalated: t.escalated };
        }
        setHelpTicketStatuses(map);
      }
    } catch { /* ignore */ }
  }

  async function loadUserPurchases() {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_purchases')
        .select(`
          *,
          store_products!user_purchases_product_id_fkey (
            image_url,
            category
          ),
          store_orders!user_purchases_order_id_fkey (
            status,
            cancelled_at,
            cancellation_reason,
            discount_amount,
            cashback_used,
            coupon_id,
            seller_id
          )
        `)
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
      loadHelpTicketStatuses(data || []);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserRatings() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('product_ratings')
        .select('product_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const ratingsMap: Record<string, boolean> = {};
      data?.forEach(rating => {
        ratingsMap[rating.product_id] = true;
      });
      setUserRatings(ratingsMap);
    } catch (error) {
      console.error('Error loading user ratings:', error);
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

  async function markAccountAsRead(purchaseId: string, accountIndex: number) {
    setExpandedAccounts(prev => ({
      ...prev,
      [purchaseId]: [...new Set([...(prev[purchaseId] || []), accountIndex])]
    }));

    try {
      const currentRead = selectedPurchase?.read_accounts || [];
      if (currentRead.includes(accountIndex)) return;

      const newReadAccounts = [...currentRead, accountIndex];
      const { error } = await supabase
        .from('user_purchases')
        .update({ read_accounts: newReadAccounts })
        .eq('id', purchaseId);

      if (error) {
        console.error('Error marking account as read:', error);
      } else {
        setSelectedPurchase(prev => prev ? { ...prev, read_accounts: newReadAccounts } : prev);
      }
    } catch (err) {
      console.error('Error in markAccountAsRead:', err);
    }
  }

  function toggleAccount(purchaseId: string, accountIndex: number) {
    setExpandedAccounts(prev => {
      const current = prev[purchaseId] || [];
      if (current.includes(accountIndex)) {
        return { ...prev, [purchaseId]: current.filter(i => i !== accountIndex) };
      } else {
        markAccountAsRead(purchaseId, accountIndex);
        return { ...prev, [purchaseId]: [...current, accountIndex] };
      }
    });
  }

  function isAccountRead(purchaseId: string, accountIndex: number): boolean {
    const readFromDb = selectedPurchase?.read_accounts || [];
    const readFromState = expandedAccounts[purchaseId] || [];
    return readFromDb.includes(accountIndex) || readFromState.includes(accountIndex);
  }

  // Pagination logic
  const totalPages = Math.ceil(purchases.length / purchasesPerPage);
  const startIndex = (currentPage - 1) * purchasesPerPage;
  const endIndex = startIndex + purchasesPerPage;
  const currentPurchases = purchases.slice(startIndex, endIndex);

  // Reset to first page when purchases change
  useEffect(() => {
    setCurrentPage(1);
  }, [purchases.length]);

  function handleRateProduct(purchase: UserPurchase) {
    setSelectedPurchaseForRating(purchase);
    setShowRatingModal(true);
  }

  function handleRatingSubmitted() {
    loadUserRatings();
    setShowRatingModal(false);
    setSelectedPurchaseForRating(null);
  }

  function handleRenewPurchase(purchase: UserPurchase) {
    if (!user) return;

    setSelectedPurchaseForRenewal(purchase);
    setShowRenewalModal(true);
  }

  async function processRenewal(purchase: UserPurchase) {
    setRenewalLoading(purchase.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-purchase-renewal`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            purchase_id: purchase.id,
            product_id: purchase.product_id,
            product_name: purchase.product_name,
            product_price: purchase.purchase_price
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to renew purchase');
      }

      await loadUserPurchases();
      setShowRenewalModal(false);
      setSelectedPurchaseForRenewal(null);

      const successMessage = t.language === 'pt'
        ? 'Compra renovada com sucesso por mais 30 dias!'
        : t.language === 'en'
        ? 'Purchase renewed successfully for 30 more days!'
        : '¡Compra renovada exitosamente por 30 días más!';

      alert(successMessage);
    } catch (error: any) {
      console.error('Error renewing purchase:', error);
      const errorMessage = t.language === 'pt'
        ? error.message || 'Erro ao renovar compra. Tente novamente.'
        : t.language === 'en'
        ? error.message || 'Error renewing purchase. Try again.'
        : error.message || 'Error al renovar la compra. Intente de nuevo.';
      alert(errorMessage);
    } finally {
      setRenewalLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.myPurchases}</h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t.language === 'pt' ? 'Visualize seus produtos comprados e credenciais' :
           t.language === 'en' ? 'View your purchased products and credentials' :
           'Ve tus productos comprados y credenciales'}
        </p>
      </div>

      {purchases.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {t.noPurchasesFound}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t.noStoreOrders}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {currentPurchases.map((purchase) => (
            <div key={purchase.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border transition-colors p-3 sm:p-4 ${
              isCancelled(purchase)
                ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 opacity-75'
                : isExpired(purchase.purchase_date)
                ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                : 'border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                      {purchase.store_products?.image_url ? (
                        <img
                          src={purchase.store_products.image_url}
                          alt={purchase.product_name}
                          className={`w-full h-full object-cover transition-all ${
                            isCancelled(purchase) || isExpired(purchase.purchase_date) ? 'grayscale opacity-60' : ''
                          }`}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ${
                        purchase.store_products?.image_url ? 'hidden' : ''
                      } ${isCancelled(purchase) || isExpired(purchase.purchase_date) ? 'grayscale opacity-60' : ''}`}>
                        <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className={`text-base sm:text-lg font-semibold ${
                      isCancelled(purchase) || isExpired(purchase.purchase_date)
                        ? 'text-gray-500 dark:text-gray-400 line-through'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {purchase.product_name}
                    </h3>

                    {/* Purchase Info */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1.5 sm:mt-2">
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                        {new Date(purchase.purchase_date).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">
                        {formatPrice(purchase.purchase_price)}
                      </span>
                    </div>

                    {/* Expiry Info */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                      {(() => {
                        if (isCancelled(purchase)) {
                          const cancelledStatus = getCancelledStatus();
                          const IconComponent = cancelledStatus.icon;
                          
                          return (
                            <>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cancelledStatus.color}`}>
                                <IconComponent className={`h-3 w-3 mr-1 ${cancelledStatus.iconColor}`} />
                                {cancelledStatus.label}
                              </span>
                              {purchase.store_orders?.cancelled_at && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Cancelado em: {new Date(purchase.store_orders.cancelled_at).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')}
                                </span>
                              )}
                            </>
                          );
                        }
                        
                        const expiryStatus = getExpiryStatus(purchase.purchase_date);
                        const IconComponent = expiryStatus.icon;
                        const expiryDate = calculateExpiryDate(purchase.purchase_date);
                        
                        return (
                          <>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expiryStatus.color}`}>
                              <IconComponent className={`h-3 w-3 mr-1 ${expiryStatus.iconColor}`} />
                              {expiryStatus.label}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {t.language === 'pt' ? 'Expira em:' : t.language === 'en' ? 'Expires on:' : 'Expira el:'} {expiryDate.toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  {!isCancelled(purchase) && (() => {
                    const daysRemaining = getDaysRemaining(purchase.purchase_date);
                    const canRenew = daysRemaining <= 7;
                    return canRenew;
                  })() && (
                    <button
                      onClick={() => handleRenewPurchase(purchase)}
                      disabled={renewalLoading === purchase.id}
                      className="inline-flex items-center px-3 py-1.5 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all touch-manipulation w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {renewalLoading === purchase.id ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1"></div>
                          {t.language === 'pt' ? 'Renovando...' : t.language === 'en' ? 'Renewing...' : 'Renovando...'}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          {t.language === 'pt' ? 'Renovar' : t.language === 'en' ? 'Renew' : 'Renovar'}
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedPurchase(purchase);
                      setShowDetails(true);
                    }}
                    className={`inline-flex items-center px-3 py-1.5 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation w-full sm:w-auto justify-center ${
                      isCancelled(purchase)
                        ? 'text-red-600 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'
                        : isExpired(purchase.purchase_date)
                        ? 'text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                        : 'text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40'
                    }`}
                  >
                    <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    {isCancelled(purchase) ?
                      (t.language === 'pt' ? 'Ver Detalhes' : t.language === 'en' ? 'View Details' : 'Ver Detalles') :
                      t.viewCredentials
                    }
                  </button>
                </div>
              </div>
              
              {/* Rating Section - Separate row for mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="flex items-center space-x-2 flex-wrap">
                  {/* Rating Button */}
                  {!isCancelled(purchase) && !userRatings[purchase.product_id] && (
                    <button
                      onClick={() => handleRateProduct(purchase)}
                      className="inline-flex items-center px-3 py-1.5 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors touch-manipulation"
                    >
                      <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      {t.language === 'pt' ? 'Avaliar' : t.language === 'en' ? 'Rate' : 'Calificar'}
                    </button>
                  )}
                  
                  {/* Already Rated Indicator */}
                  {userRatings[purchase.product_id] && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {t.language === 'pt' ? 'Avaliado' : t.language === 'en' ? 'Rated' : 'Calificado'}
                    </span>
                  )}

                  {/* Help Button - Open ticket to seller */}
                  {!isCancelled(purchase) && purchase.order_id && (purchase.store_orders as any)?.seller_id && (
                    <button
                      onClick={() => {
                        const sellerId = (purchase.store_orders as any)?.seller_id;
                        const ticketStatus = helpTicketStatuses[purchase.order_id];
                        setSelectedPurchaseForHelp({
                          id: purchase.id,
                          product_id: purchase.product_id,
                          order_id: purchase.order_id,
                          product_name: purchase.product_name,
                          purchase_price: purchase.purchase_price,
                        });
                        setSellerIdForHelp(sellerId);
                        setShowHelpModal(true);
                      }}
                      className={`inline-flex items-center px-3 py-1.5 sm:py-2 border text-xs sm:text-sm font-medium rounded-md transition-colors touch-manipulation ${
                        helpTicketStatuses[purchase.order_id]
                          ? helpTicketStatuses[purchase.order_id].escalated
                            ? 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                            : helpTicketStatuses[purchase.order_id].status === 'resolved'
                            ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      {helpTicketStatuses[purchase.order_id]
                        ? helpTicketStatuses[purchase.order_id].escalated
                          ? (t.language === 'pt' ? 'Escalado' : t.language === 'en' ? 'Escalated' : 'Escalado')
                          : helpTicketStatuses[purchase.order_id].status === 'resolved'
                          ? (t.language === 'pt' ? 'Resolvido' : t.language === 'en' ? 'Resolved' : 'Resuelto')
                          : (t.language === 'pt' ? 'Em Andamento' : t.language === 'en' ? 'In Progress' : 'En Progreso')
                        : (t.language === 'pt' ? 'Preciso de Ajuda' : t.language === 'en' ? 'I Need Help' : 'Necesito Ayuda')
                      }
                    </button>
                  )}
                </div>
                
                {/* Purchase date for mobile */}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {new Date(purchase.purchase_date).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 sm:mt-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t.language === 'pt' ? 'Página' : t.language === 'en' ? 'Page' : 'Página'} {currentPage} {t.language === 'pt' ? 'de' : t.language === 'en' ? 'of' : 'de'} {totalPages}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              ({startIndex + 1}-{Math.min(endIndex, purchases.length)} {t.language === 'pt' ? 'de' : t.language === 'en' ? 'of' : 'de'} {purchases.length})
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {/* Page numbers */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Purchase Details Modal */}
      {showDetails && selectedPurchase && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-2 sm:top-10 mx-auto p-3 sm:p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {t.purchaseDetails}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Purchase Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-start space-x-4 mb-4">
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    <div className="h-20 w-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                      {selectedPurchase.store_products?.image_url ? (
                        <img
                          src={selectedPurchase.store_products.image_url}
                          alt={selectedPurchase.product_name}
                          className={`w-full h-full object-cover ${
                            isCancelled(selectedPurchase) || isExpired(selectedPurchase.purchase_date) ? 'grayscale opacity-60' : ''
                          }`}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ${
                        selectedPurchase.store_products?.image_url ? 'hidden' : ''
                      } ${isCancelled(selectedPurchase) || isExpired(selectedPurchase.purchase_date) ? 'grayscale opacity-60' : ''}`}>
                        <Package className="h-8 w-8 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t.purchaseInfo}</h4>
                    {selectedPurchase.store_products?.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 mb-2">
                        {selectedPurchase.store_products.category}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t.product}
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedPurchase.product_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t.amountPaid}</label>
                    <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{formatPrice(selectedPurchase.purchase_price)}</p>
                  </div>
                  {selectedPurchase.store_orders?.discount_amount && selectedPurchase.store_orders.discount_amount > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t.language === 'pt' ? 'Desconto (Cupom)' : t.language === 'en' ? 'Discount (Coupon)' : 'Descuento (Cupón)'}
                      </label>
                      <p className="mt-1 text-sm font-semibold text-green-600 dark:text-green-400">
                        -{formatPrice(selectedPurchase.store_orders.discount_amount)}
                      </p>
                    </div>
                  )}
                  {selectedPurchase.store_orders?.cashback_used && selectedPurchase.store_orders.cashback_used > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t.language === 'pt' ? 'Cashback Utilizado' : t.language === 'en' ? 'Cashback Used' : 'Cashback Utilizado'}
                      </label>
                      <p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                        -{formatPrice(selectedPurchase.store_orders.cashback_used)}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t.purchaseDate}</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {new Date(selectedPurchase.purchase_date).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')} {t.language === 'pt' ? 'às' : t.language === 'en' ? 'at' : 'a las'} {new Date(selectedPurchase.purchase_date).toLocaleTimeString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t.language === 'pt' ? 'Data de Expiração' : t.language === 'en' ? 'Expiry Date' : 'Fecha de Expiración'}
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {calculateExpiryDate(selectedPurchase.purchase_date).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')} {t.language === 'pt' ? 'às' : t.language === 'en' ? 'at' : 'a las'} {calculateExpiryDate(selectedPurchase.purchase_date).toLocaleTimeString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t.language === 'pt' ? 'Validade' : t.language === 'en' ? 'Validity' : 'Validez'}
                    </label>
                    <div className="mt-1">
                      {(() => {
                        const expiryStatus = getExpiryStatus(selectedPurchase.purchase_date);
                        const IconComponent = expiryStatus.icon;
                        
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expiryStatus.color}`}>
                            <IconComponent className={`h-3 w-3 mr-1 ${expiryStatus.iconColor}`} />
                            {expiryStatus.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isCancelled(selectedPurchase)
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        : isExpired(selectedPurchase.purchase_date)
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    }`}>
                      {isCancelled(selectedPurchase) 
                        ? (t.language === 'pt' ? 'Cancelado' : t.language === 'en' ? 'Cancelled' : 'Cancelado')
                        : isExpired(selectedPurchase.purchase_date) 
                        ? (t.language === 'pt' ? 'Expirado' : t.language === 'en' ? 'Expired' : 'Expirado')
                        : t.delivered
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Cancellation Notice */}
              {isCancelled(selectedPurchase) && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                    <h4 className="text-lg font-medium text-red-800 dark:text-red-300">
                      {t.language === 'pt' ? 'Compra Cancelada' : t.language === 'en' ? 'Purchase Cancelled' : 'Compra Cancelada'}
                    </h4>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3">
                      <div className="flex items-center">
                        <X className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                        <div>
                          <h5 className="text-sm font-medium text-red-800 dark:text-red-300">
                            {t.language === 'pt' ? 'Compra Cancelada pelo Administrador' : 
                             t.language === 'en' ? 'Purchase Cancelled by Administrator' : 
                             'Compra Cancelada por el Administrador'}
                          </h5>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                            {t.language === 'pt' ? 'Esta compra foi cancelada e você foi reembolsado automaticamente.' :
                             t.language === 'en' ? 'This purchase was cancelled and you were automatically refunded.' :
                             'Esta compra fue cancelada y fuiste reembolsado automáticamente.'}
                          </p>
                          {selectedPurchase.store_orders?.cancellation_reason && (
                            <div className="mt-2 pt-2 border-t border-red-300 dark:border-red-700">
                              <p className="text-xs text-red-700 dark:text-red-400">
                                <strong>{t.language === 'pt' ? 'Motivo:' : t.language === 'en' ? 'Reason:' : 'Motivo:'}</strong> {selectedPurchase.store_orders.cancellation_reason}
                              </p>
                            </div>
                          )}
                          {selectedPurchase.store_orders?.cancelled_at && (
                            <div className="mt-1">
                              <p className="text-xs text-red-700 dark:text-red-400">
                                <strong>{t.language === 'pt' ? 'Cancelado em:' : t.language === 'en' ? 'Cancelled on:' : 'Cancelado el:'}</strong> {new Date(selectedPurchase.store_orders.cancelled_at).toLocaleString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <h5 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                        💰 {t.language === 'pt' ? 'Reembolso Processado' : t.language === 'en' ? 'Refund Processed' : 'Reembolso Procesado'}
                      </h5>
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        {t.language === 'pt' ? `O valor de ${formatPrice(selectedPurchase.purchase_price)} foi automaticamente reembolsado para sua conta. Você pode usar esses créditos para fazer novas compras.` :
                         t.language === 'en' ? `The amount of ${formatPrice(selectedPurchase.purchase_price)} was automatically refunded to your account. You can use these credits to make new purchases.` :
                         `El monto de ${formatPrice(selectedPurchase.purchase_price)} fue automáticamente reembolsado a tu cuenta. Puedes usar estos créditos para hacer nuevas compras.`}
                      </p>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                      <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                        ℹ️ {t.language === 'pt' ? 'Informações Importantes' : t.language === 'en' ? 'Important Information' : 'Información Importante'}
                      </h5>
                      <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
                        <li>• {t.language === 'pt' ? 'As credenciais desta compra não estão mais disponíveis' : t.language === 'en' ? 'The credentials for this purchase are no longer available' : 'Las credenciales de esta compra ya no están disponibles'}</li>
                        <li>• {t.language === 'pt' ? 'Você foi reembolsado automaticamente' : t.language === 'en' ? 'You were automatically refunded' : 'Fuiste reembolsado automáticamente'}</li>
                        <li>• {t.language === 'pt' ? 'Pode fazer uma nova compra na loja' : t.language === 'en' ? 'You can make a new purchase in the store' : 'Puedes hacer una nueva compra en la tienda'}</li>
                        <li>• {t.language === 'pt' ? 'Entre em contato via WhatsApp se tiver dúvidas' : t.language === 'en' ? 'Contact via WhatsApp if you have questions' : 'Contacta vía WhatsApp si tienes dudas'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Credentials - Only show if not cancelled */}
              {!isCancelled(selectedPurchase) && (() => {
                const accounts = selectedPurchase.credentials.accounts;
                const isMulti = Array.isArray(accounts) && accounts.length > 0;
                const expiryWarn = isExpired(selectedPurchase.purchase_date);
                const containerClass = expiryWarn
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
                const iconClass = expiryWarn ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';

                return (
                <div className={`rounded-lg p-4 border ${containerClass}`}>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <CreditCard className={`h-5 w-5 mr-2 ${iconClass}`} />
                    {t.accessCredentials}
                    {isMulti && (
                      <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                        ({accounts.length} {t.language === 'pt' ? 'contas' : t.language === 'en' ? 'accounts' : 'cuentas'})
                      </span>
                    )}
                  </h4>

                  {expiryWarn && (
                    <div className="mb-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3">
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                        <div>
                          <h5 className="text-sm font-medium text-red-800 dark:text-red-300">
                            {t.language === 'pt' ? 'Produto Expirado' : t.language === 'en' ? 'Product Expired' : 'Producto Expirado'}
                          </h5>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                            {t.language === 'pt' ? 'Este produto expirou e as credenciais podem n\u00e3o funcionar mais. Entre em contato com o suporte se precisar de ajuda.' :
                             t.language === 'en' ? 'This product has expired and the credentials may no longer work. Contact support if you need help.' :
                             'Este producto ha expirado y las credenciales pueden no funcionar m\u00e1s. Contacta soporte si necesitas ayuda.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isMulti ? (
                    <div className="space-y-2">
                      {accounts.map((acct: any, idx: number) => {
                        const expanded = (expandedAccounts[selectedPurchase.id] || []).includes(idx) || (selectedPurchase.read_accounts || []).includes(idx);
                        const wasRead = isAccountRead(selectedPurchase.id, idx);
                        return (
                          <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                            <button
                              onClick={() => toggleAccount(selectedPurchase.id, idx)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t.language === 'pt' ? 'Conta' : t.language === 'en' ? 'Account' : 'Cuenta'} #{idx + 1}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {!wasRead ? (
                                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                                    <Eye className="h-3 w-3" />
                                    {t.language === 'pt' ? 'Nova' : t.language === 'en' ? 'New' : 'Nueva'}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                                    <Check className="h-3 w-3" />
                                    {t.language === 'pt' ? 'Lida' : t.language === 'en' ? 'Read' : 'Le\u00eddo'}
                                  </span>
                                )}
                              </div>
                            </button>
                            {expanded && (
                              <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.email}:</label>
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-sm text-gray-900 dark:text-white">{acct.email}</span>
                                      <button onClick={() => copyToClipboard(acct.email)} className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title={t.copyEmail}>
                                        {copiedText === acct.email ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.password}:</label>
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-sm text-gray-900 dark:text-white">{acct.password}</span>
                                      <button onClick={() => copyToClipboard(acct.password)} className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title={t.copyPassword}>
                                        {copiedText === acct.password ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                {acct.instructions && (
                                  <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.instructions}:</label>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{acct.instructions}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-md p-4 border">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.email}:</label>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm text-gray-900 dark:text-white">{selectedPurchase.credentials.email}</span>
                            <button onClick={() => copyToClipboard(selectedPurchase.credentials.email)} className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title={t.copyEmail}>
                              {copiedText === selectedPurchase.credentials.email ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.password}:</label>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm text-gray-900 dark:text-white">{selectedPurchase.credentials.password}</span>
                            <button onClick={() => copyToClipboard(selectedPurchase.credentials.password)} className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title={t.copyPassword}>
                              {copiedText === selectedPurchase.credentials.password ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      {selectedPurchase.credentials.instructions && (
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.instructions}:</label>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{selectedPurchase.credentials.instructions}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })()}

                            {/* Support Info - Updated for cancelled purchases */}
              <div className={`rounded-lg p-4 border ${
                isCancelled(selectedPurchase)
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : isExpired(selectedPurchase.purchase_date)
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}>
                <h4 className={`text-sm font-medium mb-2 ${
                  isCancelled(selectedPurchase)
                    ? 'text-blue-800 dark:text-blue-300'
                    : isExpired(selectedPurchase.purchase_date)
                    ? 'text-yellow-800 dark:text-yellow-300'
                    : 'text-blue-800 dark:text-blue-300'
                }`}>
                  ℹ️ {t.importantInfo}
                </h4>
                <ul className={`text-xs space-y-1 ${
                  isCancelled(selectedPurchase)
                    ? 'text-blue-700 dark:text-blue-400'
                    : isExpired(selectedPurchase.purchase_date)
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : 'text-blue-700 dark:text-blue-400'
                }`}>
                  {isCancelled(selectedPurchase) ? (
                    <>
                      <li>• {t.language === 'pt' ? 'Esta compra foi cancelada pelo administrador' : t.language === 'en' ? 'This purchase was cancelled by the administrator' : 'Esta compra fue cancelada por el administrador'}</li>
                      <li>• {t.language === 'pt' ? 'Você foi reembolsado automaticamente' : t.language === 'en' ? 'You were automatically refunded' : 'Fuiste reembolsado automáticamente'}</li>
                      <li>• {t.language === 'pt' ? 'As credenciais não estão mais disponíveis' : t.language === 'en' ? 'Credentials are no longer available' : 'Las credenciales ya no están disponibles'}</li>
                      <li>• {t.language === 'pt' ? 'Você pode fazer uma nova compra na loja' : t.language === 'en' ? 'You can make a new purchase in the store' : 'Puedes hacer una nueva compra en la tienda'}</li>
                      <li>• {t.language === 'pt' ? 'Entre em contato via WhatsApp se tiver dúvidas' : t.language === 'en' ? 'Contact via WhatsApp if you have questions' : 'Contacta vía WhatsApp si tienes dudas'}</li>
                    </>
                  ) : isExpired(selectedPurchase.purchase_date) ? (
                    <>
                      <li>• {t.language === 'pt' ? 'Este produto expirou após 30 dias da compra' : t.language === 'en' ? 'This product expired after 30 days from purchase' : 'Este producto expiró después de 30 días de la compra'}</li>
                      <li>• {t.language === 'pt' ? 'As credenciais podem não funcionar mais' : t.language === 'en' ? 'Credentials may no longer work' : 'Las credenciales pueden no funcionar más'}</li>
                      <li>• {t.language === 'pt' ? 'Entre em contato via WhatsApp para renovação' : t.language === 'en' ? 'Contact via WhatsApp for renewal' : 'Contacta vía WhatsApp para renovación'}</li>
                      <li>• {t.language === 'pt' ? 'Compre um novo produto na loja se necessário' : t.language === 'en' ? 'Buy a new product in the store if needed' : 'Compra un nuevo producto en la tienda si es necesario'}</li>
                    </>
                  ) : (
                    <>
                      <li>• {t.keepCredentialsSafe}</li>
                      <li>• {t.dontShareCredentials}</li>
                      <li>• {t.contactWhatsApp}</li>
                      <li>• {t.language === 'pt' ? `Válido até ${calculateExpiryDate(selectedPurchase.purchase_date).toLocaleDateString('pt-BR')}` : 
                             t.language === 'en' ? `Valid until ${calculateExpiryDate(selectedPurchase.purchase_date).toLocaleDateString('en-US')}` :
                             `Válido hasta ${calculateExpiryDate(selectedPurchase.purchase_date).toLocaleDateString('es-ES')}`}</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Legacy credentials section - remove this */}
              {false && (
                <div className={`rounded-lg p-4 border ${
                  isExpired(selectedPurchase.purchase_date)
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <CreditCard className={`h-5 w-5 mr-2 ${
                      isExpired(selectedPurchase.purchase_date)
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`} />
                    {t.accessCredentials}
                  </h4>
                  
                  {/* Expiry Warning */}
                  {isExpired(selectedPurchase.purchase_date) && (
                    <div className="mb-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                      <div>
                        <h5 className="text-sm font-medium text-red-800 dark:text-red-300">
                          {t.language === 'pt' ? 'Produto Expirado' : t.language === 'en' ? 'Product Expired' : 'Producto Expirado'}
                        </h5>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                          {t.language === 'pt' ? 'Este produto expirou e as credenciais podem não funcionar mais. Entre em contato com o suporte se precisar de ajuda.' :
                           t.language === 'en' ? 'This product has expired and the credentials may no longer work. Contact support if you need help.' :
                           'Este producto ha expirado y las credenciales pueden no funcionar más. Contacta soporte si necesitas ayuda.'}
                        </p>
                      </div>
                    </div>
                    </div>
                  )}
                  
                  <div className="bg-white dark:bg-gray-800 rounded-md p-4 border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {t.email}:
                        </label>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm text-gray-900 dark:text-white">
                            {selectedPurchase.credentials.email}
                          </span>
                          <button
                            onClick={() => copyToClipboard(selectedPurchase.credentials.email)}
                            className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            title={t.copyEmail}
                          >
                            {copiedText === selectedPurchase.credentials.email ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {t.password}:
                        </label>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm text-gray-900 dark:text-white">
                            {selectedPurchase.credentials.password}
                          </span>
                          <button
                            onClick={() => copyToClipboard(selectedPurchase.credentials.password)}
                            className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            title={t.copyPassword}
                          >
                            {copiedText === selectedPurchase.credentials.password ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {selectedPurchase.credentials.instructions && (
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {t.instructions}:
                        </label>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {selectedPurchase.credentials.instructions}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div>
                {!isCancelled(selectedPurchase) && (() => {
                  const daysRemaining = getDaysRemaining(selectedPurchase.purchase_date);
                  const canRenew = daysRemaining <= 7;
                  return canRenew;
                })() && (
                  <button
                    onClick={() => handleRenewPurchase(selectedPurchase)}
                    disabled={renewalLoading === selectedPurchase.id}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {renewalLoading === selectedPurchase.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t.language === 'pt' ? 'Renovando...' : t.language === 'en' ? 'Renewing...' : 'Renovando...'}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t.language === 'pt' ? 'Renovar por 30 dias' : t.language === 'en' ? 'Renew for 30 days' : 'Renovar por 30 días'}
                      </>
                    )}
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Rating Modal */}
      {showRatingModal && selectedPurchaseForRating && (
        <ProductRatingModal
          isOpen={showRatingModal}
          onClose={() => {
            setShowRatingModal(false);
            setSelectedPurchaseForRating(null);
          }}
          productId={selectedPurchaseForRating.product_id}
          productName={selectedPurchaseForRating.product_name}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}

      {/* Renewal Confirmation Modal */}
      {showRenewalModal && selectedPurchaseForRenewal && (
        <RenewalConfirmationModal
          isOpen={showRenewalModal}
          onClose={() => {
            setShowRenewalModal(false);
            setSelectedPurchaseForRenewal(null);
          }}
          purchase={selectedPurchaseForRenewal}
          onConfirm={() => processRenewal(selectedPurchaseForRenewal)}
          isProcessing={renewalLoading === selectedPurchaseForRenewal.id}
        />
      )}

      {/* Purchase Help Modal - Open ticket to seller */}
      <PurchaseHelpModal
        isOpen={showHelpModal}
        onClose={() => {
          setShowHelpModal(false);
          setSelectedPurchaseForHelp(null);
          setSellerIdForHelp(null);
          if (user) loadUserPurchases();
        }}
        purchase={selectedPurchaseForHelp}
        sellerId={sellerIdForHelp}
      />
    </div>
  );
}

interface RenewalConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: UserPurchase;
  onConfirm: () => void;
  isProcessing: boolean;
}

function RenewalConfirmationModal({ isOpen, onClose, purchase, onConfirm, isProcessing }: RenewalConfirmationModalProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Renovar Compra' : t.language === 'en' ? 'Renew Purchase' : 'Renovar Compra'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {t.language === 'pt'
                ? `Deseja renovar sua compra de ${purchase.product_name}?`
                : t.language === 'en'
                ? `Do you want to renew your purchase of ${purchase.product_name}?`
                : `¿Desea renovar su compra de ${purchase.product_name}?`}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              {t.language === 'pt'
                ? `Será cobrado ${formatPrice(purchase.purchase_price)} por mais 30 dias.`
                : t.language === 'en'
                ? `You will be charged ${formatPrice(purchase.purchase_price)} for 30 more days.`
                : `Se le cobrará ${formatPrice(purchase.purchase_price)} por 30 días más.`}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Produto:' : t.language === 'en' ? 'Product:' : 'Producto:'}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">{purchase.product_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Duração:' : t.language === 'en' ? 'Duration:' : 'Duración:'}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {t.language === 'pt' ? '30 dias' : t.language === 'en' ? '30 days' : '30 días'}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Valor:' : t.language === 'en' ? 'Amount:' : 'Valor:'}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(purchase.purchase_price)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.language === 'pt' ? 'Não' : t.language === 'en' ? 'No' : 'No'}
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {t.language === 'pt' ? 'Renovando...' : t.language === 'en' ? 'Renewing...' : 'Renovando...'}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {t.language === 'pt' ? 'Sim, Renovar' : t.language === 'en' ? 'Yes, Renew' : 'Sí, Renovar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}