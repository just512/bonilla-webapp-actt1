import { Eye, Heart, Plus, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatPeso } from '../lib/format';
import { Product } from '../types';
import { FoodImage } from './FoodImage';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { categories, addToCart, setActiveProduct, favoriteIds, toggleFavorite } = useApp();
  const categoryName = categories.find((c) => c.id === product.categoryId)?.name || 'Menu';
  const isFav = favoriteIds.includes(product.id);

  return (
    <article className="group bg-white rounded-2xl border border-neutral-200 overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
        <FoodImage
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          className={`absolute top-3 right-3 h-9 w-9 rounded-full flex items-center justify-center bg-white/95 border border-neutral-200 transition-colors cursor-pointer ${
            isFav ? 'text-red-600' : 'text-neutral-500 hover:text-red-600'
          }`}
          aria-label={`Favorite ${product.name}`}
        >
          <Heart className={`h-4 w-4 ${isFav ? 'fill-red-600' : ''}`} />
        </button>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-1.5">
          {/* Clean unboxed metadata with typographic separators */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs text-neutral-500">
            <span className="font-medium text-neutral-600">{categoryName}</span>
            <span aria-hidden="true">·</span>
            <span className={product.inStock ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
              {product.inStock ? 'Available' : 'Unavailable'}
            </span>
            {product.reviewCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-neutral-700 font-medium">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-500" />
                  <span className="tabular-nums">{product.avgRating}</span>
                </span>
              </>
            )}
          </div>

          <h3 className="font-display text-base font-bold text-neutral-900 leading-snug">
            {product.name}
          </h3>
          <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="space-y-3 pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-neutral-900 tabular-nums">
              {formatPeso(product.priceCents)}
            </span>
            {product.badgeText && (
              <span className="text-xs font-semibold text-red-600">{product.badgeText}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveProduct(product)}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View Details</span>
            </button>
            <button
              type="button"
              disabled={!product.inStock}
              onClick={() => addToCart(product, 1, [])}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add to Cart</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
