import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Store, Check, X, MessageSquare } from 'lucide-react';

interface SellerRequest {
  id: string;
  user_id: string;
  business_name: string;
  description: string;
  contact_info: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function AdminSellerRequests() {
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SellerRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_requests')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar solicitações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('seller_requests')
        .update({
          status,
          admin_notes: adminNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      if (status === 'approved') {
        const request = requests.find(r => r.id === requestId);
        if (request) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ role: 'seller' })
            .eq('id', request.user_id);

          if (profileError) {
            console.error('Erro ao atualizar role do vendedor:', profileError);
            throw new Error(`Falha ao atualizar perfil: ${profileError.message}`);
          }

          console.log('Role atualizada com sucesso para:', request.user_id);
        }
      }

      setSelectedRequest(null);
      setAdminNotes('');
      loadRequests();
    } catch (err) {
      console.error('Erro ao atualizar solicitação:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center space-x-2 mb-6">
        <Store className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Solicitações de Vendedores</h2>
      </div>

      {requests.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <Store className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma solicitação encontrada</p>
        </div>
      )}

      <div className="grid gap-4">
        {requests.map((request) => (
          <div key={request.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{request.business_name}</h3>
                {request.profiles && (
                  <div className="mt-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{request.profiles.full_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{request.profiles.email}</p>
                  </div>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="font-medium">Contato:</span> {request.contact_info}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  <span className="font-medium">Data:</span> {new Date(request.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                request.status === 'approved' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {request.status === 'pending' ? 'Pendente' :
                 request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
              </span>
            </div>

            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição:</p>
              <p className="text-gray-600 dark:text-gray-400">{request.description}</p>
            </div>

            {request.admin_notes && (
              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg mb-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Notas do Admin</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{request.admin_notes}</p>
              </div>
            )}

            {request.status === 'pending' && (
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedRequest(request)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Check className="w-4 h-4" />
                  <span>Aprovar</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedRequest(request);
                  }}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <X className="w-4 h-4" />
                  <span>Rejeitar</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
              {selectedRequest.business_name}
            </h3>

            {selectedRequest.profiles && (
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                <p><span className="font-medium">Usuário:</span> {selectedRequest.profiles.full_name}</p>
                <p><span className="font-medium">Email:</span> {selectedRequest.profiles.email}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notas Administrativas (opcional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Adicione observações sobre esta solicitação..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setAdminNotes('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedRequest.id, 'approved')}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Aprovar</span>
              </button>
              <button
                onClick={() => handleUpdateStatus(selectedRequest.id, 'rejected')}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-1"
              >
                <X className="w-4 h-4" />
                <span>Rejeitar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
