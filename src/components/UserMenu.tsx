import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

function UserAvatar() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ avatar_url?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  async function loadProfile() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
    );
  }

  return (
    <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 flex-shrink-0">
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt="Avatar"
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <div className={`w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center ${profile?.avatar_url ? 'hidden' : ''}`}>
        <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 text-white" />
      </div>
    </div>
  );
}

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 sm:space-x-2 px-1.5 sm:px-2 lg:px-3 py-1.5 sm:py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors touch-manipulation"
      >
        <UserAvatar />
        <ChevronDown className="h-3 w-3 hidden lg:inline" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-44 sm:w-48 lg:w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            <div className="py-1">
              {/* Informações do usuário */}
              <div className="px-3 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t.loggedAs}</p>
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                  {user.email}
                </p>
              </div>

              {/* Logout */}
              <button
                onClick={() => {
                  handleSignOut();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs sm:text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 transition-colors touch-manipulation border-t border-gray-200 dark:border-gray-700"
              >
                <LogOut className="h-4 w-4" />
                <span>{t.logout}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}