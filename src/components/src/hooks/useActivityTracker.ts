import { useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { ActivityTracker } from '../lib/adminApi';

export function useActivityTracker(page: string) {
  const { user } = useAuth();

  useEffect(() => {
    if (user && page) {
      // Track page view
      ActivityTracker.trackPageView(page).catch(console.error);
    }
  }, [user, page]);

  const trackAction = (actionType: string, details?: any) => {
    if (user) {
      ActivityTracker.trackAction(actionType, details).catch(console.error);
    }
  };

  return { trackAction };
}