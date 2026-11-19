import React, { useEffect, useState } from 'react';
import { Heart, Minus, Plus, Star, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../lib/api';
import { formatDateTime, formatPeso } from '../lib/format';
import { FoodImage } from './FoodImage';

export function ProductModal() {
  const {
    activeProduct,
    setActiveProduct,
    categories,
    addToCart,
    favoriteIds,
    toggleFavorite,
    user,
    setPage,
    setPostAuthRedirect,
    refreshCatalog,
    showToast,
  } = useApp();

  const [qty, setQty] = useState(1);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setQty(1);
    setSelectedOptionIds([]);
    setComment('');
    setRating(5);
  }, [activeProduct?.id]);

  if (!activeProduct) return null;

  const categoryName =
    categories.find((c) => c.id === activeProduct.categoryId)?.name || 'Menu Item';
  const isFav = favoriteIds.includes(activeProduct.id);
  const isFavorited = isFav;

  const optionsDelta = activeProduct.options
    .filter((o) => selectedOptionIds.includes(o.id))
    .reduce((sum, o) => sum + o.priceDeltaCents, 0);
  const totalUnitPrice = activeProduct.priceCents + optionsDelta;

  const toggleOption = (id: number) => {
    setSelectedOptionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setActiveProduct(null);
      setPostAuthRedirect('menu');
      setPage('login');
      showToast('Please sign in to submit a review.', 'info');
      return;
    }
    if (!comment.trim()) return;
    setSubmittingReview(true);
    try {
      await apiFetch(`/api/products/${activeProduct.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      });
      setComment('');
      showToast('Thank you for your review!');
      await refreshCatalog();
      setActiveProduct(null);
    } catch (err: any) {
      showToast(err?.message || 'Could not submit review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-neutral-200 shadow-2xl">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="text-xs font-medium text-neutral-500">
            <span>{categoryName}</span>
            <span className="mx-2">/</span>
            <span className="text-neutral-900 font-semibold">{activeProduct.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(activeProduct.id)}
              className={`p-2 rounded-full border transition-colors cursor-pointer ${
                isFavorited
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-neutral-200 text-neutral-500 hover:text-red-600'
              }`}
              aria-label="Toggle favorite"
            >
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-600' : ''}`} />
            </button>
            <button
              onClick={() => setActiveProduct(null)}
              className="p-2 rounded-full text-neutral-500 hover:bg-neutral-100 cursor-pointer"
              aria-label="Close product details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          {/* Left: Product Visual */}
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200">
              <FoodImage
                src={activeProduct.imageUrl}
                alt={activeProduct.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-600 pt-1">
              <span>
                {activeProduct.inStock
                  ? `In stock (${activeProduct.stockQuantity} available)`
                  : 'Currently unavailable'}
              </span>
              {activeProduct.reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-neutral-800">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" />
                  <span className="tabular-nums">{activeProduct.avgRating}</span>
                  <span>({activeProduct.reviewCount} reviews)</span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-neutral-900">
                  {activeProduct.name}
                </h2>
                <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                  {activeProduct.description}
                </p>
              </div>

              <div className="text-2xl font-bold text-red-600 tabular-nums">
                {formatPeso(totalUnitPrice)}
              </div>

              {activeProduct.options.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-neutral-100">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Optional Add-ons
                  </h3>
                  <div className="space-y-2">
                    {activeProduct.options.map((opt) => {
                      const checked = selectedOptionIds.includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                            checked
                              ? 'border-red-600 bg-red-50/50'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOption(opt.id)}
                              className="h-4 w-4 accent-red-600 rounded"
                            />
                            <span className="text-sm font-medium text-neutral-800">{opt.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-neutral-700 tabular-nums">
                            {opt.priceDeltaCents > 0 ? `+${formatPeso(opt.priceDeltaCents)}` : 'Free'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center border border-neutral-300 rounded-xl bg-white">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="p-2.5 text-neutral-700 hover:bg-neutral-100 rounded-l-xl cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-4 text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setQty((q) => Math.min(Math.max(1, activeProduct.stockQuantity), q + 1))
                    }
                    className="p-2.5 text-neutral-700 hover:bg-neutral-100 rounded-r-xl cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!activeProduct.inStock}
                  onClick={async () => {
                    await addToCart(activeProduct, qty, selectedOptionIds);
                    setActiveProduct(null);
                  }}
                  className="flex-1 py-3 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed tabular-nums"
                >
                  {activeProduct.inStock
                    ? `Add to Cart · ${formatPeso(totalUnitPrice * qty)}`
                    : 'Currently Unavailable'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="px-6 py-5 bg-neutral-50 border-t border-neutral-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-neutral-900">
              Customer Reviews ({activeProduct.reviewCount})
            </h3>
          </div>

          {activeProduct.reviews.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeProduct.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3.5 rounded-xl bg-white border border-neutral-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-900">{rev.authorName}</span>
                    <span className="inline-flex items-center gap-0.5 text-yellow-500">
                      {Array.from({ length: rev.rating }).map((_, idx) => (
                        <Star key={idx} className="h-3 w-3 fill-yellow-400" />
                      ))}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">{rev.comment}</p>
                  <div className="text-[11px] text-neutral-400">{formatDateTime(rev.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">No reviews yet. Be the first to review this item.</p>
          )}

          <form onSubmit={handleReviewSubmit} className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-medium"
            >
              <option value={5}>5 Stars</option>
              <option value={4}>4 Stars</option>
              <option value={3}>3 Stars</option>
              <option value={2}>2 Stars</option>
              <option value={1}>1 Star</option>
            </select>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={user ? 'Write a short review...' : 'Sign in to leave a review'}
              className="flex-1 px-3.5 py-2 rounded-xl border border-neutral-300 bg-white text-xs focus:outline-none focus:border-red-600"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              Submit Review
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
