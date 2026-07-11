import { useState, useEffect, useCallback } from 'react';
import { NotificationAPI, Notification as AppNotification } from '../lib/notificationApi';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load notifications and setup real-time subscription when user changes
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadUnreadCount();

      // Setup real-time subscription for notifications
      const channel = supabase
        .channel(`notifications:${user.id}`, {
          config: {
            broadcast: { self: true }
          }
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[Realtime] New notification received:', payload.new);
            handleNewNotification(payload.new as AppNotification);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[Realtime] Notification updated:', payload.new);
            handleNotificationUpdate(payload.new as AppNotification);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[Realtime] Notification deleted:', payload.old);
            handleNotificationDelete((payload.old as any).id);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Successfully subscribed to notifications');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[Realtime] Error subscribing to notifications');
          } else if (status === 'TIMED_OUT') {
            console.error('[Realtime] Subscription timed out');
          } else {
            console.log('[Realtime] Subscription status:', status);
          }
        });

      return () => {
        console.log('[Realtime] Unsubscribing from notifications channel');
        supabase.removeChannel(channel);
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
    }
  }, [user]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await NotificationAPI.getUserNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const count = await NotificationAPI.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [user]);

  const handleNewNotification = useCallback((notification: AppNotification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Play notification sound and show browser notification for important notifications
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      playNotificationSound();
      showBrowserNotification(notification);
    }
    
    console.log('New notification added to state:', notification);
  }, []);

  const handleNotificationUpdate = useCallback((notification: AppNotification) => {
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? notification : n)
    );

    // Update unread count if read status changed
    if (notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    console.log('[State] Notification updated:', notification);
  }, []);

  const handleNotificationDelete = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(n => n.id !== notificationId);
    });

    console.log('[State] Notification deleted:', notificationId);
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const success = await NotificationAPI.markAsRead(notificationId);
      if (success) {
        setNotifications(prev =>
          prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, read: true, read_at: new Date().toISOString() }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      return success;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return 0;

    try {
      const updatedCount = await NotificationAPI.markAllAsRead(user.id);
      if (updatedCount > 0) {
        setNotifications(prev =>
          prev.map(notification => ({ 
            ...notification, 
            read: true, 
            read_at: new Date().toISOString() 
          }))
        );
        setUnreadCount(0);
      }
      return updatedCount;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return 0;
    }
  }, [user]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const success = await NotificationAPI.deleteNotification(notificationId);
      if (success) {
        const notification = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        
        if (notification && !notification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
      return success;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }, [notifications]);

  const clearAll = useCallback(async () => {
    if (!user) return false;

    try {
      const success = await NotificationAPI.clearAllNotifications(user.id);
      if (success) {
        setNotifications([]);
        setUnreadCount(0);
      }
      return success;
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return false;
    }
  }, [user]);

  const addNotification = useCallback(async (
    notification: Omit<AppNotification, 'id' | 'user_id' | 'read' | 'read_at' | 'created_at' | 'updated_at'>
  ) => {
    if (!user) return null;

    try {
      const newNotification = await NotificationAPI.createNotification(
        user.id,
        notification.type,
        notification.title,
        notification.message,
        notification.data || {},
        notification.priority || 'medium',
        notification.expires_at
      );

      if (newNotification) {
        // The real-time subscription will handle adding it to the state
        return newNotification;
      }
      
      return null;
    } catch (error) {
      console.error('Error adding notification:', error);
      return null;
    }
  }, [user]);

  const showBrowserNotification = useCallback((notification: AppNotification) => {
    // Check if browser notifications are supported and permitted
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification.id,
          requireInteraction: notification.priority === 'urgent',
          silent: false
        });

        // Auto-close after 5 seconds unless it's urgent
        if (notification.priority !== 'urgent') {
          setTimeout(() => {
            browserNotification.close();
          }, 5000);
        }

        // Handle click to focus window
        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();
        };
      } else if (Notification.permission === 'default') {
        // Request permission for future notifications
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log('Browser notification permission granted');
          }
        });
      }
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, []);

  // Cleanup expired notifications periodically
  useEffect(() => {
    const cleanupInterval = setInterval(async () => {
      try {
        await NotificationAPI.cleanupExpiredNotifications();
      } catch (error) {
        console.error('Error cleaning up notifications:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    addNotification,
    playNotificationSound,
    showBrowserNotification,
    refresh: loadNotifications
  };
}