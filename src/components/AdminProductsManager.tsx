import React, { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit, Trash2, Package, Search, Save, X, DollarSign, List, Upload, Star, UserCheck, Smartphone, Gamepad2, Gift, Coins } from 'lucide-react';
import { supabase, StoreProduct, PrimaryCategory, PRIMARY_CATEGORIES } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';
import { RecentRatings } from './RecentRatings';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
interface ProductFormData {
  name: string;
  description: string;
  price_usd: number;
  category: string;
  primary_category: PrimaryCategory;
  image_url: string;
  active: boolean;
  features: string[];
  renewable: boolean;
  manual_delivery: boolean;
  account_recharge: boolean;
  delivery_time: string;
}

interface InventoryItem {
  id?: string;
  email: string;
  password: string;
  instructions: string;
  status?: string;
}

export function AdminProductsManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [inventory, setInventory] = useState<Record<string, InventoryItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price_usd: 0,
    category: 'streaming',
    primary_category: 'item',
    image_url: '',
    active: true,
    features: [],
    renewable: false,
    manual_delivery: false,
    account_recharge: false,
    delivery_time: ''
  });
  const [inventoryForm, setInventoryForm] = useState<InventoryItem[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; item: InventoryItem | null; index: number }>({
    show: false,
    item: null,
    index: -1
  });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadProducts();
    }
  }, [isAdmin]);

  async function checkAdminStatus() {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      setIsAdmin(profile?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);

      // Load inventory for each product
      const inventoryData: Record<string, InventoryItem[]> = {};
      for (const product of data || []) {
        const { data: items } = await supabase
          .from('product_inventory')
          .select('*')
          .eq('product_id', product.id)
          .in('status', ['available', 'reserved'])
          .order('created_at', { ascending: false });
        
        inventoryData[product.id] = items || [];
      }
      setInventory(inventoryData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  async function loadProductInventory(productId: string) {
    try {
      const { data, error } = await supabase
        .from('product_inventory')
        .select('*')
        .eq('product_id', productId)
        .in('status', ['available', 'reserved', 'sold'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInventoryForm(data || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
      setInventoryForm([]);
    }
  }

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        description: editingProduct.description || '',
        price_usd: editingProduct.price_usdt,
        category: editingProduct.category,
        primary_category: (editingProduct.primary_category || 'item') as PrimaryCategory,
        image_url: editingProduct.image_url || '',
        active: editingProduct.active,
        features: editingProduct.features || [],
        renewable: editingProduct.renewable || false,
        manual_delivery: editingProduct.manual_delivery || false,
        account_recharge: (editingProduct as any).account_recharge || false,
        delivery_time: (editingProduct as any).delivery_time || ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price_usd: 0,
        category: 'streaming',
        primary_category: 'item',
        image_url: '',
        active: true,
        features: [],
        renewable: false,
        manual_delivery: false,
        account_recharge: false
      });
    }
  }, [editingProduct]);

  function addInventoryItem() {
    setInventoryForm(prev => [...prev, { email: '', password: '', instructions: 'Use estas credenciais para acessar sua conta.' }]);
  }

  function openDeleteModal(index: number) {
    const item = inventoryForm[index];
    if (item.id) {
      setDeleteModal({ show: true, item, index });
    }
  }

  async function confirmDeleteInventoryItem() {
    if (!deleteModal.item?.id) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('product_inventory')
        .delete()
        .eq('id', deleteModal.item.id);

      if (error) throw error;

      await loadProductInventory(selectedProductId);
      setDeleteModal({ show: false, item: null, index: -1 });
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      alert('Erro ao excluir conta. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function removeInventoryItem(index: number) {
    const item = inventoryForm[index];

    if (item.id) {
      openDeleteModal(index);
    } else {
      setInventoryForm(prev => prev.filter((_, i) => i !== index));
    }
  }

  function updateInventoryItem(index: number, field: keyof InventoryItem, value: string) {
    setInventoryForm(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  }

  function addFeature() {
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, '']
    }));
  }

  function removeFeature(index: number) {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  }

  function updateFeature(index: number, value: string) {
    setFormData(prev => ({
      ...prev,
      features: prev.features.map((feature, i) => 
        i === index ? value : feature
      )
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const productData = {
        name: formData.name,
        description: formData.description || null,
        price_brl: formData.price_usd * 5.5,
        price_usdt: formData.price_usd,
        category: formData.category,
        primary_category: formData.primary_category,
        image_url: formData.image_url || null,
        auto_delivery: true, // Always true for new system
        active: formData.active,
        features: formData.features.filter(f => f.trim() !== ''),
        renewable: formData.renewable,
        manual_delivery: formData.manual_delivery,
        account_recharge: formData.account_recharge || formData.primary_category === 'top_up' || formData.primary_category === 'mobile_recharge',
        delivery_time: formData.delivery_time || null,
        stock_quantity: 0, // Will be updated by trigger
        seller_id: user?.id || null,
        updated_at: new Date().toISOString()
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('store_products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_products')
          .insert([productData]);

        if (error) throw error;
      }

      await loadProducts();
      setShowForm(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  }

  async function handleInventorySubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      // Filter only new items (without ID) and valid items
      const validItems = inventoryForm.filter(item => 
        !item.id && item.email.trim() && item.password.trim()
      );

      if (validItems.length > 0) {
        const inventoryData = validItems.map(item => ({
          product_id: selectedProductId,
          email: item.email.trim(),
          password: item.password.trim(),
          instructions: item.instructions.trim() || 'Use estas credenciais para acessar sua conta.',
          status: 'available'
        }));

        const { error } = await supabase
          .from('product_inventory')
          .insert(inventoryData);

        if (error) throw error;
      }

      // Update existing items (with ID) that are available
      const existingItems = inventoryForm.filter(item => 
        item.id && item.email.trim() && item.password.trim() && 
        (!item.status || item.status === 'available')
      );

      for (const item of existingItems) {
        const { error: updateError } = await supabase
          .from('product_inventory')
          .update({
            email: item.email.trim(),
            password: item.password.trim(),
            instructions: item.instructions.trim() || 'Use estas credenciais para acessar sua conta.',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)
          .eq('status', 'available'); // Only update available items

        if (updateError) {
          console.error('Error updating inventory item:', updateError);
        }
      }

      await loadProducts();
      setShowInventoryModal(false);
      setSelectedProductId('');
      setInventoryForm([]);
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert('Erro ao salvar estoque');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(product: StoreProduct) {
    const confirmMessage = `Tem certeza que deseja excluir o produto "${product.name}"?\n\n⚠️ ATENÇÃO: Esta ação irá:\n• Remover o produto permanentemente\n• Excluir todo o estoque associado\n• Cancelar pedidos pendentes\n• Esta ação NÃO PODE ser desfeita\n\nDigite "EXCLUIR" para confirmar:`;
    
    const confirmation = prompt(confirmMessage);
    if (confirmation !== 'EXCLUIR') {
      return;
    }

    try {
      // First, check if there are any pending orders for this product
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('store_orders')
        .select('id, status')
        .eq('product_id', product.id)
        .in('status', ['pending', 'paid']);

      if (ordersError) {
        console.error('Error checking pending orders:', ordersError);
        alert('Erro ao verificar pedidos pendentes. Tente novamente.');
        return;
      }

      if (pendingOrders && pendingOrders.length > 0) {
        const orderCount = pendingOrders.length;
        if (!confirm(`Este produto tem ${orderCount} pedido(s) pendente(s). Excluir o produto irá cancelar estes pedidos. Continuar?`)) {
          return;
        }

        // Cancel pending orders
        const { error: cancelOrdersError } = await supabase
          .from('store_orders')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('product_id', product.id)
          .in('status', ['pending', 'paid']);

        if (cancelOrdersError) {
          console.error('Error cancelling orders:', cancelOrdersError);
          alert('Erro ao cancelar pedidos pendentes. Tente novamente.');
          return;
        }
      }

      // Delete all inventory for this product first
      const { error: inventoryError } = await supabase
        .from('product_inventory')
        .delete()
        .eq('product_id', product.id);

      if (inventoryError) {
        console.error('Error deleting inventory:', inventoryError);
        alert('Erro ao excluir estoque do produto. Tente novamente.');
        return;
      }

      // Now delete the product itself
      const { error } = await supabase
        .from('store_products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;
      
      // Reload all data to ensure consistency
      await loadProducts();
      
      alert(`✅ Produto "${product.name}" foi excluído permanentemente do sistema!\n\n• Produto removido\n• Estoque excluído\n• Pedidos pendentes cancelados`);
      
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Erro ao excluir produto: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  function openInventoryManager(productId: string) {
    setSelectedProductId(productId);
    loadProductInventory(productId);
    setShowInventoryModal(true);
  }

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Acesso Restrito</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Apenas administradores podem gerenciar produtos.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciar Produtos</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Gerencie produtos e estoque da loja
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar produtos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Product Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{product.description}</p>
                  
                  {/* Product Rating Summary */}
                  <div className="mt-2">
                    <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
                  </div>
                  
                  {/* Product Features */}
                  {product.features && product.features.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {product.features.slice(0, 3).map((feature, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        >
                          {feature}
                        </span>
                      ))}
                      {product.features.length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          +{product.features.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      ${product.price_usdt.toFixed(2)}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {product.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setShowForm(true);
                    }}
                    className="p-2 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product)}
                    className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inventory Info */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Estoque Disponível</h4>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  product.stock_quantity > 0 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {product.stock_quantity} itens
                </span>
              </div>

              {inventory[product.id] && inventory[product.id].length > 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3 max-h-32 overflow-y-auto">
                  <div className="space-y-1">
                    {inventory[product.id].slice(0, 3).map((item, index) => (
                      <div key={index} className="text-xs font-mono text-gray-600 dark:text-gray-400">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{item.email}</div>
                            <div className="text-gray-500">••••••••</div>
                          </div>
                          <div className={`text-xs ${
                            item.status === 'available' ? 'text-green-600' :
                            item.status === 'reserved' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {item.status === 'available' ? 'Disponível' :
                             item.status === 'reserved' ? 'Reservado' :
                             'Vendido'}
                          </div>
                        </div>
                      </div>
                    ))}
                    {inventory[product.id].length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 italic">
                        +{inventory[product.id].length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  <p className="text-xs">Sem estoque disponível</p>
                </div>
              )}

              <button
                onClick={() => openInventoryManager(product.id)}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Gerenciar Estoque</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nenhum produto encontrado</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Crie seu primeiro produto para começar
          </p>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Ex: Netflix Premium, Disney+ Family..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Preço (USD) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.01"
                      value={formData.price_usd}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_usd: parseFloat(e.target.value) }))}
                      className="mt-1 block w-full pl-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="0.01"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Descrição do produto..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoria Primária *
                </label>
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {PRIMARY_CATEGORIES.map(cat => {
                    const icons: Record<string, React.ReactNode> = {
                      UserCheck: <UserCheck className="w-5 h-5" />,
                      Package: <Package className="w-5 h-5" />,
                      Smartphone: <Smartphone className="w-5 h-5" />,
                      Gamepad2: <Gamepad2 className="w-5 h-5" />,
                      Gift: <Gift className="w-5 h-5" />,
                      Coins: <Coins className="w-5 h-5" />,
                    };
                    const isSelected = formData.primary_category === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, primary_category: cat.key }))}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {icons[cat.icon]}
                        <span className="text-xs font-medium text-center leading-tight">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Subcategoria *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="streaming">Streaming</option>
                    <option value="music">Música</option>
                    <option value="gaming">Gaming</option>
                    <option value="software">Software</option>
                    <option value="other">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    URL da Imagem
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="https://exemplo.com/imagem.jpg"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Produto ativo</span>
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.renewable}
                      onChange={(e) => setFormData(prev => ({ ...prev, renewable: e.target.checked }))}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Produto renovável</span>
                  </label>
                  <div className="ml-2 group relative">
                    <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                      ℹ️
                    </div>
                    <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Produtos renováveis podem ser comprados novamente após expiração
                      <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.manual_delivery}
                      onChange={(e) => setFormData(prev => ({ ...prev, manual_delivery: e.target.checked }))}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Entrega manual</span>
                  </label>
                  <div className="ml-2 group relative">
                    <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                      ℹ️
                    </div>
                    <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Produto será entregue manualmente pelo admin após a compra
                      <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.account_recharge}
                      onChange={(e) => setFormData(prev => ({ ...prev, account_recharge: e.target.checked }))}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Recarga de conta</span>
                  </label>
                  <div className="ml-2 group relative">
                    <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                      ℹ️
                    </div>
                    <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Usuario fornece email, senha e dados extras da conta. Admin confirma a entrega manualmente.
                      <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Time */}
              {(formData.manual_delivery || formData.account_recharge) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tempo de Entrega Estimado
                  </label>
                  <input
                    type="text"
                    value={formData.delivery_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, delivery_time: e.target.value }))}
                    placeholder="Ex: Até 24h, 1-3 dias úteis, Imediato..."
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Será exibido na página do produto
                  </p>
                </div>
              )}

              {/* Product Features */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Características do Produto
                  </label>
                  <button
                    type="button"
                    onClick={addFeature}
                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </button>
                </div>
                
                {formData.features.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma característica adicionada
                    </p>
                    <button
                      type="button"
                      onClick={addFeature}
                      className="mt-2 inline-flex items-center px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar primeira característica
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => updateFeature(index, e.target.value)}
                          className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-green-500 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          placeholder="Ex: Entrega instantânea, Suporte 24h, Garantia..."
                        />
                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  As características serão exibidas como badges verdes na loja para destacar os benefícios do produto
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Salvando...' : (editingProduct ? 'Atualizar' : 'Criar Produto')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory Management Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[55]">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            {(() => {
              const currentProduct = products.find(p => p.id === selectedProductId);
              if (!currentProduct) return null;
              
              return (
                <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Gerenciar Estoque
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {currentProduct.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowInventoryModal(false);
                  setSelectedProductId('');
                  setInventoryForm([]);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleInventorySubmit} className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Contas de Acesso ({inventoryForm.length})
                </label>
                <button
                  type="button"
                  onClick={addInventoryItem}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar Conta
                </button>
              </div>

              {inventoryForm.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <List className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma conta adicionada
                  </p>
                  {currentProduct.renewable && (
                    <div className="mb-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        🔄 Renovável
                      </span>
                    </div>
                  )}
                  {(currentProduct as any).account_recharge && (
                    <div className="mb-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                        ⚡ Recarga de Conta
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={addInventoryItem}
                    className="mt-2 inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar primeira conta
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {inventoryForm.map((item, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Conta #{index + 1}
                          {item.id && (
                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.status === 'available' ? 'bg-green-100 text-green-800' :
                              item.status === 'reserved' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {item.status === 'available' ? 'Disponível' :
                               item.status === 'reserved' ? 'Reservado' :
                               'Vendido'}
                            </span>
                          )}
                        </h4>
                        {(!item.id || item.status === 'available') && (
                          <button
                            type="button"
                            onClick={() => removeInventoryItem(index)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Email *
                          </label>
                          <input
                            type="email"
                            required
                            disabled={item.id && item.status !== 'available'}
                            value={item.email}
                            onChange={(e) => updateInventoryItem(index, 'email', e.target.value)}
                            className={`block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                              item.id && item.status !== 'available' 
                                ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' 
                                : 'bg-white dark:bg-gray-800'
                            }`}
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Senha *
                          </label>
                          <input
                            type="text"
                            required
                            disabled={item.id && item.status !== 'available'}
                            value={item.password}
                            onChange={(e) => updateInventoryItem(index, 'password', e.target.value)}
                            className={`block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                              item.id && item.status !== 'available' 
                                ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' 
                                : 'bg-white dark:bg-gray-800'
                            }`}
                            placeholder="senha123"
                          />
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Instruções (Opcional)
                        </label>
                        <textarea
                          rows={2}
                          disabled={item.id && item.status !== 'available'}
                          value={item.instructions}
                          onChange={(e) => updateInventoryItem(index, 'instructions', e.target.value)}
                          className={`block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                            item.id && item.status !== 'available' 
                              ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' 
                              : 'bg-white dark:bg-gray-800'
                          }`}
                          placeholder="Instruções especiais para esta conta..."
                        />
                      </div>
                      
                      {item.id && item.status === 'sold' && (
                        <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                          <p className="text-xs text-red-700 dark:text-red-400">
                            ⚠️ Esta conta já foi vendida e não pode ser editada
                          </p>
                        </div>
                      )}
                      
                      {item.id && item.status === 'reserved' && (
                        <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2">
                          <p className="text-xs text-yellow-700 dark:text-yellow-400">
                            ⏳ Esta conta está reservada para uma compra em andamento
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                  ℹ️ Informações Importantes
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• Cada conta será entregue automaticamente quando comprada</li>
                  <li>• O estoque é atualizado automaticamente e em tempo real</li>
                  <li>• Apenas contas com email e senha válidos serão salvas</li>
                  <li>• As contas são entregues na ordem de criação (FIFO)</li>
                  <li>• Contas vendidas ou reservadas não podem ser editadas</li>
                  <li>• Reservas expiram automaticamente em 5 minutos se não finalizadas</li>
                </ul>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setShowInventoryModal(false);
                    setSelectedProductId('');
                    setInventoryForm([]);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar Estoque'}
                </button>
              </div>
            </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Recent Ratings Section */}
      <div className="mt-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <RecentRatings limit={10} showTitle={true} />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.show}
        title="Excluir Conta do Estoque"
        message="Tem certeza que deseja excluir esta conta do estoque? Esta ação não pode ser desfeita."
        itemInfo={deleteModal.item ? `Email: ${deleteModal.item.email}` : undefined}
        onConfirm={confirmDeleteInventoryItem}
        onCancel={() => setDeleteModal({ show: false, item: null, index: -1 })}
        isLoading={isDeleting}
      />
    </div>
  );
}