import React, { useState, useEffect } from 'react';
import { Users, Shield, Calendar, Trash2, Eye, AlertTriangle, CheckCircle, Clock, Package, DollarSign, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';

interface AccountsAccess {
  id: string;
  user_id: string;
  order_id?: string;
  access_type: string;
  purchased_at: string;
  expires_at: string;
  duration_days: number;
  price_paid: number;
  active: boolean;
  auto_renew: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
  store_orders?: {
    total_usdt: number;
    customer_email?: string;
    customer_name?: string;
  };
}

export function AccountsAccessManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [accessRecords, setAccessRecords] = useState<AccountsAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAccess, setSelectedAccess] = useState<AccountsAccess | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadAccessRecords();
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

  async function loadAccessRecords() {
    try {
      const { data, error } = await supabase
        .from('accounts_access_purchases')
        .select(`
          *,
          profiles!accounts_access_purchases_user_id_profiles_fkey (
            email,
            full_name
          ),
          store_orders!accounts_access_purchases_order_id_fkey (
            id,
            total_usdt,
            status,
            customer_email,
            customer_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccessRecords(data || []);
    } catch (error) {
      console.error('Error loading access records:', error);
    }
  }

  async function handleRevokeAccess(accessRecord: AccountsAccess) {
    const confirmMessage = `Tem certeza que deseja revogar o acesso de ${accessRecord.profiles?.email}?\n\nEsta ação irá:\n- Desativar o acesso imediatamente\n- Forçar o usuário a comprar novamente\n- Não pode ser desfeita`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setRevoking(accessRecord.id);

    try {
      // Deactivate the access
      const { error: updateError } = await supabase
        .from('accounts_access_purchases')
        .update({
          active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', accessRecord.id);

      if (updateError) throw updateError;

      // Log admin action
      const { error: logError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action: 'revoke_accounts_access',
          target_user_id: accessRecord.user_id,
          details: {
            access_id: accessRecord.id,
            user_email: accessRecord.profiles?.email,
            reason: 'Admin revoked access',
            revoked_at: new Date().toISOString()
          }
        });

      if (logError) {
        console.error('Error logging admin action:', logError);
      }

      // Reload data
      await loadAccessRecords();
      
      alert('✅ Acesso revogado com sucesso! O usuário precisará comprar novamente para acessar o gerenciador de contas.');
    } catch (error) {
      console.error('Error revoking access:', error);
      alert('Erro ao revogar acesso. Tente novamente.');
    } finally {
      setRevoking(null);
    }
  }

  async function handleReactivateAccess(accessRecord: AccountsAccess) {
    if (!confirm(`Reativar acesso para ${accessRecord.profiles?.email}?`)) {
      return;
    }

    try {
      // Extend expiry by 30 days from now
      const { error: updateError } = await supabase.rpc('extend_accounts_access', {
        p_access_id: accessRecord.id,
        p_additional_days: 30
      });

      if (updateError) throw updateError;

      // Also reactivate if it was deactivated
      await supabase
        .from('accounts_access_purchases')
        .update({
          active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', accessRecord.id);

      // Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action: 'reactivate_accounts_access',
          target_user_id: accessRecord.user_id,
          details: {
            access_id: accessRecord.id,
            user_email: accessRecord.profiles?.email,
            extended_days: 30,
            reason: 'Admin reactivated access'
          }
        });

      await loadAccessRecords();
      alert('✅ Acesso reativado com sucesso! Válido por mais 30 dias.');
    } catch (error) {
      console.error('Error reactivating access:', error);
      alert('Erro ao reativar acesso. Tente novamente.');
    }
  }

  function getAccessStatus(accessRecord: AccountsAccess) {
    if (!accessRecord.active) {
      return { status: 'revoked', label: 'Revogado', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' };
    }

    const now = new Date();
    const expiryDate = new Date(accessRecord.expires_at);
    
    if (expiryDate < now) {
      return { status: 'expired', label: 'Expirado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    }

    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 3) {
      return { status: 'expiring', label: `Expira em ${daysUntilExpiry}d`, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' };
    }

    return { status: 'active', label: 'Ativo', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' };
  }

  const filteredAccesses = accessRecords.filter(access => {
    const matchesSearch = 
      access.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      access.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const accessStatus = getAccessStatus(access);
    const matchesStatus = statusFilter === 'all' || accessStatus.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: accessRecords.length,
    active: accessRecords.filter(a => getAccessStatus(a).status === 'active').length,
    expiring: accessRecords.filter(a => getAccessStatus(a).status === 'expiring').length,
    expired: accessRecords.filter(a => getAccessStatus(a).status === 'expired').length,
    revoked: accessRecords.filter(a => getAccessStatus(a).status === 'revoked').length,
    totalRevenue: accessRecords.reduce((sum, a) => sum + a.price_paid, 0)
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Acesso Restrito</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Apenas administradores podem gerenciar acessos ao gerenciador de contas.
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Gerenciar Acessos ao Gerenciador de Contas
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Visualize e gerencie usuários que compraram acesso ao gerenciador de contas
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-xs font-medium text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-xs font-medium text-gray-600 dark:text-gray-400">Ativos</p>
              <p className="text-lg sm:text-xl font-bold text-green-600">{stats.active}</p>
            </div>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-xs font-medium text-gray-600 dark:text-gray-400">Expirando</p>
              <p className="text-lg sm:text-xl font-bold text-yellow-600">{stats.expiring}</p>
            </div>
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-xs font-medium text-gray-600 dark:text-gray-400">Expirados</p>
              <p className="text-lg sm:text-xl font-bold text-gray-600">{stats.expired}</p>
            </div>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-xs font-medium text-gray-600 dark:text-gray-400">Revogados</p>
              <p className="text-lg sm:text-xl font-bold text-red-600">{stats.revoked}</p>
            </div>
            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-xs font-medium text-gray-600 dark:text-gray-400">Receita</p>
              <p className="text-lg sm:text-xl font-bold text-purple-600">{formatPrice(stats.totalRevenue)}</p>
            </div>
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por email ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm touch-manipulation"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm touch-manipulation"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="expiring">Expirando em Breve</option>
            <option value="expired">Expirados</option>
            <option value="revoked">Revogados</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data de Compra
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data de Expiração
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Valor Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAccesses.map((access) => {
                const accessStatus = getAccessStatus(access);
                const daysRemaining = Math.ceil((new Date(access.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                
                return (
                  <tr key={access.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <Users className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {access.profiles?.full_name || 'Usuário'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {access.profiles?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${accessStatus.color}`}>
                        {accessStatus.label}
                      </span>
                      {accessStatus.status === 'active' && daysRemaining > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {daysRemaining} dias restantes
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                        {new Date(access.purchased_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(access.purchased_at).toLocaleTimeString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-gray-400" />
                        {new Date(access.expires_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(access.expires_at).toLocaleTimeString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatPrice(access.store_orders?.total_usdt || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedAccess(access);
                            setShowDetails(true);
                          }}
                          className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        {accessStatus.status === 'active' || accessStatus.status === 'expiring' ? (
                          <button
                            onClick={() => handleRevokeAccess(access)}
                            disabled={revoking === access.id}
                            className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Revogar acesso"
                          >
                            {revoking === access.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateAccess(access)}
                            className="p-2 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Reativar acesso"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredAccesses.map((access) => {
          const accessStatus = getAccessStatus(access);
          const daysRemaining = Math.ceil((new Date(access.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          return (
            <div key={access.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 touch-manipulation">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {access.profiles?.full_name || 'Usuário'}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {access.profiles?.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${accessStatus.color}`}>
                    {accessStatus.label}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Comprado em</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(access.purchased_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Expira em</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(access.expires_at).toLocaleDateString('pt-BR')}
                  </p>
                  {accessStatus.status === 'active' && daysRemaining > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {daysRemaining} dias restantes
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Valor Pago</p>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">
                    ${access.store_orders?.total_usdt?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Duração</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {access.duration_days} dias
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => {
                    setSelectedAccess(access);
                    setShowDetails(true);
                  }}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm touch-manipulation"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  <span>Ver Detalhes</span>
                </button>
                
                <div className="flex items-center space-x-2">
                  {accessStatus.status === 'active' || accessStatus.status === 'expiring' ? (
                    <button
                      onClick={() => handleRevokeAccess(access)}
                      disabled={revoking === access.id}
                      className="inline-flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors shadow-sm touch-manipulation"
                    >
                      {revoking === access.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          <span>Revogar</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivateAccess(access)}
                      className="inline-flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm touch-manipulation"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      <span>Reativar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAccesses.length === 0 && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {searchTerm || statusFilter !== 'all' ? 'Nenhum acesso encontrado' : 'Nenhum acesso vendido'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm || statusFilter !== 'all' 
              ? 'Tente ajustar os filtros de busca'
              : 'Ainda não há usuários que compraram acesso ao gerenciador de contas'
            }
          </p>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedAccess && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4 sm:p-0">
          <div className="relative top-4 sm:top-10 mx-auto p-4 sm:p-5 border w-full max-w-2xl shadow-lg rounded-lg sm:rounded-md bg-white dark:bg-gray-800 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Detalhes do Acesso
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 touch-manipulation"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* User Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4">
                <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Informações do Usuário
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nome Completo
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedAccess.profiles?.full_name || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedAccess.profiles?.email}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      ID do Usuário
                    </label>
                    <p className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
                      {selectedAccess.user_id}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status Atual
                    </label>
                    <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAccessStatus(selectedAccess).color}`}>
                      {getAccessStatus(selectedAccess).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Access Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                <h4 className="text-base sm:text-lg font-medium text-blue-800 dark:text-blue-300 mb-3">
                  Informações do Acesso
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400">
                      Data de Compra
                    </label>
                    <p className="mt-1 text-sm text-blue-900 dark:text-blue-200 break-words">
                      {new Date(selectedAccess.purchased_at).toLocaleDateString('pt-BR')} às {new Date(selectedAccess.purchased_at).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400">
                      Data de Expiração
                    </label>
                    <p className="mt-1 text-sm text-blue-900 dark:text-blue-200 break-words">
                      {new Date(selectedAccess.expires_at).toLocaleDateString('pt-BR')} às {new Date(selectedAccess.expires_at).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400">
                      Valor Pago
                    </label>
                    <p className="mt-1 text-sm font-bold text-blue-900 dark:text-blue-200">
                      ${selectedAccess.price_paid?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400">
                      Duração
                    </label>
                    <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">
                      {selectedAccess.duration_days} dias
                    </p>
                  </div>
                </div>
              </div>

              {/* Time Remaining */}
              {selectedAccess.active && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
                  <h4 className="text-base sm:text-lg font-medium text-green-800 dark:text-green-300 mb-2">
                    Tempo Restante
                  </h4>
                  <div className="text-sm text-green-700 dark:text-green-400">
                    {(() => {
                      const now = new Date();
                      const expires = new Date(selectedAccess.expires_at);
                      const diffTime = expires.getTime() - now.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (diffDays <= 0) {
                        return 'Acesso expirado';
                      } else if (diffDays === 1) {
                        return '1 dia restante';
                      } else {
                        return `${diffDays} dias restantes`;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setShowDetails(false)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors touch-manipulation"
                >
                  Fechar
                </button>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  {(() => {
                    const status = getAccessStatus(selectedAccess);
                    return status.status === 'active' || status.status === 'expiring' ? (
                      <button
                        onClick={() => {
                          setShowDetails(false);
                          handleRevokeAccess(selectedAccess);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm text-sm font-medium transition-colors touch-manipulation"
                      >
                        Revogar Acesso
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowDetails(false);
                          handleReactivateAccess(selectedAccess);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm text-sm font-medium transition-colors touch-manipulation"
                      >
                        Reativar Acesso
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}