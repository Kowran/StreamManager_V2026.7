import React, { useState, useEffect, useCallback } from 'react';
import { Newspaper, ChevronLeft, Plus, Search, Clock, Eye, CreditCard as Edit3, Trash2, Loader2, Send, X, Image as ImageIcon, Star, Calendar, TrendingUp, ArrowRight, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useTheme } from './ThemeProvider';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image_url: string | null;
  category: string;
  tags: string[];
  author_id: string;
  is_published: boolean;
  is_featured: boolean;
  views: number;
  created_at: string;
  updated_at: string;
  author?: { full_name?: string; username?: string; avatar_url?: string | null };
}

type View = 'list' | 'detail' | 'editor';

const CATEGORIES = ['Notícias', 'Atualizações', 'Tutoriais', 'Eventos', 'Reviews', 'Dicas'];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function formatContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />');
}

function timeAgo(date: string, lang: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 7) return new Date(date).toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES');
  if (days > 0) return lang === 'pt' ? `${days}d atrás` : lang === 'en' ? `${days}d ago` : `hace ${days}d`;
  if (hours > 0) return lang === 'pt' ? `${hours}h atrás` : lang === 'en' ? `${hours}h ago` : `hace ${hours}h`;
  if (mins > 0) return lang === 'pt' ? `${mins}min atrás` : lang === 'en' ? `${mins}min ago` : `hace ${mins}min`;
  return lang === 'pt' ? 'agora' : lang === 'en' ? 'now' : 'ahora';
}

export default function Blog({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [featuredPost, setFeaturedPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<View>('list');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const loadUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      setIsAdmin(data?.role === 'admin');
    }
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('blog_posts')
      .select(`
        *,
        author:profiles(full_name, username, avatar_url)
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(24);

    if (activeCategory) query = query.eq('category', activeCategory);
    if (searchQuery.trim()) query = query.or(`title.ilike.%${searchQuery.trim()}%,content.ilike.%${searchQuery.trim()}%`);

    const { data, error } = await query;
    if (error) {
      console.error('Error loading blog posts:', error);
      setPosts([]);
    } else {
      setPosts(data || []);
    }

    // Load featured post
    const { data: featured } = await supabase
      .from('blog_posts')
      .select(`
        *,
        author:profiles(full_name, username, avatar_url)
      `)
      .eq('is_published', true)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setFeaturedPost(featured || null);

    setLoading(false);
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (view === 'list') loadPosts();
  }, [loadPosts, view]);

  // Handle "open specific post" event from Store preview
  useEffect(() => {
    const handler = async (e: Event) => {
      const slug = (e as CustomEvent).detail as string;
      if (!slug) return;
      const { data } = await supabase
        .from('blog_posts')
        .select(`*, author:profiles(full_name, username, avatar_url)`)
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (data) {
        setSelectedPost(data);
        setView('detail');
        await supabase.rpc('increment_blog_views', { p_post_id: data.id });
      }
    };
    window.addEventListener('blog:open', handler);
    return () => window.removeEventListener('blog:open', handler);
  }, []);

  const openPost = async (post: BlogPost) => {
    setSelectedPost(post);
    setView('detail');
    await supabase.rpc('increment_blog_views', { p_post_id: post.id });
  };

  const handleDelete = async (postId: string) => {
    if (!confirm(t.language === 'pt' ? 'Excluir este artigo?' : t.language === 'en' ? 'Delete this article?' : '¿Eliminar este artículo?')) return;
    await supabase.from('blog_posts').delete().eq('id', postId);
    setView('list');
    loadPosts();
  };

  const authorName = (author?: { full_name?: string; username?: string }) => {
    if (!author) return 'Admin';
    return author.username || author.full_name || 'Admin';
  };

  // ---------- EDITOR VIEW ----------
  if (view === 'editor') {
    return <BlogEditor
      post={editingPost}
      onCancel={() => { setView('list'); setEditingPost(null); }}
      onSaved={() => { setView('list'); setEditingPost(null); loadPosts(); }}
    />;
  }

  // ---------- DETAIL VIEW ----------
  if (view === 'detail' && selectedPost) {
    const related = posts.filter(p => p.id !== selectedPost.id && p.category === selectedPost.category).slice(0, 3);
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Hero image */}
        {selectedPost.image_url && (
          <div className="relative w-full h-64 sm:h-80 lg:h-96 overflow-hidden rounded-t-xl">
            <img src={selectedPost.image_url} alt={selectedPost.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>
        )}

        <div className="w-full max-w-3xl mx-auto px-4 py-6">
          <button
            onClick={() => { setView('list'); setSelectedPost(null); }}
            className={`flex items-center gap-2 mb-6 text-sm font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <ChevronLeft className="w-5 h-5" />
            {t.language === 'pt' ? 'Voltar ao blog' : t.language === 'en' ? 'Back to blog' : 'Volver al blog'}
          </button>

          {/* Article header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <Tag className="w-3 h-3 inline mr-1" />{selectedPost.category}
              </span>
              <span className={`flex items-center gap-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <Clock className="w-4 h-4" />{timeAgo(selectedPost.created_at, t.language)}
              </span>
              <span className={`flex items-center gap-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <Eye className="w-4 h-4" />{selectedPost.views + 1}
              </span>
            </div>
            <h1 className={`text-2xl sm:text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {selectedPost.title}
            </h1>
            {selectedPost.excerpt && (
              <p className={`text-base sm:text-lg leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {selectedPost.excerpt}
              </p>
            )}
            <div className={`flex items-center gap-3 mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              {selectedPost.author?.avatar_url && (
                <img src={selectedPost.author.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              )}
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{authorName(selectedPost.author)}</p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {new Date(selectedPost.created_at).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {isAdmin && (
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => { setEditingPost(selectedPost); setView('editor'); }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    <Edit3 className="w-4 h-4" />{t.language === 'pt' ? 'Editar' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedPost.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Article content */}
          <div
            className={`prose max-w-none text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
            dangerouslySetInnerHTML={{ __html: `<p>${formatContent(selectedPost.content)}</p>` }}
          />

          {/* Tags */}
          {selectedPost.tags && selectedPost.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {selectedPost.tags.map((tag, i) => (
                <span key={i} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Related posts */}
          {related.length > 0 && (
            <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t.language === 'pt' ? 'Artigos relacionados' : t.language === 'en' ? 'Related articles' : 'Artículos relacionados'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => openPost(post)}
                    className={`text-left rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'}`}
                  >
                    {post.image_url && (
                      <img src={post.image_url} alt="" className="w-full h-24 object-cover" />
                    )}
                    <div className="p-3">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">{post.category}</p>
                      <p className={`text-sm font-semibold line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{post.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  return (
    <div className={`min-h-screen py-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="w-full mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Newspaper className="w-9 h-9 text-blue-600 dark:text-blue-400" />
              <div>
                <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t.language === 'pt' ? 'Blog' : t.language === 'en' ? 'Blog' : 'Blog'}
                </h1>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t.language === 'pt' ? 'Notícias, atualizações e novidades' : t.language === 'en' ? 'News, updates and announcements' : 'Noticias, actualizaciones y novedades'}
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => { setEditingPost(null); setView('editor'); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                {t.language === 'pt' ? 'Novo Artigo' : t.language === 'en' ? 'New Article' : 'Nuevo Artículo'}
              </button>
            )}
          </div>
        </div>

        {/* Featured post */}
        {featuredPost && !searchQuery && !activeCategory && (
          <button
            onClick={() => openPost(featuredPost)}
            className={`block w-full text-left mb-8 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all group ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          >
            <div className="relative h-48 sm:h-64 lg:h-72 overflow-hidden">
              {featuredPost.image_url ? (
                <img src={featuredPost.image_url} alt={featuredPost.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center">
                  <Newspaper className="w-16 h-16 text-white/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900">
                    <Star className="w-3 h-3 fill-yellow-900" />
                    {t.language === 'pt' ? 'Destaque' : t.language === 'en' ? 'Featured' : 'Destacado'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
                    {featuredPost.category}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 line-clamp-2">{featuredPost.title}</h2>
                {featuredPost.excerpt && (
                  <p className="text-sm sm:text-base text-white/80 line-clamp-2 max-w-2xl">{featuredPost.excerpt}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-white/70 text-xs">
                  <span>{authorName(featuredPost.author)}</span>
                  <span>•</span>
                  <span>{timeAgo(featuredPost.created_at, t.language)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{featuredPost.views}</span>
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Search + category filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.language === 'pt' ? 'Buscar artigos...' : t.language === 'en' ? 'Search articles...' : 'Buscar artículos...'}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${!activeCategory ? 'bg-blue-600 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {t.language === 'pt' ? 'Todos' : 'All'}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-blue-600 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Posts grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : posts.length === 0 ? (
          <div className={`text-center py-20 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Newspaper className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t.language === 'pt' ? 'Nenhum artigo publicado ainda.' : t.language === 'en' ? 'No articles published yet.' : 'Aún no hay artículos publicados.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => (
              <button
                key={post.id}
                onClick={() => openPost(post)}
                className={`text-left rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group ${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:shadow-md'}`}
              >
                <div className="relative h-40 overflow-hidden">
                  {post.image_url ? (
                    <img src={post.image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
                      <Newspaper className="w-12 h-12 text-white/30" />
                    </div>
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-800 backdrop-blur-sm">
                    {post.category}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className={`text-base font-bold mb-2 line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors`}>
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className={`text-sm line-clamp-2 mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {post.excerpt}
                    </p>
                  )}
                  <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(post.created_at, t.language)}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.views}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- BLOG EDITOR ----------
interface BlogEditorProps {
  post: BlogPost | null;
  onCancel: () => void;
  onSaved: () => void;
}

function BlogEditor({ post, onCancel, onSaved }: BlogEditorProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [title, setTitle] = useState(post?.title || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [content, setContent] = useState(post?.content || '');
  const [imageUrl, setImageUrl] = useState(post?.image_url || '');
  const [category, setCategory] = useState(post?.category || 'Notícias');
  const [tagsInput, setTagsInput] = useState(post?.tags?.join(', ') || '');
  const [isPublished, setIsPublished] = useState(post?.is_published ?? true);
  const [isFeatured, setIsFeatured] = useState(post?.is_featured ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError(t.language === 'pt' ? 'Título e conteúdo são obrigatórios.' : 'Title and content are required.');
      return;
    }
    setSaving(true);
    setError('');

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const slug = slugify(title);

    const payload = {
      title: title.trim(),
      slug,
      excerpt: excerpt.trim() || null,
      content: content.trim(),
      image_url: imageUrl.trim() || null,
      category,
      tags,
      is_published: isPublished,
      is_featured: isFeatured,
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (post) {
        const { error: updateError } = await supabase
          .from('blog_posts')
          .update(payload)
          .eq('id', post.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('blog_posts')
          .insert({ ...payload, author_id: user.id });
        if (insertError) throw insertError;
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error saving article');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`min-h-screen py-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="w-full max-w-3xl mx-auto px-4">
        <button
          onClick={onCancel}
          className={`flex items-center gap-2 mb-6 text-sm font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <ChevronLeft className="w-5 h-5" />
          {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
        </button>

        <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {post
            ? (t.language === 'pt' ? 'Editar Artigo' : t.language === 'en' ? 'Edit Article' : 'Editar Artículo')
            : (t.language === 'pt' ? 'Novo Artigo' : t.language === 'en' ? 'New Article' : 'Nuevo Artículo')}
        </h1>

        <div className={`rounded-xl shadow-md p-6 space-y-5 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.language === 'pt' ? 'Título *' : t.language === 'en' ? 'Title *' : 'Título *'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.language === 'pt' ? 'Digite o título...' : t.language === 'en' ? 'Enter title...' : 'Ingresa el título...'}
              className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.language === 'pt' ? 'Resumo' : t.language === 'en' ? 'Excerpt' : 'Resumen'}
            </label>
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder={t.language === 'pt' ? 'Breve descrição do artigo...' : t.language === 'en' ? 'Brief description...' : 'Breve descripción...'}
              className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>

          {/* Image URL */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.language === 'pt' ? 'Imagem de capa (URL)' : t.language === 'en' ? 'Cover image (URL)' : 'Imagen de portada (URL)'}
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
            {imageUrl && (
              <img src={imageUrl} alt="" className="mt-2 w-full h-32 object-cover rounded-lg" />
            )}
          </div>

          {/* Category */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.language === 'pt' ? 'Categoria' : t.language === 'en' ? 'Category' : 'Categoría'}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.language === 'pt' ? 'Tags (separadas por vírgula)' : t.language === 'en' ? 'Tags (comma separated)' : 'Etiquetas (separadas por coma)'}
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="games, atualização, evento"
              className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>

          {/* Content */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.language === 'pt' ? 'Conteúdo *' : t.language === 'en' ? 'Content *' : 'Contenido *'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder={t.language === 'pt' ? 'Escreva o artigo... (suporta **negrito**, *itálico*, # cabeçalhos, - listas, [links](url))' : t.language === 'en' ? 'Write the article... (supports **bold**, *italic*, # headings, - lists, [links](url))' : 'Escribe el artículo... (soporta **negrita**, *cursiva*, # encabezados, - listas, [enlaces](url))'}
              className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col sm:flex-row gap-4">
            <label className={`flex items-center gap-2 cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">{t.language === 'pt' ? 'Publicado' : t.language === 'en' ? 'Published' : 'Publicado'}</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">{t.language === 'pt' ? 'Destaque' : t.language === 'en' ? 'Featured' : 'Destacado'}</span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || !content.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {post ? (t.language === 'pt' ? 'Salvar' : t.language === 'en' ? 'Save' : 'Guardar') : (t.language === 'pt' ? 'Publicar' : t.language === 'en' ? 'Publish' : 'Publicar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- BLOG PREVIEW (for Store) ----------
export function BlogPreview({ onSeeAll }: { onSeeAll: () => void }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [latestPosts, setLatestPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('blog_posts')
        .select(`
          *,
          author:profiles(full_name, username, avatar_url)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(3);
      setLatestPosts(data || []);
    }
    load();
  }, []);

  if (latestPosts.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Newspaper className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t.language === 'pt' ? 'Blog & Notícias' : t.language === 'en' ? 'Blog & News' : 'Blog & Noticias'}
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t.language === 'pt' ? 'Fique por dentro das novidades' : t.language === 'en' ? 'Stay up to date' : 'Mantente al día'}
            </p>
          </div>
        </div>
        <button
          onClick={onSeeAll}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t.language === 'pt' ? 'Ver todos' : t.language === 'en' ? 'See all' : 'Ver todos'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {latestPosts.map((post) => (
          <button
            key={post.id}
            onClick={() => {
              onSeeAll();
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('blog:open', { detail: post.slug }));
              }, 100);
            }}
            className={`text-left rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group ${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:shadow-md'}`}
          >
            <div className="relative h-32 overflow-hidden">
              {post.image_url ? (
                <img src={post.image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
                  <Newspaper className="w-10 h-10 text-white/30" />
                </div>
              )}
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 text-gray-800 backdrop-blur-sm">
                {post.category}
              </span>
            </div>
            <div className="p-3">
              <h3 className={`text-sm font-bold mb-1 line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors`}>
                {post.title}
              </h3>
              <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Clock className="w-3 h-3" />
                {timeAgo(post.created_at, t.language)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
