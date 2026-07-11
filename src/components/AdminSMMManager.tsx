import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, Package, DollarSign, TrendingUp, Tag, CheckCircle, XCircle, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface SMMService {
  id: string;
  name: string;
  description: string;
  category: string;
  category_id: string | null;
  subcategory?: string;
  price_per_1000: number;
  min_order: number;
  max_order: number;
  active: boolean;
  provider_service_id: string;
  provider_name?: string;
  average_time: string;
  quality: string;
  dripfeed: boolean;
  refill: boolean;
  cancel: boolean;
}

interface SMMCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  active: boolean;
  sort_order: number;
}

export function AdminSMMManager() {
  const { language } = useLanguage();
  const [services, setServices] = useState<SMMService[]>([]);
  const [categories, setCategories] = useState<SMMCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editingService, setEditingService] = useState<SMMService | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    category: '',
    category_id: null as string | null,
    subcategory: '',
    price_per_1000: 0,
    min_order: 100,
    max_order: 100000,
    active: true,
    provider_service_id: 'manual',
    average_time: '1-6 hours',
    quality: 'high',
    dripfeed: false,
    refill: false,
    cancel: false
  });

  useEffect(() => {
    loadServices();
    loadCategories();
  }, []);

  async function loadServices() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('smm_services')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const servicesWithProvider = await Promise.all(
        (data || []).map(async (service) => {
          if (service.provider_service_id && service.provider_service_id !== 'manual') {
            const { data: provider } = await supabase
              .from('smm_providers')
              .select('name')
              .eq('api_key', service.provider_service_id.split('_')[0])
              .maybeSingle();

            return {
              ...service,
              provider_name: provider?.name || 'Unknown'
            };
          }
          return {
            ...service,
            provider_name: 'Manual'
          };
        })
      );

      setServices(servicesWithProvider);
    } catch (error) {
      console.error('Error loading services:', error);
      alert(language === 'pt' ? 'Erro ao carregar serviços' : language === 'en' ? 'Error loading services' : 'Error al cargar servicios');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from('smm_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async function handleToggleActive(serviceId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('smm_services')
        .update({ active: !currentStatus })
        .eq('id', serviceId);

      if (error) throw error;

      setServices(services.map(s =>
        s.id === serviceId ? { ...s, active: !currentStatus } : s
      ));

      alert(
        language === 'pt'
          ? `Serviço ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`
          : language === 'en'
          ? `Service ${!currentStatus ? 'activated' : 'deactivated'} successfully!`
          : `¡Servicio ${!currentStatus ? 'activado' : 'desactivado'} con éxito!`
      );
    } catch (error) {
      console.error('Error toggling service status:', error);
      alert(language === 'pt' ? 'Erro ao atualizar status' : language === 'en' ? 'Error updating status' : 'Error al actualizar estado');
    }
  }

  async function handleUpdatePrice(serviceId: string, newPrice: number) {
    if (newPrice < 0) {
      alert(language === 'pt' ? 'Preço inválido' : language === 'en' ? 'Invalid price' : 'Precio inválido');
      return;
    }

    try {
      const { error } = await supabase
        .from('smm_services')
        .update({ price_per_1000: newPrice })
        .eq('id', serviceId);

      if (error) throw error;

      setServices(services.map(s =>
        s.id === serviceId ? { ...s, price_per_1000: newPrice } : s
      ));

      alert(language === 'pt' ? 'Preço atualizado!' : language === 'en' ? 'Price updated!' : '¡Precio actualizado!');
    } catch (error) {
      console.error('Error updating price:', error);
      alert(language === 'pt' ? 'Erro ao atualizar preço' : language === 'en' ? 'Error updating price' : 'Error al actualizar precio');
    }
  }

  function handleEditService(service: SMMService) {
    setEditingService({ ...service });
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!editingService) return;

    try {
      const { error } = await supabase
        .from('smm_services')
        .update({
          name: editingService.name,
          description: editingService.description,
          price_per_1000: editingService.price_per_1000,
          min_order: editingService.min_order,
          max_order: editingService.max_order,
          active: editingService.active,
          category: editingService.category,
          category_id: editingService.category_id,
          subcategory: editingService.subcategory || null,
          average_time: editingService.average_time,
          quality: editingService.quality,
          dripfeed: editingService.dripfeed,
          refill: editingService.refill,
          cancel: editingService.cancel
        })
        .eq('id', editingService.id);

      if (error) throw error;

      setServices(services.map(s =>
        s.id === editingService.id ? editingService : s
      ));

      setShowEditModal(false);
      setEditingService(null);

      alert(language === 'pt' ? 'Serviço atualizado!' : language === 'en' ? 'Service updated!' : '¡Servicio actualizado!');
    } catch (error) {
      console.error('Error updating service:', error);
      alert(language === 'pt' ? 'Erro ao atualizar serviço' : language === 'en' ? 'Error updating service' : 'Error al actualizar servicio');
    }
  }

  async function handleCreateService() {
    if (!newService.name || !newService.category || newService.price_per_1000 <= 0) {
      alert(language === 'pt' ? 'Preencha todos os campos obrigatórios' : language === 'en' ? 'Fill in all required fields' : 'Complete todos los campos obligatorios');
      return;
    }

    try {
      const categoryData = categories.find(cat => cat.name === newService.category);

      const { data, error } = await supabase
        .from('smm_services')
        .insert([{
          name: newService.name,
          description: newService.description,
          category: newService.category,
          category_id: categoryData?.id || null,
          subcategory: newService.subcategory || null,
          price_per_1000: newService.price_per_1000,
          min_order: newService.min_order,
          max_order: newService.max_order,
          active: newService.active,
          provider_service_id: newService.provider_service_id,
          average_time: newService.average_time,
          quality: newService.quality,
          dripfeed: newService.dripfeed,
          refill: newService.refill,
          cancel: newService.cancel
        }])
        .select();

      if (error) throw error;

      setShowCreateModal(false);
      setNewService({
        name: '',
        description: '',
        category: '',
        category_id: null,
        subcategory: '',
        price_per_1000: 0,
        min_order: 100,
        max_order: 100000,
        active: true,
        provider_service_id: 'manual',
        average_time: '1-6 hours',
        quality: 'high',
        dripfeed: false,
        refill: false,
        cancel: false
      });

      loadServices();
      alert(language === 'pt' ? 'Serviço criado com sucesso!' : language === 'en' ? 'Service created successfully!' : '¡Servicio creado con éxito!');
    } catch (error) {
      console.error('Error creating service:', error);
      alert(language === 'pt' ? 'Erro ao criar serviço' : language === 'en' ? 'Error creating service' : 'Error al crear servicio');
    }
  }

  async function handleBulkPriceUpdate(percentage: number) {
    if (window.confirm(
      language === 'pt'
        ? `Tem certeza que deseja ${percentage > 0 ? 'aumentar' : 'diminuir'} todos os preços em ${Math.abs(percentage)}%?`
        : language === 'en'
        ? `Are you sure you want to ${percentage > 0 ? 'increase' : 'decrease'} all prices by ${Math.abs(percentage)}%?`
        : `¿Está seguro de que desea ${percentage > 0 ? 'aumentar' : 'disminuir'} todos los precios en ${Math.abs(percentage)}%?`
    )) {
      try {
        const updates = filteredServices.map(service => ({
          id: service.id,
          price_per_1000: service.price_per_1000 * (1 + percentage / 100)
        }));

        for (const update of updates) {
          await supabase
            .from('smm_services')
            .update({ price_per_1000: update.price_per_1000 })
            .eq('id', update.id);
        }

        loadServices();
        alert(language === 'pt' ? 'Preços atualizados em massa!' : language === 'en' ? 'Bulk price update completed!' : '¡Actualización masiva de precios completada!');
      } catch (error) {
        console.error('Error with bulk update:', error);
        alert(language === 'pt' ? 'Erro na atualização em massa' : language === 'en' ? 'Error in bulk update' : 'Error en actualización masiva');
      }
    }
  }

  const filteredServices = services.filter(service => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !filterCategory || service.category.toLowerCase() === filterCategory.toLowerCase();

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && service.active) ||
      (filterStatus === 'inactive' && !service.active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: services.length,
    active: services.filter(s => s.active).length,
    inactive: services.filter(s => !s.active).length
  };

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
              {language === 'pt' ? 'Configuração de Serviços SMM' : language === 'en' ? 'SMM Services Configuration' : 'Configuración de Servicios SMM'}
            </h1>
            <p className="text-blue-100">
              {language === 'pt'
                ? 'Gerencie serviços, preços e disponibilidade'
                : language === 'en'
                ? 'Manage services, prices and availability'
                : 'Gestionar servicios, precios y disponibilidad'}
            </p>
          </div>
          <Settings className="h-12 w-12 text-blue-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'pt' ? 'Total de Serviços' : language === 'en' ? 'Total Services' : 'Total Servicios'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <Package className="h-10 w-10 text-blue-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'pt' ? 'Serviços Ativos' : language === 'en' ? 'Active Services' : 'Servicios Activos'}
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'pt' ? 'Serviços Inativos' : language === 'en' ? 'Inactive Services' : 'Servicios Inactivos'}
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.inactive}</p>
            </div>
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={language === 'pt' ? 'Buscar serviços...' : language === 'en' ? 'Search services...' : 'Buscar servicios...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterCategory || ''}
            onChange={(e) => setFilterCategory(e.target.value || null)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{language === 'pt' ? 'Todas Categorias' : language === 'en' ? 'All Categories' : 'Todas Categorías'}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{language === 'pt' ? 'Todos Status' : language === 'en' ? 'All Status' : 'Todos Estados'}</option>
            <option value="active">{language === 'pt' ? 'Ativos' : language === 'en' ? 'Active' : 'Activos'}</option>
            <option value="inactive">{language === 'pt' ? 'Inativos' : language === 'en' ? 'Inactive' : 'Inactivos'}</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBulkPriceUpdate(10)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <TrendingUp className="h-4 w-4 inline mr-2" />
              {language === 'pt' ? '+10% Preços' : language === 'en' ? '+10% Prices' : '+10% Precios'}
            </button>
            <button
              onClick={() => handleBulkPriceUpdate(-10)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
            >
              <TrendingUp className="h-4 w-4 inline mr-2 rotate-180" />
              {language === 'pt' ? '-10% Preços' : language === 'en' ? '-10% Prices' : '-10% Precios'}
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>{language === 'pt' ? 'Criar Serviço' : language === 'en' ? 'Create Service' : 'Crear Servicio'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'pt' ? 'Serviço' : language === 'en' ? 'Service' : 'Servicio'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'pt' ? 'Categoria' : language === 'en' ? 'Category' : 'Categoría'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'pt' ? 'Qualidade' : language === 'en' ? 'Quality' : 'Calidad'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'pt' ? 'Provedor' : language === 'en' ? 'Provider' : 'Proveedor'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'pt' ? 'Preço/1000' : language === 'en' ? 'Price/1000' : 'Precio/1000'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'pt' ? 'Pedido Min/Max' : language === 'en' ? 'Min/Max Order' : 'Pedido Min/Max'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'pt' ? 'Ações' : language === 'en' ? 'Actions' : 'Acciones'}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {service.id.substring(0, 8)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {service.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {service.description}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 inline-block w-fit">
                        {service.category}
                      </span>
                      {service.subcategory && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 inline-block w-fit">
                          {service.subcategory}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      service.quality === 'high' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                      service.quality === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {service.quality === 'high' ? (language === 'pt' ? 'Alta' : language === 'en' ? 'High' : 'Alta') :
                       service.quality === 'medium' ? (language === 'pt' ? 'Média' : language === 'en' ? 'Medium' : 'Media') :
                       (language === 'pt' ? 'Baixa' : language === 'en' ? 'Low' : 'Baja')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {service.provider_name || 'Manual'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        {service.price_per_1000.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {service.min_order.toLocaleString()} - {service.max_order.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(service.id, service.active)}
                      className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                        service.active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-200'
                      }`}
                    >
                      {service.active
                        ? language === 'pt' ? 'Ativo' : language === 'en' ? 'Active' : 'Activo'
                        : language === 'pt' ? 'Inativo' : language === 'en' ? 'Inactive' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleEditService(service)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>{language === 'pt' ? 'Nenhum serviço encontrado' : language === 'en' ? 'No services found' : 'No se encontraron servicios'}</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {language === 'pt' ? 'Criar Novo Serviço' : language === 'en' ? 'Create New Service' : 'Crear Nuevo Servicio'}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Nome' : language === 'en' ? 'Name' : 'Nombre'} *
                </label>
                <input
                  type="text"
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  placeholder={language === 'pt' ? 'Ex: Seguidores Instagram' : language === 'en' ? 'Ex: Instagram Followers' : 'Ej: Seguidores Instagram'}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Descrição' : language === 'en' ? 'Description' : 'Descripción'}
                </label>
                <textarea
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  placeholder={language === 'pt' ? 'Descreva o serviço...' : language === 'en' ? 'Describe the service...' : 'Describa el servicio...'}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Categoria' : language === 'en' ? 'Category' : 'Categoría'} *
                  </label>
                  <select
                    value={newService.category}
                    onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">{language === 'pt' ? 'Selecione...' : language === 'en' ? 'Select...' : 'Seleccione...'}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Subcategoria' : language === 'en' ? 'Subcategory' : 'Subcategoría'}
                  </label>
                  <input
                    type="text"
                    value={newService.subcategory}
                    onChange={(e) => setNewService({ ...newService, subcategory: e.target.value })}
                    placeholder={language === 'pt' ? 'Ex: Seguidores Reais' : language === 'en' ? 'Ex: Real Followers' : 'Ej: Seguidores Reales'}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Preço por 1000' : language === 'en' ? 'Price per 1000' : 'Precio por 1000'} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newService.price_per_1000}
                    onChange={(e) => setNewService({ ...newService, price_per_1000: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Pedido Mínimo' : language === 'en' ? 'Minimum Order' : 'Pedido Mínimo'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newService.min_order}
                    onChange={(e) => setNewService({ ...newService, min_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Pedido Máximo' : language === 'en' ? 'Maximum Order' : 'Pedido Máximo'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newService.max_order}
                    onChange={(e) => setNewService({ ...newService, max_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Tempo Médio' : language === 'en' ? 'Average Time' : 'Tiempo Promedio'}
                  </label>
                  <input
                    type="text"
                    value={newService.average_time}
                    onChange={(e) => setNewService({ ...newService, average_time: e.target.value })}
                    placeholder="1-6 hours"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Qualidade' : language === 'en' ? 'Quality' : 'Calidad'}
                  </label>
                  <select
                    value={newService.quality}
                    onChange={(e) => setNewService({ ...newService, quality: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="low">{language === 'pt' ? 'Baixa' : language === 'en' ? 'Low' : 'Baja'}</option>
                    <option value="medium">{language === 'pt' ? 'Média' : language === 'en' ? 'Medium' : 'Media'}</option>
                    <option value="high">{language === 'pt' ? 'Alta' : language === 'en' ? 'High' : 'Alta'}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newService.active}
                    onChange={(e) => setNewService({ ...newService, active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {language === 'pt' ? 'Ativo' : language === 'en' ? 'Active' : 'Activo'}
                  </span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newService.dripfeed}
                    onChange={(e) => setNewService({ ...newService, dripfeed: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Dripfeed</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newService.refill}
                    onChange={(e) => setNewService({ ...newService, refill: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Refill</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newService.cancel}
                    onChange={(e) => setNewService({ ...newService, cancel: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {language === 'pt' ? 'Cancelável' : language === 'en' ? 'Cancelable' : 'Cancelable'}
                  </span>
                </label>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {language === 'pt' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  onClick={handleCreateService}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{language === 'pt' ? 'Criar Serviço' : language === 'en' ? 'Create Service' : 'Crear Servicio'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {language === 'pt' ? 'Editar Serviço' : language === 'en' ? 'Edit Service' : 'Editar Servicio'}
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Nome' : language === 'en' ? 'Name' : 'Nombre'}
                </label>
                <input
                  type="text"
                  value={editingService.name}
                  onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Descrição' : language === 'en' ? 'Description' : 'Descripción'}
                </label>
                <textarea
                  value={editingService.description}
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Categoria' : language === 'en' ? 'Category' : 'Categoría'}
                  </label>
                  <select
                    value={editingService.category}
                    onChange={(e) => setEditingService({ ...editingService, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Subcategoria' : language === 'en' ? 'Subcategory' : 'Subcategoría'}
                  </label>
                  <input
                    type="text"
                    value={editingService.subcategory || ''}
                    onChange={(e) => setEditingService({ ...editingService, subcategory: e.target.value })}
                    placeholder={language === 'pt' ? 'Ex: Seguidores Reais' : language === 'en' ? 'Ex: Real Followers' : 'Ej: Seguidores Reales'}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Preço por 1000' : language === 'en' ? 'Price per 1000' : 'Precio por 1000'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingService.price_per_1000}
                    onChange={(e) => setEditingService({ ...editingService, price_per_1000: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Pedido Mínimo' : language === 'en' ? 'Minimum Order' : 'Pedido Mínimo'}
                  </label>
                  <input
                    type="number"
                    value={editingService.min_order}
                    onChange={(e) => setEditingService({ ...editingService, min_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Pedido Máximo' : language === 'en' ? 'Maximum Order' : 'Pedido Máximo'}
                  </label>
                  <input
                    type="number"
                    value={editingService.max_order}
                    onChange={(e) => setEditingService({ ...editingService, max_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Tempo Médio' : language === 'en' ? 'Average Time' : 'Tiempo Promedio'}
                  </label>
                  <input
                    type="text"
                    value={editingService.average_time}
                    onChange={(e) => setEditingService({ ...editingService, average_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Qualidade' : language === 'en' ? 'Quality' : 'Calidad'}
                  </label>
                  <select
                    value={editingService.quality}
                    onChange={(e) => setEditingService({ ...editingService, quality: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="low">{language === 'pt' ? 'Baixa' : language === 'en' ? 'Low' : 'Baja'}</option>
                    <option value="medium">{language === 'pt' ? 'Média' : language === 'en' ? 'Medium' : 'Media'}</option>
                    <option value="high">{language === 'pt' ? 'Alta' : language === 'en' ? 'High' : 'Alta'}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingService.active}
                    onChange={(e) => setEditingService({ ...editingService, active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {language === 'pt' ? 'Ativo' : language === 'en' ? 'Active' : 'Activo'}
                  </span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingService.dripfeed}
                    onChange={(e) => setEditingService({ ...editingService, dripfeed: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Dripfeed</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingService.refill}
                    onChange={(e) => setEditingService({ ...editingService, refill: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Refill</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingService.cancel}
                    onChange={(e) => setEditingService({ ...editingService, cancel: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {language === 'pt' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
                  </span>
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {language === 'pt' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  onClick={handleSaveEdit}
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
    </div>
  );
}
