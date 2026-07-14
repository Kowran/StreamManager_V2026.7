import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Pin, Lock, Trash2, X, Eye, Reply, Hash, CreditCard as Edit2, ArrowUp, ArrowDown, Loader2, BookOpen, HelpCircle, Megaphone, TrendingUp, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
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
  created_at: string;
  updated_at: string;
  author?: { email: string; full_name?: string; username?: string };
  category?: ForumCategory;
  reply_count?: number;
}

const iconOptions = [
  { name: 'MessageSquare', label: 'Mensagem', component: MessageSquare },
  { name: 'HelpCircle', label: 'Dúvida', component: HelpCircle },
  { name: 'Megaphone', label: 'Anúncio', component: Megaphone },
  { name: 'BookOpen', label: 'Tutorial', component: BookOpen },
  { name: 'Bell', label: 'Notificação', component: Bell },
  { name: 'Hash', label: 'Hash', component: Hash },
  { name: 'TrendingUp', label: 'Trending', component: TrendingUp },
];

const colorOptions = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

export default function AdminCommunityManager() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'categories' | 'topics'>('categories');

  // Category modal state
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<ForumCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: '', slug: '', description: '', icon: 'MessageSquare', color: '#3b82f6', display_order: 0, is_active: true });

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('forum_categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (!error && data) setCategories(data);
  }, []);

  const loadTopics = useCallback(async () => {
    const { data, error } = await supabase
      .from('forum_topics')
      .select(`
        *,
        author:profiles(email, full_name, username),
        category:forum_categories(*)
      `)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('Error loading topics:', error);
      return;
    }
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
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadCategories(), loadTopics()]);
      setLoading(false);
    })();
  }, [loadCategories, loadTopics]);

  // Category handlers
  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) return;
    const slug = catForm.slug.trim() || catForm.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    if (editingCat) {
      await supabase.from('forum_categories').update({
        name: catForm.name.trim(),
        slug,
        description: catForm.description.trim() || null,
        icon: catForm.icon,
        color: catForm.color,
        display_order: catForm.display_order,
        is_active: catForm.is_active,
      }).eq('id', editingCat.id);
    } else {
      await supabase.from('forum_categories').insert({
        name: catForm.name.trim(),
        slug,
        description: catForm.description.trim() || null,
        icon: catForm.icon,
        color: catForm.color,
        display_order: catForm.display_order,
        is_active: catForm.is_active,
      });
    }
    setShowCatModal(false);
    setEditingCat(null);
    setCatForm({ name: '', slug: '', description: '', icon: 'MessageSquare', color: '#3b82f6', display_order: 0, is_active: true });
    loadCategories();
  };

  const handleEditCategory = (cat: ForumCategory) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, slug: cat.slug, description: cat.description || '', icon: cat.icon || 'MessageSquare', color: cat.color, display_order: cat.display_order, is_active: cat.is_active });
    setShowCatModal(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t.language === 'pt' ? 'Excluir esta categoria? Todos os tópicos dentro dela serão excluídos.' : t.language === 'en' ? 'Delete this category? All topics inside will be deleted.' : '¿Eliminar esta categoría? Todos los temas dentro serán eliminados.')) return;
    await supabase.from('forum_categories').delete().eq('id', id);
    loadCategories();
    loadTopics();
  };

  // Topic handlers
  const togglePin = async (topic: ForumTopic) => {
    await supabase.from('forum_topics').update({ is_pinned: !topic.is_pinned }).eq('id', topic.id);
    loadTopics();
  };

  const toggleLock = async (topic: ForumTopic) => {
    await supabase.from('forum_topics').update({ is_locked: !topic.is_locked }).eq('id', topic.id);
    loadTopics();
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm(t.language === 'pt' ? 'Excluir este tópico?' : t.language === 'en' ? 'Delete this topic?' : '¿Eliminar este tema?')) return;
    await supabase.from('forum_topics').delete().eq('id', id);
    loadTopics();
  };

  const authorName = (author?: { email: string; full_name?: string; username?: string }) => {
    if (!author) return '—';
    return author.username || author.full_name || author.email;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="w-8 h-8 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">
          {t.language === 'pt' ? 'Gerenciar Fórum' : t.language === 'en' ? 'Manage Forum' : 'Gestionar Foro'}
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'categories' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {t.language === 'pt' ? 'Categorias' : t.language === 'en' ? 'Categories' : 'Categorías'}
        </button>
        <button
          onClick={() => setActiveTab('topics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'topics' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {t.language === 'pt' ? 'Tópicos' : t.language === 'en' ? 'Topics' : 'Temas'}
        </button>
      </div>

      {/* Categories tab */}
      {activeTab === 'categories' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditingCat(null); setCatForm({ name: '', slug: '', description: '', icon: 'MessageSquare', color: '#3b82f6', display_order: 0, is_active: true }); setShowCatModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t.language === 'pt' ? 'Nova Categoria' : t.language === 'en' ? 'New Category' : 'Nueva Categoría'}
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Hash className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {t.language === 'pt' ? 'Nenhuma categoria criada ainda' : t.language === 'en' ? 'No categories created yet' : 'No se han creado categorías aún'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {categories.map((cat) => {
                const IconComp = iconOptions.find(i => i.name === cat.icon)?.component || MessageSquare;
                return (
                  <div key={cat.id} className={`bg-white rounded-lg shadow-sm p-5 flex items-center justify-between ${!cat.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                        <IconComp className="w-6 h-6" style={{ color: cat.color }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{cat.name}</h3>
                        {cat.description && <p className="text-sm text-gray-500">{cat.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>/{cat.slug}</span>
                          <span>•</span>
                          <span>{t.language === 'pt' ? `Ordem: ${cat.display_order}` : t.language === 'en' ? `Order: ${cat.display_order}` : `Orden: ${cat.display_order}`}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditCategory(cat)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Topics tab */}
      {activeTab === 'topics' && (
        <div>
          {topics.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {t.language === 'pt' ? 'Nenhum tópico criado ainda' : t.language === 'en' ? 'No topics created yet' : 'No se han creado temas aún'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {topics.map((topic) => {
                const cat = topic.category;
                const IconComp = iconOptions.find(i => i.name === cat?.icon)?.component || MessageSquare;
                return (
                  <div key={topic.id} className={`bg-white rounded-lg shadow-sm p-5 ${topic.is_pinned ? 'border-l-4 border-yellow-400' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {cat && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                              <IconComp className="w-3 h-3" />
                              {cat.name}
                            </span>
                          )}
                          {topic.is_pinned && <Pin className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                          {topic.is_locked && <Lock className="w-4 h-4 text-red-500" />}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{topic.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>{authorName(topic.author)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{topic.views}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Reply className="w-3 h-3" />{topic.reply_count || 0}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => togglePin(topic)} className={`p-2 rounded-lg transition-colors ${topic.is_pinned ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} title="Pin">
                          <Pin className="w-5 h-5" />
                        </button>
                        <button onClick={() => toggleLock(topic)} className={`p-2 rounded-lg transition-colors ${topic.is_locked ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} title="Lock">
                          <Lock className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDeleteTopic(topic.id)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Category modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">
                {editingCat
                  ? (t.language === 'pt' ? 'Editar Categoria' : t.language === 'en' ? 'Edit Category' : 'Editar Categoría')
                  : (t.language === 'pt' ? 'Nova Categoria' : t.language === 'en' ? 'New Category' : 'Nueva Categoría')}
              </h3>
              <button onClick={() => { setShowCatModal(false); setEditingCat(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'pt' ? 'Nome *' : t.language === 'en' ? 'Name *' : 'Nombre *'}
                </label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t.language === 'pt' ? 'Ex: Geral, Dúvidas...' : t.language === 'en' ? 'Ex: General, Questions...' : 'Ej: General, Dudas...'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'pt' ? 'Slug (opcional)' : t.language === 'en' ? 'Slug (optional)' : 'Slug (opcional)'}
                </label>
                <input
                  type="text"
                  value={catForm.slug}
                  onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="geral"
                />
                <p className="text-xs text-gray-400 mt-1">{t.language === 'pt' ? 'Gerado automaticamente se vazio' : t.language === 'en' ? 'Auto-generated if empty' : 'Se genera automáticamente si está vacío'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'pt' ? 'Descrição' : t.language === 'en' ? 'Description' : 'Descripción'}
                </label>
                <textarea
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'pt' ? 'Ícone' : t.language === 'en' ? 'Icon' : 'Icono'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {iconOptions.map((opt) => {
                    const Icon = opt.component;
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setCatForm({ ...catForm, icon: opt.name })}
                        className={`p-3 rounded-lg border-2 transition-colors ${catForm.icon === opt.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'pt' ? 'Cor' : t.language === 'en' ? 'Color' : 'Color'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCatForm({ ...catForm, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${catForm.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.language === 'pt' ? 'Ordem de exibição' : t.language === 'en' ? 'Display order' : 'Orden de visualización'}
                </label>
                <input
                  type="number"
                  value={catForm.display_order}
                  onChange={(e) => setCatForm({ ...catForm, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cat_active"
                  checked={catForm.is_active}
                  onChange={(e) => setCatForm({ ...catForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="cat_active" className="text-sm font-medium text-gray-700">
                  {t.language === 'pt' ? 'Ativa' : t.language === 'en' ? 'Active' : 'Activa'}
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowCatModal(false); setEditingCat(null); }} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">
                  {t.cancel}
                </button>
                <button onClick={handleSaveCategory} disabled={!catForm.name.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {editingCat ? (t.language === 'pt' ? 'Atualizar' : 'Update') : (t.language === 'pt' ? 'Criar' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
