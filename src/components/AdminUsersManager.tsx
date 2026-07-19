import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { AdminAPI } from '../lib/adminApi';
import {
  Users, Search, Shield, Ban, CheckCircle, XCircle, Calendar, Mail, User,
  DollarSign, ShoppingBag, X, TrendingUp, CreditCard, Crown, UserCog,
  AlertTriangle, Settings2, Snowflake, KeyRound, Edit3, Store, Clock,
  FileText, MessageSquare, Loader, ChevronRight, Lock, Unlock, Eye,
  ScrollText, Gavel,
} from 'lucide-react';
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
  ban_reason?: string | null;
  last_login_at: string | null;
  login_count: number;
  seller_slug?: string | null;
  username?: string | null;
  balance_frozen?: boolean;
  balance_frozen_at?: string | null;
  balance_frozen_reason?: string | null;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  total_usdt: number;
  total_brl: number;
  status: string;
  created_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  store_products?: { name: string } | null;
  has_rated?: boolean;
}

interface AppealItem {
  id: string;
  appeal_reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_response: string | null;
  reviewed_at: string | null;
  created_at: string;
  ban_reason_snapshot: string | null;
}

interface ManagementLog {
  id: string;
  action: string;
  details: any;
  created_at: string;
  admin: { full_name: string | null; email: string } | null;
}

interface UserDetails {
  profile: Profile;
  credits: {
    balance: number;
    total_recharged: number;
    total_spent: number;
    frozen?: boolean;
  } | null;
  orders: OrderItem[];
  appeals: AppealItem[];
  logs: ManagementLog[];
  totalOrders: number;
  activeOrders: number;
  cancelledOrders: number;
}

type DetailTab = 'overview' | 'orders' | 'appeals' | 'logs';

export default function AdminUsersManager() {
  const { t, language } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals
  const [banModal, setBanModal] = useState<{ userId: string; userName: string } | null>(null);
  const [unbanModal, setUnbanModal] = useState<{ userId: string; userName: string } | null>(null);
  const [freezeModal, setFreezeModal] = useState<{ userId: string; userName: string } | null>(null);
  const [unfreezeModal, setUnfreezeModal] = useState<{ userId: string; userName: string } | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ userId: string; userName: string } | null>(null);
  const [editNameModal, setEditNameModal] = useState<{ userId: string; userName: string } | null>(null);
  const [cancelOrderModal, setCancelOrderModal] = useState<{ order: OrderItem; userName: string } | null>(null);
  const [reviewAppealModal, setReviewAppealModal] = useState<{ appeal: AppealItem; userName: string } | null>(null);
  const [roleChangeModal, setRoleChangeModal] = useState<{
    userId: string;
    userName: string;
    newRole: 'admin' | 'customer' | 'seller';
  } | null>(null);
  const [permissionsModal, setPermissionsModal] = useState<{ userId: string; userName: string } | null>(null);

  // Form state
  const [banReason, setBanReason] = useState('');
  const [freezeReason, setFreezeReason] = useState('');
  const [newName, setNewName] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [appealResponse, setAppealResponse] = useState('');
  const [resetPasswordResult, setResetPasswordResult] = useState<string | null>(null);

  const tr = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  useEffect(() => {
    fetchProfiles();
    getCurrentAdminId();
  }, []);

  const getCurrentAdminId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentAdminId(user.id);
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

  const loadUserDetails = useCallback(async (userId: string) => {
    setLoadingUserDetails(true);
    setActiveDetailTab('overview');
    try {
      const profile = profiles.find(p => p.id === userId);
      if (!profile) return;

      const [creditsResult, ordersResult, appealsResult, logsResult] = await Promise.all([
        supabase.from('user_credits').select('balance, total_recharged, total_spent, frozen').eq('user_id', userId).maybeSingle(),
        supabase.from('store_orders').select('id, product_id, quantity, total_usdt, total_brl, status, created_at, cancelled_at, cancellation_reason, has_rated, store_products(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('ban_appeals').select('id, appeal_reason, status, admin_response, reviewed_at, created_at, ban_reason_snapshot').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
        supabase.from('user_management_logs').select('id, action, details, created_at, admin:profiles!user_management_logs_admin_id_fkey(full_name, email)').eq('target_user_id', userId).order('created_at', { ascending: false }).limit(20),
      ]);

      const orders = ordersResult.data || [];
      const totalOrders = orders.length;
      const activeOrders = orders.filter(o => !['cancelled', 'expired'].includes(o.status)).length;
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;

      setSelectedUser({
        profile,
        credits: creditsResult.data,
        orders,
        appeals: appealsResult.data || [],
        logs: logsResult.data || [],
        totalOrders,
        activeOrders,
        cancelledOrders,
      });
    } catch (error) {
      console.error('Error loading user details:', error);
    } finally {
      setLoadingUserDetails(false);
    }
  }, [profiles]);

  // Actions
  const handleBan = async () => {
    if (!banModal) return;
    setActionLoading('ban');
    try {
      await AdminAPI.banUser(banModal.userId, banReason || tr('Violação das regras da plataforma', 'Platform rules violation', 'Violación de las reglas'));
      setBanModal(null);
      setBanReason('');
      await fetchProfiles();
      if (selectedUser?.profile.id === banModal.userId) await loadUserDetails(banModal.userId);
    } catch (error: any) {
      alert(error.message || tr('Erro ao banir usuário', 'Error banning user', 'Error al banear usuario'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async () => {
    if (!unbanModal) return;
    setActionLoading('unban');
    try {
      await AdminAPI.unbanUser(unbanModal.userId);
      setUnbanModal(null);
      await fetchProfiles();
      if (selectedUser?.profile.id === unbanModal.userId) await loadUserDetails(unbanModal.userId);
    } catch (error: any) {
      alert(error.message || tr('Erro ao desbanir', 'Error unbanning', 'Error al desbanear'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleFreeze = async () => {
    if (!freezeModal) return;
    setActionLoading('freeze');
    try {
      await AdminAPI.freezeBalance(freezeModal.userId, freezeReason || tr('Congelado pelo admin', 'Frozen by admin', 'Congelado por admin'));
      setFreezeModal(null);
      setFreezeReason('');
      await fetchProfiles();
      if (selectedUser?.profile.id === freezeModal.userId) await loadUserDetails(freezeModal.userId);
    } catch (error: any) {
      alert(error.message || tr('Erro ao congelar saldo', 'Error freezing balance', 'Error al congelar saldo'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfreeze = async () => {
    if (!unfreezeModal) return;
    setActionLoading('unfreeze');
    try {
      await AdminAPI.unfreezeBalance(unfreezeModal.userId);
      setUnfreezeModal(null);
      await fetchProfiles();
      if (selectedUser?.profile.id === unfreezeModal.userId) await loadUserDetails(unfreezeModal.userId);
    } catch (error: any) {
      alert(error.message || tr('Erro ao descongelar', 'Error unfreezing', 'Error al descongelar'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordModal) return;
    setActionLoading('reset_password');
    setResetPasswordResult(null);
    try {
      const result = await AdminAPI.resetUserPassword(resetPasswordModal.userId);
      if (result.success) {
        setResetPasswordResult(result.temporary_password || tr('Senha redefinida', 'Password reset', 'Contraseña restablecida'));
      } else {
        alert(result.error || tr('Erro ao redefinir senha', 'Error resetting password', 'Error al restablecer contraseña'));
      }
    } catch (error: any) {
      alert(error.message || tr('Erro ao redefinir senha', 'Error', 'Error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditName = async () => {
    if (!editNameModal || !newName.trim()) return;
    setActionLoading('edit_name');
    try {
      await AdminAPI.updateUserName(editNameModal.userId, newName.trim());
      setEditNameModal(null);
      setNewName('');
      await fetchProfiles();
      if (selectedUser?.profile.id === editNameModal.userId) await loadUserDetails(editNameModal.userId);
    } catch (error: any) {
      alert(error.message || tr('Erro ao alterar nome', 'Error updating name', 'Error al cambiar nombre'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderModal) return;
    setActionLoading('cancel_order');
    try {
      await AdminAPI.cancelOrder(
        selectedUser?.profile.id || '',
        cancelOrderModal.order.id,
        cancelReason || tr('Cancelado pelo admin', 'Cancelled by admin', 'Cancelado por admin')
      );
      setCancelOrderModal(null);
      setCancelReason('');
      if (selectedUser) await loadUserDetails(selectedUser.profile.id);
    } catch (error: any) {
      alert(error.message || tr('Erro ao cancelar pedido', 'Error cancelling order', 'Error al cancelar pedido'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReviewAppeal = async (decision: 'approved' | 'rejected') => {
    if (!reviewAppealModal) return;
    setActionLoading(`appeal_${decision}`);
    try {
      await AdminAPI.reviewAppeal(
        selectedUser?.profile.id || '',
        reviewAppealModal.appeal.id,
        decision,
        appealResponse
      );
      setReviewAppealModal(null);
      setAppealResponse('');
      await fetchProfiles();
      if (selectedUser) await loadUserDetails(selectedUser.profile.id);
    } catch (error: any) {
      alert(error.message || tr('Erro ao avaliar recurso', 'Error reviewing appeal', 'Error al revisar apelación'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeModal) return;
    if (roleChangeModal.userId === currentAdminId) {
      alert(t.cannotChangeOwnRole);
      setRoleChangeModal(null);
      return;
    }
    setActionLoading('role');
    try {
      await AdminAPI.updateUserRole(roleChangeModal.userId, roleChangeModal.newRole);
      const wasPromotedToAdmin = roleChangeModal.newRole === 'admin';
      const promotedUser = { userId: roleChangeModal.userId, userName: roleChangeModal.userName };
      setRoleChangeModal(null);
      await fetchProfiles();
      if (selectedUser?.profile.id === promotedUser.userId) await loadUserDetails(promotedUser.userId);
      if (wasPromotedToAdmin) setPermissionsModal(promotedUser);
    } catch (error: any) {
      alert(error.message || tr('Erro ao atualizar role', 'Error updating role', 'Error al actualizar rol'));
    } finally {
      setActionLoading(null);
    }
  };

  const openRoleChangeModal = (userId: string, userName: string, newRole: 'admin' | 'customer' | 'seller') => {
    if (userId === currentAdminId) {
      alert(t.cannotChangeOwnRole);
      return;
    }
    setRoleChangeModal({ userId, userName, newRole });
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch =
      profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (profile.username?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesRole = filterRole === 'all' || profile.role === filterRole;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && !profile.banned) ||
      (filterStatus === 'banned' && profile.banned) ||
      (filterStatus === 'frozen' && profile.balance_frozen) ||
      (filterStatus === 'seller' && (profile.role === 'seller' || profile.role === 'admin'));
    return matchesSearch && matchesRole && matchesStatus;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t.never;
    return new Date(dateString).toLocaleDateString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES');
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return t.never;
    return new Date(dateString).toLocaleString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES');
  };

  const getActionLabel = (action: string) => {
    const map: Record<string, [string, string, string]> = {
      ban: [tr('Banido', 'Banned', 'Baneado')],
      unban: [tr('Desbanido', 'Unbanned', 'Desbaneado')],
      freeze_balance: [tr('Saldo congelado', 'Balance frozen', 'Saldo congelado')],
      unfreeze_balance: [tr('Saldo descongelado', 'Balance unfrozen', 'Saldo descongelado')],
      reset_password: [tr('Senha redefinida', 'Password reset', 'Contraseña restablecida')],
      update_name: [tr('Nome alterado', 'Name changed', 'Nombre cambiado')],
      update_role: [tr('Role alterada', 'Role changed', 'Rol cambiado')],
      cancel_order: [tr('Pedido cancelado', 'Order cancelled', 'Pedido cancelado')],
      review_appeal: [tr('Recurso avaliado', 'Appeal reviewed', 'Apelación revisada')],
      delete: [tr('Usuário deletado', 'User deleted', 'Usuario eliminado')],
      update_permissions: [tr('Permissões atualizadas', 'Permissions updated', 'Permisos actualizados')],
    };
    return map[action] ? map[action][0] : action;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
      <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-4 transition-colors">
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
              <option value="seller">{tr('Vendedor', 'Seller', 'Vendedor')}</option>
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
              <option value="frozen">{tr('Saldo Congelado', 'Balance Frozen', 'Saldo Congelado')}</option>
              <option value="seller">{tr('Vendedores', 'Sellers', 'Vendedores')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.user}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.role}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.status}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.lastLogin}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{tr('Ações', 'Actions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProfiles.map((profile) => (
                <tr key={profile.id} onClick={() => loadUserDetails(profile.id)} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {profile.avatar_url ? (
                          <img className="h-10 w-10 rounded-full object-cover" src={profile.avatar_url} alt="" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{profile.full_name || t.noName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />{profile.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      profile.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' :
                      profile.role === 'seller' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {profile.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                      {profile.role === 'seller' && <Store className="w-3 h-3 mr-1" />}
                      {profile.role === 'admin' ? t.admin : profile.role === 'seller' ? tr('Vendedor', 'Seller', 'Vendedor') : t.customer}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {profile.banned ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 w-fit">
                          <Ban className="w-3 h-3 mr-1" />{t.banned}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 w-fit">
                          <CheckCircle className="w-3 h-3 mr-1" />{t.active}
                        </span>
                      )}
                      {profile.balance_frozen && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400 w-fit">
                          <Snowflake className="w-3 h-3 mr-1" />{tr('Saldo Congelado', 'Frozen', 'Congelado')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(profile.last_login_at)}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{profile.login_count} {t.logins}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5 flex-wrap">
                      <ActionIcon icon={Edit3} color="text-gray-600 dark:text-gray-300" title={tr('Alterar nome', 'Edit name', 'Cambiar nombre')} onClick={() => { setEditNameModal({ userId: profile.id, userName: profile.full_name || profile.email }); setNewName(profile.full_name || ''); }} />
                      <ActionIcon icon={KeyRound} color="text-amber-600 dark:text-amber-400" title={tr('Redefinir senha', 'Reset password', 'Restablecer contraseña')} onClick={() => setResetPasswordModal({ userId: profile.id, userName: profile.full_name || profile.email })} />
                      {profile.balance_frozen ? (
                        <ActionIcon icon={Unlock} color="text-green-600 dark:text-green-400" title={tr('Descongelar saldo', 'Unfreeze balance', 'Descongelar saldo')} onClick={() => setUnfreezeModal({ userId: profile.id, userName: profile.full_name || profile.email })} />
                      ) : (
                        <ActionIcon icon={Snowflake} color="text-cyan-600 dark:text-cyan-400" title={tr('Congelar saldo', 'Freeze balance', 'Congelar saldo')} onClick={() => setFreezeModal({ userId: profile.id, userName: profile.full_name || profile.email })} />
                      )}
                      {profile.role !== 'admin' && profile.id !== currentAdminId && (
                        <ActionIcon icon={Crown} color="text-purple-600 dark:text-purple-400" title={t.makeAdmin} onClick={() => openRoleChangeModal(profile.id, profile.full_name || profile.email, 'admin')} />
                      )}
                      {profile.role === 'admin' && profile.id !== currentAdminId && (
                        <>
                          <ActionIcon icon={Settings2} color="text-blue-600 dark:text-blue-400" title={tr('Permissões', 'Permissions', 'Permisos')} onClick={() => setPermissionsModal({ userId: profile.id, userName: profile.full_name || profile.email || '' })} />
                          <ActionIcon icon={UserCog} color="text-gray-600 dark:text-gray-400" title={t.removeAdmin} onClick={() => openRoleChangeModal(profile.id, profile.full_name || profile.email, 'customer')} />
                        </>
                      )}
                      {!profile.banned ? (
                        <ActionIcon icon={Ban} color="text-red-600 dark:text-red-400" title={t.banUser} onClick={() => setBanModal({ userId: profile.id, userName: profile.full_name || profile.email })} />
                      ) : (
                        <ActionIcon icon={CheckCircle} color="text-green-600 dark:text-green-400" title={t.unbanUser} onClick={() => setUnbanModal({ userId: profile.id, userName: profile.full_name || profile.email })} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {filteredProfiles.map((profile) => (
            <div key={profile.id} onClick={() => loadUserDetails(profile.id)} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 h-10 w-10">
                    {profile.avatar_url ? (
                      <img className="h-10 w-10 rounded-full object-cover" src={profile.avatar_url} alt="" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{profile.full_name || t.noName}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center"><Mail className="w-3 h-3 mr-1" />{profile.email}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    profile.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' :
                    profile.role === 'seller' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}>
                    {profile.role === 'admin' ? t.admin : profile.role === 'seller' ? tr('Vendedor', 'Seller', 'Vendedor') : t.customer}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2">
                  {profile.banned ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                      <Ban className="w-3 h-3 mr-1" />{t.banned}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      <CheckCircle className="w-3 h-3 mr-1" />{t.active}
                    </span>
                  )}
                  {profile.balance_frozen && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400">
                      <Snowflake className="w-3 h-3 mr-1" />{tr('Congelado', 'Frozen', 'Congelado')}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>

        {filteredProfiles.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t.noUsersFound}</h3>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={<Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />} label={t.totalUsers} value={profiles.length} />
        <StatCard icon={<CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />} label={t.activeUsers} value={profiles.filter(p => !p.banned).length} />
        <StatCard icon={<Shield className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />} label={t.admins} value={profiles.filter(p => p.role === 'admin').length} />
        <StatCard icon={<Ban className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />} label={t.bannedUsers} value={profiles.filter(p => p.banned).length} />
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
            {loadingUserDetails ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-5 sm:p-6 z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 h-16 w-16">
                        {selectedUser.profile.avatar_url ? (
                          <img className="h-16 w-16 rounded-2xl object-cover" src={selectedUser.profile.avatar_url} alt="" />
                        ) : (
                          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                            <User className="w-8 h-8 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{selectedUser.profile.full_name || t.noName}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1"><Mail className="w-4 h-4 mr-1" />{selectedUser.profile.email}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            selectedUser.profile.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' :
                            selectedUser.profile.role === 'seller' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {selectedUser.profile.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                            {selectedUser.profile.role === 'seller' && <Store className="w-3 h-3 mr-1" />}
                            {selectedUser.profile.role === 'admin' ? t.admin : selectedUser.profile.role === 'seller' ? tr('Vendedor', 'Seller', 'Vendedor') : t.customer}
                          </span>
                          {selectedUser.profile.banned ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                              <Ban className="w-3 h-3 mr-1" />{t.banned}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              <CheckCircle className="w-3 h-3 mr-1" />{t.active}
                            </span>
                          )}
                          {selectedUser.profile.balance_frozen && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400">
                              <Snowflake className="w-3 h-3 mr-1" />{tr('Saldo Congelado', 'Balance Frozen', 'Saldo Congelado')}
                            </span>
                          )}
                          {selectedUser.profile.seller_slug && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                              <Store className="w-3 h-3 mr-1" />{tr('Loja ativa', 'Store active', 'Tienda activa')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Action buttons row */}
                  {selectedUser.profile.id !== currentAdminId && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <ActionButton icon={Edit3} label={tr('Alterar Nome', 'Edit Name', 'Cambiar Nombre')} color="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => { setEditNameModal({ userId: selectedUser.profile.id, userName: selectedUser.profile.full_name || selectedUser.profile.email }); setNewName(selectedUser.profile.full_name || ''); }} />
                      <ActionButton icon={KeyRound} label={tr('Redefinir Senha', 'Reset Password', 'Restablecer Contraseña')} color="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50" onClick={() => setResetPasswordModal({ userId: selectedUser.profile.id, userName: selectedUser.profile.full_name || selectedUser.profile.email })} />
                      {selectedUser.profile.balance_frozen ? (
                        <ActionButton icon={Unlock} label={tr('Descongelar', 'Unfreeze', 'Descongelar')} color="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50" onClick={() => setUnfreezeModal({ userId: selectedUser.profile.id, userName: selectedUser.profile.full_name || selectedUser.profile.email })} />
                      ) : (
                        <ActionButton icon={Snowflake} label={tr('Congelar Saldo', 'Freeze Balance', 'Congelar Saldo')} color="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-900/50" onClick={() => setFreezeModal({ userId: selectedUser.profile.id, userName: selectedUser.profile.full_name || selectedUser.profile.email })} />
                      )}
                      {!selectedUser.profile.banned ? (
                        <ActionButton icon={Ban} label={tr('Banir', 'Ban', 'Banear')} color="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50" onClick={() => setBanModal({ userId: selectedUser.profile.id, userName: selectedUser.profile.full_name || selectedUser.profile.email })} />
                      ) : (
                        <ActionButton icon={CheckCircle} label={tr('Desbanir', 'Unban', 'Desbanear')} color="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50" onClick={() => setUnbanModal({ userId: selectedUser.profile.id, userName: selectedUser.profile.full_name || selectedUser.profile.email })} />
                      )}
                    </div>
                  )}
                </div>

                {/* Detail Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 px-5 sm:px-6">
                  {([
                    { id: 'overview', label: tr('Visão Geral', 'Overview', 'Resumen'), icon: User },
                    { id: 'orders', label: tr('Compras', 'Orders', 'Compras'), icon: ShoppingBag, count: selectedUser.totalOrders },
                    { id: 'appeals', label: tr('Recursos', 'Appeals', 'Apelaciones'), icon: Gavel, count: selectedUser.appeals.length },
                    { id: 'logs', label: tr('Histórico', 'Logs', 'Historial'), icon: ScrollText, count: selectedUser.logs.length },
                  ] as const).map(tab => (
                    <button key={tab.id} onClick={() => setActiveDetailTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                      activeDetailTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}>
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                      {'count' in tab && tab.count != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{tab.count}</span>
                      )}
                      {activeDetailTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-5 sm:p-6 space-y-6">
                  {/* OVERVIEW */}
                  {activeDetailTab === 'overview' && (
                    <>
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatBox icon={<DollarSign className="w-7 h-7 text-green-600" />} label={tr('Saldo', 'Balance', 'Saldo')} value={`$${selectedUser.credits?.balance?.toFixed(2) || '0.00'}`} gradient="from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20" border="border-green-200 dark:border-green-700" />
                        <StatBox icon={<TrendingUp className="w-7 h-7 text-blue-600" />} label={tr('Total Recarregado', 'Total Recharged', 'Total Recargado')} value={`$${selectedUser.credits?.total_recharged?.toFixed(2) || '0.00'}`} gradient="from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20" border="border-blue-200 dark:border-blue-700" />
                        <StatBox icon={<CreditCard className="w-7 h-7 text-purple-600" />} label={tr('Total Gasto', 'Total Spent', 'Total Gastado')} value={`$${selectedUser.credits?.total_spent?.toFixed(2) || '0.00'}`} gradient="from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20" border="border-purple-200 dark:border-purple-700" />
                        <StatBox icon={<ShoppingBag className="w-7 h-7 text-orange-600" />} label={tr('Compras Ativas', 'Active Orders', 'Compras Activas')} value={`${selectedUser.activeOrders}/${selectedUser.totalOrders}`} gradient="from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20" border="border-orange-200 dark:border-orange-700" />
                      </div>

                      {/* Account Info */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{tr('Informações da Conta', 'Account Information', 'Información de Cuenta')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <InfoRow label={tr('Membro desde:', 'Member since:', 'Miembro desde:')} value={formatDate(selectedUser.profile.created_at)} />
                          <InfoRow label={tr('Último login:', 'Last login:', 'Último inicio:')} value={formatDateTime(selectedUser.profile.last_login_at)} />
                          <InfoRow label={tr('Total de logins:', 'Total logins:', 'Total de inicios:')} value={String(selectedUser.profile.login_count)} />
                          <InfoRow label={tr('Idioma:', 'Language:', 'Idioma:')} value={selectedUser.profile.language.toUpperCase()} />
                          <InfoRow label={tr('Username:', 'Username:', 'Usuario:')} value={selectedUser.profile.username || '—'} />
                          <InfoRow label={tr('Vendedor:', 'Seller:', 'Vendedor:')} value={selectedUser.profile.seller_slug ? `@${selectedUser.profile.seller_slug}` : tr('Não', 'No', 'No')} />
                        </div>
                      </div>

                      {/* Ban Info */}
                      {selectedUser.profile.banned && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-700">
                          <h3 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-2 flex items-center gap-2">
                            <Ban className="w-4 h-4" />{tr('Informações do Banimento', 'Ban Information', 'Información de Ban')}
                          </h3>
                          <div className="space-y-2 text-sm">
                            <InfoRow label={tr('Data:', 'Date:', 'Fecha:')} value={formatDateTime(selectedUser.profile.banned_at)} />
                            <InfoRow label={tr('Motivo:', 'Reason:', 'Razón:')} value={selectedUser.profile.ban_reason || tr('Não especificado', 'Not specified', 'No especificado')} />
                          </div>
                        </div>
                      )}

                      {/* Freeze Info */}
                      {selectedUser.profile.balance_frozen && (
                        <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-xl border border-cyan-200 dark:border-cyan-700">
                          <h3 className="text-sm font-semibold text-cyan-900 dark:text-cyan-300 mb-2 flex items-center gap-2">
                            <Snowflake className="w-4 h-4" />{tr('Saldo Congelado', 'Balance Frozen', 'Saldo Congelado')}
                          </h3>
                          <div className="space-y-2 text-sm">
                            <InfoRow label={tr('Data:', 'Date:', 'Fecha:')} value={formatDateTime(selectedUser.profile.balance_frozen_at)} />
                            <InfoRow label={tr('Motivo:', 'Reason:', 'Razón:')} value={selectedUser.profile.balance_frozen_reason || tr('Não especificado', 'Not specified', 'No especificado')} />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ORDERS */}
                  {activeDetailTab === 'orders' && (
                    <div>
                      {selectedUser.orders.length > 0 ? (
                        <div className="space-y-2">
                          {selectedUser.orders.map((order) => (
                            <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{order.store_products?.name || tr('Produto removido', 'Removed product', 'Producto eliminado')}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(order.created_at)} · {order.quantity}x</p>
                                {order.cancellation_reason && <p className="text-xs text-red-500 mt-1">{order.cancellation_reason}</p>}
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">${Number(order.total_usdt).toFixed(2)}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  order.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  order.status === 'delivered' || order.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>{order.status}</span>
                                {!['cancelled', 'expired'].includes(order.status) && (
                                  <button
                                    onClick={() => setCancelOrderModal({ order, userName: selectedUser.profile.full_name || selectedUser.profile.email })}
                                    className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                                  >
                                    {tr('Cancelar', 'Cancel', 'Cancelar')}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{tr('Nenhuma compra realizada', 'No orders', 'Sin compras')}</p>
                      )}
                    </div>
                  )}

                  {/* APPEALS */}
                  {activeDetailTab === 'appeals' && (
                    <div>
                      {selectedUser.appeals.length > 0 ? (
                        <div className="space-y-3">
                          {selectedUser.appeals.map((appeal) => (
                            <div key={appeal.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Gavel className="w-4 h-4 text-gray-500" />
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    appeal.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                    appeal.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  }`}>{appeal.status}</span>
                                </div>
                                <span className="text-xs text-gray-400">{formatDateTime(appeal.created_at)}</span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{appeal.appeal_reason}</p>
                              {appeal.ban_reason_snapshot && <p className="text-xs text-gray-500 mb-1">{tr('Motivo do ban:', 'Ban reason:', 'Razón del ban:')} {appeal.ban_reason_snapshot}</p>}
                              {appeal.admin_response && <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 p-2 bg-white dark:bg-gray-800 rounded-lg">{tr('Resposta do admin:', 'Admin response:', 'Respuesta del admin:')} {appeal.admin_response}</p>}
                              {appeal.status === 'pending' && (
                                <button
                                  onClick={() => setReviewAppealModal({ appeal, userName: selectedUser.profile.full_name || selectedUser.profile.email })}
                                  className="mt-3 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                >
                                  {tr('Avaliar Recurso', 'Review Appeal', 'Revisar Apelación')}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{tr('Nenhum recurso enviado', 'No appeals', 'Sin apelaciones')}</p>
                      )}
                    </div>
                  )}

                  {/* LOGS */}
                  {activeDetailTab === 'logs' && (
                    <div>
                      {selectedUser.logs.length > 0 ? (
                        <div className="space-y-2">
                          {selectedUser.logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                              <div className="flex-shrink-0 mt-0.5">
                                <ScrollText className="w-4 h-4 text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{getActionLabel(log.action)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {log.admin?.full_name || log.admin?.email || tr('Admin', 'Admin', 'Admin')} · {formatDateTime(log.created_at)}
                                </p>
                                {log.details && Object.keys(log.details).length > 0 && (
                                  <p className="text-xs text-gray-400 mt-1">{JSON.stringify(log.details)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{tr('Nenhuma ação registrada', 'No logs', 'Sin registros')}</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {banModal && (
        <Modal onClose={() => setBanModal(null)} title={tr('Banir Usuário', 'Ban User', 'Banear Usuario')} icon={<Ban className="w-6 h-6 text-red-500" />}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{tr('Tem certeza que deseja banir', 'Are you sure you want to ban', '¿Seguro que quieres banear a')} <span className="font-semibold">{banModal.userName}</span>?</p>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Motivo do banimento', 'Ban reason', 'Razón del ban')}</label>
          <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={3} placeholder={tr('Descreva o motivo...', 'Describe the reason...', 'Describe la razón...')} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none" />
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setBanModal(null)} disabled={actionLoading === 'ban'} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">{t.cancel}</button>
            <button onClick={handleBan} disabled={actionLoading === 'ban'} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2">
              {actionLoading === 'ban' ? <Loader className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              {tr('Banir', 'Ban', 'Banear')}
            </button>
          </div>
        </Modal>
      )}

      {/* Unban Modal */}
      {unbanModal && (
        <Modal onClose={() => setUnbanModal(null)} title={tr('Desbanir Usuário', 'Unban User', 'Desbanear Usuario')} icon={<CheckCircle className="w-6 h-6 text-green-500" />}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{tr('Tem certeza que deseja desbanir', 'Unban', 'Desbanear a')} <span className="font-semibold">{unbanModal.userName}</span>?</p>
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setUnbanModal(null)} disabled={actionLoading === 'unban'} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">{t.cancel}</button>
            <button onClick={handleUnban} disabled={actionLoading === 'unban'} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2">
              {actionLoading === 'unban' ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {tr('Desbanir', 'Unban', 'Desbanear')}
            </button>
          </div>
        </Modal>
      )}

      {/* Freeze Modal */}
      {freezeModal && (
        <Modal onClose={() => setFreezeModal(null)} title={tr('Congelar Saldo', 'Freeze Balance', 'Congelar Saldo')} icon={<Snowflake className="w-6 h-6 text-cyan-500" />}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{tr('O saldo de', 'Freeze balance for', 'Congelar saldo de')} <span className="font-semibold">{freezeModal.userName}</span>?</p>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Motivo', 'Reason', 'Razón')}</label>
          <textarea value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} rows={3} placeholder={tr('Descreva o motivo...', 'Describe...', 'Describe...')} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none" />
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setFreezeModal(null)} disabled={actionLoading === 'freeze'} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">{t.cancel}</button>
            <button onClick={handleFreeze} disabled={actionLoading === 'freeze'} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors flex items-center gap-2">
              {actionLoading === 'freeze' ? <Loader className="w-4 h-4 animate-spin" /> : <Snowflake className="w-4 h-4" />}
              {tr('Congelar', 'Freeze', 'Congelar')}
            </button>
          </div>
        </Modal>
      )}

      {/* Unfreeze Modal */}
      {unfreezeModal && (
        <Modal onClose={() => setUnfreezeModal(null)} title={tr('Descongelar Saldo', 'Unfreeze Balance', 'Descongelar Saldo')} icon={<Unlock className="w-6 h-6 text-green-500" />}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{tr('Descongelar saldo de', 'Unfreeze balance for', 'Descongelar saldo de')} <span className="font-semibold">{unfreezeModal.userName}</span>?</p>
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setUnfreezeModal(null)} disabled={actionLoading === 'unfreeze'} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">{t.cancel}</button>
            <button onClick={handleUnfreeze} disabled={actionLoading === 'unfreeze'} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2">
              {actionLoading === 'unfreeze' ? <Loader className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              {tr('Descongelar', 'Unfreeze', 'Descongelar')}
            </button>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resetPasswordModal && (
        <Modal onClose={() => { setResetPasswordModal(null); setResetPasswordResult(null); }} title={tr('Redefinir Senha', 'Reset Password', 'Restablecer Contraseña')} icon={<KeyRound className="w-6 h-6 text-amber-500" />}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{tr('Uma nova senha temporária será gerada para', 'A temporary password will be generated for', 'Se generará una contraseña temporal para')} <span className="font-semibold">{resetPasswordModal.userName}</span>.</p>
          {resetPasswordResult ? (
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 mb-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">{tr('Senha temporária:', 'Temporary password:', 'Contraseña temporal:')}</p>
              <p className="text-lg font-mono font-bold text-green-900 dark:text-green-200 break-all">{resetPasswordResult}</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-2">{tr('Compartilhe com o usuário com segurança. Ele deve alterá-la após o login.', 'Share with the user securely. They should change it after login.', 'Compártela con el usuario de forma segura. Debe cambiarla tras iniciar sesión.')}</p>
            </div>
          ) : null}
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => { setResetPasswordModal(null); setResetPasswordResult(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">{tr('Fechar', 'Close', 'Cerrar')}</button>
            {!resetPasswordResult && (
              <button onClick={handleResetPassword} disabled={actionLoading === 'reset_password'} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-2">
                {actionLoading === 'reset_password' ? <Loader className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {tr('Redefinir', 'Reset', 'Restablecer')}
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Edit Name Modal */}
      {editNameModal && (
        <Modal onClose={() => setEditNameModal(null)} title={tr('Alterar Nome', 'Edit Name', 'Cambiar Nombre')} icon={<Edit3 className="w-6 h-6 text-blue-500" />}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Novo nome', 'New name', 'Nuevo nombre')}</label>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setEditNameModal(null)} disabled={actionLoading === 'edit_name'} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">{t.cancel}</button>
            <button onClick={handleEditName} disabled={actionLoading === 'edit_name' || !newName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2">
              {actionLoading === 'edit_name' ? <Loader className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
              {t.save}
            </button>
          </div>
        </Modal>
      )}

      {/* Cancel Order Modal */}
      {cancelOrderModal && (
        <Modal onClose={() => setCancelOrderModal(null)} title={tr('Cancelar Pedido', 'Cancel Order', 'Cancelar Pedido')} icon={<XCircle className="w-6 h-6 text-red-500" />}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{tr('Cancelar pedido de', 'Cancel order for', 'Cancelar pedido de')} <span className="font-semibold">{cancelOrderModal.userName}</span>?</p>
          <p className="text-xs text-gray-500 mb-3">{tr('O valor será reembolsado ao saldo do usuário.', 'The amount will be refunded to the user balance.', 'El monto será reembolsado al saldo del usuario.')}</p>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Motivo', 'Reason', 'Razón')}</label>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder={tr('Descreva...', 'Describe...', 'Describe...')} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none" />
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setCancelOrderModal(null)} disabled={actionLoading === 'cancel_order'} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">{t.cancel}</button>
            <button onClick={handleCancelOrder} disabled={actionLoading === 'cancel_order'} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2">
              {actionLoading === 'cancel_order' ? <Loader className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {tr('Cancelar Pedido', 'Cancel Order', 'Cancelar Pedido')}
            </button>
          </div>
        </Modal>
      )}

      {/* Review Appeal Modal */}
      {reviewAppealModal && (
        <Modal onClose={() => setReviewAppealModal(null)} title={tr('Avaliar Recurso', 'Review Appeal', 'Revisar Apelación')} icon={<Gavel className="w-6 h-6 text-blue-500" />}>
          <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 mb-1">{tr('Recurso de:', 'Appeal from:', 'Apelación de:')}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{reviewAppealModal.userName}</p>
            <p className="text-xs text-gray-500 mt-2 mb-1">{tr('Motivo do recurso:', 'Appeal reason:', 'Razón de apelación:')}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{reviewAppealModal.appeal.appeal_reason}</p>
          </div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Resposta do admin', 'Admin response', 'Respuesta del admin')}</label>
          <textarea value={appealResponse} onChange={(e) => setAppealResponse(e.target.value)} rows={3} placeholder={tr('Descreva sua decisão...', 'Describe your decision...', 'Describe tu decisión...')} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setReviewAppealModal(null)} disabled={!!actionLoading} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">{t.cancel}</button>
            <button onClick={() => handleReviewAppeal('rejected')} disabled={!!actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2">
              {actionLoading === 'appeal_rejected' ? <Loader className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {tr('Rejeitar', 'Reject', 'Rechazar')}
            </button>
            <button onClick={() => handleReviewAppeal('approved')} disabled={!!actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2">
              {actionLoading === 'appeal_approved' ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {tr('Aprovar', 'Approve', 'Aprobar')}
            </button>
          </div>
        </Modal>
      )}

      {/* Role Change Modal */}
      {roleChangeModal && (
        <Modal onClose={() => setRoleChangeModal(null)} title={t.confirmRoleChange} icon={<AlertTriangle className="w-6 h-6 text-yellow-500" />}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{t.confirmRoleChangeMessage} <span className="font-semibold text-purple-600 dark:text-purple-400">{roleChangeModal.newRole === 'admin' ? t.admin : roleChangeModal.newRole === 'seller' ? tr('Vendedor', 'Seller', 'Vendedor') : t.customer}</span>?</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-6">{tr('Usuário:', 'User:', 'Usuario:')} {roleChangeModal.userName}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setRoleChangeModal(null)} disabled={actionLoading === 'role'} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50">{t.cancel}</button>
            <button onClick={handleRoleChange} disabled={actionLoading === 'role'} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
              {actionLoading === 'role' ? <Loader className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              {t.save}
            </button>
          </div>
        </Modal>
      )}

      {/* Permissions Modal */}
      {permissionsModal && (
        <AdminPermissionsModal
          userId={permissionsModal.userId}
          userName={permissionsModal.userName}
          onClose={() => setPermissionsModal(null)}
          onSaved={() => setPermissionsModal(null)}
        />
      )}
    </div>
  );
}

function ActionIcon({ icon: Icon, color, title, onClick }: { icon: typeof Ban; color: string; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`p-2 ${color} hover:bg-opacity-20 rounded-lg transition-colors touch-manipulation`} title={title}>
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ActionButton({ icon: Icon, label, color, onClick }: { icon: typeof Ban; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${color}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
      <div className="flex items-center">
        <div className="flex-shrink-0">{icon}</div>
        <div className="ml-2 sm:ml-3">
          <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, gradient, border }: { icon: React.ReactNode; label: string; value: string; gradient: string; border: string }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} p-4 rounded-xl border ${border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-white font-medium">{value}</span>
    </div>
  );
}

function Modal({ children, onClose, title, icon }: { children: React.ReactNode; onClose: () => void; title: string; icon: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          {icon}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
