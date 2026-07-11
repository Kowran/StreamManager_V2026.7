import React, { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, User, Mail, Phone, Calendar, Search } from 'lucide-react';
import { supabase, Client } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
}

export function ClientsManager() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  useEffect(() => {
    if (editingClient) {
      setFormData({
        name: editingClient.name,
        email: editingClient.email || '',
        phone: editingClient.phone || ''
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: ''
      });
    }
  }, [editingClient]);

  async function loadClients() {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
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
        user_id: user?.id,
        updated_at: new Date().toISOString()
      };

      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(dataToSave)
          .eq('id', editingClient.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([dataToSave]);

        if (error) throw error;
      }

      await loadClients();
      setShowForm(false);
      setEditingClient(null);
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      alert(t.language === 'pt' ? 'Erro ao salvar cliente' :
           t.language === 'en' ? 'Error saving client' :
           'Error al guardar cliente');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClient(client: Client) {
    if (!confirm(t.language === 'pt' ? 'Tem certeza que deseja excluir este cliente?' :
                t.language === 'en' ? 'Are you sure you want to delete this client?' :
                '¿Estás seguro de que quieres eliminar este cliente?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;
      setClients(clients.filter(c => c.id !== client.id));
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      alert(t.language === 'pt' ? 'Erro ao excluir cliente' :
           t.language === 'en' ? 'Error deleting client' :
           'Error al eliminar cliente');
    }
  }

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t.language === 'pt' ? 'Gerenciar Clientes' :
             t.language === 'en' ? 'Manage Clients' :
             'Gestionar Clientes'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t.language === 'pt' ? 'Gerencie seus clientes' :
             t.language === 'en' ? 'Manage your clients' :
             'Gestiona tus clientes'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t.language === 'pt' ? 'Novo Cliente' :
           t.language === 'en' ? 'New Client' :
           'Nuevo Cliente'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder={t.language === 'pt' ? 'Buscar clientes...' :
                         t.language === 'en' ? 'Search clients...' :
                         'Buscar clientes...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <User className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {searchTerm ? 
                  (t.language === 'pt' ? 'Nenhum cliente encontrado' :
                   t.language === 'en' ? 'No clients found' :
                   'No se encontraron clientes') :
                  (t.language === 'pt' ? 'Nenhum cliente cadastrado' :
                   t.language === 'en' ? 'No clients registered' :
                   'No hay clientes registrados')
                }
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? 
                  (t.language === 'pt' ? 'Tente ajustar os termos de busca' :
                   t.language === 'en' ? 'Try adjusting your search terms' :
                   'Intenta ajustar los términos de búsqueda') :
                  (t.language === 'pt' ? 'Comece adicionando seu primeiro cliente' :
                   t.language === 'en' ? 'Start by adding your first client' :
                   'Comienza agregando tu primer cliente')
                }
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t.language === 'pt' ? 'Adicionar Primeiro Cliente' :
                   t.language === 'en' ? 'Add First Client' :
                   'Agregar Primer Cliente'}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t.language === 'pt' ? 'Nome' : t.language === 'en' ? 'Name' : 'Nombre'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t.language === 'pt' ? 'Email' : t.language === 'en' ? 'Email' : 'Email'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t.language === 'pt' ? 'Telefone' : t.language === 'en' ? 'Phone' : 'Teléfono'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t.language === 'pt' ? 'Criado em' :
                         t.language === 'en' ? 'Created at' :
                         'Creado en'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t.language === 'pt' ? 'Ações' : t.language === 'en' ? 'Actions' : 'Acciones'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {client.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900 dark:text-white">
                            {client.email && <Mail className="h-4 w-4 mr-2 text-gray-400" />}
                            {client.email || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900 dark:text-white">
                            {client.phone && <Phone className="h-4 w-4 mr-2 text-gray-400" />}
                            {client.phone || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900 dark:text-white">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            {new Date(client.created_at).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setEditingClient(client);
                                setShowForm(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClient(client)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
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
        </>
      )}

      {/* Formulário de cliente */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                {editingClient ? 
                  (t.language === 'pt' ? 'Editar Cliente' :
                   t.language === 'en' ? 'Edit Client' :
                   'Editar Cliente') :
                  (t.language === 'pt' ? 'Novo Cliente' :
                   t.language === 'en' ? 'New Client' :
                   'Nuevo Cliente')
                }
              </h4>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingClient(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.language === 'pt' ? 'Nome' : t.language === 'en' ? 'Name' : 'Nombre'} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder={t.language === 'pt' ? 'Nome completo do cliente' :
                             t.language === 'en' ? 'Client full name' :
                             'Nombre completo del cliente'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="cliente@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.language === 'pt' ? 'Telefone' : t.language === 'en' ? 'Phone' : 'Teléfono'}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingClient(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 
                    (t.language === 'pt' ? 'Salvando...' : t.language === 'en' ? 'Saving...' : 'Guardando...') : 
                    (editingClient ? 
                      (t.language === 'pt' ? 'Atualizar' : t.language === 'en' ? 'Update' : 'Actualizar') :
                      (t.language === 'pt' ? 'Adicionar' : t.language === 'en' ? 'Add' : 'Agregar')
                    )
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}