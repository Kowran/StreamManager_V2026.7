import React, { useState, useEffect, useCallback } from 'react';
import { Newspaper, ChevronLeft, ChevronRight, Plus, Search, Clock, Eye, CreditCard as Edit3, Trash2, Loader2, Send, X, Sparkles, Calendar, ArrowRight, Tag, TrendingUp, Bookmark, User as UserIcon, PenTool } from 'lucide-react';
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

const CATEGORY_COLORS: Record<string, string> = {
  'Notícias': 'from-rose-500 to-red-500',
  'Atualizações': 'from-blue-500 to-cyan-500',
  'Tutoriais': 'from-emerald-500 to-teal-500',
  'Eventos': 'from-amber-500 to-orange-500',
  'Reviews': 'from-violet-500 to-purple-500',
  'Dicas': 'from-pink-500 to-rose-500',
};

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
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-7 mb-3">$1</h1>')
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-medium">$1</a>')
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

function formatDate(date: string, lang: string): string {
  return new Date(date).toLocaleDateString(
    lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
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
  const [popularPosts, setPopularPosts] = useState<BlogPost[]>([]);

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

    // Load popular posts (most viewed)
    const { data: popular } = await supabase
      .from('blog_posts')
      .select(`
        *,
        author:profiles(full_name, username, avatar_url)
      `)
      .eq('is_published', true)
      .order('views', { ascending: false })
      .limit(5);
    setPopularPosts(popular || []);

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
    window.history.pushState(null, '', `/blog/${post.id}`);
    await supabase.rpc('increment_blog_views', { p_post_id: post.id });
  };

  const backToList = () => {
    setView('list');
    setSelectedPost(null);
    window.history.pushState(null, '', '/blog');
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
    const catColor = CATEGORY_COLORS[selectedPost.category] || 'from-blue-500 to-cyan-500';
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        {/* Hero image with overlay */}
        <div className="relative w-full h-72 sm:h-96 lg:h-[480px] overflow-hidden">
          {selectedPost.image_url ? (
            <img src={selectedPost.image_url} alt={selectedPost.title} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${catColor}`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Back button floating */}
          <button
            onClick={backToList}
            className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white text-sm font-medium hover:bg-white/20 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
          </button>

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-12 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${catColor}`}>
                {selectedPost.category}
              </span>
              {selectedPost.is_featured && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900">
                  <Sparkles className="w-3 h-3 fill-yellow-900" />
                  {t.language === 'pt' ? 'Destaque' : t.language === 'en' ? 'Featured' : 'Destacado'}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              {selectedPost.title}
            </h1>
            {selectedPost.excerpt && (
              <p className="text-base sm:text-lg text-white/80 leading-relaxed max-w-2xl">
                {selectedPost.excerpt}
              </p>
            )}
          </div>
        </div>

        <div className="w-full max-w-3xl mx-auto px-4 py-8 -mt-6 relative">
          {/* Author bar */}
          <div className={`flex items-center gap-3 p-4 rounded-2xl mb-6 ${isDark ? 'bg-gray-800/80' : 'bg-white'} shadow-lg backdrop-blur-sm`}>
            <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              {selectedPost.author?.avatar_url ? (
                <img src={selectedPost.author.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{authorName(selectedPost.author)}</p>
              <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <Calendar className="w-3 h-3" />
                {formatDate(selectedPost.created_at, t.language)}
                <span>•</span>
                <Eye className="w-3 h-3" />
                {selectedPost.views + 1} {t.language === 'pt' ? 'visualizações' : 'views'}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingPost(selectedPost); setView('editor'); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.language === 'pt' ? 'Editar' : 'Edit'}</span>
                </button>
                <button
                  onClick={() => handleDelete(selectedPost.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Article content */}
          <article
            className={`prose prose-lg max-w-none text-base leading-relaxed space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
            dangerouslySetInnerHTML={{ __html: `<p>${formatContent(selectedPost.content)}</p>` }}
          />

          {/* Tags */}
          {selectedPost.tags && selectedPost.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              {selectedPost.tags.map((tag, i) => (
                <span key={i} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Related posts */}
          {related.length > 0 && (
            <div className="mt-12">
              <h3 className={`flex items-center gap-2 text-xl font-bold mb-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Sparkles className="w-5 h-5 text-blue-500" />
                {t.language === 'pt' ? 'Artigos relacionados' : t.language === 'en' ? 'Related articles' : 'Artículos relacionados'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((post) => {
                  const pc = CATEGORY_COLORS[post.category] || 'from-blue-500 to-cyan-500';
                  return (
                    <button
                      key={post.id}
                      onClick={() => openPost(post)}
                      className={`text-left rounded-2xl overflow-hidden group transition-all hover:-translate-y-1 ${isDark ? 'bg-gray-800 hover:shadow-2xl' : 'bg-white hover:shadow-xl'} shadow-md`}
                    >
                      <div className="relative h-28 overflow-hidden">
                        {post.image_url ? (
                          <img src={post.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${pc}`} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      </div>
                      <div className="p-4">
                        <span className={`text-xs font-semibold bg-gradient-to-r ${pc} bg-clip-text text-transparent`}>{post.category}</span>
                        <p className={`text-sm font-bold line-clamp-2 mt-1 ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-blue-500 transition-colors`}>{post.title}</p>
                        <div className={`flex items-center gap-2 text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <Clock className="w-3 h-3" />
                          {timeAgo(post.created_at, t.language)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  const mainPosts = featuredPost ? posts.filter(p => p.id !== featuredPost.id) : posts;
  const firstPost = mainPosts[0];
  const restPosts = mainPosts.slice(1);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      {/* Hero banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative w-full max-w-6xl mx-auto px-4 pt-12 pb-10">
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md">
              <PenTool className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">{t.language === 'pt' ? 'Nosso Blog' : t.language === 'en' ? 'Our Blog' : 'Nuestro Blog'}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              {t.language === 'pt' ? 'Notícias, Atualizações & Novidades' : t.language === 'en' ? 'News, Updates & Insights' : 'Noticias, Actualizaciones y Novedades'}
            </h1>
            <p className="text-base sm:text-lg text-white/70 max-w-2xl">
              {t.language === 'pt'
                ? 'Fique por dentro de tudo que acontece no mundo dos games e da plataforma.'
                : t.language === 'en'
                  ? 'Stay up to date with everything happening in gaming and on the platform.'
                  : 'Mantente al día con todo lo que pasa en el mundo gaming y la plataforma.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => { setEditingPost(null); setView('editor'); }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-blue-700 bg-white hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                {t.language === 'pt' ? 'Novo Artigo' : t.language === 'en' ? 'New Article' : 'Nuevo Artículo'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 -mt-6 relative pb-12">
        {/* Featured + first post grid */}
        {!searchQuery && !activeCategory && (featuredPost || firstPost) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
            {/* Featured post - large card */}
            {(featuredPost || firstPost) && (() => {
              const hero = featuredPost || firstPost;
              const catColor = CATEGORY_COLORS[hero.category] || 'from-blue-500 to-cyan-500';
              return (
                <button
                  onClick={() => openPost(hero)}
                  className={`relative group rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all ${featuredPost ? 'lg:row-span-2 min-h-[340px] lg:min-h-full' : 'min-h-[260px]'}`}
                >
                  <div className="absolute inset-0">
                    {hero.image_url ? (
                      <img src={hero.image_url} alt={hero.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${catColor}`} />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {featuredPost && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900">
                          <Sparkles className="w-3 h-3 fill-yellow-900" />
                          {t.language === 'pt' ? 'Destaque' : 'Featured'}
                        </span>
                      )}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${catColor}`}>
                        {hero.category}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 line-clamp-3 group-hover:text-blue-200 transition-colors">
                      {hero.title}
                    </h2>
                    {hero.excerpt && (
                      <p className="text-sm text-white/70 line-clamp-2 max-w-xl">{hero.excerpt}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-white/60 text-xs">
                      <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" />{authorName(hero.author)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(hero.created_at, t.language)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{hero.views}</span>
                    </div>
                  </div>
                </button>
              );
            })()}

            {/* Secondary featured card */}
            {!featuredPost && firstPost && restPosts[0] && (() => {
              const second = restPosts[0];
              const catColor = CATEGORY_COLORS[second.category] || 'from-blue-500 to-cyan-500';
              return (
                <button
                  onClick={() => openPost(second)}
                  className="relative group rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all min-h-[260px]"
                >
                  <div className="absolute inset-0">
                    {second.image_url ? (
                      <img src={second.image_url} alt={second.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${catColor}`} />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${catColor} w-fit mb-3`}>
                      {second.category}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 line-clamp-2 group-hover:text-blue-200 transition-colors">
                      {second.title}
                    </h2>
                    {second.excerpt && <p className="text-sm text-white/70 line-clamp-2">{second.excerpt}</p>}
                    <div className="flex items-center gap-3 mt-3 text-white/60 text-xs">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(second.created_at, t.language)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{second.views}</span>
                    </div>
                  </div>
                </button>
              );
            })()}
          </div>
        )}

        {/* Search + category filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.language === 'pt' ? 'Buscar artigos...' : t.language === 'en' ? 'Search articles...' : 'Buscar artículos...'}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 shadow-sm'}`}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${!activeCategory ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'}`}
            >
              {t.language === 'pt' ? 'Todos' : 'All'}
            </button>
            {CATEGORIES.map((cat) => {
              const catColor = CATEGORY_COLORS[cat] || 'from-blue-500 to-cyan-500';
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat ? `text-white bg-gradient-to-r ${catColor} shadow-md` : isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'}`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Posts grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className={`text-center py-24 rounded-3xl ${isDark ? 'bg-gray-800/50' : 'bg-white'} shadow-sm`}>
            <div className={`w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Newspaper className={`w-10 h-10 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            </div>
            <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t.language === 'pt' ? 'Nenhum artigo publicado ainda.' : t.language === 'en' ? 'No articles published yet.' : 'Aún no hay artículos publicados.'}
            </p>
          </div>
        ) : (
          <>
            {/* Remaining posts grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
              {(searchQuery || activeCategory ? posts : restPosts.slice(featuredPost ? 0 : 1)).map((post) => {
                const catColor = CATEGORY_COLORS[post.category] || 'from-blue-500 to-cyan-500';
                return (
                  <button
                    key={post.id}
                    onClick={() => openPost(post)}
                    className={`text-left rounded-2xl overflow-hidden group transition-all hover:-translate-y-1.5 ${isDark ? 'bg-gray-800/60 hover:shadow-2xl' : 'bg-white hover:shadow-xl'} shadow-md`}
                  >
                    <div className="relative h-44 overflow-hidden">
                      {post.image_url ? (
                        <img src={post.image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${catColor} flex items-center justify-center`}>
                          <Newspaper className="w-10 h-10 text-white/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${catColor} shadow-md`}>
                        {post.category}
                      </span>
                      {post.is_featured && (
                        <span className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900 shadow-md">
                          <Sparkles className="w-3 h-3 fill-yellow-900" />
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className={`text-base font-bold mb-2 line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-blue-500 transition-colors`}>
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className={`text-sm line-clamp-2 mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            {post.author?.avatar_url ? (
                              <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-3 h-3 text-gray-400" />
                            )}
                          </div>
                          <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {authorName(post.author)}
                          </span>
                        </div>
                        <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(post.created_at, t.language)}</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.views}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Popular posts sidebar strip */}
            {!searchQuery && !activeCategory && popularPosts.length > 2 && (
              <div className={`rounded-3xl p-6 ${isDark ? 'bg-gradient-to-br from-gray-800/80 to-gray-900/80' : 'bg-white'} shadow-lg`}>
                <h3 className={`flex items-center gap-2 text-lg font-bold mb-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  {t.language === 'pt' ? 'Mais Lidos' : t.language === 'en' ? 'Most Read' : 'Más Leídos'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {popularPosts.slice(0, 5).map((post, i) => (
                    <button
                      key={post.id}
                      onClick={() => openPost(post)}
                      className={`flex items-start gap-3 text-left group p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}
                    >
                      <span className={`text-2xl font-bold ${i === 0 ? 'text-orange-500' : i === 1 ? 'text-amber-500' : i === 2 ? 'text-yellow-500' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold line-clamp-2 group-hover:text-blue-500 transition-colors ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          {post.title}
                        </p>
                        <div className={`flex items-center gap-2 text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <Eye className="w-3 h-3" />
                          {post.views}
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          {timeAgo(post.created_at, t.language)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
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
    <div className={`min-h-screen py-8 ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <div className="w-full max-w-3xl mx-auto px-4">
        <button
          onClick={onCancel}
          className={`flex items-center gap-2 mb-6 text-sm font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <ChevronLeft className="w-5 h-5" />
          {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
            <PenTool className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {post
              ? (t.language === 'pt' ? 'Editar Artigo' : t.language === 'en' ? 'Edit Article' : 'Editar Artículo')
              : (t.language === 'pt' ? 'Novo Artigo' : t.language === 'en' ? 'New Article' : 'Nuevo Artículo')}
          </h1>
        </div>

        <div className={`rounded-2xl shadow-lg p-6 space-y-5 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
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
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
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
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
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
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            />
            {imageUrl && (
              <div className="mt-3 rounded-xl overflow-hidden">
                <img src={imageUrl} alt="" className="w-full h-40 object-cover" />
              </div>
            )}
          </div>

          {/* Category + Tags row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t.language === 'pt' ? 'Categoria' : t.language === 'en' ? 'Category' : 'Categoría'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t.language === 'pt' ? 'Tags (vírgula)' : t.language === 'en' ? 'Tags (comma)' : 'Etiquetas (coma)'}
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="games, atualização, evento"
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
              />
            </div>
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
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
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
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || !content.trim()}
              className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md"
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
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Newspaper className="h-5 w-5 text-white" />
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
          className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:gap-2 transition-all"
        >
          {t.language === 'pt' ? 'Ver todos' : t.language === 'en' ? 'See all' : 'Ver todos'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {latestPosts.map((post) => {
          const catColor = CATEGORY_COLORS[post.category] || 'from-blue-500 to-cyan-500';
          return (
            <button
              key={post.id}
              onClick={() => {
                onSeeAll();
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('blog:open', { detail: post.slug }));
                }, 100);
              }}
              className={`text-left rounded-2xl overflow-hidden group transition-all hover:-translate-y-1 ${isDark ? 'bg-gray-800 hover:shadow-2xl' : 'bg-white hover:shadow-xl'} shadow-md`}
            >
              <div className="relative h-36 overflow-hidden">
                {post.image_url ? (
                  <img src={post.image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${catColor} flex items-center justify-center`}>
                    <Newspaper className="w-10 h-10 text-white/30" />
                  </div>
                )}
                <span className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${catColor} shadow-md`}>
                  {post.category}
                </span>
              </div>
              <div className="p-4">
                <h3 className={`text-sm font-bold mb-2 line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-blue-500 transition-colors`}>
                  {post.title}
                </h3>
                <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Clock className="w-3 h-3" />
                  {timeAgo(post.created_at, t.language)}
                  <span>•</span>
                  <Eye className="w-3 h-3" />
                  {post.views}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
