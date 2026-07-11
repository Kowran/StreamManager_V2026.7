import React, { createContext, useContext } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { Notification } from '../lib/notificationApi';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<number>;
  deleteNotification: (id: string) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  addNotification: (notification: Omit<Notification, 'id' | 'user_id' | 'read' | 'read_at' | 'created_at' | 'updated_at'>) => Promise<Notification | null>;
  playNotificationSound: () => void;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const notificationHook = useNotifications();
  
  return (
    <NotificationContext.Provider value={notificationHook}>
      {children}
    </NotificationContext.Provider>
  );
}