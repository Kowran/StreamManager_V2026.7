import React, { useState, useEffect } from 'react';
import { Mail, Eye, EyeOff, Search, RefreshCw, AlertCircle, CheckCircle, Settings, Play, Shield, X, Save, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface StreamingService {
  id: string;
  name: string;
  logo_url?: string;
  email_domains: string[];
  test_email?: string;
  test_password?: string;
}

interface EmailCheckResult {
  success: boolean;
  latest_email?: {
    subject: string;
    from: string;
    date: string;
    body_preview: string;
    full_body?: string;
  };
  error?: string;
  service_name?: string;
}

export function AdminEmailVerifier() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<StreamingService[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<EmailCheckResult | null>(null);
  const [showServiceConfig, setShowServiceConfig] = useState(false);
  const [editingService, setEditingService] = useState<StreamingService | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    logo_url: '',
    email_domains: [''],
    test_email: '',
    test_password: ''
  });

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadServices();
    }
  }, [isAdmin]);

  async function checkAdminStatus() {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      setIsAdmin(profile?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadServices() {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'streaming_services_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.value) {
        setServices(data.value);
      } else {
        // Initialize with default services
        const defaultServices = [
          {
            id: 'disney',
            name: 'Disney+',
            logo_url: 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=100',
            email_domains: ['disney.com', 'disneyplus.com'],
            test_email: '',
            test_password: ''
          },
          {
            id: 'netflix',
            name: 'Netflix',
            logo_url: 'https://images.pexels.com/photos/4009402/pexels-photo-4009402.jpeg?auto=compress&cs=tinysrgb&w=100',
            email_domains: ['netflix.com'],
            test_email: '',
            test_password: ''
          },
          {
            id: 'prime',
            name: 'Prime Video',
            logo_url: 'https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg?auto=compress&cs=tinysrgb&w=100',
            email_domains: ['amazon.com', 'primevideo.com'],
            test_email: '',
            test_password: ''
          }
        ];
        setServices(defaultServices);
        await saveServicesConfig(defaultServices);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    }
  }

  async function saveServicesConfig(servicesData: StreamingService[]) {
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert({
          key: 'streaming_services_config',
          value: servicesData,
          description: 'Configuração dos serviços de streaming para verificação de email',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving services config:', error);
    }
  }

  async function handleEmailCheck() {
    if (!email || !password || !selectedService) {
      alert('Por favor, preencha todos os campos');
      return;
    }

    setChecking(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-email-inbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          service_id: selectedService
        })
      });

      const checkResult = await response.json();
      
      if (!response.ok) {
        throw new Error(checkResult.error || 'Erro ao verificar email');
      }

      setResult(checkResult);

    } catch (error) {
      console.error('Error checking email:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao verificar email'
      });
    } finally {
      setChecking(false);
    }
  }

  function handleServiceSelect(serviceId: string) {
    setSelectedService(serviceId);
    const service = services.find(s => s.id === serviceId);
    if (service?.test_email && service?.test_password) {
      setEmail(service.test_email);
      setPassword(service.test_password);
    } else {
      setEmail('');
      setPassword('');
    }
    setResult(null);
  }

  function openServiceConfig(service?: StreamingService) {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name,
        logo_url: service.logo_url || '',
        email_domains: service.email_domains.length > 0 ? service.email_domains : [''],
        test_email: service.test_email || '',
        test_password: service.test_password || ''
      });
    } else {
      setEditingService(null);
      setServiceForm({
        name: '',
        logo_url: '',
        email_domains: [''],
        test_email: '',
        test_password: ''
      });
    }
    setShowServiceConfig(true);
  }

  async function handleSaveService() {
    try {
      const serviceData = {
        id: editingService?.id || `service_${Date.now()}`,
        name: serviceForm.name,
        logo_url: serviceForm.logo_url || undefined,
        email_domains: serviceForm.email_domains.filter(domain => domain.trim()),
        test_email: serviceForm.test_email || undefined,
        test_password: serviceForm.test_password || undefined
      };

      let updatedServices;
      if (editingService) {
        updatedServices = services.map(s => s.id === editingService.id ? serviceData : s);
      } else {
        updatedServices = [...services, serviceData];
      }

      await saveServicesConfig(updatedServices);
      setServices(updatedServices);
      setShowServiceConfig(false);
      setEditingService(null);
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Erro ao salvar serviço');
    }
  }

  function addEmailDomain() {
    setServiceForm(prev => ({
      ...prev,
      email_domains: [...prev.email_domains, '']
    }));
  }

  function removeEmailDomain(index: number) {
    setServiceForm(prev => ({
      ...prev,
      email_domains: prev.email_domains.filter((_, i) => i !== index)
    }));
  }

  function updateEmailDomain(index: number, value: string) {
    setServiceForm(prev => ({
      ...prev,
      email_domains: prev.email_domains.map((domain, i) => i === index ? value : domain)
    }));
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Acesso Restrito</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Apenas administradores podem acessar o verificador de emails.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Verificador de Emails de Streaming
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Verifique o último email recebido em contas de streaming
          </p>
        </div>
        <button
          onClick={() => openServiceConfig()}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configurar Serviços
        </button>
      </div>

      {/* Service Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Selecionar Serviço de Streaming
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => handleServiceSelect(service.id)}
              className={`p-4 border-2 rounded-lg text-center transition-all duration-200 ${
                selectedService === service.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-center mb-3">
                {service.logo_url ? (
                  <img
                    src={service.logo_url}
                    alt={service.name}
                    className="h-12 w-12 rounded-lg object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center ${service.logo_url ? 'hidden' : ''}`}>
                  <Play className="h-6 w-6 text-white" />
                </div>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white">{service.name}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {service.email_domains.join(', ')}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openServiceConfig(service);
                }}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Edit className="h-3 w-3 inline mr-1" />
                Configurar
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Email Credentials Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Credenciais da Conta
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email da Conta *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="exemplo@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Senha da Conta *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pr-10 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Senha da conta de email"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleEmailCheck}
            disabled={checking || !email || !password || !selectedService}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {checking ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Verificando emails...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Verificar Último Email</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Resultado da Verificação
            </h3>
            <div className="flex items-center space-x-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span className={`text-sm font-medium ${
                result.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {result.success ? 'Sucesso' : 'Erro'}
              </span>
            </div>
          </div>

          {result.success && result.latest_email ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-3">
                  📧 Último Email de {result.service_name}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                      Remetente:
                    </label>
                    <p className="text-sm text-green-900 dark:text-green-200">
                      {result.latest_email.from}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                      Data:
                    </label>
                    <p className="text-sm text-green-900 dark:text-green-200">
                      {new Date(result.latest_email.date).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                    Assunto:
                  </label>
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">
                    {result.latest_email.subject}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                    Prévia do Conteúdo:
                  </label>
                  <p className="text-sm text-green-800 dark:text-green-300 bg-white dark:bg-gray-800 p-3 rounded border">
                    {result.latest_email.body_preview}
                  </p>
                </div>

                {result.latest_email.full_body && (
                  <div>
                    <label className="block text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                      Conteúdo Completo (HTML):
                    </label>
                    <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 max-h-96 overflow-y-auto">
                      <div 
                        className="text-sm"
                        dangerouslySetInnerHTML={{ __html: result.latest_email.full_body }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-300">
                    Erro na Verificação
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    {result.error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">
          💡 Como Usar
        </h3>
        <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-2 list-decimal list-inside">
          <li>Selecione o serviço de streaming que deseja verificar</li>
          <li>Digite o email e senha da conta que você quer verificar</li>
          <li>Clique em "Verificar Último Email" para buscar</li>
          <li>O sistema mostrará o email mais recente do serviço selecionado</li>
          <li>Use "Configurar Serviços" para adicionar novos serviços ou editar existentes</li>
        </ol>
        
        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
            ⚠️ Importante
          </h4>
          <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
            <li>• Use apenas contas de teste ou suas próprias contas</li>
            <li>• As credenciais são armazenadas temporariamente para teste</li>
            <li>• O sistema busca emails dos domínios configurados para cada serviço</li>
            <li>• Funciona com Gmail, Outlook e outros provedores IMAP</li>
          </ul>
        </div>
      </div>

      {/* Service Configuration Modal */}
      {showServiceConfig && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingService ? 'Editar Serviço' : 'Novo Serviço'}
              </h3>
              <button
                onClick={() => setShowServiceConfig(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome do Serviço *
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Ex: Disney+, Netflix..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL do Logo
                  </label>
                  <input
                    type="url"
                    value={serviceForm.logo_url}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, logo_url: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Domínios de Email *
                  </label>
                  <button
                    type="button"
                    onClick={addEmailDomain}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    + Adicionar Domínio
                  </button>
                </div>
                
                <div className="space-y-2">
                  {serviceForm.email_domains.map((domain, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={domain}
                        onChange={(e) => updateEmailDomain(index, e.target.value)}
                        className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="disney.com"
                      />
                      {serviceForm.email_domains.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmailDomain(index)}
                          className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Domínios de email que o sistema deve procurar (ex: disney.com, netflix.com)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email de Teste
                  </label>
                  <input
                    type="email"
                    value={serviceForm.test_email}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, test_email: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="conta.teste@gmail.com"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Email padrão para testes (opcional)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Senha de Teste
                  </label>
                  <input
                    type="password"
                    value={serviceForm.test_password}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, test_password: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="senha123"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Senha padrão para testes (opcional)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setShowServiceConfig(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveService}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar Serviço</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}