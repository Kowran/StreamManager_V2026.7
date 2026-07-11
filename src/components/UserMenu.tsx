import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, User, ChevronDown, Wallet, DollarSign, Coins } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface UserMenuProps {
  onNavigate?: (tab: string) => void;
}

function UserAvatar() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ avatar_url?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

export function UserMenu({ onNavigate }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [creditBalance, setCreditBalance] = useState(0);

  useEffect(() => {
    if (user) {
      loadBalances();
    }
  }, [user, isOpen]);

  async function loadBalances() {
    if (!user) return;
    try {
      const { data: creditData } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      setCreditBalance(creditData?.balance || 0);

      const { data: smData } = await supabase
        .from('user_sm_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      setCashbackBalance(smData?.balance || 0);
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  function handleNavigate(tab: string) {
    onNavigate?.(tab);
    setIsOpen(false);
  }

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
          <div className="absolute right-0 mt-2 w-56 sm:w-64 lg:w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
            {/* User info */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t.loggedAs}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.email}
              </p>
            </div>

            {/* Balance summary */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Wallet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {t.language === 'pt' ? 'Créditos' : t.language === 'en' ? 'Credits' : 'Créditos'}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  ${creditBalance.toFixed(2)}
                </span>
              </div>
              {cashbackBalance > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Coins className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {t.language === 'pt' ? 'Cashback' : t.language === 'en' ? 'Cashback' : 'Cashback'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    ${cashbackBalance.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Navigation items */}
            <div className="py-1">
              <button
                onClick={() => handleNavigate('profile')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
              >
                <User className="h-4 w-4 text-gray-400" />
                <span>{t.language === 'pt' ? 'Meu Perfil' : t.language === 'en' ? 'My Profile' : 'Mi Perfil'}</span>
              </button>
              <button
                onClick={() => handleNavigate('credits')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
              >
                <DollarSign className="h-4 w-4 text-gray-400" />
                <span>{t.myCredits}</span>
              </button>
            </div>

            {/* Logout */}
            <button
              onClick={() => {
                handleSignOut();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors border-t border-gray-200 dark:border-gray-700"
            >
              <LogOut className="h-4 w-4" />
              <span>{t.logout}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
