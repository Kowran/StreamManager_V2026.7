import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart3, Calendar, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useTheme } from './ThemeProvider';

interface CreatePollModalProps {
  postId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePollModal({ postId, onClose, onSuccess }: CreatePollModalProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [endsAt, setEndsAt] = useState('');
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!question.trim()) {
      setError(t.language === 'pt' ? 'Digite uma pergunta' : t.language === 'en' ? 'Enter a question' : 'Ingresa una pregunta');
      return;
    }

    const validOptions = options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      setError(t.language === 'pt' ? 'Adicione pelo menos 2 opções' : t.language === 'en' ? 'Add at least 2 options' : 'Agrega al menos 2 opciones');
      return;
    }

    setLoading(true);

    try {
      const pollData: any = {
        post_id: postId,
        question: question.trim(),
        options: validOptions,
        multiple_choice: multipleChoice
      };

      if (endsAt) {
        pollData.ends_at = new Date(endsAt).toISOString();
      }

      const { error: insertError } = await supabase
        .from('community_polls')
        .insert(pollData);

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating poll:', err);
      setError(err.message || (t.language === 'pt' ? 'Erro ao criar enquete' : t.language === 'en' ? 'Error creating poll' : 'Error al crear encuesta'));
    } finally {
      setLoading(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div
        className={`w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        <div className={`sticky top-0 px-6 py-4 border-b flex items-center justify-between ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } z-10`}>
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {t.language === 'pt' ? 'Criar Enquete' : t.language === 'en' ? 'Create Poll' : 'Crear Encuesta'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {t.language === 'pt' ? 'Pergunta' : t.language === 'en' ? 'Question' : 'Pregunta'}
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t.language === 'pt' ? 'Qual é sua opinião sobre...?' : t.language === 'en' ? 'What is your opinion about...?' : '¿Cuál es tu opinión sobre...?'}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              maxLength={200}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className={`block text-sm font-medium ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {t.language === 'pt' ? 'Opções' : t.language === 'en' ? 'Options' : 'Opciones'} ({options.length}/10)
              </label>
              <button
                type="button"
                onClick={addOption}
                disabled={options.length >= 10}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  options.length >= 10
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'bg-blue-900 text-blue-300 hover:bg-blue-800'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                }`}
              >
                <Plus className="w-4 h-4" />
                {t.language === 'pt' ? 'Adicionar' : t.language === 'en' ? 'Add' : 'Agregar'}
              </button>
            </div>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {index + 1}.
                  </span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={t.language === 'pt' ? `Opção ${index + 1}` : t.language === 'en' ? `Option ${index + 1}` : `Opción ${index + 1}`}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'hover:bg-red-900/30 text-red-400'
                          : 'hover:bg-red-50 text-red-600'
                      }`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <Calendar className="w-4 h-4 inline mr-2" />
              {t.language === 'pt' ? 'Data de Encerramento (Opcional)' : t.language === 'en' ? 'End Date (Optional)' : 'Fecha de Finalización (Opcional)'}
            </label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              min={getMinDateTime()}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            />
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={multipleChoice}
                  onChange={(e) => setMultipleChoice(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                  multipleChoice
                    ? 'bg-blue-600 border-blue-600'
                    : theme === 'dark'
                      ? 'border-gray-600 bg-gray-700'
                      : 'border-gray-300 bg-white'
                }`}>
                  {multipleChoice && <CheckSquare className="w-4 h-4 text-white" />}
                </div>
              </div>
              <span className={`text-sm font-medium ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {t.language === 'pt' ? 'Permitir múltiplas escolhas' : t.language === 'en' ? 'Allow multiple choices' : 'Permitir múltiples opciones'}
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                loading
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              } bg-blue-600 text-white hover:bg-blue-700`}
            >
              {loading
                ? (t.language === 'pt' ? 'Criando...' : t.language === 'en' ? 'Creating...' : 'Creando...')
                : (t.language === 'pt' ? 'Criar Enquete' : t.language === 'en' ? 'Create Poll' : 'Crear Encuesta')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
