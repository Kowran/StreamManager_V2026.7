import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Plus, Search, Send, ArrowLeft, Clock, CheckCircle,
  AlertTriangle, User, Package, HelpCircle, CreditCard, Settings,
  Shield, Inbox, ChevronRight, Loader2, X, Paperclip, Filter,
  MessageSquare, Zap, Star, ShoppingBag, Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

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
  support_categories?: { name: string; icon: string; color: string };
  store_products?: { name: string };
  store_orders?: { id: string; total_usdt: number; status: string };
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
  profiles?: { email: string; full_name?: string; role: string };
}

interface StoreProduct { id: string; name: string }
interface StoreOrder {
  id: string;
  total_usdt: number;
  status: string;
  created_at: string;
  store_products?: { name: string };
}

const STATUS_CONFIG: Record<string, { label: string; labelEn: string; labelEs: string; color: string; dot: string }> = {
  open: { label: 'Aberto', labelEn: 'Open', labelEs: 'Abierto', color: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', dot: 'bg-blue-500' },
  in_progress: { label: 'Em Andamento', labelEn: 'In Progress', labelEs: 'En Progreso', color: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', dot: 'bg-amber-500' },
  waiting_user: { label: 'Aguardando Resposta', labelEn: 'Awaiting Reply', labelEs: 'Esperando Respuesta', color: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400', dot: 'bg-violet-500' },
  resolved: { label: 'Resolvido', labelEn: 'Resolved', labelEs: 'Resuelto', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500' },
  closed: { label: 'Fechado', labelEn: 'Closed', labelEs: 'Cerrado', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', dot: 'bg-gray-400' },
};

const PRIORITY_CONFIG: Record<string, { label: string; labelEn: string; labelEs: string; color: string }> = {
  low: { label: 'Baixa', labelEn: 'Low', labelEs: 'Baja', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  medium: { label: 'Média', labelEn: 'Medium', labelEs: 'Media', color: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  high: { label: 'Alta', labelEn: 'High', labelEs: 'Alta', color: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
  urgent: { label: 'Urgente', labelEn: 'Urgent', labelEs: 'Urgente', color: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'help-circle': HelpCircle,
  'credit-card': CreditCard,
  'package': Package,
  'user': User,
  'settings': Settings,
  'shield': Shield,
  'message-circle': MessageCircle,
  'shopping-bag': ShoppingBag,
  'info': Info,
  'zap': Zap,
  'star': Star,
};

function timeAgo(date: string, lang: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
  if (days > 0) return new Date(date).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}min`;
  return lang === 'pt' ? 'agora' : lang === 'es' ? 'ahora' : 'now';
}

function formatDate(date: string, lang: string): string {
  const locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
  return new Date(date).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SupportSystem() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [activeView, setActiveView] = useState<'list' | 'create' | 'view'>('list');
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'waiting_user' | 'resolved'>('all');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [error, setError] = useState('');
  const [ticketForm, setTicketForm] = useState({
    category_id: '',
    product_id: '',
    order_id: '',
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const tr = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'es' ? es : en;

  // Real-time subscription
  useEffect(() => {
    if (user && selectedTicket) {
      const channel = supabase
        .channel(`ticket:${selectedTicket.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${selectedTicket.id}` }, () => loadTicketMessages(selectedTicket.id))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${selectedTicket.id}` }, (payload) => setSelectedTicket(payload.new as SupportTicket))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user, selectedTicket]);

  useEffect(() => {
    if (user) loadInitialData();
  }, [user]);

  async function loadInitialData() {
    try {
      await Promise.all([loadCategories(), loadTickets(), loadProducts(), loadOrders()]);
    } catch (e) { console.error('Load error:', e); }
    finally { setLoading(false); }
  }

  async function loadCategories() {
    const { data } = await supabase.from('support_categories').select('*').eq('active', true).order('sort_order');
    setCategories(data || []);
  }

  async function loadTickets() {
    if (!user) return;
    const { data } = await supabase
      .from('support_tickets')
      .select(`*, support_categories (name, icon, color), store_products (name), store_orders (id, total_usdt, status)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTickets(data || []);
  }

  async function loadProducts() {
    if (!user) return;
    const { data } = await supabase.from('store_products').select('id, name').eq('active', true).order('name');
    setProducts(data || []);
  }

  async function loadOrders() {
    if (!user) return;
    const { data } = await supabase
      .from('store_orders')
      .select(`id, total_usdt, status, created_at, store_products (name)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setOrders(data || []);
  }

  async function loadTicketMessages(ticketId: string) {
    const { data: msgs } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (!msgs || msgs.length === 0) { setMessages([]); return; }
    const senderIds = [...new Set(msgs.map(m => m.sender_id))].filter(Boolean);
    let profiles: { id: string; email: string; full_name?: string; role: string }[] = [];
    if (senderIds.length > 0) {
      const { data: p } = await supabase.from('profiles').select('id, email, full_name, role').in('id', senderIds);
      profiles = p || [];
    }
    const enriched = msgs.filter(m => !m.is_internal).map(m => ({ ...m, profiles: profiles.find(p => p.id === m.sender_id) }));
    setMessages(enriched);

    // Mark admin messages as read
    const unread = enriched.filter(m => !m.is_read && m.sender_id !== user?.id);
    if (unread.length > 0) {
      await supabase.from('support_messages').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unread.map(m => m.id));
    }
  }

  const openTicket = useCallback(async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setActiveView('view');
    await loadTicketMessages(ticket.id);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [user]);

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      setError(tr('Preencha todos os campos obrigatórios', 'Fill in all required fields', 'Complete todos los campos obligatorios'));
      return;
    }
    setCreatingTicket(true);
    setError('');
    try {
      const ticketNumber = `TK-${Date.now().toString().slice(-8)}`;
      const { data, error: insertError } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: ticketNumber,
          user_id: user.id,
          category_id: ticketForm.category_id || null,
          product_id: ticketForm.product_id || null,
          order_id: ticketForm.order_id || null,
          subject: ticketForm.subject.trim(),
          description: ticketForm.description.trim(),
          priority: ticketForm.priority,
          status: 'open',
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Create initial message with the description
      await supabase.from('support_messages').insert({
        ticket_id: data.id,
        sender_id: user.id,
        message: ticketForm.description.trim(),
        is_internal: false,
        is_read: true,
        metadata: { is_initial: true, sender_email: user.email, sender_role: 'customer' },
      });

      setTicketForm({ category_id: '', product_id: '', order_id: '', subject: '', description: '', priority: 'medium' });
      await loadTickets();
      await openTicket(data);
    } catch (err: any) {
      setError(err.message || tr('Erro ao criar ticket', 'Error creating ticket', 'Error al crear ticket'));
    } finally { setCreatingTicket(false); }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedTicket || !newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        message: newMessage.trim(),
        is_internal: false,
        is_read: true,
        metadata: { sender_email: user.email, sender_role: 'customer', sent_via: 'user_interface' },
      });
      if (error) throw error;
      setNewMessage('');
      await loadTicketMessages(selectedTicket.id);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      console.error('Send error:', err);
      setError(err.message || tr('Erro ao enviar mensagem', 'Error sending message', 'Error al enviar mensaje'));
    } finally { setSendingMessage(false); }
  }

  const filteredTickets = tickets.filter(t => {
    const matchSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
    waiting: tickets.filter(t => t.status === 'waiting_user').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Carregando...', 'Loading...', 'Cargando...')}</p>
        </div>
      </div>
    );
  }

  // ---------- TICKET VIEW ----------
  if (activeView === 'view' && selectedTicket) {
    const status = STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.open;
    const priority = PRIORITY_CONFIG[selectedTicket.priority] || PRIORITY_CONFIG.medium;
    const category = selectedTicket.support_categories;
    const CatIcon = category ? (CATEGORY_ICONS[category.icon] || HelpCircle) : HelpCircle;

    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveView('list'); setSelectedTicket(null); }} className="p-2 -ml-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{selectedTicket.ticket_number}</p>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{selectedTicket.subject}</h1>
          </div>
        </div>

        {/* Ticket meta card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {tr(status.label, status.labelEn, status.labelEs)}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priority.color}`}>
              {tr(priority.label, priority.labelEn, priority.labelEs)}
            </span>
            {category && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                <CatIcon className="w-3.5 h-3.5" />
                {category.name}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatDate(selectedTicket.created_at, language)}</span>
            {selectedTicket.store_products && (
              <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> {selectedTicket.store_products.name}</span>
            )}
          </div>
        </div>

        {/* Messages thread */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{tr('Conversa', 'Conversation', 'Conversación')}</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">({messages.length})</span>
          </div>

          <div className="p-4 sm:p-5 space-y-4 max-h-[50vh] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{tr('Nenhuma mensagem ainda', 'No messages yet', 'Sin mensajes aún')}</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                const senderName = msg.profiles?.full_name || msg.profiles?.email || tr('Usuário', 'User', 'Usuario');
                const isAdmin = msg.profiles?.role === 'admin';
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isOwn && (
                        <div className="flex items-center gap-1.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${isAdmin ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {isAdmin ? 'AD' : senderName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {isAdmin ? tr('Suporte', 'Support', 'Soporte') : senderName}
                          </span>
                        </div>
                      )}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${isOwn
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : isAdmin
                          ? 'bg-blue-50 text-gray-800 dark:bg-blue-500/10 dark:text-blue-100 rounded-bl-md border border-blue-100 dark:border-blue-500/20'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-bl-md'
                      }`}>
                        {msg.message}
                      </div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1">{timeAgo(msg.created_at, language)}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box */}
          {selectedTicket.status !== 'closed' && (
            <form onSubmit={handleSendMessage} className="border-t border-gray-100 dark:border-gray-700 p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={1}
                  placeholder={tr('Digite sua mensagem...', 'Type your message...', 'Escribe tu mensaje...')}
                  className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all max-h-32"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                />
                <button type="submit" disabled={!newMessage.trim() || sendingMessage} className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                  {sendingMessage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </form>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-500/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // ---------- CREATE VIEW ----------
  if (activeView === 'create') {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveView('list')} className="p-2 -ml-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{tr('Novo Ticket', 'New Ticket', 'Nuevo Ticket')}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Descreva seu problema e te ajudaremos', 'Describe your issue and we\'ll help', 'Describe tu problema y te ayudaremos')}</p>
          </div>
        </div>

        <form onSubmit={handleCreateTicket} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-5">
          {/* Categories */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">{tr('Categoria', 'Category', 'Categoría')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {categories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.icon] || HelpCircle;
                  const selected = ticketForm.category_id === cat.id;
                  return (
                    <button key={cat.id} type="button" onClick={() => setTicketForm(p => ({ ...p, category_id: cat.id }))}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${selected ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                          <Icon className={`w-4 h-4 ${selected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{cat.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Assunto', 'Subject', 'Asunto')} *</label>
            <input type="text" required value={ticketForm.subject} onChange={(e) => setTicketForm(p => ({ ...p, subject: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              placeholder={tr('Resumo do problema', 'Brief summary of the issue', 'Resumen del problema')} />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">{tr('Prioridade', 'Priority', 'Prioridad')}</label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'urgent'] as const).map(p => {
                const cfg = PRIORITY_CONFIG[p];
                const selected = ticketForm.priority === p;
                return (
                  <button key={p} type="button" onClick={() => setTicketForm(f => ({ ...f, priority: p }))}
                    className={`py-2 rounded-lg text-xs font-medium transition-all ${selected ? cfg.color + ' ring-2 ring-offset-0 ring-current/30' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                    {tr(cfg.label, cfg.labelEn, cfg.labelEs)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Related product / order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Produto (opcional)', 'Product (optional)', 'Producto (opcional)')}</label>
              <select value={ticketForm.product_id} onChange={(e) => setTicketForm(p => ({ ...p, product_id: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all">
                <option value="">{tr('Selecione...', 'Select...', 'Seleccionar...')}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Pedido (opcional)', 'Order (optional)', 'Pedido (opcional)')}</label>
              <select value={ticketForm.order_id} onChange={(e) => setTicketForm(p => ({ ...p, order_id: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all">
                <option value="">{tr('Selecione...', 'Select...', 'Seleccionar...')}</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.store_products?.name || 'Order'} - ${o.total_usdt.toFixed(2)}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Descrição', 'Description', 'Descripción')} *</label>
            <textarea required rows={4} value={ticketForm.description} onChange={(e) => setTicketForm(p => ({ ...p, description: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all resize-none"
              placeholder={tr('Detalhe seu problema...', 'Detail your issue...', 'Detalla tu problema...')} />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-500/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setActiveView('list')} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
              {tr('Cancelar', 'Cancel', 'Cancelar')}
            </button>
            <button type="submit" disabled={creatingTicket} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {creatingTicket ? <><Loader2 className="w-4 h-4 animate-spin" /> {tr('Criando...', 'Creating...', 'Creando...')}</> : <><Plus className="w-4 h-4" /> {tr('Criar Ticket', 'Create Ticket', 'Crear Ticket')}</>}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{tr('Suporte', 'Support', 'Soporte')}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Gerencie seus tickets de ajuda', 'Manage your help tickets', 'Gestiona tus tickets de ayuda')}</p>
          </div>
        </div>
        <button onClick={() => { setActiveView('create'); setError(''); }} className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{tr('Novo Ticket', 'New Ticket', 'Nuevo Ticket')}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: tr('Total', 'Total', 'Total'), value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-gray-800' },
          { label: tr('Ativos', 'Active', 'Activos'), value: stats.open, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: tr('Aguardando', 'Waiting', 'Esperando'), value: stats.waiting, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
          { label: tr('Resolvidos', 'Resolved', 'Resueltos'), value: stats.resolved, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-2.5 sm:p-3 text-center`}>
            <p className={`text-lg sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={tr('Buscar tickets...', 'Search tickets...', 'Buscar tickets...')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {([
            { key: 'all', label: tr('Todos', 'All', 'Todos') },
            { key: 'open', label: tr('Abertos', 'Open', 'Abiertos') },
            { key: 'in_progress', label: tr('Andamento', 'Active', 'En Progreso') },
            { key: 'waiting_user', label: tr('Aguardando', 'Waiting', 'Esperando') },
            { key: 'resolved', label: tr('Resolvidos', 'Resolved', 'Resueltos') },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div className="space-y-2.5">
        {filteredTickets.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 sm:p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{tr('Nenhum ticket encontrado', 'No tickets found', 'No se encontraron tickets')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Crie um novo ticket para receber ajuda', 'Create a new ticket to get help', 'Crea un nuevo ticket para recibir ayuda')}</p>
            <button onClick={() => { setActiveView('create'); setError(''); }} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> {tr('Criar Ticket', 'Create Ticket', 'Crear Ticket')}
            </button>
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
            const category = ticket.support_categories;
            const CatIcon = category ? (CATEGORY_ICONS[category.icon] || HelpCircle) : HelpCircle;
            return (
              <button key={ticket.id} onClick={() => openTicket(ticket)}
                className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3.5 sm:p-4 text-left hover:border-blue-300 dark:hover:border-blue-500/40 hover:shadow-sm transition-all group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-colors">
                    <CatIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{ticket.ticket_number}</p>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ticket.subject}</h3>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                        <span className={`w-1 h-1 rounded-full ${status.dot}`} />
                        {tr(status.label, status.labelEn, status.labelEs)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${priority.color}`}>
                        {tr(priority.label, priority.labelEn, priority.labelEs)}
                      </span>
                      {category && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">{category.name}</span>}
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">{timeAgo(ticket.created_at, language)}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
