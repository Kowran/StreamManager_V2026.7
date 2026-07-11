import React, { useState } from 'react';
import { X, RefreshCw, Loader, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface RenewalPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  notificationId: string;
  productId: string;
  productName: string;
  productPrice: number;
  durationDays: number;
  purchaseId: string;
  onRenewalSuccess?: () => void;
}

export default function RenewalPromptModal({
  isOpen,
  onClose,
  notificationId,
  productId,
  productName,
  productPrice,
  durationDays,
  purchaseId,
  onRenewalSuccess
}: RenewalPromptModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleRenew = async () => {
    setIsProcessing(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .single();

      if (!userProfile || userProfile.balance < productPrice) {
        setError('Saldo insuficiente. Por favor, recarregue sua conta.');
        setIsProcessing(false);
        return;
      }

      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (!product) {
        setError('Produto não encontrado.');
        setIsProcessing(false);
        return;
      }

      const newBalance = userProfile.balance - productPrice;

      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', user.id);

      if (balanceError) throw balanceError;

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + durationDays);

      const { error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          product_id: productId,
          seller_id: product.seller_id,
          price: productPrice,
          quantity: 1,
          status: 'pending',
          expiry_date: expiryDate.toISOString().split('T')[0]
        });

      if (purchaseError) throw purchaseError;

      await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      await supabase
        .from('user_activity_logs')
        .insert({
          user_id: user.id,
          action: 'purchase_renewed',
          details: {
            product_id: productId,
            product_name: productName,
            price: productPrice,
            previous_purchase_id: purchaseId,
            renewed_at: new Date().toISOString()
          }
        });

      if (onRenewalSuccess) {
        onRenewalSuccess();
      }

      onClose();
    } catch (err: any) {
      console.error('Error renewing purchase:', err);
      setError(err.message || 'Erro ao renovar compra. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      onClose();
    } catch (err) {
      console.error('Error marking notification as read:', err);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Renovar Compra</h2>
          </div>
          <button
            onClick={handleDecline}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-gray-700 mb-3">
              Sua compra de <span className="font-semibold">{productName}</span> expirou.
            </p>
            <p className="text-gray-700">
              Deseja renovar por mais <span className="font-semibold">{durationDays} dias</span> por{' '}
              <span className="font-semibold text-blue-600">${productPrice.toFixed(2)}</span>?
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Produto:</span>
              <span className="font-medium text-gray-900">{productName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Duração:</span>
              <span className="font-medium text-gray-900">{durationDays} dias</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-600">Valor:</span>
              <span className="font-semibold text-gray-900">${productPrice.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleDecline}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Agora Não
          </button>
          <button
            onClick={handleRenew}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Renovar Agora
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
