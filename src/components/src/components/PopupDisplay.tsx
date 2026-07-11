import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info, Megaphone, Tag, ExternalLink } from 'lucide-react';

interface Popup {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  popup_type: 'info' | 'warning' | 'success' | 'error' | 'announcement' | 'promotion';
  position: 'center' | 'top' | 'bottom' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  display_duration: number;
  show_once: boolean;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  priority: number;
  button_text: string | null;
  button_url: string | null;
  allow_close: boolean;
  overlay: boolean;
}

export function PopupDisplay() {
  const { user } = useAuth();
  const [currentPopup, setCurrentPopup] = useState<Popup | null>(null);
  const [visible, setVisible] = useState(false);
  const [popupQueue, setPopupQueue] = useState<Popup[]>([]);
  const [processedPopups, setProcessedPopups] = useState<Set<string>>(new Set());

  const loadActivePopups = useCallback(async () => {
    if (!user) return;

    try {
      const now = new Date().toISOString();

      const { data: popups, error } = await supabase
        .from('admin_popups')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('priority', { ascending: false });

      if (error) throw error;

      if (!popups || popups.length === 0) return;

      // Get viewed popups for this user
      const { data: viewedPopups } = await supabase
        .from('popup_views')
        .select('popup_id')
        .eq('user_id', user.id);

      const viewedPopupIds = new Set(viewedPopups?.map(v => v.popup_id) || []);
      const newViewed = new Set(processedPopups);

      // Filter popups that should be shown
      const popupsToShow = popups.filter(popup => {
        // If show_once is true and user has seen it, don't show again
        if (popup.show_once && viewedPopupIds.has(popup.id)) {
          return false;
        }
        // If already processed in this session, don't show again
        if (processedPopups.has(popup.id)) {
          return false;
        }
        return true;
      });

      if (popupsToShow.length > 0) {
        setPopupQueue(popupsToShow);
      }
    } catch (error) {
      console.error('Error loading popups:', error);
    }
  }, [user, processedPopups]);

  useEffect(() => {
    loadActivePopups();

    // Check for new popups every 30 seconds
    const interval = setInterval(loadActivePopups, 30000);

    return () => clearInterval(interval);
  }, [loadActivePopups]);

  useEffect(() => {
    // Process popup queue
    if (popupQueue.length > 0 && !currentPopup) {
      const [nextPopup, ...remaining] = popupQueue;
      setCurrentPopup(nextPopup);
      setPopupQueue(remaining);

      // Auto-show after small delay
      setTimeout(() => setVisible(true), 100);
    }
  }, [popupQueue, currentPopup]);

  // Auto-close timer
  useEffect(() => {
    if (!currentPopup || currentPopup.display_duration === 0) return;

    const timer = setTimeout(() => {
      handleClose();
    }, currentPopup.display_duration * 1000);

    return () => clearTimeout(timer);
  }, [currentPopup]);

  const handleClose = async () => {
    if (!currentPopup) return;

    setVisible(false);

    // Record view/close
    if (user) {
      try {
        await supabase.from('popup_views').upsert({
          popup_id: currentPopup.id,
          user_id: user.id,
          viewed_at: new Date().toISOString(),
          closed_at: new Date().toISOString()
        }, {
          onConflict: 'popup_id,user_id'
        });

        await supabase.rpc('increment_popup_close_count', { popup_id: currentPopup.id });
      } catch (error) {
        console.error('Error recording popup view:', error);
      }
    }

    // Mark as processed
    setProcessedPopups(prev => new Set(prev).add(currentPopup.id));

    // Close animation then clear
    setTimeout(() => {
      setCurrentPopup(null);
    }, 300);
  };

  const handleButtonClick = async () => {
    if (!currentPopup) return;

    // Record button click
    if (user) {
      try {
        await supabase.from('popup_views').upsert({
          popup_id: currentPopup.id,
          user_id: user.id,
          viewed_at: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          clicked_button: true
        }, {
          onConflict: 'popup_id,user_id'
        });

        await supabase.rpc('increment_popup_view_count', { popup_id: currentPopup.id });
      } catch (error) {
        console.error('Error recording popup click:', error);
      }
    }

    // Open URL if exists
    if (currentPopup.button_url) {
      window.open(currentPopup.button_url, '_blank', 'noopener,noreferrer');
    }

    handleClose();
  };

  const getPopupStyle = (type: string) => {
    switch (type) {
      case 'warning':
        return {
          border: 'border-l-4 border-l-yellow-500',
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          icon: <AlertTriangle className="w-6 h-6 text-yellow-500" />
        };
      case 'success':
        return {
          border: 'border-l-4 border-l-green-500',
          bg: 'bg-green-50 dark:bg-green-900/20',
          icon: <CheckCircle className="w-6 h-6 text-green-500" />
        };
      case 'error':
        return {
          border: 'border-l-4 border-l-red-500',
          bg: 'bg-red-50 dark:bg-red-900/20',
          icon: <AlertCircle className="w-6 h-6 text-red-500" />
        };
      case 'announcement':
        return {
          border: 'border-l-4 border-l-blue-500',
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          icon: <Megaphone className="w-6 h-6 text-blue-500" />
        };
      case 'promotion':
        return {
          border: 'border-l-4 border-l-purple-500',
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          icon: <Tag className="w-6 h-6 text-purple-500" />
        };
      default:
        return {
          border: 'border-l-4 border-l-gray-500',
          bg: 'bg-gray-50 dark:bg-gray-800',
          icon: <Info className="w-6 h-6 text-gray-500" />
        };
    }
  };

  const getPositionClasses = (position: string) => {
    switch (position) {
      case 'top':
        return 'items-start pt-4';
      case 'bottom':
        return 'items-end pb-4';
      case 'top-right':
        return 'items-start justify-end pt-4 pr-4';
      case 'top-left':
        return 'items-start justify-start pt-4 pl-4';
      case 'bottom-right':
        return 'items-end justify-end pb-4 pr-4';
      case 'bottom-left':
        return 'items-end justify-start pb-4 pl-4';
      default:
        return 'items-center justify-center';
    }
  };

  if (!currentPopup) return null;

  const style = getPopupStyle(currentPopup.popup_type);
  const positionClasses = getPositionClasses(currentPopup.position);

  return (
    <div
      className={`fixed inset-0 z-[100] flex ${positionClasses} transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${currentPopup.overlay ? 'bg-black/50' : 'pointer-events-none'}`}
      onClick={currentPopup.allow_close ? handleClose : undefined}
    >
      <div
        className={`max-w-md w-full mx-4 pointer-events-auto transform transition-all duration-300 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`rounded-lg shadow-xl overflow-hidden ${style.bg} ${style.border}`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {style.icon}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentPopup.title}
              </h3>
            </div>
            {currentPopup.allow_close && (
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Image */}
          {currentPopup.image_url && (
            <div className="w-full max-h-64 overflow-hidden">
              <img
                src={currentPopup.image_url}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Message */}
          <div className="p-4">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {currentPopup.message}
            </p>
          </div>

          {/* Button */}
          {currentPopup.button_text && (
            <div className="px-4 pb-4">
              <button
                onClick={handleButtonClick}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {currentPopup.button_text}
                {currentPopup.button_url && <ExternalLink className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
