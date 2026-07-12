import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Search, Send, Eye, X, Clock, CheckCircle,
  AlertTriangle, User, Package, ArrowLeft, RefreshCw, DollarSign,
  Shield, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';

interface SupportTicket {
  id: string;
  ticket_number: string;
  seller_id: string;
  customer_id: string | null;
  customer_email: string;
  customer_name: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  product_id: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_type: string | null;
  escalated: boolean;
  escalated_at: string | null;
  escalation_reason: string;
  deadline: string;
  admin_resolved: boolean;
  replacement_credentials: any;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

export function SellerSupport() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { language } = useLanguage();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveType, setResolveType] = useState<'replace_account' | 'refund'>('replace_account');
  const [resolveLoading, setResolveLoading] = useState(false);
  const [replacementEmail, setReplacementEmail] = useState('');
  const [replacementPassword, setReplacementPassword] = useState('');
  const [replacementInstructions, setReplacementInstructions] = useState('');
  const [orderInfo, setOrderInfo] = useState<{ total_usdt: number; customer_id: string | null } | null>(null);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    loadTickets();
    if (user) {
      const channel = supabase
        .channel(`seller-support:${user.id}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'seller_support_tickets', filter: `seller_id=eq.${user.id}` },
          () => loadTickets()
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  useEffect(() => {
    let filtered = [...tickets];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.subject.toLowerCase().includes(term) ||
        t.customer_name.toLowerCase().includes(term) ||
        t.ticket_number.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'escalated') {
        filtered = filtered.filter(t => t.escalated);
      } else {
        filtered = filtered.filter(t => t.status === statusFilter && !t.escalated);
      }
    }
    setFilteredTickets(filtered);
  }, [tickets, searchTerm, statusFilter]);

  async function loadTickets() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_support_tickets')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  }

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
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function loadOrderInfo(orderId: string | null) {
    if (!orderId) { setOrderInfo(null); return; }
    try {
      const { data, error } = await supabase
        .from('store_orders')
        .select('total_usdt, customer_id')
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw error;
      setOrderInfo(data);
    } catch {
      setOrderInfo(null);
    }
  }

  async function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    await Promise.all([loadMessages(ticket.id), loadOrderInfo(ticket.order_id)]);
    if (ticket.status === 'open') {
      await supabase
        .from('seller_support_tickets')
        .update({ status: 'waiting_seller', updated_at: new Date().toISOString() })
        .eq('id', ticket.id);
      loadTickets();
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedTicket || !user) return;
    setSendingReply(true);
    try {
      const { error: msgError } = await supabase
        .from('seller_support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          sender_type: 'seller',
          message: replyText.trim(),
        });
      if (msgError) throw msgError;

      await supabase
        .from('seller_support_tickets')
        .update({ status: 'waiting_seller', updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

      setReplyText('');
      await loadMessages(selectedTicket.id);
      await loadTickets();
      // Refresh selected ticket
      const updated = tickets.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket({ ...updated, status: 'waiting_seller' });
    } catch (error) {
      console.error('Error sending reply:', error);
      alert(lbl('Erro ao enviar resposta', 'Error sending reply', 'Error al enviar respuesta'));
    } finally {
      setSendingReply(false);
    }
  }

  async function resolveTicket() {
    if (!selectedTicket) return;
    setResolveLoading(true);
    try {
      const credentials: any = {};
      if (resolveType === 'replace_account') {
        if (!replacementEmail.trim() || !replacementPassword.trim()) {
          alert(lbl('Preencha email e senha da nova conta', 'Fill in the new account email and password', 'Completa el email y contraseña de la nueva cuenta'));
          setResolveLoading(false);
          return;
        }
        credentials.email = replacementEmail.trim();
        credentials.password = replacementPassword.trim();
        if (replacementInstructions.trim()) {
          credentials.instructions = replacementInstructions.trim();
        }
      }

      const updateData: any = {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolution_type: resolveType,
        replacement_credentials: credentials,
      };

      const { error } = await supabase
        .from('seller_support_tickets')
        .update(updateData)
        .eq('id', selectedTicket.id);

      if (error) throw error;

      // If refund, credit the buyer
      if (resolveType === 'refund' && orderInfo && orderInfo.customer_id) {
        const { data: existingCredit } = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', orderInfo.customer_id)
          .maybeSingle();

        if (existingCredit) {
          await supabase
            .from('user_credits')
            .update({ balance: (existingCredit.balance || 0) + (orderInfo.total_usdt || 0) })
            .eq('user_id', orderInfo.customer_id);
        } else {
          await supabase
            .from('user_credits')
            .insert({ user_id: orderInfo.customer_id, balance: orderInfo.total_usdt || 0 });
        }

        // Notify buyer
        await supabase.from('notifications').insert({
          user_id: orderInfo.customer_id,
          title: lbl('Reembolso Creditado', 'Refund Credited', 'Reembolso Acreditado'),
          body: `${formatPrice(orderInfo.total_usdt || 0)} ${lbl('creditado por', 'credited by', 'acreditado por')} ${selectedTicket.subject}`,
          type: 'refund',
        });
      }

      // If replace account, add inventory item if needed and notify buyer
      if (resolveType === 'replace_account' && orderInfo && orderInfo.customer_id) {
        await supabase.from('notifications').insert({
          user_id: orderInfo.customer_id,
          title: lbl('Conta Substituída', 'Account Replaced', 'Cuenta Reemplazada'),
          body: lbl('O vendedor substituiu sua conta. Veja as novas credenciais em "Minhas Compras".', 'The seller replaced your account. See new credentials in "My Purchases".', 'El vendedor reemplazó tu cuenta. Ve las nuevas credenciales en "Mis Compras".'),
          type: 'support',
        });
      }

      setShowResolveModal(false);
      setSelectedTicket(null);
      setReplacementEmail('');
      setReplacementPassword('');
      setReplacementInstructions('');
      await loadTickets();
    } catch (error) {
      console.error('Error resolving ticket:', error);
      alert(lbl('Erro ao resolver ticket', 'Error resolving ticket', 'Error al resolver ticket'));
    } finally {
      setResolveLoading(false);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  function getDeadlineStatus(deadline: string) {
    const now = new Date();
    const dl = new Date(deadline);
    const diff = dl.getTime() - now.getTime();
    const hoursLeft = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
    const minutesLeft = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
    return { hoursLeft, minutesLeft, passed: diff <= 0 };
  }

  function getStatusBadge(status: string, escalated: boolean) {
    if (escalated) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
        <Shield className="h-3 w-3 mr-1" />{lbl('Escalado', 'Escalated', 'Escalado')}
      </span>;
    }
    const config: Record<string, { color: string; label: string }> = {
      open: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', label: lbl('Aberto', 'Open', 'Abierto') },
      waiting_seller: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', label: lbl('Aguardando', 'Waiting', 'Esperando') },
      resolved: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', label: lbl('Resolvido', 'Resolved', 'Resuelto') },
      closed: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400', label: lbl('Fechado', 'Closed', 'Cerrado') },
    };
    const c = config[status] || config.open;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>;
  }

  function getPriorityBadge(priority: string) {
    const config: Record<string, { color: string; label: string }> = {
      low: { color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', label: lbl('Baixa', 'Low', 'Baja') },
      medium: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', label: lbl('Média', 'Medium', 'Media') },
      high: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', label: lbl('Alta', 'High', 'Alta') },
    };
    const c = config[priority] || config.medium;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Ticket detail view
  if (selectedTicket) {
    const deadlineInfo = selectedTicket.deadline ? getDeadlineStatus(selectedTicket.deadline) : null;
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedTicket(null)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {lbl('Voltar', 'Back', 'Volver')}
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Ticket Header */}
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-500">{selectedTicket.ticket_number}</span>
                  {getStatusBadge(selectedTicket.status, selectedTicket.escalated)}
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedTicket.subject}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {selectedTicket.customer_name} · {selectedTicket.customer_email} · {formatDate(selectedTicket.created_at)}
                </p>
              </div>
              {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                <button onClick={() => setShowResolveModal(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors flex items-center gap-1.5 flex-shrink-0">
                  <CheckCircle className="h-4 w-4" />
                  {lbl('Resolver', 'Resolve', 'Resolver')}
                </button>
              )}
            </div>

            {/* Deadline warning */}
            {deadlineInfo && selectedTicket.status !== 'resolved' && !selectedTicket.escalated && (
              <div className={`mt-3 rounded-lg p-3 flex items-center gap-2 ${
                deadlineInfo.passed
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
              }`}>
                <Clock className={`h-4 w-4 ${deadlineInfo.passed ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
                <p className={`text-xs font-medium ${
                  deadlineInfo.passed ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                }`}>
                  {deadlineInfo.passed
                    ? lbl('Prazo de 24h esgotado! O cliente pode escalar para o admin.', '24h deadline passed! Customer can escalate to admin.', '¡Plazo de 24h vencido! El cliente puede escalar al admin.')
                    : lbl(`Prazo: ${deadlineInfo.hoursLeft}h ${deadlineInfo.minutesLeft}m restantes`, `Deadline: ${deadlineInfo.hoursLeft}h ${deadlineInfo.minutesLeft}m left`, `Plazo: ${deadlineInfo.hoursLeft}h ${deadlineInfo.minutesLeft}m restantes`)}
                </p>
              </div>
            )}

            {/* Escalation warning */}
            {selectedTicket.escalated && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-xs font-medium text-red-800 dark:text-red-300">
                  {lbl('Este caso foi escalado para o admin.', 'This case has been escalated to admin.', 'Este caso ha sido escalado al admin.')}
                  {selectedTicket.escalated_at && ` ${formatDate(selectedTicket.escalated_at)}`}
                </p>
              </div>
            )}

            {/* Resolution info */}
            {selectedTicket.status === 'resolved' && selectedTicket.resolution_type && (
              <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-semibold text-green-800 dark:text-green-300">
                    {selectedTicket.resolution_type === 'replace_account'
                      ? lbl('Conta Substituída', 'Account Replaced', 'Cuenta Reemplazada')
                      : lbl('Reembolso Emitido', 'Refund Issued', 'Reembolso Emitido')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="px-5 py-4 max-h-[400px] overflow-y-auto space-y-3">
            <div className="flex justify-start">
              <div className="max-w-[80%] bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">{selectedTicket.customer_name}</p>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedTicket.message}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(selectedTicket.created_at)}</p>
              </div>
            </div>

            {messagesLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              </div>
            ) : messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_type === 'seller' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.sender_type === 'seller'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  <p className={`text-xs mb-1 font-medium ${msg.sender_type === 'seller' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {msg.sender_type === 'seller' ? lbl('Você', 'You', 'Tú') : selectedTicket.customer_name}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-xs mt-1 ${msg.sender_type === 'seller' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {formatDate(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply input */}
          {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !sendingReply) sendReply(); }}
                  placeholder={lbl('Digite sua resposta...', 'Type your reply...', 'Escribe tu respuesta...')}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={sendReply} disabled={sendingReply || !replyText.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5">
                  <Send className="h-4 w-4" />
                  {lbl('Enviar', 'Send', 'Enviar')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Ticket list view
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={lbl('Buscar por assunto, cliente, número...', 'Search by subject, customer, number...', 'Buscar por asunto, cliente, número...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500">
            <option value="all">{lbl('Todos', 'All', 'Todos')}</option>
            <option value="open">{lbl('Aberto', 'Open', 'Abierto')}</option>
            <option value="waiting_seller">{lbl('Aguardando', 'Waiting', 'Esperando')}</option>
            <option value="resolved">{lbl('Resolvido', 'Resolved', 'Resuelto')}</option>
            <option value="escalated">{lbl('Escalado', 'Escalated', 'Escalado')}</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {tickets.length === 0
                ? lbl('Nenhum ticket de suporte ainda', 'No support tickets yet', 'Sin tickets de soporte aún')
                : lbl('Nenhum ticket encontrado', 'No tickets found', 'Sin tickets encontrados')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTickets.map((ticket) => {
              const dl = ticket.deadline ? getDeadlineStatus(ticket.deadline) : null;
              return (
                <button
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-gray-500">{ticket.ticket_number}</span>
                        {getStatusBadge(ticket.status, ticket.escalated)}
                        {getPriorityBadge(ticket.priority)}
                        {dl && !dl.passed && ticket.status !== 'resolved' && !ticket.escalated && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            {dl.hoursLeft}h {dl.minutesLeft}m
                          </span>
                        )}
                        {dl && dl.passed && ticket.status !== 'resolved' && !ticket.escalated && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            {lbl('Prazo esgotado', 'Deadline passed', 'Plazo vencido')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ticket.subject}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {ticket.customer_name} · {formatDate(ticket.created_at)}
                      </p>
                    </div>
                    <Eye className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolve Ticket Modal */}
      {showResolveModal && selectedTicket && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowResolveModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {lbl('Resolver Ticket', 'Resolve Ticket', 'Resolver Ticket')}
              </h3>
              <button onClick={() => setShowResolveModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Resolution type selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {lbl('Como resolver?', 'How to resolve?', 'Cómo resolver?')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setResolveType('replace_account')}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      resolveType === 'replace_account'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <RefreshCw className={`h-5 w-5 mb-1 ${resolveType === 'replace_account' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {lbl('Substituir Conta', 'Replace Account', 'Reemplazar Cuenta')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {lbl('Fornecer nova conta', 'Provide new account', 'Proporcionar nueva cuenta')}
                    </p>
                  </button>
                  <button
                    onClick={() => setResolveType('refund')}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      resolveType === 'refund'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign className={`h-5 w-5 mb-1 ${resolveType === 'refund' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {lbl('Emitir Reembolso', 'Issue Refund', 'Emitir Reembolso')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {orderInfo ? formatPrice(orderInfo.total_usdt) : ''}
                    </p>
                  </button>
                </div>
              </div>

              {/* Replace account form */}
              {resolveType === 'replace_account' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {lbl('Email da Nova Conta *', 'New Account Email *', 'Email de la Nueva Cuenta *')}
                    </label>
                    <input type="email" value={replacementEmail}
                      onChange={(e) => setReplacementEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                      placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {lbl('Senha da Nova Conta *', 'New Account Password *', 'Contraseña de la Nueva Cuenta *')}
                    </label>
                    <input type="text" value={replacementPassword}
                      onChange={(e) => setReplacementPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                      placeholder="password123" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {lbl('Instruções (opcional)', 'Instructions (optional)', 'Instrucciones (opcional)')}
                    </label>
                    <textarea rows={2} value={replacementInstructions}
                      onChange={(e) => setReplacementInstructions(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                      placeholder={lbl('Instruções para o cliente...', 'Instructions for the customer...', 'Instrucciones para el cliente...')} />
                  </div>
                </div>
              )}

              {/* Refund confirmation */}
              {resolveType === 'refund' && orderInfo && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {lbl(
                      `O valor de ${formatPrice(orderInfo.total_usdt)} será creditado na conta do cliente.`,
                      `The amount of ${formatPrice(orderInfo.total_usdt)} will be credited to the customer's account.`,
                      `El monto de ${formatPrice(orderInfo.total_usdt)} será acreditado a la cuenta del cliente.`
                    )}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={resolveTicket}
                disabled={resolveLoading}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resolveLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{lbl('Resolvendo...', 'Resolving...', 'Resolviendo...')}</>
                ) : (
                  <><CheckCircle className="h-4 w-4" />{lbl('Confirmar Resolução', 'Confirm Resolution', 'Confirmar Resolución')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
