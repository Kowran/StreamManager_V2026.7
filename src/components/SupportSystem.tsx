import React, { useState, useEffect } from 'react';
import { MessageCircle, Plus, Search, Clock, CheckCircle, AlertTriangle, ArrowLeft, Send, Eye, User, Package, Calendar, HelpCircle, CreditCard, Settings, Shield, Inbox, TrendingUp, Store, BookOpen, ChevronDown, ChevronRight, Zap, Star, Crown, Award, Flame, ShoppingBag, Info, Lightbulb } from 'lucide-react';
import { LevelBadge, getLevelTier } from './LevelBadge';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useNotificationContext } from './NotificationProvider';

interface SupportCategory {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  active: boolean;
  sort_order: number;
}

interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  category_id?: string;
  product_id?: string;
  order_id?: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  assigned_to?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
  support_categories?: SupportCategory;
  store_products?: {
    name: string;
  };
  store_orders?: {
    id: string;
    total_usdt: number;
    status: string;
  };
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  is_read: boolean;
  read_at?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string;
    full_name?: string;
    role: string;
  };
}

interface StoreProduct {
  id: string;
  name: string;
}

interface StoreOrder {
  id: string;
  total_usdt: number;
  status: string;
  created_at: string;
  store_products?: {
    name: string;
  };
}

export function SupportSystem() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { addNotification } = useNotificationContext();
  const [activeView, setActiveView] = useState<'list' | 'create' | 'view'>('list');
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mainTab, setMainTab] = useState<'tickets' | 'levels' | 'seller' | 'faq'>('tickets');
  const [ticketStatusTab, setTicketStatusTab] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    category_id: '',
    product_id: '',
    order_id: '',
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  });

  // Setup real-time subscription for ticket updates
  useEffect(() => {
    if (user && selectedTicket) {
      const channel = supabase
        .channel(`ticket_messages:${selectedTicket.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_messages',
            filter: `ticket_id=eq.${selectedTicket.id}`
          },
          (payload) => {
            console.log('New message received:', payload.new);
            // Reload messages to get the new one with profile data
            loadTicketMessages(selectedTicket.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'support_tickets',
            filter: `id=eq.${selectedTicket.id}`
          },
          (payload) => {
            console.log('Ticket updated:', payload.new);
            setSelectedTicket(payload.new as SupportTicket);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, selectedTicket]);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  async function loadInitialData() {
    try {
      await Promise.all([
        loadCategories(),
        loadTickets(),
        loadProducts(),
        loadOrders()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from('support_categories')
        .select('*')
        .eq('active', true)
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async function loadTickets() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          support_categories (
            name,
            icon,
            color
          ),
          store_products (
            name
          ),
          store_orders (
            id,
            total_usdt,
            status
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  }

  async function loadProducts() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  async function loadOrders() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('store_orders')
        .select(`
          id,
          total_usdt,
          status,
          created_at,
          store_products (
            name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  }

  async function loadTicketMessages(ticketId: string) {
    try {
      // First get all messages for the ticket
      const { data: messagesData, error: messagesError } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      if (!messagesData || messagesData.length === 0) {
        setMessages([]);
        return;
      }

      // Get sender profiles for all messages
      const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];
      
      // Filter out null or invalid sender IDs
      const validSenderIds = senderIds.filter(id => id && typeof id === 'string');
      
      let profilesData = [];
      if (validSenderIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .in('id', validSenderIds);

        if (profilesError) {
          console.error('Error loading message profiles:', profilesError);
        } else {
          profilesData = profiles || [];
        }
      }

      // Combine messages with profile data and filter out internal messages for users
      const enrichedMessages = messagesData
        .filter(message => !message.is_internal) // Only show non-internal messages to users
        .map(message => ({
          ...message,
          profiles: profilesData?.find(p => p.id === message.sender_id)
        }));

      setMessages(enrichedMessages);

      // Mark messages as read
      if (enrichedMessages && enrichedMessages.length > 0) {
        const unreadMessages = enrichedMessages.filter(m => !m.is_read && m.sender_id !== user?.id);
        if (unreadMessages.length > 0) {
          await supabase
            .from('support_messages')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .in('id', unreadMessages.map(m => m.id));
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setCreatingTicket(true);
    try {
      // Generate a unique ticket number
      const ticketNumber = `TK-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      const { error } = await supabase
        .from('support_tickets')
        .insert([{
          ticket_number: ticketNumber,
          user_id: user.id,
          category_id: ticketForm.category_id || null,
          product_id: ticketForm.product_id || null,
          order_id: ticketForm.order_id || null,
          subject: ticketForm.subject,
          description: ticketForm.description,
          priority: ticketForm.priority,
          status: 'open',
          metadata: {
            user_email: user.email,
            created_via: 'user_interface',
            user_agent: navigator.userAgent
          }
        }]);

      if (error) throw error;

      // Reset form
      setTicketForm({
        category_id: '',
        product_id: '',
        order_id: '',
        subject: '',
        description: '',
        priority: 'medium'
      });

      // Reload tickets and go back to list
      await loadTickets();
      setActiveView('list');

      // Create system notification for ticket creation
      await addNotification({
        type: 'system',
        title: '🎫 Ticket Criado!',
        message: 'Seu ticket de suporte foi criado com sucesso. Nossa equipe responderá em breve.',
        data: {
          ticket_number: null,
          action: 'ticket_created'
        },
        priority: 'medium'
      });

    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Erro ao criar ticket. Tente novamente.');
    } finally {
      setCreatingTicket(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedTicket || !newMessage.trim()) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert([{
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          message: newMessage.trim(),
          is_internal: false,
          is_read: false,
          metadata: {
            sender_email: user.email,
            sender_role: 'customer',
            sent_via: 'user_interface'
          }
        }]);

      if (error) throw error;

      setNewMessage('');
      await loadTicketMessages(selectedTicket.id);

      // Update ticket status if it was resolved
      if (selectedTicket.status === 'resolved') {
        await supabase
          .from('support_tickets')
          .update({ status: 'waiting_user' })
          .eq('id', selectedTicket.id);
        
        setSelectedTicket(prev => prev ? { ...prev, status: 'waiting_user' } : null);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setSendingMessage(false);
    }
  }

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

    // Also apply ticketStatusTab filter
    const matchesTab = ticketStatusTab === 'all' ||
      (ticketStatusTab === 'open' && (ticket.status === 'open' || ticket.status === 'waiting_user')) ||
      (ticketStatusTab === 'in_progress' && ticket.status === 'in_progress') ||
      (ticketStatusTab === 'resolved' && (ticket.status === 'resolved' || ticket.status === 'closed'));

    return matchesSearch && matchesStatus && matchesTab;
  });

  function getStatusColor(status: string) {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'waiting_user': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'open': return t.open;
      case 'in_progress': return t.inProgress;
      case 'waiting_user': return t.waitingUser;
      case 'resolved': return t.resolved;
      case 'closed': return t.closed;
      default: return status;
    }
  }

  function getPriorityLabel(priority: string) {
    switch (priority) {
      case 'urgent': return t.urgent;
      case 'high': return t.high;
      case 'medium': return t.medium;
      case 'low': return t.low;
      default: return priority;
    }
  }

  function getCategoryIcon(iconName: string) {
    const iconProps = {
      className: `h-5 w-5 sm:h-6 sm:w-6 ${
        ticketForm.category_id === categories.find(c => c.icon === iconName)?.id
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-gray-600 dark:text-gray-400'
      }`
    };

    switch (iconName) {
      case 'help-circle':
        return <HelpCircle {...iconProps} />;
      case 'credit-card':
        return <CreditCard {...iconProps} />;
      case 'package':
        return <Package {...iconProps} />;
      case 'user':
        return <User {...iconProps} />;
      case 'settings':
        return <Settings {...iconProps} />;
      case 'shield':
        return <Shield {...iconProps} />;
      case 'bug':
        return <AlertTriangle {...iconProps} />;
      case 'message-circle':
        return <MessageCircle {...iconProps} />;
      default:
        return <HelpCircle {...iconProps} />;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Create Ticket View
  if (activeView === 'create') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => setActiveView('list')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Criar Ticket de Suporte</h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              Descreva seu problema e nossa equipe ajudará você
            </p>
          </div>
        </div>

        {/* Create Ticket Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <form onSubmit={handleCreateTicket} className="space-y-4 sm:space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
                {t.problemCategory}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setTicketForm(prev => ({ ...prev, category_id: category.id }))}
                    className={`p-3 sm:p-4 border-2 rounded-lg text-left transition-all duration-200 touch-manipulation ${
                      ticketForm.category_id === category.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className={`p-2 sm:p-3 rounded-lg ${
                        ticketForm.category_id === category.id
                          ? 'bg-blue-100 dark:bg-blue-800/30'
                          : 'bg-gray-100 dark:bg-gray-600'
                      }`}>
                        {getCategoryIcon(category.icon)}
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{category.name}</h3>
                        {category.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 line-clamp-2">
                            {category.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Product/Order Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.relatedProduct} ({t.language === 'pt' ? 'Opcional' : t.language === 'en' ? 'Optional' : 'Opcional'})
                </label>
                <select
                  value={ticketForm.product_id}
                  onChange={(e) => setTicketForm(prev => ({ ...prev, product_id: e.target.value }))}
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
                >
                  <option value="">{t.selectProduct}</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.relatedOrder} ({t.language === 'pt' ? 'Opcional' : t.language === 'en' ? 'Optional' : 'Opcional'})
                </label>
                <select
                  value={ticketForm.order_id}
                  onChange={(e) => setTicketForm(prev => ({ ...prev, order_id: e.target.value }))}
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
                >
                  <option value="">{t.selectOrder}</option>
                  {orders.map(order => (
                    <option key={order.id} value={order.id}>
                      {order.store_products?.name || (t.language === 'pt' ? 'Pedido' : t.language === 'en' ? 'Order' : 'Pedido')} - ${order.total_usdt.toFixed(2)} ({new Date(order.created_at).toLocaleDateString(
                        t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                      )})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.subject} *
              </label>
              <input
                type="text"
                required
                value={ticketForm.subject}
                onChange={(e) => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base touch-manipulation"
                placeholder={t.describeIssue}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.priority}
              </label>
              <select
                value={ticketForm.priority}
                onChange={(e) => setTicketForm(prev => ({ ...prev, priority: e.target.value as any }))}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
              >
                <option value="low">{t.lowPriority}</option>
                <option value="medium">{t.mediumPriority}</option>
                <option value="high">{t.highPriority}</option>
                <option value="urgent">{t.urgentPriority}</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.detailedDescription} *
              </label>
              <textarea
                rows={4}
                required
                value={ticketForm.description}
                onChange={(e) => setTicketForm(prev => ({ ...prev, description: e.target.value }))}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base touch-manipulation resize-none"
                placeholder={
                  t.language === 'pt' ? 'Descreva seu problema em detalhes. Inclua:&#10;- O que você estava tentando fazer&#10;- O que aconteceu&#10;- Mensagens de erro (se houver)&#10;- Passos para reproduzir o problema' :
                  t.language === 'en' ? 'Describe your problem in detail. Include:&#10;- What you were trying to do&#10;- What happened&#10;- Error messages (if any)&#10;- Steps to reproduce the problem' :
                  'Describe tu problema en detalle. Incluye:&#10;- Lo que estabas tratando de hacer&#10;- Lo que pasó&#10;- Mensajes de error (si los hay)&#10;- Pasos para reproducir el problema'
                }
              />
              <p className="mt-1 sm:mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t.language === 'pt' ? 'Quanto mais detalhes você fornecer, mais rápido poderemos ajudar você.' :
                 t.language === 'en' ? 'The more details you provide, the faster we can help you.' :
                 'Cuantos más detalles proporciones, más rápido podremos ayudarte.'}
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors touch-manipulation"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={creatingTicket || !ticketForm.subject.trim() || !ticketForm.description.trim()}
                className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center space-x-2 touch-manipulation"
              >
                {creatingTicket ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t.creating}</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" />
                    <span>{t.createTicket}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // View Ticket
  if (activeView === 'view' && selectedTicket) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => setActiveView('list')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3 mb-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {t.language === 'pt' ? 'Ticket' : t.language === 'en' ? 'Ticket' : 'Ticket'} #{selectedTicket.ticket_number}
              </h2>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                  {getStatusLabel(selectedTicket.status)}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                  {getPriorityLabel(selectedTicket.priority)}
                </span>
              </div>
            </div>
            <h3 className="text-base sm:text-lg text-gray-700 dark:text-gray-300 line-clamp-2">{selectedTicket.subject}</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {t.language === 'pt' ? 'Criado em' : t.language === 'en' ? 'Created on' : 'Creado el'} {new Date(selectedTicket.created_at).toLocaleDateString(
                t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
              )} {t.language === 'pt' ? 'às' : t.language === 'en' ? 'at' : 'a las'} {new Date(selectedTicket.created_at).toLocaleTimeString(
                t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
              )}
            </p>
          </div>
        </div>

        {/* Ticket Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 order-2 lg:order-1">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.originalDescription}</h4>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4">
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                  {selectedTicket.description}
                </p>
              </div>
            </div>
            
            <div className="space-y-3 sm:space-y-4 order-1 lg:order-2">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ticketDetails}</h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                      {getStatusLabel(selectedTicket.status)}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t.priority}:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                      {getPriorityLabel(selectedTicket.priority)}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t.language === 'pt' ? 'Criado:' : t.language === 'en' ? 'Created:' : 'Creado:'}:</span>
                    <span className="text-gray-900 dark:text-white text-xs sm:text-sm">
                      {new Date(selectedTicket.created_at).toLocaleDateString(
                        t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t.language === 'pt' ? 'Atualizado:' : t.language === 'en' ? 'Updated:' : 'Actualizado:'}:</span>
                    <span className="text-gray-900 dark:text-white text-xs sm:text-sm">
                      {new Date(selectedTicket.updated_at).toLocaleDateString(
                        t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                      )}
                    </span>
                  </div>
                  {selectedTicket.support_categories && (
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t.category}:</span>
                      <span className="text-gray-900 dark:text-white text-xs sm:text-sm">
                        {selectedTicket.support_categories.icon} {selectedTicket.support_categories.name}
                      </span>
                    </div>
                  )}
                  {selectedTicket.store_products && (
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t.product}:</span>
                      <span className="text-gray-900 dark:text-white text-xs sm:text-sm">
                        {selectedTicket.store_products.name}
                      </span>
                    </div>
                  )}
                  {selectedTicket.store_orders && (
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t.language === 'pt' ? 'Pedido:' : t.language === 'en' ? 'Order:' : 'Pedido:'}:</span>
                      <span className="text-gray-900 dark:text-white text-xs sm:text-sm">
                        ${selectedTicket.store_orders.total_usdt.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">{t.conversation}</h4>
          </div>
          
          <div className="p-3 sm:p-4 max-h-80 sm:max-h-96 overflow-y-auto space-y-3 sm:space-y-4">
            {/* No outside contact warning */}
            <div className="flex items-start gap-2 px-3 py-2 mb-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                {t.language === 'pt'
                  ? 'Proibido compartilhar contatos externos (WhatsApp, email, redes sociais). Toda comunicação deve ser pelo chat do site.'
                  : t.language === 'en'
                  ? 'Sharing external contacts (WhatsApp, email, social media) is prohibited. All communication must stay on the site chat.'
                  : 'Prohibido compartir contactos externos (WhatsApp, email, redes sociales). Toda comunicación debe ser por el chat del sitio.'}
              </p>
            </div>
            {messages.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <MessageCircle className="mx-auto h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mb-2" />
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {selectedTicket.status === 'open' 
                    ? t.waitingSupport
                    : t.noMessagesYet
                  }
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isAdmin = message.profiles?.role === 'admin';
                const isCurrentUser = message.sender_id === user?.id;
                
                let senderName = 'Usuário';
                if (isAdmin) {
                  senderName = message.profiles?.full_name || 'Equipe de Suporte';
                } else if (isCurrentUser) {
                  senderName = 'Você';
                } else {
                  senderName = message.profiles?.full_name || message.profiles?.email?.split('@')[0] || 'Usuário';
                }
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-3 sm:mb-4`}
                  >
                    <div className={`max-w-xs sm:max-w-sm lg:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-sm ${
                      isCurrentUser
                        ? 'bg-blue-600 text-white'
                        : isAdmin
                        ? 'bg-green-100 dark:bg-green-900/20 text-gray-900 dark:text-white border border-green-200 dark:border-green-800'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}>
                      <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                        <span className={`text-xs font-medium ${
                          isCurrentUser ? 'text-blue-100' : 
                          isAdmin ? 'text-green-700 dark:text-green-400' : 
                          'text-gray-600 dark:text-gray-400'
                        }`}>
                          {isAdmin ? '🛠️' : isCurrentUser ? '👤' : '👤'} {senderName}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.message}</p>
                      <p className={`text-xs mt-2 ${
                        isCurrentUser ? 'text-blue-100' : 
                        isAdmin ? 'text-green-600 dark:text-green-500' : 
                        'text-gray-500 dark:text-gray-400'
                      }`}>
                        {new Date(message.created_at).toLocaleString(
                          t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                        )}
                        {message.is_read && !isCurrentUser && (
                          <span className="ml-2">✓ {t.language === 'pt' ? 'Lida' : t.language === 'en' ? 'Read' : 'Leída'}</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message Input */}
          {selectedTicket.status !== 'closed' && (
            <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
              {selectedTicket.status === 'resolved' && (
                <div className="mb-3 sm:mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                    <span className="text-xs sm:text-sm text-green-700 dark:text-green-400">
                      {t.ticketResolved}
                    </span>
                  </div>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="space-y-2 sm:space-y-3">
                <textarea
                  rows={2}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base touch-manipulation resize-none"
                  placeholder={selectedTicket.status === 'resolved' 
                    ? (t.language === 'pt' ? 'Digite sua mensagem para reabrir o ticket...' :
                       t.language === 'en' ? 'Type your message to reopen the ticket...' :
                       'Escribe tu mensaje para reabrir el ticket...')
                    : (t.language === 'pt' ? 'Digite sua mensagem...' :
                       t.language === 'en' ? 'Type your message...' :
                       'Escribe tu mensaje...')
                  }
                  disabled={sendingMessage}
                />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400 order-2 sm:order-1">
                    💡 {selectedTicket.status === 'resolved' 
                      ? t.sendingMessageWillReopen
                      : t.ourTeamResponds
                    }
                  </div>
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendingMessage}
                    className={`w-full sm:w-auto px-4 py-2.5 sm:py-2 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center space-x-2 touch-manipulation order-1 sm:order-2 ${
                      selectedTicket.status === 'resolved'
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {sendingMessage ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>{selectedTicket.status === 'resolved' ? t.reopenAndSend : t.sendMessage}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tickets List View
  return (
    <div className="w-full mx-auto space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 dark:from-blue-700 dark:via-blue-800 dark:to-cyan-800 p-5 sm:p-7 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {t.language === 'pt' ? 'Central de Ajuda' : t.language === 'en' ? 'Help Center' : 'Centro de Ayuda'}
            </h2>
            <p className="text-sm text-blue-100 mt-1.5 max-w-md">
              {t.language === 'pt' ? 'Gerencie seus tickets, entenda os níveis e saiba mais sobre vender na plataforma.' :
               t.language === 'en' ? 'Manage your tickets, understand the level system, and learn about selling.' :
               'Gestiona tus tickets, entiende el sistema de niveles y aprende sobre vender.'}
            </p>
          </div>
          <button
            onClick={() => setActiveView('create')}
            className="shrink-0 inline-flex items-center justify-center px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 font-semibold rounded-xl transition-all shadow-md touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t.language === 'pt' ? 'Novo Ticket' : t.language === 'en' ? 'New Ticket' : 'Nuevo Ticket'}
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1">
        {([
          { id: 'tickets' as const, icon: Inbox, label: t.language === 'pt' ? 'Tickets' : t.language === 'en' ? 'Tickets' : 'Tickets' },
          { id: 'levels' as const, icon: TrendingUp, label: t.language === 'pt' ? 'Níveis' : t.language === 'en' ? 'Levels' : 'Niveles' },
          { id: 'seller' as const, icon: Store, label: t.language === 'pt' ? 'Vendedor' : t.language === 'en' ? 'Seller' : 'Vendedor' },
          { id: 'faq' as const, icon: BookOpen, label: 'FAQ' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              mainTab === tab.id
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TICKETS TAB ===== */}
      {mainTab === 'tickets' && (
        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.totalTickets}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{tickets.length}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Inbox className="h-4 w-4 text-blue-500" />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.openTickets}</p>
                  <p className="text-lg font-bold text-blue-600">{tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-blue-500" />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.language === 'pt' ? 'Aguardando' : t.language === 'en' ? 'Waiting' : 'Esperando'}</p>
                  <p className="text-lg font-bold text-purple-600">{tickets.filter(t => t.status === 'waiting_user').length}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-purple-500" />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.resolvedTickets}</p>
                  <p className="text-lg font-bold text-green-600">{tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tabs for ticket status */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {([
              { id: 'all' as const, label: t.language === 'pt' ? 'Todos' : t.language === 'en' ? 'All' : 'Todos', count: tickets.length, color: 'gray' },
              { id: 'open' as const, label: t.language === 'pt' ? 'Abertos' : t.language === 'en' ? 'Open' : 'Abiertos', count: tickets.filter(t => t.status === 'open' || t.status === 'waiting_user').length, color: 'blue' },
              { id: 'in_progress' as const, label: t.language === 'pt' ? 'Em Andamento' : t.language === 'en' ? 'In Progress' : 'En Progreso', count: tickets.filter(t => t.status === 'in_progress').length, color: 'yellow' },
              { id: 'resolved' as const, label: t.language === 'pt' ? 'Resolvidos' : t.language === 'en' ? 'Resolved' : 'Resueltos', count: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length, color: 'green' },
            ]).map(stab => {
              const active = ticketStatusTab === stab.id;
              const colorMap: Record<string, string> = {
                gray: active ? 'bg-gray-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                blue: active ? 'bg-blue-600 text-white' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                yellow: active ? 'bg-yellow-500 text-white' : 'text-yellow-600 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
                green: active ? 'bg-green-600 text-white' : 'text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20',
              };
              return (
                <button
                  key={stab.id}
                  onClick={() => { setTicketStatusTab(stab.id); setStatusFilter('all'); }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${colorMap[stab.color]}`}
                >
                  {stab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {stab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder={
                t.language === 'pt' ? 'Buscar tickets por assunto, número...' :
                t.language === 'en' ? 'Search tickets by subject, number...' :
                'Buscar tickets por asunto, número...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm touch-manipulation"
            />
          </div>

          {/* Tickets List */}
          <div className="space-y-3">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                  <Inbox className="h-7 w-7 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white px-4">
                  {searchTerm || statusFilter !== 'all' || ticketStatusTab !== 'all' ? t.noTicketsFound : t.noSupportTickets}
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 px-4">
                  {searchTerm || statusFilter !== 'all' || ticketStatusTab !== 'all'
                    ? t.adjustSearchFilters
                    : (t.language === 'pt' ? 'Crie seu primeiro ticket para obter ajuda da nossa equipe' :
                       t.language === 'en' ? 'Create your first ticket to get help from our team' :
                       'Crea tu primer ticket para obtener ayuda de nuestro equipo')
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && ticketStatusTab === 'all' && (
                  <button
                    onClick={() => setActiveView('create')}
                    className="mt-4 inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors touch-manipulation"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t.createFirstTicket}
                  </button>
                )}
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <div key={ticket.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all touch-manipulation">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3 mb-2">
                        <span className="text-xs sm:text-sm font-mono text-blue-600 dark:text-blue-400">
                          #{ticket.ticket_number}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                            {getStatusLabel(ticket.status)}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                            {getPriorityLabel(ticket.priority)}
                          </span>
                        </div>
                      </div>
                      
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {ticket.subject}
                      </h3>
                      
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                        {ticket.description}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {t.language === 'pt' ? 'Criado em' : t.language === 'en' ? 'Created on' : 'Creado el'} {new Date(ticket.created_at).toLocaleDateString(
                              t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                            )}
                          </span>
                        </div>
                        {ticket.support_categories && (
                          <div className="flex items-center space-x-1">
                            <span>{ticket.support_categories.icon}</span>
                            <span>{ticket.support_categories.name}</span>
                          </div>
                        )}
                        {ticket.store_products && (
                          <div className="flex items-center space-x-1">
                            <Package className="h-3 w-3" />
                            <span>{ticket.store_products.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setActiveView('view');
                        loadTicketMessages(ticket.id);
                      }}
                      className="w-full sm:w-auto sm:ml-4 inline-flex items-center justify-center px-3 py-2.5 border border-transparent text-sm font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {t.language === 'pt' ? 'Ver Detalhes' : t.language === 'en' ? 'View Details' : 'Ver Detalles'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* WhatsApp contact */}
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex-1">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  {t.needQuickHelp}
                </h3>
                <p className="text-green-100 text-xs sm:text-sm mt-1">
                  {t.contactWhatsAppDirect}
                </p>
              </div>
              <button
                onClick={() => {
                  const phoneNumber = '5584996105167';
                  const message = encodeURIComponent(
                    t.language === 'pt' 
                      ? `Olá! Preciso de ajuda com a plataforma StreamManager.\n\nMeu email: ${user?.email}\n\nDescreva seu problema aqui...`
                      : t.language === 'en'
                      ? `Hello! I need help with the StreamManager platform.\n\nMy email: ${user?.email}\n\nDescribe your problem here...`
                      : `¡Hola! Necesito ayuda con la plataforma StreamManager.\n\nMi email: ${user?.email}\n\nDescribe tu problema aquí...`
                  );
                  window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
                }}
                className="shrink-0 bg-white text-green-700 hover:bg-green-50 font-semibold py-2.5 px-5 rounded-xl transition-colors flex items-center justify-center space-x-2 touch-manipulation"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{t.talkOnWhatsApp}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LEVELS TAB ===== */}
      {mainTab === 'levels' && (
        <LevelSystemHelp language={t.language} />
      )}

      {/* ===== SELLER TAB ===== */}
      {mainTab === 'seller' && (
        <SellerInfoHelp language={t.language} />
      )}

      {/* ===== FAQ TAB ===== */}
      {mainTab === 'faq' && (
        <FaqHelp language={t.language} />
      )}
    </div>
  );
}

function SellerInfoHelp({ language }: { language: string }) {
  const pt = language === 'pt';
  const en = language === 'en';
  const lbl = (p: string, e: string, s: string) => (pt ? p : en ? e : s);

  const steps = [
    { icon: Store, title: lbl('Registre-se', 'Sign Up', 'Regístrate'), desc: lbl('Crie sua conta e faça login na plataforma.', 'Create your account and log in to the platform.', 'Crea tu cuenta e inicia sesión en la plataforma.') },
    { icon: BookOpen, title: lbl('Solicite acesso', 'Request Access', 'Solicita acceso'), desc: lbl('Vá em Meu Perfil e clique em "Solicitar permissão para vender".', 'Go to My Profile and click "Request seller permission".', 'Ve a Mi Perfil y haz clic en "Solicitar permiso para vender".') },
    { icon: Package, title: lbl('Cadastre produtos', 'List Products', 'Registra productos'), desc: lbl('Após aprovação, acesse a aba Vendedor para cadastrar seus produtos.', 'After approval, access the Seller tab to list your products.', 'Tras la aprobación, accede a la pestaña Vendedor para registrar tus productos.') },
    { icon: ShoppingBag, title: lbl('Receba pedidos', 'Receive Orders', 'Recibe pedidos'), desc: lbl('Quando alguém compra, você recebe o pedido e entrega via chat.', 'When someone buys, you receive the order and deliver via chat.', 'Cuando alguien compra, recibes el pedido y entregas vía chat.') },
    { icon: TrendingUp, title: lbl('Suba de nível', 'Level Up', 'Sube de nivel'), desc: lbl('Cada venda concluída gera XP e aumenta seu nível de vendedor.', 'Each completed sale generates XP and increases your seller level.', 'Cada venta completada genera XP y aumenta tu nivel de vendedor.') },
  ];

  const features = [
    { icon: MessageCircle, title: lbl('Chat de entrega', 'Delivery Chat', 'Chat de entrega'), desc: lbl('Comunique-se diretamente com o comprador para entregar credenciais.', 'Communicate directly with the buyer to deliver credentials.', 'Comunícate directamente con el comprador para entregar credenciales.') },
    { icon: Shield, title: lbl('Proteção de disputa', 'Dispute Protection', 'Protección de disputas'), desc: lbl('O sistema de disputas protege tanto vendedor quanto comprador.', 'The dispute system protects both seller and buyer.', 'El sistema de disputas protege tanto al vendedor como al comprador.') },
    { icon: CreditCard, title: lbl('Saque seus ganhos', 'Withdraw Earnings', 'Retira tus ganancias'), desc: lbl('Solicite saques diretamente pela aba Vendedor, com período de retenção.', 'Request withdrawals directly from the Seller tab, with a hold period.', 'Solicita retiros directamente desde la pestaña Vendedor, con período de retención.') },
    { icon: TrendingUp, title: lbl('Comissão automática', 'Automatic Commission', 'Comisión automática'), desc: lbl('A comissão da plataforma é descontada automaticamente de cada venda.', 'The platform commission is automatically deducted from each sale.', 'La comisión de la plataforma se descuenta automáticamente de cada venta.') },
  ];

  return (
    <div className="space-y-4">
      {/* Intro card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{lbl('Seja um Vendedor', 'Become a Seller', 'Conviértete en Vendedor')}</h3>
              <p className="text-sm text-emerald-100 mt-0.5">{lbl('Venda seus produtos digitais na plataforma', 'Sell your digital products on the platform', 'Vende tus productos digitales en la plataforma')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          {lbl('Como começar', 'How to Start', 'Cómo empezar')}
        </h4>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <step.icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                {i < steps.length - 1 && <div className="w-px h-full bg-emerald-200 dark:bg-emerald-800 my-1 min-h-[20px]" />}
              </div>
              <div className="pb-3">
                <h5 className="text-sm font-medium text-gray-900 dark:text-white">{step.title}</h5>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {features.map((f, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <f.icon className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h5 className="text-sm font-medium text-gray-900 dark:text-white">{f.title}</h5>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{f.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tips card */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2 mb-3">
          <Info className="h-4 w-4" />
          {lbl('Dicas para Vender Mais', 'Tips to Sell More', 'Consejos para Vender Más')}
        </h4>
        <ul className="space-y-2 text-xs text-amber-700 dark:text-amber-400">
          <li className="flex items-start gap-2"><CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{lbl('Mantenha imagens de produtos em alta qualidade e descrições claras.', 'Keep product images high quality and descriptions clear.', 'Mantén imágenes de productos en alta calidad y descripciones claras.')}</li>
          <li className="flex items-start gap-2"><CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{lbl('Responda rapidamente no chat de entrega para melhorar suas avaliações.', 'Respond quickly in the delivery chat to improve your ratings.', 'Responde rápidamente en el chat de entrega para mejorar tus reseñas.')}</li>
          <li className="flex items-start gap-2"><CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{lbl('Mantenha estoque atualizado para evitar vendas indisponíveis.', 'Keep stock updated to avoid unavailable sales.', 'Mantén el stock actualizado para evitar ventas no disponibles.')}</li>
          <li className="flex items-start gap-2"><CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{lbl('Use o sistema de níveis para destacar sua reputação como vendedor.', 'Use the level system to highlight your seller reputation.', 'Usa el sistema de niveles para destacar tu reputación como vendedor.')}</li>
        </ul>
      </div>
    </div>
  );
}

function FaqHelp({ language }: { language: string }) {
  const pt = language === 'pt';
  const en = language === 'en';
  const lbl = (p: string, e: string, s: string) => (pt ? p : en ? e : s);

  const faqs = [
    { q: lbl('Como faço uma compra?', 'How do I make a purchase?', '¿Cómo hago una compra?'), a: lbl('Navegue pela Loja, selecione o produto desejado e clique em Comprar. Você será direcionado ao checkout para escolher o método de pagamento.', 'Browse the Store, select the desired product and click Buy. You will be directed to checkout to choose the payment method.', 'Navega por la Tienda, selecciona el producto deseado y haz clic en Comprar. Serás dirigido al checkout para elegir el método de pago.') },
    { q: lbl('Como recebo meu produto após a compra?', 'How do I receive my product after purchase?', '¿Cómo recibo mi producto después de la compra?'), a: lbl('Após a confirmação do pagamento, a entrega é feita via chat direto com o vendedor. Você pode acessar o chat em "Meus Pedidos".', 'After payment confirmation, delivery is made via direct chat with the seller. You can access the chat in "My Orders".', 'Tras la confirmación del pago, la entrega se hace vía chat directo con el vendedor. Puedes acceder al chat en "Mis Pedidos".') },
    { q: lbl('E se o produto não funcionar?', 'What if the product doesn\'t work?', '¿Qué pasa si el producto no funciona?'), a: lbl('Você pode abrir uma disputa no detalhe do pedido. O sistema de disputas conecta você, o vendedor e a administração para resolver o problema.', 'You can open a dispute in the order details. The dispute system connects you, the seller, and admin to resolve the issue.', 'Puedes abrir una disputa en los detalles del pedido. El sistema de disputas te conecta con el vendedor y la administración para resolver el problema.') },
    { q: lbl('Como funciona o sistema de níveis?', 'How does the level system work?', '¿Cómo funciona el sistema de niveles?'), a: lbl('Você ganha XP a cada compra (10 XP/dólar) ou venda (15 XP/dólar). Acumulando XP, você sobe de nível e desbloqueia faixas: Iniciante, Intermediário, Avançado, até Lendário.', 'You earn XP for each purchase (10 XP/dollar) or sale (15 XP/dollar). By accumulating XP, you level up and unlock tiers: Beginner, Intermediate, Advanced, up to Legendary.', 'Ganas XP por cada compra (10 XP/dólar) o venta (15 XP/dólar). Acumulando XP, subes de nivel y desbloqueas rangos: Principiante, Intermedio, Avanzado, hasta Legendario.') },
    { q: lbl('Como me torno vendedor?', 'How do I become a seller?', '¿Cómo me convierto en vendedor?'), a: lbl('Vá em Meu Perfil > Informações e clique em "Solicitar permissão para vender". Após aprovação da administração, você poderá cadastrar produtos.', 'Go to My Profile > Information and click "Request seller permission". After admin approval, you can list products.', 'Ve a Mi Perfil > Información y haz clic en "Solicitar permiso para vender". Tras la aprobación del administrador, podrás registrar productos.') },
    { q: lbl('Quais métodos de pagamento estão disponíveis?', 'What payment methods are available?', '¿Qué métodos de pago están disponibles?'), a: lbl('Suportamos Stripe, PayPal, MercadoPago, Asaas, Cryptomus, Binance e TripleA. A disponibilidade pode variar conforme a configuração do admin.', 'We support Stripe, PayPal, MercadoPago, Asaas, Cryptomus, Binance, and TripleA. Availability may vary based on admin settings.', 'Soportamos Stripe, PayPal, MercadoPago, Asaas, Cryptomus, Binance y TripleA. La disponibilidad puede variar según la configuración del admin.') },
    { q: lbl('Posso sacar meus ganhos de vendedor?', 'Can I withdraw my seller earnings?', '¿Puedo retirar mis ganancias de vendedor?'), a: lbl('Sim! Acesse a aba Vendedor > Saques. Há um período de retenção para segurança antes que o saque seja processado.', 'Yes! Access the Seller tab > Withdrawals. There is a hold period for security before the withdrawal is processed.', '¡Sí! Accede a la pestaña Vendedor > Retiros. Hay un período de retención por seguridad antes de que el retiro sea procesado.') },
    { q: lbl('Como funciona o cashback?', 'How does cashback work?', '¿Cómo funciona el cashback?'), a: lbl('O cashback é creditado automaticamente após a conclusão da compra e pode ser usado em compras futuras como desconto.', 'Cashback is automatically credited after purchase completion and can be used on future purchases as a discount.', 'El cashback se acredita automáticamente tras la finalización de la compra y puede usarse en compras futuras como descuento.') },
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5 text-blue-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">FAQ</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {lbl('Perguntas frequentes sobre a plataforma', 'Frequently asked questions about the platform', 'Preguntas frecuentes sobre la plataforma')}
        </p>
      </div>

      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left touch-manipulation"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white pr-3">{faq.q}</span>
              {openIdx === i
                ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
              }
            </button>
            {openIdx === i && (
              <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LevelSystemHelp({ language }: { language: string }) {
  const pt = language === 'pt';
  const en = language === 'en';

  const tiers = [
    { range: '1-9', name: pt ? 'Iniciante' : en ? 'Beginner' : 'Principiante', color: '#10b981' },
    { range: '10-24', name: pt ? 'Bronze' : en ? 'Bronze' : 'Bronce', color: '#cd7f32' },
    { range: '25-49', name: pt ? 'Prata' : en ? 'Silver' : 'Plata', color: '#94a3b8' },
    { range: '50-99', name: pt ? 'Ouro' : en ? 'Gold' : 'Oro', color: '#f59e0b' },
    { range: '100', name: pt ? 'Diamante' : en ? 'Diamond' : 'Diamante', color: '#3b82f6' },
  ];

  const milestones = [
    { level: 1, xp: 0, label: pt ? 'Início da jornada' : en ? 'Journey begins' : 'Inicio del viaje' },
    { level: 10, xp: 1350, label: pt ? 'Bronze - taxa 4%' : en ? 'Bronze - 4% fee' : 'Bronce - 4% comisión' },
    { level: 25, xp: 5871, label: pt ? 'Prata - taxa 3.5%' : en ? 'Silver - 3.5% fee' : 'Plata - 3.5% comisión' },
    { level: 50, xp: 17146, label: pt ? 'Ouro - taxa 3%' : en ? 'Gold - 3% fee' : 'Oro - 3% comisión' },
    { level: 100, xp: 49250, label: pt ? 'Diamante - taxa 2.5%' : en ? 'Diamond - 2.5% fee' : 'Diamante - 2.5% comisión' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-blue-500" />
          {pt ? 'Sistema de Níveis' : en ? 'Level System' : 'Sistema de Niveles'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {pt
            ? 'Quanto mais você compra e vende, mais sobe de nível. Alcance o nível máximo de 100!'
            : en
            ? 'The more you buy and sell, the higher your level. Reach the maximum level of 100!'
            : 'Cuanto más compras y vendes, más subes de nivel. ¡Alcanza el nivel máximo de 100!'}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* How it works */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {pt ? 'Como funciona' : en ? 'How it works' : 'Cómo funciona'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <LevelBadge level={50} type="user" size="sm" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {pt ? 'Nível de Usuário' : en ? 'User Level' : 'Nivel de Usuario'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {pt
                  ? 'Ganhe 10 XP por cada dólar gasto em compras concluídas. Quanto mais compras, maior seu nível.'
                  : en
                  ? 'Earn 10 XP for each dollar spent on completed purchases. The more you buy, the higher your level.'
                  : 'Gana 10 XP por cada dólar gastado en compras completadas. Cuanto más compras, más alto tu nivel.'}
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <LevelBadge level={50} type="seller" size="sm" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {pt ? 'Nível de Vendedor' : en ? 'Seller Level' : 'Nivel de Vendedor'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {pt
                  ? 'Ganhe 20 XP por cada dólar em vendas concluídas. Vendedores ganham mais XP por venda. Ao subir de nível, a taxa da plataforma diminui: 5% → 4% → 3.5% → 3% → 2.5%.'
                  : en
                  ? 'Earn 20 XP for each dollar in completed sales. Sellers earn more XP per sale. As you level up, the platform fee decreases: 5% → 4% → 3.5% → 3% → 2.5%.'
                  : 'Gana 20 XP por cada dólar en ventas completadas. Los vendedores ganan más XP por venta. Al subir de nivel, la comisión de la plataforma disminuye: 5% → 4% → 3.5% → 3% → 2.5%.'}
              </p>
            </div>
          </div>
        </div>

        {/* Tiers */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {pt ? 'Faixas de Nível' : en ? 'Level Tiers' : 'Rangos de Nivel'}
          </h4>
          <div className="space-y-2">
            {tiers.map((tier) => (
              <div key={tier.range} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{tier.name}</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">Nv {tier.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* XP curve */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {pt ? 'Progressão de XP' : en ? 'XP Progression' : 'Progresión de XP'}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {pt
              ? 'A curva é suave e progressiva: cada nível requer mais XP que o anterior. A fórmula é 50 × (nível - 1)^1.5. Nível máximo: 100.'
              : en
              ? 'The curve is smooth and progressive: each level requires more XP than the last. The formula is 50 × (level - 1)^1.5. Max level: 100.'
              : 'La curva es suave y progresiva: cada nivel requiere más XP que el anterior. La fórmula es 50 × (nivel - 1)^1.5. Nivel máximo: 100.'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {pt ? 'Nível' : en ? 'Level' : 'Nivel'}
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">XP Total</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {pt ? 'Marco' : en ? 'Milestone' : 'Hito'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => {
                  const tier = getLevelTier(m.level);
                  return (
                    <tr key={m.level} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                          <span className="font-medium text-gray-900 dark:text-white">{m.level}</span>
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-gray-600 dark:text-gray-400">
                        {m.xp.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{m.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Example */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {pt ? 'Exemplo Prático' : en ? 'Practical Example' : 'Ejemplo Práctico'}
          </h4>
          <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <p>
              {pt ? 'Um usuário que comprou $50 em produtos:' : en ? 'A user who spent $50 on products:' : 'Un usuario que gastó $50 en productos:'}
            </p>
            <p className="font-mono text-gray-900 dark:text-white pl-4">
              50 × 10 XP = 500 XP → {pt ? 'Nível' : en ? 'Level' : 'Nivel'} 11
            </p>
            <p className="pt-1">
              {pt ? 'Um vendedor que vendeu $200:' : en ? 'A seller who sold $200:' : 'Un vendedor que vendió $200:'}
            </p>
            <p className="font-mono text-gray-900 dark:text-white pl-4">
              200 × 20 XP = 4000 XP → {pt ? 'Nível' : en ? 'Level' : 'Nivel'} 21
            </p>
            <p className="pt-1">
              {pt
                ? 'Para alcançar o nível 100 (Diamante), um vendedor precisaria acumular ~49.250 XP (aproximadamente $2.463 em vendas). Taxa final: apenas 2.5%.'
                : en
                ? 'To reach level 100 (Diamond), a seller would need ~49,250 XP (approximately $2,463 in sales). Final fee: only 2.5%.'
                : 'Para alcanzar el nivel 100 (Diamante), un vendedor necesitaría acumular ~49.250 XP (aproximadamente $2.463 en ventas). Comisión final: solo 2.5%.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}