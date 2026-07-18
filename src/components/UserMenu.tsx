import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  LogOut, User, ChevronDown, Wallet, DollarSign, Coins, HelpCircle,
  Settings, ChevronRight, ChevronLeft, Moon, Sun, Package, X,
  ShoppingBag, Mail, Shield
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useTheme } from './ThemeProvider';
import { LevelBadge } from './LevelBadge';
import { CurrencySelector } from './CurrencySelector';
import { LanguageSelector } from './LanguageSelector';

interface UserMenuProps {
  onNavigate?: (tab: string) => void;
  isAdmin?: boolean;
  isSeller?: boolean;
}

function UserAvatar() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ avatar_url?: string; full_name?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="w-7 h-7 lg:w-8 lg:h-8 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse" />;
  }

  return (
    <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 flex-shrink-0">
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt="Avatar"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <div className={`w-full h-full bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center ${profile?.avatar_url ? 'hidden' : ''}`}>
        <User className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-white" />
      </div>
    </div>
  );
}

export function UserMenu({ onNavigate, isAdmin, isSeller }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [creditBalance, setCreditBalance] = useState(0);
  const [profile, setProfile] = useState<{ avatar_url?: string; user_level?: number; full_name?: string; username?: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadBalances();
      loadProfile();
    }
  }, [user, isOpen]);

  async function loadProfile() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, user_level, full_name, username')
        .eq('id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch { /* ignore */ }
  }

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
    } catch { /* ignore */ }
  }

  function handleNavigate(tab: string) {
    onNavigate?.(tab);
    setIsOpen(false);
    setShowSettings(false);
  }

  function handleClose() {
    setIsOpen(false);
    setShowSettings(false);
  }

  if (!user) return null;

  const lbl = (pt: string, en: string, es: string) =>
    t.language === 'pt' ? pt : t.language === 'en' ? en : es;

  return (
    <div className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); setShowSettings(false); }}
        className="flex items-center space-x-1.5 px-1.5 sm:px-2 lg:px-3 py-1.5 sm:py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors touch-manipulation"
      >
        <UserAvatar />
        <ChevronDown className="h-3 w-3 hidden lg:inline" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={handleClose} />

          <div className={`absolute right-0 mt-2 w-64 lg:w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-20 ${showSettings ? 'overflow-visible' : 'overflow-hidden'}`}>

            {/* Settings panel (slides over main) */}
            {showSettings ? (
              <div>
                {/* Settings header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {lbl('Configurações', 'Settings', 'Configuración')}
                  </span>
                </div>

                <div className="p-3 space-y-1">
                  {/* Theme */}
                  <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {lbl('Aparência', 'Appearance', 'Apariencia')}
                  </p>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'light'
                        ? <Moon className="h-4 w-4 text-gray-400" />
                        : <Sun className="h-4 w-4 text-amber-400" />
                      }
                      <span>
                        {theme === 'light'
                          ? lbl('Modo Escuro', 'Dark Mode', 'Modo Oscuro')
                          : lbl('Modo Claro', 'Light Mode', 'Modo Claro')
                        }
                      </span>
                    </div>
                    <div className={`w-8 h-4 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform shadow-sm ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </button>

                  {/* Currency */}
                  <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {lbl('Moeda', 'Currency', 'Moneda')}
                  </p>
                  <div className="px-1">
                    <CurrencySelector />
                  </div>

                  {/* Language */}
                  <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {lbl('Idioma', 'Language', 'Idioma')}
                  </p>
                  <div className="px-1">
                    <LanguageSelector />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t.loggedAs}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {profile?.full_name || user.email}
                  </p>
                  {profile?.user_level != null && (
                    <div className="mt-1">
                      <LevelBadge level={profile.user_level} type="user" size="xs" showLabel />
                    </div>
                  )}
                </div>

                {/* Balance summary */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Wallet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {lbl('Créditos', 'Credits', 'Créditos')}
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
                        <span className="text-xs text-gray-600 dark:text-gray-400">Cashback</span>
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
                    onClick={() => {
                      const ident = profile?.username || user.id;
                      window.history.pushState(null, '', `/user/${ident}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                      handleClose();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    <span>{lbl('Meu Perfil', 'My Profile', 'Mi Perfil')}</span>
                  </button>

                  <button
                    onClick={() => handleNavigate('purchases')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                  >
                    <Package className="h-4 w-4 text-gray-400" />
                    <span>{lbl('Minhas Compras', 'My Purchases', 'Mis Compras')}</span>
                  </button>

                  <button
                    onClick={() => handleNavigate('credits')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                  >
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span>{t.myCredits}</span>
                  </button>

                  <button
                    onClick={() => handleNavigate('support')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                  >
                    <HelpCircle className="h-4 w-4 text-gray-400" />
                    <span>{lbl('Ajuda', 'Help', 'Ayuda')}</span>
                  </button>

                  {/* Seller section */}
                  {isSeller && (
                    <button
                      onClick={() => handleNavigate('seller-store')}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                    >
                      <ShoppingBag className="h-4 w-4 text-gray-400" />
                      <span>{lbl('Minha Loja', 'My Store', 'Mi Tienda')}</span>
                    </button>
                  )}

                  {/* Admin section */}
                  {isAdmin && (
                    <>
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {lbl('Administração', 'Administration', 'Administración')}
                      </p>
                      <button
                        onClick={() => handleNavigate('netflix-finder')}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                      >
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{lbl('Código Netflix', 'Netflix Code', 'Código Netflix')}</span>
                      </button>
                      <button
                        onClick={() => handleNavigate('admin-dashboard')}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                      >
                        <Shield className="h-4 w-4 text-gray-400" />
                        <span>{lbl('Painel Admin', 'Admin Panel', 'Panel Admin')}</span>
                      </button>
                    </>
                  )}

                  {/* Settings row */}
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="h-4 w-4 text-gray-400" />
                      <span>{lbl('Configurações', 'Settings', 'Configuración')}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>

                {/* Logout */}
                <button
                  onClick={() => { signOut(); handleClose(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors border-t border-gray-200 dark:border-gray-700"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t.logout}</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
