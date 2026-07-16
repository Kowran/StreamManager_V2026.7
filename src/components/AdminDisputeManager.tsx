import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, Search, RefreshCw, ArrowLeft,
  Send, MessageCircle, User, Package, Clock, AlertTriangle, CheckCircle,
  X, DollarSign, Ban, Loader2, ShoppingBag, Scale, Eye, FileText,
  Snowflake, Unlock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';

interface DisputeTicket {
  id: string;
  ticket_number: string;
  seller_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  product_id: string | null;
  order_id: string | null;
  subject: string;
  message: string;
  image_url?: string;
  status: string;
  priority: string;
  resolution_type?: string;
  resolution_notes?: string;
  replacement_credentials?: any;
  deadline?: string;
  escalated: boolean;
  escalated_at?: string;
  escalation_reason?: string;
  admin_resolved: boolean;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  seller?: { username: string; email: string };
  order?: {
    id: string;
    total_usdt: number;
    total_brl: number;
    status: string;
    quantity: number;
    product_name?: string;
    product_image?: string;
  } | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  image_url?: string;
  created_at: string;
}

type TabStage = 'open' | 'escalated' | 'resolved';

export function AdminDisputeManager() {
  const { language } = useLanguage();
  const { formatPrice } = useCurrency();

  const [tickets, setTickets] = useState<DisputeTicket[]>([]);
  const [activeTab, setActiveTab] = useState<TabStage>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<DisputeTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{
    type: 'cancel_sale' | 'refund_customer' | 'force_seller' | 'resolve';
    notes: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => { loadTickets(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin_dispute_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_support_tickets' }, () => loadTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadTickets() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_support_tickets')
        .select(`*, seller:seller_id (username, email)`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ticketData = data || [];

      // Fetch order info for tickets with order_id
      const orderIds = ticketData.filter(t => t.order_id).map(t => t.order_id!);
      const orderMap: Record<string, any> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('store_orders')
          .select(`id, total_usdt, total_brl, status, quantity, store_products(name, image_url)`)
          .in('id', orderIds);
        (orders || []).forEach((o: any) => {
          orderMap[o.id] = {
            ...o,
            product_name: o.store_products?.name,
            product_image: o.store_products?.image_url,
          };
        });
      }

      const mapped: DisputeTicket[] = ticketData.map(t => ({
        ...t,
        seller: t.seller as any,
        order: t.order_id ? orderMap[t.order_id] || null : null,
      }));
      setTickets(mapped);
    } catch (error) {
      console.error('Error loading dispute tickets:', error);
    } finally {
      setLoading(false);
    }
  }

  const openTickets = tickets.filter(t => !t.escalated && t.status !== 'resolved' && t.status !== 'closed');
  const escalatedTickets = tickets.filter(t => t.escalated && t.status !== 'resolved' && t.status !== 'closed');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  const filteredTickets = (() => {
    let pool: DisputeTicket[];
    switch (activeTab) {
      case 'open': pool = openTickets; break;
      case 'escalated': pool = escalatedTickets; break;
      case 'resolved': pool = resolvedTickets; break;
    }
    if (!searchTerm.trim()) return pool;
    const term = searchTerm.toLowerCase();
    return pool.filter(t =>
      t.ticket_number?.toLowerCase().includes(term) ||
      t.customer_name?.toLowerCase().includes(term) ||
      t.subject?.toLowerCase().includes(term) ||
      t.seller?.username?.toLowerCase().includes(term)
    );
  })();

  async function loadMessages(ticketId: string) {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function openTicket(ticket: DisputeTicket) {
    setSelectedTicket(ticket);
    setMessages([]);
    setReplyText('');
    await loadMessages(ticket.id);
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('seller_support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          sender_type: 'admin',
          message: replyText.trim(),
        });
      if (error) throw error;

      setReplyText('');
      await loadMessages(selectedTicket.id);
    } catch (error) {
      console.error('Error sending admin reply:', error);
      alert(lbl('Erro ao enviar mensagem', 'Error sending message', 'Error al enviar mensaje'));
    } finally {
      setSendingReply(false);
    }
  }

  async function executeAction() {
    if (!actionModal || !selectedTicket) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_resolve_seller_ticket', {
        p_ticket_id: selectedTicket.id,
        p_action: actionModal.type,
        p_resolution_notes: actionModal.notes.trim() || null,
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);

      setActionModal(null);
      await loadTickets();
      setSelectedTicket(null);
      setMessages([]);
      alert(lbl('Ação executada com sucesso!', 'Action executed successfully!', '¡Acción ejecutada con éxito!'));
    } catch (error) {
      alert(lbl('Erro: ', 'Error: ', 'Error: ') + (error instanceof Error ? error.message : ''));
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString(language === 'pt' ? 'pt-BR' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function getStatusBadge(status: string, escalated?: boolean, adminResolved?: boolean) {
    if (escalated) return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
        <ShieldAlert className="h-3 w-3 mr-1" />{lbl('Escalado', 'Escalated', 'Escalado')}
      </span>
    );
    if (adminResolved) return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
        <ShieldCheck className="h-3 w-3 mr-1" />{lbl('Resolvido Admin', 'Admin Resolved', 'Resuelto Admin')}
      </span>
    );
    const map: Record<string, { label: string; classes: string }> = {
      open: { label: lbl('Aberto', 'Open', 'Abierto'), classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
      waiting_seller: { label: lbl('Aguard. Vendedor', 'Waiting Seller', 'Esperando Vendedor'), classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
      waiting_customer: { label: lbl('Aguard. Cliente', 'Waiting Customer', 'Esperando Cliente'), classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
      resolved: { label: lbl('Resolvido', 'Resolved', 'Resuelto'), classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
      closed: { label: lbl('Fechado', 'Closed', 'Cerrado'), classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    };
    const s = map[status] || { label: status, classes: 'bg-gray-100 text-gray-800' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.classes}`}>{s.label}</span>;
  }

  function getPriorityBadge(priority: string) {
    if (priority === 'high') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">{lbl('Alta', 'High', 'Alta')}</span>;
    if (priority === 'medium') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">{lbl('Média', 'Medium', 'Media')}</span>;
    return null;
  }

  function getDeadlineStatus(deadline?: string) {
    if (!deadline) return null;
    const now = new Date();
    const dl = new Date(deadline);
    const diff = dl.getTime() - now.getTime();
    if (diff < 0) return { passed: true, hoursLeft: 0, minutesLeft: 0 };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { passed: false, hoursLeft: hours, minutesLeft: minutes };
  }

  const tabConfig: { key: TabStage; label: string; icon: React.ElementType; count: number; activeColor: string }[] = [
    { key: 'open', label: lbl('Disputas Abertas', 'Open Disputes', 'Disputas Abiertas'), icon: MessageCircle, count: openTickets.length, activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400' },
    { key: 'escalated', label: lbl('Escalados', 'Escalated', 'Escalados'), icon: ShieldAlert, count: escalatedTickets.length, activeColor: 'border-red-500 text-red-600 dark:text-red-400' },
    { key: 'resolved', label: lbl('Resolvidos', 'Resolved', 'Resueltos'), icon: CheckCircle, count: resolvedTickets.length, activeColor: 'border-green-500 text-green-600 dark:text-green-400' },
  ];

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!selectedTicket ? (
        <>
          {/* Header */}
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              {lbl('Disputas e Mediação', 'Disputes & Mediation', 'Disputas y Mediación')}
            </h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{lbl('Abertas', 'Open', 'Abiertas')}</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{openTickets.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{lbl('Escaladas', 'Escalated', 'Escaladas')}</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{escalatedTickets.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{lbl('Resolvidas', 'Resolved', 'Resueltas')}</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{resolvedTickets.length}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {tabConfig.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-1 justify-center ${
                      isActive ? tab.activeColor : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}>
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${isActive ? 'bg-current/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder={lbl('Buscar...', 'Search...', 'Buscar...')}
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={loadTickets} className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:text-blue-500 transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Ticket List */}
            <div className="max-h-[60vh] overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                  <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">{lbl('Nenhuma disputa encontrada', 'No disputes found', 'Sin disputas encontradas')}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTickets.map(ticket => {
                    const dl = getDeadlineStatus(ticket.deadline);
                    return (
                      <button key={ticket.id} onClick={() => openTicket(ticket)}
                        className="w-full text-left px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
                              {getStatusBadge(ticket.status, ticket.escalated, ticket.admin_resolved)}
                              {getPriorityBadge(ticket.priority)}
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ticket.subject}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span>{lbl('Cliente:', 'Customer:', 'Cliente:')} {ticket.customer_name}</span>
                              <span>·</span>
                              <span>{lbl('Vendedor:', 'Seller:', 'Vendedor:')} {ticket.seller?.username || '—'}</span>
                            </div>
                            {ticket.order && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-600 dark:text-blue-400">
                                <ShoppingBag className="h-3 w-3" />
                                <span>{ticket.order.product_name || '—'}</span>
                                <span>·</span>
                                <span className="font-semibold">{formatPrice(ticket.order.total_usdt)}</span>
                                {ticket.order.status === 'disputed' && (
                                  <span className="text-orange-500 dark:text-orange-400 font-medium">({lbl('Em disputa', 'In dispute', 'En disputa')})</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-xs text-gray-400">{formatDate(ticket.created_at)}</span>
                            {dl && !dl.passed && ticket.status !== 'resolved' && !ticket.escalated && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                {dl.hoursLeft}h {dl.minutesLeft}m
                              </span>
                            )}
                            {dl?.passed && ticket.status !== 'resolved' && !ticket.escalated && (
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3" />{lbl('Prazo', 'Overdue', 'Vencido')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ─── TICKET DETAIL VIEW ─── */
        <div className="space-y-4">
          {/* Back button + header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <button onClick={() => { setSelectedTicket(null); setMessages([]); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-3">
              <ArrowLeft className="h-4 w-4" />{lbl('Voltar', 'Back', 'Volver')}
            </button>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-mono text-gray-500">{selectedTicket.ticket_number}</span>
                  {getStatusBadge(selectedTicket.status, selectedTicket.escalated, selectedTicket.admin_resolved)}
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedTicket.subject}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                  <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedTicket.customer_name}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" />{selectedTicket.seller?.username || '—'}</span>
                  <span>·</span>
                  <span>{formatDate(selectedTicket.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Escalation info */}
            {selectedTicket.escalated && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">
                    {lbl('Caso escalado para o admin', 'Case escalated to admin', 'Caso escalado al admin')}
                    {selectedTicket.escalated_at && ` — ${formatDate(selectedTicket.escalated_at)}`}
                  </p>
                  {selectedTicket.escalation_reason && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{selectedTicket.escalation_reason}</p>
                  )}
                </div>
              </div>
            )}

            {/* Order info */}
            {selectedTicket.order && (
              <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10 p-3">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {lbl('Pedido Relacionado', 'Related Order', 'Pedido Relacionado')}
                </p>
                <div className="flex items-center gap-3">
                  {selectedTicket.order.product_image && (
                    <img src={selectedTicket.order.product_image} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-600" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">{selectedTicket.order.product_name || '—'}</p>
                    <div className="flex items-center gap-3 text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      <span>{lbl('Qtd:', 'Qty:', 'Cant:')} {selectedTicket.order.quantity}</span>
                      <span className="font-bold">{formatPrice(selectedTicket.order.total_usdt)}</span>
                      <span className={`font-medium ${selectedTicket.order.status === 'disputed' ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                        {selectedTicket.order.status === 'disputed' ? lbl('Em disputa', 'In dispute', 'En disputa') : selectedTicket.order.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Resolution info */}
            {selectedTicket.status === 'resolved' && selectedTicket.resolution_notes && (
              <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <p className="text-xs font-semibold text-green-800 dark:text-green-300">
                    {selectedTicket.admin_resolved
                      ? lbl('Resolvido pelo Admin', 'Resolved by Admin', 'Resuelto por Admin')
                      : lbl('Resolvido', 'Resolved', 'Resuelto')}
                    {selectedTicket.resolution_type && ` — ${selectedTicket.resolution_type === 'refund' ? lbl('Reembolso', 'Refund', 'Reembolso') : lbl('Substituição', 'Replacement', 'Reemplazo')}`}
                  </p>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300 pl-6">{selectedTicket.resolution_notes}</p>
              </div>
            )}

            {/* Admin Actions */}
            {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => setActionModal({ type: 'resolve', notes: '' })}
                  className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />{lbl('Resolver', 'Resolve', 'Resolver')}
                </button>
                {selectedTicket.order && (
                  <>
                    <button onClick={() => setActionModal({ type: 'cancel_sale', notes: '' })}
                      className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1.5">
                      <Ban className="h-4 w-4" />{lbl('Cancelar Venda', 'Cancel Sale', 'Cancelar Venta')}
                    </button>
                    <button onClick={() => setActionModal({ type: 'refund_customer', notes: '' })}
                      className="px-3 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4" />{lbl('Reembolsar Cliente', 'Refund Customer', 'Reembolsar Cliente')}
                    </button>
                    <button onClick={() => setActionModal({ type: 'force_seller', notes: '' })}
                      className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5">
                      <Scale className="h-4 w-4" />{lbl('A Favor do Vendedor', 'In Favor of Seller', 'A Favor del Vendedor')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                {lbl('Conversa entre Cliente e Vendedor', 'Customer-Seller Conversation', 'Conversación Cliente-Vendedor')}
              </h4>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
              {/* Original ticket message */}
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{selectedTicket.customer_name}</p>
                    <span className="text-xs text-gray-400">{formatDate(selectedTicket.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedTicket.message}</p>
                  {selectedTicket.image_url && (
                    <img src={selectedTicket.image_url} alt="Proof" className="mt-2 rounded-lg max-h-48 w-full object-cover cursor-pointer border border-gray-200 dark:border-gray-600" onClick={() => window.open(selectedTicket.image_url!, '_blank')} />
                  )}
                </div>
              </div>

              {messagesLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
              ) : (
                messages.map(msg => {
                  const isAdmin = msg.sender_type === 'admin';
                  const isSeller = msg.sender_type === 'seller';
                  return (
                    <div key={msg.id} className={`flex ${isAdmin ? 'justify-center' : isSeller ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${
                        isAdmin
                          ? 'bg-purple-600 text-white'
                          : isSeller
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                      }`}>
                        <p className={`text-xs mb-1 font-semibold ${isAdmin ? 'text-purple-100' : isSeller ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                          {isAdmin ? lbl('Admin', 'Admin', 'Admin') : isSeller ? lbl('Vendedor', 'Seller', 'Vendedor') : selectedTicket.customer_name}
                        </p>
                        {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                        {msg.image_url && (
                          <img src={msg.image_url} alt="Attachment" className="mt-2 rounded-lg max-h-40 w-full object-cover cursor-pointer" onClick={() => window.open(msg.image_url!, '_blank')} />
                        )}
                        <p className={`text-xs mt-1 ${isAdmin ? 'text-purple-200' : isSeller ? 'text-blue-200' : 'text-gray-400'}`}>
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Admin reply input */}
            {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex gap-2">
                  <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !sendingReply) sendReply(); }}
                    placeholder={lbl('Mensagem do admin...', 'Admin message...', 'Mensaje del admin...')}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-purple-500" />
                  <button onClick={sendReply} disabled={sendingReply || !replyText.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
                    {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="hidden sm:inline">{lbl('Enviar', 'Send', 'Enviar')}</span>
                  </button>
                </div>
                <p className="text-xs text-purple-500 dark:text-purple-400 mt-1.5">
                  {lbl('Sua mensagem será enviada como Admin para ambos os lados.', 'Your message will be sent as Admin to both parties.', 'Tu mensaje será enviado como Admin a ambas partes.')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ACTION MODAL ─── */}
      {actionModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {actionModal.type === 'cancel_sale' && <><Ban className="h-5 w-5 text-red-500" />{lbl('Cancelar Venda e Reembolsar', 'Cancel Sale & Refund', 'Cancelar Venta y Reembolsar')}</>}
                {actionModal.type === 'refund_customer' && <><DollarSign className="h-5 w-5 text-orange-500" />{lbl('Reembolsar Cliente', 'Refund Customer', 'Reembolsar Cliente')}</>}
                {actionModal.type === 'force_seller' && <><Scale className="h-5 w-5 text-blue-500" />{lbl('Decidir a Favor do Vendedor', 'Decide in Favor of Seller', 'Decidir a Favor del Vendedor')}</>}
                {actionModal.type === 'resolve' && <><CheckCircle className="h-5 w-5 text-green-500" />{lbl('Resolver Disputa', 'Resolve Dispute', 'Resolver Disputa')}</>}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Action description */}
              <div className={`rounded-lg p-3 text-sm ${
                actionModal.type === 'cancel_sale' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700' :
                actionModal.type === 'refund_customer' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-700' :
                actionModal.type === 'force_seller' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700' :
                'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700'
              }`}>
                {actionModal.type === 'cancel_sale' && lbl(
                  'A venda será cancelada, o cliente será reembolsado com créditos, a comissão do vendedor será cancelada e o estoque do produto será restaurado.',
                  'The sale will be cancelled, the customer will be refunded with credits, the seller commission will be cancelled, and product stock will be restored.',
                  'La venta será cancelada, el cliente será reembolsado con créditos, la comisión del vendedor será cancelada y el stock del producto será restaurado.'
                )}
                {actionModal.type === 'refund_customer' && lbl(
                  'O cliente será reembolsado com créditos, mas a venda será marcada como concluída. O vendedor mantém a comissão.',
                  'The customer will be refunded with credits, but the sale will be marked as completed. The seller keeps the commission.',
                  'El cliente será reembolsado con créditos, pero la venta se marcará como completada. El vendedor mantiene la comisión.'
                )}
                {actionModal.type === 'force_seller' && lbl(
                  'A disputa será resolvida a favor do vendedor. A venda será concluída e as comissões congeladas serão liberadas.',
                  'The dispute will be resolved in favor of the seller. The sale will be completed and frozen commissions will be released.',
                  'La disputa se resolverá a favor del vendedor. La venta se completará y las comisiones congeladas serán liberadas.'
                )}
                {actionModal.type === 'resolve' && lbl(
                  'A disputa será marcada como resolvida. Use esta opção quando as partes chegaram a um acordo.',
                  'The dispute will be marked as resolved. Use this option when the parties have reached an agreement.',
                  'La disputa se marcará como resuelta. Use esta opción cuando las partes hayan llegado a un acuerdo.'
                )}
              </div>

              {/* Order summary */}
              {selectedTicket.order && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{selectedTicket.order.product_name || lbl('Produto', 'Product', 'Producto')}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{formatPrice(selectedTicket.order.total_usdt)}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {lbl('Notas de Resolução (opcional)', 'Resolution Notes (optional)', 'Notas de Resolución (opcional)')}
                </label>
                <textarea rows={3} value={actionModal.notes} onChange={e => setActionModal(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder={lbl('Descreva a resolução...', 'Describe the resolution...', 'Describe la resolución...')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none" />
              </div>

              <button onClick={executeAction} disabled={actionLoading}
                className={`w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  actionModal.type === 'cancel_sale' ? 'bg-red-600 hover:bg-red-700' :
                  actionModal.type === 'refund_customer' ? 'bg-orange-600 hover:bg-orange-700' :
                  actionModal.type === 'force_seller' ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-green-600 hover:bg-green-700'
                }`}>
                {actionLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{lbl('Processando...', 'Processing...', 'Procesando...')}</>
                ) : (
                  <>
                    {actionModal.type === 'cancel_sale' && <><Ban className="h-4 w-4" />{lbl('Confirmar Cancelamento', 'Confirm Cancellation', 'Confirmar Cancelamiento')}</>}
                    {actionModal.type === 'refund_customer' && <><DollarSign className="h-4 w-4" />{lbl('Confirmar Reembolso', 'Confirm Refund', 'Confirmar Reembolso')}</>}
                    {actionModal.type === 'force_seller' && <><Scale className="h-4 w-4" />{lbl('Confirmar Decisão', 'Confirm Decision', 'Confirmar Decisión')}</>}
                    {actionModal.type === 'resolve' && <><CheckCircle className="h-4 w-4" />{lbl('Confirmar Resolução', 'Confirm Resolution', 'Confirmar Resolución')}</>}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
