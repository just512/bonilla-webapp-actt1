import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProductCard } from './ProductCard';

export function MenuView() {
  const {
    categories,
    products,
    catalogLoading,
    catalogError,
    refreshCatalog,
    menuCategorySlug,
    setMenuCategorySlug,
  } = useApp();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const activeCategoryId = useMemo(() => {
    if (menuCategorySlug === 'all') return null;
    return categories.find((c) => c.slug === menuCategorySlug)?.id ?? null;
  }, [categories, menuCategorySlug]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => {
      if (activeCategoryId !== null && p.categoryId !== activeCategoryId) return false;
      if (onlyAvailable && !p.inStock) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') {
      list = [...list].sort((a, b) => a.priceCents - b.priceCents);
    } else if (sortBy === 'price-desc') {
      list = [...list].sort((a, b) => b.priceCents - a.priceCents);
    } else if (sortBy === 'rating') {
      list = [...list].sort((a, b) => b.avgRating - a.avgRating);
    } else {
      list = [...list].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
    }

    return list;
  }, [products, activeCategoryId, onlyAvailable, search, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-neutral-950">Food Menu</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Browse all freshly cooked burgers, hotdogs, sandwiches, drinks, and value bundles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search burgers, hotdogs..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-300 bg-white">
            <SlidersHorizontal className="h-4 w-4 text-neutral-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm font-medium text-neutral-800 bg-transparent focus:outline-none"
              aria-label="Sort products"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMenuCategorySlug('all')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              menuCategorySlug === 'all'
                ? 'bg-red-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setMenuCategorySlug(cat.slug)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                menuCategorySlug === cat.slug
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="h-4 w-4 accent-red-600 rounded"
          />
          <span>Show available only</span>
        </label>
      </div>

      {catalogError ? (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
          <span>{catalogError}</span>
          <button
            onClick={() => refreshCatalog()}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : catalogLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-80 rounded-2xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-16 text-center space-y-3 border border-neutral-200 rounded-2xl bg-neutral-50">
          <h3 className="font-display text-lg font-bold text-neutral-900">No matching items found</h3>
          <p className="text-sm text-neutral-600">
            Try clearing your search or selecting another food category.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setMenuCategorySlug('all');
              setOnlyAvailable(false);
            }}
            className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
