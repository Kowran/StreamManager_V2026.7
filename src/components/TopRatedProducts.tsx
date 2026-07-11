import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, Award, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface TopRatedProduct {
  product_id: string;
  product_name: string;
  average_rating: number;
  total_ratings: number;
  category: string;
  price_usdt: number;
}

interface TopRatedProductsProps {
  limit?: number;
  showTitle?: boolean;
}

export function TopRatedProducts({ limit = 5, showTitle = true }: TopRatedProductsProps) {
  const { t } = useLanguage();
  const [topProducts, setTopProducts] = useState<TopRatedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopRatedProducts();
  }, [limit]);

  async function loadTopRatedProducts() {
    try {
      const { data, error } = await supabase
        .rpc('get_top_rated_products', { limit_count: limit });

      if (error) throw error;
      setTopProducts(data || []);
    } catch (error) {
      console.error('Error loading top rated products:', error);
    } finally {
      setLoading(false);
    }
  }

  function renderStars(rating: number) {
    return (
      <div className="flex items-center space-x-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < Math.round(rating)
                ? 'text-yellow-500 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: limit }, (_, i) => (
          <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
    );
  }

  if (topProducts.length === 0) {
    return (
      <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <Award className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t.language === 'pt' ? 'Nenhum produto avaliado ainda' :
           t.language === 'en' ? 'No products rated yet' :
           'Aún no hay productos calificados'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t.language === 'pt' ? 'Produtos Mais Bem Avaliados' :
             t.language === 'en' ? 'Top Rated Products' :
             'Productos Mejor Calificados'}
          </h3>
        </div>
      )}

      <div className="space-y-3">
        {topProducts.map((product, index) => (
          <div key={product.product_id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-600' :
                    'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {product.product_name}
                  </h4>
                  <div className="flex items-center space-x-3 mt-1">
                    {renderStars(product.average_rating)}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {product.average_rating.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({product.total_ratings} {t.language === 'pt' ? 'avaliações' :
                                                t.language === 'en' ? 'reviews' :
                                                'reseñas'})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {product.category}
                    </span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      ${product.price_usdt.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              
              {index === 0 && (
                <div className="flex-shrink-0 ml-3">
                  <div className="bg-yellow-100 dark:bg-yellow-900/20 p-2 rounded-lg">
                    <Award className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}