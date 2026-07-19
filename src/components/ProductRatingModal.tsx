import React, { useState } from 'react';
import { X, Star, Send, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface ProductRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  orderId?: string;
  onRatingSubmitted: () => void;
  force?: boolean;
}

export function ProductRatingModal({
  isOpen,
  onClose,
  productId,
  productName,
  orderId,
  onRatingSubmitted,
  force = false
}: ProductRatingModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const labels: Record<number, { pt: string; en: string; es: string }> = {
    1: { pt: 'Muito ruim', en: 'Very bad', es: 'Muy malo' },
    2: { pt: 'Ruim', en: 'Bad', es: 'Malo' },
    3: { pt: 'Regular', en: 'Average', es: 'Regular' },
    4: { pt: 'Bom', en: 'Good', es: 'Bueno' },
    5: { pt: 'Excelente', en: 'Excellent', es: 'Excelente' },
  };

  function getLabel(stars: number) {
    const lang = t.language as 'pt' | 'en' | 'es';
    return labels[stars]?.[lang] || '';
  }

  async function handleSubmit() {
    if (!user || !rating) return;
    setSubmitting(true);
    setError('');
    try {
      // Prevent duplicate: check if already rated this order
      if (orderId) {
        const { data: existing } = await supabase
          .from('product_ratings')
          .select('id')
          .eq('user_id', user.id)
          .eq('order_id', orderId)
          .limit(1);

        if (existing && existing.length > 0) {
          // Already rated — mark order and close
          await supabase
            .from('store_orders')
            .update({ has_rated: true })
            .eq('id', orderId);
          setSuccess(true);
          setTimeout(() => {
            onRatingSubmitted();
            onClose();
            setRating(0);
            setComment('');
            setSuccess(false);
          }, 1200);
          return;
        }
      }

      const { error } = await supabase
        .from('product_ratings')
        .insert({
          user_id: user.id,
          product_id: productId,
          order_id: orderId || null,
          rating,
          comment: comment.trim() || null,
        });

      if (error) throw error;

      if (orderId) {
        await supabase
          .from('store_orders')
          .update({ has_rated: true })
          .eq('id', orderId);
      }

      setSuccess(true);
      setTimeout(() => {
        onRatingSubmitted();
        onClose();
        setRating(0);
        setComment('');
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Error submitting rating:', err);
      setError(err instanceof Error ? err.message : 'Erro ao enviar avaliação');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4`}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {t.language === 'pt' ? 'Avaliar Produto' : t.language === 'en' ? 'Rate Product' : 'Calificar producto'}
          </h3>
          {!force && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {success ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Avaliação enviada!' : t.language === 'en' ? 'Rating sent!' : '¡Calificación enviada!'}
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Product name */}
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center truncate">
              {productName}
            </p>

            {force && (
              <p className="text-xs text-orange-600 dark:text-orange-400 text-center font-medium">
                {t.language === 'pt' ? 'Avalie este produto antes de comprar novamente.' : t.language === 'en' ? 'Please rate this product before buying again.' : 'Califica este producto antes de comprar de nuevo.'}
              </p>
            )}

            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            {/* Star rating - compact */}
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className="p-1 transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        star <= (hover || rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 h-5">
                {rating > 0 && getLabel(rating)}
              </span>
            </div>

            {/* Comment - optional, no pre-filled text */}
            {rating > 0 && (
              <div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  maxLength={300}
                  className="w-full text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-blue-400 placeholder-gray-400"
                  placeholder={t.language === 'pt' ? 'Comentário (opcional)...' : t.language === 'en' ? 'Comment (optional)...' : 'Comentario (opcional)...'}
                />
                <p className="text-xs text-gray-400 text-right mt-0.5">{comment.length}/300</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!rating || submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t.language === 'pt' ? 'Enviar' : t.language === 'en' ? 'Submit' : 'Enviar'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
