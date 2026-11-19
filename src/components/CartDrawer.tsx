import { useState } from 'react';
import { Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../lib/api';
import { formatPeso } from '../lib/format';
import { FoodImage } from './FoodImage';

export function CartDrawer() {
  const {
    cartOpen,
    setCartOpen,
    cartItems,
    cartSubtotalCents,
    updateCartItemQty,
    removeCartItem,
    appliedCoupon,
    setAppliedCoupon,
    branches,
    selectedBranchId,
    setPage,
    proceedToCheckout,
    showToast,
  } = useApp();

  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);

  if (!cartOpen) return null;

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const deliveryFeeCents = activeBranch ? activeBranch.deliveryFeeCents : 0;
  const discountCents = appliedCoupon?.discountCents || 0;
  const grandTotalCents = Math.max(0, cartSubtotalCents + (cartItems.length ? deliveryFeeCents : 0) - discountCents);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    try {
      const res = await apiFetch<{ couponCode: string; discountCents: number }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code: couponInput, subtotalCents: cartSubtotalCents }),
        }
      );
      setAppliedCoupon({ code: res.couponCode, discountCents: res.discountCents });
      showToast(`Coupon ${res.couponCode} applied!`);
    } catch (err: any) {
      showToast(err?.message || 'Invalid coupon code.', 'error');
    } finally {
      setCouponBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 no-print">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-red-600" />
            <h2 className="font-display text-lg font-bold text-neutral-900">My Cart</h2>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-4">
              <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-neutral-900">
                  Your cart is empty
                </h3>
                <p className="text-sm text-neutral-500 max-w-xs">
                  Add grilled burgers, Buy 1 Take 1 deals, hotdogs, or cold drinks to get started.
                </p>
              </div>
              <button
                onClick={() => {
                  setCartOpen(false);
                  setPage('menu');
                }}
                className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.id}
                className="flex gap-3.5 pb-4 border-b border-neutral-100 last:border-b-0"
              >
                <div className="h-20 w-20 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200">
                  <FoodImage
                    src={item.imageUrl}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-neutral-900 truncate">
                      {item.productName}
                    </h4>
                    <button
                      onClick={() => removeCartItem(item.id)}
                      className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer"
                      aria-label={`Remove ${item.productName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {item.selectedOptions.length > 0 && (
                    <p className="text-xs text-neutral-500 mt-0.5 truncate">
                      {item.selectedOptions.map((o) => o.name).join(' · ')}
                    </p>
                  )}
                  <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                    {formatPeso(item.unitPriceCents)} each
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="inline-flex items-center border border-neutral-200 rounded-lg">
                      <button
                        onClick={() => updateCartItemQty(item.id, item.quantity - 1)}
                        className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-l-lg cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="px-3 text-xs font-semibold tabular-nums">{item.quantity}</span>
                      <button
                        onClick={() => updateCartItemQty(item.id, item.quantity + 1)}
                        className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-r-lg cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-neutral-900 tabular-nums">
                      {formatPeso(item.lineTotalCents)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-6 bg-neutral-50 border-t border-neutral-200 space-y-4">
            {/* Coupon Code */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Promo code (e.g. BURGER10)"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs uppercase focus:outline-none focus:border-red-600"
                />
              </div>
              <button
                type="button"
                disabled={couponBusy}
                onClick={handleApplyCoupon}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                Apply
              </button>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span className="tabular-nums font-medium">{formatPeso(cartSubtotalCents)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Est. Delivery Fee ({activeBranch?.name || 'Branch'})</span>
                <span className="tabular-nums font-medium">{formatPeso(deliveryFeeCents)}</span>
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span className="tabular-nums font-semibold">-{formatPeso(discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                <span>Grand Total</span>
                <span className="tabular-nums text-red-600">{formatPeso(grandTotalCents)}</span>
              </div>
            </div>

            <button
              onClick={() => proceedToCheckout()}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
