import React, { useState, useEffect, useRef } from 'react';
import { X, Shield, QrCode, Check, AlertCircle, Loader, KeyRound, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { generateBase32Secret, verifyTOTP, buildOtpauthUrl } from '../lib/totp';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  siteName: string;
}

export function TwoFactorSetupModal({ isOpen, onClose, onSuccess, siteName }: TwoFactorSetupModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => (lang === 'pt' ? pt : lang === 'en' ? en : es);

  const [step, setStep] = useState<'setup' | 'verify' | 'done'>('setup');
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const newSecret = generateBase32Secret(20);
    setSecret(newSecret);
    setStep('setup');
    setCode('');
    setError('');
    const url = buildOtpauthUrl(siteName, user?.email || 'user', newSecret);
    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setError(tr('Erro ao gerar QR Code', 'Error generating QR Code', 'Error al generar código QR')));
  }, [isOpen]);

  function handleVerify() {
    if (code.length !== 6) {
      setError(tr('Digite o código de 6 dígitos', 'Enter the 6-digit code', 'Ingresa el código de 6 dígitos'));
      return;
    }
    setVerifying(true);
    setError('');
    setTimeout(async () => {
      if (verifyTOTP(secret, code)) {
        try {
          const { error: saveError } = await supabase
            .from('profiles')
            .update({ two_factor_enabled: true, two_factor_secret: secret })
            .eq('id', user!.id);
          if (saveError) throw saveError;
          setStep('done');
          setTimeout(() => { onSuccess(); }, 1200);
        } catch {
          setError(tr('Erro ao salvar configuração', 'Error saving configuration', 'Error al guardar la configuración'));
        }
      } else {
        setError(tr('Código incorreto. Tente novamente.', 'Incorrect code. Try again.', 'Código incorrecto. Inténtalo de nuevo.'));
      }
      setVerifying(false);
    }, 300);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {tr('Autenticação em Duas Etapas', 'Two-Factor Authentication', 'Autenticación en Dos Pasos')}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'setup' && (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3">
                <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                  {tr(
                    'Escaneie o QR Code abaixo com um aplicativo de autenticação (Google Authenticator, Authy, etc.) e digite o código de 6 dígitos gerado.',
                    'Scan the QR Code below with an authenticator app (Google Authenticator, Authy, etc.) and enter the generated 6-digit code.',
                    'Escanea el código QR a continuación con una aplicación de autenticación (Google Authenticator, Authy, etc.) e ingresa el código de 6 dígitos generado.'
                  )}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3">
                {qrDataUrl ? (
                  <div className="p-3 bg-white rounded-xl border border-gray-200 dark:border-gray-700">
                    <img src={qrDataUrl} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl">
                    <Loader className="h-8 w-8 text-gray-400 animate-spin" />
                  </div>
                )}

                <div className="w-full">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-center">
                    {tr('Ou digite manualmente esta chave:', 'Or enter this key manually:', 'O ingresa esta clave manualmente:')}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 p-2 rounded-lg break-all text-center tracking-wider">
                      {secret}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(secret); }}
                      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors flex-shrink-0"
                      title={tr('Copiar', 'Copy', 'Copiar')}
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  {tr('Código de Verificação', 'Verification Code', 'Código de Verificación')}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  placeholder="000000"
                  className="w-full text-center text-2xl font-bold tracking-[0.5em] rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={verifying || code.length !== 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
              >
                {verifying ? <Loader className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                {tr('Ativar 2FA', 'Enable 2FA', 'Activar 2FA')}
              </button>
            </>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {tr('2FA Ativada!', '2FA Enabled!', '¡2FA Activada!')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr(
                  'Sua conta agora está protegida com autenticação em duas etapas.',
                  'Your account is now protected with two-factor authentication.',
                  'Tu cuenta ahora está protegida con autenticación en dos pasos.'
                )}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {tr(
                'Recomendamos: Google Authenticator, Microsoft Authenticator ou Authy.',
                'Recommended: Google Authenticator, Microsoft Authenticator, or Authy.',
                'Recomendado: Google Authenticator, Microsoft Authenticator o Authy.'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
