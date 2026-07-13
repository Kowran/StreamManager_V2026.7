import React, { useState, useEffect, useCallback } from 'react';
import { LogIn, User, Lock, Gift, Chrome, AtSign, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { LanguageSelector } from './LanguageSelector';
import { ArrowLeft } from 'lucide-react';
import { PasswordRecoveryForm } from './PasswordRecoveryForm';
import { PasswordResetForm } from './PasswordResetForm';

interface LoginFormProps {
  onBack?: () => void;
}

export function LoginForm({ onBack }: LoginFormProps = {}) {
  const { t } = useLanguage();
  const { isPasswordRecovery, setIsPasswordRecovery } = useAuth();
  const [currentView, setCurrentView] = useState<'login' | 'recovery' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle, signInWithDiscord } = useAuth();

  // Load saved credentials on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('streammanager-saved-email');
    const savedRemember = localStorage.getItem('streammanager-remember-me') === 'true';
    
    if (savedEmail && savedRemember) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Check if we're in password reset mode
  useEffect(() => {
    // If we're in password recovery mode from AuthProvider, show reset form
    if (isPasswordRecovery) {
      setCurrentView('reset');
      return;
    }
    
    // Check URL hash for Supabase auth recovery
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsPasswordRecovery(true);
      setCurrentView('reset');
      return;
    }
    
    // Also check search params for backward compatibility
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const emailParam = urlParams.get('email');
    
    if (window.location.pathname === '/reset-password' && (token || hash.includes('type=recovery'))) {
      setIsPasswordRecovery(true);
      setCurrentView('reset');
      return;
    }
  }, [isPasswordRecovery, setIsPasswordRecovery]);

  // Handle password recovery
  if (currentView === 'recovery') {
    return (
      <PasswordRecoveryForm 
        onBack={() => setCurrentView('login')} 
      />
    );
  }

  // Handle password reset
  if (currentView === 'reset') {
    return (
      <PasswordResetForm 
        onSuccess={() => {
          setIsPasswordRecovery(false);
          alert(t.passwordResetSuccess);
          setCurrentView('login');
          // Clear URL hash
          window.location.hash = '';
        }} 
      />
    );
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error('As senhas não coincidem');
        }
        if (password.length < 6) {
          throw new Error(t.passwordMinLength);
        }
        if (!email.includes('@')) {
          throw new Error(t.invalidEmail);
        }
        if (!fullName.trim()) {
          throw new Error(t.language === 'pt' ? 'Nome completo é obrigatório' : 
                         t.language === 'en' ? 'Full name is required' : 
                         'Nombre completo es obligatorio');
        }
        if (!usernameInput.trim()) {
          throw new Error(t.language === 'pt' ? 'Nickname é obrigatório' :
                         t.language === 'en' ? 'Nickname is required' :
                         'El apodo es obligatorio');
        }
        if (usernameCheck !== 'available') {
          throw new Error(t.language === 'pt' ? 'Escolha um nickname válido e disponível' :
                         t.language === 'en' ? 'Choose a valid and available nickname' :
                         'Elige un apodo válido y disponible');
        }
        
        await signUp(email, password, fullName.trim(), usernameInput.trim().toLowerCase());
        
        // Show success message and switch to login
        alert(t.language === 'pt' ? 'Conta criada com sucesso! Faça login para continuar.' :
              t.language === 'en' ? 'Account created successfully! Please login to continue.' :
              '¡Cuenta creada exitosamente! Inicia sesión para continuar.');
        setIsSignUp(false);
        resetForm();
        
      } else {
        // Handle remember me functionality
        if (rememberMe) {
          localStorage.setItem('streammanager-saved-email', email);
          localStorage.setItem('streammanager-remember-me', 'true');
        } else {
          localStorage.removeItem('streammanager-saved-email');
          localStorage.removeItem('streammanager-remember-me');
        }
        
        await signIn(email, password);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : (isSignUp ? 'Erro ao criar conta' : 'Erro ao fazer login');
      
      // Handle specific Supabase errors
      if (errorMessage.includes('User already registered')) {
        setError(t.emailAlreadyRegistered);
      } else if (errorMessage.includes('Invalid login credentials')) {
        setError(t.incorrectCredentials);
      } else if (errorMessage.includes('Email not confirmed')) {
        setError(t.emailNotConfirmed);
      } else if (errorMessage.includes('Database error')) {
        setError(t.databaseError);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      await signInWithGoogle();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login com Google';
      setError(errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDiscordSignIn = async () => {
    setDiscordLoading(true);
    setError('');

    try {
      await signInWithDiscord();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login com Discord';
      setError(errorMessage);
    } finally {
      setDiscordLoading(false);
    }
  };

  const checkUsernameAvailability = useCallback(async (value: string) => {
    const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
    if (!USERNAME_REGEX.test(value)) { setUsernameCheck('invalid'); return; }
    setUsernameCheck('checking');
    try {
      const { supabase } = await import('../lib/supabase');
      const { data } = await supabase.rpc('check_username_available', { p_username: value });
      setUsernameCheck(data ? 'available' : 'taken');
    } catch { setUsernameCheck('idle'); }
  }, []);

  useEffect(() => {
    if (!isSignUp) return;
    const trimmed = usernameInput.trim();
    if (!trimmed) { setUsernameCheck('idle'); return; }
    const t = setTimeout(() => checkUsernameAvailability(trimmed), 500);
    return () => clearTimeout(t);
  }, [usernameInput, isSignUp, checkUsernameAvailability]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setUsernameInput('');
    setUsernameCheck('idle');
    setRememberMe(false);
    setError('');
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
    // Restore saved email if remember me was enabled
    const savedEmail = localStorage.getItem('streammanager-saved-email');
    const savedRemember = localStorage.getItem('streammanager-remember-me') === 'true';
    
    if (savedEmail && savedRemember && !isSignUp) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-3 sm:px-4 lg:px-6 xl:px-8 transition-colors overflow-x-hidden">
      <div className="max-w-sm sm:max-w-md w-full space-y-6 sm:space-y-8">
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 z-10 flex items-center justify-between">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center space-x-1 sm:space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors touch-manipulation"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">
                {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
              </span>
            </button>
          )}
          <div className={onBack ? '' : 'ml-auto'}>
            <LanguageSelector />
          </div>
        </div>
        <div>
          <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
            <LogIn className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="mt-4 sm:mt-6 text-center text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white">
            {isSignUp ? t.signUpTitle : t.loginTitle}
          </h2>
          <p className="mt-2 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400 px-2">
            {isSignUp ? 
              (t.language === 'pt' ? 'Crie sua conta e comece a gerenciar' :
               t.language === 'en' ? 'Create your account and start managing' :
               'Crea tu cuenta y comienza a gestionar') :
              (t.language === 'pt' ? 'Entre na sua conta para continuar' :
               t.language === 'en' ? 'Sign in to your account to continue' :
               'Inicia sesión en tu cuenta para continuar')
            }
          </p>
        </div>
        <form className="mt-4 sm:mt-6 lg:mt-8 space-y-3 sm:space-y-4 lg:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md p-3 bg-red-50 dark:bg-red-900/20">
              <div className="text-xs sm:text-sm text-red-700 dark:text-red-400">{error}</div>
            </div>
          )}
          
          <div className="rounded-md shadow-sm space-y-0">
            {isSignUp && (
              <>
              <div>
                <label htmlFor="fullName" className="sr-only">
                  {t.fullName}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    required={isSignUp}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-2.5 sm:py-3 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors touch-manipulation"
                    placeholder={t.fullName}
                  />
                </div>
              </div>
              {/* Username field */}
              <div>
                <label htmlFor="username" className="sr-only">Nickname</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <AtSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    required={isSignUp}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.replace(/\s/g, ''))}
                    maxLength={30}
                    className="appearance-none relative block w-full px-3 py-2.5 sm:py-3 pl-10 pr-10 border border-gray-300 dark:border-gray-600 border-t-0 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors touch-manipulation font-mono"
                    placeholder="nickname"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {usernameCheck === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    {usernameCheck === 'available' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                    {(usernameCheck === 'taken' || usernameCheck === 'invalid') && <XCircle className="h-4 w-4 text-red-500" />}
                  </div>
                </div>
                {usernameCheck === 'taken' && (
                  <p className="mt-1 text-xs text-red-500">
                    {t.language === 'pt' ? 'Este nickname já está em uso.' : t.language === 'en' ? 'This nickname is already taken.' : 'Este apodo ya está en uso.'}
                  </p>
                )}
                {usernameCheck === 'invalid' && (
                  <p className="mt-1 text-xs text-amber-500">
                    {t.language === 'pt' ? '3–30 chars: letras, números e _' : t.language === 'en' ? '3–30 chars: letters, numbers and _' : '3–30 chars: letras, números y _'}
                  </p>
                )}
                {usernameCheck === 'available' && (
                  <p className="mt-1 text-xs text-emerald-500">
                    {t.language === 'pt' ? 'Disponível!' : t.language === 'en' ? 'Available!' : '¡Disponible!'}
                  </p>
                )}
              </div>
            </>
            )}
            <div>
              <label htmlFor="email" className="sr-only">
                {t.email}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`appearance-none relative block w-full px-3 py-2.5 sm:py-3 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 ${isSignUp ? 'border-t-0' : 'rounded-t-md'} focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors touch-manipulation`}
                  placeholder={t.email}
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                {t.password}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`appearance-none relative block w-full px-3 py-2.5 sm:py-3 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 ${isSignUp ? 'border-t-0' : 'rounded-b-md'} focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors touch-manipulation`}
                  placeholder={t.password}
                />
              </div>
            </div>
            
            {isSignUp && (
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
                    type="password"
                    required={isSignUp}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-2.5 sm:py-3 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-b-md border-t-0 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors touch-manipulation"
                    placeholder={t.confirmPassword}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Remember Me Checkbox - Only show for login */}
          {!isSignUp && (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-white">
                  {t.language === 'pt' ? 'Lembrar de mim' :
                   t.language === 'en' ? 'Remember me' :
                   'Recordarme'}
                </label>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {loading ? (isSignUp ? t.creatingAccount : `${t.signingIn}`) : (isSignUp ? t.signUp : t.login)}
            </button>
          </div>
          
          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                {t.language === 'pt' ? 'ou' : t.language === 'en' ? 'or' : 'o'}
              </span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="group relative w-full flex justify-center py-2.5 sm:py-3 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-black-700 dark:text-black-300 bg-white dark:bg-white hover:bg-gray-50 dark:hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation shadow-sm"
            >
              {googleLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-600 mr-2"></div>
              ) : (
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {googleLoading ?
                (t.language === 'pt' ? 'Conectando...' : t.language === 'en' ? 'Connecting...' : 'Conectando...') :
                (t.language === 'pt' ? 'Entrar com Google' : t.language === 'en' ? 'Sign in with Google' : 'Iniciar sesión con Google')
              }
            </button>
          </div>

          {/* Discord Sign In Button */}
          <div>
            <button
              type="button"
              onClick={handleDiscordSignIn}
              disabled={discordLoading}
              className="group relative w-full flex justify-center py-2.5 sm:py-3 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-white bg-[#5865F2] hover:bg-[#4752C4] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5865F2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation shadow-sm"
            >
              {discordLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              )}
              {discordLoading ?
                (t.language === 'pt' ? 'Conectando...' : t.language === 'en' ? 'Connecting...' : 'Conectando...') :
                (t.language === 'pt' ? 'Entrar com Discord' : t.language === 'en' ? 'Sign in with Discord' : 'Iniciar sesión con Discord')
              }
            </button>
          </div>
          
          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors touch-manipulation"
            >
              {isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}
            </button>
            
            {!isSignUp && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setCurrentView('recovery')}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors touch-manipulation"
                >
                  {t.forgotPassword}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}