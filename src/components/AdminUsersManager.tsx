import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { AdminAPI } from '../lib/adminApi';
import { Users, Search, Shield, Ban, CheckCircle, XCircle, Calendar, Mail, User, DollarSign, ShoppingBag, X, TrendingUp, CreditCard, Crown, UserCog, AlertTriangle, Settings2 } from 'lucide-react';
import { AdminPermissionsModal } from './AdminPermissionsModal';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  language: string;
  created_at: string;
  updated_at: string;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  avatar_url: string | null;
  banned: boolean;
  banned_at: string | null;
  banned_by: string | null;
  last_login_at: string | null;
  login_count: number;
}

interface UserDetails {
  profile: Profile;
  credits: {
    balance: number;
    total_recharged: number;
    total_spent: number;
  } | null;
  recentPurchases: Array<{
    id: string;
    product_name: string;
    purchase_price: number;
    created_at: string;
    expired: boolean;
  }>;
  recentRecharges: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    created_at: string;
  }>;
  totalPurchases: number;
  activePurchases: number;
}

export default function AdminUsersManager() {
  const { t, language } = useLanguage();
  const { formatPrice } = useCurrency();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [roleChangeModal, setRoleChangeModal] = useState<{
    show: boolean;
    userId: string;
    userName: string;
    newRole: 'admin' | 'customer';
  } | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [permissionsModal, setPermissionsModal] = useState<{
    userId: string;
    userName: string;
  } | null>(null);

  useEffect(() => {
    fetchProfiles();
    getCurrentAdminId();
  }, []);

  const getCurrentAdminId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentAdminId(user.id);
    }
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: string, action: 'approve' | 'ban' | 'unban') => {
    try {
      let updateData: any = {};

      switch (action) {
        case 'ban':
          updateData = {
            banned: true,
            banned_at: new Date().toISOString(),
            banned_by: (await supabase.auth.getUser()).data.user?.id
          };
          break;
        case 'unban':
          updateData = {
            banned: false,
            banned_at: null,
            banned_by: null
          };
          break;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      await fetchProfiles();
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeModal) return;

    // Prevent changing own role
    if (roleChangeModal.userId === currentAdminId) {
      alert(t.cannotChangeOwnRole);
      setRoleChangeModal(null);
      return;
    }

    setUpdatingRole(true);
    try {
      await AdminAPI.updateUserRole(roleChangeModal.userId, roleChangeModal.newRole);
      await fetchProfiles();
      const wasPromotedToAdmin = roleChangeModal.newRole === 'admin';
      const promotedUser = { userId: roleChangeModal.userId, userName: roleChangeModal.userName };
      setRoleChangeModal(null);
      if (wasPromotedToAdmin) {
        setPermissionsModal(promotedUser);
      }
    } catch (error: any) {
      console.error('Error updating role:', error);
      alert(error.message || 'Error updating role');
    } finally {
      setUpdatingRole(false);
    }
  };

  const openRoleChangeModal = (userId: string, userName: string, newRole: 'admin' | 'customer') => {
    // Prevent changing own role
    if (userId === currentAdminId) {
      alert(t.cannotChangeOwnRole);
      return;
    }
    setRoleChangeModal({
      show: true,
      userId,
      userName,
      newRole
    });
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = 
      profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesRole = filterRole === 'all' || profile.role === filterRole;
    
    const matchesStatus = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && !profile.banned) ||
      (filterStatus === 'banned' && profile.banned);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t.never;
    return new Date(dateString).toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES');
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return t.never;
    return new Date(dateString).toLocaleString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES');
  };

  const loadUserDetails = async (userId: string) => {
    setLoadingUserDetails(true);
    try {
      const profile = profiles.find(p => p.id === userId);
      if (!profile) return;

      const [creditsResult, purchasesResult, rechargesResult] = await Promise.all([
        supabase
          .from('user_credits')
          .select('balance, total_recharged, total_spent')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_purchases')
          .select('id, product_name, purchase_price, created_at, expired')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('credit_transactions')
          .select('id, amount, type, description, created_at')
          .eq('user_id', userId)
          .eq('type', 'recharge')
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      const totalPurchases = purchasesResult.data?.length || 0;
      const activePurchases = purchasesResult.data?.filter(p => !p.expired).length || 0;

      setSelectedUser({
        profile,
        credits: creditsResult.data,
        recentPurchases: purchasesResult.data || [],
        recentRecharges: rechargesResult.data || [],
        totalPurchases,
        activePurchases
      });
    } catch (error) {
      console.error('Error loading user details:', error);
    } finally {
      setLoadingUserDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.userManagement}</h2>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-4 transition-colors">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={t.searchByEmailOrName}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 touch-manipulation"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2.5 sm:px-4 sm:py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white touch-manipulation"
          >
            <option value="all">{t.allRoles}</option>
            <option value="admin">{t.admin}</option>
            <option value="customer">{t.customer}</option>
          </select>
            <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 sm:px-4 sm:py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white touch-manipulation"
          >
            <option value="all">{t.allStatus}</option>
            <option value="active">{t.active}</option>
            <option value="banned">{t.banned}</option>
          </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        {/* Desktop Table View */}
        <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.user}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.role}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.status}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.lastLogin}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.actions}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProfiles.map((profile) => (
                <tr
                  key={profile.id}
                  onClick={() => loadUserDetails(profile.id)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {profile.avatar_url ? (
                          <img
                            className="h-10 w-10 rounded-full"
                            src={profile.avatar_url}
                            alt=""
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {profile.full_name || t.noName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {profile.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      profile.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {profile.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                      {profile.role === 'admin' ? t.admin : t.customer}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {profile.banned ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                        <Ban className="w-3 h-3 mr-1" />
                        {t.banned}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {t.active}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(profile.last_login_at)}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {profile.login_count} {t.logins}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      {profile.role !== 'admin' && profile.id !== currentAdminId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openRoleChangeModal(profile.id, profile.full_name || profile.email, 'admin');
                          }}
                          className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                          title={t.makeAdmin}
                        >
                          <Crown className="w-4 h-4" />
                        </button>
                      )}
                      {profile.role === 'admin' && profile.id !== currentAdminId && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPermissionsModal({ userId: profile.id, userName: profile.full_name || profile.email || '' });
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title={language === 'pt' ? 'Configurar Permissões' : language === 'en' ? 'Configure Permissions' : 'Configurar Permisos'}
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRoleChangeModal(profile.id, profile.full_name || profile.email, 'customer');
                            }}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                            title={t.removeAdmin}
                          >
                            <UserCog className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {!profile.banned && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateUserStatus(profile.id, 'ban');
                          }}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          title={t.banUser}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      {profile.banned && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateUserStatus(profile.id, 'unban');
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title={t.unbanUser}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
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
          {filteredProfiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => loadUserDetails(profile.id)}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 h-10 w-10">
                    {profile.avatar_url ? (
                      <img
                        className="h-10 w-10 rounded-full object-cover"
                        src={profile.avatar_url}
                        alt=""
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center ${profile.avatar_url ? 'hidden' : ''}`}>
                      <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {profile.full_name || t.noName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center">
                      <Mail className="w-3 h-3 mr-1" />
                      {profile.email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    profile.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' 
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}>
                    {profile.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                    {profile.role === 'admin' ? t.admin : t.customer}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  {profile.banned ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                      <Ban className="w-3 h-3 mr-1" />
                      {t.banned}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {t.active}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Último Login</p>
                  <div className="flex items-center text-xs text-gray-900 dark:text-white">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(profile.last_login_at)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {profile.login_count} {t.logins}
                </div>
                <div className="flex items-center space-x-2">
                  {profile.role !== 'admin' && profile.id !== currentAdminId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRoleChangeModal(profile.id, profile.full_name || profile.email, 'admin');
                      }}
                      className="p-2 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors touch-manipulation"
                      title={t.makeAdmin}
                    >
                      <Crown className="w-4 h-4" />
                    </button>
                  )}
                  {profile.role === 'admin' && profile.id !== currentAdminId && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPermissionsModal({ userId: profile.id, userName: profile.full_name || profile.email || '' });
                        }}
                        className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors touch-manipulation"
                        title={language === 'pt' ? 'Configurar Permissões' : language === 'en' ? 'Configure Permissions' : 'Configurar Permisos'}
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openRoleChangeModal(profile.id, profile.full_name || profile.email, 'customer');
                        }}
                        className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                        title={t.removeAdmin}
                      >
                        <UserCog className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {!profile.banned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateUserStatus(profile.id, 'ban');
                      }}
                      className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors touch-manipulation"
                      title={t.banUser}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                  {profile.banned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateUserStatus(profile.id, 'unban');
                      }}
                      className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors touch-manipulation"
                      title={t.unbanUser}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProfiles.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t.noUsersFound}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || filterRole !== 'all' || filterStatus !== 'all'
                ? t.tryAdjustingFilters
                : t.noUsersRegistered}
            </p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{t.totalUsers}</p>
              <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{profiles.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{t.activeUsers}</p>
              <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {profiles.filter(p => !p.banned).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{t.admins}</p>
              <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {profiles.filter(p => p.role === 'admin').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Ban className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
            </div>
            <div className="ml-2 sm:ml-3">
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{t.bannedUsers}</p>
              <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {profiles.filter(p => p.banned).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {loadingUserDetails ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 h-16 w-16">
                        {selectedUser.profile.avatar_url ? (
                          <img
                            className="h-16 w-16 rounded-full object-cover"
                            src={selectedUser.profile.avatar_url}
                            alt=""
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <User className="w-8 h-8 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          {selectedUser.profile.full_name || t.noName}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
                          <Mail className="w-4 h-4 mr-1" />
                          {selectedUser.profile.email}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            selectedUser.profile.role === 'admin'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {selectedUser.profile.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                            {selectedUser.profile.role === 'admin' ? t.admin : t.customer}
                          </span>
                          {selectedUser.profile.banned ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                              <Ban className="w-3 h-3 mr-1" />
                              {t.banned}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {t.active}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-green-800 dark:text-green-300">
                            {t.language === 'pt' ? 'Saldo' : t.language === 'en' ? 'Balance' : 'Saldo'}
                          </p>
                          <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                            {formatPrice(selectedUser.credits?.balance || 0)}
                          </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                            {t.language === 'pt' ? 'Total Recarregado' : t.language === 'en' ? 'Total Recharged' : 'Total Recargado'}
                          </p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                            ${selectedUser.credits?.total_recharged.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-purple-800 dark:text-purple-300">
                            {t.language === 'pt' ? 'Total Gasto' : t.language === 'en' ? 'Total Spent' : 'Total Gastado'}
                          </p>
                          <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                            ${selectedUser.credits?.total_spent.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <CreditCard className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-orange-800 dark:text-orange-300">
                            {t.language === 'pt' ? 'Compras Ativas' : t.language === 'en' ? 'Active Purchases' : 'Compras Activas'}
                          </p>
                          <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                            {selectedUser.activePurchases}/{selectedUser.totalPurchases}
                          </p>
                        </div>
                        <ShoppingBag className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                      </div>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      {t.language === 'pt' ? 'Informações da Conta' : t.language === 'en' ? 'Account Information' : 'Información de Cuenta'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          {t.language === 'pt' ? 'Membro desde:' : t.language === 'en' ? 'Member since:' : 'Miembro desde:'}
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">
                          {formatDate(selectedUser.profile.created_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          {t.language === 'pt' ? 'Último login:' : t.language === 'en' ? 'Last login:' : 'Último inicio:'}
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">
                          {formatDateTime(selectedUser.profile.last_login_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          {t.language === 'pt' ? 'Total de logins:' : t.language === 'en' ? 'Total logins:' : 'Total de inicios:'}
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">
                          {selectedUser.profile.login_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          {t.language === 'pt' ? 'Idioma:' : t.language === 'en' ? 'Language:' : 'Idioma:'}
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-white font-medium">
                          {selectedUser.profile.language.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Purchases */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      {t.language === 'pt' ? 'Últimas Compras' : t.language === 'en' ? 'Recent Purchases' : 'Últimas Compras'}
                    </h3>
                    {selectedUser.recentPurchases.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUser.recentPurchases.map((purchase) => (
                          <div
                            key={purchase.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {purchase.product_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDateTime(purchase.created_at)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                ${purchase.purchase_price.toFixed(2)}
                              </p>
                              {purchase.expired ? (
                                <span className="text-xs text-red-600 dark:text-red-400">
                                  {t.language === 'pt' ? 'Expirado' : t.language === 'en' ? 'Expired' : 'Expirado'}
                                </span>
                              ) : (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                  {t.language === 'pt' ? 'Ativo' : t.language === 'en' ? 'Active' : 'Activo'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        {t.language === 'pt' ? 'Nenhuma compra realizada' : t.language === 'en' ? 'No purchases made' : 'No hay compras realizadas'}
                      </p>
                    )}
                  </div>

                  {/* Recent Recharges */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      {t.language === 'pt' ? 'Últimas Recargas' : t.language === 'en' ? 'Recent Recharges' : 'Últimas Recargas'}
                    </h3>
                    {selectedUser.recentRecharges.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUser.recentRecharges.map((recharge) => (
                          <div
                            key={recharge.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {recharge.description || recharge.type}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDateTime(recharge.created_at)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                                +${recharge.amount.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        {t.language === 'pt' ? 'Nenhuma recarga realizada' : t.language === 'en' ? 'No recharges made' : 'No hay recargas realizadas'}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {permissionsModal && (
        <AdminPermissionsModal
          userId={permissionsModal.userId}
          userName={permissionsModal.userName}
          onClose={() => setPermissionsModal(null)}
          onSaved={() => {
            setPermissionsModal(null);
          }}
        />
      )}

      {/* Role Change Confirmation Modal */}
      {roleChangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t.confirmRoleChange}
              </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {t.confirmRoleChangeMessage} <span className="font-semibold text-purple-600 dark:text-purple-400">
                {roleChangeModal.newRole === 'admin' ? t.admin : t.customer}
              </span>?
            </p>

            <p className="text-sm font-medium text-gray-900 dark:text-white mb-6">
              {t.language === 'pt' ? 'Usuário:' : t.language === 'en' ? 'User:' : 'Usuario:'} {roleChangeModal.userName}
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRoleChangeModal(null)}
                disabled={updatingRole}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleRoleChange}
                disabled={updatingRole}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {updatingRole ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {t.language === 'pt' ? 'Atualizando...' : t.language === 'en' ? 'Updating...' : 'Actualizando...'}
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    {t.save}
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