import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { Bell, Plus, CreditCard as Edit2, Trash2, Eye, EyeOff, Calendar, Clock, Image, Link, X, AlertCircle, CheckCircle, AlertTriangle, Info, Megaphone, Tag, Save, ArrowUp, ArrowDown, Settings, Users, BarChart3 } from 'lucide-react';

interface Popup {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  popup_type: 'info' | 'warning' | 'success' | 'error' | 'announcement' | 'promotion';
  position: 'center' | 'top' | 'bottom' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  display_duration: number;
  show_once: boolean;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  priority: number;
  button_text: string | null;
  button_url: string | null;
  allow_close: boolean;
  overlay: boolean;
  created_at: string;
  view_count: number;
  close_count: number;
}

export default function AdminPopupManager() {
  const { t, language } = useLanguage();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPopup, setEditingPopup] = useState<Popup | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    image_url: '',
    popup_type: 'info' as Popup['popup_type'],
    position: 'center' as Popup['position'],
    display_duration: 0,
    show_once: false,
    start_date: new Date().toISOString().slice(0, 16),
    end_date: '',
    is_active: true,
    priority: 0,
    button_text: '',
    button_url: '',
    allow_close: true,
    overlay: true
  });

  useEffect(() => {
    loadPopups();
  }, []);

  async function loadPopups() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_popups')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPopups(data || []);
    } catch (error) {
      console.error('Error loading popups:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!formData.title.trim() || !formData.message.trim()) {
      alert(language === 'pt' ? 'Title e mensagem sao obrigatorios' : 'Title and message are required');
      return;
    }

    setSaving(true);
    try {
      const popupData = {
        ...formData,
        end_date: formData.end_date || null,
        image_url: formData.image_url || null,
        button_text: formData.button_text || null,
        button_url: formData.button_url || null
      };

      if (editingPopup) {
        const { error } = await supabase
          .from('admin_popups')
          .update(popupData)
          .eq('id', editingPopup.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_popups')
          .insert(popupData);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingPopup(null);
      resetForm();
      loadPopups();
    } catch (error) {
      console.error('Error saving popup:', error);
      alert('Error saving popup');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(language === 'pt' ? 'Tem certeza que deseja excluir este pop-up?' : 'Are you sure you want to delete this popup?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_popups')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadPopups();
    } catch (error) {
      console.error('Error deleting popup:', error);
    }
  }

  async function toggleActive(popup: Popup) {
    try {
      const { error } = await supabase
        .from('admin_popups')
        .update({ is_active: !popup.is_active })
        .eq('id', popup.id);

      if (error) throw error;
      loadPopups();
    } catch (error) {
      console.error('Error toggling popup:', error);
    }
  }

  function resetForm() {
    setFormData({
      title: '',
      message: '',
      image_url: '',
      popup_type: 'info',
      position: 'center',
      display_duration: 0,
      show_once: false,
      start_date: new Date().toISOString().slice(0, 16),
      end_date: '',
      is_active: true,
      priority: 0,
      button_text: '',
      button_url: '',
      allow_close: true,
      overlay: true
    });
  }

  function openEditPopup(popup: Popup) {
    setEditingPopup(popup);
    setFormData({
      title: popup.title,
      message: popup.message,
      image_url: popup.image_url || '',
      popup_type: popup.popup_type,
      position: popup.position,
      display_duration: popup.display_duration,
      show_once: popup.show_once,
      start_date: popup.start_date.slice(0, 16),
      end_date: popup.end_date ? popup.end_date.slice(0, 16) : '',
      is_active: popup.is_active,
      priority: popup.priority,
      button_text: popup.button_text || '',
      button_url: popup.button_url || '',
      allow_close: popup.allow_close,
      overlay: popup.overlay
    });
    setShowModal(true);
  }

  function getPopupTypeIcon(type: string) {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'announcement': return <Megaphone className="w-4 h-4 text-blue-500" />;
      case 'promotion': return <Tag className="w-4 h-4 text-purple-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  }

  function getPopupTypeColor(type: string) {
    switch (type) {
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'announcement': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'promotion': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }

  const filteredPopups = popups.filter(popup => {
    if (filterActive === 'active') return popup.is_active;
    if (filterActive === 'inactive') return !popup.is_active;
    return true;
  });

  const translations = {
    title: language === 'pt' ? 'Gerenciador de Pop-ups' : language === 'en' ? 'Popup Manager' : 'Gestor de Pop-ups',
    newPopup: language === 'pt' ? 'Novo Pop-up' : 'New Popup',
    editPopup: language === 'pt' ? 'Editar Pop-up' : 'Edit Popup',
    all: language === 'pt' ? 'Todos' : 'All',
    active: language === 'pt' ? 'Ativos' : 'Active',
    inactive: language === 'pt' ? 'Inativos' : 'Inactive',
    noPopups: language === 'pt' ? 'Nenhum pop-up encontrado' : 'No popups found',
    createFirst: language === 'pt' ? 'Crie seu primeiro pop-up' : 'Create your first popup',
    popupTitle: language === 'pt' ? 'Titulo' : 'Title',
    message: language === 'pt' ? 'Mensagem' : 'Message',
    imageUrl: language === 'pt' ? 'URL da Imagem (opcional)' : 'Image URL (optional)',
    popupType: language === 'pt' ? 'Tipo de Pop-up' : 'Popup Type',
    position: language === 'pt' ? 'Posicao' : 'Position',
    duration: language === 'pt' ? 'Duracao (segundos, 0 = ate fechar)' : 'Duration (seconds, 0 = until closed)',
    showOnce: language === 'pt' ? 'Mostrar apenas uma vez por usuario' : 'Show only once per user',
    startDate: language === 'pt' ? 'Data de Inicio' : 'Start Date',
    endDate: language === 'pt' ? 'Data de Termino (opcional)' : 'End Date (optional)',
    priority: language === 'pt' ? 'Prioridade' : 'Priority',
    buttonText: language === 'pt' ? 'Texto do Botao (opcional)' : 'Button Text (optional)',
    buttonUrl: language === 'pt' ? 'URL do Botao (opcional)' : 'Button URL (optional)',
    allowClose: language === 'pt' ? 'Permitir fechar' : 'Allow close',
    showOverlay: language === 'pt' ? 'Mostrar overlay escuro' : 'Show dark overlay',
    save: language === 'pt' ? 'Salvar' : 'Save',
    cancel: language === 'pt' ? 'Cancelar' : 'Cancel',
    views: language === 'pt' ? 'Visualizacoes' : 'Views',
    status: language === 'pt' ? 'Status' : 'Status',
    actions: language === 'pt' ? 'Acoes' : 'Actions',
    delete: language === 'pt' ? 'Excluir' : 'Delete',
    edit: language === 'pt' ? 'Editar' : 'Edit',
    saving: language === 'pt' ? 'Salvando...' : 'Saving...',
    types: {
      info: 'Info',
      warning: language === 'pt' ? 'Alerta' : 'Warning',
      success: language === 'pt' ? 'Sucesso' : 'Success',
      error: language === 'pt' ? 'Erro' : 'Error',
      announcement: language === 'pt' ? 'Anuncio' : 'Announcement',
      promotion: language === 'pt' ? 'Promocao' : 'Promotion',
    },
    positions: {
      center: language === 'pt' ? 'Centro' : 'Center',
      top: language === 'pt' ? 'Topo' : 'Top',
      bottom: language === 'pt' ? 'Baixo' : 'Bottom',
      'top-right': language === 'pt' ? 'Topo Direita' : 'Top Right',
      'top-left': language === 'pt' ? 'Topo Esquerda' : 'Top Left',
      'bottom-right': language === 'pt' ? 'Baixo Direita' : 'Bottom Right',
      'bottom-left': language === 'pt' ? 'Baixo Esquerda' : 'Bottom Left',
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{translations.title}</h2>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingPopup(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {translations.newPopup}
        </button>
      </div>

      <div className="flex gap-2">
        {(['all', 'active', 'inactive'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setFilterActive(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterActive === filter
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {translations[filter]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredPopups.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{translations.noPopups}</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{translations.createFirst}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {translations.popupTitle}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {translations.popupType}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {translations.status}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {translations.views}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {translations.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPopups.map((popup) => (
                  <tr key={popup.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getPopupTypeIcon(popup.popup_type)}
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {popup.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {popup.message.substring(0, 50)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPopupTypeColor(popup.popup_type)}`}>
                        {translations.types[popup.popup_type]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(popup)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          popup.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {popup.is_active ? (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            {translations.active}
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3 mr-1" />
                            {translations.inactive}
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {popup.view_count}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditPopup(popup)}
                          className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title={translations.edit}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(popup.id)}
                          className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title={translations.delete}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingPopup ? translations.editPopup : translations.newPopup}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.popupTitle} *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.message} *
                  </label>
                  <textarea
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.imageUrl}
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Type and Position */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.popupType}
                  </label>
                  <select
                    value={formData.popup_type}
                    onChange={(e) => setFormData({ ...formData, popup_type: e.target.value as Popup['popup_type'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(translations.types).map(([key, value]) => (
                      <option key={key} value={key}>{value}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.position}
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value as Popup['position'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(translations.positions).map(([key, value]) => (
                      <option key={key} value={key}>{value}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.duration}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.display_duration}
                    onChange={(e) => setFormData({ ...formData, display_duration: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.priority}
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.startDate}
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.endDate}
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Button Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.buttonText}
                  </label>
                  <input
                    type="text"
                    value={formData.button_text}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                    placeholder="Saiba mais"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {translations.buttonUrl}
                  </label>
                  <input
                    type="url"
                    value={formData.button_url}
                    onChange={(e) => setFormData({ ...formData, button_url: e.target.value })}
                    placeholder="https://"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.show_once}
                    onChange={(e) => setFormData({ ...formData, show_once: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{translations.showOnce}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_close}
                    onChange={(e) => setFormData({ ...formData, allow_close: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{translations.allowClose}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.overlay}
                    onChange={(e) => setFormData({ ...formData, overlay: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{translations.showOverlay}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{translations.active}</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {translations.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {translations.saving}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {translations.save}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
