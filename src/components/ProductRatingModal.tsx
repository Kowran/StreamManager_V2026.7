import React, { useState } from 'react';
import { X, Star, Send, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface ProductRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onRatingSubmitted: () => void;
  force?: boolean;
}

interface RatingOption {
  stars: number;
  label: string;
  comment: string;
  color: string;
}

export function ProductRatingModal({ 
  isOpen, 
  onClose, 
  productId, 
  productName, 
  onRatingSubmitted,
  force = false
}: ProductRatingModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [customComment, setCustomComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const ratingOptions: RatingOption[] = [
    {
      stars: 1,
      label: t.language === 'pt' ? 'Muito Ruim' : t.language === 'en' ? 'Very Bad' : 'Muy Malo',
      comment: t.language === 'pt' 
        ? 'Produto não funcionou conforme esperado. Credenciais inválidas ou serviço indisponível.'
        : t.language === 'en'
        ? 'Product did not work as expected. Invalid credentials or service unavailable.'
        : 'El producto no funcionó como se esperaba. Credenciales inválidas o servicio no disponible.',
      color: 'text-red-500'
    },
    {
      stars: 2,
      label: t.language === 'pt' ? 'Ruim' : t.language === 'en' ? 'Bad' : 'Malo',
      comment: t.language === 'pt'
        ? 'Produto com problemas. Funcionou parcialmente, mas teve algumas dificuldades.'
        : t.language === 'en'
        ? 'Product with issues. Worked partially, but had some difficulties.'
        : 'Producto con problemas. Funcionó parcialmente, pero tuvo algunas dificultades.',
      color: 'text-orange-500'
    },
    {
      stars: 3,
      label: t.language === 'pt' ? 'Regular' : t.language === 'en' ? 'Average' : 'Regular',
      comment: t.language === 'pt'
        ? 'Produto funcionou conforme esperado. Atendeu às necessidades básicas.'
        : t.language === 'en'
        ? 'Product worked as expected. Met basic needs.'
        : 'El producto funcionó como se esperaba. Cumplió con las necesidades básicas.',
      color: 'text-yellow-500'
    },
    {
      stars: 4,
      label: t.language === 'pt' ? 'Bom' : t.language === 'en' ? 'Good' : 'Bueno',
      comment: t.language === 'pt'
        ? 'Produto muito bom! Funcionou perfeitamente e superou as expectativas.'
        : t.language === 'en'
        ? 'Very good product! Worked perfectly and exceeded expectations.'
        : '¡Muy buen producto! Funcionó perfectamente y superó las expectativas.',
      color: 'text-blue-500'
    },
    {
      stars: 5,
      label: t.language === 'pt' ? 'Excelente' : t.language === 'en' ? 'Excellent' : 'Excelente',
      comment: t.language === 'pt'
        ? 'Produto excelente! Qualidade premium, entrega rápida e funcionamento perfeito. Recomendo!'
        : t.language === 'en'
        ? 'Excellent product! Premium quality, fast delivery and perfect functionality. Highly recommended!'
        : '¡Producto excelente! Calidad premium, entrega rápida y funcionamiento perfecto. ¡Recomendado!',
      color: 'text-green-500'
    }
  ];

  async function handleSubmitRating() {
    if (!user || !selectedRating) return;

    setSubmitting(true);
    setError('');

    try {
      const selectedOption = ratingOptions.find(option => option.stars === selectedRating);
      const finalComment = customComment.trim() || selectedOption?.comment || '';

      const { error } = await supabase
        .from('product_ratings')
        .insert({
          user_id: user.id,
          product_id: productId,
          rating: selectedRating,
          comment: finalComment
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error(
            t.language === 'pt' 
              ? 'Você já avaliou este produto. Cada produto pode ser avaliado apenas uma vez.'
              : t.language === 'en'
              ? 'You have already rated this product. Each product can only be rated once.'
              : 'Ya has calificado este producto. Cada producto solo puede ser calificado una vez.'
          );
        }
        throw error;
      }

      setSuccess(true);
      setTimeout(() => {
        onRatingSubmitted();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error submitting rating:', error);
      setError(error instanceof Error ? error.message : 'Erro ao enviar avaliação');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRatingSelect(rating: number) {
    setSelectedRating(rating);
    const selectedOption = ratingOptions.find(option => option.stars === rating);
    if (selectedOption && !customComment.trim()) {
      setCustomComment(selectedOption.comment);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 ${force ? 'backdrop-blur-sm' : ''}`}>
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-100 dark:bg-yellow-900/20 p-2 rounded-lg">
              <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Avaliar Produto' :
               t.language === 'en' ? 'Rate Product' :
               'Calificar Producto'}
            </h3>
          </div>
          {!force && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t.language === 'pt' ? 'Avaliação Enviada!' :
               t.language === 'en' ? 'Rating Submitted!' :
               '¡Calificación Enviada!'}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t.language === 'pt' ? 'Obrigado pelo seu feedback! Sua avaliação ajuda outros usuários.' :
               t.language === 'en' ? 'Thank you for your feedback! Your rating helps other users.' :
               '¡Gracias por tu comentario! Tu calificación ayuda a otros usuarios.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Product Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">
                {productName}
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {t.language === 'pt' ? 'Como foi sua experiência com este produto?' :
                 t.language === 'en' ? 'How was your experience with this product?' :
                 '¿Cómo fue tu experiencia con este producto?'}
              </p>
              {force && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
                  {t.language === 'pt' ? '⚠ Você precisa avaliar este produto antes de fazer uma nova compra.' :
                   t.language === 'en' ? '⚠ You must rate this product before making a new purchase.' :
                   '⚠ Debes calificar este producto antes de hacer una nueva compra.'}
                </p>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                </div>
              </div>
            )}

            {/* Rating Selection */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t.language === 'pt' ? 'Sua Avaliação' :
                 t.language === 'en' ? 'Your Rating' :
                 'Tu Calificación'}
              </h4>
              
              <div className="space-y-3">
                {ratingOptions.map((option) => (
                  <button
                    key={option.stars}
                    onClick={() => handleRatingSelect(option.stars)}
                    className={`w-full p-4 border-2 rounded-lg text-left transition-all duration-200 hover:scale-105 ${
                      selectedRating === option.stars
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`h-5 w-5 ${
                                i < option.stars
                                  ? `${option.color} fill-current`
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                        <span className={`font-semibold ${option.color}`}>
                          {option.label}
                        </span>
                      </div>
                      {selectedRating === option.stars && (
                        <div className="bg-blue-600 text-white p-1 rounded-full">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {option.comment}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Comment */}
            {selectedRating > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.language === 'pt' ? 'Comentário Personalizado (Opcional)' :
                   t.language === 'en' ? 'Custom Comment (Optional)' :
                   'Comentario Personalizado (Opcional)'}
                </label>
                <textarea
                  rows={4}
                  value={customComment}
                  onChange={(e) => setCustomComment(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder={
                    t.language === 'pt' 
                      ? 'Deixe um comentário personalizado sobre sua experiência...'
                      : t.language === 'en'
                      ? 'Leave a custom comment about your experience...'
                      : 'Deja un comentario personalizado sobre tu experiencia...'
                  }
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t.language === 'pt' ? 'Deixe em branco para usar o comentário padrão da avaliação selecionada' :
                   t.language === 'en' ? 'Leave blank to use the default comment for the selected rating' :
                   'Deja en blanco para usar el comentario predeterminado de la calificación seleccionada'}
                </p>
              </div>
            )}

            {/* Preview */}
            {selectedRating > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  {t.language === 'pt' ? 'Prévia da Avaliação' :
                   t.language === 'en' ? 'Rating Preview' :
                   'Vista Previa de la Calificación'}
                </h4>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < selectedRating
                            ? 'text-yellow-500 fill-current'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {ratingOptions.find(r => r.stars === selectedRating)?.label}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded border">
                  {customComment.trim() || ratingOptions.find(r => r.stars === selectedRating)?.comment}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                onClick={handleSubmitRating}
                disabled={!selectedRating || submitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                    {t.language === 'pt' ? 'Enviando...' : t.language === 'en' ? 'Submitting...' : 'Enviando...'}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {t.language === 'pt' ? 'Enviar Avaliação' :
                     t.language === 'en' ? 'Submit Rating' :
                     'Enviar Calificación'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}