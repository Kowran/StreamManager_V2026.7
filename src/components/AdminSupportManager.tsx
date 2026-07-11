import React, { useState, useEffect } from 'react';
import { MessageCircle, Search, Filter, Clock, CheckCircle, AlertTriangle, User, Package, Send, Eye, CreditCard as Edit, Trash2, ArrowLeft, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { useNotificationContext } from './NotificationProvider';

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
  support_categories?: {
    name: string;
    icon: string;
    color: string;
  };
  store_products?: {
    name: string;
  };
  store_orders?: {
    id: string;
    total_usdt: number;
    status: string;
  };
  profiles?: {
    email: string;
    full_name?: string;
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

export function AdminSupportManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { addNotification } = useNotificationContext();
  const [activeView, setActiveView] = useState<'list' | 'view'>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Setup real-time subscription for admin support updates
  useEffect(() => {
    if (isAdmin && user) {
      const channel = supabase
        .channel('admin_support_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_tickets'
          },
          (payload) => {
            console.log('New ticket created:', payload.new);
            loadTickets(); // Reload all tickets to get the new one with relations
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'support_tickets'
          },
          (payload) => {
            console.log('Ticket updated:', payload.new);
            loadTickets(); // Reload to get updated data
            
            // Update selected ticket if it's the one being viewed
            if (selectedTicket?.id === payload.new.id) {
              setSelectedTicket(prev => prev ? { ...prev, ...payload.new } : null);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_messages'
          },
          (payload) => {
            console.log('New support message:', payload.new);
            // If viewing the ticket that received a new message, reload messages
            if (selectedTicket?.id === payload.new.ticket_id) {
              loadTicketMessages(selectedTicket.id);
            }
          }
        )
        .subscribe((status) => {
          console.log('Admin support subscription status:', status);
        });

      return () => {
        console.log('Unsubscribing from admin support channel');
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin, user, selectedTicket]);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadTickets();
    }
  }, [isAdmin]);

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
    } finally {
      setLoading(false);
    }
  }

  async function loadTickets() {
    try {
      // First get all tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      if (!ticketsData || ticketsData.length === 0) {
        setTickets([]);
        return;
      }

      // Get user profiles for all tickets
      const userIds = [...new Set(ticketsData.map(ticket => ticket.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
      }

      // Get categories
      const categoryIds = [...new Set(ticketsData.map(ticket => ticket.category_id).filter(Boolean))];
      let categoriesData = [];
      if (categoryIds.length > 0) {
        const { data: cats, error: catsError } = await supabase
          .from('support_categories')
          .select('id, name, icon, color')
          .in('id', categoryIds);
        
        if (!catsError) {
          categoriesData = cats || [];
        }
      }

      // Get products
      const productIds = [...new Set(ticketsData.map(ticket => ticket.product_id).filter(Boolean))];
      let productsData = [];
      if (productIds.length > 0) {
        const { data: prods, error: prodsError } = await supabase
          .from('store_products')
          .select('id, name')
          .in('id', productIds);
        
        if (!prodsError) {
          productsData = prods || [];
        }
      }

      // Get orders
      const orderIds = [...new Set(ticketsData.map(ticket => ticket.order_id).filter(Boolean))];
      let ordersData = [];
      if (orderIds.length > 0) {
        const { data: orders, error: ordersError } = await supabase
          .from('store_orders')
          .select('id, total_usdt, status')
          .in('id', orderIds);
        
        if (!ordersError) {
          ordersData = orders || [];
        }
      }

      // Combine all data
      const enrichedTickets = ticketsData.map(ticket => ({
        ...ticket,
        profiles: profilesData?.find(p => p.id === ticket.user_id),
        support_categories: categoriesData.find(c => c.id === ticket.category_id),
        store_products: productsData.find(p => p.id === ticket.product_id),
        store_orders: ordersData.find(o => o.id === ticket.order_id)
      }));

      setTickets(enrichedTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setTickets([]);
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

      // Get sender profiles
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

      // Combine messages with profile data
      const enrichedMessages = messagesData.map(message => ({
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

  async function updateTicketStatus(ticketId: string, newStatus: string) {
    setUpdatingStatus(true);
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Set assigned_to if moving to in_progress
      if (newStatus === 'in_progress' && user) {
        updateData.assigned_to = user.id;
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      await loadTickets();
      
      // Update selected ticket if viewing
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: newStatus as any, assigned_to: updateData.assigned_to } : null);
      }

      // Status change notification will be created automatically by database trigger

    } catch (error) {
      console.error('Error updating ticket status:', error);
      alert('Erro ao atualizar status do ticket');
    } finally {
      setUpdatingStatus(false);
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
            sender_role: 'admin',
            sent_via: 'admin_interface'
          }
        }]);

      if (error) throw error;

      setNewMessage('');
      await loadTicketMessages(selectedTicket.id);

      // Update ticket status if it was resolved
      if (selectedTicket.status === 'resolved') {
        await supabase
          .from('support_tickets')
          .update({ 
            status: 'in_progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedTicket.id);
        
        setSelectedTicket(prev => prev ? { ...prev, status: 'in_progress' } : null);
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
      ticket.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
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
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Andamento';
      case 'waiting_user': return 'Aguardando Usuário';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  }

  function getPriorityLabel(priority: string) {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Acesso Restrito</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Apenas administradores podem acessar o gerenciamento de suporte.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Ticket List View
  if (activeView === 'list') {
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      waitingUser: tickets.filter(t => t.status === 'waiting_user').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      urgent: tickets.filter(t => t.priority === 'urgent').length
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciar Suporte</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Gerencie todos os tickets de suporte dos usuários
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <MessageCircle className="h-5 w-5 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Abertos</p>
                <p className="text-xl font-bold text-blue-600">{stats.open}</p>
              </div>
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Em Andamento</p>
                <p className="text-xl font-bold text-yellow-600">{stats.inProgress}</p>
              </div>
              <UserCheck className="h-5 w-5 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Aguardando</p>
                <p className="text-xl font-bold text-purple-600">{stats.waitingUser}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-purple-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Resolvidos</p>
                <p className="text-xl font-bold text-green-600">{stats.resolved}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Urgentes</p>
                <p className="text-xl font-bold text-red-600">{stats.urgent}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Buscar tickets por número, assunto, usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Todos os Status</option>
              <option value="open">Aberto</option>
              <option value="in_progress">Em Andamento</option>
              <option value="waiting_user">Aguardando Usuário</option>
              <option value="resolved">Resolvido</option>
              <option value="closed">Fechado</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Todas as Prioridades</option>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Prioridade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Criado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-mono text-blue-600 dark:text-blue-400">
                          #{ticket.ticket_number}
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.subject}
                        </div>
                        {ticket.support_categories && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                            <span className="mr-1">{ticket.support_categories.icon}</span>
                            {ticket.support_categories.name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {ticket.profiles?.full_name || 'Usuário'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {ticket.profiles?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                        {getPriorityLabel(ticket.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div>
                        {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(ticket.created_at).toLocaleTimeString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setActiveView('view');
                          loadTicketMessages(ticket.id);
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {filteredTickets.map((ticket) => (
            <div key={ticket.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-mono text-blue-600 dark:text-blue-400">
                      #{ticket.ticket_number}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1">
                    {ticket.subject}
                  </h3>
                  <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{ticket.profiles?.full_name || 'Usuário'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setActiveView('view');
                    loadTicketMessages(ticket.id);
                  }}
                  className="ml-3 inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm touch-manipulation"
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  <span>Abrir</span>
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                    {getPriorityLabel(ticket.priority)}
                  </span>
                  {ticket.support_categories && (
                    <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{ticket.support_categories.icon}</span>
                      <span>{ticket.support_categories.name}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {ticket.profiles?.email}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredTickets.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
                ? 'Nenhum ticket encontrado' 
                : 'Nenhum ticket de suporte'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Aguardando usuários criarem tickets de suporte'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Ticket View
  if (activeView === 'view' && selectedTicket) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setActiveView('list')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Ticket #{selectedTicket.ticket_number}
              </h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                {getStatusLabel(selectedTicket.status)}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                {getPriorityLabel(selectedTicket.priority)}
              </span>
            </div>
            <h3 className="text-lg text-gray-700 dark:text-gray-300">{selectedTicket.subject}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Por: {selectedTicket.profiles?.full_name || selectedTicket.profiles?.email}
            </p>
          </div>
          
          {/* Status Actions */}
          <div className="flex items-center space-x-2">
            {selectedTicket.status === 'open' && (
              <button
                onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                disabled={updatingStatus}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg transition-colors"
              >
                Assumir
              </button>
            )}
            {(selectedTicket.status === 'in_progress' || selectedTicket.status === 'waiting_user') && (
              <button
                onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                disabled={updatingStatus}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-colors"
              >
                Resolver
              </button>
            )}
            {selectedTicket.status === 'resolved' && (
              <button
                onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                disabled={updatingStatus}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors"
              >
                Fechar
              </button>
            )}
          </div>
        </div>

        {/* Ticket Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição Original</h4>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Detalhes do Ticket</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Usuário:</span>
                    <span className="text-gray-900 dark:text-white">
                      {selectedTicket.profiles?.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Criado:</span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(selectedTicket.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Atualizado:</span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(selectedTicket.updated_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {selectedTicket.support_categories && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Categoria:</span>
                      <span className="text-gray-900 dark:text-white">
                        {selectedTicket.support_categories.icon} {selectedTicket.support_categories.name}
                      </span>
                    </div>
                  )}
                  {selectedTicket.store_products && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Produto:</span>
                      <span className="text-gray-900 dark:text-white">
                        {selectedTicket.store_products.name}
                      </span>
                    </div>
                  )}
                  {selectedTicket.store_orders && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Pedido:</span>
                      <span className="text-gray-900 dark:text-white">
                        {formatPrice(selectedTicket.store_orders.total_usdt)}
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
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">Conversação</h4>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nenhuma mensagem ainda. Envie a primeira resposta abaixo.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isAdmin = message.profiles?.role === 'admin';
                const isCurrentUser = message.sender_id === user?.id;
                
                let senderName = 'Usuário';
                if (isAdmin) {
                  senderName = message.profiles?.full_name || 'Admin';
                } else {
                  senderName = message.profiles?.full_name || message.profiles?.email?.split('@')[0] || 'Usuário';
                }
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}
                  >
                    <div className={`max-w-xs lg:max-md px-4 py-3 rounded-lg shadow-sm ${
                      isCurrentUser
                        ? 'bg-blue-600 text-white'
                        : isAdmin
                        ? 'bg-green-100 dark:bg-green-900/20 text-gray-900 dark:text-white border border-green-200 dark:border-green-800'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`text-xs font-medium ${
                          isCurrentUser ? 'text-blue-100' : 
                          isAdmin ? 'text-green-700 dark:text-green-400' : 
                          'text-gray-600 dark:text-gray-400'
                        }`}>
                          {isAdmin ? '🛠️' : '👤'} {senderName}
                        </span>
                        {message.is_internal && (
                          <span className="text-xs bg-red-500 text-white px-1 rounded">
                            Interno
                          </span>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                      <p className={`text-xs mt-2 ${
                        isCurrentUser ? 'text-blue-100' : 
                        isAdmin ? 'text-green-600 dark:text-green-500' : 
                        'text-gray-500 dark:text-gray-400'
                      }`}>
                        {new Date(message.created_at).toLocaleString('pt-BR')}
                        {message.is_read && !isCurrentUser && (
                          <span className="ml-2">✓ Lida</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Admin Message Input */}
          {selectedTicket.status !== 'closed' && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {selectedTicket.status === 'resolved' && (
                <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mr-2" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-400">
                      Ticket marcado como resolvido. Enviar mensagem irá reabri-lo como "Em Andamento".
                    </span>
                  </div>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="space-y-3">
                <textarea
                  rows={4}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder={selectedTicket.status === 'resolved' 
                    ? "Digite sua resposta para reabrir o ticket..."
                    : "Digite sua resposta ao usuário..."
                  }
                  disabled={sendingMessage}
                />
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    💡 {selectedTicket.status === 'resolved' 
                      ? 'Responder irá reabrir o ticket automaticamente'
                      : 'Dica: Seja claro e prestativo na sua resposta'
                    }
                  </div>
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendingMessage}
                    className={`px-4 py-2 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center space-x-2 ${
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
                    <span>{selectedTicket.status === 'resolved' ? 'Reabrir e Responder' : 'Enviar Resposta'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}