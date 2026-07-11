import React, { useState, useEffect } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface AdminGuardProps {
  children: React.ReactNode;
  page?: string;
}

export function AdminGuard({ children, page }: AdminGuardProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    checkAdminAccess();
  }, [user, page]);

  async function checkAdminAccess() {
    if (!user) {
      setStatus('denied');
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (error || profile?.role !== 'admin') {
        setStatus('denied');
        return;
      }

      // No specific page guard — just check role
      if (!page) {
        setStatus('allowed');
        return;
      }

      // Check granular permissions
      const { data: perms } = await supabase
        .from('admin_permissions')
        .select('pages, is_super_admin')
        .eq('admin_user_id', user.id)
        .maybeSingle();

      // No permissions row = super admin (backward compat for the first admin)
      if (!perms) {
        setStatus('allowed');
        return;
      }

      if (perms.is_super_admin || perms.pages.includes(page)) {
        setStatus('allowed');
      } else {
        setStatus('denied');
      }
    } catch {
      setStatus('denied');
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-full p-4 mb-4">
          <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {language === 'pt' ? 'Acesso Negado' : language === 'en' ? 'Access Denied' : 'Acceso Denegado'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
          {language === 'pt'
            ? 'Você não tem permissão para acessar esta área.'
            : language === 'en'
            ? 'You do not have permission to access this area.'
            : 'No tiene permiso para acceder a esta área.'}
        </p>
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <Shield className="h-4 w-4" />
          <span>
            {language === 'pt' ? 'Área Restrita' : language === 'en' ? 'Restricted Area' : 'Área Restringida'}
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
