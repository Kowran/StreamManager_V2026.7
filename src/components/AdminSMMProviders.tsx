import React, { useState, useEffect } from 'react';
import { Server, Plus, Edit2, Trash2, Save, X, RefreshCw, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { SMMImportModal } from './SMMImportModal';

interface SMMProvider {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  status: string;
  provider_type: string;
  rate_multiplier: number;
  auto_sync: boolean;
  sync_interval_hours: number;
  last_sync: string | null;
  total_services: number;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export function AdminSMMProviders() {
  const { language } = useLanguage();
  const [providers, setProviders] = useState<SMMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SMMProvider | null>(null);
  const [importingProvider, setImportingProvider] = useState<SMMProvider | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    api_url: '',
    api_key: '',
    provider_type: 'smm-panel',
    rate_multiplier: 1.0
  });

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('smm_providers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error('Error loading providers:', error);
      alert(language === 'pt' ? 'Erro ao carregar provedores' : language === 'en' ? 'Error loading providers' : 'Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProvider() {
    if (!formData.name || !formData.api_url || !formData.api_key) {
      alert(language === 'pt' ? 'Preencha todos os campos' : language === 'en' ? 'Fill all fields' : 'Complete todos los campos');
      return;
    }

    try {
      const { error } = await supabase
        .from('smm_providers')
        .insert({
          name: formData.name,
          api_url: formData.api_url,
          api_key: formData.api_key,
          provider_type: formData.provider_type,
          rate_multiplier: formData.rate_multiplier,
          status: 'active'
        });

      if (error) throw error;

      setShowAddModal(false);
      setFormData({ name: '', api_url: '', api_key: '', provider_type: 'smm-panel', rate_multiplier: 1.0 });
      loadProviders();

      alert(language === 'pt' ? 'Provedor adicionado!' : language === 'en' ? 'Provider added!' : '¡Proveedor agregado!');
    } catch (error) {
      console.error('Error adding provider:', error);
      alert(language === 'pt' ? 'Erro ao adicionar provedor' : language === 'en' ? 'Error adding provider' : 'Error al agregar proveedor');
    }
  }

  async function handleUpdateProvider() {
    if (!editingProvider) return;

    try {
      const { error } = await supabase
        .from('smm_providers')
        .update({
          name: editingProvider.name,
          api_url: editingProvider.api_url,
          api_key: editingProvider.api_key,
          provider_type: editingProvider.provider_type,
          rate_multiplier: editingProvider.rate_multiplier
        })
        .eq('id', editingProvider.id);

      if (error) throw error;

      setEditingProvider(null);
      loadProviders();

      alert(language === 'pt' ? 'Provedor atualizado!' : language === 'en' ? 'Provider updated!' : '¡Proveedor actualizado!');
    } catch (error) {
      console.error('Error updating provider:', error);
      alert(language === 'pt' ? 'Erro ao atualizar provedor' : language === 'en' ? 'Error updating provider' : 'Error al actualizar proveedor');
    }
  }

  async function handleDeleteProvider(id: string) {
    if (!window.confirm(
      language === 'pt'
        ? 'Tem certeza que deseja excluir este provedor?'
        : language === 'en'
        ? 'Are you sure you want to delete this provider?'
        : '¿Está seguro de que desea eliminar este proveedor?'
    )) return;

    try {
      const { error } = await supabase
        .from('smm_providers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadProviders();
      alert(language === 'pt' ? 'Provedor excluído!' : language === 'en' ? 'Provider deleted!' : '¡Proveedor eliminado!');
    } catch (error) {
      console.error('Error deleting provider:', error);
      alert(language === 'pt' ? 'Erro ao excluir provedor' : language === 'en' ? 'Error deleting provider' : 'Error al eliminar proveedor');
    }
  }

  async function handleTestConnection(provider: SMMProvider) {
    setTestingConnection(provider.id);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-smm-provider`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider_id: provider.id
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(
          language === 'pt'
            ? `Conexão bem-sucedida! Saldo: ${result.balance} ${result.currency}`
            : language === 'en'
            ? `Connection successful! Balance: ${result.balance} ${result.currency}`
            : `¡Conexión exitosa! Saldo: ${result.balance} ${result.currency}`
        );
        loadProviders();
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      alert(
        language === 'pt'
          ? 'Erro ao testar conexão'
          : language === 'en'
          ? 'Error testing connection'
          : 'Error al probar conexión'
      );
    } finally {
      setTestingConnection(null);
    }
  }

  function handleImportServices(provider: SMMProvider) {
    setImportingProvider(provider);
  }

  function handleImportComplete() {
    loadProviders();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {language === 'pt' ? 'Provedores SMM' : language === 'en' ? 'SMM Providers' : 'Proveedores SMM'}
            </h1>
            <p className="text-blue-100">
              {language === 'pt'
                ? 'Configure APIs e importe serviços de provedores SMM'
                : language === 'en'
                ? 'Configure APIs and import services from SMM providers'
                : 'Configure APIs e importe servicios de proveedores SMM'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Server className="h-12 w-12 text-blue-100" />
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center space-x-2 font-medium"
            >
              <Plus className="h-5 w-5" />
              <span>{language === 'pt' ? 'Adicionar' : language === 'en' ? 'Add' : 'Agregar'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {providers.map((provider) => (
          <div key={provider.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{provider.name}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    provider.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : provider.status === 'error'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {provider.status === 'active'
                      ? language === 'pt' ? 'Ativo' : language === 'en' ? 'Active' : 'Activo'
                      : provider.status === 'error'
                      ? language === 'pt' ? 'Erro' : language === 'en' ? 'Error' : 'Error'
                      : language === 'pt' ? 'Inativo' : language === 'en' ? 'Inactive' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <strong>{language === 'pt' ? 'URL:' : language === 'en' ? 'URL:' : 'URL:'}</strong> {provider.api_url}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <strong>{language === 'pt' ? 'Tipo:' : language === 'en' ? 'Type:' : 'Tipo:'}</strong> {provider.provider_type}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <strong>{language === 'pt' ? 'Multiplicador:' : language === 'en' ? 'Rate Multiplier:' : 'Multiplicador:'}</strong> {provider.rate_multiplier}x
                </p>
                {provider.balance !== null && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <strong>{language === 'pt' ? 'Saldo:' : language === 'en' ? 'Balance:' : 'Saldo:'}</strong> {provider.balance} {provider.currency}
                  </p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{language === 'pt' ? 'Serviços:' : language === 'en' ? 'Services:' : 'Servicios:'}</strong> {provider.total_services || 0}
                </p>
                {provider.last_sync && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {language === 'pt' ? 'Última sincronização:' : language === 'en' ? 'Last sync:' : 'Última sincronización:'} {new Date(provider.last_sync).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleTestConnection(provider)}
                  disabled={testingConnection === provider.id}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                  title={language === 'pt' ? 'Testar Conexão' : language === 'en' ? 'Test Connection' : 'Probar Conexión'}
                >
                  {testingConnection === provider.id ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => handleImportServices(provider)}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title={language === 'pt' ? 'Importar Serviços' : language === 'en' ? 'Import Services' : 'Importar Servicios'}
                >
                  <Download className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setEditingProvider(provider)}
                  className="p-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title={language === 'pt' ? 'Editar' : language === 'en' ? 'Edit' : 'Editar'}
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDeleteProvider(provider.id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title={language === 'pt' ? 'Excluir' : language === 'en' ? 'Delete' : 'Eliminar'}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {providers.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Server className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="mb-4">
              {language === 'pt' ? 'Nenhum provedor configurado' : language === 'en' ? 'No providers configured' : 'No hay proveedores configurados'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>{language === 'pt' ? 'Adicionar Primeiro Provedor' : language === 'en' ? 'Add First Provider' : 'Agregar Primer Proveedor'}</span>
            </button>
          </div>
        )}
      </div>

      {(showAddModal || editingProvider) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingProvider
                  ? language === 'pt' ? 'Editar Provedor' : language === 'en' ? 'Edit Provider' : 'Editar Proveedor'
                  : language === 'pt' ? 'Adicionar Provedor' : language === 'en' ? 'Add Provider' : 'Agregar Proveedor'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProvider(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Nome do Provedor' : language === 'en' ? 'Provider Name' : 'Nombre del Proveedor'}
                </label>
                <input
                  type="text"
                  value={editingProvider ? editingProvider.name : formData.name}
                  onChange={(e) => editingProvider
                    ? setEditingProvider({ ...editingProvider, name: e.target.value })
                    : setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: PainelSMM Pro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'URL da API' : language === 'en' ? 'API URL' : 'URL de la API'}
                </label>
                <input
                  type="url"
                  value={editingProvider ? editingProvider.api_url : formData.api_url}
                  onChange={(e) => editingProvider
                    ? setEditingProvider({ ...editingProvider, api_url: e.target.value })
                    : setFormData({ ...formData, api_url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="https://api.provider.com/v2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Chave API' : language === 'en' ? 'API Key' : 'Clave API'}
                </label>
                <input
                  type="text"
                  value={editingProvider ? editingProvider.api_key : formData.api_key}
                  onChange={(e) => editingProvider
                    ? setEditingProvider({ ...editingProvider, api_key: e.target.value })
                    : setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                  placeholder="abc123def456..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Multiplicador de Taxa (markup)' : language === 'en' ? 'Rate Multiplier (markup)' : 'Multiplicador de Tasa (markup)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={editingProvider ? editingProvider.rate_multiplier : formData.rate_multiplier}
                  onChange={(e) => editingProvider
                    ? setEditingProvider({ ...editingProvider, rate_multiplier: parseFloat(e.target.value) || 1 })
                    : setFormData({ ...formData, rate_multiplier: parseFloat(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {language === 'pt' ? 'Ex: 1.5 = adiciona 50% aos preços' : language === 'en' ? 'Ex: 1.5 = adds 50% to prices' : 'Ej: 1.5 = agrega 50% a los precios'}
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProvider(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {language === 'pt' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  onClick={editingProvider ? handleUpdateProvider : handleAddProvider}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{language === 'pt' ? 'Salvar' : language === 'en' ? 'Save' : 'Guardar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importingProvider && (
        <SMMImportModal
          providerId={importingProvider.id}
          providerName={importingProvider.name}
          rateMultiplier={importingProvider.rate_multiplier}
          onClose={() => setImportingProvider(null)}
          onImportComplete={handleImportComplete}
        />
      )}
    </div>
  );
}
