import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Search, Send, Eye, X, Clock, CheckCircle,
  AlertTriangle, User, Package, ArrowLeft, Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

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
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
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
      filtered = filtered.filter(t => t.status === statusFilter);
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

  async function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    await loadMessages(ticket.id);

    // Auto-mark as waiting_seller if status is open
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
    } catch (error) {
      console.error('Error sending reply:', error);
      alert(lbl('Erro ao enviar resposta', 'Error sending reply', 'Error al enviar respuesta'));
    } finally {
      setSendingReply(false);
    }
  }

  async function resolveTicket() {
    if (!selectedTicket) return;
    try {
      await supabase
        .from('seller_support_tickets')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);
      setSelectedTicket(null);
      await loadTickets();
    } catch (error) {
      console.error('Error resolving ticket:', error);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  function getStatusBadge(status: string) {
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
                  {getStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedTicket.subject}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {selectedTicket.customer_name} · {selectedTicket.customer_email} · {formatDate(selectedTicket.created_at)}
                </p>
              </div>
              {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                <button onClick={resolveTicket}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors flex items-center gap-1.5 flex-shrink-0">
                  <CheckCircle className="h-4 w-4" />
                  {lbl('Resolver', 'Resolve', 'Resolver')}
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="px-5 py-4 max-h-[400px] overflow-y-auto space-y-3">
            {/* Initial message */}
            <div className={`flex ${'justify-start'}`}>
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
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
            <option value="closed">{lbl('Fechado', 'Closed', 'Cerrado')}</option>
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
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">{ticket.ticket_number}</span>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ticket.subject}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {ticket.customer_name} · {formatDate(ticket.created_at)}
                    </p>
                  </div>
                  <Eye className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
