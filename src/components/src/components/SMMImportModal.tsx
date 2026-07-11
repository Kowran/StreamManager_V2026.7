import React, { useState, useEffect } from 'react';
import { X, Download, Search, CheckCircle, Package, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface ProviderService {
  service: string;
  name: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  average_time?: string;
  dripfeed?: string | boolean;
  refill?: string | boolean;
  cancel?: string | boolean;
}

interface SMMImportModalProps {
  providerId: string;
  providerName: string;
  rateMultiplier: number;
  onClose: () => void;
  onImportComplete: () => void;
}

export function SMMImportModal({ providerId, providerName, rateMultiplier, onClose, onImportComplete }: SMMImportModalProps) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-smm-services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider_id: providerId,
          fetch_only: true
        })
      });

      const result = await response.json();

      if (result.success && result.services) {
        setServices(result.services);
      } else {
        throw new Error(result.error || 'Failed to fetch services');
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      alert(
        language === 'pt'
          ? 'Erro ao buscar serviços do provedor'
          : language === 'en'
          ? 'Error fetching services from provider'
          : 'Error al obtener servicios del proveedor'
      );
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (selectedServices.size === 0) {
      alert(
        language === 'pt'
          ? 'Selecione pelo menos um serviço para importar'
          : language === 'en'
          ? 'Select at least one service to import'
          : 'Seleccione al menos un servicio para importar'
      );
      return;
    }

    setImporting(true);

    try {
      const servicesToImport = services.filter(s => selectedServices.has(s.service));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-smm-services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider_id: providerId,
          services: servicesToImport
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(
          language === 'pt'
            ? `${result.imported} serviços importados com sucesso!`
            : language === 'en'
            ? `${result.imported} services imported successfully!`
            : `¡${result.imported} servicios importados con éxito!`
        );
        onImportComplete();
        onClose();
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (error) {
      console.error('Error importing services:', error);
      alert(
        language === 'pt'
          ? 'Erro ao importar serviços'
          : language === 'en'
          ? 'Error importing services'
          : 'Error al importar servicios'
      );
    } finally {
      setImporting(false);
    }
  }

  function toggleService(serviceId: string) {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  }

  function toggleSelectAll() {
    if (selectedServices.size === filteredServices.length) {
      setSelectedServices(new Set());
    } else {
      setSelectedServices(new Set(filteredServices.map(s => s.service)));
    }
  }

  const filteredServices = services.filter(service => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !categoryFilter || service.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(services.map(s => s.category))).sort();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {language === 'pt' ? 'Importar Serviços' : language === 'en' ? 'Import Services' : 'Importar Servicios'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {providerName} - {services.length} {language === 'pt' ? 'serviços disponíveis' : language === 'en' ? 'services available' : 'servicios disponibles'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="md:col-span-2 relative">
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
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{language === 'pt' ? 'Todas Categorias' : language === 'en' ? 'All Categories' : 'Todas Categorías'}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedServices.size === filteredServices.length && filteredServices.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {language === 'pt' ? 'Selecionar todos' : language === 'en' ? 'Select all' : 'Seleccionar todos'}
                  </span>
                </label>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedServices.size} {language === 'pt' ? 'selecionados' : language === 'en' ? 'selected' : 'seleccionados'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-3">
                {filteredServices.map((service) => {
                  const finalPrice = parseFloat(service.rate) * rateMultiplier;
                  const isSelected = selectedServices.has(service.service);

                  return (
                    <div
                      key={service.service}
                      onClick={() => toggleService(service.service)}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                {service.name}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                  {service.category}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  ID: {service.service}
                                </span>
                                {service.average_time && (
                                  <span className="text-xs text-gray-600 dark:text-gray-400">
                                    {service.average_time}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end ml-4">
                              <div className="flex items-center space-x-1 text-green-600 dark:text-green-400 font-bold">
                                <DollarSign className="h-4 w-4" />
                                <span>{finalPrice.toFixed(2)}</span>
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {language === 'pt' ? 'por 1000' : language === 'en' ? 'per 1000' : 'por 1000'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                            <span>
                              {language === 'pt' ? 'Mín' : language === 'en' ? 'Min' : 'Mín'}: {parseInt(service.min).toLocaleString()}
                            </span>
                            <span>
                              {language === 'pt' ? 'Máx' : language === 'en' ? 'Max' : 'Máx'}: {parseInt(service.max).toLocaleString()}
                            </span>
                            {(service.dripfeed === '1' || service.dripfeed === true) && (
                              <span className="text-blue-600 dark:text-blue-400">Dripfeed</span>
                            )}
                            {(service.refill === '1' || service.refill === true) && (
                              <span className="text-green-600 dark:text-green-400">Refill</span>
                            )}
                            {(service.cancel === '1' || service.cancel === true) && (
                              <span className="text-orange-600 dark:text-orange-400">
                                {language === 'pt' ? 'Cancelável' : language === 'en' ? 'Cancelable' : 'Cancelable'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredServices.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>{language === 'pt' ? 'Nenhum serviço encontrado' : language === 'en' ? 'No services found' : 'No se encontraron servicios'}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  disabled={importing}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {language === 'pt' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedServices.size === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{language === 'pt' ? 'Importando...' : language === 'en' ? 'Importing...' : 'Importando...'}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>
                        {language === 'pt' ? 'Importar' : language === 'en' ? 'Import' : 'Importar'} ({selectedServices.size})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
