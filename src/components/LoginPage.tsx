import React, { useState, useEffect } from 'react';
import {
  LogIn, User, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Chrome, Mail,
  Shield, ArrowRight, Sparkles, TrendingUp, Wallet, Headphones, ArrowLeft,
  HelpCircle, Gamepad2, Music, Clapperboard, Code,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { supabase } from '../lib/supabase';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

export function LoginPage({ onLoginSuccess, onBack }: LoginPageProps) {
  const { t } = useLanguage();
  const { signIn, signUp, signInWithGoogle, signInWithDiscord } = useAuth();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => lang === 'pt' ? pt : lang === 'en' ? en : es;

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!isSignUp) {
      const savedEmail = localStorage.getItem('streammanager-saved-email');
      const savedRemember = localStorage.getItem('streammanager-remember-me') === 'true';
      if (savedEmail && savedRemember) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, [isSignUp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        if (password !== confirmPassword) throw new Error(tr('As senhas não coincidem', 'Passwords do not match', 'Las contraseñas no coinciden'));
        if (password.length < 6) throw new Error(tr('Senha mínima de 6 caracteres', 'Password must be at least 6 characters', 'Contraseña mínima de 6 caracteres'));
        if (!email.includes('@')) throw new Error(tr('Email inválido', 'Invalid email', 'Email inválido'));
        if (!fullName.trim()) throw new Error(tr('Nome completo é obrigatório', 'Full name is required', 'Nombre completo es obligatorio'));

        await signUp(email, password, fullName.trim());
        alert(tr(
          'Conta criada com sucesso! Bem-vindo!',
          'Account created successfully! Welcome!',
          '¡Cuenta creada exitosamente! ¡Bienvenido!'
        ));
        onLoginSuccess();
      } else {
        if (rememberMe) {
          localStorage.setItem('streammanager-saved-email', email);
          localStorage.setItem('streammanager-remember-me', 'true');
        } else {
          localStorage.removeItem('streammanager-saved-email');
          localStorage.removeItem('streammanager-remember-me');
        }
        await signIn(email, password);
        onLoginSuccess();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : (isSignUp ? tr('Erro ao criar conta', 'Error creating account', 'Error al crear cuenta') : tr('Erro ao fazer login', 'Error signing in', 'Error al iniciar sesión'));
      if (msg.includes('User already registered')) setError(tr('Email já cadastrado', 'Email already registered', 'Email ya registrado'));
      else if (msg.includes('Invalid login credentials')) setError(tr('Credenciais inválidas', 'Invalid credentials', 'Credenciales inválidas'));
      else if (msg.includes('Email not confirmed')) setError(tr('Email não confirmado', 'Email not confirmed', 'Email no confirmado'));
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      onLoginSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : tr('Erro com Google', 'Google error', 'Error con Google'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDiscordSignIn = async () => {
    setDiscordLoading(true);
    setError('');
    try {
      await signInWithDiscord();
      onLoginSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : tr('Erro com Discord', 'Discord error', 'Error con Discord'));
    } finally {
      setDiscordLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Erro ao enviar email', 'Error sending email', 'Error al enviar email'));
    } finally {
      setResetLoading(false);
    }
  };

  const features = [
    { icon: Shield, title: tr('Compra Protegida', 'Protected Purchase', 'Compra Protegida'), desc: tr('Transações 100% seguras', '100% secure transactions', 'Transacciones 100% seguras') },
    { icon: Wallet, title: tr('Carteira Digital', 'Digital Wallet', 'Billetera Digital'), desc: tr('Recarregue e compre', 'Recharge and buy', 'Recarga y compra') },
    { icon: Headphones, title: tr('Suporte 24/7', '24/7 Support', 'Soporte 24/7'), desc: tr('Atendimento total', 'Full support', 'Atención total') },
  ];

  const categories = [
    { icon: Clapperboard, label: 'Streaming' },
    { icon: Music, label: tr('Música', 'Music', 'Música') },
    { icon: Gamepad2, label: 'Gaming' },
    { icon: Code, label: 'Software' },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50 dark:bg-gray-900">
      {/* Left panel - branding & features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-12 flex-col justify-between">
        {/* Decorative */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-10 opacity-5">
          <Sparkles className="h-40 w-40 text-white" />
        </div>

        <div className="relative">
          <button onClick={onBack} className="flex items-center gap-2 text-blue-300 hover:text-white transition-colors mb-12">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">{tr('Voltar à loja', 'Back to store', 'Volver a la tienda')}</span>
          </button>

          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            {tr('Bem-vindo à plataforma nº 1', 'Welcome to the #1 platform', 'Bienvenido a la plataforma #1')}
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-10 max-w-md">
            {tr(
              'Compre e venda produtos digitais com segurança. Milhares de clientes confiam na nossa plataforma.',
              'Buy and sell digital products safely. Thousands of customers trust our platform.',
              'Compra y vende productos digitales con seguridad. Miles de clientes confían en nuestra plataforma.'
            )}
          </p>

          {/* Features */}
          <div className="space-y-4 max-w-md">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <f.icon className="h-5 w-5 text-blue-300" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-blue-300/70 text-xs">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category icons */}
        <div className="relative flex items-center gap-6 mt-8">
          {categories.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-xl bg-white/5 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <c.icon className="h-5 w-5 text-blue-300" />
              </div>
              <span className="text-xs text-blue-300/60">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile back button */}
          <button onClick={onBack} className="lg:hidden flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">{tr('Voltar', 'Back', 'Volver')}</span>
          </button>

          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg mb-4">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {showForgotPassword
                ? tr('Recuperar Senha', 'Recover Password', 'Recuperar Contraseña')
                : isSignUp
                ? tr('Criar Conta', 'Create Account', 'Crear Cuenta')
                : tr('Entrar na Conta', 'Sign In', 'Iniciar Sesión')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {showForgotPassword
                ? tr('Enviaremos um link de recuperação para seu email', 'We will send a recovery link to your email', 'Enviaremos un enlace de recuperación a tu email')
                : isSignUp
                ? tr('Crie sua conta e comece a comprar', 'Create your account and start buying', 'Crea tu cuenta y empieza a comprar')
                : tr('Acesse sua conta para continuar', 'Access your account to continue', 'Accede a tu cuenta para continuar')}
            </p>
          </div>

          {/* Forgot password view */}
          {showForgotPassword ? (
            <div className="space-y-4">
              {resetSent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium mb-2">
                    {tr('Email enviado!', 'Email sent!', '¡Email enviado!')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {tr('Verifique sua caixa de entrada e siga as instruções.', 'Check your inbox and follow the instructions.', 'Revisa tu bandeja de entrada y sigue las instrucciones.')}
                  </p>
                  <button
                    onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail(''); }}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                  >
                    {tr('Voltar ao Login', 'Back to Login', 'Volver al Login')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{tr('Email', 'Email', 'Email')}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold transition-all disabled:opacity-50 shadow-lg"
                  >
                    {resetLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Mail className="h-5 w-5" />
                        {tr('Enviar Link', 'Send Link', 'Enviar Enlace')}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(false); setError(''); }}
                    className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {tr('Voltar ao Login', 'Back to Login', 'Volver al Login')}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <>
              {/* Social login buttons */}
              <div className="space-y-2.5 mb-5">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-all disabled:opacity-50"
                >
                  {googleLoading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      {tr('Continuar com Google', 'Continue with Google', 'Continuar con Google')}
                    </>
                  )}
                </button>
                <button
                  onClick={handleDiscordSignIn}
                  disabled={discordLoading || loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752ed] text-white font-medium transition-all disabled:opacity-50"
                >
                  {discordLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="white" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      {tr('Continuar com Discord', 'Continue with Discord', 'Continuar con Discord')}
                    </>
                  )}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{tr('OU', 'OR', 'O')}</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>

              {/* Login form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {isSignUp && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      {tr('Nome Completo', 'Full Name', 'Nombre Completo')}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        required={isSignUp}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={tr('Seu nome completo', 'Your full name', 'Tu nombre completo')}
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    {tr('Email', 'Email', 'Email')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    {tr('Senha', 'Password', 'Contraseña')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {isSignUp && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      {tr('Confirmar Senha', 'Confirm Password', 'Confirmar Contraseña')}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={isSignUp}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Remember me + forgot password */}
                {!isSignUp && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{tr('Lembrar de mim', 'Remember me', 'Recordarme')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(true); setError(''); }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {tr('Esqueceu a senha?', 'Forgot password?', '¿Olvidaste la contraseña?')}
                    </button>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || googleLoading || discordLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold transition-all disabled:opacity-50 shadow-lg hover:scale-[1.01]"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn className="h-5 w-5" />
                      {isSignUp ? tr('Criar Conta', 'Create Account', 'Crear Cuenta') : tr('Entrar', 'Sign In', 'Iniciar Sesión')}
                    </>
                  )}
                </button>
              </form>

              {/* Toggle sign up / sign in */}
              <div className="text-center mt-5">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isSignUp
                    ? tr('Já tem conta?', 'Already have an account?', '¿Ya tienes cuenta?')
                    : tr('Não tem conta?', 'Don\'t have an account?', '¿No tienes cuenta?')}{' '}
                  <button
                    onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    {isSignUp ? tr('Entrar', 'Sign In', 'Iniciar Sesión') : tr('Criar Conta', 'Create Account', 'Crear Cuenta')}
                  </button>
                </p>
              </div>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <Shield className="h-3.5 w-3.5" />
                  {tr('Seguro', 'Secure', 'Seguro')}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <HelpCircle className="h-3.5 w-3.5" />
                  {tr('Suporte 24/7', '24/7 Support', 'Soporte 24/7')}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {tr('Verificado', 'Verified', 'Verificado')}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
