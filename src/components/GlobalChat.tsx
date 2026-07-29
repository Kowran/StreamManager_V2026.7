import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, Loader2, BadgeCheck, MessageCircle, ImagePlus, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface GlobalMessage {
  id: string;
  sender_id: string | null;
  content: string;
  image_url: string | null;
  is_admin_message: boolean;
  created_at: string;
}

export function GlobalChat({ isAdmin, siteLogo }: { isAdmin: boolean; siteLogo?: string | null }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<GlobalMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const openRef = useRef(false);

  const tr = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  openRef.current = open;

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
    audioRef.current.volume = 0.3;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('global_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error loading global chat:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load last read timestamp
  const loadLastRead = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('global_chat_reads')
        .select('last_read_at')
        .eq('user_id', user.id)
        .maybeSingle();
      setLastReadAt(data?.last_read_at || null);
    } catch {
      // ignore
    }
  }, [user]);

  // Mark all as read
  const markAsRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setLastReadAt(now);
    setUnreadCount(0);
    try {
      await supabase
        .from('global_chat_reads')
        .upsert({ user_id: user.id, last_read_at: now });
    } catch {
      // ignore
    }
  }, [user]);

  // Calculate unread count
  useEffect(() => {
    if (!user || !lastReadAt) {
      setUnreadCount(messages.length);
      return;
    }
    const count = messages.filter(m => new Date(m.created_at) > new Date(lastReadAt)).length;
    setUnreadCount(count);
  }, [messages, lastReadAt, user]);

  // Initial load
  useEffect(() => {
    if (!user) return;
    loadMessages();
    loadLastRead();
  }, [user, loadMessages, loadLastRead]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('global-chat-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_chat_messages' },
        (payload) => {
          const newMsg = payload.new as GlobalMessage;
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom(), 50);

          // Play sound if chat is open and message is from admin
          if (openRef.current && newMsg.sender_id !== user.id) {
            audioRef.current?.play().catch(() => {});
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, scrollToBottom]);

  // Mark as read when opening
  useEffect(() => {
    if (open && user) {
      markAsRead();
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [open, user, markAsRead, scrollToBottom]);

  // Play sound on new message when open
  useEffect(() => {
    if (open && messages.length > prevMsgCount.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender_id !== user?.id) {
        audioRef.current?.play().catch(() => {});
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages, open, user]);

  async function handleImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingImg(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `global-chat/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
    } catch (err) {
      console.error('Error uploading image:', err);
    } finally {
      setUploadingImg(false);
    }
  }

  async function sendMessage() {
    if ((!input.trim() && !imageUrl) || !user) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from('global_chat_messages')
        .insert({
          sender_id: user.id,
          content: input.trim(),
          image_url: imageUrl,
          is_admin_message: true,
        });
      if (error) throw error;
      setInput('');
      setImageUrl(null);
      setTimeout(() => scrollToBottom(), 50);
    } catch (err) {
      console.error('Error sending global message:', err);
      alert(tr('Erro ao enviar mensagem', 'Error sending message', 'Error al enviar mensaje'));
    } finally {
      setSending(false);
    }
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function groupByDate(msgs: GlobalMessage[]) {
    const groups: { date: string; messages: GlobalMessage[] }[] = [];
    msgs.forEach(msg => {
      const dateKey = new Date(msg.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const last = groups[groups.length - 1];
      if (last && last.date === dateKey) {
        last.messages.push(msg);
      } else {
        groups.push({ date: dateKey, messages: [msg] });
      }
    });
    return groups;
  }

  if (!user) return null;

  return (
    <>
      {/* Fixed top bar - only visible when chat is closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          {siteLogo ? (
            <img src={siteLogo} alt="Logo" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="text-sm font-bold flex items-center gap-1">
            Rhoudz Oficial
            <BadgeCheck className="w-4 h-4 text-white" fill="currentColor" />
          </span>
          {unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-md">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
               style={{ height: 'min(70vh, 520px)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                {siteLogo ? (
                  <img src={siteLogo} alt="Logo" className="w-9 h-9 rounded-full object-cover ring-2 ring-white/30" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1">
                    <h3 className="text-base font-bold">Rhoudz Oficial</h3>
                    <BadgeCheck className="w-4 h-4 text-white" fill="currentColor" />
                  </div>
                  <p className="text-[11px] text-white/80">
                    {tr('Chat oficial da plataforma', 'Official platform chat', 'Chat oficial de la plataforma')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 bg-gray-50 dark:bg-gray-950">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                    <MessageCircle className="w-7 h-7 text-blue-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {tr('Nenhuma mensagem ainda', 'No messages yet', 'Aún no hay mensajes')}
                  </p>
                </div>
              ) : (
                groupByDate(messages).map(group => (
                  <div key={group.date}>
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                      <span className="text-xs text-gray-400">{group.date}</span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                    </div>
                    {group.messages.map((msg) => {
                      const isMine = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mt-1`}>
                          <div className={`max-w-[80%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                            {!isMine && (
                              <div className="flex items-center gap-1.5 mb-0.5 px-1">
                                {siteLogo ? (
                                  <img src={siteLogo} alt="" className="w-4 h-4 rounded-full object-cover" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                                    <MessageCircle className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                                  Rhoudz Oficial
                                  <BadgeCheck className="w-3 h-3" fill="currentColor" />
                                </span>
                              </div>
                            )}
                            <div
                              className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                                isMine
                                  ? 'bg-blue-600 text-white rounded-br-sm'
                                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm shadow-sm border border-gray-100 dark:border-gray-700'
                              }`}
                            >
                              {msg.content && <p>{msg.content}</p>}
                              {msg.image_url && (
                                <img
                                  src={msg.image_url}
                                  alt=""
                                  className="mt-1 rounded-xl max-h-40 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(msg.image_url!, '_blank')}
                                />
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input - only admins can send */}
            {isAdmin ? (
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900">
                {imageUrl && (
                  <div className="relative mb-2">
                    <img src={imageUrl} alt="Preview" className="rounded-xl max-h-24 w-full object-cover border border-gray-200 dark:border-gray-700" />
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
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder={tr('Enviar mensagem para todos...', 'Send message to everyone...', 'Enviar mensaje a todos...')}
                    className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none min-h-[24px] max-h-[100px] overflow-y-auto"
                    style={{ lineHeight: '1.5' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={(!input.trim() && !imageUrl) || sending}
                    className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-gray-900 text-center">
                <p className="text-xs text-gray-400">
                  {tr('Apenas administradores podem enviar mensagens neste chat', 'Only administrators can send messages in this chat', 'Solo los administradores pueden enviar mensajes en este chat')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
