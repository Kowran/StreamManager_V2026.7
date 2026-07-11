import { supabase } from './supabase';

export interface Notification {
  id: string;
  user_id: string;
  type: 'account_expiry' | 'delivery' | 'payment' | 'support' | 'system' | 'admin' | 'accounts_access_expiry' | 'order_status' | 'credit_low' | 'security' | 'renewal_prompt';
  title: string;
  message: string;
  data: any;
  read: boolean;
  read_at?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  account_expiry_enabled: boolean;
  delivery_enabled: boolean;
  payment_enabled: boolean;
  support_enabled: boolean;
  system_enabled: boolean;
  admin_enabled: boolean;
  accounts_access_expiry_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export class NotificationAPI {
  // Get user notifications
  static async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  // Get unread notifications count
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Create notification
  static async createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    data: any = {},
    priority: Notification['priority'] = 'medium',
    expiresAt?: string
  ): Promise<Notification | null> {
    try {
      const { data: newNotification, error } = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          type: type,
          title: title,
          message: message,
          data: data,
          priority: priority,
          expires_at: expiresAt,
          read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return newNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true, 
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId?: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ 
          read: true, 
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('read', false)
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return 0;
    }
  }

  // Delete notification
  static async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  // Clear all notifications for user
  static async clearAllNotifications(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return false;
    }
  }

  // Get user notification preferences
  static async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching preferences:', error);
      return null;
    }
  }

  // Update notification preferences
  static async updatePreferences(
    userId: string, 
    preferences: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return false;
    }
  }

  // Subscribe to real-time notifications
  static subscribeToNotifications(
    userId: string,
    onNotification: (notification: Notification) => void,
    onUpdate: (notification: Notification) => void
  ) {
    console.log('Setting up notification subscription for user:', userId);
    
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Real-time notification INSERT:', payload.new);
          onNotification(payload.new as Notification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Real-time notification UPDATE:', payload.new);
          onUpdate(payload.new as Notification);
        }
      )
      .subscribe((status) => {
        console.log('Notification subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from notifications');
      supabase.removeChannel(channel);
    };
  }

  // Clean up expired notifications
  static async cleanupExpiredNotifications(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      return 0;
    }
  }

  // Bulk notification helpers
  static async notifyAccountExpiry(userId: string, accountData: any): Promise<void> {
    const daysUntilExpiry = Math.ceil(
      (new Date(accountData.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    let title = '';
    let priority: Notification['priority'] = 'medium';

    if (daysUntilExpiry <= 1) {
      title = '🚨 Conta Expira Hoje!';
      priority = 'urgent';
    } else if (daysUntilExpiry <= 3) {
      title = '⚠️ Conta Expira em Breve';
      priority = 'high';
    } else {
      title = '📅 Lembrete de Expiração';
      priority = 'medium';
    }

    const message = `Sua conta ${accountData.service_name} (${accountData.email}) expira em ${daysUntilExpiry} dia${daysUntilExpiry !== 1 ? 's' : ''}. ${daysUntilExpiry <= 1 ? 'Renove agora!' : 'Planeje a renovação.'}`;

    await this.createNotification(
      userId,
      'account_expiry',
      title,
      message,
      accountData,
      priority,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    );
  }

  static async notifyDelivery(userId: string, deliveryData: any): Promise<void> {
    await this.createNotification(
      userId,
      'delivery',
      '🎉 Produto Entregue!',
      `Seu produto "${deliveryData.product_name}" foi entregue com sucesso! Verifique suas compras para acessar as credenciais.`,
      deliveryData,
      'high',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    );
  }

  static async notifyPaymentCompleted(userId: string, paymentData: any): Promise<void> {
    await this.createNotification(
      userId,
      'payment',
      '💰 Recarga Concluída!',
      `Sua recarga de $${paymentData.amount.toFixed(2)} foi processada com sucesso! Seus créditos foram adicionados à sua conta.`,
      paymentData,
      'high',
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    );
  }

  static async notifySupportResponse(userId: string, supportData: any): Promise<void> {
    await this.createNotification(
      userId,
      'support',
      '💬 Nova Resposta do Suporte',
      `Você recebeu uma nova resposta no ticket #${supportData.ticket_number}: "${supportData.subject}"`,
      supportData,
      'high',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    );
  }

  static async notifySystemMessage(userId: string, title: string, message: string, data: any = {}): Promise<void> {
    await this.createNotification(
      userId,
      'system',
      title,
      message,
      data,
      'medium',
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  }

  static async notifyAdminAction(userId: string, title: string, message: string, data: any = {}): Promise<void> {
    await this.createNotification(
      userId,
      'admin',
      title,
      message,
      data,
      'high',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    );
  }

  static async sendBulkNotifications(
    userIds: string[],
    title: string,
    message: string,
    priority: Notification['priority'] = 'medium',
    expiresAt?: string
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const notifications = userIds.map(userId => ({
        user_id: userId,
        type: 'admin' as const,
        title,
        message,
        priority,
        expires_at: expiresAt,
        read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error, count } = await supabase
        .from('notifications')
        .insert(notifications)
        .select('id', { count: 'exact' });

      if (error) throw error;

      return {
        success: true,
        count: count || userIds.length
      };
    } catch (error: any) {
      console.error('Error sending bulk notifications:', error);
      return {
        success: false,
        count: 0,
        error: error.message
      };
    }
  }
}