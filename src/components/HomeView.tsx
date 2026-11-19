import { ArrowRight, Clock, MapPin, Phone, Star, Tag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatPeso } from '../lib/format';
import { FoodImage } from './FoodImage';
import { ProductCard } from './ProductCard';

export function HomeView() {
  const {
    categories,
    products,
    branches,
    promotions,
    catalogLoading,
    selectedBranchId,
    setSelectedBranchId,
    setMenuCategorySlug,
    setPage,
    showToast,
  } = useApp();

  const featuredProducts = products.filter((p) => p.isFeatured).slice(0, 3);
  const bestSellers = products.filter((p) => p.isBestSeller).slice(0, 3);
  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  const allReviews = products
    .flatMap((p) => p.reviews.map((r) => ({ ...r, productName: p.name })))
    .slice(0, 3);

  const openMenuCategory = (slug: string) => {
    setMenuCategorySlug(slug);
    setPage('menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="border-b border-neutral-100 bg-gradient-to-b from-red-50/40 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-red-600">
                Fresh off the flat-top grill · Pickup &amp; Delivery
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-neutral-950 tracking-tight leading-[1.08] text-balance">
                Craving Something Delicious?
              </h1>
              <p className="text-base text-neutral-600 leading-relaxed max-w-xl">
                Order grilled beef burgers, signature Buy 1 Take 1 classics, savory footlong
                hotdogs, crispy sandwiches, and chilled drinks online. Pick up at your nearest
                branch or have it delivered hot to your door.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => openMenuCategory('all')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <span>Order Now</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage('track')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-neutral-950 text-sm font-semibold transition-colors cursor-pointer"
                >
                  <span>Track My Order</span>
                </button>
              </div>

              {/* Branch Selector Strip */}
              {branches.length > 0 && (
                <div className="pt-4 border-t border-neutral-200/80 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 whitespace-nowrap">
                    <MapPin className="h-4 w-4 text-red-600" />
                    <span>Ordering from:</span>
                  </div>
                  <select
                    value={selectedBranchId ?? ''}
                    onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                    className="px-3.5 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-medium text-neutral-900 focus:outline-none focus:border-red-600"
                    aria-label="Select branch"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} disabled={!b.isAvailable}>
                        {b.name} {b.isAvailable ? `· ${b.operatingHours}` : '(Closed)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[300px] lg:min-h-[420px] rounded-3xl overflow-hidden border border-neutral-200 shadow-lg bg-neutral-100">
                <FoodImage
                  src="/src/assets/images/hero_burger_feast_1795052474885.jpg"
                  alt="Freshly grilled double cheeseburger with crispy golden fries"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-6 text-white">
                  <div className="text-xs font-medium text-yellow-300">
                    Made to order · Live status tracking
                  </div>
                  <div className="font-display text-lg font-bold mt-0.5">
                    {activeBranch ? `${activeBranch.name} · ${activeBranch.operatingHours}` : 'Fresh Grill Classics'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
              Popular Categories
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              Explore our grill favorites, value pairings, and refreshments.
            </p>
          </div>
          <button
            onClick={() => openMenuCategory('all')}
            className="text-sm font-semibold text-red-600 hover:text-red-700 whitespace-nowrap cursor-pointer"
          >
            View full menu
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => openMenuCategory(cat.slug)}
              className="text-left p-4 rounded-2xl border border-neutral-200 bg-white hover:border-red-500 hover:bg-red-50/30 transition-colors flex flex-col justify-between space-y-2 cursor-pointer"
            >
              <span className="font-display text-sm font-bold text-neutral-900">{cat.name}</span>
              <span className="text-xs text-neutral-500 line-clamp-2">{cat.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Food Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
              Featured Favorites
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              Freshly prepared menu highlights managed live from our kitchen catalog.
            </p>
          </div>
        </div>

        {catalogLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 rounded-2xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Best-Selling Products & Active Promotions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {bestSellers.length > 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
                Best-Selling Products
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                Top customer picks across our Manila, Quezon City, and Makati branches.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {bestSellers.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {promotions.length > 0 && (
          <div className="rounded-3xl bg-neutral-950 text-white p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
                Active Storefront Coupons
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                Special Offers &amp; Promo Codes
              </h2>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Apply an active store coupon in your shopping cart during checkout to unlock
                instant savings on eligible orders.
              </p>
            </div>
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {promotions.map((promo) => (
                <div
                  key={promo.code}
                  className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-yellow-400 tracking-wide">
                      {promo.code}
                    </span>
                    <Tag className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-xs text-neutral-300">{promo.description}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(promo.code);
                      showToast(`Promo code ${promo.code} copied!`);
                    }}
                    className="text-xs font-semibold text-white underline underline-offset-4 hover:text-yellow-400 cursor-pointer"
                  >
                    Copy Code (Min. {formatPeso(promo.minOrderCents)})
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* How It Works & Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-6 space-y-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
            How Ordering Works
          </h2>
          <div className="space-y-4">
            {[
              {
                step: '01. Choose Your Branch & Menu',
                text: 'Pick your nearest store branch and browse freshly grilled burgers, hotdogs, sandwiches, and drinks.',
              },
              {
                step: '02. Select Pickup or Delivery',
                text: 'Customize add-ons, choose Cash on Delivery, Cash on Pickup, or GCash, and schedule your pickup time.',
              },
              {
                step: '03. Track Your Order Live',
                text: 'Follow real-time kitchen progress from Pending and Preparing all the way to Ready for Pickup or Out for Delivery.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-5 rounded-2xl border border-neutral-200 bg-white space-y-1"
              >
                <h3 className="font-display text-base font-bold text-neutral-900">{item.step}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900">
            Customer Feedback
          </h2>
          <div className="space-y-4">
            {allReviews.length > 0 ? (
              allReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-2xl border border-neutral-200 bg-neutral-50/70 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-900">
                      {rev.authorName} · <span className="text-neutral-500">{rev.productName}</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-yellow-500">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-yellow-400" />
                      ))}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700 leading-relaxed">&ldquo;{rev.comment}&rdquo;</p>
                </div>
              ))
            ) : (
              <div className="p-5 rounded-2xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
                Customer reviews appear here as verified diners rate menu items.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Branches & Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-50 pt-12 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-2"
              >
                <h3 className="font-display text-base font-bold text-neutral-900">
                  {branch.name}
                </h3>
                <p className="text-xs text-neutral-600 flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{branch.address}</span>
                </p>
                <p className="text-xs text-neutral-600 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{branch.operatingHours}</span>
                </p>
                <p className="text-xs text-neutral-600 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="tabular-nums">{branch.contactNumber}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
            <p>
              Angel&apos;s Burger Online · Independent project concept for online food ordering and
              store management.
            </p>
            <div className="flex items-center gap-5">
              <button
                onClick={() => openMenuCategory('all')}
                className="hover:text-neutral-900 cursor-pointer"
              >
                Menu
              </button>
              <button
                onClick={() => setPage('track')}
                className="hover:text-neutral-900 cursor-pointer"
              >
                Track Order
              </button>
              <button
                onClick={() => setPage('admin-login')}
                className="hover:text-neutral-900 cursor-pointer"
              >
                Admin Portal
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
