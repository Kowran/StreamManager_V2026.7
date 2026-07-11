import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Play, Search, Eye, EyeOff } from 'lucide-react';
import { supabase, StreamingService } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

export function ServicesManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [services, setServices] = useState<StreamingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<StreamingService | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    max_profiles: 4,
    monthly_price: 0,
    logo_url: '',
    active: true
  });

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">Você precisa estar logado para acessar esta página.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (editingService) {
      setFormData({
        name: editingService.name,
        max_profiles: editingService.max_profiles,
        monthly_price: editingService.monthly_price,
        logo_url: editingService.logo_url || '',
        active: editingService.active
      });
    } else {
      setFormData({
        name: '',
        max_profiles: 4,
        monthly_price: 0,
        logo_url: '',
        active: true
      });
    }
  }, [editingService]);

  async function loadServices() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('streaming_services')
        .select('*')
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        logo_url: formData.logo_url || null,
        created_at: editingService ? undefined : new Date().toISOString()
      };

      if (editingService) {
        // Atualizar serviço existente
        const { error } = await supabase
          .from('streaming_services')
          .update(dataToSave)
          .eq('id', editingService.id);

        if (error) throw error;
      } else {
        // Criar novo serviço
        const { error } = await supabase
          .from('streaming_services')
          .insert([dataToSave]);

        if (error) throw error;
      }

      await loadServices();
      setShowForm(false);
      setEditingService(null);
    } catch (error) {
      console.error('Erro ao salvar serviço:', error);
      alert(t.errorSavingService);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteService(service: StreamingService) {
    if (!confirm(t.confirmDelete)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('streaming_services')
        .delete()
        .eq('id', service.id);

      if (error) throw error;
      
      setServices(services.filter(s => s.id !== service.id));
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      alert(t.errorDeletingService);
    }
  }

  async function toggleServiceStatus(service: StreamingService) {
    try {
      const { error } = await supabase
        .from('streaming_services')
        .update({ active: !service.active })
        .eq('id', service.id);

      if (error) throw error;
      
      setServices(services.map(s => 
        s.id === service.id ? { ...s, active: !s.active } : s
      ));
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(t.language === 'pt' ? 'Erro ao atualizar status do serviço' :
           t.language === 'en' ? 'Error updating service status' :
           'Error al actualizar estado del servicio');
    }
  }

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">{t.streamingServices}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t.newService}
        </button>
      </div>

      {/* Barra de pesquisa */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder={`${t.search}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Grid de serviços */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {filteredServices.map((service) => (
          <div key={service.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
            <div className="aspect-w-16 aspect-h-9 bg-gray-100">
              {service.logo_url ? (
                <img
                  src={service.logo_url}
                  alt={service.name}
                  className="w-full h-24 sm:h-32 object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`flex items-center justify-center h-24 sm:h-32 bg-gradient-to-br from-blue-500 to-purple-600 ${service.logo_url ? 'hidden' : ''}`}>
                <Play className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
              </div>
            </div>
            
            <div className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white truncate">{service.name}</h3>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  service.active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {service.active ? t.active : t.inactive}
                </span>
              </div>
              
              <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>{t.maxProfiles}:</span>
                  <span className="font-medium">{service.max_profiles}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.monthlyPrice}:</span>
                  <span className="font-medium">${service.monthly_price.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => toggleServiceStatus(service)}
                  className={`p-2 rounded-md transition-colors ${
                    service.active 
                      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' 
                      : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}
                  title={service.active ? t.inactive : t.active}
                >
                  {service.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <button
                    onClick={() => {
                      setEditingService(service);
                      setShowForm(true);
                    }}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
                    title={t.edit}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteService(service)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title={t.delete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12">
          <Play className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">{t.noDataFound}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {t.streamingServices}
          </p>
        </div>
      )}

      {/* Modal do formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingService ? t.editService : t.newService}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingService(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Plus className="h-6 w-6 transform rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t.serviceName} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t.serviceExample}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t.logoUrl}
                </label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t.language === 'pt' ? 'https://exemplo.com/logo.png' :
                              t.language === 'en' ? 'https://example.com/logo.png' :
                              'https://ejemplo.com/logo.png'}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t.logoDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t.maxProfiles} *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={formData.max_profiles}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_profiles: parseInt(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t.monthlyPrice} (USD) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.monthly_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthly_price: parseFloat(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">{t.active}</span>
                </label>
              </div>

              {/* Preview da logo */}
              {formData.logo_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.logoPreview}
                  </label>
                  <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                    <img
                      src={formData.logo_url}
                      alt="Preview"
                      className="h-16 w-auto mx-auto object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden text-center text-sm text-red-500 mt-2">
                      {t.errorLoadingImage}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingService(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? t.saving : (editingService ? t.edit : t.add)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}