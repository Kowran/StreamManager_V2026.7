import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, MessageCircle,
  Store, AlertTriangle, Loader2, Wallet, HelpCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { SellerDashboardOverview } from './SellerDashboardOverview';
import { SellerProductsManager } from './SellerProductsManager';
import { SellerOrdersManager } from './SellerOrdersManager';
import { SellerSupport } from './SellerSupport';
import { SellerBalanceDetail } from './SellerBalanceDetail';
import { SellerQAManager } from './SellerQAManager';

type SellerTab = 'dashboard' | 'products' | 'orders' | 'qa' | 'support' | 'balance';

export function SellerStore() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<SellerTab>('dashboard');
  const [isSeller, setIsSeller] = useState(false);
  const [loading, setLoading] = useState(true);

  const sellerNavigate = (tab: SellerTab) => {
    setActiveTab(tab);
    window.history.pushState(null, '', `/seller-store/${tab}`);
  };
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [pendingQuestionsCount, setPendingQuestionsCount] = useState(0);
  const [vacationMode, setVacationMode] = useState(false);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    checkSellerStatus();
  }, []);

  useEffect(() => {
    if (isSeller && user) {
      loadCounts();
      loadVacationMode();
    }
  }, [isSeller, user]);

  async function checkSellerStatus() {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      setIsSeller(profile?.role === 'seller' || profile?.role === 'admin');
    } catch (error) {
      console.error('Error checking seller status:', error);
      setIsSeller(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    if (!user) return;
    try {
      const { count: ordersCount } = await supabase
        .from('store_orders')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .in('status', ['pending', 'paid', 'processing']);

      const { count: ticketsCount } = await supabase
        .from('seller_support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .in('status', ['open', 'waiting_seller']);

      const { count: questionsCount } = await supabase
        .from('product_questions')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .is('answer', null);

      setPendingOrdersCount(ordersCount || 0);
      setOpenTicketsCount(ticketsCount || 0);
      setPendingQuestionsCount(questionsCount || 0);
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  }

  async function loadVacationMode() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('seller_store_settings')
        .select('vacation_mode')
        .eq('seller_id', user.id)
        .maybeSingle();
      setVacationMode(data?.vacation_mode || false);
    } catch { /* ignore */ }
  }

  const tabs = [
    { id: 'dashboard' as SellerTab, name: lbl('Dashboard', 'Dashboard', 'Panel'), icon: LayoutDashboard },
    { id: 'products' as SellerTab, name: lbl('Produtos', 'Products', 'Productos'), icon: Package },
    { id: 'orders' as SellerTab, name: lbl('Pedidos', 'Orders', 'Pedidos'), icon: ShoppingCart, badge: pendingOrdersCount },
    { id: 'qa' as SellerTab, name: lbl('Perguntas', 'Q&A', 'Preguntas'), icon: HelpCircle, badge: pendingQuestionsCount },
    { id: 'support' as SellerTab, name: lbl('Suporte', 'Support', 'Soporte'), icon: MessageCircle, badge: openTicketsCount },
    { id: 'balance' as SellerTab, name: lbl('Saldo', 'Balance', 'Saldo'), icon: Wallet },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div className="text-center py-16">
        <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-4 w-16 h-16 mx-auto mb-4">
          <Store className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {lbl('Acesso Restrito', 'Restricted Access', 'Acceso Restringido')}
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          {lbl('Apenas vendedores aprovados podem gerenciar sua loja.', 'Only approved sellers can manage their store.', 'Solo vendedores aprobados pueden gestionar su tienda.')}
        </p>
      </div>
    );
  }

  function renderTab() {
    switch (activeTab) {
      case 'dashboard': return <SellerDashboardOverview onNavigate={(tab) => sellerNavigate(tab as SellerTab)} />;
      case 'products': return <SellerProductsManager />;
      case 'orders': return <SellerOrdersManager />;
      case 'qa': return <SellerQAManager />;
      case 'support': return <SellerSupport />;
      case 'balance': return <SellerBalanceDetail />;
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6" />
              {lbl('Minha Loja', 'My Store', 'Mi Tienda')}
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              {lbl('Gerencie seus produtos, vendas e configurações', 'Manage your products, sales and settings', 'Gestiona tus productos, ventas y configuración')}
            </p>
          </div>
          {vacationMode && (
            <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-300/30 rounded-lg px-3 py-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-200" />
              <span className="text-xs font-medium text-amber-100">
                {lbl('Modo Férias Ativo', 'Vacation Mode Active', 'Modo Vacaciones Activo')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-1.5">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => sellerNavigate(tab.id)}
                className={`relative flex items-center gap-2 px-3 lg:px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.name}</span>
                <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                {tab.badge != null && tab.badge > 0 && (
                  <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
                  }`}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>{renderTab()}</div>
    </div>
  );
}
