import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Search, Clock, CheckCircle, AlertTriangle, User, Package, Send, ArrowLeft, Loader2, Filter, Inbox, ChevronRight, HelpCircle, CreditCard, Settings, Shield, ShoppingBag, Info, Zap, Star, Tag, Users, TrendingUp, Eye, Lock, MoreVertical, X, Plus, CreditCard as Edit, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface SupportCategory {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  active: boolean;
  sort_order: number;
}

interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  category_id?: string;
  product_id?: string;
  order_id?: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  assigned_to?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
  support_categories?: { name: string; icon: string; color: string };
  store_products?: { name: string };
  store_orders?: { id: string; total_usdt: number; status: string };
  profiles?: { email: string; full_name?: string; role: string };
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  is_read: boolean;
  read_at?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  profiles?: { email: string; full_name?: string; role: string };
}

const STATUS_CONFIG: Record<string, { label: string; labelEn: string; labelEs: string; color: string; dot: string }> = {
  open: { label: 'Aberto', labelEn: 'Open', labelEs: 'Abierto', color: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', dot: 'bg-blue-500' },
  in_progress: { label: 'Em Andamento', labelEn: 'In Progress', labelEs: 'En Progreso', color: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', dot: 'bg-amber-500' },
  waiting_user: { label: 'Aguardando Resposta', labelEn: 'Awaiting Reply', labelEs: 'Esperando Respuesta', color: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400', dot: 'bg-violet-500' },
  resolved: { label: 'Resolvido', labelEn: 'Resolved', labelEs: 'Resuelto', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500' },
  closed: { label: 'Fechado', labelEn: 'Closed', labelEs: 'Cerrado', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', dot: 'bg-gray-400' },
};

const PRIORITY_CONFIG: Record<string, { label: string; labelEn: string; labelEs: string; color: string }> = {
  low: { label: 'Baixa', labelEn: 'Low', labelEs: 'Baja', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  medium: { label: 'Média', labelEn: 'Medium', labelEs: 'Media', color: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  high: { label: 'Alta', labelEn: 'High', labelEs: 'Alta', color: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
  urgent: { label: 'Urgente', labelEn: 'Urgent', labelEs: 'Urgente', color: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'help-circle': HelpCircle, 'credit-card': CreditCard, 'package': Package,
  'user': User, 'settings': Settings, 'shield': Shield,
  'message-circle': MessageCircle, 'shopping-bag': ShoppingBag,
  'info': Info, 'zap': Zap, 'star': Star,
};

function timeAgo(date: string, lang: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
  if (days > 0) return new Date(date).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}min`;
  return lang === 'pt' ? 'agora' : lang === 'es' ? 'ahora' : 'now';
}

function formatDate(date: string, lang: string): string {
  const locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
  return new Date(date).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AdminSupportManager() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [activeView, setActiveView] = useState<'list' | 'view' | 'categories'>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'urgent'>('all');
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SupportCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', icon: 'help-circle', color: 'blue', active: true, sort_order: 0 });
  const [savingCategory, setSavingCategory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const tr = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'es' ? es : en;

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin_support')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_tickets' }, () => loadTickets())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, (payload) => {
        loadTickets();
        if (selectedTicket?.id === payload.new.id) setSelectedTicket(payload.new as SupportTicket);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
        if (selectedTicket?.id === (payload.new as SupportMessage).ticket_id) loadTicketMessages(selectedTicket.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket]);

  useEffect(() => { loadInitialData(); }, []);

  async function loadInitialData() {
    try { await Promise.all([loadTickets(), loadCategories()]); }
    catch (e) { console.error('Load error:', e); }
    finally { setLoading(false); }
  }

  async function loadTickets() {
    const { data: ticketsData } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
    if (!ticketsData || ticketsData.length === 0) { setTickets([]); return; }

    const userIds = [...new Set(ticketsData.map(t => t.user_id))];
    const categoryIds = [...new Set(ticketsData.map(t => t.category_id).filter(Boolean))];
    const productIds = [...new Set(ticketsData.map(t => t.product_id).filter(Boolean))];
    const orderIds = [...new Set(ticketsData.map(t => t.order_id).filter(Boolean))];

    const [profilesRes, catsRes, prodsRes, ordersRes] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, role').in('id', userIds),
      categoryIds.length ? supabase.from('support_categories').select('id, name, icon, color').in('id', categoryIds) : Promise.resolve({ data: [] }),
      productIds.length ? supabase.from('store_products').select('id, name').in('id', productIds) : Promise.resolve({ data: [] }),
      orderIds.length ? supabase.from('store_orders').select('id, total_usdt, status').in('id', orderIds) : Promise.resolve({ data: [] }),
    ]);

    const enriched = ticketsData.map(t => ({
      ...t,
      profiles: profilesRes.data?.find(p => p.id === t.user_id),
      support_categories: catsRes.data?.find(c => c.id === t.category_id),
      store_products: prodsRes.data?.find(p => p.id === t.product_id),
      store_orders: ordersRes.data?.find(o => o.id === t.order_id),
    }));
    setTickets(enriched);
  }

  async function loadCategories() {
    const { data } = await supabase.from('support_categories').select('*').order('sort_order');
    setCategories(data || []);
  }

  async function loadTicketMessages(ticketId: string) {
    const { data: msgs } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (!msgs || msgs.length === 0) { setMessages([]); return; }
    const senderIds = [...new Set(msgs.map(m => m.sender_id))].filter(Boolean);
    let profiles: { id: string; email: string; full_name?: string; role: string }[] = [];
    if (senderIds.length > 0) {
      const { data: p } = await supabase.from('profiles').select('id, email, full_name, role').in('id', senderIds);
      profiles = p || [];
    }
    setMessages(msgs.map(m => ({ ...m, profiles: profiles.find(p => p.id === m.sender_id) })));

    // Mark user messages as read (admin viewing)
    const unread = msgs.filter(m => !m.is_read && m.sender_id !== user?.id && !m.is_internal);
    if (unread.length > 0) {
      await supabase.from('support_messages').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unread.map(m => m.id));
    }
  }

  const openTicket = useCallback(async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setActiveView('view');
    await loadTicketMessages(ticket.id);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [user]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedTicket || !newMessage.trim()) return;
    setSendingMessage(true);
    setError('');
    try {
      const { error } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        message: newMessage.trim(),
        is_internal: isInternal,
        is_read: isInternal,
        metadata: { sender_email: user.email, sender_role: 'admin', sent_via: 'admin_interface' },
      });
      if (error) throw error;
      setNewMessage('');
      setIsInternal(false);
      await loadTicketMessages(selectedTicket.id);
      await loadTickets();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      console.error('Send error:', err);
      setError(err.message || tr('Erro ao enviar mensagem', 'Error sending message', 'Error al enviar mensaje'));
    } finally { setSendingMessage(false); }
  }

  async function updateTicketStatus(ticketId: string, status: SupportTicket['status']) {
    setUpdatingStatus(true);
    try {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'resolved') updates.resolved_at = new Date().toISOString();
      if (status === 'closed') updates.closed_at = new Date().toISOString();

      const { error } = await supabase.from('support_tickets').update(updates).eq('id', ticketId);
      if (error) throw error;

      await loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status, ...updates } : null);
      }
    } catch (err: any) {
      setError(err.message || tr('Erro ao atualizar status', 'Error updating status', 'Error al actualizar estado'));
    } finally { setUpdatingStatus(false); }
  }

  async function updateTicketPriority(ticketId: string, priority: SupportTicket['priority']) {
    try {
      const { error } = await supabase.from('support_tickets').update({ priority, updated_at: new Date().toISOString() }).eq('id', ticketId);
      if (error) throw error;
      await loadTickets();
      if (selectedTicket?.id === ticketId) setSelectedTicket(prev => prev ? { ...prev, priority } : null);
    } catch (err: any) { console.error('Priority update error:', err); }
  }

  async function assignTicket(ticketId: string) {
    if (!user) return;
    try {
      const { error } = await supabase.from('support_tickets').update({ assigned_to: user.id, status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', ticketId);
      if (error) throw error;
      await loadTickets();
      if (selectedTicket?.id === ticketId) setSelectedTicket(prev => prev ? { ...prev, assigned_to: user.id, status: 'in_progress' } : null);
    } catch (err: any) { console.error('Assign error:', err); }
  }

  // Category management
  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    setSavingCategory(true);
    try {
      if (editingCategory) {
        const { error } = await supabase.from('support_categories').update({
          name: categoryForm.name, description: categoryForm.description, icon: categoryForm.icon,
          color: categoryForm.color, active: categoryForm.active, sort_order: categoryForm.sort_order,
        }).eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('support_categories').insert({
          name: categoryForm.name, description: categoryForm.description, icon: categoryForm.icon,
          color: categoryForm.color, active: categoryForm.active, sort_order: categoryForm.sort_order,
        });
        if (error) throw error;
      }
      await loadCategories();
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', icon: 'help-circle', color: 'blue', active: true, sort_order: 0 });
    } catch (err: any) { setError(err.message); }
    finally { setSavingCategory(false); }
  }

  async function deleteCategory(catId: string) {
    if (!confirm(tr('Excluir esta categoria?', 'Delete this category?', '¿Eliminar esta categoría?'))) return;
    try {
      const { error } = await supabase.from('support_categories').delete().eq('id', catId);
      if (error) throw error;
      await loadCategories();
    } catch (err: any) { setError(err.message); }
  }

  const filteredTickets = tickets.filter(t => {
    const matchSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.profiles?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    waiting: tickets.filter(t => t.status === 'waiting_user').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    urgent: tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // ---------- CATEGORIES VIEW ----------
  if (activeView === 'categories') {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveView('list')} className="p-2 -ml-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{tr('Categorias', 'Categories', 'Categorías')}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Organize os tickets por tema', 'Organize tickets by theme', 'Organiza tickets por tema')}</p>
            </div>
          </div>
          <button onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', icon: 'help-circle', color: 'blue', active: true, sort_order: 0 }); setShowCategoryModal(true); }}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">{tr('Nova', 'New', 'Nueva')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat.icon] || HelpCircle;
            return (
              <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{cat.name}</h3>
                  {cat.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{cat.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cat.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {cat.active ? tr('Ativa', 'Active', 'Activa') : tr('Inativa', 'Inactive', 'Inactiva')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditingCategory(cat); setCategoryForm({ name: cat.name, description: cat.description || '', icon: cat.icon, color: cat.color, active: cat.active, sort_order: cat.sort_order }); setShowCategoryModal(true); }}
                    className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCategory(cat.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {categories.length === 0 && (
            <div className="col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Tag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Nenhuma categoria ainda', 'No categories yet', 'Sin categorías aún')}</p>
            </div>
          )}
        </div>

        {/* Category modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowCategoryModal(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editingCategory ? tr('Editar Categoria', 'Edit Category', 'Editar Categoría') : tr('Nova Categoria', 'New Category', 'Nueva Categoría')}</h2>
                <button onClick={() => setShowCategoryModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={saveCategory} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Nome', 'Name', 'Nombre')} *</label>
                  <input type="text" required value={categoryForm.name} onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Descrição', 'Description', 'Descripción')}</label>
                  <textarea rows={2} value={categoryForm.description} onChange={e => setCategoryForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Ícone', 'Icon', 'Ícono')}</label>
                    <select value={categoryForm.icon} onChange={e => setCategoryForm(f => ({ ...f, icon: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                      {Object.keys(CATEGORY_ICONS).map(icon => <option key={icon} value={icon}>{icon}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Cor', 'Color', 'Color')}</label>
                    <select value={categoryForm.color} onChange={e => setCategoryForm(f => ({ ...f, color: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                      {['blue', 'green', 'orange', 'red', 'violet', 'amber'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Ordem', 'Order', 'Orden')}</label>
                    <input type="number" value={categoryForm.sort_order} onChange={e => setCategoryForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={categoryForm.active} onChange={e => setCategoryForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded text-blue-600" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{tr('Ativa', 'Active', 'Activa')}</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowCategoryModal(false)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">{tr('Cancelar', 'Cancel', 'Cancelar')}</button>
                  <button type="submit" disabled={savingCategory} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {tr('Salvar', 'Save', 'Guardar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- TICKET DETAIL VIEW ----------
  if (activeView === 'view' && selectedTicket) {
    const status = STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.open;
    const priority = PRIORITY_CONFIG[selectedTicket.priority] || PRIORITY_CONFIG.medium;
    const category = selectedTicket.support_categories;
    const CatIcon = category ? (CATEGORY_ICONS[category.icon] || HelpCircle) : HelpCircle;
    const customerName = selectedTicket.profiles?.full_name || selectedTicket.profiles?.email || tr('Usuário', 'User', 'Usuario');

    return (
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveView('list'); setSelectedTicket(null); }} className="p-2 -ml-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{selectedTicket.ticket_number}</p>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{selectedTicket.subject}</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Messages */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{tr('Conversa', 'Conversation', 'Conversación')}</h2>
                <span className="text-xs text-gray-400">({messages.filter(m => !m.is_internal).length})</span>
              </div>

              <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{tr('Nenhuma mensagem', 'No messages', 'Sin mensajes')}</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isOwn = msg.sender_id === user?.id;
                    const isAdmin = msg.profiles?.role === 'admin';
                    const senderName = msg.profiles?.full_name || msg.profiles?.email || tr('Usuário', 'User', 'Usuario');
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] flex flex-col gap-1 ${msg.is_internal ? 'w-full max-w-full' : ''}`}>
                          {msg.is_internal ? (
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3.5 py-2.5">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">{tr('Nota Interna', 'Internal Note', 'Nota Interna')}</span>
                                <span className="text-[10px] text-amber-500 dark:text-amber-500/70">{senderName}</span>
                              </div>
                              <p className="text-sm text-amber-800 dark:text-amber-200">{msg.message}</p>
                            </div>
                          ) : (
                            <>
                              {!isOwn && (
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${isAdmin ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                    {isAdmin ? 'AD' : senderName.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{isAdmin ? tr('Suporte', 'Support', 'Soporte') : senderName}</span>
                                </div>
                              )}
                              <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${isOwn ? 'bg-blue-600 text-white rounded-br-md' : isAdmin ? 'bg-blue-50 text-gray-800 dark:bg-blue-500/10 dark:text-blue-100 rounded-bl-md border border-blue-100 dark:border-blue-500/20' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-bl-md'}`}>
                                {msg.message}
                              </div>
                            </>
                          )}
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1">{timeAgo(msg.created_at, language)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-2">
                <div className="flex items-end gap-2">
                  <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} rows={1}
                    placeholder={tr('Digite sua resposta...', 'Type your reply...', 'Escribe tu respuesta...')}
                    className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all max-h-32"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} />
                  <button type="submit" disabled={!newMessage.trim() || sendingMessage} className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                    {sendingMessage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="w-3.5 h-3.5 rounded text-amber-600" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" /> {tr('Nota interna (visível apenas para admins)', 'Internal note (admins only)', 'Nota interna (solo admins)')}</span>
                </label>
              </form>
            </div>
          </div>

          {/* Right: Ticket details + actions */}
          <div className="space-y-4">
            {/* Customer info */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{tr('Cliente', 'Customer', 'Cliente')}</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{customerName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{selectedTicket.profiles?.email}</p>
                </div>
              </div>
              {selectedTicket.store_products && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <Package className="w-3.5 h-3.5" /> {selectedTicket.store_products.name}
                </div>
              )}
            </div>

            {/* Status management */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{tr('Gerenciar', 'Manage', 'Gestionar')}</h3>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">{tr('Status', 'Status', 'Estado')}</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {(['open', 'in_progress', 'waiting_user', 'resolved', 'closed'] as const).map(s => {
                    const cfg = STATUS_CONFIG[s];
                    const active = selectedTicket.status === s;
                    return (
                      <button key={s} onClick={() => updateTicketStatus(selectedTicket.id, s)} disabled={updatingStatus}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${active ? cfg.color + ' ring-1 ring-current/20' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {tr(cfg.label, cfg.labelEn, cfg.labelEs)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">{tr('Prioridade', 'Priority', 'Prioridad')}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['low', 'medium', 'high', 'urgent'] as const).map(p => {
                    const cfg = PRIORITY_CONFIG[p];
                    const active = selectedTicket.priority === p;
                    return (
                      <button key={p} onClick={() => updateTicketPriority(selectedTicket.id, p)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? cfg.color + ' ring-1 ring-current/20' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        {tr(cfg.label, cfg.labelEn, cfg.labelEs)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!selectedTicket.assigned_to && (
                <button onClick={() => assignTicket(selectedTicket.id)} className="w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                  {tr('Assumir Ticket', 'Assign to Me', 'Tomar Ticket')}
                </button>
              )}
            </div>

            {/* Ticket meta */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between"><span className="text-gray-400">{tr('Criado em', 'Created', 'Creado')}</span><span className="text-gray-600 dark:text-gray-300">{formatDate(selectedTicket.created_at, language)}</span></div>
              {selectedTicket.resolved_at && <div className="flex items-center justify-between"><span className="text-gray-400">{tr('Resolvido em', 'Resolved', 'Resuelto')}</span><span className="text-gray-600 dark:text-gray-300">{formatDate(selectedTicket.resolved_at, language)}</span></div>}
              {category && <div className="flex items-center justify-between"><span className="text-gray-400">{tr('Categoria', 'Category', 'Categoría')}</span><span className="text-gray-600 dark:text-gray-300">{category.name}</span></div>}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-500/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{tr('Suporte', 'Support', 'Soporte')}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Gerencie todos os tickets', 'Manage all tickets', 'Gestiona todos los tickets')}</p>
          </div>
        </div>
        <button onClick={() => setActiveView('categories')} className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium transition-colors flex-shrink-0">
          <Tag className="w-4 h-4" /><span className="hidden sm:inline">{tr('Categorias', 'Categories', 'Categorías')}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: tr('Total', 'Total', 'Total'), value: stats.total, icon: Inbox, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-gray-800' },
          { label: tr('Abertos', 'Open', 'Abiertos'), value: stats.open, icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: tr('Ativos', 'Active', 'Activos'), value: stats.inProgress, icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
          { label: tr('Aguardando', 'Waiting', 'Esperando'), value: stats.waiting, icon: Users, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
          { label: tr('Resolvidos', 'Resolved', 'Resueltos'), value: stats.resolved, icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: tr('Urgentes', 'Urgent', 'Urgentes'), value: stats.urgent, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-2.5 sm:p-3 text-center`}>
            <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
            <p className={`text-base sm:text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder={tr('Buscar por ticket, assunto ou email...', 'Search by ticket, subject or email...', 'Buscar por ticket, asunto o email...')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {([
            { key: 'all', label: tr('Todos', 'All', 'Todos') },
            { key: 'open', label: tr('Abertos', 'Open', 'Abiertos') },
            { key: 'in_progress', label: tr('Ativos', 'Active', 'Activos') },
            { key: 'waiting_user', label: tr('Aguardando', 'Waiting', 'Esperando') },
            { key: 'resolved', label: tr('Resolvidos', 'Resolved', 'Resueltos') },
            { key: 'closed', label: tr('Fechados', 'Closed', 'Cerrados') },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div className="space-y-2.5">
        {filteredTickets.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 sm:p-12 text-center">
            <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Nenhum ticket encontrado', 'No tickets found', 'No se encontraron tickets')}</p>
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
            const category = ticket.support_categories;
            const CatIcon = category ? (CATEGORY_ICONS[category.icon] || HelpCircle) : HelpCircle;
            const customerName = ticket.profiles?.full_name || ticket.profiles?.email || tr('Usuário', 'User', 'Usuario');
            return (
              <button key={ticket.id} onClick={() => openTicket(ticket)}
                className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3.5 sm:p-4 text-left hover:border-blue-300 dark:hover:border-blue-500/40 hover:shadow-sm transition-all group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-colors">
                    <CatIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{ticket.ticket_number}</p>
                          {ticket.priority === 'urgent' && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 uppercase">{tr('Urgente', 'Urgent', 'Urgente')}</span>}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ticket.subject}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{customerName}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                        <span className={`w-1 h-1 rounded-full ${status.dot}`} />
                        {tr(status.label, status.labelEn, status.labelEs)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${priority.color}`}>{tr(priority.label, priority.labelEn, priority.labelEs)}</span>
                      {category && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">{category.name}</span>}
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">{timeAgo(ticket.created_at, language)}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
