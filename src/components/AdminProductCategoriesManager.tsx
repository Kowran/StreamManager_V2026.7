import React, { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Search, Upload, X, ArrowUp, ArrowDown, Gamepad2, Loader, AlertCircle } from 'lucide-react';
import { supabase, ProductCategory } from '../lib/supabase';
import { useAuth } from './AuthProvider';

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export function AdminProductCategoriesManager() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    slug: '',
    image_url: '',
    search_keywords: '',
    sort_order: 0,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', slug: '', image_url: '', search_keywords: '', sort_order: categories.length, is_active: true });
    setShowForm(true);
  }

  function openEdit(cat: ProductCategory) {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      image_url: cat.image_url || '',
      search_keywords: (cat.search_keywords || []).join(', '),
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const keywords = form.search_keywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
      const slug = form.slug || slugify(form.name);
      if (!form.name.trim()) throw new Error('Name is required');

      const payload = {
        name: form.name.trim(),
        slug,
        image_url: form.image_url.trim() || null,
        search_keywords: keywords,
        sort_order: form.sort_order,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { error } = await supabase
          .from('product_categories')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('product_categories')
          .insert(payload);
        if (error) throw error;
      }

      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(cat: ProductCategory) {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', cat.id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function move(cat: ProductCategory, dir: -1 | 1) {
    const idx = categories.findIndex(c => c.id === cat.id);
    const swapWith = categories[idx + dir];
    if (!swapWith) return;
    try {
      await supabase.from('product_categories').update({ sort_order: swapWith.sort_order }).eq('id', cat.id);
      await supabase.from('product_categories').update({ sort_order: cat.sort_order }).eq('id', swapWith.id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function uploadImage(file: File) {
    if (!user) return;
    try {
      const ext = file.name.split('.').pop();
      const path = `categories/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { cacheControl: '3600', upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      setForm(f => ({ ...f, image_url: data.publicUrl }));
    } catch (e: any) {
      setError(e.message);
    }
  }

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Game / Product Categories</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create categories like Clash of Clans, Fortnite, Minecraft. Clicking a category card takes customers to a search page with matching seller listings.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 flex items-start">
          <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search categories..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Gamepad2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          No categories yet. Create your first category.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(cat => (
            <div
              key={cat.id}
              className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative h-32 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Gamepad2 className="h-10 w-10 text-gray-400" />
                  </div>
                )}
                {!cat.is_active && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs bg-gray-800/70 text-white">Inactive</span>
                )}
                <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => move(cat, -1)} className="p-1 bg-white/90 rounded shadow hover:bg-white" title="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => move(cat, 1)} className="p-1 bg-white/90 rounded shadow hover:bg-white" title="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">{cat.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">/{cat.slug}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {(cat.search_keywords || []).slice(0, 5).map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">{kw}</span>
                  ))}
                  {(cat.search_keywords || []).length > 5 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">+{(cat.search_keywords || []).length - 5}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(cat)} className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                  </button>
                  <button onClick={() => remove(cat)} className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editing ? 'Edit Category' : 'New Category'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={save} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value;
                    setForm(f => ({ ...f, name, slug: editing ? f.slug : slugify(name) }));
                  }}
                  placeholder="e.g. Clash of Clans"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug (URL)</label>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="clash-of-clans"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image</label>
                <div className="flex items-center gap-3">
                  {form.image_url && (
                    <img src={form.image_url} alt="preview" className="h-16 w-16 rounded-lg object-cover border border-gray-200 dark:border-gray-600" />
                  )}
                  <label className="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
                    />
                  </label>
                  <input
                    value={form.image_url}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                    placeholder="or paste image URL"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search Keywords <span className="text-gray-400 font-normal">(comma-separated, used to match seller products)</span>
                </label>
                <input
                  value={form.search_keywords}
                  onChange={e => setForm(f => ({ ...f, search_keywords: e.target.value }))}
                  placeholder="clash of clans, coc, clash"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Seller products whose name or description contains any of these keywords will appear in this category's search page.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Active
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? <Loader className="h-4 w-4 animate-spin" /> : editing ? 'Save Changes' : 'Create Category'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
