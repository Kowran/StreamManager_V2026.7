import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Package, Search, Save, X, DollarSign, List,
  Upload, Store as StoreIcon, ShoppingCart, Image as ImageIcon,
  ArrowLeft, Boxes, Zap, Hand, CheckCircle2, AlertCircle, Layers,
  Eye, EyeOff, Copy, FileText, UserCheck, Smartphone, Gamepad2, Gift, Coins
} from 'lucide-react';
import { supabase, StoreProduct, PrimaryCategory, PRIMARY_CATEGORIES } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';

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
  delivery_type: 'automatic' | 'manual' | 'recharge';
  delivery_time: string;
}

interface InventoryItem {
  id?: string;
  email: string;
  password: string;
  instructions: string;
  status?: string;
  created_at?: string;
}

type View = 'list' | 'create' | 'edit' | 'inventory';

export function SellerProductsManager() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [inventory, setInventory] = useState<Record<string, InventoryItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '', description: '', price_usd: 0, category: 'streaming', primary_category: 'item',
    image_url: '', active: true, features: [], renewable: false, delivery_type: 'automatic',
    delivery_time: '',
  });

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    if (user) loadProducts();
  }, [user]);

  useEffect(() => {
    if (editingProduct && view === 'edit') {
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
        delivery_type: editingProduct.account_recharge ? 'recharge' : editingProduct.manual_delivery ? 'manual' : 'automatic',
        delivery_time: editingProduct.delivery_time || '',
      });
    } else if (view === 'create') {
      setFormData({
        name: '', description: '', price_usd: 0, category: 'streaming',
        image_url: '', active: true, features: [], renewable: false, delivery_type: 'automatic',
        delivery_time: '',
      });
    }
  }, [editingProduct, view]);

  async function loadProducts() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });
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

  function openCreateView() {
    setEditingProduct(null);
    setView('create');
  }

  function openEditView(product: StoreProduct) {
    setEditingProduct(product);
    setView('edit');
  }

  function openInventoryManager(productId: string) {
    setSelectedProductId(productId);
    setView('inventory');
  }

  function backToList() {
    setView('list');
    setEditingProduct(null);
    setSelectedProductId('');
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

  if (view === 'create' || view === 'edit') {
    return (
      <ProductFormPage
        editing={view === 'edit'}
        formData={formData}
        setFormData={setFormData}
        onBack={backToList}
        onSubmit={handleSubmit}
        saving={saving}
        lbl={lbl}
        userId={user?.id || ''}
        editingProductId={editingProduct?.id}
      />
    );
  }

  if (view === 'inventory') {
    const product = products.find(p => p.id === selectedProductId);
    return (
      <InventoryPage
        product={product}
        onBack={backToList}
        lbl={lbl}
        userId={user?.id || ''}
        onSaved={loadProducts}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {lbl('Meus Produtos', 'My Products', 'Mis Productos')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lbl('Gerencie seus produtos e estoque', 'Manage your products and stock', 'Gestiona tus productos y stock')}
          </p>
        </div>
        <button
          onClick={openCreateView}
          className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-sm transition-all hover:shadow-md"
        >
          <Plus className="h-5 w-5 mr-2" />
          {lbl('Novo Produto', 'New Product', 'Nuevo Producto')}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={lbl('Buscar produtos...', 'Search products...', 'Buscar productos...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
        />
      </div>

      {/* Product List - Row-based */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table header - desktop */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <div className="col-span-4">{lbl('Produto', 'Product', 'Producto')}</div>
          <div className="col-span-2">{lbl('Categoria', 'Category', 'Categoría')}</div>
          <div className="col-span-2 text-center">{lbl('Estoque', 'Stock', 'Stock')}</div>
          <div className="col-span-1 text-center">{lbl('Preço', 'Price', 'Precio')}</div>
          <div className="col-span-1 text-center">{lbl('Status', 'Status', 'Estado')}</div>
          <div className="col-span-2 text-right">{lbl('Ações', 'Actions', 'Acciones')}</div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {lbl('Nenhum produto', 'No products', 'Sin productos')}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {lbl('Crie seu primeiro produto para começar a vender', 'Create your first product to start selling', 'Crea tu primer producto para empezar a vender')}
            </p>
            <button
              onClick={openCreateView}
              className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {lbl('Criar produto', 'Create product', 'Crear producto')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="grid grid-cols-1 lg:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
              >
                {/* Product info with image */}
                <div className="col-span-4 flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{product.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{product.description}</p>
                    {product.features && product.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {product.features.slice(0, 2).map((f, i) => (
                          <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {f}
                          </span>
                        ))}
                        {product.features.length > 2 && (
                          <span className="text-[10px] text-gray-400">+{product.features.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div className="hidden lg:block col-span-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                    {product.category}
                  </span>
                </div>

                {/* Stock */}
                <div className="hidden lg:flex col-span-2 justify-center">
                  <div className="text-center">
                    <span className={`inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1 rounded-lg text-xs font-bold ${
                      product.stock_quantity > 5
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : product.stock_quantity > 0
                        ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {product.stock_quantity}
                    </span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">
                      {lbl('itens', 'items', 'artículos')}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="hidden lg:block col-span-1 text-center">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    ${product.price_usdt.toFixed(2)}
                  </span>
                </div>

                {/* Status */}
                <div className="hidden lg:flex col-span-1 justify-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                    product.active
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${product.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {product.active ? lbl('Ativo', 'Active', 'Activo') : lbl('Inativo', 'Inactive', 'Inactivo')}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button
                    onClick={() => openInventoryManager(product.id)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title={lbl('Gerenciar Estoque', 'Manage Stock', 'Gestionar Stock')}
                  >
                    <Boxes className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openEditView(product)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title={lbl('Editar', 'Edit', 'Editar')}
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title={lbl('Excluir', 'Delete', 'Eliminar')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{product.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{product.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-base font-bold text-gray-900 dark:text-white">${product.price_usdt.toFixed(2)}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${product.active ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {product.active ? lbl('Ativo', 'Active', 'Activo') : lbl('Inativo', 'Inactive', 'Inactivo')}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${product.stock_quantity > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {product.stock_quantity} {lbl('est.', 'stock', 'stock')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => openInventoryManager(product.id)} className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Boxes className="h-3.5 w-3.5 mr-1" />{lbl('Estoque', 'Stock', 'Stock')}
              </button>
              <button onClick={() => openEditView(product)} className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <FileText className="h-3.5 w-3.5 mr-1" />{lbl('Editar', 'Edit', 'Editar')}
              </button>
              <button onClick={() => handleDeleteProduct(product)} className="inline-flex items-center justify-center p-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const isRecharge = formData.delivery_type === 'recharge' || formData.primary_category === 'top_up' || formData.primary_category === 'mobile_recharge';
      const productData = {
        name: formData.name,
        description: formData.description || null,
        price_brl: formData.price_usd * 5.5,
        price_usdt: formData.price_usd,
        category: formData.category,
        primary_category: formData.primary_category,
        image_url: formData.image_url || null,
        auto_delivery: formData.delivery_type === 'automatic',
        active: formData.active,
        features: formData.features.filter(f => f.trim() !== ''),
        renewable: formData.renewable,
        manual_delivery: formData.delivery_type === 'manual' || isRecharge,
        account_recharge: isRecharge,
        delivery_time: formData.delivery_time || null,
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
      backToList();
    } catch (error) {
      console.error('Error saving product:', error);
      alert(lbl('Erro ao salvar produto', 'Error saving product', 'Error al guardar producto'));
    } finally {
      setSaving(false);
    }
  }
}

/* ==================== Product Form Page (Full Screen) ==================== */

const inputClass = "w-full rounded-xl border-gray-200 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all";

function ProductFormPage({
  editing, formData, setFormData, onBack, onSubmit, saving, lbl, userId, editingProductId
}: {
  editing: boolean;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  lbl: (pt: string, en: string, es: string) => string;
  userId: string;
  editingProductId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [imagePreview, setImagePreview] = useState(formData.image_url || '');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setImagePreview(formData.image_url || '');
  }, [formData.image_url]);

  async function handleImageUpload(file: File) {
    setUploadError('');
    if (!file.type.startsWith('image/')) {
      setUploadError(lbl('Apenas imagens são permitidas', 'Only images are allowed', 'Solo se permiten imágenes'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(lbl('A imagem deve ter no máximo 5MB', 'Image must be at most 5MB', 'La imagen debe tener máximo 5MB'));
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { cacheControl: '3600' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      setImagePreview(publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(lbl('Erro ao enviar imagem', 'Error uploading image', 'Error al subir imagen'));
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
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

  const isRechargeCategory = formData.primary_category === 'top_up' || formData.primary_category === 'mobile_recharge';

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {lbl('Voltar', 'Back', 'Volver')}
        </button>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {editing ? lbl('Editar Produto', 'Edit Product', 'Editar Producto') : lbl('Novo Produto', 'New Product', 'Nuevo Producto')}
        </h2>
        <div className="w-20" />
      </div>

      <form onSubmit={onSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* Image Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            {lbl('Imagem do Produto', 'Product Image', 'Imagen del Producto')} <span className="text-red-500">*</span>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {lbl('Faça upload de uma imagem retangular (recomendado: 1200x800px, máx 5MB)', 'Upload a rectangular image (recommended: 1200x800px, max 5MB)', 'Sube una imagen rectangular (recomendado: 1200x800px, máx 5MB)')}
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl transition-all cursor-pointer overflow-hidden ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : imagePreview
                ? 'border-gray-200 dark:border-gray-700'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/30'
            }`}
            style={{ minHeight: '280px' }}
          >
            {imagePreview ? (
              <div className="relative w-full h-[280px] group">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      <Upload className="h-4 w-4 mr-1.5" />
                      {lbl('Trocar', 'Change', 'Cambiar')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, image_url: '' })); setImagePreview(''); }}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      {lbl('Remover', 'Remove', 'Quitar')}
                    </button>
                  </div>
                </div>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[280px] p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 mb-4">
                  {uploading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-blue-500" />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {uploading
                    ? lbl('Enviando...', 'Uploading...', 'Subiendo...')
                    : lbl('Clique ou arraste uma imagem aqui', 'Click or drag an image here', 'Haz clic o arrastra una imagen aquí')}
                </p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP, GIF — {lbl('máx 5MB', 'max 5MB', 'máx 5MB')}</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {uploadError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              {uploadError}
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {lbl('Informações Básicas', 'Basic Information', 'Información Básica')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {lbl('Nome do Produto', 'Product Name', 'Nombre del Producto')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={inputClass}
                placeholder={lbl('Ex: Netflix Premium 4K', 'Ex: Netflix Premium 4K', 'Ej: Netflix Premium 4K')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {lbl('Preço (USD)', 'Price (USD)', 'Precio (USD)')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  max="9999"
                  value={formData.price_usd || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_usd: parseFloat(e.target.value) || 0 }))}
                  className={`${inputClass} pl-10`}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {lbl('Descrição', 'Description', 'Descripción')}
            </label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className={inputClass}
              placeholder={lbl('Descreva seu produto em detalhes...', 'Describe your product in detail...', 'Describe tu producto en detalle...')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {lbl('Categoria Primária', 'Primary Category', 'Categoría Primaria')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
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
                    onClick={() => {
                      const isRechargeCat = cat.key === 'top_up' || cat.key === 'mobile_recharge';
                      setFormData(prev => ({
                        ...prev,
                        primary_category: cat.key,
                        delivery_type: isRechargeCat ? 'recharge' : (prev.delivery_type === 'recharge' ? 'automatic' : prev.delivery_type),
                      }));
                    }}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {icons[cat.icon]}
                    <span className="text-xs font-medium text-center leading-tight">{lbl(cat.label, cat.label, cat.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {lbl('Subcategoria', 'Subcategory', 'Subcategoría')} <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className={inputClass}
            >
              <option value="streaming">Streaming</option>
              <option value="music">{lbl('Música', 'Music', 'Música')}</option>
              <option value="gaming">Gaming</option>
              <option value="software">Software</option>
              <option value="other">{lbl('Outros', 'Other', 'Otros')}</option>
            </select>
          </div>
        </div>

        {/* Delivery Type - Required choice (hidden for recharge categories) */}
        {isRechargeCategory ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl shadow-sm border border-amber-200 dark:border-amber-700 p-6">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500 text-white">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                  {lbl('Produto de Recarga', 'Recharge Product', 'Producto de Recarga')}
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {lbl('Este produto é automaticamente configurado como recarga. O cliente envia email, senha e dados extras.', 'This product is automatically configured as recharge. Customer sends email, password and extra data.', 'Este producto se configura automáticamente como recarga. El cliente envía email, contraseña y datos extra.')}
                </p>
              </div>
            </div>
          </div>
        ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            {lbl('Tipo de Entrega', 'Delivery Type', 'Tipo de Entrega')} <span className="text-red-500">*</span>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {lbl('Escolha apenas uma opção de entrega', 'Choose only one delivery option', 'Elige solo una opción de entrega')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, delivery_type: 'automatic' }))}
              className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                formData.delivery_type === 'automatic'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${
                  formData.delivery_type === 'automatic'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                }`}>
                  <Zap className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {lbl('Entrega Automática', 'Automatic Delivery', 'Entrega Automática')}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {lbl('O cliente recebe as credenciais automaticamente após o pagamento', 'Customer receives credentials automatically after payment', 'El cliente recibe credenciales automáticamente tras el pago')}
                  </p>
                </div>
                {formData.delivery_type === 'automatic' && (
                  <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, delivery_type: 'manual' }))}
              className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                formData.delivery_type === 'manual'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${
                  formData.delivery_type === 'manual'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                }`}>
                  <Hand className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {lbl('Entrega Manual', 'Manual Delivery', 'Entrega Manual')}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {lbl('Você entrega as credenciais manualmente via chat após o pagamento', 'You deliver credentials manually via chat after payment', 'Entregas credenciales manualmente vía chat tras el pago')}
                  </p>
                </div>
                {formData.delivery_type === 'manual' && (
                  <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                )}
              </div>
            </button>
          </div>

          {/* Delivery Time Field - Manual only */}
          {formData.delivery_type === 'manual' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {lbl('Tempo de Entrega Estimado', 'Estimated Delivery Time', 'Tiempo de Entrega Estimado')}
              </label>
              <input
                type="text"
                value={formData.delivery_time}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_time: e.target.value }))}
                placeholder={lbl('Ex: Até 24h, 1-3 dias úteis, Imediato...', 'e.g. Up to 24h, 1-3 business days, Instant...', 'Ej: Hasta 24h, 1-3 días hábiles, Inmediato...')}
                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {lbl('Será exibido na página do produto', 'Will be shown on the product page', 'Se mostrará en la página del producto')}
              </p>
            </div>
          )}
        </div>
        )}

        {/* Delivery Time for Recharge Products */}
        {isRechargeCategory && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              {lbl('Tempo de Entrega da Recarga', 'Recharge Delivery Time', 'Tiempo de Entrega de Recarga')} <span className="text-red-500">*</span>
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {lbl('Selecione quanto tempo leva para processar a recarga', 'Select how long it takes to process the recharge', 'Selecciona cuánto tiempo toma procesar la recarga')}
            </p>
            <select
              value={formData.delivery_time}
              onChange={(e) => setFormData(prev => ({ ...prev, delivery_time: e.target.value }))}
              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-amber-500 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">{lbl('Selecione um tempo estimado...', 'Select an estimated time...', 'Selecciona un tiempo estimado...')}</option>
              <option value="10 minutos">{lbl('10 minutos', '10 minutes', '10 minutos')}</option>
              <option value="15 minutos">{lbl('15 minutos', '15 minutes', '15 minutos')}</option>
              <option value="30 minutos">{lbl('30 minutos', '30 minutes', '30 minutos')}</option>
              <option value="45 minutos">{lbl('45 minutos', '45 minutes', '45 minutos')}</option>
              <option value="60 minutos">{lbl('60 minutos (1 hora)', '60 minutes (1 hour)', '60 minutos (1 hora)')}</option>
              <option value="2 horas">{lbl('2 horas', '2 hours', '2 horas')}</option>
              <option value="4 horas">{lbl('4 horas', '4 hours', '4 horas')}</option>
              <option value="6 horas">{lbl('6 horas', '6 hours', '6 horas')}</option>
              <option value="12 horas">{lbl('12 horas', '12 hours', '12 horas')}</option>
              <option value="24 horas">{lbl('24 horas', '24 hours', '24 horas')}</option>
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {lbl('Este tempo será exibido na página do produto para o cliente', 'This time will be shown on the product page to the customer', 'Este tiempo se mostrará en la página del producto al cliente')}
            </p>
          </div>
        )}

        {/* Features */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {lbl('Características', 'Features', 'Características')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {lbl('Adicione os diferenciais do seu produto', 'Add your product highlights', 'Añade los diferenciales de tu producto')}
              </p>
            </div>
            <button
              type="button"
              onClick={addFeature}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              {lbl('Adicionar', 'Add', 'Añadir')}
            </button>
          </div>

          {formData.features.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <List className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400">
                {lbl('Nenhuma característica adicionada', 'No features added', 'Sin características')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {formData.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => updateFeature(index, e.target.value)}
                    className={inputClass}
                    placeholder={lbl('Ex: Tela 4K, 4 telas simultâneas...', 'Ex: 4K screen, 4 simultaneous screens...', 'Ej: Pantalla 4K, 4 pantallas simultáneas...')}
                  />
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    className="p-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            {lbl('Configurações', 'Settings', 'Configuración')}
          </h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${formData.active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${formData.active ? 'translate-x-5' : ''}`} />
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  className="sr-only"
                />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {lbl('Produto ativo', 'Active product', 'Producto activo')}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {lbl('Produto visível na loja', 'Product visible in store', 'Producto visible en la tienda')}
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${formData.renewable ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${formData.renewable ? 'translate-x-5' : ''}`} />
                <input
                  type="checkbox"
                  checked={formData.renewable}
                  onChange={(e) => setFormData(prev => ({ ...prev, renewable: e.target.checked }))}
                  className="sr-only"
                />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {lbl('Renovável', 'Renewable', 'Renovable')}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {lbl('Permite renovação do produto', 'Allows product renewal', 'Permite renovación del producto')}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {lbl('Cancelar', 'Cancel', 'Cancelar')}
          </button>
          <button
            type="submit"
            disabled={saving || !formData.image_url}
            className="inline-flex items-center px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? lbl('Salvando...', 'Saving...', 'Guardando...')
              : editing
              ? lbl('Atualizar Produto', 'Update Product', 'Actualizar Producto')
              : lbl('Criar Produto', 'Create Product', 'Crear Producto')}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ==================== Inventory Page (Full Screen) ==================== */

function InventoryPage({
  product, onBack, lbl, userId, onSaved
}: {
  product?: StoreProduct;
  onBack: () => void;
  lbl: (pt: string, en: string, es: string) => string;
  userId: string;
  onSaved: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'available' | 'sold'>('available');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [soldItems, setSoldItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newItems, setNewItems] = useState<InventoryItem[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
    if (product) loadInventory();
  }, [product]);

  async function loadInventory() {
    if (!product) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_inventory')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const all = data || [];
      setInventory(all.filter(i => i.status === 'available' || i.status === 'reserved'));
      setSoldItems(all.filter(i => i.status === 'sold'));
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  }

  function addNewItem() {
    setNewItems(prev => [...prev, {
      email: '', password: '',
      instructions: lbl('Use estas credenciais para acessar sua conta.', 'Use these credentials to access your account.', 'Use estas credenciales para acceder a tu cuenta.')
    }]);
  }

  function updateNewItem(index: number, field: keyof InventoryItem, value: string) {
    setNewItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function removeNewItem(index: number) {
    setNewItems(prev => prev.filter((_, i) => i !== index));
  }

  function parseBulkText() {
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    const parsed: InventoryItem[] = [];
    for (const line of lines) {
      const parts = line.split(/[;:|]/).map(p => p.trim());
      if (parts.length >= 2) {
        parsed.push({
          email: parts[0],
          password: parts[1],
          instructions: parts[2] || lbl('Use estas credenciais.', 'Use these credentials.', 'Use estas credenciales.'),
        });
      }
    }
    setNewItems(parsed);
  }

  async function saveNewItems() {
    const validItems = newItems.filter(item => item.email.trim() && item.password.trim());
    if (validItems.length === 0) {
      alert(lbl('Adicione pelo menos uma conta válida', 'Add at least one valid account', 'Añade al menos una cuenta válida'));
      return;
    }

    setSaving(true);
    try {
      const inventoryData = validItems.map(item => ({
        product_id: product!.id,
        email: item.email.trim(),
        password: item.password.trim(),
        instructions: item.instructions.trim() || lbl('Use estas credenciais.', 'Use these credentials.', 'Use estas credenciales.'),
        status: 'available',
      }));
      const { error } = await supabase.from('product_inventory').insert(inventoryData);
      if (error) throw error;

      setNewItems([]);
      setBulkText('');
      setBulkMode(false);
      await loadInventory();
      await onSaved();
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert(lbl('Erro ao salvar estoque', 'Error saving inventory', 'Error al guardar stock'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteInventoryItem(item: InventoryItem) {
    if (!item.id) return;
    if (!confirm(lbl('Excluir esta conta do estoque?', 'Delete this account from stock?', '¿Eliminar esta cuenta del stock?'))) return;
    try {
      await supabase.from('product_inventory').delete().eq('id', item.id);
      await loadInventory();
      await onSaved();
    } catch (error) {
      console.error('Error deleting inventory item:', error);
    }
  }

  async function updateInventoryItem(item: InventoryItem, field: keyof InventoryItem, value: string) {
    if (!item.id) return;
    try {
      await supabase.from('product_inventory')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', item.id).eq('status', 'available');
      await loadInventory();
    } catch (error) {
      console.error('Error updating inventory item:', error);
    }
  }

  if (!product) return null;

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {lbl('Voltar', 'Back', 'Volver')}
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{product.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {lbl('Gerenciar Estoque', 'Manage Stock', 'Gestionar Stock')}
          </p>
        </div>
        <div className="w-20" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 max-w-md">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'available'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Boxes className="h-4 w-4" />
          {lbl('Disponíveis', 'Available', 'Disponibles')}
          <span className={`inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-xs font-bold ${
            activeTab === 'available' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
          }`}>
            {inventory.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sold')}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'sold'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          {lbl('Vendidas', 'Sold', 'Vendidas')}
          <span className={`inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-xs font-bold ${
            activeTab === 'sold' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
          }`}>
            {soldItems.length}
          </span>
        </button>
      </div>

      {activeTab === 'available' ? (
        <div className="space-y-6">
          {/* Add accounts section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {lbl('Adicionar Contas', 'Add Accounts', 'Añadir Cuentas')}
              </h3>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => { setBulkMode(false); setNewItems([]); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!bulkMode ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}
                >
                  {lbl('Individual', 'Individual', 'Individual')}
                </button>
                <button
                  onClick={() => { setBulkMode(true); setNewItems([]); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${bulkMode ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}
                >
                  <Layers className="h-3 w-3 inline mr-1" />
                  {lbl('Em Massa', 'Bulk', 'En Masa')}
                </button>
              </div>
            </div>

            {bulkMode ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {lbl('Cole as contas (uma por linha: email:senha:instruções)', 'Paste accounts (one per line: email:password:instructions)', 'Pega las cuentas (una por línea: email:contraseña:instrucciones)')}
                  </label>
                  <textarea
                    rows={8}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className={`${inputClass} font-mono text-sm`}
                    placeholder="email1@example.com:password1:optional instructions&#10;email2@example.com:password2:optional instructions&#10;email3@example.com:password3"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {lbl('Separadores suportados: : ; |', 'Supported separators: : ; |', 'Separadores soportados: : ; |')}
                  </p>
                </div>
                <button
                  onClick={parseBulkText}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                >
                  <Layers className="h-4 w-4 mr-1.5" />
                  {lbl('Processar Contas', 'Process Accounts', 'Procesar Cuentas')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {newItems.length === 0 && (
                  <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <Boxes className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-400">
                      {lbl('Nenhuma nova conta adicionada', 'No new accounts added', 'Sin cuentas nuevas')}
                    </p>
                  </div>
                )}
                {newItems.map((item, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {lbl('Conta', 'Account', 'Cuenta')} #{index + 1}
                      </span>
                      <button
                        onClick={() => removeNewItem(index)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                        <input
                          type="email"
                          value={item.email}
                          onChange={(e) => updateNewItem(index, 'email', e.target.value)}
                          className={`${inputClass} text-sm`}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{lbl('Senha *', 'Password *', 'Contraseña *')}</label>
                        <input
                          type="text"
                          value={item.password}
                          onChange={(e) => updateNewItem(index, 'password', e.target.value)}
                          className={`${inputClass} text-sm`}
                          placeholder="password123"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">{lbl('Instruções', 'Instructions', 'Instrucciones')}</label>
                      <textarea
                        rows={2}
                        value={item.instructions}
                        onChange={(e) => updateNewItem(index, 'instructions', e.target.value)}
                        className={`${inputClass} text-sm`}
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={addNewItem}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 border-2 border-dashed border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {lbl('Adicionar Conta', 'Add Account', 'Añadir Cuenta')}
                </button>
              </div>
            )}

            {newItems.length > 0 && bulkMode && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {newItems.length} {lbl('contas processadas', 'accounts processed', 'cuentas procesadas')}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {newItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2">
                      <span className="font-mono text-gray-700 dark:text-gray-300">{item.email}</span>
                      <span className="text-gray-400">:</span>
                      <span className="font-mono text-gray-400">••••••</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {newItems.length > 0 && (
              <button
                onClick={saveNewItems}
                disabled={saving}
                className="w-full mt-4 inline-flex items-center justify-center px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {saving
                  ? lbl('Salvando...', 'Saving...', 'Guardando...')
                  : `${lbl('Salvar', 'Save', 'Guardar')} (${newItems.length} ${lbl('contas', 'accounts', 'cuentas')})`}
              </button>
            )}
          </div>

          {/* Available inventory list */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {lbl('Contas em Estoque', 'Accounts in Stock', 'Cuentas en Stock')} ({inventory.length})
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : inventory.length === 0 ? (
              <div className="text-center py-12">
                <Boxes className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-400">
                  {lbl('Nenhuma conta em estoque', 'No accounts in stock', 'Sin cuentas en stock')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {inventory.map((item) => (
                  <div key={item.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-400 uppercase mb-0.5">Email</label>
                          <input
                            type="text"
                            value={item.email}
                            disabled={item.status === 'reserved'}
                            onChange={(e) => updateInventoryItem(item, 'email', e.target.value)}
                            className={`${inputClass} text-sm py-1.5 ${item.status === 'reserved' ? 'opacity-60 cursor-not-allowed' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-400 uppercase mb-0.5">{lbl('Senha', 'Password', 'Contraseña')}</label>
                          <input
                            type="text"
                            value={item.password}
                            disabled={item.status === 'reserved'}
                            onChange={(e) => updateInventoryItem(item, 'password', e.target.value)}
                            className={`${inputClass} text-sm py-1.5 ${item.status === 'reserved' ? 'opacity-60 cursor-not-allowed' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-400 uppercase mb-0.5">{lbl('Instruções', 'Instructions', 'Instrucciones')}</label>
                          <input
                            type="text"
                            value={item.instructions}
                            disabled={item.status === 'reserved'}
                            onChange={(e) => updateInventoryItem(item, 'instructions', e.target.value)}
                            className={`${inputClass} text-sm py-1.5 ${item.status === 'reserved' ? 'opacity-60 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                          item.status === 'available'
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {item.status === 'available'
                            ? lbl('Disponível', 'Available', 'Disponible')
                            : lbl('Reservado', 'Reserved', 'Reservado')}
                        </span>
                        {item.status === 'available' && (
                          <button
                            onClick={() => deleteInventoryItem(item)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Sold items tab */
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {lbl('Contas Vendidas', 'Sold Accounts', 'Cuentas Vendidas')} ({soldItems.length})
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : soldItems.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">
                {lbl('Nenhuma conta vendida ainda', 'No accounts sold yet', 'Sin cuentas vendidas aún')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {soldItems.map((item) => (
                <div key={item.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{item.email}</span>
                        <span className="text-xs text-gray-400">••••••••</span>
                      </div>
                      {item.instructions && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{item.instructions}</p>
                      )}
                      {item.created_at && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {lbl('Vendido', 'Sold', 'Vendido')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
