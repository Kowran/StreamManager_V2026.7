import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { LanguageSelector } from './LanguageSelector';

interface PasswordResetFormProps {
  onSuccess: () => void;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
  label: string;
}

export function PasswordResetForm({ onSuccess }: PasswordResetFormProps) {
  const { t } = useLanguage();
  const { setIsPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Check if we have recovery session from Supabase
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.substring(1));
    const type = urlParams.get('type');
    
    if (type === 'recovery') {
      setIsValidToken(true);
    } else {
      setError(t.invalidResetLink);
    }
  }, []);

  const getPasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push(t.passwordMinLength);
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push(t.passwordNeedsLowercase);
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push(t.passwordNeedsUppercase);
    }

    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push(t.passwordNeedsNumber);
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      feedback.push(t.passwordNeedsSpecial);
    }

    let color = 'bg-red-500';
    let label = t.passwordVeryWeak;

    if (score >= 4) {
      color = 'bg-green-500';
      label = t.passwordStrong;
    } else if (score >= 3) {
      color = 'bg-yellow-500';
      label = t.passwordMedium;
    } else if (score >= 2) {
      color = 'bg-orange-500';
      label = t.passwordWeak;
    }

    return { score, feedback, color, label };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (password !== confirmPassword) {
        throw new Error(t.passwordsDoNotMatch);
      }

      if (passwordStrength.score < 3) {
        throw new Error(t.passwordTooWeak);
      }

      // Use Supabase native password update
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw new Error(error.message);
      }

      // Success - redirect to login
      setIsPasswordRecovery(false);
      // Clear URL hash
      window.location.hash = '';
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t.passwordUpdateError;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isValidToken && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-3 sm:px-4 lg:px-6 xl:px-8 transition-colors">
        <div className="max-w-sm sm:max-w-md w-full text-center space-y-6">
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
            <LanguageSelector />
          </div>
          
          <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {t.language === 'pt' ? 'Validando Link...' : 
             t.language === 'en' ? 'Validating Link...' : 
             'Validando Enlace...'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t.language === 'pt' ? 'Verificando a validade do link de recuperação...' :
             t.language === 'en' ? 'Verifying the validity of the recovery link...' :
             'Verificando la validez del enlace de recuperación...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isValidToken && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-3 sm:px-4 lg:px-6 xl:px-8 transition-colors">
        <div className="max-w-sm sm:max-w-md w-full text-center space-y-6">
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
            <LanguageSelector />
          </div>
          
          <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {error || t.invalidResetLink}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t.resetLinkExpiredOrInvalid}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
          >
            {t.backToLogin}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-3 sm:px-4 lg:px-6 xl:px-8 transition-colors overflow-x-hidden">
      <div className="max-w-sm sm:max-w-md w-full space-y-6 sm:space-y-8">
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
          <LanguageSelector />
        </div>

        <div>
          <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
            <Key className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="mt-4 sm:mt-6 text-center text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white">
            {t.createNewPassword}
          </h2>
          <p className="mt-2 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400 px-2">
            {t.language === 'pt' ? 'Crie uma nova senha segura para sua conta' :
             t.language === 'en' ? 'Create a new secure password for your account' :
             'Crea una nueva contraseña segura para tu cuenta'}
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
            <label htmlFor="password" className="sr-only">
              {t.newPassword}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2.5 sm:py-3 pl-10 pr-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors touch-manipulation"
                placeholder={t.newPassword}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">{t.passwordStrength}:</span>
                  <span className={`text-xs font-medium ${
                    passwordStrength.score >= 4 ? 'text-green-600 dark:text-green-400' :
                    passwordStrength.score >= 3 ? 'text-yellow-600 dark:text-yellow-400' :
                    passwordStrength.score >= 2 ? 'text-orange-600 dark:text-orange-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
                {passwordStrength.feedback.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t.requirements}:</p>
                    <ul className="text-xs space-y-1">
                      {passwordStrength.feedback.map((item, index) => (
                        <li key={index} className="flex items-center text-gray-500 dark:text-gray-400">
                          <div className="w-1 h-1 bg-gray-400 rounded-full mr-2" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="sr-only">
              {t.confirmPassword}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2.5 sm:py-3 pl-10 pr-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors touch-manipulation"
                placeholder={t.confirmNewPassword}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {t.passwordsDoNotMatch}
              </p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || passwordStrength.score < 3 || password !== confirmPassword}
              className="group relative w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t.updatingPassword}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t.updatePassword}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Security Tips */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            {t.securityTips}
          </h3>
          <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <li>• {t.useMixedCharacters}</li>
            <li>• {t.avoidPersonalInfo}</li>
            <li>• {t.dontReusePasswords}</li>
            <li>• {t.usePasswordManager}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}