import React, { useState } from 'react';
import { Bell, X, Check, CheckCheck, Trash2, Package, ShoppingCart, Clock, AlertTriangle, CreditCard, MessageCircle, Settings as SettingsIcon, Shield, Calendar, Eye, RefreshCw } from 'lucide-react';
import { useNotificationContext } from './NotificationProvider';
import { useLanguage } from './LanguageProvider';
import { NotificationPreferencesModal } from './NotificationPreferencesModal';
import RenewalPromptModal from './RenewalPromptModal';

export function NotificationCenter() {
  const { t } = useLanguage();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  } = useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);
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

  // Request notification permission on first interaction
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Browser notification permission granted');
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'delivery':
        return <Package className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'payment':
        return <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'account_expiry':
        return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      case 'accounts_access_expiry':
        return <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />;
      case 'renewal_prompt':
        return <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'support':
        return <MessageCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
      case 'system':
        return <SettingsIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
      case 'admin':
        return <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'order_status':
        return <ShoppingCart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
      case 'credit_low':
        return <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />;
      case 'security':
        return <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
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
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Ontem';
    if (diffInDays < 7) return `${diffInDays}d atrás`;
    
    return date.toLocaleDateString('pt-BR');
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    await requestNotificationPermission();

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
      case 'support':
        if (notification.data?.ticket_id) {
          console.log('Navigate to support ticket:', notification.data.ticket_id);
        }
        break;
      case 'delivery':
        if (notification.data?.order_id) {
          console.log('Navigate to purchases');
        }
        break;
      case 'account_expiry':
        if (notification.data?.account_id) {
          console.log('Navigate to accounts');
        }
        break;
      case 'accounts_access_expiry':
        console.log('Navigate to store for access renewal');
        break;
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={requestNotificationPermission}
        className="relative p-1.5 sm:p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors touch-manipulation"
      >
        <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Notificações
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowPreferences(true)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Configurações de notificação"
                >
                  <SettingsIcon className="h-4 w-4" />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                    title="Limpar todas"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto scrollbar-hide">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Carregando notificações...
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma notificação
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Você será notificado sobre atividades importantes
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer touch-manipulation border-l-4 group ${
                        !notification.read ? getPriorityColor(notification.priority) : 'border-l-gray-300 dark:border-l-gray-600'
                      } ${!notification.read ? 'animate-pulse' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className={`text-sm font-medium line-clamp-2 ${
                                !notification.read 
                                  ? 'text-gray-900 dark:text-white' 
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}>
                                {notification.title}
                              </p>
                              <p className={`text-xs mt-1 line-clamp-2 ${
                                !notification.read 
                                  ? 'text-gray-700 dark:text-gray-300' 
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {notification.message}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2 ml-2">
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 animate-pulse"></div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110"
                                title="Remover notificação"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTime(notification.created_at)}
                            </span>
                            
                            <div className="flex items-center space-x-2">
                              {/* Priority indicator */}
                              {notification.priority === 'urgent' && (
                                <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                                  Urgente
                                </span>
                              )}
                              {notification.priority === 'high' && (
                                <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">
                                  Alta
                                </span>
                              )}
                              
                              {!notification.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-all duration-200 hover:scale-110 touch-manipulation"
                                  title="Marcar como lida"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Additional data display */}
                          {notification.data && Object.keys(notification.data).length > 0 && (
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {notification.type === 'account_expiry' && notification.data.service_name && (
                                <span className="inline-flex items-center">
                                  <Eye className="h-3 w-3 mr-1" />
                                  {notification.data.service_name}
                                </span>
                              )}
                              {notification.type === 'support' && notification.data.ticket_number && (
                                <span className="inline-flex items-center">
                                  <MessageCircle className="h-3 w-3 mr-1" />
                                  Ticket #{notification.data.ticket_number}
                                </span>
                              )}
                              {notification.type === 'delivery' && notification.data.product_name && (
                                <span className="inline-flex items-center">
                                  <Package className="h-3 w-3 mr-1" />
                                  {notification.data.product_name}
                                </span>
                              )}
                              {notification.type === 'payment' && notification.data.amount && (
                                <span className="inline-flex items-center">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  ${notification.data.amount.toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {notifications.length} notificação{notifications.length !== 1 ? 'ões' : ''}
                    {unreadCount > 0 && (
                      <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                        ({unreadCount} não lida{unreadCount !== 1 ? 's' : ''})
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => setShowPreferences(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    Configurar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />

      {/* Renewal Prompt Modal */}
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
          onRenewalSuccess={() => {
            setRenewalPrompt(null);
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}