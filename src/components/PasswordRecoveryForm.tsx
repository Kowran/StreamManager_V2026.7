import React, { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { LanguageSelector } from './LanguageSelector';

interface PasswordRecoveryFormProps {
  onBack: () => void;
}

export function PasswordRecoveryForm({ onBack }: PasswordRecoveryFormProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!email.includes('@')) {
        throw new Error(t.invalidEmail);
      }

      // Use Supabase native password reset
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccess(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t.passwordResetError;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-3 sm:px-4 lg:px-6 xl:px-8 transition-colors overflow-x-hidden">
      <div className="max-w-sm sm:max-w-md w-full space-y-6 sm:space-y-8">
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 z-10 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-1 sm:space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{t.backToLogin}</span>
          </button>
          <div>
            <LanguageSelector />
          </div>
        </div>

        {success ? (
          <div className="text-center">
            <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mt-4 sm:mt-6 text-center text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white">
              {t.emailSent}
            </h2>
            <p className="mt-2 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400 px-2">
              {t.checkEmailInstructions}
            </p>
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-left">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    {t.nextSteps}
                  </h3>
                  <ul className="mt-2 text-xs text-blue-700 dark:text-blue-400 space-y-1">
                    <li>1. {t.checkEmailInbox}</li>
                    <li>2. {t.clickResetLink}</li>
                    <li>3. {t.createNewPassword}</li>
                    <li>4. {t.loginWithNewPassword}</li>
                  </ul>
                </div>
              </div>
            </div>
            <button
              onClick={onBack}
              className="mt-6 w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
            >
              {t.backToLogin}
            </button>
          </div>
        ) : (
          <>
            <div>
              <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                <Key className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="mt-4 sm:mt-6 text-center text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white">
                {t.forgotPassword}
              </h2>
              <p className="mt-2 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400 px-2">
                {t.passwordResetDescription}
              </p>
            </div>

            <form className="mt-4 sm:mt-6 lg:mt-8 space-y-3 sm:space-y-4 lg:space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-md p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                    <div className="text-xs sm:text-sm text-red-700 dark:text-red-400">{error}</div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="sr-only">
                  {t.email}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-2.5 sm:py-3 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors touch-manipulation"
                    placeholder={t.enterEmailForReset}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t.sendingEmail}
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      {t.sendResetEmail}
                    </>
                  )}
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={onBack}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors touch-manipulation"
                >
                  {t.backToLogin}
                </button>
              </div>
            </form>

            {/* Security Info */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t.securityInfo}
              </h3>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• {t.resetLinkExpires}</li>
                <li>• {t.onlyValidEmail}</li>
                <li>• {t.checkSpamFolder}</li>
                <li>• {t.contactSupportIfNeeded}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}