import React, { useState, useEffect } from 'react';
import { Shield, AlertCircle, Home } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-5 mb-5">
          <AlertCircle className="h-14 w-14 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
          {language === 'pt' ? 'Página não encontrada' : language === 'en' ? 'Page not found' : 'Página no encontrada'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
          {language === 'pt'
            ? 'A página que você tentou acessar não existe ou não está disponível.'
            : language === 'en'
            ? 'The page you tried to access does not exist or is not available.'
            : 'La página que intentaste acceder no existe o no está disponible.'}
        </p>
        <button
          onClick={() => {
            window.location.href = window.location.origin;
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
        >
          <Home className="h-5 w-5" />
          <span>
            {language === 'pt' ? 'Voltar para a página inicial' : language === 'en' ? 'Back to home page' : 'Volver a la página de inicio'}
          </span>
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
