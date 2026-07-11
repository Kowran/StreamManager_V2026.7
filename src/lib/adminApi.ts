import { supabase } from './supabase';

const ADMIN_API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface AdminUserAction {
  action: 'ban' | 'unban' | 'delete' | 'reset_password' | 'update_role' | 'get_user_details' | 'update_permissions' | 'get_permissions';
  user_id: string;
  data?: any;
}

interface ActivityTrackingData {
  action: 'login' | 'logout' | 'page_view' | 'action_performed';
  user_id?: string;
  details?: {
    page?: string;
    action_type?: string;
    [key: string]: any;
  };
}

export class AdminAPI {
  private static async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  static async performUserAction(actionData: AdminUserAction) {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${ADMIN_API_BASE}/admin-user-management`, {
        method: 'POST',
        headers,
        body: JSON.stringify(actionData)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to perform user action');
      }

      return result;
    } catch (error) {
      console.error('Error performing user action:', error);
      throw error;
    }
  }

  static async banUser(userId: string, reason?: string) {
    return this.performUserAction({
      action: 'ban',
      user_id: userId,
      data: { reason }
    });
  }

  static async unbanUser(userId: string, reason?: string) {
    return this.performUserAction({
      action: 'unban',
      user_id: userId,
      data: { reason }
    });
  }

  static async deleteUser(userId: string, reason?: string) {
    return this.performUserAction({
      action: 'delete',
      user_id: userId,
      data: { reason }
    });
  }

  static async resetUserPassword(userId: string) {
    return this.performUserAction({
      action: 'reset_password',
      user_id: userId
    });
  }

  static async getUserDetails(userId: string) {
    return this.performUserAction({
      action: 'get_user_details',
      user_id: userId
    });
  }

  static async updateUserRole(userId: string, role: 'admin' | 'customer' | 'seller') {
    return this.performUserAction({
      action: 'update_role',
      user_id: userId,
      data: { role }
    });
  }

  static async updateAdminPermissions(userId: string, pages: string[], isSuperAdmin: boolean) {
    return this.performUserAction({
      action: 'update_permissions',
      user_id: userId,
      data: { pages, is_super_admin: isSuperAdmin }
    });
  }

  static async getAdminPermissions(userId: string) {
    return this.performUserAction({
      action: 'get_permissions',
      user_id: userId
    });
  }

  static async getUserAnalytics(dateRange?: { start: string; end: string }, userId?: string) {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${ADMIN_API_BASE}/user-analytics`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          date_range: dateRange
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to get analytics');
      }

      return result;
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }

  static async trackActivity(activityData: ActivityTrackingData) {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${ADMIN_API_BASE}/user-activity-tracker`, {
        method: 'POST',
        headers,
        body: JSON.stringify(activityData)
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.warn('Failed to track activity:', result.error);
        // Don't throw error for activity tracking failures
        return { success: false };
      }

      return result;
    } catch (error) {
      console.warn('Error tracking activity:', error);
      // Don't throw error for activity tracking failures
      return { success: false };
    }
  }

  static async revokeAllUserSessions(userId: string) {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${ADMIN_API_BASE}/user-session-management`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'revoke_all_sessions',
          user_id: userId
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to revoke sessions');
      }

      return result;
    } catch (error) {
      console.error('Error revoking sessions:', error);
      throw error;
    }
  }
}

// Activity tracking helpers
export const ActivityTracker = {
  trackLogin: (userId?: string) => 
    AdminAPI.trackActivity({ action: 'login', user_id: userId }),
  
  trackLogout: (userId?: string) => 
    AdminAPI.trackActivity({ action: 'logout', user_id: userId }),
  
  trackPageView: (page: string, userId?: string) => 
    AdminAPI.trackActivity({ 
      action: 'page_view', 
      user_id: userId, 
      details: { page } 
    }),
  
  trackAction: (actionType: string, details?: any, userId?: string) => 
    AdminAPI.trackActivity({ 
      action: 'action_performed', 
      user_id: userId, 
      details: { action_type: actionType, ...details } 
    })
};