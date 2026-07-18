import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, User, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface User {
  id: string;
  email: string;
  full_name?: string;
}

export function AdminNotificationsManager() {
  const { language } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sendToAll, setSendToAll] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('email');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  async function handleSendNotification() {
    if (!title.trim() || !message.trim()) {
      setErrorMessage(
        language === 'pt'
          ? 'Título e mensagem são obrigatórios'
          : language === 'en'
          ? 'Title and message are required'
          : 'Título y mensaje son obligatorios'
      );
      return;
    }

    if (!sendToAll && selectedUsers.length === 0) {
      setErrorMessage(
        language === 'pt'
          ? 'Selecione pelo menos um usuário ou marque "Enviar para todos"'
          : language === 'en'
          ? 'Select at least one user or check "Send to all"'
          : 'Seleccione al menos un usuario o marque "Enviar a todos"'
      );
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const targetUsers = sendToAll ? users.map(u => u.id) : selectedUsers;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const notifications = targetUsers.map(userId => ({
        user_id: userId,
        type: 'admin',
        title: title.trim(),
        message: message.trim(),
        priority,
        expires_at: expiresAt.toISOString(),
        read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) throw error;

      setSuccessMessage(
        language === 'pt'
          ? `Notificação enviada para ${targetUsers.length} usuário(s)!`
          : language === 'en'
          ? `Notification sent to ${targetUsers.length} user(s)!`
          : `Notificación enviada a ${targetUsers.length} usuario(s)!`
      );

      setTitle('');
      setMessage('');
      setSelectedUsers([]);
      setSendToAll(false);
      setPriority('medium');
      setExpiresInDays(7);
    } catch (error) {
      console.error('Error sending notification:', error);
      setErrorMessage(
        language === 'pt'
          ? 'Erro ao enviar notificação'
          : language === 'en'
          ? 'Error sending notification'
          : 'Error al enviar notificación'
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }

  function toggleSelectAll() {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  }

  const priorityColors = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  };

  const priorityLabels = {
    low: language === 'pt' ? 'Baixa' : language === 'en' ? 'Low' : 'Baja',
    medium: language === 'pt' ? 'Média' : language === 'en' ? 'Medium' : 'Media',
    high: language === 'pt' ? 'Alta' : language === 'en' ? 'High' : 'Alta',
    urgent: language === 'pt' ? 'Urgente' : language === 'en' ? 'Urgent' : 'Urgente'
  };

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center space-x-3">
          <Bell className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'pt'
                ? 'Gerenciar Notificações'
                : language === 'en'
                ? 'Manage Notifications'
                : 'Gestionar Notificaciones'}
            </h1>
            <p className="text-blue-100">
              {language === 'pt'
                ? 'Envie notificações para usuários específicos ou para todos'
                : language === 'en'
                ? 'Send notifications to specific users or to everyone'
                : 'Enviar notificaciones a usuarios específicos o a todos'}
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage('')}
            className="ml-auto text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
          <button
            onClick={() => setErrorMessage('')}
            className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {language === 'pt'
              ? 'Conteúdo da Notificação'
              : language === 'en'
              ? 'Notification Content'
              : 'Contenido de la Notificación'}
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'pt' ? 'Título' : language === 'en' ? 'Title' : 'Título'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                language === 'pt'
                  ? 'Digite o título da notificação'
                  : language === 'en'
                  ? 'Enter notification title'
                  : 'Ingrese el título de la notificación'
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'pt' ? 'Mensagem' : language === 'en' ? 'Message' : 'Mensaje'}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                language === 'pt'
                  ? 'Digite a mensagem da notificação'
                  : language === 'en'
                  ? 'Enter notification message'
                  : 'Ingrese el mensaje de la notificación'
              }
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Prioridade' : language === 'en' ? 'Priority' : 'Prioridad'}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                {Object.entries(priorityLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Expira em (dias)' : language === 'en' ? 'Expires in (days)' : 'Expira en (días)'}
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 7)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'pt' ? 'Prioridade Selecionada:' : language === 'en' ? 'Selected Priority:' : 'Prioridad Seleccionada:'}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[priority]}`}>
                {priorityLabels[priority]}
              </span>
            </div>
          </div>

          <button
            onClick={handleSendNotification}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>
                  {language === 'pt'
                    ? 'Enviar Notificação'
                    : language === 'en'
                    ? 'Send Notification'
                    : 'Enviar Notificación'}
                </span>
              </>
            )}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {language === 'pt'
                ? 'Destinatários'
                : language === 'en'
                ? 'Recipients'
                : 'Destinatarios'}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Users className="h-4 w-4" />
              <span>{users.length} {language === 'pt' ? 'usuários' : language === 'en' ? 'users' : 'usuarios'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <input
                type="checkbox"
                checked={sendToAll}
                onChange={(e) => {
                  setSendToAll(e.target.checked);
                  if (e.target.checked) {
                    setSelectedUsers([]);
                  }
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-white">
                {language === 'pt'
                  ? 'Enviar para todos os usuários'
                  : language === 'en'
                  ? 'Send to all users'
                  : 'Enviar a todos los usuarios'}
              </span>
            </label>

            {!sendToAll && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedUsers.length} {language === 'pt' ? 'selecionado(s)' : language === 'en' ? 'selected' : 'seleccionado(s)'}
                  </span>
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {selectedUsers.length === users.length
                      ? (language === 'pt' ? 'Desmarcar todos' : language === 'en' ? 'Deselect all' : 'Deseleccionar todos')
                      : (language === 'pt' ? 'Selecionar todos' : language === 'en' ? 'Select all' : 'Seleccionar todos')
                    }
                  </button>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                  {users.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <User className="h-4 w-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user.full_name || user.email}
                        </p>
                        {user.full_name && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
