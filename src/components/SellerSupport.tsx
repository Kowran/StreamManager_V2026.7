import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageCircle, Search, Send, X, Clock, CheckCircle,
  AlertTriangle, User, Package, ArrowLeft, RefreshCw, DollarSign,
  Shield, Loader2, ImagePlus, ShoppingBag, ExternalLink, Inbox,
  TrendingUp, CheckCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';

interface SupportTicket {
  id: string;
  ticket_number: string;
  seller_id: string;
  customer_id: string;
  customer_name: string;
  product_id: string;
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
  created_at: string;
  updated_at?: string;
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

interface OrderDetail {
  id: string;
  total_usdt: number;
  customer_id: string | null;
  status: string;
  created_at: string;
  product_name?: string;
  quantity?: number;
}

type TabStage = 'open' | 'escalated' | 'resolved';

export function SellerSupport() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { formatPrice } = useCurrency();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTab, setActiveTab] = useState<TabStage>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
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
  const [orderInfo, setOrderInfo] = useState<OrderDetail | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [replyImageUrl, setReplyImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    if (user) loadTickets();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('seller_support_tickets')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'seller_support_tickets',
        filter: `seller_id=eq.${user.id}`
      }, () => loadTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

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

  // Tab counts
  const openTickets = tickets.filter(t => !t.escalated && t.status !== 'resolved' && t.status !== 'closed');
  const escalatedTickets = tickets.filter(t => t.escalated && t.status !== 'resolved' && t.status !== 'closed');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  const filteredTickets = (() => {
    let pool: SupportTicket[];
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
      t.subject?.toLowerCase().includes(term)
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

  async function loadOrderInfo(orderId: string | null) {
    if (!orderId) { setOrderInfo(null); return; }
    try {
      const { data, error } = await supabase
        .from('seller_orders_view')
        .select(`id, total_usdt, customer_id, status, created_at, quantity, store_products(name)`)
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setOrderInfo({ ...data, product_name: (data.store_products as any)?.name });
      } else {
        setOrderInfo(null);
      }
    } catch {
      setOrderInfo(null);
    }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const fileName = `seller/${user!.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error } = await supabase.storage.from('support-images').upload(fileName, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('support-images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadImage(file);
      if (url) setReplyImageUrl(url);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setMessages([]);
    setReplyText('');
    setReplyImageUrl(null);
    await Promise.all([
      loadMessages(ticket.id),
      loadOrderInfo(ticket.order_id),
    ]);
    if (ticket.status === 'open') {
      await supabase
        .from('seller_support_tickets')
        .update({ status: 'waiting_seller' })
        .eq('id', ticket.id);
      setSelectedTicket(prev => prev ? { ...prev, status: 'waiting_seller' } : prev);
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'waiting_seller' } : t));
    }
  }

  async function sendReply() {
    if ((!replyText.trim() && !replyImageUrl) || !selectedTicket || !user) return;
    setSendingReply(true);
    try {
      const { error: msgError } = await supabase
        .from('seller_support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          sender_type: 'seller',
          message: replyText.trim(),
          image_url: replyImageUrl || null,
        });
      if (msgError) throw msgError;

      await supabase
        .from('seller_support_tickets')
        .update({ status: 'waiting_customer', updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

      setReplyText('');
      setReplyImageUrl(null);
      await loadMessages(selectedTicket.id);
      await loadTickets();
      setSelectedTicket(prev => prev ? { ...prev, status: 'waiting_customer' } : prev);
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
        if (replacementInstructions.trim()) credentials.instructions = replacementInstructions.trim();
      }

      const { error: resolveError } = await supabase
        .from('seller_support_tickets')
        .update({
          status: 'resolved',
          resolution_type: resolveType,
          resolution_notes: resolveType === 'replace_account'
            ? lbl('Conta substituída pelo vendedor', 'Account replaced by seller', 'Cuenta reemplazada por el vendedor')
            : lbl('Reembolso processado', 'Refund processed', 'Reembolso procesado'),
          replacement_credentials: resolveType === 'replace_account' ? credentials : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTicket.id);
      if (resolveError) throw resolveError;

      if (resolveType === 'refund' && orderInfo?.customer_id) {
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
      }

      if (orderInfo?.customer_id) {
        await supabase.from('notifications').insert({
          user_id: orderInfo.customer_id,
          type: 'support',
          title: resolveType === 'refund'
            ? lbl('Reembolso Processado', 'Refund Processed', 'Reembolso Procesado')
            : lbl('Suporte Resolvido', 'Support Resolved', 'Soporte Resuelto'),
          body: resolveType === 'refund'
            ? `${formatPrice(orderInfo.total_usdt || 0)} ${lbl('creditado por', 'credited by', 'acreditado por')} ${selectedTicket.subject}`
            : lbl('O vendedor enviou uma nova conta', 'The seller sent a replacement account', 'El vendedor envió una cuenta de reemplazo'),
          data: { ticket_id: selectedTicket.id, order_id: selectedTicket.order_id },
        });
      }

      if (selectedTicket.order_id) {
        await supabase
          .from('seller_orders_view')
          .update({ status: 'completed' })
          .eq('id', selectedTicket.order_id)
          .eq('status', 'disputed');
      }

      setShowResolveModal(false);
      setReplacementEmail('');
      setReplacementPassword('');
      setReplacementInstructions('');
      await loadTickets();
      setSelectedTicket(prev => prev ? { ...prev, status: 'resolved', resolution_type: resolveType } : prev);
      alert(lbl('Ticket resolvido com sucesso!', 'Ticket resolved successfully!', '¡Ticket resuelto con éxito!'));
    } catch (error) {
      console.error('Error resolving ticket:', error);
      alert(lbl('Erro ao resolver ticket', 'Error resolving ticket', 'Error al resolver ticket'));
    } finally {
      setResolveLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function getStatusBadge(status: string, escalated?: boolean) {
    if (escalated) return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
        <Shield className="h-3 w-3 mr-1" />{lbl('Escalado', 'Escalated', 'Escalado')}
      </span>
    );
    const map: Record<string, { label: string; classes: string }> = {
      open: { label: lbl('Aberto', 'Open', 'Abierto'), classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
      waiting_seller: { label: lbl('Aguardando Vendedor', 'Waiting Seller', 'Esperando Vendedor'), classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
      waiting_customer: { label: lbl('Aguardando Cliente', 'Waiting Customer', 'Esperando Cliente'), classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
      resolved: { label: lbl('Resolvido', 'Resolved', 'Resuelto'), classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
      closed: { label: lbl('Fechado', 'Closed', 'Cerrado'), classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    };
    const s = map[status] || { label: status, classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
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

  const deadlineInfo = selectedTicket ? getDeadlineStatus(selectedTicket.deadline) : null;

  const tabConfig: { key: TabStage; label: string; icon: React.ElementType; count: number; color: string; activeColor: string }[] = [
    { key: 'open', label: lbl('Aberto', 'Open', 'Abierto'), icon: Inbox, count: openTickets.length, color: 'text-blue-600', activeColor: 'border-blue-500 text-blue-600 dark:text-blue-400' },
    { key: 'escalated', label: lbl('Escalado', 'Escalated', 'Escalado'), icon: Shield, count: escalatedTickets.length, color: 'text-red-600', activeColor: 'border-red-500 text-red-600 dark:text-red-400' },
    { key: 'resolved', label: lbl('Resolvido', 'Resolved', 'Resuelto'), icon: CheckCheck, count: resolvedTickets.length, color: 'text-green-600', activeColor: 'border-green-500 text-green-600 dark:text-green-400' },
  ];

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {selectedTicket ? (
        /* ─── TICKET DETAIL VIEW ─── */
        <div className="flex flex-col h-full">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button onClick={() => { setSelectedTicket(null); setMessages([]); setOrderInfo(null); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-3">
              <ArrowLeft className="h-4 w-4" />
              {lbl('Voltar', 'Back', 'Volver')}
            </button>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-mono text-gray-500">{selectedTicket.ticket_number}</span>
                  {getStatusBadge(selectedTicket.status, selectedTicket.escalated)}
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedTicket.subject}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {selectedTicket.customer_name} · {formatDate(selectedTicket.created_at)}
                </p>
              </div>
              {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                <button onClick={() => setShowResolveModal(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0">
                  <CheckCircle className="h-4 w-4" />
                  {lbl('Resolver', 'Resolve', 'Resolver')}
                </button>
              )}
            </div>

            {orderInfo && (
              <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10 p-3">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {lbl('Compra Referente à Reclamação', 'Purchase Related to Complaint', 'Compra Relacionada a la Queja')}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {orderInfo.product_name && (
                    <div>
                      <span className="text-blue-500 dark:text-blue-400">{lbl('Produto:', 'Product:', 'Producto:')}</span>
                      <span className="ml-1 font-medium text-blue-800 dark:text-blue-200">{orderInfo.product_name}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-blue-500 dark:text-blue-400">{lbl('Valor:', 'Amount:', 'Monto:')}</span>
                    <span className="ml-1 font-bold text-blue-800 dark:text-blue-200">{formatPrice(orderInfo.total_usdt)}</span>
                  </div>
                  <div>
                    <span className="text-blue-500 dark:text-blue-400">{lbl('Status:', 'Status:', 'Estado:')}</span>
                    <span className={`ml-1 font-medium ${orderInfo.status === 'disputed' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-800 dark:text-blue-200'}`}>
                      {orderInfo.status === 'disputed' ? lbl('Em Disputa', 'In Dispute', 'En Disputa') : orderInfo.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-500 dark:text-blue-400">{lbl('Data:', 'Date:', 'Fecha:')}</span>
                    <span className="ml-1 text-blue-800 dark:text-blue-200">
                      {new Date(orderInfo.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US')}
                    </span>
                  </div>
                  {orderInfo.quantity && (
                    <div>
                      <span className="text-blue-500 dark:text-blue-400">{lbl('Qtd:', 'Qty:', 'Cant:')}</span>
                      <span className="ml-1 text-blue-800 dark:text-blue-200">{orderInfo.quantity}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {deadlineInfo && selectedTicket.status !== 'resolved' && !selectedTicket.escalated && (
              <div className={`mt-3 rounded-lg p-3 flex items-center gap-2 ${
                deadlineInfo.passed
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
              }`}>
                <Clock className={`h-4 w-4 ${deadlineInfo.passed ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
                <p className={`text-xs font-medium ${deadlineInfo.passed ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {deadlineInfo.passed
                    ? lbl('Prazo de 24h esgotado! O cliente pode escalar.', '24h deadline passed! Customer can escalate.', '¡Plazo vencido! El cliente puede escalar.')
                    : lbl(`Prazo: ${deadlineInfo.hoursLeft}h ${deadlineInfo.minutesLeft}m restantes`, `Deadline: ${deadlineInfo.hoursLeft}h ${deadlineInfo.minutesLeft}m left`, `Plazo: ${deadlineInfo.hoursLeft}h ${deadlineInfo.minutesLeft}m restantes`)}
                </p>
              </div>
            )}

            {selectedTicket.escalated && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-xs font-medium text-red-800 dark:text-red-300">
                  {lbl('Este caso foi escalado para o admin.', 'This case has been escalated to admin.', 'Este caso ha sido escalado al admin.')}
                  {selectedTicket.escalated_at && ` ${formatDate(selectedTicket.escalated_at)}`}
                </p>
              </div>
            )}

            {selectedTicket.status === 'resolved' && selectedTicket.resolution_type && (
              <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <p className="text-xs font-semibold text-green-800 dark:text-green-300">
                    {selectedTicket.resolution_type === 'refund'
                      ? lbl('Reembolso processado', 'Refund processed', 'Reembolso procesado')
                      : lbl('Conta substituída', 'Account replaced', 'Cuenta reemplazada')}
                  </p>
                </div>
                {selectedTicket.replacement_credentials && (
                  <div className="text-xs text-green-700 dark:text-green-300 space-y-0.5 pl-6">
                    <p>{lbl('Email:', 'Email:', 'Email:')} {selectedTicket.replacement_credentials.email}</p>
                    <p>{lbl('Senha:', 'Password:', 'Contraseña:')} {selectedTicket.replacement_credentials.password}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-start gap-2 px-3 py-2 mb-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                {lbl(
                  'Proibido compartilhar contatos externos (WhatsApp, email, redes sociais). Toda comunicação deve ser pelo chat do site.',
                  'Sharing external contacts (WhatsApp, email, social media) is prohibited. All communication must stay on the site chat.',
                  'Prohibido compartir contactos externos (WhatsApp, email, redes sociales). Toda comunicación debe ser por el chat del sitio.'
                )}
              </p>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{selectedTicket.customer_name}</p>
                  <span className="text-xs text-gray-400">{formatDate(selectedTicket.created_at)}</span>
                </div>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedTicket.message}</p>
                {selectedTicket.image_url && (
                  <img src={selectedTicket.image_url} alt="Proof" className="mt-2 rounded-lg max-h-48 w-full object-cover cursor-pointer border border-gray-200 dark:border-gray-600 hover:opacity-90 transition-opacity" onClick={() => window.open(selectedTicket.image_url!, '_blank')} />
                )}
              </div>
            </div>

            {messagesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'seller' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${
                    msg.sender_type === 'seller'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  }`}>
                    <p className={`text-xs mb-1 font-semibold ${msg.sender_type === 'seller' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                      {msg.sender_type === 'seller' ? lbl('Você', 'You', 'Tú') : selectedTicket.customer_name}
                    </p>
                    {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                    {msg.image_url && (
                      <img src={msg.image_url} alt="Attachment" className="mt-2 rounded-lg max-h-40 w-full object-cover cursor-pointer hover:opacity-90" onClick={() => window.open(msg.image_url!, '_blank')} />
                    )}
                    <p className={`text-xs mt-1 ${msg.sender_type === 'seller' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {formatDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2">
              {replyImageUrl && (
                <div className="relative">
                  <img src={replyImageUrl} alt="Preview" className="rounded-lg max-h-28 w-full object-cover border border-gray-200 dark:border-gray-600" />
                  <button onClick={() => setReplyImageUrl(null)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-colors disabled:opacity-50"
                  title={lbl('Adicionar imagem', 'Add image', 'Agregar imagen')}
                >
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </button>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !sendingReply) sendReply(); }}
                  placeholder={lbl('Digite sua resposta...', 'Type your reply...', 'Escribe tu respuesta...')}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={sendReply} disabled={sendingReply || (!replyText.trim() && !replyImageUrl)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
                  {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="hidden sm:inline">{lbl('Enviar', 'Send', 'Enviar')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── TICKET LIST VIEW WITH TABS ─── */
        <div className="flex flex-col h-full">
          {/* Tabs */}
          <div className="px-4 pt-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex gap-1">
              {tabConfig.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-lg ${
                      isActive
                        ? tab.activeColor
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                      isActive ? tab.color + ' bg-current/10' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search bar */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={lbl('Buscar tickets...', 'Search tickets...', 'Buscar tickets...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button onClick={loadTickets} className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:text-blue-500 hover:border-blue-400 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Ticket list */}
          <div className="flex-1 overflow-y-auto">
            {filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                {activeTab === 'open' && <Inbox className="h-10 w-10 mb-2 opacity-30" />}
                {activeTab === 'escalated' && <Shield className="h-10 w-10 mb-2 opacity-30" />}
                {activeTab === 'resolved' && <CheckCheck className="h-10 w-10 mb-2 opacity-30" />}
                <p className="text-sm">
                  {activeTab === 'open' && lbl('Nenhum ticket aberto', 'No open tickets', 'Sin tickets abiertos')}
                  {activeTab === 'escalated' && lbl('Nenhum ticket escalado', 'No escalated tickets', 'Sin tickets escalados')}
                  {activeTab === 'resolved' && lbl('Nenhum ticket resolvido', 'No resolved tickets', 'Sin tickets resueltos')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTickets.map(ticket => {
                  const dl = getDeadlineStatus(ticket.deadline);
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => openTicket(ticket)}
                      className="w-full text-left px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
                            {getStatusBadge(ticket.status, ticket.escalated)}
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ticket.subject}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {ticket.customer_name} · {formatDate(ticket.created_at)}
                          </p>
                          {ticket.message && (
                            <p className="text-xs text-gray-400 mt-1 truncate">{ticket.message}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
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
      )}

      {/* ─── RESOLVE MODAL ─── */}
      {showResolveModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowResolveModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {lbl('Resolver Ticket', 'Resolve Ticket', 'Resolver Ticket')}
              </h3>
              <button onClick={() => setShowResolveModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {orderInfo && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700/30">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    {lbl('Pedido do Cliente', "Customer's Order", 'Pedido del Cliente')}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{orderInfo.product_name || lbl('Produto', 'Product', 'Producto')}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{formatPrice(orderInfo.total_usdt)}</span>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {lbl('Como deseja resolver?', 'How would you like to resolve?', '¿Cómo desea resolver?')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setResolveType('replace_account')}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      resolveType === 'replace_account'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Package className={`h-5 w-5 mb-1 ${resolveType === 'replace_account' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{lbl('Substituir Conta', 'Replace Account', 'Reemplazar Cuenta')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{lbl('Enviar novas credenciais', 'Send new credentials', 'Enviar nuevas credenciales')}</p>
                  </button>
                  <button
                    onClick={() => setResolveType('refund')}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      resolveType === 'refund'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign className={`h-5 w-5 mb-1 ${resolveType === 'refund' ? 'text-green-600' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{lbl('Reembolso', 'Refund', 'Reembolso')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{lbl('Devolver créditos', 'Return credits', 'Devolver créditos')}</p>
                  </button>
                </div>
              </div>

              {resolveType === 'replace_account' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input type="email" value={replacementEmail} onChange={(e) => setReplacementEmail(e.target.value)}
                      placeholder="novo@email.com"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{lbl('Senha', 'Password', 'Contraseña')}</label>
                    <input type="text" value={replacementPassword} onChange={(e) => setReplacementPassword(e.target.value)}
                      placeholder={lbl('Nova senha', 'New password', 'Nueva contraseña')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{lbl('Instruções (opcional)', 'Instructions (optional)', 'Instrucciones (opcional)')}</label>
                    <textarea rows={2} value={replacementInstructions} onChange={(e) => setReplacementInstructions(e.target.value)}
                      placeholder={lbl('Ex: Perfil 2, PIN: 1234', 'E.g.: Profile 2, PIN: 1234', 'Ej: Perfil 2, PIN: 1234')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none" />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-3">
                  <p className="text-sm text-green-800 dark:text-green-300">
                    {orderInfo
                      ? lbl(
                          `O valor de ${formatPrice(orderInfo.total_usdt)} será creditado na conta do cliente.`,
                          `The amount of ${formatPrice(orderInfo.total_usdt)} will be credited to the customer's account.`,
                          `El monto de ${formatPrice(orderInfo.total_usdt)} será acreditado a la cuenta del cliente.`
                        )
                      : lbl('O valor da compra será reembolsado ao cliente.', 'The purchase amount will be refunded to the customer.', 'El monto de la compra será reembolsado al cliente.')}
                  </p>
                </div>
              )}

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
