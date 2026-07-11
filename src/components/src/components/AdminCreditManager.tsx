import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Minus, Search, User, TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle, X, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface UserCredit {
  id: string;
  user_id: string;
  balance: number;
  total_recharged: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
}

interface CreditTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export function AdminCreditManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [userCredits, setUserCredits] = useState<UserCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserCredit | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<CreditTransaction[]>([]);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUserCredits();
      loadRecentTransactions();
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

  async function loadUserCredits() {
    try {
      // Get all profiles first
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('email');

      if (profilesError) throw profilesError;

      if (!profilesData || profilesData.length === 0) {
        setUserCredits([]);
        return;
      }

      // Get user credits for all users
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .in('user_id', profilesData.map(p => p.id));

      if (creditsError) throw creditsError;

      // Create user credits with profiles, including users with zero balance
      const creditsWithProfiles = profilesData.map(profile => {
        const userCredit = creditsData?.find(credit => credit.user_id === profile.id);
        return {
          id: userCredit?.id || `temp-${profile.id}`,
          user_id: profile.id,
          balance: userCredit?.balance || 0,
          total_recharged: userCredit?.total_recharged || 0,
          total_spent: userCredit?.total_spent || 0,
          created_at: userCredit?.created_at || profile.created_at || new Date().toISOString(),
          updated_at: userCredit?.updated_at || profile.updated_at || new Date().toISOString(),
          profiles: {
            email: profile.email,
            full_name: profile.full_name
          }
        };
      }).sort((a, b) => b.balance - a.balance); // Sort by balance descending

      setUserCredits(creditsWithProfiles);
    } catch (error) {
      console.error('Error loading user credits:', error);
    }
  }

  async function loadRecentTransactions() {
    try {
      // Get admin adjustment transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('type', 'admin_adjustment')
        .order('created_at', { ascending: false })
        .limit(20);

      if (transactionsError) throw transactionsError;

      if (!transactionsData || transactionsData.length === 0) {
        setRecentTransactions([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(transactionsData.map(transaction => transaction.user_id).filter(Boolean))];

      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Add profiles to transactions
      const transactionsWithProfiles = transactionsData.map(transaction => ({
        ...transaction,
        profiles: profilesData?.find(profile => profile.id === transaction.user_id) || {
          email: 'Usuário não encontrado', full_name: null
        }
      }));

      setRecentTransactions(transactionsWithProfiles);
    } catch (error) {
      console.error('Error loading recent transactions:', error);
    }
  }

  async function handleCreditAdjustment() {
    if (!selectedUser || !user || adjustmentAmount <= 0) return;

    if (!adjustmentReason.trim()) {
      alert('Motivo do ajuste é obrigatório');
      return;
    }

    const finalAmount = adjustmentType === 'remove' ? -adjustmentAmount : adjustmentAmount;
    const newBalance = selectedUser.balance + finalAmount;

    if (newBalance < 0) {
      alert('O saldo não pode ficar negativo. Valor máximo para remoção: $' + selectedUser.balance.toFixed(2));
      return;
    }

    const confirmMessage = `${adjustmentType === 'add' ? 'Adicionar' : 'Remover'} $${adjustmentAmount.toFixed(2)} ${adjustmentType === 'add' ? 'para' : 'de'} ${selectedUser.profiles?.email}?\n\nSaldo atual: $${selectedUser.balance.toFixed(2)}\nNovo saldo: $${newBalance.toFixed(2)}\nMotivo: ${adjustmentReason}\n\nEsta ação será registrada no histórico.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setProcessing(true);

    try {
      // Create credit transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: selectedUser.user_id,
          type: 'admin_adjustment',
          amount: finalAmount,
          balance_before: selectedUser.balance,
          balance_after: newBalance,
          description: `Ajuste administrativo: ${adjustmentReason}`,
          reference_type: 'admin_action',
          metadata: {
            admin_id: user.id,
            admin_email: user.email,
            adjustment_type: adjustmentType,
            reason: adjustmentReason,
            performed_at: new Date().toISOString()
          }
        });

      if (transactionError) throw transactionError;

      // Log admin action
      const { error: logError } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: user.id,
          action: 'credit_adjustment',
          target_user_id: selectedUser.user_id,
          details: {
            adjustment_type: adjustmentType,
            amount: adjustmentAmount,
            balance_before: selectedUser.balance,
            balance_after: newBalance,
            reason: adjustmentReason,
            user_email: selectedUser.profiles?.email
          }
        });

      if (logError) {
        console.error('Error logging admin action:', logError);
      }

      // Create notification for user
      await supabase.rpc('create_notification', {
        p_user_id: selectedUser.user_id,
        p_type: 'admin',
        p_title: adjustmentType === 'add' ? '💰 Créditos Adicionados!' : '💸 Créditos Removidos',
        p_message: `${adjustmentType === 'add' ? 'Foram adicionados' : 'Foram removidos'} $${adjustmentAmount.toFixed(2)} ${adjustmentType === 'add' ? 'à' : 'da'} sua conta. Motivo: ${adjustmentReason}`,
        p_data: {
          adjustment_type: adjustmentType,
          amount: adjustmentAmount,
          balance_before: selectedUser.balance,
          balance_after: newBalance,
          admin_action: true
        },
        p_priority: 'high'
      });

      // Reload data
      await loadUserCredits();
      await loadRecentTransactions();
      
      // Force reload user credit data to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for DB consistency
      await loadUserCredits();

      // Close modal and reset form
      setShowAdjustModal(false);
      setSelectedUser(null);
      setAdjustmentAmount(0);
      setAdjustmentReason('');

      alert(`✅ Ajuste realizado com sucesso!\n\n${adjustmentType === 'add' ? 'Adicionados' : 'Removidos'} $${adjustmentAmount.toFixed(2)} ${adjustmentType === 'add' ? 'para' : 'de'} ${selectedUser.profiles?.email}\n\nO usuário foi notificado sobre o ajuste.`);

    } catch (error) {
      console.error('Error adjusting credits:', error);
      alert('Erro ao ajustar créditos. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  }

  const filteredUsers = userCredits.filter(userCredit =>
    userCredit.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    userCredit.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalUsers: userCredits.length,
    totalBalance: userCredits.reduce((sum, u) => sum + u.balance, 0),
    totalRecharged: userCredits.reduce((sum, u) => sum + u.total_recharged, 0),
    totalSpent: userCredits.reduce((sum, u) => sum + u.total_spent, 0),
    usersWithBalance: userCredits.filter(u => u.balance > 0).length
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Acesso Restrito</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Apenas administradores podem gerenciar créditos dos usuários.
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciar Créditos dos Usuários</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Adicione ou remova créditos das contas dos usuários
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Total Usuários</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</p>
            </div>
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Saldo Total</p>
              <p className="text-lg sm:text-xl font-bold text-green-600">${stats.totalBalance.toFixed(2)}</p>
            </div>
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Total Recarregado</p>
              <p className="text-lg sm:text-xl font-bold text-blue-600">${stats.totalRecharged.toFixed(2)}</p>
            </div>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Total Gasto</p>
              <p className="text-lg sm:text-xl font-bold text-purple-600">${stats.totalSpent.toFixed(2)}</p>
            </div>
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">Com Saldo</p>
              <p className="text-lg sm:text-xl font-bold text-orange-600">{stats.usersWithBalance}</p>
            </div>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Buscar usuários por email ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 sm:py-2 w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 touch-manipulation"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Saldo Atual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Recarregado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Gasto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Última Atualização
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((userCredit) => (
                <tr key={userCredit.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {userCredit.profiles?.full_name || 'Usuário'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {userCredit.profiles?.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      ${userCredit.balance.toFixed(2)}
                    </div>
                    <div className={`text-xs ${
                      userCredit.balance > 50 ? 'text-green-600' :
                      userCredit.balance > 10 ? 'text-yellow-600' :
                      userCredit.balance > 0 ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {userCredit.balance > 50 ? 'Alto' :
                       userCredit.balance > 10 ? 'Médio' :
                       userCredit.balance > 0 ? 'Baixo' :
                       'Zerado'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ${userCredit.total_recharged.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ${userCredit.total_spent.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(userCredit.updated_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(userCredit);
                          setAdjustmentType('add');
                          setShowAdjustModal(true);
                        }}
                        className="p-2 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Adicionar créditos"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(userCredit);
                          setAdjustmentType('remove');
                          setShowAdjustModal(true);
                        }}
                        className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remover créditos"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {filteredUsers.map((userCredit) => (
            <div key={userCredit.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {userCredit.profiles?.full_name || 'Usuário'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {userCredit.profiles?.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    ${userCredit.balance.toFixed(2)}
                  </div>
                  <div className={`text-xs ${
                    userCredit.balance > 50 ? 'text-green-600' :
                    userCredit.balance > 10 ? 'text-yellow-600' :
                    userCredit.balance > 0 ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {userCredit.balance > 50 ? 'Alto' :
                     userCredit.balance > 10 ? 'Médio' :
                     userCredit.balance > 0 ? 'Baixo' :
                     'Zerado'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Recarregado</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    ${userCredit.total_recharged.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Gasto</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    ${userCredit.total_spent.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Atualizado: {new Date(userCredit.updated_at).toLocaleDateString('pt-BR')}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedUser(userCredit);
                      setAdjustmentType('add');
                      setShowAdjustModal(true);
                    }}
                    className="p-2 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors touch-manipulation"
                    title="Adicionar créditos"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(userCredit);
                      setAdjustmentType('remove');
                      setShowAdjustModal(true);
                    }}
                    className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors touch-manipulation"
                    title="Remover créditos"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário com créditos'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm 
                ? 'Tente ajustar os termos de busca'
                : 'Usuários aparecerão aqui quando tiverem créditos'
              }
            </p>
          </div>
        )}
      </div>

      {/* Recent Admin Adjustments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Ajustes Recentes</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
          {recentTransactions.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum ajuste realizado ainda</p>
            </div>
          ) : (
            recentTransactions.map((transaction) => (
              <div key={transaction.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      transaction.amount > 0 
                        ? 'bg-green-100 dark:bg-green-900/20' 
                        : 'bg-red-100 dark:bg-red-900/20'
                    }`}>
                      {transaction.amount > 0 ? (
                        <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {transaction.profiles?.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(transaction.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${
                      transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}${transaction.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Saldo: ${transaction.balance_after.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Credit Adjustment Modal */}
      {showAdjustModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {adjustmentType === 'add' ? 'Adicionar Créditos' : 'Remover Créditos'}
              </h3>
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  setSelectedUser(null);
                  setAdjustmentAmount(0);
                  setAdjustmentReason('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* User Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedUser.profiles?.full_name || 'Usuário'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedUser.profiles?.email}
                    </p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      Saldo atual: ${selectedUser.balance.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Adjustment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Ajuste
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAdjustmentType('add')}
                    className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                      adjustmentType === 'add'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Plus className="h-5 w-5 mx-auto mb-1" />
                    Adicionar
                  </button>
                  <button
                    onClick={() => setAdjustmentType('remove')}
                    className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                      adjustmentType === 'remove'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Minus className="h-5 w-5 mx-auto mb-1" />
                    Remover
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor (USD) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    max={adjustmentType === 'remove' ? selectedUser.balance : 10000}
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
                    className="block w-full pl-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="0.01"
                  />
                </div>
                {adjustmentType === 'remove' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Máximo disponível para remoção: ${selectedUser.balance.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Motivo do Ajuste *
                </label>
                <textarea
                  rows={3}
                  required
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Explique o motivo do ajuste de créditos..."
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Este motivo será registrado no histórico e enviado ao usuário
                </p>
              </div>

              {/* Preview */}
              <div className={`rounded-lg p-3 border ${
                adjustmentType === 'add' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <h4 className={`text-sm font-medium mb-2 ${
                  adjustmentType === 'add' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                }`}>
                  Resumo do Ajuste
                </h4>
                <div className={`text-xs space-y-1 ${
                  adjustmentType === 'add' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                }`}>
                  <div className="flex justify-between">
                    <span>Saldo atual:</span>
                    <span>${selectedUser.balance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{adjustmentType === 'add' ? 'Adicionar:' : 'Remover:'}</span>
                    <span>{adjustmentType === 'add' ? '+' : '-'}${adjustmentAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Novo saldo:</span>
                    <span>${(selectedUser.balance + (adjustmentType === 'add' ? adjustmentAmount : -adjustmentAmount)).toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t">
                  💡 Nota: Ajustes administrativos não incluem taxas de processamento
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  setSelectedUser(null);
                  setAdjustmentAmount(0);
                  setAdjustmentReason('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreditAdjustment}
                disabled={processing || adjustmentAmount <= 0 || !adjustmentReason.trim()}
                className={`px-4 py-2 font-medium rounded-lg transition-colors flex items-center ${
                  adjustmentType === 'add'
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white'
                    : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white'
                }`}
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    {adjustmentType === 'add' ? (
                      <Plus className="h-4 w-4 mr-2" />
                    ) : (
                      <Minus className="h-4 w-4 mr-2" />
                    )}
                    {adjustmentType === 'add' ? 'Adicionar' : 'Remover'} Créditos
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