import React, { useState, useEffect, useCallback } from 'react';
import {
  LogIn, User, Lock, AtSign, CheckCircle, XCircle, Loader2, ArrowLeft,
  Mail, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles, Zap, Wallet,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { LanguageSelector } from './LanguageSelector';
import { PasswordRecoveryForm } from './PasswordRecoveryForm';
import { PasswordResetForm } from './PasswordResetForm';
import { supabase } from '../lib/supabase';

interface LoginFormProps {
  onBack?: () => void;
}

function tr(pt: string, en: string, es: string, lang: string) {
  return lang === 'pt' ? pt : lang === 'en' ? en : es;
}

export function LoginForm({ onBack }: LoginFormProps = {}) {
  const { t } = useLanguage();
  const { isPasswordRecovery, setIsPasswordRecovery } = useAuth();
  const { signIn, signUp, signInWithGoogle, signInWithDiscord } = useAuth();

  const [currentView, setCurrentView] = useState<'login' | 'recovery' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [siteName, setSiteName] = useState('Rhoudz');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('streammanager-saved-email');
    const savedRemember = localStorage.getItem('streammanager-remember-me') === 'true';
    if (savedEmail && savedRemember) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: siteData } = await supabase.from('system_config').select('value').eq('key', 'site_settings').maybeSingle();
        if (siteData?.value?.site_name) setSiteName(siteData.value.site_name);
        if (siteData?.value?.header_logo_url) setLogoUrl(siteData.value.header_logo_url);
        if (!siteData?.value?.header_logo_url) {
          const { data: storeData } = await supabase.from('system_config').select('value').eq('key', 'store_config').maybeSingle();
          if (storeData?.value?.store_logo_url) setLogoUrl(storeData.value.store_logo_url);
          if (storeData?.value?.store_name && !siteData?.value?.site_name) setSiteName(storeData.value.store_name);
        }
      } catch { /* defaults are fine */ }
    })();
  }, []);

  useEffect(() => {
    if (isPasswordRecovery) { setCurrentView('reset'); return; }
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsPasswordRecovery(true);
      setCurrentView('reset');
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const emailParam = urlParams.get('email');
    if (window.location.pathname === '/reset-password' && (token || hash.includes('type=recovery'))) {
      setIsPasswordRecovery(true);
      setCurrentView('reset');
    }
  }, [isPasswordRecovery, setIsPasswordRecovery]);

  const checkUsernameAvailability = useCallback(async (value: string) => {
    const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
    if (!USERNAME_REGEX.test(value)) { setUsernameCheck('invalid'); return; }
    setUsernameCheck('checking');
    try {
      const { data } = await supabase.rpc('check_username_available', { p_username: value });
      setUsernameCheck(data ? 'available' : 'taken');
    } catch { setUsernameCheck('idle'); }
  }, []);

  useEffect(() => {
    if (!isSignUp) return;
    const trimmed = usernameInput.trim();
    if (!trimmed) { setUsernameCheck('idle'); return; }
    const timer = setTimeout(() => checkUsernameAvailability(trimmed), 500);
    return () => clearTimeout(timer);
  }, [usernameInput, isSignUp, checkUsernameAvailability]);

  if (currentView === 'recovery') {
    return <PasswordRecoveryForm onBack={() => setCurrentView('login')} />;
  }

  if (currentView === 'reset') {
    return (
      <PasswordResetForm
        onSuccess={() => {
          setIsPasswordRecovery(false);
          alert(t.passwordResetSuccess);
          setCurrentView('login');
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
        if (password !== confirmPassword) throw new Error(tr('As senhas não coincidem', 'Passwords do not match', 'Las contraseñas no coinciden', t.language));
        if (password.length < 6) throw new Error(t.passwordMinLength);
        if (!email.includes('@')) throw new Error(t.invalidEmail);
        if (!fullName.trim()) throw new Error(tr('Nome completo é obrigatório', 'Full name is required', 'Nombre completo es obligatorio', t.language));
        if (!usernameInput.trim()) throw new Error(tr('Nickname é obrigatório', 'Nickname is required', 'El apodo es obligatorio', t.language));
        if (usernameCheck !== 'available') throw new Error(tr('Escolha um nickname válido e disponível', 'Choose a valid and available nickname', 'Elige un apodo válido y disponible', t.language));

        await signUp(email, password, fullName.trim(), usernameInput.trim());
        alert(tr('Conta criada com sucesso! Faça login para continuar.', 'Account created successfully! Please login to continue.', '¡Cuenta creada exitosamente! Inicia sesión para continuar.', t.language));
        setIsSignUp(false);
        resetForm();
      } else {
        if (rememberMe) {
          localStorage.setItem('streammanager-saved-email', email);
          localStorage.setItem('streammanager-remember-me', 'true');
        } else {
          localStorage.removeItem('streammanager-saved-email');
          localStorage.removeItem('streammanager-remember-me');
        }
        await signIn(email, password);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : (isSignUp ? tr('Erro ao criar conta', 'Error creating account', 'Error al crear cuenta', t.language) : tr('Erro ao fazer login', 'Error signing in', 'Error al iniciar sesión', t.language));
      if (errorMessage.includes('User already registered')) setError(t.emailAlreadyRegistered);
      else if (errorMessage.includes('Invalid login credentials')) setError(t.incorrectCredentials);
      else if (errorMessage.includes('Email not confirmed')) setError(t.emailNotConfirmed);
      else if (errorMessage.includes('Database error')) setError(t.databaseError);
      else setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try { await signInWithGoogle(); }
    catch (err) { setError(err instanceof Error ? err.message : tr('Erro ao fazer login com Google', 'Error signing in with Google', 'Error al iniciar sesión con Google', t.language)); }
    finally { setGoogleLoading(false); }
  };

  const handleDiscordSignIn = async () => {
    setDiscordLoading(true);
    setError('');
    try { await signInWithDiscord(); }
    catch (err) { setError(err instanceof Error ? err.message : tr('Erro ao fazer login com Discord', 'Error signing in with Discord', 'Error al iniciar sesión con Discord', t.language)); }
    finally { setDiscordLoading(false); }
  };

  const resetForm = () => {
    setEmail(''); setPassword(''); setConfirmPassword(''); setFullName('');
    setUsernameInput(''); setUsernameCheck('idle'); setRememberMe(false); setError('');
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
    const savedEmail = localStorage.getItem('streammanager-saved-email');
    const savedRemember = localStorage.getItem('streammanager-remember-me') === 'true';
    if (savedEmail && savedRemember && !isSignUp) { setEmail(savedEmail); setRememberMe(true); }
  };

  const features = [
    { icon: Wallet, title: tr('Carteira Digital', 'Digital Wallet', 'Billetera Digital'), desc: tr('Recargas e pagamentos instantâneos', 'Instant top-ups and payments', 'Recargas y pagos instantáneos') },
    { icon: ShieldCheck, title: tr('Compras Seguras', 'Secure Purchases', 'Compras Seguras'), desc: tr('Proteção em todas as transações', 'Protection on every transaction', 'Protección en cada transacción') },
    { icon: Zap, title: tr('Entrega Imediata', 'Instant Delivery', 'Entrega Inmediata'), desc: tr('Receba seus produtos na hora', 'Receive your products instantly', 'Recibe tus productos al instante') },
  ];

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-950 transition-colors">
      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Decorative glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -right-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px]" />

        <div className="relative flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Brand */}
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-11 w-11 rounded-2xl object-cover shadow-lg" />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            )}
            <span className="text-xl font-bold text-white tracking-tight">{siteName}</span>
          </div>

          {/* Hero text */}
          <div className="max-w-md">
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight tracking-tight">
              {isSignUp
                ? tr('Junte-se à maior comunidade', 'Join the largest community', 'Únete a la mayor comunidad')
                : tr('Bem-vindo de volta', 'Welcome back', 'Bienvenido de vuelta')}
            </h1>
            <p className="mt-4 text-base text-slate-400 leading-relaxed">
              {isSignUp
                ? tr('Crie sua conta e acesse produtos exclusivos, recargas instantâneas e muito mais.', 'Create your account and access exclusive products, instant top-ups and more.', 'Crea tu cuenta y accede a productos exclusivos, recargas instantáneas y más.')
                : tr('Acesse sua conta e continue de onde parou. Produtos, carteira e compras em um só lugar.', 'Access your account and pick up where you left off. Products, wallet and purchases in one place.', 'Accede a tu cuenta y continúa donde lo dejaste. Productos, billetera y compras en un solo lugar.')}
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-5">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                      <Icon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{f.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-slate-500">
            {tr('Ao continuar, você concorda com nossos Termos e Política de Privacidade.', 'By continuing, you agree to our Terms and Privacy Policy.', 'Al continuar, aceptas nuestros Términos y Política de Privacidad.')}
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-5">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {tr('Voltar', 'Back', 'Volver')}
            </button>
          ) : <div />}
          <LanguageSelector />
        </div>

        {/* Form content */}
        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 pb-10">
          <div className="w-full max-w-sm">
            {/* Mobile brand */}
            <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-10 w-10 rounded-xl object-cover shadow-lg" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{siteName}</span>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-2xl sm:text-[28px] font-bold text-gray-900 dark:text-white tracking-tight">
                {isSignUp ? t.signUpTitle : t.loginTitle}
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {isSignUp
                  ? tr('Crie sua conta em menos de um minuto', 'Create your account in under a minute', 'Crea tu cuenta en menos de un minuto')
                  : tr('Entre na sua conta para continuar', 'Sign in to your account to continue', 'Inicia sesión en tu cuenta para continuar')}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60">
                <XCircle className="h-4.5 w-4.5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Social buttons */}
            <div className="space-y-3 mb-5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 text-sm font-medium text-gray-700 dark:text-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {googleLoading
                  ? tr('Conectando...', 'Connecting...', 'Conectando...')
                  : tr('Continuar com Google', 'Continue with Google', 'Continuar con Google')}
              </button>

              <button
                type="button"
                onClick={handleDiscordSignIn}
                disabled={discordLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-[#5865F2]/20"
              >
                {discordLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                )}
                {discordLoading
                  ? tr('Conectando...', 'Connecting...', 'Conectando...')
                  : tr('Continuar com Discord', 'Continue with Discord', 'Continuar con Discord')}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                {tr('ou com email', 'or with email', 'o con email')}
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <FormField icon={User} label={t.fullName}>
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="form-input"
                      placeholder={tr('Seu nome completo', 'Your full name', 'Tu nombre completo')}
                    />
                  </FormField>

                  <FormField icon={AtSign} label="Nickname">
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      required
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value.replace(/\s/g, ''))}
                      maxLength={30}
                      className="form-input pr-10 font-mono"
                      placeholder="nickname"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      {usernameCheck === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                      {usernameCheck === 'available' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                      {(usernameCheck === 'taken' || usernameCheck === 'invalid') && <XCircle className="h-4 w-4 text-red-500" />}
                    </div>
                    {usernameCheck === 'taken' && <p className="field-hint text-red-500">{tr('Este nickname já está em uso.', 'This nickname is already taken.', 'Este apodo ya está en uso.')}</p>}
                    {usernameCheck === 'invalid' && <p className="field-hint text-amber-500">{tr('3–30 chars: letras, números e _', '3–30 chars: letters, numbers and _', '3–30 chars: letras, números y _')}</p>}
                    {usernameCheck === 'available' && <p className="field-hint text-emerald-500">{tr('Disponível!', 'Available!', '¡Disponible!')}</p>}
                  </FormField>
                </>
              )}

              <FormField icon={Mail} label={t.email}>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="voce@email.com"
                />
              </FormField>

              <FormField icon={Lock} label={t.password}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </FormField>

              {isSignUp && (
                <FormField icon={Lock} label={t.confirmPassword}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input"
                    placeholder="••••••••"
                  />
                </FormField>
              )}

              {/* Remember me + forgot password */}
              {!isSignUp && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-800"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {tr('Lembrar de mim', 'Remember me', 'Recordarme')}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCurrentView('recovery')}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
                  >
                    {t.forgotPassword}
                  </button>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading
                  ? (isSignUp ? t.creatingAccount : t.signingIn)
                  : (<>{isSignUp ? t.signUp : t.login}<ArrowRight className="h-4 w-4" /></>)}
              </button>
            </form>

            {/* Toggle login/signup */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}{' '}
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {isSignUp ? tr('Entrar', 'Sign in', 'Iniciar sesión') : tr('Criar conta', 'Sign up', 'Crear cuenta')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
        {children}
      </div>
    </div>
  );
}
