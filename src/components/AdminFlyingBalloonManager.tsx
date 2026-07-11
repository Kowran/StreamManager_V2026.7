import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { Plus, Trash2, CreditCard as Edit3, X, Save, Loader, ExternalLink, Image as ImageIcon } from 'lucide-react';

interface FlyingBalloon {
  id: string;
  name: string;
  image_url: string;
  link_url: string | null;
  link_target: string;
  effect: string;
  size: number;
  position_bottom: number;
  position_right: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

interface FormData {
  name: string;
  image_url: string;
  link_url: string;
  link_target: string;
  effect: string;
  size: number;
  position_bottom: number;
  position_right: number;
  is_active: boolean;
  start_date: string;
  end_date: string;
}

const emptyForm: FormData = {
  name: '',
  image_url: '',
  link_url: '',
  link_target: '_blank',
  effect: 'floating',
  size: 80,
  position_bottom: 24,
  position_right: 24,
  is_active: false,
  start_date: new Date().toISOString().slice(0, 16),
  end_date: '',
};

export default function AdminFlyingBalloonManager() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [balloons, setBalloons] = useState<FlyingBalloon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FlyingBalloon | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormData>(emptyForm);

  useEffect(() => { loadBalloons(); }, []);

  async function loadBalloons() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flying_balloons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBalloons(data || []);
    } catch (err) {
      console.error('Error loading balloons:', err);
      setError(tr('Erro ao carregar balões', 'Error loading balloons', 'Error al cargar globos'));
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(balloon: FlyingBalloon) {
    setEditing(balloon);
    setForm({
      name: balloon.name,
      image_url: balloon.image_url,
      link_url: balloon.link_url || '',
      link_target: balloon.link_target,
      effect: balloon.effect,
      size: balloon.size,
      position_bottom: balloon.position_bottom,
      position_right: balloon.position_right,
      is_active: balloon.is_active,
      start_date: balloon.start_date ? balloon.start_date.slice(0, 16) : '',
      end_date: balloon.end_date ? balloon.end_date.slice(0, 16) : '',
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!user) return;
    if (!form.image_url.trim()) {
      setError(tr('URL da imagem é obrigatória', 'Image URL is required', 'URL de la imagen es obligatoria'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim() || 'Balão',
        image_url: form.image_url.trim(),
        link_url: form.link_url.trim() || null,
        link_target: form.link_target,
        effect: form.effect,
        size: form.size,
        position_bottom: form.position_bottom,
        position_right: form.position_right,
        is_active: form.is_active,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : new Date().toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { error } = await supabase
          .from('flying_balloons')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('flying_balloons')
          .insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }

      if (form.is_active) {
        await supabase
          .from('flying_balloons')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .neq('id', editing ? editing.id : '00000000-0000-0000-0000-000000000000');
      }

      await loadBalloons();
      setShowModal(false);
    } catch (err) {
      console.error('Error saving balloon:', err);
      setError(err instanceof Error ? err.message : 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(tr('Excluir este balão?', 'Delete this balloon?', '¿Eliminar este globo?'))) return;
    try {
      const { error } = await supabase.from('flying_balloons').delete().eq('id', id);
      if (error) throw error;
      await loadBalloons();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  }

  async function toggleActive(balloon: FlyingBalloon) {
    try {
      if (!balloon.is_active) {
        await supabase
          .from('flying_balloons')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .neq('id', balloon.id);
      }
      const { error } = await supabase
        .from('flying_balloons')
        .update({ is_active: !balloon.is_active, updated_at: new Date().toISOString() })
        .eq('id', balloon.id);
      if (error) throw error;
      await loadBalloons();
    } catch (err) {
      console.error('Error toggling active:', err);
    }
  }

  const effectOptions = [
    { value: 'floating', label: { pt: 'Flutuando', en: 'Floating', es: 'Flotando' } },
    { value: 'static', label: { pt: 'Parado', en: 'Static', es: 'Estático' } },
    { value: 'blinking', label: { pt: 'Piscando', en: 'Blinking', es: 'Parpadeando' } },
    { value: 'bouncing', label: { pt: 'Pulando', en: 'Bouncing', es: 'Rebotando' } },
    { value: 'pulsing', label: { pt: 'Pulsando', en: 'Pulsing', es: 'Pulsando' } },
  ];

  function tr(pt: string, en: string, es: string) { return language === 'pt' ? pt : language === 'en' ? en : es; }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('Balões Voadores', 'Flying Balloons', 'Globos Voladores')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {tr('Crie balões flutuantes personalizados que aparecem no canto inferior direito para todos os usuários', 'Create custom flying balloons that appear in the bottom-right corner for all users', 'Crea globos voladores personalizados que aparecen en la esquina inferior derecha para todos los usuarios')}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          {tr('Novo Balão', 'New Balloon', 'Nuevo Globo')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : balloons.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {tr('Nenhum balão criado ainda', 'No balloons created yet', 'No se han creado globos todavía')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {balloons.map((balloon) => (
            <div
              key={balloon.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    {balloon.image_url ? (
                      <img src={balloon.image_url} alt={balloon.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{balloon.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${balloon.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {balloon.is_active ? (tr('Ativo', 'Active', 'Activo')) : (tr('Inativo', 'Inactive', 'Inactivo'))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{tr('Efeito:', 'Effect:', 'Efecto:')}</span>
                  <span>{effectOptions.find(e => e.value === balloon.effect)?.label[language] || balloon.effect}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{tr('Tamanho:', 'Size:', 'Tamaño:')}</span>
                  <span>{balloon.size}px</span>
                </div>
                {balloon.link_url && (
                  <div className="flex items-center gap-1.5 truncate">
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{balloon.link_url}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => toggleActive(balloon)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${balloon.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'}`}
                >
                  {balloon.is_active ? (tr('Desativar', 'Deactivate', 'Desactivar')) : (tr('Ativar', 'Activate', 'Activar'))}
                </button>
                <button
                  onClick={() => openEdit(balloon)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
                >
                  <Edit3 className="w-3 h-3 inline mr-1" />
                  {tr('Editar', 'Edit', 'Editar')}
                </button>
                <button
                  onClick={() => handleDelete(balloon.id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3 inline" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setShowModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? tr('Editar Balão', 'Edit Balloon', 'Editar Globo') : tr('Novo Balão', 'New Balloon', 'Nuevo Globo')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              {form.image_url && (
                <div className="flex items-center justify-center py-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div className="relative" style={{ width: `${form.size}px`, height: `${form.size}px` }}>
                    <img src={form.image_url} alt="Preview" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Nome (interno)', 'Name (internal)', 'Nombre (interno)')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder={tr('Ex: Promoção de Natal', 'E.g. Christmas Promo', 'Ej: Promo de Navidad')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('URL da Imagem *', 'Image URL *', 'URL de la Imagen *')}</label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm(prev => ({ ...prev, image_url: e.target.value }))}
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="https://exemplo.com/balao.png"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Use uma imagem PNG transparente para melhor resultado', 'Use a transparent PNG for best results', 'Use un PNG transparente para mejor resultado')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Link ao clicar', 'Link on click', 'Enlace al hacer clic')}</label>
                <input
                  type="url"
                  value={form.link_url}
                  onChange={(e) => setForm(prev => ({ ...prev, link_url: e.target.value }))}
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="https://exemplo.com/promo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Destino do link', 'Link target', 'Destino del enlace')}</label>
                  <select
                    value={form.link_target}
                    onChange={(e) => setForm(prev => ({ ...prev, link_target: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="_blank">{tr('Nova aba', 'New tab', 'Nueva pestaña')}</option>
                    <option value="_self">{tr('Mesma aba', 'Same tab', 'Misma pestaña')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Efeito', 'Effect', 'Efecto')}</label>
                  <select
                    value={form.effect}
                    onChange={(e) => setForm(prev => ({ ...prev, effect: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    {effectOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label[language]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Tamanho (px)', 'Size (px)', 'Tamaño (px)')}</label>
                  <input
                    type="number"
                    min={32}
                    max={300}
                    value={form.size}
                    onChange={(e) => setForm(prev => ({ ...prev, size: parseInt(e.target.value) || 80 }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Base (px)', 'Bottom (px)', 'Abajo (px)')}</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={form.position_bottom}
                    onChange={(e) => setForm(prev => ({ ...prev, position_bottom: parseInt(e.target.value) || 0 }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Direita (px)', 'Right (px)', 'Derecha (px)')}</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={form.position_right}
                    onChange={(e) => setForm(prev => ({ ...prev, position_right: parseInt(e.target.value) || 0 }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Início', 'Start date', 'Fecha de inicio')}</label>
                  <input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('Fim (opcional)', 'End date (optional)', 'Fecha de fin (opcional)')}</label>
                  <input
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <input
                  type="checkbox"
                  id="is_active_balloon"
                  checked={form.is_active}
                  onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active_balloon" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  {tr('Ativar balão (apenas um balão pode estar ativo por vez)', 'Activate balloon (only one balloon can be active at a time)', 'Activar globo (solo un globo puede estar activo a la vez)')}
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {tr('Cancelar', 'Cancel', 'Cancelar')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {tr('Salvar', 'Save', 'Guardar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
