import React, { useState } from 'react';
import { X, AlertTriangle, DollarSign, Package, RefreshCw, CheckCircle, User, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface Sale {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  purchase_price: number;
  credentials: any;
  purchase_date: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
  store_orders?: {
    status: string;
    total_usdt: number;
    customer_email: string;
    customer_name?: string;
  };
}

interface AdminSaleCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSuccess: () => void;
}

export function AdminSaleCancellationModal({ isOpen, onClose, sale, onSuccess }: AdminSaleCancellationModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [cancellationReason, setCancellationReason] = useState('');
  const [returnToStock, setReturnToStock] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function handleCancelSale() {
    if (!sale || !user || !cancellationReason.trim()) {
      setError('Motivo do cancelamento é obrigatório');
      return;
    }

    const confirmMessage = `CONFIRMAR CANCELAMENTO DE VENDA

Produto: ${sale.product_name}
Cliente: ${sale.profiles?.email}
Valor: $${sale.purchase_price.toFixed(2)}
Motivo: ${cancellationReason}

Ações que serão executadas:
✅ Pedido será marcado como cancelado
✅ Valor será reembolsado ao cliente
${returnToStock ? '✅ Conta retornará ao estoque' : '❌ Conta NÃO retornará ao estoque'}
✅ Cliente será notificado sobre o cancelamento

Esta ação NÃO PODE ser desfeita. Continuar?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-cancel-sale`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sale_id: sale.id,
          order_id: sale.order_id,
          cancellation_reason: cancellationReason.trim(),
          return_to_stock: returnToStock,
          admin_id: user.id
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        if (result.error === 'Sale not found') {
          throw new Error('Venda não encontrada. Esta venda pode já ter sido cancelada ou removida do sistema.');
        }
        throw new Error(result.error || 'Erro ao cancelar venda');
      }

      alert(`✅ Venda cancelada com sucesso!

Resumo:
• Pedido #${sale.order_id} cancelado
• $${sale.purchase_price.toFixed(2)} reembolsados para ${sale.profiles?.email}
• ${returnToStock ? 'Conta retornada ao estoque' : 'Conta removida permanentemente'}
• Cliente notificado sobre o cancelamento

O cliente receberá uma notificação explicando o cancelamento e o reembolso.`);

      onSuccess();
      onClose();

    } catch (error) {
      console.error('Error cancelling sale:', error);
      setError(error instanceof Error ? error.message : 'Erro ao cancelar venda');
    } finally {
      setProcessing(false);
    }
  }

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-red-100 dark:bg-red-900/20 p-2 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Cancelar Venda
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Sale Information */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Informações da Venda
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cliente
                </label>
                <div className="mt-1 flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {sale.profiles?.full_name || sale.store_orders?.customer_name || 'Cliente'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {sale.profiles?.email || sale.store_orders?.customer_email}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Produto
                </label>
                <div className="mt-1 flex items-center space-x-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {sale.product_name}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Valor Pago
                </label>
                <div className="mt-1 flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">
                    ${sale.purchase_price.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Data da Compra
                </label>
                <div className="mt-1 flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="text-sm text-gray-900 dark:text-white">
                    {new Date(sale.purchase_date).toLocaleDateString('pt-BR')} às {new Date(sale.purchase_date).toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status do Pedido
                </label>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    sale.store_orders?.status === 'delivered' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : sale.store_orders?.status === 'cancelled'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  }`}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {sale.store_orders?.status === 'delivered' ? 'Entregue' :
                     sale.store_orders?.status === 'cancelled' ? 'Cancelado' :
                     sale.store_orders?.status || 'Pendente'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivered Credentials */}
          {sale.credentials && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">
                Credenciais Entregues
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-md p-3 border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Email:
                    </label>
                    <p className="font-mono text-sm text-gray-900 dark:text-white">
                      {sale.credentials.email || 'Não disponível'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Senha:
                    </label>
                    <p className="font-mono text-sm text-gray-900 dark:text-white">
                      {sale.credentials.password || 'Não disponível'}
                    </p>
                  </div>
                </div>
                {sale.credentials.instructions && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Instruções:
                    </label>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {sale.credentials.instructions}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
              </div>
            </div>
          )}

          {/* Cancellation Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Motivo do Cancelamento *
              </label>
              <textarea
                rows={4}
                required
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-red-500 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Explique o motivo do cancelamento desta venda. Esta informação será enviada ao cliente."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Este motivo será registrado no histórico e enviado ao cliente na notificação
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    Retornar Conta ao Estoque?
                  </h4>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                    Se marcado, a conta será disponibilizada novamente para venda. 
                    Se desmarcado, a conta será removida permanentemente.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={returnToStock}
                    onChange={(e) => setReturnToStock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Cancellation Summary */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-3">
              ⚠️ Resumo do Cancelamento
            </h4>
            <div className="space-y-2 text-sm text-red-700 dark:text-red-400">
              <div className="flex justify-between">
                <span>Cliente será reembolsado:</span>
                <span className="font-bold">${sale.purchase_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status do pedido:</span>
                <span className="font-medium">Cancelado</span>
              </div>
              <div className="flex justify-between">
                <span>Conta no estoque:</span>
                <span className="font-medium">
                  {returnToStock ? 'Retornará (disponível para venda)' : 'Será removida (permanente)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Notificação ao cliente:</span>
                <span className="font-medium">Será enviada automaticamente</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={onClose}
              disabled={processing}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleCancelSale}
              disabled={processing || !cancellationReason.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
            >
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processando Cancelamento...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Confirmar Cancelamento
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}