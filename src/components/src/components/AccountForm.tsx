import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { supabase, StreamingAccount, StreamingService, Seller } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';

interface AccountFormProps {
  account?: StreamingAccount | null;
  services: StreamingService[];
  sellers: Seller[];
  clients: any[];
  onClose: () => void;
  onSave: () => void;
}

export function AccountForm({ account, services, sellers, clients, onClose, onSave }: AccountFormProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    service_id: '',
    seller_id: '',
    email: '',
    password: '',
    purchase_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    total_profiles: 4,
    monthly_price: 0,
    status: 'active' as const,
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setFormData({
        service_id: account.service_id,
        seller_id: account.seller_id || '',
        email: account.email,
        password: account.password,
        purchase_date: account.purchase_date,
        expiry_date: account.expiry_date || '',
        total_profiles: account.total_profiles,
        monthly_price: account.monthly_price,
        status: account.status,
        notes: account.notes || ''
      });
    } else {
      // Limpar formulário para nova conta
      setFormData({
        service_id: '',
        seller_id: '',
        email: '',
        password: '',
        purchase_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        total_profiles: 4,
        monthly_price: 0,
        status: 'active',
        notes: ''
      });
    }
  }, [account]);

  // Atualizar preço baseado no serviço selecionado
  useEffect(() => {
    if (formData.service_id && !account) {
      const selectedService = services.find(s => s.id === formData.service_id);
      if (selectedService) {
        setFormData(prev => ({
          ...prev,
          monthly_price: selectedService.monthly_price,
          total_profiles: selectedService.max_profiles
        }));
      }
    }
  }, [formData.service_id, services, account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        seller_id: formData.seller_id || null,
        expiry_date: formData.expiry_date || null,
        user_id: user?.id || null,
        updated_at: new Date().toISOString()
      };

      if (account) {
        // Atualizar conta existente
        const { error } = await supabase
          .from('streaming_accounts')
          .update(dataToSave)
          .eq('id', account.id);

        if (error) throw error;
      } else {
        // Criar nova conta
        const { error } = await supabase
          .from('streaming_accounts')
          .insert([dataToSave]);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar conta:', error);
      alert('Erro ao salvar conta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 sm:top-10 lg:top-20 mx-auto p-4 sm:p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
            {account ? t.editAccount : t.newAccount}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 touch-manipulation"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.service} *
              </label>
              <select
                required
                value={formData.service_id}
                onChange={(e) => setFormData(prev => ({ ...prev, service_id: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
              >
                <option value="">{t.service}</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.seller}
              </label>
              <select
                value={formData.seller_id}
                onChange={(e) => setFormData(prev => ({ ...prev, seller_id: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
              >
                <option value="">{t.seller}</option>
                {sellers.map(seller => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.accountEmail} *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base touch-manipulation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.password} *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="mt-1 block w-full pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base touch-manipulation"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors touch-manipulation"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.purchaseDate} *
              </label>
              <input
                type="date"
                required
                value={formData.purchase_date}
                onChange={(e) => setFormData(prev => ({ ...prev, purchase_date: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.expiryDate}
              </label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.status} *
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'expired' | 'suspended' }))}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
              >
                <option value="active">{t.active}</option>
                <option value="expired">{t.expired}</option>
                <option value="suspended">{t.suspended}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.totalProfiles} *
              </label>
              <input
                type="number"
                required
                min="1"
                max="10"
                value={formData.total_profiles}
                onChange={(e) => setFormData(prev => ({ ...prev, total_profiles: parseInt(e.target.value) }))}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.monthlyPrice} (USD) *
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.monthly_price}
                onChange={(e) => setFormData(prev => ({ ...prev, monthly_price: parseFloat(e.target.value) }))}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.notes}
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base touch-manipulation resize-none"
              placeholder={`${t.notes}...`}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors touch-manipulation"
            >
              {saving ? t.saving : (account ? t.updateProduct : t.language === 'pt' ? 'Criar Conta' : t.language === 'en' ? 'Create Account' : 'Crear Cuenta')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}