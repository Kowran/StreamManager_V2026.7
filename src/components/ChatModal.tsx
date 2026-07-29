import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, Loader2, User, Circle, ImagePlus, ShieldAlert, ShoppingBag, Package,
  ChevronRight, Ban, CheckCircle, MoreVertical, Languages, Settings, Volume2, VolumeX,
  CornerDownLeft, ArrowLeft, Globe, Check, CheckCheck, AlertCircle, RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { OnlineBadge } from './OnlineBadge';
import { ChatSettingsModal, ChatSettingsData } from './ChatSettingsModal';

interface OtherUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  theme_color: string | null;
  last_seen_at: string | null;
  username: string | null;
}

type MessageStatus = 'sending' | 'sent' | 'read' | 'error';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  read_at: string | null;
  created_at: string;
  metadata?: any;
  _status?: MessageStatus;
  _originalContent?: string;
  _translatedContent?: string;
}

interface OrderContext {
  orderId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  totalUsdt: number;
  customerName: string;
}

interface TranslationCache {
  [messageId: string]: { text: string; sourceLang?: string };
}

interface ChatModalProps {
  otherUserId: string;
  onClose: () => void;
  orderContext?: OrderContext;
  embedded?: boolean;
  chatSettings?: ChatSettingsData;
}

const DEFAULT_SETTINGS: ChatSettingsData = {
  auto_translate: false,
  translate_to: 'en',
  show_original: true,
  enter_to_send: true,
  sound_enabled: true,
  outbound_translate_to: null,
};

const LANG_LABELS: Record<string, string> = {
  pt: 'Português', en: 'English', es: 'Español', fr: 'Français',
  de: 'Deutsch', it: 'Italiano', ja: '日本語', ko: '한국어',
  zh: '中文', ru: 'Русский', ar: 'العربية', nl: 'Nederlands',
};

const LANG_FLAGS: Record<string, string> = {
  pt: '🇧🇷', en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷',
  de: '🇩🇪', it: '🇮🇹', ja: '🇯🇵', ko: '🇰🇷',
  zh: '🇨🇳', ru: '🇷🇺', ar: '🇸🇦', nl: '🇳🇱',
};

export function ChatModal({ otherUserId, onClose, orderContext, embedded, chatSettings }: ChatModalProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const settings = chatSettings || DEFAULT_SETTINGS;
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [pendingOrderContext, setPendingOrderContext] = useState<OrderContext | null>(orderContext || null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [translations, setTranslations] = useState<TranslationCache>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [showTranslated, setShowTranslated] = useState<Set<string>>(new Set());
  const [outboundPreview, setOutboundPreview] = useState<string | null>(null);
  const [outboundTranslating, setOutboundTranslating] = useState(false);
  const [showOutboundPreview, setShowOutboundPreview] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contextSentRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevMsgCount = useRef(0);
  const outboundDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tr = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
    audioRef.current.volume = 0.3;
  }, []);

  useEffect(() => {
    if (settings.sound_enabled && messages.length > prevMsgCount.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender_id !== user?.id) {
        audioRef.current?.play().catch(() => {});
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages, settings.sound_enabled, user]);

  useEffect(() => {
    if (!user || !otherUserId) return;
    initChat();
  }, [user, otherUserId]);

  // Realtime subscription for new messages AND read_at updates
  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`direct-messages:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
          setTimeout(() => scrollToBottom(), 50);
          if (payload.new.sender_id !== user?.id) {
            markMessagesRead(chatId);
            if (settings.auto_translate && payload.new.content) {
              translateMessage(payload.new as Message);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev => prev.map(m => {
            if (m.id === updated.id) {
              return { ...m, read_at: updated.read_at, _status: updated.read_at ? 'read' : m._status };
            }
            return m;
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, user]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom(false);
    if (settings.auto_translate) {
      messages.forEach(msg => {
        if (msg.sender_id !== user?.id && msg.content && !translations[msg.id] && !translatingIds.has(msg.id)) {
          translateMessage(msg);
        }
      });
    }
  }, [messages.length]);

  // Outbound translation preview debounced
  useEffect(() => {
    if (!settings.outbound_translate_to || !input.trim()) {
      setOutboundPreview(null);
      setShowOutboundPreview(false);
      return;
    }

    if (outboundDebounceRef.current) clearTimeout(outboundDebounceRef.current);

    outboundDebounceRef.current = setTimeout(async () => {
      const text = input.trim();
      if (!text) return;
      setOutboundTranslating(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.access_token) return;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            target_lang: settings.outbound_translate_to,
            text,
          }),
        });

        if (!response.ok) throw new Error('Translation failed');
        const data = await response.json();
        if (data.translatedText && data.translatedText !== text) {
          setOutboundPreview(data.translatedText);
          setShowOutboundPreview(true);
        } else {
          setOutboundPreview(null);
          setShowOutboundPreview(false);
        }
      } catch {
        setOutboundPreview(null);
        setShowOutboundPreview(false);
      } finally {
        setOutboundTranslating(false);
      }
    }, 600);

    return () => {
      if (outboundDebounceRef.current) clearTimeout(outboundDebounceRef.current);
    };
  }, [input, settings.outbound_translate_to]);

  async function translateMessage(msg: Message) {
    if (translatingIds.has(msg.id) || translations[msg.id]) return;
    if (!msg.content || msg.content.startsWith('[order_ref:')) return;

    setTranslatingIds(prev => new Set(prev).add(msg.id));

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) return;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          message_id: msg.id,
          target_lang: settings.translate_to,
          text: msg.content,
        }),
      });

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      if (data.translatedText) {
        setTranslations(prev => ({
          ...prev,
          [msg.id]: { text: data.translatedText, sourceLang: data.sourceLang },
        }));
        if (settings.auto_translate) {
          setShowTranslated(prev => new Set(prev).add(msg.id));
        }
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    }
  }

  function toggleTranslation(msg: Message) {
    if (showTranslated.has(msg.id)) {
      setShowTranslated(prev => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    } else {
      if (!translations[msg.id]) {
        translateMessage(msg);
      }
      setShowTranslated(prev => new Set(prev).add(msg.id));
    }
  }

  async function initChat() {
    if (!user) return;
    if (user.id === otherUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await loadOtherUser();
      await checkBlockStatus();
      const id = await getOrCreateChat();
      setChatId(id);
      await loadMessages(id);
      await markMessagesRead(id);
      if (pendingOrderContext && !contextSentRef.current) {
        contextSentRef.current = true;
        await sendOrderCitation(id, pendingOrderContext);
      }
    } finally {
      setLoading(false);
    }
    setTimeout(() => scrollToBottom(false), 100);
    inputRef.current?.focus();
  }

  async function checkBlockStatus() {
    if (!user || !otherUserId) return;
    const { data: myBlock } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', otherUserId)
      .maybeSingle();
    setIsBlocked(!!myBlock);

    const { data: theirBlock } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', otherUserId)
      .eq('blocked_id', user.id)
      .maybeSingle();
    setBlockedByOther(!!theirBlock);
  }

  async function toggleBlock() {
    if (!user || !otherUserId || blockLoading) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', otherUserId);
        setIsBlocked(false);
      } else {
        await supabase
          .from('blocked_users')
          .insert({ blocker_id: user.id, blocked_id: otherUserId });
        setIsBlocked(true);
      }
    } catch (err) {
      console.error('Error toggling block:', err);
    } finally {
      setBlockLoading(false);
      setShowMenu(false);
    }
  }

  async function sendOrderCitation(chatId: string, ctx: OrderContext) {
    if (!user) return;
    const citation = `[order_ref:${ctx.orderId}:${ctx.productName}]`;
    const { error } = await supabase
      .from('direct_messages')
      .insert({ chat_id: chatId, sender_id: user.id, content: citation, image_url: null, metadata: { orderContext: ctx } });
    if (error) return;

    const uid = user.id;
    const oid = otherUserId;
    const isUser1 = uid < oid;
    const col = isUser1 ? 'user2_unread' : 'user1_unread';
    const preview = tr(`Pedido: ${ctx.productName}`, `Order: ${ctx.productName}`, `Pedido: ${ctx.productName}`);
    await supabase
      .from('direct_chats')
      .update({ last_message: preview, last_message_at: new Date().toISOString() })
      .eq('id', chatId);
    await supabase.rpc('increment_chat_unread', { p_chat_id: chatId, p_column: col });
    setPendingOrderContext(null);
    await loadMessages(chatId);
    setTimeout(() => scrollToBottom(true), 100);
  }

  async function loadOtherUser() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, theme_color, last_seen_at, username')
      .eq('id', otherUserId)
      .maybeSingle();
    setOtherUser(data);
  }

  async function getOrCreateChat(): Promise<string> {
    if (!user) return '';
    const uid = user.id;
    const oid = otherUserId;
    const u1 = uid < oid ? uid : oid;
    const u2 = uid < oid ? oid : uid;

    const { data: existing } = await supabase
      .from('direct_chats')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from('direct_chats')
      .insert({ user1_id: u1, user2_id: u2 })
      .select('id')
      .single();

    if (error) throw error;
    return created.id;
  }

  async function loadMessages(id: string) {
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('chat_id', id)
      .order('created_at', { ascending: true });
    const loaded: Message[] = (data || []).map(m => ({
      ...m,
      _status: m.sender_id === user?.id ? (m.read_at ? 'read' : 'sent') : undefined,
    }));
    setMessages(loaded);
  }

  async function markMessagesRead(id: string) {
    if (!user) return;
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('chat_id', id)
      .neq('sender_id', user.id)
      .is('read_at', null);

    const uid = user.id;
    const oid = otherUserId;
    const isUser1 = uid < oid;
    await supabase
      .from('direct_chats')
      .update(isUser1 ? { user1_unread: 0 } : { user2_unread: 0 })
      .eq('id', id);
  }

  async function uploadChatImg(file: File): Promise<string | null> {
    const fileName = `chat/${user!.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const bucket = 'support-images';
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadChatImg(file);
      if (url) setImageUrl(url);
    } finally {
      setUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = '';
    }
  }

  async function sendMessage() {
    if ((!input.trim() && !imageUrl) || !chatId || !user || sending) return;
    if (isBlocked || blockedByOther) return;

    // Use translated preview if outbound translation is active
    const originalContent = input.trim();
    const contentToSend = (settings.outbound_translate_to && outboundPreview && showOutboundPreview)
      ? outboundPreview
      : originalContent;
    const imgToSend = imageUrl;
    const tempId = `temp-${Date.now()}`;

    // Optimistic message
    const optimisticMsg: Message = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: contentToSend,
      image_url: imgToSend,
      read_at: null,
      created_at: new Date().toISOString(),
      _status: 'sending',
      _originalContent: settings.outbound_translate_to && outboundPreview ? originalContent : undefined,
      _translatedContent: settings.outbound_translate_to && outboundPreview ? outboundPreview : undefined,
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');
    setImageUrl(null);
    setOutboundPreview(null);
    setShowOutboundPreview(false);
    setSending(true);
    scrollToBottom();

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({ chat_id: chatId, sender_id: user.id, content: contentToSend, image_url: imgToSend })
        .select('*')
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, id: data.id, _status: 'sent' as MessageStatus }
          : m
      ));

      const uid = user.id;
      const oid = otherUserId;
      const isUser1 = uid < oid;
      const preview = contentToSend.length > 60 ? contentToSend.slice(0, 60) + '…' : (imgToSend ? '📷 Image' : contentToSend);
      await supabase
        .from('direct_chats')
        .update({ last_message: preview, last_message_at: new Date().toISOString() })
        .eq('id', chatId);

      const col = isUser1 ? 'user2_unread' : 'user1_unread';
      await supabase.rpc('increment_chat_unread', { p_chat_id: chatId, p_column: col });
    } catch (err) {
      console.error('Error sending message:', err);
      // Mark message as error so user can retry
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, _status: 'error' as MessageStatus, content: originalContent }
          : m
      ));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function retryMessage(msg: Message) {
    if (!chatId || !user) return;
    const tempId = msg.id;

    // Reset to sending status
    setMessages(prev => prev.map(m =>
      m.id === tempId
        ? { ...m, _status: 'sending' as MessageStatus }
        : m
    ));

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({ chat_id: chatId, sender_id: user.id, content: msg.content, image_url: msg.image_url })
        .select('*')
        .single();

      if (error) throw error;

      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, id: data.id, _status: 'sent' as MessageStatus }
          : m
      ));

      const uid = user.id;
      const oid = otherUserId;
      const isUser1 = uid < oid;
      const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : (msg.image_url ? '📷 Image' : msg.content);
      await supabase
        .from('direct_chats')
        .update({ last_message: preview, last_message_at: new Date().toISOString() })
        .eq('id', chatId);

      const col = isUser1 ? 'user2_unread' : 'user1_unread';
      await supabase.rpc('increment_chat_unread', { p_chat_id: chatId, p_column: col });
    } catch (err) {
      console.error('Retry failed:', err);
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, _status: 'error' as MessageStatus }
          : m
      ));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && settings.enter_to_send) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function groupMessages() {
    const groups: { date: string; messages: Message[] }[] = [];
    messages.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      const last = groups[groups.length - 1];
      if (last && last.date === date) {
        last.messages.push(msg);
      } else {
        groups.push({ date, messages: [msg] });
      }
    });
    return groups;
  }

  function renderStatusIcon(msg: Message) {
    if (msg.sender_id !== user?.id) return null;
    if (msg._status === 'sending') {
      return <Loader2 className="h-3 w-3 text-white/60 animate-spin shrink-0" />;
    }
    if (msg._status === 'error') {
      return (
        <button
          onClick={() => retryMessage(msg)}
          className="flex items-center gap-0.5 text-red-300 hover:text-red-200 transition-colors shrink-0"
          title={tr('Falha ao enviar. Toque para reenviar.', 'Failed to send. Tap to retry.', 'Error al enviar. Toca para reintentar.')}
        >
          <AlertCircle className="h-3 w-3" />
          <RefreshCw className="h-2.5 w-2.5" />
        </button>
      );
    }
    if (msg._status === 'read' || msg.read_at) {
      return <CheckCheck className="h-3 w-3 text-blue-200 shrink-0" />;
    }
    return <Check className="h-3 w-3 text-white/60 shrink-0" />;
  }

  const themeColor = otherUser?.theme_color || '#3b82f6';

  return (
    <div className={embedded ? "flex flex-col h-full" : "fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:p-4 pointer-events-none"}>
      {!embedded && (
        <div
          className="absolute inset-0 bg-black/40 sm:hidden pointer-events-auto"
          onClick={onClose}
        />
      )}

      <div className={embedded ? "relative w-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden h-full" : "relative pointer-events-auto w-full sm:w-96 bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"}
        style={embedded ? undefined : { height: 'min(580px, 90dvh)' }}>

        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0 relative"
          style={{ background: `linear-gradient(135deg, ${themeColor}dd, ${themeColor}aa)` }}
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white/20 flex items-center justify-center">
            {otherUser?.avatar_url ? (
              <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <button
              onClick={() => {
                const ident = otherUser?.username || otherUser?.id;
                if (ident) { window.history.pushState(null, '', `/user/${ident}`); window.dispatchEvent(new PopStateEvent('popstate')); }
              }}
              className="font-semibold text-white truncate text-sm hover:underline text-left"
            >
              {otherUser?.full_name || tr('Usuário', 'User', 'Usuario')}
            </button>
            <div className="flex items-center gap-2">
              <OnlineBadge
                lastSeenAt={otherUser?.last_seen_at}
                language={language}
                showLabel
                size="sm"
              />
              {settings.auto_translate && (
                <span className="flex items-center gap-0.5 text-white/70 text-[10px]">
                  <Languages className="h-2.5 w-2.5" />
                  {LANG_LABELS[settings.translate_to]?.split(' ')[0]}
                </span>
              )}
              {settings.outbound_translate_to && (
                <span className="flex items-center gap-0.5 text-white/70 text-[10px]">
                  <Send className="h-2.5 w-2.5" />
                  {LANG_FLAGS[settings.outbound_translate_to]}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {settings.sound_enabled ? (
              <Volume2 className="h-4 w-4 text-white/50" />
            ) : (
              <VolumeX className="h-4 w-4 text-white/50" />
            )}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1">
                    <button
                      onClick={() => {
                        const ident = otherUser?.username || otherUser?.id;
                        if (ident) { window.history.pushState(null, '', `/user/${ident}`); window.dispatchEvent(new PopStateEvent('popstate')); }
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <User className="h-4 w-4" />
                      {tr('Ver perfil', 'View profile', 'Ver perfil')}
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowSettingsModal(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <Settings className="h-4 w-4" />
                      {tr('Configurações', 'Settings', 'Configuración')}
                    </button>
                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                    <button
                      onClick={toggleBlock}
                      disabled={blockLoading}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                        isBlocked
                          ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                      }`}
                    >
                      {isBlocked
                        ? <><CheckCircle className="h-4 w-4" /> {tr('Desbloquear', 'Unblock', 'Desbloquear')}</>
                        : <><Ban className="h-4 w-4" /> {tr('Bloquear', 'Block', 'Bloquear')}</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
            {!embedded && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* No outside contact warning */}
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-start gap-2 shrink-0">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
            {tr(
              'Proibido compartilhar contatos externos (WhatsApp, email, redes sociais). Toda comunicação deve ser pelo chat do site.',
              'Sharing external contacts (WhatsApp, email, social media) is prohibited. All communication must stay on the site chat.',
              'Prohibido compartir contactos externos (WhatsApp, email, redes sociales). Toda comunicación debe ser por el chat del sitio.'
            )}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scroll-smooth bg-gray-50 dark:bg-gray-900">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ backgroundColor: `${themeColor}22` }}
              >
                <Circle className="h-6 w-6" style={{ color: themeColor }} />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tr('Nenhuma mensagem ainda', 'No messages yet', 'Aún no hay mensajes')}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {tr('Seja o primeiro a dizer olá!', 'Be the first to say hello!', '¡Sé el primero en decir hola!')}
              </p>
            </div>
          ) : (
            groupMessages().map(group => (
              <div key={group.date}>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                  <span className="text-xs text-gray-400 capitalize">{group.date}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                </div>
                {group.messages.map((msg, i) => {
                  const isMine = msg.sender_id === user?.id;
                  const prev = group.messages[i - 1];
                  const sameAsPrev = prev?.sender_id === msg.sender_id;
                  const orderCtx = msg.metadata?.orderContext as OrderContext | undefined;
                  const isOrderCitation = !!orderCtx || msg.content?.startsWith('[order_ref:');
                  const hasTranslation = !!translations[msg.id];
                  const isTranslating = translatingIds.has(msg.id);
                  const showTrans = showTranslated.has(msg.id);
                  const canTranslate = msg.content && !isOrderCitation && !msg.image_url;
                  const isError = msg._status === 'error';

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${sameAsPrev ? 'mt-0.5' : 'mt-2'}`}
                    >
                      <div className={`max-w-[80%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                        {isOrderCitation && orderCtx ? (
                          <button
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('open-order-detail', { detail: { orderId: orderCtx.orderId } }));
                            }}
                            className="flex items-center gap-3 p-3 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left max-w-full"
                          >
                            {orderCtx.productImage ? (
                              <img src={orderCtx.productImage} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                                <Package className="h-6 w-6 text-white" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                <ShoppingBag className="h-3 w-3" />
                                {tr('Referência de Pedido', 'Order Reference', 'Referencia de Pedido')}
                              </span>
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{orderCtx.productName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {orderCtx.quantity}x · ${orderCtx.totalUsdt.toFixed(2)} · #{orderCtx.orderId.slice(0, 8)}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          </button>
                        ) : (
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                              isMine
                                ? isError
                                  ? 'bg-red-500/90 text-white rounded-br-sm'
                                  : 'text-white rounded-br-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm shadow-sm'
                            }`}
                            style={isMine && !isError ? { backgroundColor: themeColor } : {}}
                          >
                            {msg.content && (
                              <>
                                {/* Show original (pre-translation) text for outbound translated messages */}
                                {msg._originalContent && msg._translatedContent && (
                                  <p className="opacity-50 text-xs mb-1 line-through">
                                    {msg._originalContent}
                                  </p>
                                )}
                                <p className={showTrans && hasTranslation && settings.show_original ? 'opacity-50 text-xs mb-1 line-through' : ''}>
                                  {msg.content}
                                </p>
                                {showTrans && hasTranslation && (
                                  <p className={`text-sm ${isMine ? 'text-white' : 'text-gray-900 dark:text-white'} ${settings.show_original ? 'border-t border-white/20 dark:border-gray-600/30 pt-1 mt-1' : ''}`}>
                                    {translations[msg.id].text}
                                  </p>
                                )}
                                {isTranslating && (
                                  <p className={`text-xs mt-1 flex items-center gap-1 ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    {tr('Traduzindo...', 'Translating...', 'Traduciendo...')}
                                  </p>
                                )}
                              </>
                            )}
                            {msg.image_url && (
                              <img
                                src={msg.image_url}
                                alt="Image"
                                className="mt-1 rounded-xl max-h-48 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(msg.image_url!, '_blank')}
                              />
                            )}
                          </div>
                        )}
                        <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[10px] text-gray-400">{formatTime(msg.created_at)}</span>
                          {/* Status icon for own messages */}
                          {isMine && renderStatusIcon(msg)}
                          {canTranslate && (
                            <button
                              onClick={() => toggleTranslation(msg)}
                              disabled={isTranslating}
                              className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md transition-all disabled:opacity-50 ${
                                showTrans
                                  ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                              }`}
                              title={showTrans ? tr('Ver original', 'Show original', 'Ver original') : tr('Traduzir', 'Translate', 'Traducir')}
                            >
                              {isTranslating ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : showTrans ? (
                                <Check className="h-2.5 w-2.5" />
                              ) : (
                                <Languages className="h-2.5 w-2.5" />
                              )}
                              {!showTrans && !isTranslating && tr('Traduzir', 'Translate', 'Traducir')}
                            </button>
                          )}
                          {hasTranslation && showTrans && translations[msg.id]?.sourceLang && (
                            <span className="text-[9px] text-gray-300 dark:text-gray-500">
                              {translations[msg.id].sourceLang} → {settings.translate_to}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Blocked banner */}
        {(isBlocked || blockedByOther) && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 text-center shrink-0">
            <p className="text-sm text-red-600 dark:text-red-400">
              {isBlocked
                ? tr('Você bloqueou este usuário. Desbloqueie para enviar mensagens.', 'You blocked this user. Unblock to send messages.', 'Bloqueaste a este usuario. Desbloquea para enviar mensajes.')
                : tr('Este usuário bloqueou você.', 'This user blocked you.', 'Este usuario te bloqueó.')}
            </p>
            {isBlocked && (
              <button
                onClick={toggleBlock}
                disabled={blockLoading}
                className="mt-2 px-4 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors disabled:opacity-40"
              >
                {tr('Desbloquear', 'Unblock', 'Desbloquear')}
              </button>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900">
          {/* Outbound translation preview */}
          {settings.outbound_translate_to && showOutboundPreview && outboundPreview && input.trim() && (
            <div className="mb-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  <Languages className="h-3 w-3" />
                  {tr('Tradução', 'Translation', 'Traducción')} → {LANG_FLAGS[settings.outbound_translate_to]} {LANG_LABELS[settings.outbound_translate_to]}
                </span>
                <button
                  onClick={() => setShowOutboundPreview(false)}
                  className="text-blue-400 hover:text-blue-600 text-[10px]"
                >
                  {tr('ocultar', 'hide', 'ocultar')}
                </button>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{outboundPreview}</p>
            </div>
          )}

          {imageUrl && (
            <div className="relative mb-2">
              <img src={imageUrl} alt="Preview" className="rounded-xl max-h-28 w-full object-cover border border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => setImageUrl(null)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800 rounded-2xl px-3 py-2">
            <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImgChange} className="hidden" />
            <button
              onClick={() => imgInputRef.current?.click()}
              disabled={uploadingImg}
              className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-40 mb-0.5"
              title={tr('Enviar imagem', 'Send image', 'Enviar imagen')}
            >
              {uploadingImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={1000}
              disabled={isBlocked || blockedByOther}
              placeholder={isBlocked || blockedByOther ? tr('Bloqueado', 'Blocked', 'Bloqueado') : tr('Digite uma mensagem...', 'Type a message...', 'Escribe un mensaje...')}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none min-h-[24px] max-h-[120px] overflow-y-auto"
              style={{ lineHeight: '1.5' }}
            />
            {outboundTranslating && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 mb-0.5 shrink-0" />
            )}
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && !imageUrl) || sending || isBlocked || blockedByOther}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: (input.trim() || imageUrl) ? themeColor : undefined }}
            >
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                : <Send className="h-4 w-4 text-white" />
              }
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-1">
            {settings.enter_to_send
              ? `Enter ${tr('para enviar', 'to send', 'para enviar')} · Shift+Enter ${tr('para nova linha', 'for new line', 'para nueva línea')}`
              : `Enter ${tr('para nova linha', 'for new line', 'para nueva línea')}`
            }
          </p>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <ChatSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          settings={settings}
          onSave={(s) => {
            setShowSettingsModal(false);
          }}
          isSaving={false}
        />
      )}
    </div>
  );
}
