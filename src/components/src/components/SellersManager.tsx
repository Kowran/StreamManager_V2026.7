import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, UserCheck, UserX, Search } from 'lucide-react';
import { supabase, Seller } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

export function SellersManager() {
  const { t } = useLanguage();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    active: true
  });

  useEffect(() => {
    loadSellers();
  }, []);

  useEffect(() => {
    if (editingSeller) {
      setFormData({
        name: editingSeller.name,
        email: editingSeller.email || '',
        phone: editingSeller.phone || '',
        active: editingSeller.active
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        active: true
      });
    }
  }, [editingSeller]);

  async function loadSellers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSellers(data || []);
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error);
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
        email: formData.email || null,
        phone: formData.phone || null,
        updated_at: new Date().toISOString()
      };

      if (editingSeller) {
        // Atualizar vendedor existente
        const { error } = await supabase
          .from('sellers')
          .update(dataToSave)
          .eq('id', editingSeller.id);

        if (error) throw error;
      } else {
        // Criar novo vendedor
        const { error } = await supabase
          .from('sellers')
          .insert([dataToSave]);

        if (error) throw error;
      }

      await loadSellers();
      setShowForm(false);
      setEditingSeller(null);
    } catch (error) {
      console.error('Erro ao salvar vendedor:', error);
      alert(t.language === 'pt' ? 'Erro ao salvar vendedor' :
           t.language === 'en' ? 'Error saving seller' :
           'Error al guardar vendedor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSeller(seller: Seller) {
    if (!confirm(t.confirmDelete)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sellers')
        .delete()
        .eq('id', seller.id);

      if (error) throw error;
      
      setSellers(sellers.filter(s => s.id !== seller.id));
    } catch (error) {
      console.error('Erro ao excluir vendedor:', error);
      alert(t.language === 'pt' ? 'Erro ao excluir vendedor' :
           t.language === 'en' ? 'Error deleting seller' :
           'Error al eliminar vendedor');
    }
  }

  async function toggleSellerStatus(seller: Seller) {
    try {
      const { error } = await supabase
        .from('sellers')
        .update({ 
          active: !seller.active,
          updated_at: new Date().toISOString()
        })
        .eq('id', seller.id);

      if (error) throw error;
      
      setSellers(sellers.map(s => 
        s.id === seller.id ? { ...s, active: !s.active } : s
      ));
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(t.language === 'pt' ? 'Erro ao atualizar status do vendedor' :
           t.language === 'en' ? 'Error updating seller status' :
           'Error al actualizar estado del vendedor');
    }
  }

  const filteredSellers = sellers.filter(seller => 
    seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (seller.email && seller.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (seller.phone && seller.phone.includes(searchTerm))
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
        <h2 className="text-2xl font-bold text-gray-900">{t.sellers}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t.newSeller}
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

      {/* Lista de vendedores */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.name}
                </th>
                <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.email}
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.phone}
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.status}
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.createdAt}
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.actions}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSellers.map((seller) => (
                <tr key={seller.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {seller.name}
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {seller.email || '-'}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {seller.phone || '-'}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      seller.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {seller.active ? t.active : t.inactive}
                    </span>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {new Date(seller.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button
                        onClick={() => toggleSellerStatus(seller)}
                        className={`transition-colors ${
                          seller.active 
                            ? 'p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300' 
                            : 'p-1 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                        }`}
                        title={seller.active ? t.inactive : t.active}
                      >
                        {seller.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingSeller(seller);
                          setShowForm(true);
                        }}
                        className="p-1 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                        title={t.edit}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSeller(seller)}
                        className="p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        title={t.delete}
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

      {filteredSellers.length === 0 && (
        <div className="text-center py-12">
          <UserCheck className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t.noDataFound}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {t.language === 'pt' ? 'Você ainda não tem vendedores cadastrados' :
             t.language === 'en' ? 'You don\'t have any sellers registered yet' :
             'Aún no tienes vendedores registrados'}
          </p>
        </div>
      )}

      {/* Modal do formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingSeller ? t.editSeller : t.newSeller}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingSeller(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Plus className="h-6 w-6 transform rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t.name} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t.fullName}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t.email}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t.language === 'pt' ? 'email@exemplo.com' :
                              t.language === 'en' ? 'email@example.com' :
                              'email@ejemplo.com'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t.phone}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t.language === 'pt' ? '(11) 99999-9999' :
                              t.language === 'en' ? '(11) 99999-9999' :
                              '(11) 99999-9999'}
                />
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

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingSeller(null);
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
                  {saving ? `${t.save}...` : (editingSeller ? t.edit : t.add)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}