import React, { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, Clock, Filter, AlertTriangle, Package, CreditCard, MessageCircle, Settings as SettingsIcon, Shield, Calendar, Eye, RefreshCw, ShoppingCart } from 'lucide-react';
import { useNotificationContext } from './NotificationProvider';
import { useLanguage } from './LanguageProvider';
import { NotificationPreferencesModal } from './NotificationPreferencesModal';
import RenewalPromptModal from './RenewalPromptModal';

type NotificationFilter = 'all' | 'unread' | 'delivery' | 'payment' | 'account_expiry' | 'support' | 'system';

export function NotificationsPage() {
  const { t } = useLanguage();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh
  } = useNotificationContext();

  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [renewalPrompt, setRenewalPrompt] = useState<{
    isOpen: boolean;
    notificationId: string;
    productId: string;
    productName: string;
    productPrice: number;
    durationDays: number;
    purchaseId: string;
  } | null>(null);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'delivery':
        return <Package className="h-6 w-6 text-green-600 dark:text-green-400" />;
      case 'payment':
        return <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
      case 'account_expiry':
        return <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />;
      case 'accounts_access_expiry':
        return <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />;
      case 'renewal_prompt':
        return <RefreshCw className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
      case 'support':
        return <MessageCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />;
      case 'system':
        return <SettingsIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />;
      case 'admin':
        return <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />;
      case 'order_status':
        return <ShoppingCart className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />;
      case 'credit_low':
        return <CreditCard className="h-6 w-6 text-orange-600 dark:text-orange-400" />;
      case 'security':
        return <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />;
      default:
        return <Bell className="h-6 w-6 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
      case 'high':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10';
      case 'medium':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10';
      case 'low':
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10';
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return t.language === 'pt' ? 'Agora' : t.language === 'en' ? 'Now' : 'Ahora';
    if (diffInMinutes < 60) return t.language === 'pt' ? `${diffInMinutes}m atrás` : t.language === 'en' ? `${diffInMinutes}m ago` : `hace ${diffInMinutes}m`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return t.language === 'pt' ? `${diffInHours}h atrás` : t.language === 'en' ? `${diffInHours}h ago` : `hace ${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return t.language === 'pt' ? 'Ontem' : t.language === 'en' ? 'Yesterday' : 'Ayer';
    if (diffInDays < 7) return t.language === 'pt' ? `${diffInDays}d atrás` : t.language === 'en' ? `${diffInDays}d ago` : `hace ${diffInDays}d`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    switch (notification.type) {
      case 'renewal_prompt':
        if (notification.data?.can_renew) {
          setRenewalPrompt({
            isOpen: true,
            notificationId: notification.id,
            productId: notification.data.product_id,
            productName: notification.data.product_name,
            productPrice: notification.data.product_price,
            durationDays: notification.data.duration_days,
            purchaseId: notification.data.purchase_id
          });
        }
        break;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    return notification.type === filter;
  });

  const filterOptions = [
    { value: 'all', label: t.language === 'pt' ? 'Todas' : t.language === 'en' ? 'All' : 'Todas', icon: Bell },
    { value: 'unread', label: t.language === 'pt' ? 'Não lidas' : t.language === 'en' ? 'Unread' : 'No leídas', icon: Eye },
    { value: 'delivery', label: t.language === 'pt' ? 'Entregas' : t.language === 'en' ? 'Deliveries' : 'Entregas', icon: Package },
    { value: 'payment', label: t.language === 'pt' ? 'Pagamentos' : t.language === 'en' ? 'Payments' : 'Pagos', icon: CreditCard },
    { value: 'account_expiry', label: t.language === 'pt' ? 'Expirações' : t.language === 'en' ? 'Expirations' : 'Expiraciones', icon: AlertTriangle },
    { value: 'support', label: t.language === 'pt' ? 'Suporte' : t.language === 'en' ? 'Support' : 'Soporte', icon: MessageCircle },
    { value: 'system', label: t.language === 'pt' ? 'Sistema' : t.language === 'en' ? 'System' : 'Sistema', icon: SettingsIcon }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Bell className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t.language === 'pt' ? 'Notificações' : t.language === 'en' ? 'Notifications' : 'Notificaciones'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {notifications.length} {t.language === 'pt' ? `notificação${notifications.length !== 1 ? 'ões' : ''}` : t.language === 'en' ? `notification${notifications.length !== 1 ? 's' : ''}` : `notificación${notifications.length !== 1 ? 'es' : ''}`}
                {unreadCount > 0 && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                    ({unreadCount} {t.language === 'pt' ? `não lida${unreadCount !== 1 ? 's' : ''}` : t.language === 'en' ? `unread` : `no leída${unreadCount !== 1 ? 's' : ''}`})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPreferences(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center space-x-2"
            >
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.language === 'pt' ? 'Configurar' : t.language === 'en' ? 'Configure' : 'Configurar'}</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center space-x-2"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{t.language === 'pt' ? 'Marcar todas como lidas' : t.language === 'en' ? 'Mark all as read' : 'Marcar todas como leídas'}</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t.language === 'pt' ? 'Limpar tudo' : t.language === 'en' ? 'Clear all' : 'Limpiar todo'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-2">
          {filterOptions.map((option) => {
            const Icon = option.icon;
            const count = option.value === 'all'
              ? notifications.length
              : option.value === 'unread'
              ? unreadCount
              : notifications.filter(n => n.type === option.value).length;

            return (
              <button
                key={option.value}
                onClick={() => setFilter(option.value as NotificationFilter)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 ${
                  filter === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
                {count > 0 && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    filter === option.value
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t.language === 'pt' ? 'Carregando notificações...' : t.language === 'en' ? 'Loading notifications...' : 'Cargando notificaciones...'}
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === 'all'
                ? (t.language === 'pt' ? 'Nenhuma notificação' : t.language === 'en' ? 'No notifications' : 'Ninguna notificación')
                : filter === 'unread'
                ? (t.language === 'pt' ? 'Nenhuma notificação não lida' : t.language === 'en' ? 'No unread notifications' : 'Ninguna notificación no leída')
                : (t.language === 'pt' ? 'Nenhuma notificação nesta categoria' : t.language === 'en' ? 'No notifications in this category' : 'Ninguna notificación en esta categoría')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-pointer border-l-4 ${
                  !notification.read ? getPriorityColor(notification.priority) : 'border-l-gray-300 dark:border-l-gray-600'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`text-base font-medium ${
                          !notification.read
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {notification.title}
                        </p>
                        <p className={`text-sm mt-1 ${
                          !notification.read
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {notification.message}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title="Remover notificação"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTime(notification.created_at)}
                      </span>

                      <div className="flex items-center space-x-2">
                        {notification.priority === 'urgent' && (
                          <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 px-2 py-1 rounded-full font-medium">
                            Urgente
                          </span>
                        )}
                        {notification.priority === 'high' && (
                          <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 px-2 py-1 rounded-full font-medium">
                            Alta
                          </span>
                        )}

                        {!notification.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium"
                            title="Marcar como lida"
                          >
                            Marcar como lida
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <NotificationPreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />

      {renewalPrompt && (
        <RenewalPromptModal
          isOpen={renewalPrompt.isOpen}
          onClose={() => setRenewalPrompt(null)}
          notificationId={renewalPrompt.notificationId}
          productId={renewalPrompt.productId}
          productName={renewalPrompt.productName}
          productPrice={renewalPrompt.productPrice}
          durationDays={renewalPrompt.durationDays}
          purchaseId={renewalPrompt.purchaseId}
          onRenewalSuccess={() => setRenewalPrompt(null)}
        />
      )}
    </div>
  );
}
