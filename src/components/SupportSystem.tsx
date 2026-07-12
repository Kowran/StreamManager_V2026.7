import React, { useState, useEffect } from 'react';
import { MessageCircle, Plus, Search, Clock, CheckCircle, AlertTriangle, ArrowLeft, Send, Eye, User, Package, Calendar, HelpCircle, CreditCard, Settings, Shield } from 'lucide-react';
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

    return matchesSearch && matchesStatus;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {t.language === 'pt' ? 'Central de Suporte' :
             t.language === 'en' ? 'Support Center' :
             'Centro de Soporte'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t.language === 'pt' ? 'Gerencie seus tickets de suporte e obtenha ajuda da nossa equipe' :
             t.language === 'en' ? 'Manage your support tickets and get help from our team' :
             'Gestiona tus tickets de soporte y obtén ayuda de nuestro equipo'}
          </p>
        </div>
        <button
          onClick={() => setActiveView('create')}
          className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm touch-manipulation"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t.language === 'pt' ? 'Novo Ticket' : t.language === 'en' ? 'New Ticket' : 'Nuevo Ticket'}
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">{t.totalTickets}</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{tickets.length}</p>
            </div>
            <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">{t.openTickets}</p>
              <p className="text-lg sm:text-xl font-bold text-blue-600">{tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length}</p>
            </div>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">{t.language === 'pt' ? 'Aguardando' : t.language === 'en' ? 'Waiting' : 'Esperando'}</p>
              <p className="text-lg sm:text-xl font-bold text-purple-600">{tickets.filter(t => t.status === 'waiting_user').length}</p>
            </div>
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">{t.resolvedTickets}</p>
              <p className="text-lg sm:text-xl font-bold text-green-600">{tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}</p>
            </div>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
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
                className="pl-10 pr-4 py-2.5 sm:py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base touch-manipulation"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
          >
            <option value="all">{t.allStatuses}</option>
            <option value="open">{t.open}</option>
            <option value="in_progress">{t.inProgress}</option>
            <option value="waiting_user">{t.waitingUser}</option>
            <option value="resolved">{t.resolved}</option>
            <option value="closed">{t.closed}</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <MessageCircle className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white px-4">
              {searchTerm || statusFilter !== 'all' ? t.noTicketsFound : t.noSupportTickets}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-4">
              {searchTerm || statusFilter !== 'all'
                ? t.adjustSearchFilters
                : (t.language === 'pt' ? 'Crie seu primeiro ticket para obter ajuda da nossa equipe' :
                   t.language === 'en' ? 'Create your first ticket to get help from our team' :
                   'Crea tu primer ticket para obtener ayuda de nuestro equipo')
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => setActiveView('create')}
                className="mt-4 inline-flex items-center px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors touch-manipulation"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t.createFirstTicket}
              </button>
            )}
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div key={ticket.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md transition-shadow touch-manipulation">
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
                  
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
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
                  className="w-full sm:w-auto sm:ml-4 inline-flex items-center justify-center px-3 py-2.5 sm:py-2 border border-transparent text-sm font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {t.language === 'pt' ? 'Ver Detalhes' : t.language === 'en' ? 'View Details' : 'Ver Detalles'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Level System Help */}
      <LevelSystemHelp language={t.language} />

      {/* Help Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-semibold mb-2">{t.needQuickHelp}</h3>
            <p className="text-blue-100 text-xs sm:text-sm mb-4">
              {t.contactWhatsAppDirect}
            </p>
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
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                window.open(whatsappUrl, '_blank');
              }}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 sm:py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 touch-manipulation"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{t.talkOnWhatsApp}</span>
            </button>
          </div>
          <div className="hidden lg:block">
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <MessageCircle className="h-8 w-8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LevelSystemHelp({ language }: { language: string }) {
  const pt = language === 'pt';
  const en = language === 'en';

  const tiers = [
    { range: '1-49', name: pt ? 'Iniciante' : en ? 'Beginner' : 'Principiante', color: '#6b7280' },
    { range: '50-99', name: pt ? 'Intermediário' : en ? 'Intermediate' : 'Intermedio', color: '#06b6d4' },
    { range: '100-299', name: pt ? 'Avançado' : en ? 'Advanced' : 'Avanzado', color: '#10b981' },
    { range: '300-499', name: pt ? 'Veterano' : en ? 'Veteran' : 'Veterano', color: '#3b82f6' },
    { range: '500-699', name: 'Elite', color: '#8b5cf6' },
    { range: '700-899', name: pt ? 'Mestre' : en ? 'Master' : 'Maestro', color: '#ef4444' },
    { range: '900-1000', name: pt ? 'Lendário' : en ? 'Legendary' : 'Legendario', color: '#f59e0b' },
  ];

  const milestones = [
    { level: 1, xp: 0, label: pt ? 'Início da jornada' : en ? 'Journey begins' : 'Inicio del viaje' },
    { level: 10, xp: 100, label: pt ? 'Primeiros passos' : en ? 'First steps' : 'Primeros pasos' },
    { level: 50, xp: 1626, label: pt ? 'Intermediário' : en ? 'Intermediate' : 'Intermedio' },
    { level: 100, xp: 6310, label: pt ? 'Avançado' : en ? 'Advanced' : 'Avanzado' },
    { level: 250, xp: 27855, label: pt ? 'Veterano' : en ? 'Veteran' : 'Veterano' },
    { level: 500, xp: 110200, label: 'Elite' },
    { level: 750, xp: 244866, label: pt ? 'Mestre' : en ? 'Master' : 'Maestro' },
    { level: 1000, xp: 447100, label: pt ? 'Lendário' : en ? 'Legendary' : 'Legendario' },
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
            ? 'Quanto mais você compra e vende, mais sobe de nível. Alcance o nível máximo de 1000!'
            : en
            ? 'The more you buy and sell, the higher your level. Reach the maximum level of 1000!'
            : 'Cuanto más compras y vendes, más subes de nivel. ¡Alcanza el nivel máximo de 1000!'}
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
                  ? 'Ganhe 15 XP por cada dólar em vendas concluídas. Vendedores ganham mais XP por venda.'
                  : en
                  ? 'Earn 15 XP for each dollar in completed sales. Sellers earn more XP per sale.'
                  : 'Gana 15 XP por cada dólar en ventas completadas. Los vendedores ganan más XP por venta.'}
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
              ? 'A curva é exponencial: cada nível requer mais XP que o anterior. A fórmula é 100 × (nível - 1)^1.8.'
              : en
              ? 'The curve is exponential: each level requires more XP than the last. The formula is 100 × (level - 1)^1.8.'
              : 'La curva es exponencial: cada nivel requiere más XP que el anterior. La fórmula es 100 × (nivel - 1)^1.8.'}
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
              50 × 10 XP = 500 XP → {pt ? 'Nível' : en ? 'Level' : 'Nivel'} 6
            </p>
            <p className="pt-1">
              {pt ? 'Um vendedor que vendeu $200:' : en ? 'A seller who sold $200:' : 'Un vendedor que vendió $200:'}
            </p>
            <p className="font-mono text-gray-900 dark:text-white pl-4">
              200 × 15 XP = 3000 XP → {pt ? 'Nível' : en ? 'Level' : 'Nivel'} 75
            </p>
            <p className="pt-1">
              {pt
                ? 'Para alcançar o nível 1000, um usuário precisaria acumular ~447.100 XP (aproximadamente $44.710 em compras).'
                : en
                ? 'To reach level 1000, a user would need ~447,100 XP (approximately $44,710 in purchases).'
                : 'Para alcanzar el nivel 1000, un usuario necesitaría acumular ~447.100 XP (aproximadamente $44.710 en compras).'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}