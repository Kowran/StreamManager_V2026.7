import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, Pin, Lock, Eye, Reply, ChevronLeft, Plus,
  Search, Users, Clock, CheckCircle, Trash2, Send, Loader2,
  MessageCircle, HelpCircle, Megaphone, BookOpen, Bell, Filter,
  Hash, TrendingUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useTheme } from './ThemeProvider';

interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

interface ForumTopic {
  id: string;
  category_id: string;
  title: string;
  content: string;
  author_id: string;
  is_pinned: boolean;
  is_locked: boolean;
  views: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
  author?: { email: string; full_name?: string; username?: string };
  category?: ForumCategory;
  reply_count?: number;
}

interface ForumReply {
  id: string;
  topic_id: string;
  content: string;
  author_id: string;
  is_solution: boolean;
  created_at: string;
  updated_at: string;
  author?: { email: string; full_name?: string; username?: string };
}

const iconMap: Record<string, React.ComponentType<any>> = {
  MessageSquare,
  HelpCircle,
  Megaphone,
  BookOpen,
  Bell,
  Hash,
  TrendingUp,
  MessageCircle,
};

function getIcon(name?: string) {
  if (!name) return MessageSquare;
  return iconMap[name] || MessageSquare;
}

function formatContent(content: string, theme: string) {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer" class="${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} hover:underline">$1</a>`)
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/(<li.*<\/li>)/s, '<ul class="list-disc list-inside space-y-1">$1</ul>')
    .replace(/\n/g, '<br />');
}

function timeAgo(date: string, lang: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return lang === 'pt' ? `${days}d atrás` : lang === 'en' ? `${days}d ago` : `hace ${days}d`;
  if (hours > 0) return lang === 'pt' ? `${hours}h atrás` : lang === 'en' ? `${hours}h ago` : `hace ${hours}h`;
  if (mins > 0) return lang === 'pt' ? `${mins}min atrás` : lang === 'en' ? `${mins}min ago` : `hace ${mins}min`;
  return lang === 'pt' ? 'agora' : lang === 'en' ? 'now' : 'ahora';
}

export default function Community() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [newReply, setNewReply] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: '', content: '', category_id: '', image_url: '' });
  const [creatingTopic, setCreatingTopic] = useState(false);

  const loadUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', user.id)
        .maybeSingle();
      setIsAdmin(userData?.user_type === 'admin');
    }
  }, []);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('forum_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (!error && data) setCategories(data);
  }, []);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('forum_topics')
      .select(`
        *,
        author:profiles(email, full_name, username),
        category:forum_categories(*)
      `);
    if (selectedCategory) query = query.eq('category_id', selectedCategory);
    if (searchQuery.trim()) query = query.ilike('title', `%${searchQuery.trim()}%`);

    const { data, error } = await query
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading topics:', error);
      setTopics([]);
    } else {
      const topicsWithCounts = await Promise.all(
        (data || []).map(async (topic) => {
          const { count } = await supabase
            .from('forum_replies')
            .select('id', { count: 'exact', head: true })
            .eq('topic_id', topic.id);
          return { ...topic, reply_count: count || 0 };
        })
      );
      setTopics(topicsWithCounts);
    }
    setLoading(false);
  }, [selectedCategory, searchQuery]);

  const loadReplies = useCallback(async (topicId: string) => {
    const { data, error } = await supabase
      .from('forum_replies')
      .select(`
        *,
        author:profiles(email, full_name, username)
      `)
      .eq('topic_id', topicId)
      .order('is_solution', { ascending: false })
      .order('created_at', { ascending: true });
    if (!error && data) setReplies(data);
  }, []);

  useEffect(() => {
    loadUser();
    loadCategories();
  }, [loadUser, loadCategories]);

  useEffect(() => {
    if (currentView === 'list') loadTopics();
  }, [loadTopics, currentView]);

  const openTopic = async (topic: ForumTopic) => {
    setSelectedTopic(topic);
    setCurrentView('detail');
    await supabase.rpc('increment_topic_views', { topic_uuid: topic.id });
    loadReplies(topic.id);
  };

  const handleCreateTopic = async () => {
    if (!newTopic.title.trim() || !newTopic.content.trim() || !newTopic.category_id) return;
    setCreatingTopic(true);
    const { data, error } = await supabase
      .from('forum_topics')
      .insert({
        title: newTopic.title.trim(),
        content: newTopic.content.trim(),
        category_id: newTopic.category_id,
        image_url: newTopic.image_url.trim() || null,
      })
      .select('id')
      .single();
    setCreatingTopic(false);
    if (error) {
      console.error('Error creating topic:', error);
      return;
    }
    setNewTopic({ title: '', content: '', category_id: '', image_url: '' });
    setCurrentView('list');
    loadTopics();
  };

  const handleReply = async () => {
    if (!newReply.trim() || !selectedTopic || selectedTopic.is_locked) return;
    setReplyLoading(true);
    const { error } = await supabase
      .from('forum_replies')
      .insert({
        topic_id: selectedTopic.id,
        content: newReply.trim(),
      });
    setReplyLoading(false);
    if (error) {
      console.error('Error posting reply:', error);
      return;
    }
    setNewReply('');
    loadReplies(selectedTopic.id);
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm(t.language === 'pt' ? 'Excluir este tópico?' : t.language === 'en' ? 'Delete this topic?' : '¿Eliminar este tema?')) return;
    await supabase.from('forum_topics').delete().eq('id', topicId);
    setCurrentView('list');
    loadTopics();
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm(t.language === 'pt' ? 'Excluir esta resposta?' : t.language === 'en' ? 'Delete this reply?' : '¿Eliminar esta respuesta?')) return;
    await supabase.from('forum_replies').delete().eq('id', replyId);
    if (selectedTopic) loadReplies(selectedTopic.id);
  };

  const togglePin = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    await supabase.from('forum_topics').update({ is_pinned: !topic.is_pinned }).eq('id', topicId);
    loadTopics();
  };

  const toggleLock = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    await supabase.from('forum_topics').update({ is_locked: !topic.is_locked }).eq('id', topicId);
    loadTopics();
  };

  const markSolution = async (replyId: string) => {
    const reply = replies.find(r => r.id === replyId);
    if (!reply) return;
    await supabase.from('forum_replies').update({ is_solution: !reply.is_solution }).eq('id', replyId);
    if (selectedTopic) loadReplies(selectedTopic.id);
  };

  const authorName = (author?: { email: string; full_name?: string; username?: string }) => {
    if (!author) return '—';
    return author.username || author.full_name || author.email;
  };

  const navigateToProfile = (author?: { email: string; full_name?: string; username?: string }, authorId?: string) => {
    if (!author && !authorId) return;
    const ident = author?.username || authorId;
    if (ident) window.location.hash = `#user/${ident}`;
  };

  const AuthorLink = ({ author, authorId, className }: { author?: { email: string; full_name?: string; username?: string }, authorId?: string, className?: string }) => {
    if (!author && !authorId) return <span className={className}>—</span>;
    return (
      <button
        onClick={() => navigateToProfile(author, authorId)}
        className={`${className || ''} hover:underline cursor-pointer`}
      >
        {authorName(author)}
      </button>
    );
  };

  // ---------- CREATE TOPIC VIEW ----------
  if (currentView === 'create') {
    return (
      <div className={`min-h-screen py-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-3xl mx-auto px-4">
          <button
            onClick={() => setCurrentView('list')}
            className={`flex items-center gap-2 mb-6 text-sm font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <ChevronLeft className="w-5 h-5" />
            {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
          </button>

          <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t.language === 'pt' ? 'Criar Tópico' : t.language === 'en' ? 'Create Topic' : 'Crear Tema'}
          </h1>

          <div className={`rounded-xl shadow-md p-6 space-y-5 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t.language === 'pt' ? 'Categoria *' : t.language === 'en' ? 'Category *' : 'Categoría *'}
              </label>
              <select
                value={newTopic.category_id}
                onChange={(e) => setNewTopic({ ...newTopic, category_id: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                <option value="">{t.language === 'pt' ? 'Selecione...' : t.language === 'en' ? 'Select...' : 'Seleccionar...'}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t.language === 'pt' ? 'Título *' : t.language === 'en' ? 'Title *' : 'Título *'}
              </label>
              <input
                type="text"
                value={newTopic.title}
                onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                placeholder={t.language === 'pt' ? 'Digite o título do tópico...' : t.language === 'en' ? 'Enter topic title...' : 'Ingresa el título del tema...'}
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t.language === 'pt' ? 'Conteúdo *' : t.language === 'en' ? 'Content *' : 'Contenido *'}
              </label>
              <textarea
                value={newTopic.content}
                onChange={(e) => setNewTopic({ ...newTopic, content: e.target.value })}
                rows={8}
                placeholder={t.language === 'pt' ? 'Escreva sua mensagem... (suporta **negrito**, *itálico*, [links](url))' : t.language === 'en' ? 'Write your message... (supports **bold**, *italic*, [links](url))' : 'Escribe tu mensaje... (soporta **negrita**, *cursiva*, [enlaces](url))'}
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t.language === 'pt' ? 'Imagem (URL, opcional)' : t.language === 'en' ? 'Image (URL, optional)' : 'Imagen (URL, opcional)'}
              </label>
              <input
                type="url"
                value={newTopic.image_url}
                onChange={(e) => setNewTopic({ ...newTopic, image_url: e.target.value })}
                placeholder="https://..."
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCurrentView('list')}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                onClick={handleCreateTopic}
                disabled={creatingTopic || !newTopic.title.trim() || !newTopic.content.trim() || !newTopic.category_id}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {creatingTopic ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {t.language === 'pt' ? 'Publicar' : t.language === 'en' ? 'Post' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- TOPIC DETAIL VIEW ----------
  if (currentView === 'detail' && selectedTopic) {
    const cat = selectedTopic.category;
    const CatIcon = getIcon(cat?.icon);
    return (
      <div className={`min-h-screen py-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-4xl mx-auto px-4">
          <button
            onClick={() => { setCurrentView('list'); setSelectedTopic(null); }}
            className={`flex items-center gap-2 mb-6 text-sm font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <ChevronLeft className="w-5 h-5" />
            {t.language === 'pt' ? 'Voltar ao fórum' : t.language === 'en' ? 'Back to forum' : 'Volver al foro'}
          </button>

          {/* Topic header */}
          <div className={`rounded-xl shadow-md overflow-hidden mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} ${selectedTopic.is_pinned ? 'border-2 border-yellow-400' : ''}`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {cat && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                    <CatIcon className="w-4 h-4" />
                    {cat.name}
                  </span>
                )}
                {selectedTopic.is_pinned && <Pin className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                {selectedTopic.is_locked && <Lock className="w-4 h-4 text-red-500" />}
              </div>
              <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedTopic.title}</h1>
              <div className={`flex items-center gap-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <AuthorLink author={selectedTopic.author} authorId={selectedTopic.author_id} />
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{timeAgo(selectedTopic.created_at, t.language)}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{selectedTopic.views + 1}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Reply className="w-4 h-4" />{replies.length}</span>
              </div>
            </div>

            {selectedTopic.image_url && (
              <div className="px-6 pb-4">
                <img src={selectedTopic.image_url} alt={selectedTopic.title} className="w-full max-h-[400px] object-cover rounded-lg" />
              </div>
            )}

            <div className={`px-6 pb-6 text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
              dangerouslySetInnerHTML={{ __html: formatContent(selectedTopic.content, theme) }} />

            {isAdmin && (
              <div className={`flex items-center gap-2 px-6 py-3 border-t ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}>
                <button onClick={() => togglePin(selectedTopic.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedTopic.is_pinned ? 'bg-yellow-500 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  <Pin className="w-4 h-4 inline mr-1" />{selectedTopic.is_pinned ? (t.language === 'pt' ? 'Desafixar' : 'Unpin') : (t.language === 'pt' ? 'Fixar' : 'Pin')}
                </button>
                <button onClick={() => toggleLock(selectedTopic.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedTopic.is_locked ? 'bg-red-500 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  <Lock className="w-4 h-4 inline mr-1" />{selectedTopic.is_locked ? (t.language === 'pt' ? 'Desbloquear' : 'Unlock') : (t.language === 'pt' ? 'Bloquear' : 'Lock')}
                </button>
                <button onClick={() => handleDeleteTopic(selectedTopic.id)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                  <Trash2 className="w-4 h-4 inline mr-1" />{t.language === 'pt' ? 'Excluir' : 'Delete'}
                </button>
              </div>
            )}
          </div>

          {/* Replies */}
          <div className="space-y-4 mb-6">
            {replies.map((reply) => (
              <div key={reply.id} className={`rounded-xl shadow-sm p-5 ${reply.is_solution ? 'border-2 border-green-400' : ''} ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                {reply.is_solution && (
                  <div className="flex items-center gap-2 mb-3 text-green-500 font-semibold text-sm">
                    <CheckCircle className="w-5 h-5" />
                    {t.language === 'pt' ? 'Solução aceita' : t.language === 'en' ? 'Accepted solution' : 'Solución aceptada'}
                  </div>
                )}
                <div className={`text-base leading-relaxed mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                  dangerouslySetInnerHTML={{ __html: formatContent(reply.content, theme) }} />
                <div className={`flex items-center justify-between pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <AuthorLink author={reply.author} authorId={reply.author_id} /> • {timeAgo(reply.created_at, t.language)}
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button onClick={() => markSolution(reply.id)} className={`p-1.5 rounded-lg transition-colors ${reply.is_solution ? 'text-green-500' : isDark ? 'text-gray-500 hover:text-green-400' : 'text-gray-400 hover:text-green-600'}`} title={t.language === 'pt' ? 'Marcar como solução' : 'Mark as solution'}>
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    {(isAdmin || reply.author_id === userId) && (
                      <button onClick={() => handleDeleteReply(reply.id)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reply box */}
          {!selectedTopic.is_locked ? (
            <div className={`rounded-xl shadow-md p-5 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <textarea
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                rows={3}
                placeholder={t.language === 'pt' ? 'Escreva sua resposta...' : t.language === 'en' ? 'Write your reply...' : 'Escribe tu respuesta...'}
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y mb-3 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
              <button
                onClick={handleReply}
                disabled={replyLoading || !newReply.trim()}
                className="px-6 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {replyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {t.language === 'pt' ? 'Responder' : t.language === 'en' ? 'Reply' : 'Responder'}
              </button>
            </div>
          ) : (
            <div className={`rounded-xl p-5 text-center ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
              <Lock className="w-6 h-6 mx-auto mb-2" />
              {t.language === 'pt' ? 'Este tópico está bloqueado.' : t.language === 'en' ? 'This topic is locked.' : 'Este tema está bloqueado.'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- TOPIC LIST VIEW (default) ----------
  return (
    <div className={`min-h-screen py-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-9 h-9 text-blue-600" />
              <div>
                <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t.language === 'pt' ? 'Fórum' : t.language === 'en' ? 'Forum' : 'Foro'}
                </h1>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t.language === 'pt' ? 'Tire dúvidas, compartilhe e discuta com a comunidade' : t.language === 'en' ? 'Ask questions, share and discuss with the community' : 'Pregunta, comparte y discute con la comunidad'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setCurrentView('create')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              {t.language === 'pt' ? 'Novo Tópico' : t.language === 'en' ? 'New Topic' : 'Nuevo Tema'}
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar - Categories */}
          <div className="hidden md:block w-56 flex-shrink-0">
            <div className={`rounded-xl shadow-sm p-4 sticky top-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <div className={`flex items-center gap-2 mb-3 pb-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                <Filter className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t.language === 'pt' ? 'Categorias' : t.language === 'en' ? 'Categories' : 'Categorías'}
                </h3>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !selectedCategory
                      ? 'bg-blue-600 text-white'
                      : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  {t.language === 'pt' ? 'Todos' : t.language === 'en' ? 'All' : 'Todos'}
                </button>
                {categories.map((cat) => {
                  const Icon = getIcon(cat.icon);
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" style={{ color: isActive ? undefined : cat.color }} />
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Search */}
            <div className="mb-4 relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.language === 'pt' ? 'Buscar tópicos...' : t.language === 'en' ? 'Search topics...' : 'Buscar temas...'}
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>

            {/* Mobile category filter */}
            <div className="md:hidden mb-4 flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${!selectedCategory ? 'bg-blue-600 text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
              >
                {t.language === 'pt' ? 'Todos' : 'All'}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Topics list */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : topics.length === 0 ? (
              <div className={`text-center py-16 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t.language === 'pt' ? 'Nenhum tópico ainda. Seja o primeiro a criar!' : t.language === 'en' ? 'No topics yet. Be the first to create one!' : '¡Aún no hay temas. ¡Sé el primero en crear uno!'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topics.map((topic) => {
                  const cat = topic.category;
                  const CatIcon = getIcon(cat?.icon);
                  return (
                    <div
                      key={topic.id}
                      onClick={() => openTopic(topic)}
                      className={`rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer p-5 ${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'} ${topic.is_pinned ? 'border-l-4 border-yellow-400' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {cat && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                                <CatIcon className="w-3 h-3" />
                                {cat.name}
                              </span>
                            )}
                            {topic.is_pinned && <Pin className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                            {topic.is_locked && <Lock className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                          <h3 className={`text-lg font-semibold mb-1 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{topic.title}</h3>
                          <p className={`text-sm line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                            dangerouslySetInnerHTML={{ __html: formatContent(topic.content, theme) }} />
                          <div className={`flex items-center gap-3 mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            <AuthorLink author={topic.author} authorId={topic.author_id} />
                            <span>•</span>
                            <span>{timeAgo(topic.created_at, t.language)}</span>
                          </div>
                        </div>
                        <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <Reply className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                          <span className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{topic.reply_count || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
