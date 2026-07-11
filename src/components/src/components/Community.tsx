import React, { useState, useEffect } from 'react';
import { Newspaper, Pin, Heart, ThumbsUp, Smile, Star, Youtube, BarChart3, BookOpen, Bell, RefreshCw, MessageCircle, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useTheme } from './ThemeProvider';
import PollCard from './PollCard';
import CreatePollModal from './CreatePollModal';

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  author_id: string;
  category: 'tutorial' | 'news' | 'update' | 'announcement' | 'discussion';
  image_url?: string;
  youtube_url?: string;
  audio_url?: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    email: string;
    name?: string;
  };
  reactions?: {
    like: number;
    love: number;
    smile: number;
    star: number;
  };
  user_reactions?: string[];
  poll?: Poll;
}

interface Poll {
  id: string;
  post_id: string;
  question: string;
  options: string[];
  ends_at: string | null;
  multiple_choice: boolean;
  created_at: string;
}

const reactionIcons = {
  like: ThumbsUp,
  love: Heart,
  smile: Smile,
  star: Star
};

const getReactionLabels = (language: string) => ({
  like: language === 'pt' ? 'Curtir' : language === 'en' ? 'Like' : 'Me gusta',
  love: language === 'pt' ? 'Amei' : language === 'en' ? 'Love' : 'Me encanta',
  smile: language === 'pt' ? 'Legal' : language === 'en' ? 'Cool' : 'Genial',
  star: language === 'pt' ? 'Top' : language === 'en' ? 'Star' : 'Estrella'
});

export default function Community() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [selectedPostForPoll, setSelectedPostForPoll] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
    loadPosts();
  }, [selectedCategory]);

  useEffect(() => {
    if (posts.length > 0) {
      markPostsAsRead();
    }
  }, [posts]);

  const markPostsAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const postIds = posts.map(p => p.id);
    if (postIds.length === 0) return;

    for (const postId of postIds) {
      await supabase
        .from('community_post_reads')
        .upsert(
          { post_id: postId, user_id: user.id },
          { onConflict: 'post_id,user_id' }
        );
    }
  };

  const extractYoutubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^&\s]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);

    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', user.id)
        .single();

      setIsAdmin(userData?.user_type === 'admin');
    }
  };

  const loadPosts = async () => {
    try {
      let query = supabase
        .from('community_posts')
        .select(`
          *,
          author:profiles(email, full_name)
        `);

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      const { data: postsData, error: postsError } = await query
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      const { data: { user } } = await supabase.auth.getUser();

      const postsWithReactions = await Promise.all(
        (postsData || []).map(async (post) => {
          const { data: reactions } = await supabase
            .from('community_post_reactions')
            .select('reaction_type, user_id')
            .eq('post_id', post.id);

          const reactionCounts = {
            like: 0,
            love: 0,
            smile: 0,
            star: 0
          };

          const userReactions: string[] = [];

          reactions?.forEach((reaction) => {
            reactionCounts[reaction.reaction_type as keyof typeof reactionCounts]++;
            if (user && reaction.user_id === user.id) {
              userReactions.push(reaction.reaction_type);
            }
          });

          const { data: pollData } = await supabase
            .from('community_polls')
            .select('*')
            .eq('post_id', post.id)
            .maybeSingle();

          return {
            ...post,
            author: post.author ? {
              email: post.author.email,
              name: post.author.full_name || post.author.email
            } : null,
            reactions: reactionCounts,
            user_reactions: userReactions,
            poll: pollData || undefined
          };
        })
      );

      setPosts(postsWithReactions);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    if (!userId) return;

    try {
      const post = posts.find(p => p.id === postId);
      const hasReacted = post?.user_reactions?.includes(reactionType);

      if (hasReacted) {
        await supabase
          .from('community_post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId)
          .eq('reaction_type', reactionType);
      } else {
        await supabase
          .from('community_post_reactions')
          .insert({
            post_id: postId,
            user_id: userId,
            reaction_type: reactionType
          });
      }

      loadPosts();
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const handleCreatePoll = (postId: string) => {
    setSelectedPostForPoll(postId);
    setShowCreatePoll(true);
  };

  const handlePollCreated = () => {
    loadPosts();
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, { pt: string; en: string; es: string }> = {
      tutorial: { pt: 'Tutoriais', en: 'Tutorials', es: 'Tutoriales' },
      news: { pt: 'Novidades', en: 'News', es: 'Novedades' },
      update: { pt: 'Atualizações', en: 'Updates', es: 'Actualizaciones' },
      announcement: { pt: 'Avisos', en: 'Announcements', es: 'Avisos' },
      discussion: { pt: 'Discussões', en: 'Discussions', es: 'Discusiones' }
    };
    return labels[category]?.[t.language] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      tutorial: 'bg-green-100 text-green-800 border-green-300',
      news: 'bg-blue-100 text-blue-800 border-blue-300',
      update: 'bg-orange-100 text-orange-800 border-orange-300',
      announcement: 'bg-red-100 text-red-800 border-red-300',
      discussion: 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ComponentType<any>> = {
      tutorial: BookOpen,
      news: Newspaper,
      update: RefreshCw,
      announcement: Bell,
      discussion: MessageCircle
    };
    return icons[category] || Newspaper;
  };

  const categories = [
    { value: null, label: t.language === 'pt' ? 'Todas' : t.language === 'en' ? 'All' : 'Todas' },
    { value: 'tutorial', label: getCategoryLabel('tutorial') },
    { value: 'news', label: getCategoryLabel('news') },
    { value: 'update', label: getCategoryLabel('update') },
    { value: 'announcement', label: getCategoryLabel('announcement') },
    { value: 'discussion', label: getCategoryLabel('discussion') }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen py-8 ${
      theme === 'dark'
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
        : 'bg-gradient-to-br from-blue-50 via-white to-gray-50'
    }`}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Newspaper className="w-10 h-10 text-blue-600" />
            <h1 className={`text-4xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {t.language === 'pt' ? 'Fórum da Comunidade' : t.language === 'en' ? 'Community Forum' : 'Foro de la Comunidad'}
            </h1>
          </div>
          <p className={`text-lg ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {t.language === 'pt' ? 'Tutoriais, novidades, atualizações e discussões da comunidade' :
             t.language === 'en' ? 'Tutorials, news, updates and community discussions' :
             'Tutoriales, novedades, actualizaciones y discusiones de la comunidad'}
          </p>
        </div>

        <div className={`mb-6 rounded-xl p-4 ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-md'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Filter className={`w-5 h-5 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`} />
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {t.language === 'pt' ? 'Filtrar por categoria' :
               t.language === 'en' ? 'Filter by category' :
               'Filtrar por categoría'}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value || 'all'}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    isSelected
                      ? theme === 'dark'
                        ? 'bg-blue-900 text-blue-200 border-2 border-blue-600'
                        : 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                      : theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-2 border-transparent'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className={`text-center py-16 rounded-xl shadow-md ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            }`}>
              <Newspaper className="w-20 h-20 text-gray-400 mx-auto mb-4" />
              <p className={`text-lg ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {t.language === 'pt' ? 'Nenhum post disponível no momento' :
                 t.language === 'en' ? 'No posts available at the moment' :
                 'No hay publicaciones disponibles en este momento'}
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className={`rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden ${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                } ${
                  post.is_pinned ? 'border-2 border-yellow-400' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    {post.is_pinned && (
                      <div className="flex-shrink-0">
                        <Pin className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        {React.createElement(getCategoryIcon(post.category), {
                          className: `w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`
                        })}
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${
                          getCategoryColor(post.category)
                        }`}>
                          {getCategoryLabel(post.category)}
                        </span>
                      </div>
                      <h2 className={`text-2xl font-bold mb-2 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{post.title}</h2>
                      <p className={`text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {t.language === 'pt' ? 'Por' : t.language === 'en' ? 'By' : 'Por'}: {post.author?.name || post.author?.email || (t.language === 'pt' ? 'Administrador' : t.language === 'en' ? 'Administrator' : 'Administrador')} •{' '}
                        {new Date(post.created_at).toLocaleDateString(
                          t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
                          {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  {post.image_url && (
                    <div className="mb-4 rounded-lg overflow-hidden">
                      <img
                        src={post.image_url}
                        alt={post.title}
                        className="w-full max-h-[500px] object-cover"
                      />
                    </div>
                  )}

                  {post.youtube_url && (() => {
                    const videoId = extractYoutubeId(post.youtube_url);
                    return videoId ? (
                      <div className="mb-4 rounded-lg overflow-hidden aspect-video bg-black">
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}`}
                          className="w-full h-full"
                          allowFullScreen
                          title={post.title}
                        />
                      </div>
                    ) : null;
                  })()}

                  {post.audio_url && (
                    <div className="mb-4">
                      <audio
                        controls
                        className={`w-full rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
                        src={post.audio_url}
                      >
                        {t.language === 'pt' ? 'Seu navegador não suporta o elemento de áudio.' :
                         t.language === 'en' ? 'Your browser does not support the audio element.' :
                         'Su navegador no soporta el elemento de audio.'}
                      </audio>
                    </div>
                  )}

                  <div
                    className={`text-lg leading-relaxed mb-6 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: post.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer" class="${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} hover:underline">$1</a>`)
                        .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                        .replace(/(<li.*<\/li>)/s, '<ul class="list-disc list-inside space-y-1">$1</ul>')
                        .replace(/\n/g, '<br />')
                    }}
                  />

                  {post.poll && (
                    <div className="mt-4">
                      <PollCard poll={post.poll} onVoteUpdate={loadPosts} />
                    </div>
                  )}

                  <div className={`flex items-center gap-2 pt-4 border-t ${
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
                  }`}>
                    {Object.entries(reactionIcons).map(([type, Icon]) => {
                      const count = post.reactions?.[type as keyof typeof post.reactions] || 0;
                      const hasReacted = post.user_reactions?.includes(type);
                      const labels = getReactionLabels(t.language);

                      return (
                        <button
                          key={type}
                          onClick={() => handleReaction(post.id, type)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                            hasReacted
                              ? theme === 'dark'
                                ? 'bg-blue-900 text-blue-300 border-2 border-blue-600'
                                : 'bg-blue-100 text-blue-600 border-2 border-blue-300'
                              : theme === 'dark'
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-2 border-transparent'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                          }`}
                          title={labels[type as keyof typeof labels]}
                        >
                          <Icon className={`w-5 h-5 ${hasReacted ? 'fill-current' : ''}`} />
                          {count > 0 && (
                            <span className="font-medium text-sm">{count}</span>
                          )}
                        </button>
                      );
                    })}
                    {isAdmin && !post.poll && (
                      <button
                        onClick={() => handleCreatePoll(post.id)}
                        className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                          theme === 'dark'
                            ? 'bg-blue-900/40 text-blue-300 hover:bg-blue-900/60 border-2 border-blue-700'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-blue-200'
                        }`}
                        title={t.language === 'pt' ? 'Criar Enquete' : t.language === 'en' ? 'Create Poll' : 'Crear Encuesta'}
                      >
                        <BarChart3 className="w-5 h-5" />
                        <span className="font-medium text-sm">
                          {t.language === 'pt' ? 'Enquete' : t.language === 'en' ? 'Poll' : 'Encuesta'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreatePoll && selectedPostForPoll && (
        <CreatePollModal
          postId={selectedPostForPoll}
          onClose={() => {
            setShowCreatePoll(false);
            setSelectedPostForPoll(null);
          }}
          onSuccess={handlePollCreated}
        />
      )}
    </div>
  );
}
