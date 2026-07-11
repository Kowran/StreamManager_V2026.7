import React, { useState, useEffect } from 'react';
import { Package, ShoppingCart, History, Search, Instagram, Facebook, Twitter, Youtube, Tiktok, Spotify, Telegram, Send, TrendingUp, MessageCircle, Linkedin, Twitch, Globe, ArrowUpDown, Clock, RefreshCw, XCircle, Droplets, Copy, ExternalLink, Filter, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { BinancePaymentModal } from './BinancePaymentModal';

interface SMMCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  active: boolean;
  sort_order: number;
}

interface SMMService {
  id: string;
  name: string;
  description: string;
  category: string;
  category_id: string | null;
  subcategory?: string;
  price_per_1000: number;
  min_order: number;
  max_order: number;
  active: boolean;
  average_time?: string;
  refill?: boolean;
  cancel?: boolean;
  dripfeed?: boolean;
}

interface SMMOrder {
  id: string;
  service_id: string;
  link: string;
  quantity: number;
  charge: number;
  status: string;
  created_at: string;
  start_count?: number;
  remains?: number;
  service_name?: string;
}

export function SMMPanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'services' | 'orders'>('services');
  const [categories, setCategories] = useState<SMMCategory[]>([]);
  const [services, setServices] = useState<SMMService[]>([]);
  const [orders, setOrders] = useState<SMMOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<SMMService | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'price_low' | 'price_high' | 'min_order'>('name');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState({
    link: '',
    quantity: 100,
    dripfeed: false,
    dripfeed_runs: 2,
    dripfeed_interval: 60
  });
  const [showBinanceModal, setShowBinanceModal] = useState(false);
  const [showAmountSelector, setShowAmountSelector] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(10);

  useEffect(() => {
    loadCategories();
    loadServices();
    loadOrders();
    loadBalance();
  }, [user]);

  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from('smm_categories')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async function loadServices() {
    try {
      const { data, error } = await supabase
        .from('smm_services')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('smm_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ordersWithServices = await Promise.all(
        (data || []).map(async (order) => {
          const { data: service } = await supabase
            .from('smm_services')
            .select('name')
            .eq('id', order.service_id)
            .maybeSingle();

          return {
            ...order,
            service_name: service?.name || 'Unknown Service'
          };
        })
      );

      setOrders(ordersWithServices);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  }

  async function loadBalance() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setBalance(data?.balance || 0);
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  }

  async function handlePlaceOrder() {
    if (!user || !selectedService) return;

    const cost = (selectedService.price_per_1000 / 1000) * orderForm.quantity;

    if (cost > balance) {
      alert(t.language === 'pt' ? 'Saldo insuficiente' : t.language === 'en' ? 'Insufficient balance' : 'Saldo insuficiente');
      return;
    }

    if (orderForm.quantity < selectedService.min_order || orderForm.quantity > selectedService.max_order) {
      alert(
        t.language === 'pt'
          ? `Quantidade deve estar entre ${selectedService.min_order} e ${selectedService.max_order}`
          : t.language === 'en'
          ? `Quantity must be between ${selectedService.min_order} and ${selectedService.max_order}`
          : `La cantidad debe estar entre ${selectedService.min_order} y ${selectedService.max_order}`
      );
      return;
    }

    try {
      const orderData: any = {
        user_id: user.id,
        service_id: selectedService.id,
        link: orderForm.link,
        quantity: orderForm.quantity,
        charge: cost,
        status: 'pending',
        remains: orderForm.quantity
      };

      if (orderForm.dripfeed && selectedService.dripfeed) {
        orderData.dripfeed = true;
        orderData.dripfeed_runs = orderForm.dripfeed_runs;
        orderData.dripfeed_interval = orderForm.dripfeed_interval;
      }

      const { data: newOrder, error: orderError } = await supabase
        .from('smm_orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      const { data: debitResult, error: debitError } = await supabase
        .rpc('debit_user_credits', {
          p_user_id: user.id,
          p_amount: cost,
          p_description: `SMM Order: ${selectedService.name}`,
          p_reference_type: 'smm_order'
        });

      if (debitError) throw debitError;
      if (!debitResult) throw new Error('Saldo insuficiente');

      const processingResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-smm-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: newOrder.id
        })
      });

      const processingResult = await processingResponse.json();

      if (!processingResult.success) {
        console.warn('Provider processing failed:', processingResult.error);
      }

      alert(t.language === 'pt' ? 'Pedido criado com sucesso!' : t.language === 'en' ? 'Order placed successfully!' : '¡Pedido creado con éxito!');

      setSelectedService(null);
      setOrderForm({ link: '', quantity: 100, dripfeed: false, dripfeed_runs: 2, dripfeed_interval: 60 });
      loadOrders();
      loadBalance();
    } catch (error) {
      console.error('Error placing order:', error);
      alert(t.language === 'pt' ? 'Erro ao criar pedido' : t.language === 'en' ? 'Error placing order' : 'Error al crear pedido');
    }
  }

  function getCategoryIcon(iconName: string) {
    const images: Record<string, string> = {
      instagram: 'https://img.freepik.com/free-vector/instagram-logo_1199-122.jpg',
      facebook: 'https://static.vecteezy.com/system/resources/previews/021/495/985/non_2x/facebook-social-media-logo-icon-free-png.png',
      youtube: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTAUd3CYawFR6qqXXZPxB-mY79LXPf4tXI_JA&s',
      twitter: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/X_icon_2.svg/1200px-X_icon_2.svg.png',
      twitch: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQjaLF93c_uFKWmYFtCvBUtC8n3duGLNE7bOQ&s',
      kicks: 'https://static.vecteezy.com/system/resources/thumbnails/043/362/263/small_2x/kick-logo-icon-streaming-service-free-vector.jpg',
      tiktok: 'https://i.pinimg.com/564x/28/ab/05/28ab051cc38e4c8b929b45d2641bd767.jpg',
      spotify: 'https://s3-alpha.figma.com/hub/file/2734964093/9f5edc36-eb4d-414a-8447-10514f2bc224-cover.png',
      telegram: 'https://cdn.pixabay.com/photo/2021/12/27/10/50/telegram-6896827_1280.png',
      whatsapp: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrlGdX0mR89NWS-mWxgSbYjNKXR9zJp7IOXA&s',
      discord: 'https://static.vecteezy.com/system/resources/previews/006/892/625/non_2x/discord-logo-icon-editorial-free-vector.jpg',
    };

    const imageUrl = images[iconName.toLowerCase()];

    if (imageUrl) {
      return <img src={imageUrl} alt={iconName} className="w-full h-full object-cover" />;
    }

    return <Package className="h-5 w-5" />;
  }

  const availableSubcategories = selectedCategory
    ? [...new Set(services
        .filter(s => s.category.toLowerCase() === selectedCategory.toLowerCase() && s.subcategory)
        .map(s => s.subcategory!))]
    : [];

  const filteredServices = services
    .filter(service => {
      const matchesSearch =
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (service.subcategory && service.subcategory.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = !selectedCategory || service.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSubcategory = !selectedSubcategory || service.subcategory === selectedSubcategory;

      return matchesSearch && matchesCategory && matchesSubcategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price_low':
          return a.price_per_1000 - b.price_per_1000;
        case 'price_high':
          return b.price_per_1000 - a.price_per_1000;
        case 'min_order':
          return a.min_order - b.min_order;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'processing': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'in_progress': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'pending': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'partial': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
      case 'cancelled': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'failed': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, Record<string, string>> = {
      pending: { pt: 'Pendente', en: 'Pending', es: 'Pendiente' },
      processing: { pt: 'Processando', en: 'Processing', es: 'Procesando' },
      in_progress: { pt: 'Em Progresso', en: 'In Progress', es: 'En Progreso' },
      completed: { pt: 'Concluído', en: 'Completed', es: 'Completado' },
      partial: { pt: 'Parcial', en: 'Partial', es: 'Parcial' },
      cancelled: { pt: 'Cancelado', en: 'Cancelled', es: 'Cancelado' },
      failed: { pt: 'Falhou', en: 'Failed', es: 'Fallido' }
    };
    return statusMap[status]?.[t.language] || status;
  };

  const getProgressPercentage = (order: SMMOrder) => {
    if (!order.start_count || order.start_count === 0) return 0;
    const delivered = order.start_count - (order.remains || 0);
    return Math.min(100, Math.max(0, (delivered / order.quantity) * 100));
  };

  const filteredOrders = orders.filter(order => {
    if (!orderStatusFilter) return true;
    return order.status === orderStatusFilter;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(t.language === 'pt' ? 'ID copiado!' : t.language === 'en' ? 'ID copied!' : '¡ID copiado!');
  };

  async function refreshOrderStatus(orderId: string) {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-smm-order-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order_id: orderId })
      });

      if (response.ok) {
        await loadOrders();
        alert(t.language === 'pt' ? 'Status atualizado!' : t.language === 'en' ? 'Status updated!' : '¡Estado actualizado!');
      }
    } catch (error) {
      console.error('Error refreshing order status:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {t.language === 'pt' ? 'Painel SMM' : t.language === 'en' ? 'SMM Panel' : 'Panel SMM'}
            </h1>
            <p className="text-blue-100">
              {t.language === 'pt'
                ? 'Impulsione suas redes sociais'
                : t.language === 'en'
                ? 'Boost your social media'
                : 'Impulsa tus redes sociales'}
            </p>
          </div>
          <button
            onClick={() => setShowAmountSelector(true)}
            className="bg-white bg-opacity-20 p-4 rounded-lg hover:bg-opacity-30 transition-all cursor-pointer group"
            title={t.language === 'pt' ? 'Clique para recarregar' : t.language === 'en' ? 'Click to recharge' : 'Haz clic para recargar'}
          >
            <div className="text-sm text-blue-100 group-hover:text-white transition-colors">
              {t.language === 'pt' ? 'Saldo' : t.language === 'en' ? 'Balance' : 'Saldo'}
            </div>
            <div className="text-2xl font-bold group-hover:scale-105 transition-transform">${balance.toFixed(2)}</div>
            <div className="text-xs text-blue-200 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {t.language === 'pt' ? 'Recarregar' : t.language === 'en' ? 'Recharge' : 'Recargar'}
            </div>
          </button>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('services')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'services'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>{t.language === 'pt' ? 'Serviços' : t.language === 'en' ? 'Services' : 'Servicios'}</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'orders'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>{t.language === 'pt' ? 'Meus Pedidos' : t.language === 'en' ? 'My Orders' : 'Mis Pedidos'}</span>
          </div>
        </button>
      </div>

      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={t.language === 'pt' ? 'Buscar serviços...' : t.language === 'en' ? 'Search services...' : 'Buscar servicios...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="relative sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ArrowUpDown className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
              >
                <option value="name">
                  {t.language === 'pt' ? 'Ordenar: Nome (A-Z)' : t.language === 'en' ? 'Sort: Name (A-Z)' : 'Ordenar: Nombre (A-Z)'}
                </option>
                <option value="price_low">
                  {t.language === 'pt' ? 'Ordenar: Menor Preço' : t.language === 'en' ? 'Sort: Lowest Price' : 'Ordenar: Menor Precio'}
                </option>
                <option value="price_high">
                  {t.language === 'pt' ? 'Ordenar: Maior Preço' : t.language === 'en' ? 'Sort: Highest Price' : 'Ordenar: Mayor Precio'}
                </option>
                <option value="min_order">
                  {t.language === 'pt' ? 'Ordenar: Pedido Mínimo' : t.language === 'en' ? 'Sort: Minimum Order' : 'Ordenar: Pedido Mínimo'}
                </option>
              </select>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {t.language === 'pt' ? 'Filtrar por Rede Social' : t.language === 'en' ? 'Filter by Social Network' : 'Filtrar por Red Social'}
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                  }}
                  className={`flex items-center justify-center p-1.5 rounded-lg transition-all ${
                    !selectedCategory
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md ring-2 ring-blue-400 ring-offset-2'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 shadow-sm'
                  }`}
                  title={t.language === 'pt' ? 'Todas' : t.language === 'en' ? 'All' : 'Todas'}
                >
                  <div className="w-8 h-8 flex items-center justify-center rounded-md overflow-hidden bg-white">
                    <Package className="w-4 h-4" />
                  </div>
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.name);
                      setSelectedSubcategory(null);
                    }}
                    className={`flex items-center justify-center p-1.5 rounded-lg transition-all ${
                      selectedCategory === category.name
                        ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md ring-2 ring-blue-400 ring-offset-2'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 shadow-sm'
                    }`}
                    title={category.name}
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-md overflow-hidden bg-white">
                      {getCategoryIcon(category.icon)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedCategory && availableSubcategories.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {t.language === 'pt' ? 'Filtrar por Subcategoria' : t.language === 'en' ? 'Filter by Subcategory' : 'Filtrar por Subcategoría'}
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSubcategory(null)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    !selectedSubcategory
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t.language === 'pt' ? 'Todas' : t.language === 'en' ? 'All' : 'Todas'}
                </button>
                {availableSubcategories.map((subcategory) => (
                  <button
                    key={subcategory}
                    onClick={() => setSelectedSubcategory(subcategory)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      selectedSubcategory === subcategory
                        ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {subcategory}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedServiceId(expandedServiceId === service.id ? null : service.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-white shadow-md">
                          {getCategoryIcon(service.category)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white break-words">
                          {service.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {service.subcategory && (
                            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded">
                              {service.subcategory}
                            </span>
                          )}
                          {service.quality && (
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                              service.quality === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                              service.quality === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                              'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                              {service.quality === 'high' ? (t.language === 'pt' ? 'Alta' : t.language === 'en' ? 'High' : 'Alta') :
                               service.quality === 'medium' ? (t.language === 'pt' ? 'Média' : t.language === 'en' ? 'Medium' : 'Media') :
                               (t.language === 'pt' ? 'Baixa' : t.language === 'en' ? 'Low' : 'Baja')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {t.language === 'pt' ? 'Mín' : t.language === 'en' ? 'Min' : 'Mín'}: {service.min_order.toLocaleString()}
                          </span>
                          <span className="flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {t.language === 'pt' ? 'Máx' : t.language === 'en' ? 'Max' : 'Máx'}: {service.max_order.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${service.price_per_1000.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t.language === 'pt' ? 'por 1000' : t.language === 'en' ? 'per 1000' : 'por 1000'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedServiceId === service.id && (
                  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4 bg-gray-50 dark:bg-gray-900/50">
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          {t.language === 'pt' ? 'Descrição' : t.language === 'en' ? 'Description' : 'Descripción'}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {service.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 mb-1">
                            <Clock className="h-4 w-4" />
                            <span className="text-xs font-medium">
                              {t.language === 'pt' ? 'Tempo Médio' : t.language === 'en' ? 'Average Time' : 'Tiempo Promedio'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {service.average_time || (t.language === 'pt' ? '6-48 horas' : t.language === 'en' ? '6-48 hours' : '6-48 horas')}
                          </p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 mb-1">
                            <RefreshCw className="h-4 w-4" />
                            <span className="text-xs font-medium">
                              {t.language === 'pt' ? 'Refil' : t.language === 'en' ? 'Refill' : 'Refill'}
                            </span>
                          </div>
                          <p className={`text-sm font-semibold ${
                            service.refill
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {service.refill
                              ? (t.language === 'pt' ? 'Sim' : t.language === 'en' ? 'Yes' : 'Sí')
                              : (t.language === 'pt' ? 'Não' : t.language === 'en' ? 'No' : 'No')
                            }
                          </p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 mb-1">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs font-medium">
                              {t.language === 'pt' ? 'Cancelável' : t.language === 'en' ? 'Cancelable' : 'Cancelable'}
                            </span>
                          </div>
                          <p className={`text-sm font-semibold ${
                            service.cancel
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {service.cancel
                              ? (t.language === 'pt' ? 'Sim' : t.language === 'en' ? 'Yes' : 'Sí')
                              : (t.language === 'pt' ? 'Não' : t.language === 'en' ? 'No' : 'No')
                            }
                          </p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 mb-1">
                            <Droplets className="h-4 w-4" />
                            <span className="text-xs font-medium">
                              {t.language === 'pt' ? 'Dripfeed' : t.language === 'en' ? 'Dripfeed' : 'Dripfeed'}
                            </span>
                          </div>
                          <p className={`text-sm font-semibold ${
                            service.dripfeed
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {service.dripfeed
                              ? (t.language === 'pt' ? 'Sim' : t.language === 'en' ? 'Yes' : 'Sí')
                              : (t.language === 'pt' ? 'Não' : t.language === 'en' ? 'No' : 'No')
                            }
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedService(service);
                          }}
                          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 shadow-sm font-medium"
                        >
                          <ShoppingCart className="h-5 w-5" />
                          <span>{t.language === 'pt' ? 'Fazer Pedido' : t.language === 'en' ? 'Place Order' : 'Hacer Pedido'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredServices.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {t.language === 'pt' ? 'Nenhum serviço encontrado' : t.language === 'en' ? 'No services found' : 'No se encontraron servicios'}
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Filtros de Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-3">
              <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t.language === 'pt' ? 'Filtrar por Status' : t.language === 'en' ? 'Filter by Status' : 'Filtrar por Estado'}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setOrderStatusFilter(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !orderStatusFilter
                    ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t.language === 'pt' ? 'Todos' : t.language === 'en' ? 'All' : 'Todos'} ({orders.length})
              </button>
              {['pending', 'processing', 'in_progress', 'completed', 'partial', 'cancelled', 'failed'].map(status => {
                const count = orders.filter(o => o.status === status).length;
                if (count === 0) return null;
                return (
                  <button
                    key={status}
                    onClick={() => setOrderStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      orderStatusFilter === status
                        ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {getStatusText(status)} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop View */}
          <div className="hidden md:block space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center py-12">
                <History className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">
                  {t.language === 'pt' ? 'Nenhum pedido encontrado' : t.language === 'en' ? 'No orders found' : 'No se encontraron pedidos'}
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const progress = getProgressPercentage(order);
                const delivered = order.start_count ? order.start_count - (order.remains || 0) : 0;

                return (
                  <div key={order.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <button
                              onClick={() => copyToClipboard(order.id)}
                              className="flex items-center space-x-1 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title={t.language === 'pt' ? 'Copiar ID' : t.language === 'en' ? 'Copy ID' : 'Copiar ID'}
                            >
                              <span>#{order.id.substring(0, 12)}</span>
                              <Copy className="h-3 w-3" />
                            </button>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                              {getStatusText(order.status)}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                            {order.service_name}
                          </h3>
                          <a
                            href={order.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <span className="truncate max-w-md">{order.link}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                              ${order.charge.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(order.created_at).toLocaleDateString(
                                t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
                                { day: '2-digit', month: 'short', year: 'numeric' }
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => refreshOrderStatus(order.id)}
                            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            title={t.language === 'pt' ? 'Atualizar status' : t.language === 'en' ? 'Refresh status' : 'Actualizar estado'}
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>{t.language === 'pt' ? 'Atualizar' : t.language === 'en' ? 'Refresh' : 'Actualizar'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Barra de Progresso */}
                      {order.start_count && order.start_count > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                            <span>
                              {t.language === 'pt' ? 'Progresso' : t.language === 'en' ? 'Progress' : 'Progreso'}
                            </span>
                            <span className="font-medium">
                              {delivered.toLocaleString()} / {order.quantity.toLocaleString()} ({progress.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {t.language === 'pt' ? 'Quantidade' : t.language === 'en' ? 'Quantity' : 'Cantidad'}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {order.quantity.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {t.language === 'pt' ? 'Inicial' : t.language === 'en' ? 'Start' : 'Inicial'}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {order.start_count ? order.start_count.toLocaleString() : '-'}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {t.language === 'pt' ? 'Entregue' : t.language === 'en' ? 'Delivered' : 'Entregado'}
                          </div>
                          <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {delivered.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {t.language === 'pt' ? 'Restante' : t.language === 'en' ? 'Remains' : 'Restante'}
                          </div>
                          <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                            {order.remains !== undefined ? order.remains.toLocaleString() : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center py-12">
                <History className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">
                  {t.language === 'pt' ? 'Nenhum pedido encontrado' : t.language === 'en' ? 'No orders found' : 'No se encontraron pedidos'}
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const progress = getProgressPercentage(order);
                const delivered = order.start_count ? order.start_count - (order.remains || 0) : 0;

                return (
                  <div key={order.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => copyToClipboard(order.id)}
                          className="flex items-center space-x-1 text-xs font-mono text-gray-500 dark:text-gray-400"
                        >
                          <span>#{order.id.substring(0, 8)}</span>
                          <Copy className="h-3 w-3" />
                        </button>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t.language === 'pt' ? 'Serviço' : t.language === 'en' ? 'Service' : 'Servicio'}
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                          {order.service_name}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t.language === 'pt' ? 'Link' : t.language === 'en' ? 'Link' : 'Enlace'}
                        </div>
                        <a
                          href={order.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          <span className="break-all">{order.link}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </div>

                      {order.start_count && order.start_count > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                            <span>
                              {t.language === 'pt' ? 'Progresso' : t.language === 'en' ? 'Progress' : 'Progreso'}
                            </span>
                            <span className="font-medium">
                              {delivered.toLocaleString()} / {order.quantity.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden mb-1">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="text-xs text-center text-gray-500 dark:text-gray-400 font-medium">
                            {progress.toFixed(1)}%
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {t.language === 'pt' ? 'Quantidade' : t.language === 'en' ? 'Quantity' : 'Cantidad'}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {order.quantity.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {t.language === 'pt' ? 'Restante' : t.language === 'en' ? 'Remains' : 'Restante'}
                          </div>
                          <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                            {order.remains !== undefined ? order.remains.toLocaleString() : '-'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {t.language === 'pt' ? 'Custo' : t.language === 'en' ? 'Cost' : 'Costo'}
                          </div>
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">
                            ${order.charge.toFixed(2)}
                          </div>
                        </div>
                        <button
                          onClick={() => refreshOrderStatus(order.id)}
                          className="flex items-center space-x-1 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>{t.language === 'pt' ? 'Atualizar' : t.language === 'en' ? 'Refresh' : 'Actualizar'}</span>
                        </button>
                      </div>

                      <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
                        {new Date(order.created_at).toLocaleDateString(
                          t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
                          { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {selectedService.name}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {selectedService.description}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.language === 'pt' ? 'Link' : t.language === 'en' ? 'Link' : 'Enlace'}
                </label>
                <input
                  type="url"
                  value={orderForm.link}
                  onChange={(e) => setOrderForm({ ...orderForm, link: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.language === 'pt' ? 'Quantidade' : t.language === 'en' ? 'Quantity' : 'Cantidad'}
                </label>
                <input
                  type="number"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) || 0 })}
                  min={selectedService.min_order}
                  max={selectedService.max_order}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t.language === 'pt' ? 'Mín' : t.language === 'en' ? 'Min' : 'Mín'}: {selectedService.min_order.toLocaleString()} |
                  {t.language === 'pt' ? ' Máx' : t.language === 'en' ? ' Max' : ' Máx'}: {selectedService.max_order.toLocaleString()}
                </p>
              </div>

              {selectedService.dripfeed && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <input
                      type="checkbox"
                      id="dripfeed-checkbox"
                      checked={orderForm.dripfeed}
                      onChange={(e) => setOrderForm({ ...orderForm, dripfeed: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="dripfeed-checkbox" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                      <Droplets className="h-4 w-4 mr-1" />
                      {t.language === 'pt' ? 'Ativar Dripfeed' : t.language === 'en' ? 'Enable Dripfeed' : 'Activar Dripfeed'}
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {t.language === 'pt'
                      ? 'Divide o pedido em partes menores entregues gradualmente ao longo do tempo'
                      : t.language === 'en'
                      ? 'Splits the order into smaller parts delivered gradually over time'
                      : 'Divide el pedido en partes más pequeñas entregadas gradualmente con el tiempo'}
                  </p>

                  {orderForm.dripfeed && (
                    <div className="space-y-3 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t.language === 'pt' ? 'Número de Execuções' : t.language === 'en' ? 'Number of Runs' : 'Número de Ejecuciones'}
                        </label>
                        <input
                          type="number"
                          value={orderForm.dripfeed_runs}
                          onChange={(e) => setOrderForm({ ...orderForm, dripfeed_runs: parseInt(e.target.value) || 2 })}
                          min={2}
                          max={100}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t.language === 'pt'
                            ? `Cada execução entregará ~${Math.floor(orderForm.quantity / orderForm.dripfeed_runs).toLocaleString()} unidades`
                            : t.language === 'en'
                            ? `Each run will deliver ~${Math.floor(orderForm.quantity / orderForm.dripfeed_runs).toLocaleString()} units`
                            : `Cada ejecución entregará ~${Math.floor(orderForm.quantity / orderForm.dripfeed_runs).toLocaleString()} unidades`}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t.language === 'pt' ? 'Intervalo (minutos)' : t.language === 'en' ? 'Interval (minutes)' : 'Intervalo (minutos)'}
                        </label>
                        <input
                          type="number"
                          value={orderForm.dripfeed_interval}
                          onChange={(e) => setOrderForm({ ...orderForm, dripfeed_interval: parseInt(e.target.value) || 60 })}
                          min={1}
                          max={1440}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t.language === 'pt'
                            ? 'Tempo entre cada execução'
                            : t.language === 'en'
                            ? 'Time between each run'
                            : 'Tiempo entre cada ejecución'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t.language === 'pt' ? 'Custo Total' : t.language === 'en' ? 'Total Cost' : 'Costo Total'}:
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    ${((selectedService.price_per_1000 / 1000) * orderForm.quantity).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t.language === 'pt' ? 'Seu Saldo' : t.language === 'en' ? 'Your Balance' : 'Tu Saldo'}:
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    ${balance.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setSelectedService(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={!orderForm.link || orderForm.quantity < selectedService.min_order}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.language === 'pt' ? 'Fazer Pedido' : t.language === 'en' ? 'Place Order' : 'Hacer Pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Amount Selector Modal */}
      {showAmountSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {t.language === 'pt' ? 'Quanto deseja recarregar?' : t.language === 'en' ? 'How much would you like to recharge?' : '¿Cuánto desea recargar?'}
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[10, 20, 50, 100, 200, 500].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setRechargeAmount(amount)}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    rechargeAmount === amount
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-xl font-bold">${amount}</div>
                </button>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.language === 'pt' ? 'Ou digite um valor personalizado:' : t.language === 'en' ? 'Or enter a custom amount:' : 'O ingrese un monto personalizado:'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="10000"
                  value={rechargeAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value && value >= 1) {
                      setRechargeAmount(value);
                    }
                  }}
                  className="pl-10 pr-4 py-3 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="1.00"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowAmountSelector(false);
                  setRechargeAmount(10);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                onClick={() => {
                  setShowAmountSelector(false);
                  setShowBinanceModal(true);
                }}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {t.language === 'pt' ? 'Continuar' : t.language === 'en' ? 'Continue' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Binance Payment Modal */}
      <BinancePaymentModal
        isOpen={showBinanceModal}
        onClose={() => setShowBinanceModal(false)}
        amount={rechargeAmount}
        onSuccess={() => {
          setShowBinanceModal(false);
          loadBalance();
        }}
      />
    </div>
  );
}
