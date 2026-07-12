import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Package, Search, Save, X, DollarSign, List,
  Upload, Store as StoreIcon, ShoppingCart
} from 'lucide-react';
import { supabase, StoreProduct } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';

interface ProductFormData {
  name: string;
  description: string;
  price_usd: number;
  category: string;
  image_url: string;
  active: boolean;
  features: string[];
  renewable: boolean;
  manual_delivery: boolean;
}

interface InventoryItem {
  id?: string;
  email: string;
  password: string;
  instructions: string;
  status?: string;
}

export function SellerProductsManager() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [inventory, setInventory] = useState<Record<string, InventoryItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '', description: '', price_usd: 0, category: 'streaming',
    image_url: '', active: true, features: [], renewable: false, manual_delivery: false,
  });
  const [inventoryForm, setInventoryForm] = useState<InventoryItem[]>([]);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    if (user) loadProducts();
  }, [user]);

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        description: editingProduct.description || '',
        price_usd: editingProduct.price_usdt,
        category: editingProduct.category,
        image_url: editingProduct.image_url || '',
        active: editingProduct.active,
        features: editingProduct.features || [],
        renewable: editingProduct.renewable || false,
        manual_delivery: editingProduct.manual_delivery || false,
      });
    } else {
      setFormData({
        name: '', description: '', price_usd: 0, category: 'streaming',
        image_url: '', active: true, features: [], renewable: false, manual_delivery: false,
      });
    }
  }, [editingProduct]);

  async function loadProducts() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('seller_id', user.id)
        .order('name');
      if (error) throw error;
      setProducts(data || []);

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
    } finally {
      setLoading(false);
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

  function addInventoryItem() {
    setInventoryForm(prev => [...prev, { email: '', password: '', instructions: lbl('Use estas credenciais para acessar sua conta.', 'Use these credentials to access your account.', 'Use estas credenciales para acceder a tu cuenta.') }]);
  }

  async function removeInventoryItem(index: number) {
    const item = inventoryForm[index];
    if (item.id) {
      if (!confirm(lbl('Excluir esta conta do estoque?', 'Delete this account from stock?', '¿Eliminar esta cuenta del stock?'))) return;
      try {
        await supabase.from('product_inventory').delete().eq('id', item.id);
        await loadProductInventory(selectedProductId);
      } catch (error) {
        console.error('Error deleting inventory item:', error);
        return;
      }
    }
    setInventoryForm(prev => prev.filter((_, i) => i !== index));
  }

  function updateInventoryItem(index: number, field: keyof InventoryItem, value: string) {
    setInventoryForm(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function addFeature() {
    setFormData(prev => ({ ...prev, features: [...prev.features, ''] }));
  }

  function removeFeature(index: number) {
    setFormData(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  }

  function updateFeature(index: number, value: string) {
    setFormData(prev => ({ ...prev, features: prev.features.map((f, i) => i === index ? value : f) }));
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
        image_url: formData.image_url || null,
        auto_delivery: true,
        active: formData.active,
        features: formData.features.filter(f => f.trim() !== ''),
        renewable: formData.renewable,
        manual_delivery: formData.manual_delivery,
        stock_quantity: 0,
        seller_id: user?.id,
        updated_at: new Date().toISOString(),
      };

      if (editingProduct) {
        const { error } = await supabase.from('store_products').update(productData).eq('id', editingProduct.id).eq('seller_id', user?.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('store_products').insert([productData]);
        if (error) throw error;
      }

      await loadProducts();
      setShowForm(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving product:', error);
      alert(lbl('Erro ao salvar produto', 'Error saving product', 'Error al guardar producto'));
    } finally {
      setSaving(false);
    }
  }

  async function handleInventorySubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const validItems = inventoryForm.filter(item => !item.id && item.email.trim() && item.password.trim());
      if (validItems.length > 0) {
        const inventoryData = validItems.map(item => ({
          product_id: selectedProductId,
          email: item.email.trim(),
          password: item.password.trim(),
          instructions: item.instructions.trim() || lbl('Use estas credenciais.', 'Use these credentials.', 'Use estas credenciales.'),
          status: 'available',
        }));
        const { error } = await supabase.from('product_inventory').insert(inventoryData);
        if (error) throw error;
      }

      const existingItems = inventoryForm.filter(item => item.id && item.email.trim() && item.password.trim() && (!item.status || item.status === 'available'));
      for (const item of existingItems) {
        await supabase.from('product_inventory')
          .update({ email: item.email.trim(), password: item.password.trim(), instructions: item.instructions.trim(), updated_at: new Date().toISOString() })
          .eq('id', item.id).eq('status', 'available');
      }

      await loadProducts();
      setShowInventoryModal(false);
      setSelectedProductId('');
      setInventoryForm([]);
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert(lbl('Erro ao salvar estoque', 'Error saving inventory', 'Error al guardar stock'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(product: StoreProduct) {
    const confirmMsg = lbl(
      `Excluir "${product.name}"? Esta ação não pode ser desfeita.`,
      `Delete "${product.name}"? This cannot be undone.`,
      `¿Eliminar "${product.name}"? No se puede deshacer.`
    );
    if (!confirm(confirmMsg)) return;

    try {
      await supabase.from('product_inventory').delete().eq('product_id', product.id);
      const { error } = await supabase.from('store_products').delete().eq('id', product.id).eq('seller_id', user?.id);
      if (error) throw error;
      await loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert(lbl('Erro ao excluir produto', 'Error deleting product', 'Error al eliminar producto'));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={lbl('Buscar produtos...', 'Search products...', 'Buscar productos...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {lbl('Novo Produto', 'New Product', 'Nuevo Producto')}
        </button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{product.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{product.description}</p>
                  <div className="mt-2">
                    <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
                  </div>
                  {product.features && product.features.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {product.features.slice(0, 3).map((feature, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
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
                  <div className="flex items-center space-x-3 mt-2">
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">${product.price_usdt.toFixed(2)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${product.active ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {product.active ? lbl('Ativo', 'Active', 'Activo') : lbl('Inativo', 'Inactive', 'Inactivo')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <button onClick={() => { setEditingProduct(product); setShowForm(true); }}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors" title={lbl('Editar', 'Edit', 'Editar')}>
                    <Plus className="h-4 w-4 rotate-90" />
                  </button>
                  <button onClick={() => handleDeleteProduct(product)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title={lbl('Excluir', 'Delete', 'Eliminar')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{lbl('Estoque', 'Stock', 'Stock')}</h4>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${product.stock_quantity > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'}`}>
                  {product.stock_quantity} {lbl('itens', 'items', 'artículos')}
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
                          <div className={`text-xs ${item.status === 'available' ? 'text-green-600' : item.status === 'reserved' ? 'text-yellow-600' : 'text-red-600'}`}>
                            {item.status === 'available' ? lbl('Disponível', 'Available', 'Disponible') : item.status === 'reserved' ? lbl('Reservado', 'Reserved', 'Reservado') : lbl('Vendido', 'Sold', 'Vendido')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {inventory[product.id].length > 3 && (
                      <div className="text-xs text-gray-500 italic">+{inventory[product.id].length - 3} {lbl('mais', 'more', 'más')}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  <p className="text-xs">{lbl('Sem estoque', 'No stock', 'Sin stock')}</p>
                </div>
              )}
              <button onClick={() => openInventoryManager(product.id)}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                <Upload className="h-4 w-4" />
                {lbl('Gerenciar Estoque', 'Manage Stock', 'Gestionar Stock')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{lbl('Nenhum produto', 'No products', 'Sin productos')}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{lbl('Crie seu primeiro produto', 'Create your first product', 'Crea tu primer producto')}</p>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <ProductFormModal
          editing={!!editingProduct}
          formData={formData}
          setFormData={setFormData}
          onClose={() => { setShowForm(false); setEditingProduct(null); }}
          onSubmit={handleSubmit}
          saving={saving}
          addFeature={addFeature}
          removeFeature={removeFeature}
          updateFeature={updateFeature}
          lbl={lbl}
        />
      )}

      {/* Inventory Modal */}
      {showInventoryModal && (
        <InventoryModal
          product={products.find(p => p.id === selectedProductId)}
          inventoryForm={inventoryForm}
          addInventoryItem={addInventoryItem}
          removeInventoryItem={removeInventoryItem}
          updateInventoryItem={updateInventoryItem}
          onClose={() => { setShowInventoryModal(false); setSelectedProductId(''); setInventoryForm([]); }}
          onSubmit={handleInventorySubmit}
          saving={saving}
          lbl={lbl}
        />
      )}
    </div>
  );
}

const inputClass = "w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400";

function ProductFormModal({ editing, formData, setFormData, onClose, onSubmit, saving, addFeature, removeFeature, updateFeature, lbl }: {
  editing: boolean;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  addFeature: () => void;
  removeFeature: (i: number) => void;
  updateFeature: (i: number, v: string) => void;
  lbl: (pt: string, en: string, es: string) => string;
}) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={onClose}>
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{editing ? lbl('Editar Produto', 'Edit Product', 'Editar Producto') : lbl('Novo Produto', 'New Product', 'Nuevo Producto')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="h-6 w-6" /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lbl('Nome *', 'Name *', 'Nombre *')}</label>
              <input type="text" required value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`mt-1 ${inputClass}`} placeholder="Netflix Premium..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lbl('Preço (USD) *', 'Price (USD) *', 'Precio (USD) *')}</label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="number" required step="0.01" min="0.01" value={formData.price_usd}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_usd: parseFloat(e.target.value) }))}
                  className={`pl-10 ${inputClass}`} placeholder="0.01" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lbl('Descrição', 'Description', 'Descripción')}</label>
            <textarea rows={3} value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className={`mt-1 ${inputClass}`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lbl('Categoria *', 'Category *', 'Categoría *')}</label>
              <select required value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className={`mt-1 ${inputClass}`}>
                <option value="streaming">Streaming</option>
                <option value="music">{lbl('Música', 'Music', 'Música')}</option>
                <option value="gaming">Gaming</option>
                <option value="software">Software</option>
                <option value="other">{lbl('Outros', 'Other', 'Otros')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lbl('URL da Imagem', 'Image URL', 'URL de Imagen')}</label>
              <input type="url" value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                className={`mt-1 ${inputClass}`} placeholder="https://..." />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="checkbox" checked={formData.active}
                onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{lbl('Produto ativo', 'Active product', 'Producto activo')}</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" checked={formData.renewable}
                onChange={(e) => setFormData(prev => ({ ...prev, renewable: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{lbl('Renovável', 'Renewable', 'Renovable')}</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" checked={formData.manual_delivery}
                onChange={(e) => setFormData(prev => ({ ...prev, manual_delivery: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{lbl('Entrega manual', 'Manual delivery', 'Entrega manual')}</span>
            </label>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lbl('Características', 'Features', 'Características')}</label>
              <button type="button" onClick={addFeature}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 rounded-md">
                <Plus className="h-3 w-3 mr-1" />{lbl('Adicionar', 'Add', 'Añadir')}
              </button>
            </div>
            {formData.features.length === 0 ? (
              <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-sm text-gray-500 dark:text-gray-400">{lbl('Nenhuma característica', 'No features', 'Sin características')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input type="text" value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                      className={`flex-1 ${inputClass}`} placeholder={lbl('Entrega instantânea...', 'Instant delivery...', 'Entrega instantánea...')} />
                    <button type="button" onClick={() => removeFeature(index)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
              {lbl('Cancelar', 'Cancel', 'Cancelar')}
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
              {saving ? lbl('Salvando...', 'Saving...', 'Guardando...') : editing ? lbl('Atualizar', 'Update', 'Actualizar') : lbl('Criar', 'Create', 'Crear')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InventoryModal({ product, inventoryForm, addInventoryItem, removeInventoryItem, updateInventoryItem, onClose, onSubmit, saving, lbl }: {
  product?: StoreProduct;
  inventoryForm: InventoryItem[];
  addInventoryItem: () => void;
  removeInventoryItem: (i: number) => void;
  updateInventoryItem: (i: number, f: keyof InventoryItem, v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  lbl: (pt: string, en: string, es: string) => string;
}) {
  if (!product) return null;
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[55]" onClick={onClose}>
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{lbl('Gerenciar Estoque', 'Manage Stock', 'Gestionar Stock')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="h-6 w-6" /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {lbl('Contas', 'Accounts', 'Cuentas')} ({inventoryForm.length})
            </label>
            <button type="button" onClick={addInventoryItem}
              className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 rounded-md">
              <Plus className="h-3 w-3 mr-1" />{lbl('Adicionar Conta', 'Add Account', 'Añadir Cuenta')}
            </button>
          </div>
          {inventoryForm.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <List className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{lbl('Nenhuma conta', 'No accounts', 'Sin cuentas')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {inventoryForm.map((item, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {lbl('Conta', 'Account', 'Cuenta')} #{index + 1}
                      {item.id && (
                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'available' ? 'bg-green-100 text-green-800' :
                          item.status === 'reserved' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status === 'available' ? lbl('Disponível', 'Available', 'Disponible') :
                           item.status === 'reserved' ? lbl('Reservado', 'Reserved', 'Reservado') : lbl('Vendido', 'Sold', 'Vendido')}
                        </span>
                      )}
                    </h4>
                    {(!item.id || item.status === 'available') && (
                      <button type="button" onClick={() => removeInventoryItem(index)}
                        className="text-red-600 dark:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email *</label>
                      <input type="email" required disabled={!!item.id && item.status !== 'available'}
                        value={item.email}
                        onChange={(e) => updateInventoryItem(index, 'email', e.target.value)}
                        className={`text-sm ${inputClass} ${item.id && item.status !== 'available' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                        placeholder="email@example.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{lbl('Senha *', 'Password *', 'Contraseña *')}</label>
                      <input type="text" required disabled={!!item.id && item.status !== 'available'}
                        value={item.password}
                        onChange={(e) => updateInventoryItem(index, 'password', e.target.value)}
                        className={`text-sm ${inputClass} ${item.id && item.status !== 'available' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`}
                        placeholder="password123" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{lbl('Instruções', 'Instructions', 'Instrucciones')}</label>
                    <textarea rows={2} disabled={!!item.id && item.status !== 'available'}
                      value={item.instructions}
                      onChange={(e) => updateInventoryItem(index, 'instructions', e.target.value)}
                      className={`text-sm ${inputClass} ${item.id && item.status !== 'available' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
              {lbl('Cancelar', 'Cancel', 'Cancelar')}
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
              {saving ? lbl('Salvando...', 'Saving...', 'Guardando...') : lbl('Salvar Estoque', 'Save Stock', 'Guardar Stock')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
