import React, { useState, useEffect } from 'react';
import { X, LogIn, User, Lock, Eye, EyeOff, AlertCircle, Package, CheckCircle, Chrome } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduct?: any;
  onLoginSuccess: () => void;
}

export function LoginModal({ isOpen, onClose, selectedProduct, onLoginSuccess }: LoginModalProps) {
  const { t } = useLanguage();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Load saved credentials when modal opens
  useEffect(() => {
    if (isOpen && !isSignUp) {
      const savedEmail = localStorage.getItem('streammanager-saved-email');
      const savedRemember = localStorage.getItem('streammanager-remember-me') === 'true';
      
      if (savedEmail && savedRemember) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, [isOpen, isSignUp]);

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
        
        await signUp(email, password, fullName.trim());
        
        // Show success message and proceed to login
        alert(t.language === 'pt' ? 'Conta criada com sucesso! Redirecionando para a loja...' :
              t.language === 'en' ? 'Account created successfully! Redirecting to store...' :
              '¡Cuenta creada exitosamente! Redirigiendo a la tienda...');
        
        onLoginSuccess();
        onClose();
        
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
        onLoginSuccess();
        onClose();
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
      onLoginSuccess();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login com Google';
      setError(errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setRememberMe(false);
    setError('');
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
    
    // Restore saved email if remember me was enabled and switching to login
    if (!isSignUp) {
      const savedEmail = localStorage.getItem('streammanager-saved-email');
      const savedRemember = localStorage.getItem('streammanager-remember-me') === 'true';
      
      if (savedEmail && savedRemember) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
              <LogIn className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isSignUp ? 
                (t.language === 'pt' ? 'Criar Conta' : t.language === 'en' ? 'Create Account' : 'Crear Cuenta') :
                (t.language === 'pt' ? 'Fazer Login' : t.language === 'en' ? 'Sign In' : 'Iniciar Sesión')
              }
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Selected Product Info */}
        {selectedProduct && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {selectedProduct.image ? (
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="h-12 w-12 rounded-lg object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center ${selectedProduct.image ? 'hidden' : ''}`}>
                  <Package className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  {t.language === 'pt' ? 'Produto Selecionado:' :
                   t.language === 'en' ? 'Selected Product:' :
                   'Producto Seleccionado:'}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 truncate">
                  {selectedProduct.name}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500">
                  {selectedProduct.price}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isSignUp ? 
                (t.language === 'pt' ? 'Crie sua conta para acessar nossos produtos premium' :
                 t.language === 'en' ? 'Create your account to access our premium products' :
                 'Crea tu cuenta para acceder a nuestros productos premium') :
                (t.language === 'pt' ? 'Entre na sua conta para continuar' :
                 t.language === 'en' ? 'Sign in to your account to continue' :
                 'Inicia sesión en tu cuenta para continuar')
              }
            </p>
          </div>

          {/* Remember Me Checkbox - Only show for login */}
          {!isSignUp && (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me-modal"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                />
                <label htmlFor="remember-me-modal" className="ml-2 block text-sm text-gray-900 dark:text-white">
                  {t.language === 'pt' ? 'Lembrar de mim' :
                   t.language === 'en' ? 'Remember me' :
                   'Recordarme'}
                </label>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                  <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {isSignUp && (
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
                      className="appearance-none relative block w-full px-3 py-3 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors"
                      placeholder={t.fullName}
                    />
                  </div>
                </div>
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
                    className="appearance-none relative block w-full px-3 py-3 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors"
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
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none relative block w-full px-3 py-3 pl-10 pr-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors"
                    placeholder={t.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
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
                      className="appearance-none relative block w-full px-3 py-3 pl-10 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-sm transition-colors"
                      placeholder={t.confirmPassword}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:scale-100"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isSignUp ? t.creatingAccount : `${t.signingIn}...`}
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    {isSignUp ? 
                      (t.language === 'pt' ? 'Criar Conta e Acessar' : t.language === 'en' ? 'Create Account & Access' : 'Crear Cuenta y Acceder') :
                      (t.language === 'pt' ? 'Entrar e Acessar' : t.language === 'en' ? 'Sign In & Access' : 'Iniciar Sesión y Acceder')
                    }
                  </>
                )}
              </button>
            </div>
            
            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
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
                className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-700 bg-white dark:bg-white hover:bg-gray-50 dark:hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:scale-100 shadow-sm"
              >
                {googleLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-600 mr-2"></div>
                    {t.language === 'pt' ? 'Conectando...' : t.language === 'en' ? 'Connecting...' : 'Conectando...'}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {t.language === 'pt' ? 'Entrar com Google' : t.language === 'en' ? 'Sign in with Google' : 'Iniciar sesión con Google'}
                  </>
                )}
              </button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
              >
                {isSignUp ? 
                  (t.language === 'pt' ? 'Já tem uma conta? Fazer login' :
                   t.language === 'en' ? 'Already have an account? Sign in' :
                   '¿Ya tienes una cuenta? Iniciar sesión') :
                  (t.language === 'pt' ? 'Não tem uma conta? Criar conta' :
                   t.language === 'en' ? 'Don\'t have an account? Create account' :
                   '¿No tienes una cuenta? Crear cuenta')
                }
              </button>
            </div>
          </form>

          {/* Benefits */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {t.language === 'pt' ? 'Ao criar sua conta, você terá acesso a:' :
               t.language === 'en' ? 'By creating your account, you\'ll have access to:' :
               'Al crear tu cuenta, tendrás acceso a:'}
            </h4>
            <div className="space-y-2">
              {[
                t.language === 'pt' ? 'Loja completa de produtos premium' :
                t.language === 'en' ? 'Complete store of premium products' :
                'Tienda completa de productos premium',
                
                t.language === 'pt' ? 'Sistema de créditos e pagamentos' :
                t.language === 'en' ? 'Credits and payment system' :
                'Sistema de créditos y pagos',
                
                t.language === 'pt' ? 'Gerenciador de contas de streaming' :
                t.language === 'en' ? 'Streaming accounts manager' :
                'Gestor de cuentas de streaming',
                
                t.language === 'pt' ? 'Suporte técnico especializado' :
                t.language === 'en' ? 'Specialized technical support' :
                'Soporte técnico especializado'
              ].map((benefit, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="bg-green-100 dark:bg-green-900/20 p-0.5 rounded-full">
                    <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}