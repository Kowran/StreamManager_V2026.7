import React, { useState, useEffect } from 'react';
import { ChevronLeft, Gamepad2, Search, Loader, Package } from 'lucide-react';
import { supabase, ProductCategory } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface GameCategoriesPageProps {
  onBack: () => void;
  onCategoryClick: (slug: string) => void;
}

export function GameCategoriesPage({ onBack, onCategoryClick }: GameCategoriesPageProps) {
  const { t, language } = useLanguage();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);

      // Count products per category
      const { data: products } = await supabase
        .from('store_products')
        .select('primary_category_id, category')
        .eq('active', true);

      const counts: Record<string, number> = {};
      (data || []).forEach((cat: any) => {
        const matching = (products || []).filter((p: any) => {
          return p.primary_category_id === cat.id;
        });
        counts[cat.id] = matching.length;
      });
      setProductCounts(counts);
    } catch (e) {
      console.error('Error loading categories:', e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader className="h-10 w-10 animate-spin text-blue-500" />
        <p className="mt-3 text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {language === 'pt' ? 'Voltar à loja' : language === 'en' ? 'Back to store' : 'Volver a la tienda'}
      </button>

      {/* Hero header */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-gray-900 to-gray-700 min-h-[160px] sm:min-h-[200px]">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-transparent" />
        <div className="relative p-6 sm:p-8 flex flex-col justify-end h-full min-h-[160px] sm:min-h-[200px]">
          <div className="flex items-center gap-3 mb-2">
            <Gamepad2 className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {language === 'pt' ? 'Categorias de Jogos' : language === 'en' ? 'Game Categories' : 'Categorías de Juegos'}
            </h1>
          </div>
          <p className="text-white/80 text-sm">
            {language === 'pt'
              ? `${filtered.length} categorias disponíveis`
              : language === 'en'
                ? `${filtered.length} categories available`
                : `${filtered.length} categorías disponibles`}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder={language === 'pt' ? 'Buscar categorias...' : language === 'en' ? 'Search categories...' : 'Buscar categorías...'}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Categories grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-14 w-14 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {language === 'pt' ? 'Nenhuma categoria encontrada.' : language === 'en' ? 'No categories found.' : 'No se encontraron categorías.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filtered.map(cat => {
            const count = productCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryClick(cat.slug)}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 shadow-sm hover:shadow-2xl hover:scale-[1.04] transition-all duration-200 border border-gray-700 dark:border-gray-600"
              >
                {cat.image_url ? (
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Gamepad2 className="h-12 w-12 text-gray-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white text-sm font-bold leading-tight line-clamp-2 text-center mb-1">{cat.name}</p>
                  <p className="text-white/60 text-xs text-center">
                    {count} {language === 'pt' ? 'anúncios' : language === 'en' ? 'listings' : 'anuncios'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
