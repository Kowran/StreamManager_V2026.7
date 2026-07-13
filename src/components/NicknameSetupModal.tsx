import React, { useState, useEffect, useCallback } from 'react';
import { AtSign, CheckCircle, XCircle, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface NicknameSetupModalProps {
  userId: string;
  onComplete: (username: string) => void;
}

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export function NicknameSetupModal({ userId, onComplete }: NicknameSetupModalProps) {
  const { t } = useLanguage();
  const lang = t.language;

  const [username, setUsername] = useState('');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tr = (pt: string, en: string, es: string) =>
    lang === 'en' ? en : lang === 'es' ? es : pt;

  const checkAvailability = useCallback(async (value: string) => {
    if (!USERNAME_REGEX.test(value)) {
      setCheckState('invalid');
      return;
    }
    setCheckState('checking');
    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        p_username: value,
        p_user_id: userId,
      });
      if (error) throw error;
      setCheckState(data ? 'available' : 'taken');
    } catch {
      setCheckState('idle');
    }
  }, [userId]);

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) { setCheckState('idle'); return; }
    const timer = setTimeout(() => checkAvailability(trimmed), 500);
    return () => clearTimeout(timer);
  }, [username, checkAvailability]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (checkState !== 'available') return;
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: trimmed.toLowerCase() })
        .eq('id', userId);
      if (updateError) throw updateError;
      onComplete(trimmed.toLowerCase());
    } catch (err) {
      setError(tr('Erro ao salvar nickname. Tente novamente.', 'Error saving nickname. Please try again.', 'Error al guardar el apodo. Intenta de nuevo.'));
    } finally {
      setSaving(false);
    }
  }

  const statusIcon = () => {
    if (!username.trim()) return null;
    if (checkState === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    if (checkState === 'available') return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (checkState === 'taken') return <XCircle className="h-4 w-4 text-red-500" />;
    if (checkState === 'invalid') return <XCircle className="h-4 w-4 text-red-400" />;
    return null;
  };

  const statusMsg = () => {
    if (checkState === 'available') return { text: tr('Disponível!', 'Available!', '¡Disponible!'), color: 'text-emerald-500' };
    if (checkState === 'taken') return { text: tr('Já está em uso.', 'Already taken.', 'Ya está en uso.'), color: 'text-red-500' };
    if (checkState === 'invalid') return {
      text: tr('3–30 caracteres: letras, números e _', '3–30 chars: letters, numbers and _', '3–30 chars: letras, números y _'),
      color: 'text-amber-500'
    };
    return null;
  };

  const msg = statusMsg();
  const canSubmit = checkState === 'available' && !saving;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-8 pt-8 pb-10 text-white relative">
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center shadow-lg">
            <AtSign className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="h-5 w-5 opacity-80" />
            <span className="text-sm font-medium opacity-80 uppercase tracking-wide">
              {tr('Bem-vindo!', 'Welcome!', '¡Bienvenido!')}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight">
            {tr('Escolha seu nickname', 'Choose your nickname', 'Elige tu apodo')}
          </h1>
          <p className="mt-1 text-sm opacity-75">
            {tr(
              'Seu identificador único na plataforma.',
              'Your unique identifier on the platform.',
              'Tu identificador único en la plataforma.'
            )}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-8 pt-10 pb-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              {tr('Nickname', 'Nickname', 'Apodo')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm select-none">@</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder={tr('seunickname', 'yournickname', 'tuapodo')}
                maxLength={30}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="w-full pl-8 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {statusIcon()}
              </span>
            </div>

            {/* Status message */}
            <div className="mt-1.5 min-h-[18px]">
              {msg && (
                <p className={`text-xs font-medium ${msg.color}`}>{msg.text}</p>
              )}
            </div>
          </div>

          {/* Rules */}
          <ul className="space-y-1.5">
            {[
              tr('Entre 3 e 30 caracteres', 'Between 3 and 30 characters', 'Entre 3 y 30 caracteres'),
              tr('Apenas letras, números e underline (_)', 'Only letters, numbers and underscores (_)', 'Solo letras, números y guion bajo (_)'),
              tr('Único — nenhum outro usuário pode usar o mesmo', 'Unique — no other user can use the same', 'Único — ningún otro usuario puede usar el mismo'),
              tr('Não pode ser alterado depois*', 'Cannot be changed later*', 'No se puede cambiar después*'),
            ].map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="mt-0.5 w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                {rule}
              </li>
            ))}
          </ul>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              canSubmit
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr('Salvando...', 'Saving...', 'Guardando...')}
              </span>
            ) : (
              tr('Confirmar nickname', 'Confirm nickname', 'Confirmar apodo')
            )}
          </button>

          <p className="text-center text-xs text-gray-400 dark:text-gray-600">
            * {tr(
              'Entre em contato com o suporte para solicitar alteração.',
              'Contact support to request a change.',
              'Contacta soporte para solicitar un cambio.'
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
