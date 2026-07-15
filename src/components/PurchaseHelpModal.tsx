import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, MessageCircle, Send, Clock, AlertTriangle, RefreshCw, DollarSign,
  CheckCircle, ArrowLeft, Shield, Loader2, Package, ImagePlus, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface PurchaseHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: {
    id: string;
    product_id: string;
    order_id: string;
    product_name: string;
    purchase_price: number;
  } | null;
  sellerId?: string | null;
}

interface ExistingTicket {
  id: string;
  ticket_number: string;
  subject: string;
  message: string;
  status: string;
  resolution_type: string | null;
  escalated: boolean;
  escalated_at: string | null;
  escalation_reason: string;
  deadline: string;
  admin_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  replacement_credentials: any;
}

interface TicketMessage {
  id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

export function PurchaseHelpModal({ isOpen, onClose, purchase, sellerId }: PurchaseHelpModalProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [existingTicket, setExistingTicket] = useState<ExistingTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [issueType, setIssueType] = useState<'replace' | 'refund'>('replace');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueImageUrl, setIssueImageUrl] = useState<string | null>(null);
  const [issueImageFile, setIssueImageFile] = useState<File | null>(null);
  const [replyImageUrl, setReplyImageUrl] = useState<string | null>(null);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    if (isOpen && purchase && user) {
      loadExistingTicket();
    }
  }, [isOpen, purchase, user]);

  async function loadExistingTicket() {
    if (!purchase || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_support_tickets')
        .select('*')
        .eq('customer_id', user.id)
        .eq('order_id', purchase.order_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingTicket(data);
        await loadMessages(data.id);
      } else {
        setExistingTicket(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(ticketId: string) {
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
    }
  }

  async function uploadSupportImage(file: File): Promise<string | null> {
    const fileName = `${user!.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error } = await supabase.storage.from('support-images').upload(fileName, file, { upsert: true });
    if (error) return null;
    const { data: urlData } = supabase.storage.from('support-images').getPublicUrl(fileName);
    return urlData.publicUrl;
  }

  async function handleIssueImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIssueImageFile(file);
    setIssueImageUrl(URL.createObjectURL(file));
  }

  async function handleReplyImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadSupportImage(file);
      if (url) setReplyImageUrl(url);
    } finally {
      setUploadingImage(false);
    }
  }

  async function createTicket() {
    if (!purchase || !user || !sellerId) return;
    if (!issueDescription.trim()) return;
    if (!issueImageFile && !issueImageUrl) {
      alert(lbl('É obrigatório enviar uma imagem do problema', 'An image of the problem is required', 'Se requiere una imagen del problema'));
      return;
    }
    setCreating(true);
    try {
      let uploadedImageUrl: string | null = null;
      if (issueImageFile) {
        uploadedImageUrl = await uploadSupportImage(issueImageFile);
      }

      const { data: ticketNumData } = await supabase.rpc('generate_seller_ticket_number');
      const ticketNumber = ticketNumData || `ST${Date.now().toString().slice(-6)}`;

      const subject = issueType === 'replace'
        ? lbl('Substituir conta - ', 'Replace account - ', 'Reemplazar cuenta - ') + purchase.product_name
        : lbl('Solicitar reembolso - ', 'Request refund - ', 'Solicitar reembolso - ') + purchase.product_name;

      const { data, error: ticketError } = await supabase
        .from('seller_support_tickets')
        .insert({
          ticket_number: ticketNumber,
          seller_id: sellerId,
          customer_id: user.id,
          customer_email: user.email || '',
          customer_name: (user as any).user_metadata?.full_name || user.email || '',
          product_id: purchase.product_id,
          order_id: purchase.order_id,
          subject,
          message: issueDescription.trim(),
          image_url: uploadedImageUrl,
          status: 'open',
          priority: 'high',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('*')
        .maybeSingle();

      if (ticketError) throw ticketError;

      // Update order status to disputed
      if (purchase.order_id) {
        await supabase
          .from('store_orders')
          .update({ status: 'disputed', dispute_opened_at: new Date().toISOString() })
          .eq('id', purchase.order_id)
          .not('status', 'in', '("cancelled","refunded","disputed")');
      }

      // Send dispute notification email to the seller (non-fatal)
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            template_type: 'dispute_opened',
            recipient_id: sellerId,
            variables: {
              seller_name: 'Seller',
              order_id: purchase.order_id || '',
              product_name: purchase.product_name || '',
              customer_name: user?.user_metadata?.full_name || user?.email || 'Customer',
              dispute_subject: subject,
              dispute_message: issueDescription.trim(),
            },
          }),
        });
        if (!response.ok) console.error('Failed to send dispute email');
      } catch (emailErr) {
        console.error('Dispute email error (non-fatal):', emailErr);
      }

      if (data) {
        setExistingTicket(data);
        await loadMessages(data.id);
        setIssueDescription('');
        setIssueImageUrl(null);
        setIssueImageFile(null);
        setIssueType('replace');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert(lbl('Erro ao criar ticket', 'Error creating ticket', 'Error al crear ticket'));
    } finally {
      setCreating(false);
    }
  }

  async function sendReply() {
    if ((!replyText.trim() && !replyImageUrl) || !existingTicket || !user) return;
    try {
      const { error } = await supabase
        .from('seller_support_messages')
        .insert({
          ticket_id: existingTicket.id,
          sender_id: user.id,
          sender_type: 'customer',
          message: replyText.trim(),
          image_url: replyImageUrl || null,
        });

      if (error) throw error;

      setReplyText('');
      setReplyImageUrl(null);
      if (replyFileInputRef.current) replyFileInputRef.current.value = '';
      await loadMessages(existingTicket.id);
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  }

  async function escalateToAdmin() {
    if (!existingTicket) return;
    setEscalating(true);
    try {
      const { error } = await supabase
        .from('seller_support_tickets')
        .update({
          escalated: true,
          escalated_at: new Date().toISOString(),
          escalation_reason: lbl('Vendedor não resolveu em 24 horas', 'Seller did not resolve within 24 hours', 'Vendedor no resolvió en 24 horas'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTicket.id);

      if (error) throw error;

      await loadExistingTicket();
    } catch (error) {
      console.error('Error escalating:', error);
      alert(lbl('Erro ao escalar caso', 'Error escalating case', 'Error al escalar caso'));
    } finally {
      setEscalating(false);
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

  if (!isOpen) return null;

  const deadlineInfo = existingTicket?.deadline ? getDeadlineStatus(existingTicket.deadline) : null;
  const canEscalate = existingTicket && deadlineInfo?.passed && !existingTicket.resolved_at && !existingTicket.escalated && existingTicket.status !== 'resolved';

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
              <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {lbl('Preciso de Ajuda', 'I Need Help', 'Necesito Ayuda')}
              </h3>
              {purchase && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{purchase.product_name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          ) : existingTicket ? (
            /* Ticket exists - show status and conversation */
            <div className="space-y-4">
              {/* Ticket Status Banner */}
              <div className={`rounded-lg p-4 border ${
                existingTicket.escalated
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                  : existingTicket.status === 'resolved'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {existingTicket.escalated ? (
                    <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                  ) : existingTicket.status === 'resolved' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  )}
                  <span className={`text-sm font-semibold ${
                    existingTicket.escalated
                      ? 'text-red-800 dark:text-red-300'
                      : existingTicket.status === 'resolved'
                      ? 'text-green-800 dark:text-green-300'
                      : 'text-blue-800 dark:text-blue-300'
                  }`}>
                    {existingTicket.escalated
                      ? lbl('Caso Escalado para Admin', 'Case Escalated to Admin', 'Caso Escalado a Admin')
                      : existingTicket.status === 'resolved'
                      ? lbl('Resolvido', 'Resolved', 'Resuelto')
                      : lbl('Aguardando Vendedor', 'Waiting for Seller', 'Esperando Vendedor')}
                  </span>
                  <span className="text-xs font-mono text-gray-500 ml-auto">{existingTicket.ticket_number}</span>
                </div>

                {/* Deadline */}
                {existingTicket.status !== 'resolved' && !existingTicket.escalated && deadlineInfo && (
                  <div className="text-xs text-blue-700 dark:text-blue-400">
                    {deadlineInfo.passed
                      ? lbl('Prazo esgotado - você pode escalar para o admin', 'Deadline passed - you can escalate to admin', 'Plazo vencido - puedes escalar a admin')
                      : lbl(`Prazo do vendedor: ${deadlineInfo.hoursLeft}h ${deadlineInfo.minutesLeft}m restantes`,
                            `Seller deadline: ${deadlineInfo.hoursLeft}h ${deadlineInfo.minutesLeft}m left`,
                            `Plazo del vendedor: ${deadlineInfo.hoursLeft}h ${deadlineInfo.minutesLeft}m restantes`)}
                  </div>
                )}

                {existingTicket.escalated && (
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                    {lbl('O admin irá revisar e resolver seu caso.', 'The admin will review and resolve your case.', 'El admin revisará y resolverá tu caso.')}
                  </p>
                )}
              </div>

              {/* Resolution Info */}
              {existingTicket.resolution_type && existingTicket.status === 'resolved' && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-semibold text-green-800 dark:text-green-300">
                      {existingTicket.resolution_type === 'replace_account'
                        ? lbl('Conta Substituída', 'Account Replaced', 'Cuenta Reemplazada')
                        : lbl('Reembolso Emitido', 'Refund Issued', 'Reembolso Emitido')}
                    </span>
                  </div>
                  {existingTicket.resolution_type === 'replace_account' && existingTicket.replacement_credentials &&
                   Object.keys(existingTicket.replacement_credentials).length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-md p-3 mt-2">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{lbl('Novas credenciais:', 'New credentials:', 'Nuevas credenciales:')}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {existingTicket.replacement_credentials.email && (
                          <div>
                            <span className="text-xs text-gray-500">Email:</span>
                            <p className="font-mono text-gray-900 dark:text-white">{existingTicket.replacement_credentials.email}</p>
                          </div>
                        )}
                        {existingTicket.replacement_credentials.password && (
                          <div>
                            <span className="text-xs text-gray-500">{lbl('Senha:', 'Password:', 'Contraseña:')}</span>
                            <p className="font-mono text-gray-900 dark:text-white">{existingTicket.replacement_credentials.password}</p>
                          </div>
                        )}
                      </div>
                      {existingTicket.replacement_credentials.instructions && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{existingTicket.replacement_credentials.instructions}</p>
                      )}
                    </div>
                  )}
                  {existingTicket.resolution_type === 'refund' && (
                    <p className="text-xs text-green-700 dark:text-green-400">
                      {lbl('O valor foi creditado em sua conta.', 'The amount was credited to your account.', 'El monto fue acreditado a tu cuenta.')}
                    </p>
                  )}
                </div>
              )}

              {/* Conversation */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {/* Initial message */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">{lbl('Você', 'You', 'Tú')}</p>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{existingTicket.message}</p>
                    {(existingTicket as any).image_url && (
                      <img src={(existingTicket as any).image_url} alt="Attachment" className="mt-2 rounded-lg max-h-40 w-full object-cover cursor-pointer" onClick={() => window.open((existingTicket as any).image_url, '_blank')} />
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(existingTicket.created_at)}</p>
                  </div>
                </div>
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      msg.sender_type === 'customer'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}>
                      <p className={`text-xs mb-1 font-medium ${msg.sender_type === 'customer' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                        {msg.sender_type === 'customer' ? lbl('Você', 'You', 'Tú') : lbl('Vendedor', 'Seller', 'Vendedor')}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      {(msg as any).image_url && (
                        <img src={(msg as any).image_url} alt="Attachment" className="mt-2 rounded-lg max-h-40 w-full object-cover cursor-pointer" onClick={() => window.open((msg as any).image_url, '_blank')} />
                      )}
                      <p className={`text-xs mt-1 ${msg.sender_type === 'customer' ? 'text-blue-200' : 'text-gray-400'}`}>
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply input (only if not resolved) */}
              {existingTicket.status !== 'resolved' && !existingTicket.escalated && (
                <div className="space-y-2">
                  {replyImageUrl && (
                    <div className="relative">
                      <img src={replyImageUrl} alt="Reply preview" className="rounded-lg max-h-32 w-full object-cover border border-gray-200 dark:border-gray-600" />
                      <button
                        onClick={() => { setReplyImageUrl(null); if (replyFileInputRef.current) replyFileInputRef.current.value = ''; }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                      ><X className="h-3 w-3" /></button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input ref={replyFileInputRef} type="file" accept="image/*" onChange={handleReplyImageChange} className="hidden" />
                    <button
                      onClick={() => replyFileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="px-2.5 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-colors disabled:opacity-50"
                      title={lbl('Adicionar imagem', 'Add image', 'Agregar imagen')}
                    >
                      {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    </button>
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                      placeholder={lbl('Digite uma mensagem...', 'Type a message...', 'Escribe un mensaje...')}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                    />
                    <button onClick={sendReply} disabled={!replyText.trim() && !replyImageUrl}
                      className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Escalate to Admin button */}
              {canEscalate && (
                <button
                  onClick={escalateToAdmin}
                  disabled={escalating}
                  className="w-full px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  {escalating
                    ? lbl('Escaleando...', 'Escalating...', 'Escalando...')
                    : lbl('Escalar para o Admin', 'Escalate to Admin', 'Escalar a Admin')}
                </button>
              )}
            </div>
          ) : (
            /* No ticket yet - show form to create one */
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {lbl(
                    'Abra um ticket diretamente com o vendedor. Ele tem 24 horas para resolver. Se não resolver, você pode escalar para o admin.',
                    'Open a ticket directly with the seller. They have 24 hours to resolve. If unresolved, you can escalate to admin.',
                    'Abre un ticket directamente con el vendedor. Tiene 24 horas para resolver. Si no resuelve, puedes escalar al admin.'
                  )}
                </p>
              </div>

              {/* Issue type selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {lbl('Qual é o problema?', 'What is the issue?', '¿Cuál es el problema?')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIssueType('replace')}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      issueType === 'replace'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <RefreshCw className={`h-5 w-5 mb-1 ${issueType === 'replace' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {lbl('Substituir Conta', 'Replace Account', 'Reemplazar Cuenta')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {lbl('A conta não funciona', 'Account doesn\'t work', 'La cuenta no funciona')}
                    </p>
                  </button>
                  <button
                    onClick={() => setIssueType('refund')}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      issueType === 'refund'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign className={`h-5 w-5 mb-1 ${issueType === 'refund' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {lbl('Solicitar Reembolso', 'Request Refund', 'Solicitar Reembolso')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {lbl('Quero meu dinheiro de volta', 'I want my money back', 'Quiero mi dinero de vuelta')}
                    </p>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {lbl('Descreva o problema', 'Describe the issue', 'Describe el problema')}
                </label>
                <textarea
                  rows={4}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder={lbl(
                    'Ex: A conta Netflix não está funcionando, aparece erro de login...',
                    'E.g: The Netflix account isn\'t working, shows login error...',
                    'Ej: La cuenta de Netflix no funciona, muestra error de login...'
                  )}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                />

                {/* Image Upload - Mandatory */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {lbl('Foto do problema', 'Photo of the problem', 'Foto del problema')}
                    <span className="text-red-500 ml-1">* {lbl('(obrigatório)', '(required)', '(requerido)')}</span>
                  </label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIssueImageChange} className="hidden" />
                  {issueImageUrl ? (
                    <div className="relative mt-1">
                      <img src={issueImageUrl} alt="Preview" className="rounded-lg max-h-40 w-full object-cover border border-gray-200 dark:border-gray-600" />
                      <button
                        onClick={() => { setIssueImageUrl(null); setIssueImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                      ><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 flex w-full items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-red-300 dark:border-red-700 rounded-lg text-sm text-red-500 dark:text-red-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                      <ImagePlus className="h-5 w-5" />
                      {lbl('Clique para adicionar foto do problema', 'Click to add a photo of the problem', 'Haz clic para agregar foto del problema')}
                    </button>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={createTicket}
                disabled={creating || !issueDescription.trim() || (!issueImageFile && !issueImageUrl)}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {lbl('Enviando...', 'Sending...', 'Enviando...')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {lbl('Enviar Ticket ao Vendedor', 'Send Ticket to Seller', 'Enviar Ticket al Vendedor')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
