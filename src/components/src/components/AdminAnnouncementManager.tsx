import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { Megaphone, Plus, Pencil, Trash2, X, Eye, EyeOff, GripVertical } from 'lucide-react';

interface Announcement {
  id: string;
  text: string;
  link_url: string | null;
  link_text: string | null;
  bg_color: string;
  text_color: string;
  scroll: boolean;
  blink: boolean;
  is_active: boolean;
  priority: number;
  start_date: string;
  end_date: string | null;
}

const DEFAULT_BG = '#1e40af';
const DEFAULT_TEXT = '#ffffff';

const PRESET_COLORS = [
  { bg: '#1e40af', text: '#ffffff', name: 'Blue' },
  { bg: '#dc2626', text: '#ffffff', name: 'Red' },
  { bg: '#16a34a', text: '#ffffff', name: 'Green' },
  { bg: '#ea580c', text: '#ffffff', name: 'Orange' },
  { bg: '#7c3aed', text: '#ffffff', name: 'Purple' },
  { bg: '#0891b2', text: '#ffffff', name: 'Cyan' },
  { bg: '#facc15', text: '#1e293b', name: 'Yellow' },
  { bg: '#1e293b', text: '#ffffff', name: 'Dark' },
  { bg: '#f43f5e', text: '#ffffff', name: 'Rose' },
  { bg: '#059669', text: '#ffffff', name: 'Emerald' },
];

const EMOJI_SUGGESTIONS = ['🚀', '🔥', '⭐', '🎉', '📢', '⚡', '🎁', '💎', '✅', '⚠️', '🔴', '🟢', '💰', '🎬', '🎮', '💯'];

export function AdminAnnouncementManager() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lang = language as 'pt' | 'en' | 'es';

  const t = {
    pt: { title: 'Anúncios', desc: 'Crie barras de anúncio exibidas acima do cabeçalho', new: 'Novo Anúncio', text: 'Texto', textPh: 'Digite a mensagem do anúncio...', linkUrl: 'Link (URL)', linkText: 'Texto do Link', bgColor: 'Cor de Fundo', textColor: 'Cor do Texto', presets: 'Cores Pré-definidas', scroll: 'Deslizar texto', blink: 'Piscar texto', active: 'Ativo', priority: 'Prioridade', startDate: 'Data de Início', endDate: 'Data de Fim (opcional)', save: 'Salvar', cancel: 'Cancelar', edit: 'Editar', delete: 'Excluir', confirmDelete: 'Excluir este anúncio?', noAnnouncements: 'Nenhum anúncio criado ainda', emojis: 'Emojis', preview: 'Pré-visualização', higherFirst: 'Maior prioridade aparece primeiro' },
    en: { title: 'Announcements', desc: 'Create announcement bars displayed above the header', new: 'New Announcement', text: 'Text', textPh: 'Type the announcement message...', linkUrl: 'Link (URL)', linkText: 'Link Text', bgColor: 'Background Color', textColor: 'Text Color', presets: 'Preset Colors', scroll: 'Scroll text', blink: 'Blink text', active: 'Active', priority: 'Priority', startDate: 'Start Date', endDate: 'End Date (optional)', save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete', confirmDelete: 'Delete this announcement?', noAnnouncements: 'No announcements created yet', emojis: 'Emojis', preview: 'Preview', higherFirst: 'Higher priority shows first' },
    es: { title: 'Anuncios', desc: 'Cree barras de anuncios mostradas sobre el encabezado', new: 'Nuevo Anuncio', text: 'Texto', textPh: 'Escriba el mensaje del anuncio...', linkUrl: 'Enlace (URL)', linkText: 'Texto del Enlace', bgColor: 'Color de Fondo', textColor: 'Color del Texto', presets: 'Colores Predefinidos', scroll: 'Deslizar texto', blink: 'Parpadear texto', active: 'Activo', priority: 'Prioridad', startDate: 'Fecha de Inicio', endDate: 'Fecha de Fin (opcional)', save: 'Guardar', cancel: 'Cancelar', edit: 'Editar', delete: 'Eliminar', confirmDelete: '¿Eliminar este anuncio?', noAnnouncements: 'Aún no se han creado anuncios', emojis: 'Emojis', preview: 'Vista previa', higherFirst: 'Mayor prioridad aparece primero' },
  }[lang];

  const emptyForm = {
    text: '', link_url: '', link_text: '',
    bg_color: DEFAULT_BG, text_color: DEFAULT_TEXT,
    scroll: true, blink: false, is_active: true,
    priority: 0, start_date: '',
    end_date: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchAnnouncements(); }, []);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_announcements')
        .select('*')
        .order('priority', { ascending: false });
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({
      text: a.text,
      link_url: a.link_url || '',
      link_text: a.link_text || '',
      bg_color: a.bg_color,
      text_color: a.text_color,
      scroll: a.scroll,
      blink: a.blink,
      is_active: a.is_active,
      priority: a.priority,
      start_date: a.start_date ? a.start_date.slice(0, 16) : '',
      end_date: a.end_date ? a.end_date.slice(0, 16) : '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        text: form.text,
        link_url: form.link_url || null,
        link_text: form.link_text || null,
        bg_color: form.bg_color,
        text_color: form.text_color,
        scroll: form.scroll,
        blink: form.blink,
        is_active: form.is_active,
        priority: form.priority,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : new Date().toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      };

      if (editing) {
        const { error } = await supabase.from('admin_announcements').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('admin_announcements').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }

      await fetchAnnouncements();
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
      const { error } = await supabase.from('admin_announcements').delete().eq('id', id);
      if (error) throw error;
      await fetchAnnouncements();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleActive(a: Announcement) {
    try {
      const { error } = await supabase.from('admin_announcements').update({ is_active: !a.is_active }).eq('id', a.id);
      if (error) throw error;
      await fetchAnnouncements();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-blue-500" />
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
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t.noAnnouncements}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Preview bar */}
              <div
                className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 overflow-hidden"
                style={{ backgroundColor: a.bg_color, color: a.text_color }}
              >
                <span className={a.blink ? 'animate-blink' : ''}>{a.text}</span>
                {a.link_url && (
                  <span className="font-bold underline underline-offset-2 opacity-90">
                    {a.link_text || a.link_url}
                  </span>
                )}
                {a.scroll && <span className="opacity-60 text-xs ml-auto">⟶</span>}
              </div>
              {/* Controls */}
              <div className="flex items-center gap-2 p-3">
                <button
                  onClick={() => toggleActive(a)}
                  className={`p-2 rounded-lg transition-colors ${a.is_active ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  title={a.is_active ? 'Ativo' : 'Inativo'}
                >
                  {a.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(a)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title={t.edit}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title={t.delete}>
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="ml-auto text-xs text-gray-400">
                  {t.priority}: {a.priority}
                </div>
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
                <Megaphone className="w-5 h-5 text-blue-500" />
                {editing ? t.edit : t.new}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.text}</label>
                <textarea
                  value={form.text}
                  onChange={e => update('text', e.target.value)}
                  placeholder={t.textPh}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {/* Emoji suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {EMOJI_SUGGESTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => update('text', form.text + emoji)}
                      className="text-lg hover:scale-125 transition-transform p-1"
                      type="button"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
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
                    placeholder="Clique aqui"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.presets}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map(p => (
                    <button
                      key={p.name}
                      onClick={() => { update('bg_color', p.bg); update('text_color', p.text); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all"
                      style={{
                        backgroundColor: p.bg,
                        color: p.text,
                        borderColor: form.bg_color === p.bg ? '#3b82f6' : 'transparent',
                        borderWidth: '2px',
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.bgColor}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.bg_color}
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
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.textColor}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.text_color}
                        onChange={e => update('text_color', e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={form.text_color}
                        onChange={e => update('text_color', e.target.value)}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.preview}</label>
                <div
                  className="rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 overflow-hidden"
                  style={{ backgroundColor: form.bg_color, color: form.text_color }}
                >
                  <span className={form.blink ? 'animate-blink' : ''}>{form.text || 'Seu texto aparecerá aqui...'}</span>
                  {form.link_url && (
                    <span className="font-bold underline underline-offset-2 opacity-90 whitespace-nowrap">
                      {form.link_text || form.link_url}
                    </span>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => update('scroll', !form.scroll)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.scroll ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow transition-transform ${form.scroll ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t.scroll}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => update('blink', !form.blink)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.blink ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow transition-transform ${form.blink ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t.blink}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => update('is_active', !form.is_active)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t.active}</span>
                </label>
              </div>

              {/* Priority & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.priority}</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={e => update('priority', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t.higherFirst}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.startDate}</label>
                  <input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={e => update('start_date', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.endDate}</label>
                  <input
                    type="datetime-local"
                    value={form.end_date}
                    onChange={e => update('end_date', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.text}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? '...' : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
