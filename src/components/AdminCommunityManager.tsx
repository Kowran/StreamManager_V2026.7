import React, { useState, useEffect } from 'react';
import { Newspaper, Plus, Pin, CreditCard as Edit2, Trash2, X, Image as ImageIcon, Youtube, Bold, Italic, List, Link2, Mic, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
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
}

export default function AdminCommunityManager() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'announcement' as 'tutorial' | 'news' | 'update' | 'announcement' | 'discussion',
    image_url: '',
    youtube_url: '',
    audio_url: '',
    is_pinned: false
  });
  const [contentRef, setContentRef] = useState<HTMLTextAreaElement | null>(null);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [selectedPostForPoll, setSelectedPostForPoll] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select(`
          *,
          author:profiles(email, full_name)
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const postsWithAuthors = (data || []).map((post) => ({
        ...post,
        author: post.author ? {
          email: post.author.email,
          name: post.author.full_name || post.author.email
        } : null
      }));

      setPosts(postsWithAuthors);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPost) {
        const { error } = await supabase
          .from('community_posts')
          .update({
            title: formData.title,
            content: formData.content,
            category: formData.category,
            image_url: formData.image_url || null,
            youtube_url: formData.youtube_url || null,
            audio_url: formData.audio_url || null,
            is_pinned: formData.is_pinned
          })
          .eq('id', editingPost.id);

        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
          .from('community_posts')
          .insert({
            title: formData.title,
            content: formData.content,
            category: formData.category,
            image_url: formData.image_url || null,
            youtube_url: formData.youtube_url || null,
            audio_url: formData.audio_url || null,
            is_pinned: formData.is_pinned,
            author_id: user.id
          });

        if (error) throw error;
      }

      setShowModal(false);
      setEditingPost(null);
      setFormData({ title: '', content: '', category: 'announcement', image_url: '', youtube_url: '', audio_url: '', is_pinned: false });
      loadPosts();
    } catch (error) {
      console.error('Error saving post:', error);
      const errorMessage = t.language === 'pt' ? 'Erro ao salvar post' :
        t.language === 'en' ? 'Error saving post' :
        'Error al guardar publicación';
      alert(errorMessage);
    }
  };

  const handleEdit = (post: CommunityPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      content: post.content,
      category: post.category,
      image_url: post.image_url || '',
      youtube_url: post.youtube_url || '',
      audio_url: post.audio_url || '',
      is_pinned: post.is_pinned
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const confirmMessage = t.language === 'pt' ? 'Tem certeza que deseja excluir este post?' :
      t.language === 'en' ? 'Are you sure you want to delete this post?' :
      '¿Estás seguro de que quieres eliminar esta publicación?';
    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      const errorMessage = t.language === 'pt' ? 'Erro ao excluir post' :
        t.language === 'en' ? 'Error deleting post' :
        'Error al eliminar publicación';
      alert(errorMessage);
    }
  };

  const togglePin = async (post: CommunityPost) => {
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ is_pinned: !post.is_pinned })
        .eq('id', post.id);

      if (error) throw error;
      loadPosts();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPost(null);
    setFormData({ title: '', content: '', category: 'announcement', image_url: '', youtube_url: '', audio_url: '', is_pinned: false });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, { pt: string; en: string; es: string }> = {
      tutorial: { pt: 'Tutorial', en: 'Tutorial', es: 'Tutorial' },
      news: { pt: 'Novidades', en: 'News', es: 'Novedades' },
      update: { pt: 'Atualização', en: 'Update', es: 'Actualización' },
      announcement: { pt: 'Aviso', en: 'Announcement', es: 'Aviso' },
      discussion: { pt: 'Discussão', en: 'Discussion', es: 'Discusión' }
    };
    return labels[category]?.[t.language] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      tutorial: 'bg-green-100 text-green-800',
      news: 'bg-blue-100 text-blue-800',
      update: 'bg-orange-100 text-orange-800',
      announcement: 'bg-red-100 text-red-800',
      discussion: 'bg-purple-100 text-purple-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const insertFormatting = (before: string, after: string = '') => {
    if (!contentRef) return;

    const start = contentRef.selectionStart;
    const end = contentRef.selectionEnd;
    const selectedText = formData.content.substring(start, end);
    const newContent =
      formData.content.substring(0, start) +
      before + selectedText + after +
      formData.content.substring(end);

    setFormData({ ...formData, content: newContent });

    setTimeout(() => {
      contentRef.focus();
      contentRef.setSelectionRange(
        start + before.length,
        end + before.length
      );
    }, 0);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            {t.language === 'pt' ? 'Gerenciar Comunidade' : t.language === 'en' ? 'Manage Community' : 'Gestionar Comunidad'}
          </h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t.language === 'pt' ? 'Novo Post' : t.language === 'en' ? 'New Post' : 'Nueva Publicación'}
        </button>
      </div>

      <div className="grid gap-4">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Newspaper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {t.language === 'pt' ? 'Nenhum post criado ainda' :
               t.language === 'en' ? 'No posts created yet' :
               'No se han creado publicaciones aún'}
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className={`bg-white rounded-lg shadow-md p-6 ${
                post.is_pinned ? 'border-2 border-yellow-400' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {post.is_pinned && (
                      <Pin className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    )}
                    <h3 className="text-xl font-bold text-gray-900">{post.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(post.category)}`}>
                      {getCategoryLabel(post.category)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {t.language === 'pt' ? 'Por' : t.language === 'en' ? 'By' : 'Por'}: {post.author?.name || post.author?.email || (t.language === 'pt' ? 'Anônimo' : t.language === 'en' ? 'Anonymous' : 'Anónimo')} •{' '}
                    {new Date(post.created_at).toLocaleDateString(
                      t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
                      {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedPostForPoll(post.id);
                      setShowCreatePoll(true);
                    }}
                    className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                    title={t.language === 'pt' ? 'Criar Enquete' : t.language === 'en' ? 'Create Poll' : 'Crear Encuesta'}
                  >
                    <BarChart3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => togglePin(post)}
                    className={`p-2 rounded-lg transition-colors ${
                      post.is_pinned
                        ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={post.is_pinned ?
                      (t.language === 'pt' ? 'Desafixar' : t.language === 'en' ? 'Unpin' : 'Desfijar') :
                      (t.language === 'pt' ? 'Fixar' : t.language === 'en' ? 'Pin' : 'Fijar')}
                  >
                    <Pin className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(post)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {post.image_url && (
                <img
                  src={post.image_url}
                  alt={post.title}
                  className="w-full max-h-96 object-cover rounded-lg mb-4"
                />
              )}

              {post.youtube_url && (() => {
                const videoId = extractYoutubeId(post.youtube_url);
                return videoId ? (
                  <div className="mb-4 rounded-lg overflow-hidden aspect-video">
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
                    className="w-full"
                    src={post.audio_url}
                  >
                    {t.language === 'pt' ? 'Seu navegador não suporta o elemento de áudio.' :
                     t.language === 'en' ? 'Your browser does not support the audio element.' :
                     'Su navegador no soporta el elemento de audio.'}
                  </audio>
                </div>
              )}

              <div className="text-gray-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{
                __html: post.content
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                  .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>')
                  .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                  .replace(/(<li.*<\/li>)/s, '<ul class="list-disc list-inside">$1</ul>')
              }} />
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">
                {editingPost ?
                  (t.language === 'pt' ? 'Editar Post' : t.language === 'en' ? 'Edit Post' : 'Editar Publicación') :
                  (t.language === 'pt' ? 'Novo Post' : t.language === 'en' ? 'New Post' : 'Nueva Publicación')}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'pt' ? 'Título' : t.language === 'en' ? 'Title' : 'Título'} *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'pt' ? 'Categoria' : t.language === 'en' ? 'Category' : 'Categoría'} *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as typeof formData.category })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="tutorial">{getCategoryLabel('tutorial')}</option>
                  <option value="news">{getCategoryLabel('news')}</option>
                  <option value="update">{getCategoryLabel('update')}</option>
                  <option value="announcement">{getCategoryLabel('announcement')}</option>
                  <option value="discussion">{getCategoryLabel('discussion')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'pt' ? 'Conteúdo' : t.language === 'en' ? 'Content' : 'Contenido'} *
                </label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-300 p-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => insertFormatting('**', '**')}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                      title={t.language === 'pt' ? 'Negrito' : t.language === 'en' ? 'Bold' : 'Negrita'}
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('*', '*')}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                      title={t.language === 'pt' ? 'Itálico' : t.language === 'en' ? 'Italic' : 'Cursiva'}
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('- ')}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                      title={t.language === 'pt' ? 'Lista' : t.language === 'en' ? 'List' : 'Lista'}
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormatting('[texto](url)')}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                      title={t.language === 'pt' ? 'Link' : t.language === 'en' ? 'Link' : 'Enlace'}
                    >
                      <Link2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    ref={setContentRef}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent border-0 outline-none"
                    placeholder={t.language === 'pt' ?
                      'Digite seu conteúdo aqui...\n\nDicas de formatação:\n**negrito** *itálico* [link](url) - lista' :
                      t.language === 'en' ?
                      'Type your content here...\n\nFormatting tips:\n**bold** *italic* [link](url) - list' :
                      'Escribe tu contenido aquí...\n\nConsejos de formato:\n**negrita** *cursiva* [enlace](url) - lista'
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    {t.language === 'pt' ? 'URL da Imagem (opcional)' :
                     t.language === 'en' ? 'Image URL (optional)' :
                     'URL de Imagen (opcional)'}
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t.language === 'pt' ? 'https://exemplo.com/imagem.jpg' :
                      t.language === 'en' ? 'https://example.com/image.jpg' :
                      'https://ejemplo.com/imagen.jpg'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Youtube className="w-4 h-4 inline mr-1" />
                    {t.language === 'pt' ? 'URL do YouTube (opcional)' :
                     t.language === 'en' ? 'YouTube URL (optional)' :
                     'URL de YouTube (opcional)'}
                  </label>
                  <input
                    type="url"
                    value={formData.youtube_url}
                    onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t.language === 'pt' ? 'https://youtube.com/watch?v=...' :
                      t.language === 'en' ? 'https://youtube.com/watch?v=...' :
                      'https://youtube.com/watch?v=...'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mic className="w-4 h-4 inline mr-1" />
                    {t.language === 'pt' ? 'URL do Áudio (opcional)' :
                     t.language === 'en' ? 'Audio URL (optional)' :
                     'URL de Audio (opcional)'}
                  </label>
                  <input
                    type="url"
                    value={formData.audio_url}
                    onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t.language === 'pt' ? 'https://exemplo.com/audio.mp3' :
                      t.language === 'en' ? 'https://example.com/audio.mp3' :
                      'https://ejemplo.com/audio.mp3'}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_pinned"
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_pinned" className="text-sm font-medium text-gray-700">
                  <Pin className="w-4 h-4 inline mr-1" />
                  {t.language === 'pt' ? 'Fixar post no topo' :
                   t.language === 'en' ? 'Pin post to top' :
                   'Fijar publicación arriba'}
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingPost ?
                    (t.language === 'pt' ? 'Atualizar' : t.language === 'en' ? 'Update' : 'Actualizar') :
                    (t.language === 'pt' ? 'Publicar' : t.language === 'en' ? 'Publish' : 'Publicar')}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreatePoll && selectedPostForPoll && (
        <CreatePollModal
          postId={selectedPostForPoll}
          onClose={() => {
            setShowCreatePoll(false);
            setSelectedPostForPoll(null);
          }}
          onSuccess={() => {
            loadPosts();
          }}
        />
      )}
    </div>
  );
}
