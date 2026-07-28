import React, { useState } from 'react';
import { Mail, Eye, EyeOff, Search, RefreshCw, AlertCircle, CheckCircle, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

interface EmailCheckResult {
  success: boolean;
  latest_email?: {
    subject: string;
    from: string;
    date: string;
    body_preview: string;
    full_body?: string;
    login_code?: string;
  };
  error?: string;
}

export function NetflixEmailFinder() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<EmailCheckResult | null>(null);

  async function handleEmailCheck() {
    if (!email || !password) {
      alert('Por favor, preencha o email e a senha');
      return;
    }

    setChecking(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-netflix-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const checkResult = await response.json();

      if (!response.ok) {
        throw new Error(checkResult.error || 'Erro ao verificar email');
      }

      setResult(checkResult);

    } catch (error) {
      console.error('Error checking email:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao verificar email'
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-red-600 p-3 rounded-lg">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Localizador de Código Netflix
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Busque códigos de login da Netflix no seu email
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email da Conta
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-red-500 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 px-4 py-3"
              placeholder="seuemail@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Senha da Conta de Email
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pr-12 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-red-500 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 px-4 py-3"
                placeholder="Senha do email"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleEmailCheck}
            disabled={checking || !email || !password}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-sm"
          >
            {checking ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Procurando código...</span>
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                <span>Buscar Código Netflix</span>
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Resultado da Busca
            </h3>
            <div className="flex items-center space-x-2">
              {result.success ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>

          {result.success && result.latest_email ? (
            <div className="space-y-4">
              {result.latest_email.login_code && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-500 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <Key className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <h4 className="text-lg font-bold text-green-800 dark:text-green-300">
                      Código de Login Encontrado!
                    </h4>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-green-400">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Seu código é:</p>
                    <p className="text-4xl font-mono font-bold text-green-600 dark:text-green-400 tracking-wider text-center">
                      {result.latest_email.login_code}
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Detalhes do Email
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      De:
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {result.latest_email.from}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Assunto:
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">
                      {result.latest_email.subject}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Data:
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(result.latest_email.date).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Prévia:
                    </label>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {result.latest_email.body_preview}
                    </p>
                  </div>
                </div>
              </div>

              {result.latest_email.full_body && (
                <details className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Ver Conteúdo Completo do Email
                  </summary>
                  <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div
                      className="text-sm"
                      dangerouslySetInnerHTML={{ __html: result.latest_email.full_body }}
                    />
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                    Erro na Busca
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {result.error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">
          Como Usar
        </h3>
        <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-2 list-decimal list-inside">
          <li>Digite o email onde você recebe notificações da Netflix</li>
          <li>Digite a senha da sua conta de email</li>
          <li>Clique em "Buscar Código Netflix"</li>
          <li>O sistema procurará o email mais recente da Netflix com código de login</li>
        </ol>

        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
            Informações Importantes
          </h4>
          <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
            <li>• Use apenas suas próprias contas de email</li>
            <li>• Funciona com Gmail, Outlook, Yahoo e outros provedores IMAP</li>
            <li>• As credenciais não são armazenadas permanentemente</li>
            <li>• O sistema busca apenas emails recentes da Netflix</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
