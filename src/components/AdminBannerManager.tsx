import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { Image, Plus, Pencil, Trash2, X, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  bg_color: string;
  text_color: string;
  text_position: string;
  is_active: boolean;
  display_order: number;
}

const PRESET_COLORS = [
  { bg: '#1e40af', text: '#ffffff', name: 'Blue' },
  { bg: '#dc2626', text: '#ffffff', name: 'Red' },
  { bg: '#16a34a', text: '#ffffff', name: 'Green' },
  { bg: '#ea580c', text: '#ffffff', name: 'Orange' },
  { bg: '#7c3aed', text: '#ffffff', name: 'Purple' },
  { bg: '#0891b2', text: '#ffffff', name: 'Cyan' },
  { bg: '#1e293b', text: '#ffffff', name: 'Dark' },
  { bg: '#f43f5e', text: '#ffffff', name: 'Rose' },
];

export function AdminBannerManager() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lang = language as 'pt' | 'en' | 'es';

  const t = {
    pt: { title: 'Banners da Página Inicial', desc: 'Crie banners rotativos para a landing page', new: 'Novo Banner', bannerTitle: 'Título', subtitle: 'Subtítulo', imageUrl: 'URL da Imagem', linkUrl: 'Link (URL)', linkText: 'Texto do Botão', bgColor: 'Cor de Fundo', textColor: 'Cor do Texto', presets: 'Cores Pré-definidas', position: 'Posição do Texto', left: 'Esquerda', center: 'Centro', right: 'Direita', active: 'Ativo', order: 'Ordem', save: 'Salvar', cancel: 'Cancelar', edit: 'Editar', delete: 'Excluir', confirmDelete: 'Excluir este banner?', noBanners: 'Nenhum banner criado ainda', preview: 'Pré-visualização', lowerFirst: 'Menor ordem aparece primeiro', moveUp: 'Mover para cima', moveDown: 'Mover para baixo' },
    en: { title: 'Landing Page Banners', desc: 'Create rotating banners for the landing page', new: 'New Banner', bannerTitle: 'Title', subtitle: 'Subtitle', imageUrl: 'Image URL', linkUrl: 'Link (URL)', linkText: 'Button Text', bgColor: 'Background Color', textColor: 'Text Color', presets: 'Preset Colors', position: 'Text Position', left: 'Left', center: 'Center', right: 'Right', active: 'Active', order: 'Order', save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete', confirmDelete: 'Delete this banner?', noBanners: 'No banners created yet', preview: 'Preview', lowerFirst: 'Lower order shows first', moveUp: 'Move up', moveDown: 'Move down' },
    es: { title: 'Banners de la Página Principal', desc: 'Cree banners rotativos para la landing page', new: 'Nuevo Banner', bannerTitle: 'Título', subtitle: 'Subtítulo', imageUrl: 'URL de la Imagen', linkUrl: 'Enlace (URL)', linkText: 'Texto del Botón', bgColor: 'Color de Fondo', textColor: 'Color del Texto', presets: 'Colores Predefinidos', position: 'Posición del Texto', left: 'Izquierda', center: 'Centro', right: 'Derecha', active: 'Activo', order: 'Orden', save: 'Guardar', cancel: 'Cancelar', edit: 'Editar', delete: 'Eliminar', confirmDelete: '¿Eliminar este banner?', noBanners: 'Aún no se han creado banners', preview: 'Vista previa', lowerFirst: 'Menor orden aparece primero', moveUp: 'Mover arriba', moveDown: 'Mover abajo' },
  }[lang];

  const emptyForm = {
    title: '', subtitle: '', image_url: '', link_url: '', link_text: '',
    bg_color: 'transparent', text_color: '#ffffff', text_position: 'left',
    is_active: true, display_order: 0,
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchBanners(); }, []);

  async function fetchBanners() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('landing_banners')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      setBanners(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, display_order: banners.length });
    setShowModal(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setForm({
      title: b.title, subtitle: b.subtitle || '', image_url: b.image_url || '',
      link_url: b.link_url || '', link_text: b.link_text || '',
      bg_color: b.bg_color || 'transparent', text_color: b.text_color, text_position: b.text_position,
      is_active: b.is_active, display_order: b.display_order,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title || '',
        subtitle: form.subtitle || null,
        image_url: form.image_url || null,
        link_url: form.link_url || null,
        link_text: form.link_text || null,
        bg_color: form.bg_color,
        text_color: form.text_color,
        text_position: form.text_position,
        is_active: form.is_active,
        display_order: form.display_order,
      };

      if (editing) {
        const { error } = await supabase.from('landing_banners').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('landing_banners').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }

      await fetchBanners();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.confirmDelete)) return;
    try {
      const { error } = await supabase.from('landing_banners').delete().eq('id', id);
      if (error) throw error;
      await fetchBanners();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleActive(b: Banner) {
    try {
      const { error } = await supabase.from('landing_banners').update({ is_active: !b.is_active }).eq('id', b.id);
      if (error) throw error;
      await fetchBanners();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function moveBanner(b: Banner, direction: 'up' | 'down') {
    const idx = banners.findIndex(x => x.id === b.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= banners.length) return;
    const swapBanner = banners[swapIdx];
    try {
      await Promise.all([
        supabase.from('landing_banners').update({ display_order: b.display_order }).eq('id', swapBanner.id),
        supabase.from('landing_banners').update({ display_order: swapBanner.display_order }).eq('id', b.id),
      ]);
      await fetchBanners();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const posClasses: Record<string, string> = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Image className="w-6 h-6 text-blue-500" />
            {t.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.desc}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t.new}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t.noBanners}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b, idx) => (
            <div key={b.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Preview */}
              <div
                className="relative h-32 flex flex-col justify-center px-6 overflow-hidden"
                style={{ backgroundColor: b.bg_color }}
              >
                {b.image_url && (
                  <img src={b.image_url} alt="" className={`absolute inset-0 w-full h-full object-cover ${b.bg_color && b.bg_color !== 'transparent' ? 'opacity-40' : 'opacity-100'}`} />
                )}
                <div className={`relative flex flex-col gap-1 max-w-md ${posClasses[b.text_position] || ''}`} style={{ color: b.text_color }}>
                  <h3 className="text-lg font-bold">{b.title}</h3>
                  {b.subtitle && <p className="text-sm opacity-90">{b.subtitle}</p>}
                  {b.link_url && (
                    <span className="inline-block mt-1 px-3 py-1 rounded-lg text-xs font-bold bg-white/20 backdrop-blur-sm">
                      {b.link_text || b.link_url}
                    </span>
                  )}
                </div>
                {!b.is_active && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium bg-gray-500/50 text-white">
                    Inativo
                  </span>
                )}
              </div>
              {/* Controls */}
              <div className="flex items-center gap-1 p-3">
                <button onClick={() => moveBanner(b, 'up')} disabled={idx === 0} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors" title={t.moveUp}>
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => moveBanner(b, 'down')} disabled={idx === banners.length - 1} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors" title={t.moveDown}>
                  <ChevronDown className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />
                <button onClick={() => toggleActive(b)} className={`p-2 rounded-lg transition-colors ${b.is_active ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  {b.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(b)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(b.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="ml-auto text-xs text-gray-400">{t.order}: {b.display_order}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Image className="w-5 h-5 text-blue-500" />
                {editing ? t.edit : t.new}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.bannerTitle} <span className="text-gray-400 text-xs font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.subtitle}</label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={e => update('subtitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.imageUrl}</label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={e => update('image_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.linkUrl}</label>
                  <input
                    type="url"
                    value={form.link_url}
                    onChange={e => update('link_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.linkText}</label>
                  <input
                    type="text"
                    value={form.link_text}
                    onChange={e => update('link_text', e.target.value)}
                    placeholder="Comprar Agora"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.presets} <span className="text-gray-400 text-xs font-normal">(opcional)</span></label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => update('bg_color', 'transparent')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    style={{ borderColor: form.bg_color === 'transparent' ? '#3b82f6' : '#d1d5db' }}
                  >
                    Transparente
                  </button>
                  {PRESET_COLORS.map(p => (
                    <button
                      key={p.name}
                      onClick={() => { update('bg_color', p.bg); update('text_color', p.text); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all"
                      style={{ backgroundColor: p.bg, color: p.text, borderColor: form.bg_color === p.bg ? '#3b82f6' : 'transparent', borderWidth: '2px' }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.bgColor} <span className="text-gray-400 text-xs font-normal">(opcional)</span></label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.bg_color === 'transparent' ? '#ffffff' : form.bg_color}
                        onChange={e => update('bg_color', e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={form.bg_color}
                        onChange={e => update('bg_color', e.target.value)}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.textColor} <span className="text-gray-400 text-xs font-normal">(opcional)</span></label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.text_color} onChange={e => update('text_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600" />
                      <input type="text" value={form.text_color} onChange={e => update('text_color', e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.position}</label>
                <div className="flex gap-2">
                  {(['left', 'center', 'right'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => update('text_position', pos)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${form.text_position === pos ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      {t[pos]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.preview}</label>
                <div
                  className="relative h-32 rounded-lg flex flex-col justify-center px-6 overflow-hidden"
                  style={{ backgroundColor: form.bg_color }}
                >
                  {form.image_url && (
                    <img src={form.image_url} alt="" className={`absolute inset-0 w-full h-full object-cover ${form.bg_color && form.bg_color !== 'transparent' ? 'opacity-40' : 'opacity-100'}`} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div className={`relative flex flex-col gap-1 max-w-md ${posClasses[form.text_position] || ''}`} style={{ color: form.text_color }}>
                    <h3 className="text-lg font-bold">{form.title || 'Seu título...'}</h3>
                    {form.subtitle && <p className="text-sm opacity-90">{form.subtitle}</p>}
                    {form.link_url && (
                      <span className="inline-block mt-1 px-3 py-1 rounded-lg text-xs font-bold bg-white/20 backdrop-blur-sm">
                        {form.link_text || form.link_url}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button type="button" onClick={() => update('is_active', !form.is_active)} className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t.active}</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 dark:text-gray-300">{t.order}</label>
                  <input type="number" value={form.display_order} onChange={e => update('display_order', parseInt(e.target.value) || 0)} className="w-20 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
              <p className="text-xs text-gray-400">{t.lowerFirst}</p>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button onClick={() => setShowModal(false)} disabled={saving} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors">
                {t.cancel}
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50">
                {saving ? '...' : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
