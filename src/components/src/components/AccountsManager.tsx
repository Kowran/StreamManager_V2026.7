import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Calendar, AlertTriangle, Users, BarChart3, DollarSign, TrendingUp, Clock, Package, X, User, Mail, Phone } from 'lucide-react';
import { supabase, StreamingAccount, StreamingService, Seller } from '../lib/supabase';
import { AccountForm } from './AccountForm';
import { ProfilesManager } from './ProfilesManager';
import { ClientsManager } from './ClientsManager';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';

export function AccountsManager() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'accounts' | 'clients'>('accounts');
  const [accounts, setAccounts] = useState<StreamingAccount[]>([]);
  const [services, setServices] = useState<StreamingService[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [editingAccount, setEditingAccount] = useState<StreamingAccount | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<StreamingAccount | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    type: string;
    data: any[];
  } | null>(null);
  const [dashboardStats, setDashboardStats] = useState({
    totalClients: 0,
    totalAccounts: 0,
    totalRevenue: 0,
    totalCosts: 0,
    expiringProfiles: 0,
    expiringAccounts: 0,
    activeProfiles: 0
  });
  // Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadData();
    checkAdminStatus();
    loadDashboardStats();
  }, []);

  async function checkAdminStatus() {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      setIsAdmin(profile?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  }

  async function loadDashboardStats() {
    if (!user) return;

    try {
      // Get total clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id);

      // Get total accounts
      const { data: accountsData } = await supabase
        .from('streaming_accounts')
        .select('*')
        .eq('user_id', user.id);

      // Get all profiles for revenue calculation
      const { data: profilesData } = await supabase
        .from('account_profiles')
        .select(`
          price_paid,
          status,
          expiry_date,
          streaming_accounts!inner (
            user_id,
            monthly_price
          )
        `)
        .eq('streaming_accounts.user_id', user.id);

      // Calculate stats
      const totalClients = clientsData?.length || 0;
      const totalAccounts = accountsData?.length || 0;
      const totalRevenue = profilesData?.reduce((sum, profile) => sum + profile.price_paid, 0) || 0;
      const totalCosts = accountsData?.reduce((sum, account) => sum + account.monthly_price, 0) || 0;
      
      // Calculate expiring items (next 7 days)
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const expiringProfiles = profilesData?.filter(profile => 
        profile.expiry_date && 
        new Date(profile.expiry_date) <= sevenDaysFromNow &&
        new Date(profile.expiry_date) > new Date() &&
        profile.status === 'active'
      ).length || 0;

      const expiringAccounts = accountsData?.filter(account => 
        account.expiry_date && 
        new Date(account.expiry_date) <= sevenDaysFromNow &&
        new Date(account.expiry_date) > new Date() &&
        account.status === 'active'
      ).length || 0;

      const activeProfiles = profilesData?.filter(profile => profile.status === 'active').length || 0;

      setDashboardStats({
        totalClients,
        totalAccounts,
        totalRevenue,
        totalCosts,
        expiringProfiles,
        expiringAccounts,
        activeProfiles
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      // Carregar apenas contas do usuário atual com relacionamentos
      let accountsQuery = supabase
        .from('streaming_accounts')
        .select(`
          *,
          streaming_services (id, name, logo_url),
          sellers (id, name)
        `);

      // Se não for admin, filtrar apenas contas do usuário atual
      if (!isAdmin && user) {
        accountsQuery = accountsQuery.eq('user_id', user.id);
      }

      const { data: accountsData } = await accountsQuery
        .order('created_at', { ascending: false });

      // Carregar serviços
      const { data: servicesData } = await supabase
        .from('streaming_services')
        .select('*')
        .order('name');

      // Carregar vendedores
      const { data: sellersData } = await supabase
        .from('sellers')
        .select('*')
        .order('name');

      // Carregar clientes do usuário atual
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');
      console.log('Contas carregadas:', accountsData);
      console.log('Serviços carregados:', servicesData);
      console.log('Vendedores carregados:', sellersData);
      console.log('Clientes carregados:', clientsData);
      
      setAccounts(accountsData || []);
      setServices(servicesData || []);
      setSellers(sellersData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount(account: StreamingAccount) {
    if (!confirm('Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('streaming_accounts')
        .delete()
        .eq('id', account.id);

      if (error) throw error;
      
      setAccounts(accounts.filter(acc => acc.id !== account.id));
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      alert('Erro ao excluir conta');
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'active': return 'Ativa';
      case 'expired': return 'Expirada';
      case 'suspended': return 'Suspensa';
      default: return status;
    }
  }

  function isExpiringSoon(expiryDate?: string) {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
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

  function openDetailsModal(type: string, title: string, data: any[]) {
    setModalData({ title, type, data });
    setShowDetailsModal(true);
  }

  async function loadDetailedData(type: string) {
    if (!user) return [];

    try {
      switch (type) {
        case 'clients':
          const { data: clientsData } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          return clientsData || [];

        case 'accounts':
          const { data: accountsData } = await supabase
            .from('streaming_accounts')
            .select(`
              *,
              streaming_services (name, logo_url),
              sellers (name)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          return accountsData || [];

        case 'active_profiles':
          const { data: activeProfilesData } = await supabase
            .from('account_profiles')
            .select(`
              *,
              clients (name, email),
              streaming_accounts!inner (
                user_id,
                email,
                streaming_services (name)
              )
            `)
            .eq('streaming_accounts.user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
          return activeProfilesData || [];

        case 'revenue':
          const { data: revenueData } = await supabase
            .from('account_profiles')
            .select(`
              *,
              clients (name, email),
              streaming_accounts!inner (
                user_id,
                email,
                streaming_services (name)
              )
            `)
            .eq('streaming_accounts.user_id', user.id)
            .order('price_paid', { ascending: false });
          return revenueData || [];

        case 'costs':
          const { data: costsData } = await supabase
            .from('streaming_accounts')
            .select(`
              *,
              streaming_services (name, logo_url),
              sellers (name)
            `)
            .eq('user_id', user.id)
            .order('monthly_price', { ascending: false });
          return costsData || [];

        case 'expiring_profiles':
          const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const { data: expiringProfilesData } = await supabase
            .from('account_profiles')
            .select(`
              *,
              clients (name, email),
              streaming_accounts!inner (
                user_id,
                email,
                streaming_services (name)
              )
            `)
            .eq('streaming_accounts.user_id', user.id)
            .eq('status', 'active')
            .not('expiry_date', 'is', null)
            .gte('expiry_date', new Date().toISOString().split('T')[0])
            .lte('expiry_date', sevenDaysFromNow.toISOString().split('T')[0])
            .order('expiry_date', { ascending: true });
          return expiringProfilesData || [];

        case 'expiring_accounts':
          const sevenDaysFromNowAccounts = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const { data: expiringAccountsData } = await supabase
            .from('streaming_accounts')
            .select(`
              *,
              streaming_services (name, logo_url),
              sellers (name)
            `)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .not('expiry_date', 'is', null)
            .gte('expiry_date', new Date().toISOString().split('T')[0])
            .lte('expiry_date', sevenDaysFromNowAccounts.toISOString().split('T')[0])
            .order('expiry_date', { ascending: true });
          return expiringAccountsData || [];

        default:
          return [];
      }
    } catch (error) {
      console.error('Error loading detailed data:', error);
      return [];
    }
  }

  async function handleCardClick(type: string, title: string) {
    const data = await loadDetailedData(type);
    openDetailsModal(type, title, data);
  }

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.streaming_services?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    const matchesService = serviceFilter === 'all' || account.service_id === serviceFilter;
    return matchesSearch && matchesStatus && matchesService;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-4 sm:space-x-6 lg:space-x-8 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap touch-manipulation ${
              activeTab === 'accounts'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Calendar className="h-4 w-4" />
              <span>{t.streamingAccounts}</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap touch-manipulation ${
              activeTab === 'clients'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Users className="h-4 w-4" />
              <span>{t.clients}</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'clients' ? (
        <ClientsManager />
      ) : (
        <React.Fragment>
      {/* Dashboard Stats */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Dashboard do Gerenciador
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
          <button
            onClick={() => handleCardClick('clients', 'Todos os Clientes')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md hover:scale-105 transition-all duration-200 text-left touch-manipulation"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Clientes</p>
                <p className="text-lg sm:text-xl font-bold text-blue-600">{dashboardStats.totalClients}</p>
              </div>
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            </div>
          </button>

          <button
            onClick={() => handleCardClick('accounts', 'Todas as Contas')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md hover:scale-105 transition-all duration-200 text-left touch-manipulation"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Contas</p>
                <p className="text-lg sm:text-xl font-bold text-purple-600">{dashboardStats.totalAccounts}</p>
              </div>
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
            </div>
          </button>

          <button
            onClick={() => handleCardClick('active_profiles', 'Perfis Ativos')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md hover:scale-105 transition-all duration-200 text-left touch-manipulation"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Perfis Ativos</p>
                <p className="text-lg sm:text-xl font-bold text-green-600">{dashboardStats.activeProfiles}</p>
              </div>
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
            </div>
          </button>

          <button
            onClick={() => handleCardClick('revenue', 'Detalhes da Receita')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md hover:scale-105 transition-all duration-200 text-left touch-manipulation"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Faturado</p>
                <p className="text-lg sm:text-xl font-bold text-green-600">${dashboardStats.totalRevenue.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
            </div>
          </button>

          <button
            onClick={() => handleCardClick('costs', 'Detalhes dos Custos')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md hover:scale-105 transition-all duration-200 text-left touch-manipulation"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Custos</p>
                <p className="text-lg sm:text-xl font-bold text-red-600">${dashboardStats.totalCosts.toFixed(2)}</p>
              </div>
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
            </div>
          </button>

          <button
            onClick={() => handleCardClick('expiring_profiles', 'Perfis Expirando')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md hover:scale-105 transition-all duration-200 text-left touch-manipulation"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Perfis Expirando</p>
                <p className="text-lg sm:text-xl font-bold text-yellow-600">{dashboardStats.expiringProfiles}</p>
              </div>
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
            </div>
          </button>

          <button
            onClick={() => handleCardClick('expiring_accounts', 'Contas Expirando')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md hover:scale-105 transition-all duration-200 text-left touch-manipulation"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Contas Expirando</p>
                <p className="text-lg sm:text-xl font-bold text-orange-600">{dashboardStats.expiringAccounts}</p>
              </div>
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
            </div>
          </button>
        </div>

        {/* Profit Summary */}
        <div className="mt-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300">
                💰 Lucro Total (Faturado - Custos)
              </h4>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                Baseado nos valores pagos pelos perfis menos os custos das contas
              </p>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${
                (dashboardStats.totalRevenue - dashboardStats.totalCosts) >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                ${(dashboardStats.totalRevenue - dashboardStats.totalCosts).toFixed(2)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {((dashboardStats.totalRevenue - dashboardStats.totalCosts) / Math.max(dashboardStats.totalCosts, 1) * 100).toFixed(1)}% margem
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.streamingAccounts}</h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t.language === 'pt' ? 'Gerencie suas contas de streaming' :
             t.language === 'en' ? 'Manage your streaming accounts' :
             'Gestiona tus cuentas de streaming'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t.newAccount}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder={`${t.search}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2.5 sm:py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 touch-manipulation"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 sm:py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white touch-manipulation"
        >
          <option value="all">{t.status}</option>
          <option value="active">{t.active}</option>
          <option value="expired">{t.expired}</option>
          <option value="suspended">{t.suspended}</option>
        </select>
      </div>

      {/* Filtros por serviço */}
      {services.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 transition-colors">
          <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
            Filtrar por serviço:
          </h3>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {/* Botão "Todos" */}
            <button
              onClick={() => setServiceFilter('all')}
              className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 transition-all duration-200 touch-manipulation ${
                serviceFilter === 'all'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
              }`}
              title="Todos os serviços"
            >
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 text-center">
                Todos
              </div>
            </button>

            {/* Ícones dos serviços */}
            {services.map((service) => {
              const serviceAccountsCount = accounts.filter(acc => acc.service_id === service.id).length;
              
              return (
                <button
                  key={service.id}
                  onClick={() => setServiceFilter(service.id)}
                  className={`relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 transition-all duration-200 group touch-manipulation ${
                    serviceFilter === service.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                  }`}
                  title={`${service.name} (${serviceAccountsCount} contas)`}
                >
                  {service.logo_url ? (
                    <img
                      src={service.logo_url}
                      alt={service.name}
                      className="w-6 h-6 sm:w-8 sm:h-8 object-cover rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded text-white text-xs font-bold ${service.logo_url ? 'hidden' : ''}`}>
                    {service.name.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* Badge com contador */}
                  {serviceAccountsCount > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-medium">
                      {serviceAccountsCount}
                    </div>
                  )}
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 hidden sm:block">
                    {service.name}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Contador de resultados */}
          <div className="mt-2 sm:mt-3 text-xs text-gray-500 dark:text-gray-400">
            {serviceFilter === 'all' 
              ? `${t.showingResults} ${filteredAccounts.length} ${t.of} ${accounts.length} ${t.ofYourAccounts}`
              : `${t.showingResults} ${filteredAccounts.length} ${t.accountsOf} ${services.find(s => s.id === serviceFilter)?.name || t.selectedService}`
            }
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.service}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.email}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.profiles}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.expiryDate}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.status}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.seller}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.actions}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {account.streaming_services?.logo_url && (
                        <img
                          src={account.streaming_services.logo_url}
                          alt={account.streaming_services.name}
                          className="h-8 w-8 rounded-full mr-3 object-cover"
                        />
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {account.streaming_services?.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {account.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      account.used_profiles === account.total_profiles 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {account.used_profiles}/{account.total_profiles}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div className="flex items-center">
                      {account.expiry_date && (
                        <>
                          {isExpiringSoon(account.expiry_date) && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
                          )}
                          <span className={isExpiringSoon(account.expiry_date) ? 'text-yellow-600 font-medium' : ''}>
                            {new Date(account.expiry_date).toLocaleDateString('pt-BR')}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                      {account.status === 'active' ? t.active : account.status === 'expired' ? t.expired : t.suspended}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {account.sellers?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAccount(account);
                          setShowProfiles(true);
                        }}
                        className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors touch-manipulation"
                        title={t.profiles}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingAccount(account);
                          setShowForm(true);
                        }}
                        className="p-1 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors touch-manipulation"
                        title={t.edit}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account)}
                        className="p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors touch-manipulation"
                        title={t.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredAccounts.map((account) => (
          <div key={account.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {account.streaming_services?.logo_url ? (
                    <img
                      src={account.streaming_services.logo_url}
                      alt={account.streaming_services.name}
                      className="h-10 w-10 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold ${account.streaming_services?.logo_url ? 'hidden' : ''}`}>
                    {account.streaming_services?.name?.charAt(0).toUpperCase() || 'S'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {account.streaming_services?.name}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {account.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                  {account.status === 'active' ? t.active : account.status === 'expired' ? t.expired : t.suspended}
                </span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Perfis</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  account.used_profiles === account.total_profiles 
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' 
                    : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                }`}>
                  {account.used_profiles}/{account.total_profiles}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Vendedor</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {account.sellers?.name || '-'}
                </p>
              </div>
              {account.expiry_date && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Data de Expiração</p>
                  <div className="flex items-center">
                    {isExpiringSoon(account.expiry_date) && (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${isExpiringSoon(account.expiry_date) ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                      {new Date(account.expiry_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSelectedAccount(account);
                    setShowProfiles(true);
                  }}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm touch-manipulation"
                  title={t.profiles}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  <span>Perfis</span>
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setEditingAccount(account);
                    setShowForm(true);
                  }}
                  className="p-2 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors touch-manipulation"
                  title={t.edit}
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteAccount(account)}
                  className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors touch-manipulation"
                  title={t.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAccounts.length === 0 && (
        <div className="text-center py-8 sm:py-12">
          <Calendar className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white px-4">{t.noDataFound}</h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-4">
            {t.language === 'pt' ? 'Você ainda não tem contas de streaming cadastradas' :
             t.language === 'en' ? 'You don\'t have any streaming accounts registered yet' :
             'Aún no tienes cuentas de streaming registradas'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t.language === 'pt' ? 'Adicionar Primeira Conta' :
             t.language === 'en' ? 'Add First Account' :
             'Agregar Primera Cuenta'}
          </button>
        </div>
      )}

      {/* Modal do formulário */}
      {showForm && (
        <AccountForm
          account={editingAccount}
          services={services}
          sellers={sellers}
          clients={clients}
          onClose={() => {
            setShowForm(false);
            setEditingAccount(null);
          }}
          onSave={() => {
            loadData();
            loadDashboardStats();
            setShowForm(false);
            setEditingAccount(null);
          }}
        />
      )}

      {/* Modal de perfis */}
      {showProfiles && selectedAccount && (
        <ProfilesManager
          account={selectedAccount}
          onClose={() => {
            setShowProfiles(false);
            setSelectedAccount(null);
            loadData();
            loadDashboardStats();
          }}
        />
      )}

      {/* Details Modal */}
      {showDetailsModal && modalData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 sm:top-10 mx-auto p-4 sm:p-5 border w-full max-w-6xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {modalData.title}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 touch-manipulation"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {modalData.data.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-4 flex items-center justify-center">
                    {modalData.type === 'clients' && <Users className="h-full w-full" />}
                    {modalData.type === 'accounts' && <Calendar className="h-full w-full" />}
                    {modalData.type === 'active_profiles' && <Package className="h-full w-full" />}
                    {modalData.type === 'revenue' && <TrendingUp className="h-full w-full" />}
                    {modalData.type === 'costs' && <DollarSign className="h-full w-full" />}
                    {modalData.type === 'expiring_profiles' && <AlertTriangle className="h-full w-full" />}
                    {modalData.type === 'expiring_accounts' && <Clock className="h-full w-full" />}
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white px-4">
                    {modalData.type === 'clients' && 'Nenhum cliente cadastrado'}
                    {modalData.type === 'accounts' && 'Nenhuma conta cadastrada'}
                    {modalData.type === 'active_profiles' && 'Nenhum perfil ativo'}
                    {modalData.type === 'revenue' && 'Nenhuma receita registrada'}
                    {modalData.type === 'costs' && 'Nenhum custo registrado'}
                    {modalData.type === 'expiring_profiles' && 'Nenhum perfil expirando'}
                    {modalData.type === 'expiring_accounts' && 'Nenhuma conta expirando'}
                  </h4>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-4">
                    {modalData.type === 'clients' && 'Adicione clientes para começar a gerenciar perfis'}
                    {modalData.type === 'accounts' && 'Adicione contas de streaming para começar'}
                    {modalData.type === 'active_profiles' && 'Crie perfis nas suas contas para começar a faturar'}
                    {modalData.type === 'revenue' && 'A receita aparecerá quando você atribuir perfis pagos'}
                    {modalData.type === 'costs' && 'Os custos aparecerão quando você adicionar contas com preços'}
                    {modalData.type === 'expiring_profiles' && 'Ótimo! Nenhum perfil expirando nos próximos 7 dias'}
                    {modalData.type === 'expiring_accounts' && 'Ótimo! Nenhuma conta expirando nos próximos 7 dias'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      <div className="text-center">
                        <div className="text-lg sm:text-xl font-bold text-blue-600">{modalData.data.length}</div>
                        <div className="text-xs text-blue-700 dark:text-blue-400">Total de Itens</div>
                      </div>
                      {modalData.type === 'revenue' && (
                        <div className="text-center">
                          <div className="text-lg sm:text-xl font-bold text-green-600">
                            ${modalData.data.reduce((sum: number, item: any) => sum + (item.price_paid || 0), 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-green-700 dark:text-green-400">Receita Total</div>
                        </div>
                      )}
                      {modalData.type === 'costs' && (
                        <div className="text-center">
                          <div className="text-lg sm:text-xl font-bold text-red-600">
                            ${modalData.data.reduce((sum: number, item: any) => sum + (item.monthly_price || 0), 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-red-700 dark:text-red-400">Custo Total</div>
                        </div>
                      )}
                      {(modalData.type === 'expiring_profiles' || modalData.type === 'expiring_accounts') && (
                        <>
                          <div className="text-center">
                            <div className="text-lg sm:text-xl font-bold text-red-600">
                              {modalData.data.filter((item: any) => {
                                const expiry = new Date(item.expiry_date);
                                const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                return diffDays <= 1;
                              }).length}
                            </div>
                            <div className="text-xs text-red-700 dark:text-red-400">Expira Hoje/Amanhã</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg sm:text-xl font-bold text-yellow-600">
                              {modalData.data.filter((item: any) => {
                                const expiry = new Date(item.expiry_date);
                                const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                return diffDays > 1 && diffDays <= 7;
                              }).length}
                            </div>
                            <div className="text-xs text-yellow-700 dark:text-yellow-400">Próximos 7 Dias</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Data List */}
                  <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
                    {modalData.data.map((item: any, index: number) => (
                      <div key={item.id || index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-600">
                        {/* Clients */}
                        {modalData.type === 'clients' && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                <div className="h-full w-full rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">
                                  {item.name}
                                </h4>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs text-gray-600 dark:text-gray-400">
                                  {item.email && (
                                    <div className="flex items-center space-x-1">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate">{item.email}</span>
                                    </div>
                                  )}
                                  {item.phone && (
                                    <div className="flex items-center space-x-1">
                                      <Phone className="h-3 w-3" />
                                      <span>{item.phone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                              {new Date(item.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        )}

                        {/* Accounts */}
                        {modalData.type === 'accounts' && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                {item.streaming_services?.logo_url ? (
                                  <img
                                    src={item.streaming_services.logo_url}
                                    alt={item.streaming_services.name}
                                    className="h-full w-full rounded-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      target.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`h-full w-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold ${item.streaming_services?.logo_url ? 'hidden' : ''}`}>
                                  {item.streaming_services?.name?.charAt(0).toUpperCase() || 'S'}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                  {item.streaming_services?.name}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  {item.email}
                                </p>
                                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-500">
                                  <span>Perfis: {item.used_profiles}/{item.total_profiles}</span>
                                  <span>${item.monthly_price.toFixed(2)}/mês</span>
                                  {item.sellers?.name && <span>Vendedor: {item.sellers.name}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                item.status === 'expired' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                              }`}>
                                {item.status === 'active' ? 'Ativa' : item.status === 'expired' ? 'Expirada' : 'Suspensa'}
                              </span>
                              {item.expiry_date && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Expira: {new Date(item.expiry_date).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Active Profiles */}
                        {modalData.type === 'active_profiles' && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                <div className="h-full w-full rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                  {item.profile_name}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {item.streaming_accounts?.streaming_services?.name} - {item.streaming_accounts?.email}
                                </p>
                                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-500">
                                  {item.clients?.name && <span>Cliente: {item.clients.name}</span>}
                                  <span>Atribuído: {new Date(item.assigned_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-green-600 dark:text-green-400">
                                ${item.price_paid.toFixed(2)}
                              </div>
                              {item.expiry_date && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Expira: {new Date(item.expiry_date).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Revenue Details */}
                        {modalData.type === 'revenue' && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                <div className="h-full w-full rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                  {item.profile_name}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {item.streaming_accounts?.streaming_services?.name}
                                </p>
                                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-500">
                                  {item.clients?.name && <span>Cliente: {item.clients.name}</span>}
                                  <span>Pago em: {new Date(item.assigned_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                ${item.price_paid.toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {item.status === 'active' ? 'Ativo' : 'Inativo'}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Costs Details */}
                        {modalData.type === 'costs' && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                {item.streaming_services?.logo_url ? (
                                  <img
                                    src={item.streaming_services.logo_url}
                                    alt={item.streaming_services.name}
                                    className="h-full w-full rounded-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      target.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`h-full w-full bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold ${item.streaming_services?.logo_url ? 'hidden' : ''}`}>
                                  {item.streaming_services?.name?.charAt(0).toUpperCase() || 'S'}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                  {item.streaming_services?.name}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  {item.email}
                                </p>
                                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-500">
                                  <span>Perfis: {item.used_profiles}/{item.total_profiles}</span>
                                  {item.sellers?.name && <span>Vendedor: {item.sellers.name}</span>}
                                  <span>Comprada: {new Date(item.purchase_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                                ${item.monthly_price.toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                por mês
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Expiring Profiles */}
                        {modalData.type === 'expiring_profiles' && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                <div className={`h-full w-full rounded-full flex items-center justify-center ${
                                  (() => {
                                    const expiry = new Date(item.expiry_date);
                                    const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    return diffDays <= 1 
                                      ? 'bg-red-100 dark:bg-red-900/20' 
                                      : 'bg-yellow-100 dark:bg-yellow-900/20';
                                  })()
                                }`}>
                                  <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 ${
                                    (() => {
                                      const expiry = new Date(item.expiry_date);
                                      const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                      return diffDays <= 1 
                                        ? 'text-red-600 dark:text-red-400' 
                                        : 'text-yellow-600 dark:text-yellow-400';
                                    })()
                                  }`} />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                  {item.profile_name}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {item.streaming_accounts?.streaming_services?.name} - {item.clients?.name || 'Sem cliente'}
                                </p>
                                <div className="text-xs text-gray-500 dark:text-gray-500">
                                  Valor pago: ${item.price_paid.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-bold ${
                                (() => {
                                  const expiry = new Date(item.expiry_date);
                                  const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                  return diffDays <= 1 
                                    ? 'text-red-600 dark:text-red-400' 
                                    : 'text-yellow-600 dark:text-yellow-400';
                                })()
                              }`}>
                                {(() => {
                                  const expiry = new Date(item.expiry_date);
                                  const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                  return diffDays <= 0 ? 'Expirado' :
                                         diffDays === 1 ? 'Expira hoje' :
                                         `${diffDays} dias`;
                                })()}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(item.expiry_date).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Expiring Accounts */}
                        {modalData.type === 'expiring_accounts' && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                <div className={`h-full w-full rounded-full flex items-center justify-center ${
                                  (() => {
                                    const expiry = new Date(item.expiry_date);
                                    const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    return diffDays <= 1 
                                      ? 'bg-red-100 dark:bg-red-900/20' 
                                      : 'bg-orange-100 dark:bg-orange-900/20';
                                  })()
                                }`}>
                                  <Clock className={`h-4 w-4 sm:h-5 sm:w-5 ${
                                    (() => {
                                      const expiry = new Date(item.expiry_date);
                                      const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                      return diffDays <= 1 
                                        ? 'text-red-600 dark:text-red-400' 
                                        : 'text-orange-600 dark:text-orange-400';
                                    })()
                                  }`} />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                  {item.streaming_services?.name}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  {item.email}
                                </p>
                                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-500">
                                  <span>Perfis: {item.used_profiles}/{item.total_profiles}</span>
                                  <span>Custo: ${item.monthly_price.toFixed(2)}/mês</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-bold ${
                                (() => {
                                  const expiry = new Date(item.expiry_date);
                                  const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                  return diffDays <= 1 
                                    ? 'text-red-600 dark:text-red-400' 
                                    : 'text-orange-600 dark:text-orange-400';
                                })()
                              }`}>
                                {(() => {
                                  const expiry = new Date(item.expiry_date);
                                  const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                  return diffDays <= 0 ? 'Expirada' :
                                         diffDays === 1 ? 'Expira hoje' :
                                         `${diffDays} dias`;
                                })()}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(item.expiry_date).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
        </React.Fragment>
      )}
    </div>
  );
}