import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, MapPin, ShoppingBag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../lib/api';
import { formatPeso } from '../lib/format';
import { OrderRecord } from '../types';

export function CheckoutView() {
  const {
    cartItems,
    cartSubtotalCents,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    appliedCoupon,
    user,
    addresses,
    refreshCart,
    setTrackedOrderNumber,
    setPage,
    setPostAuthRedirect,
    showToast,
  } = useApp();

  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pickupTime, setPickupTime] = useState('ASAP (15-20 mins)');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'cop' | 'gcash'>('cod');
  const [gcashReference, setGcashReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (!customerName && user.fullName) setCustomerName(user.fullName);
      if (!customerPhone && user.phone) setCustomerPhone(user.phone);
    }
  }, [user, customerName, customerPhone]);

  useEffect(() => {
    const def = addresses.find((a) => a.isDefault) || addresses[0];
    if (def && !deliveryAddress) {
      setDeliveryAddress(`${def.streetAddress}, ${def.city}`);
    }
  }, [addresses, deliveryAddress]);

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  useEffect(() => {
    if (fulfillmentType === 'pickup' && paymentMethod === 'cod') {
      setPaymentMethod('cop');
    } else if (fulfillmentType === 'delivery' && paymentMethod === 'cop') {
      setPaymentMethod(activeBranch?.supportsCod ? 'cod' : 'gcash');
    }
  }, [fulfillmentType, paymentMethod, activeBranch]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-5">
        <div className="h-14 w-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-600">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">
          Sign In Required for Checkout
        </h1>
        <p className="text-sm text-neutral-600">
          Customers must sign in or create an account before placing an order. Your cart items are
          waiting for you.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setPostAuthRedirect('checkout');
              setPage('login');
            }}
            className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
          >
            Sign In to Continue
          </button>
          <button
            onClick={() => {
              setPostAuthRedirect('checkout');
              setPage('register');
            }}
            className="px-6 py-3 rounded-full border border-neutral-300 text-neutral-800 hover:bg-neutral-50 text-sm font-semibold cursor-pointer"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="h-14 w-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-600">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Your Cart is Empty</h1>
        <p className="text-sm text-neutral-600">
          Add items from the menu before proceeding to checkout.
        </p>
        <button
          onClick={() => setPage('menu')}
          className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  const deliveryFeeCents =
    fulfillmentType === 'delivery' && activeBranch ? activeBranch.deliveryFeeCents : 0;
  const discountCents = appliedCoupon?.discountCents || 0;
  const grandTotalCents = Math.max(0, cartSubtotalCents + deliveryFeeCents - discountCents);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Please enter your full name and contact number.');
      return;
    }
    if (!activeBranch) {
      setError('Please select a branch.');
      return;
    }
    if (fulfillmentType === 'delivery' && !deliveryAddress.trim()) {
      setError('Please enter your delivery address.');
      return;
    }
    if (paymentMethod === 'gcash' && !gcashReference.trim()) {
      setError('Please enter your GCash reference number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        branchId: activeBranch.id,
        fulfillmentType,
        deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress.trim() : '',
        pickupTime: fulfillmentType === 'pickup' ? pickupTime : null,
        paymentMethod,
        gcashReference: paymentMethod === 'gcash' ? gcashReference.trim() : undefined,
        couponCode: appliedCoupon?.code || undefined,
        notes: notes.trim() || undefined,
        items: cartItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          selectedOptionIds: i.selectedOptions.map((o) => o.id),
        })),
      };

      const res = await apiFetch<{ order: OrderRecord }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await refreshCart();
      setTrackedOrderNumber(res.order.orderNumber);
      showToast('Your order has been placed successfully.');
      setPage('track');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err?.message || 'Unable to place order.');
      showToast(err?.message || 'Unable to place order.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage('menu')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Menu</span>
        </button>
      </div>

      <h1 className="font-display text-3xl font-extrabold text-neutral-950">Checkout</h1>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Form Details */}
        <div className="lg:col-span-7 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Branch & Fulfillment */}
          <div className="p-6 rounded-2xl border border-neutral-200 bg-white space-y-5">
            <h2 className="font-display text-lg font-bold text-neutral-900">
              1. Branch &amp; Fulfillment
            </h2>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Selected Branch
              </label>
              <select
                value={activeBranch?.id || ''}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} disabled={!b.isAvailable}>
                    {b.name} — {b.address} ({formatPeso(b.deliveryFeeCents)} delivery)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFulfillmentType('delivery')}
                className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                  fulfillmentType === 'delivery'
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                Delivery
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentType('pickup')}
                className={`py-3 px-4 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                  fulfillmentType === 'pickup'
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                Store Pickup
              </button>
            </div>

            {fulfillmentType === 'pickup' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Preferred Pickup Time
                </label>
                <select
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
                >
                  <option value="ASAP (15-20 mins)">ASAP (15–20 minutes)</option>
                  <option value="In 30 minutes">In 30 minutes</option>
                  <option value="In 45 minutes">In 45 minutes</option>
                  <option value="In 1 hour">In 1 hour</option>
                </select>
              </div>
            )}
          </div>

          {/* Customer Information */}
          <div className="p-6 rounded-2xl border border-neutral-200 bg-white space-y-4">
            <h2 className="font-display text-lg font-bold text-neutral-900">
              2. Customer Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Contact Number *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+63 917 000 0000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
                />
              </div>
            </div>

            {fulfillmentType === 'delivery' && (
              <div className="space-y-2.5">
                {addresses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {addresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setDeliveryAddress(`${addr.streetAddress}, ${addr.city}`);
                          setCustomerName(addr.recipientName);
                          setCustomerPhone(addr.phone);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:border-red-500 text-xs font-medium text-neutral-700 cursor-pointer"
                      >
                        <MapPin className="h-3.5 w-3.5 text-red-600" />
                        <span>Use {addr.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Delivery Address *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="House/Unit No., Street, Barangay, City & landmark"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Order Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Extra ketchup packets, gate instructions, etc."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="p-6 rounded-2xl border border-neutral-200 bg-white space-y-4">
            <h2 className="font-display text-lg font-bold text-neutral-900">
              3. Payment Method
            </h2>

            <div className="space-y-2.5">
              {fulfillmentType === 'delivery' && activeBranch?.supportsCod && (
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 hover:border-red-500 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="accent-red-600"
                    />
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">Cash on Delivery</div>
                      <div className="text-xs text-neutral-500">Pay the rider in cash upon arrival</div>
                    </div>
                  </div>
                </label>
              )}

              {fulfillmentType === 'pickup' && (
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 hover:border-red-500 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'cop'}
                      onChange={() => setPaymentMethod('cop')}
                      className="accent-red-600"
                    />
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">Cash on Pickup</div>
                      <div className="text-xs text-neutral-500">Pay at the store counter when collecting</div>
                    </div>
                  </div>
                </label>
              )}

              {activeBranch?.supportsGcash && (
                <label className="flex flex-col gap-3 p-3.5 rounded-xl border border-neutral-200 hover:border-red-500 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'gcash'}
                      onChange={() => setPaymentMethod('gcash')}
                      className="accent-red-600"
                    />
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">GCash</div>
                      <div className="text-xs text-neutral-500">
                        Enter your GCash transfer reference after sending to {activeBranch.contactNumber}
                      </div>
                    </div>
                  </div>

                  {paymentMethod === 'gcash' && (
                    <input
                      type="text"
                      value={gcashReference}
                      onChange={(e) => setGcashReference(e.target.value)}
                      placeholder="GCash Reference No. (e.g. 9012348812)"
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-red-600"
                    />
                  )}
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-5 p-6 rounded-2xl border border-neutral-200 bg-neutral-50 space-y-5 sticky top-24">
          <h2 className="font-display text-lg font-bold text-neutral-900">Order Summary</h2>

          <div className="space-y-3 divide-y divide-neutral-200">
            {cartItems.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex justify-between gap-3 text-sm">
                <div>
                  <div className="font-semibold text-neutral-900">
                    <span className="tabular-nums">{item.quantity}×</span> {item.productName}
                  </div>
                  {item.selectedOptions.length > 0 && (
                    <div className="text-xs text-neutral-500">
                      {item.selectedOptions.map((o) => o.name).join(', ')}
                    </div>
                  )}
                </div>
                <span className="font-semibold text-neutral-900 tabular-nums shrink-0">
                  {formatPeso(item.lineTotalCents)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-neutral-200 space-y-2 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium">{formatPeso(cartSubtotalCents)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Delivery Fee</span>
              <span className="tabular-nums font-medium">{formatPeso(deliveryFeeCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Coupon ({appliedCoupon?.code})</span>
                <span className="tabular-nums font-semibold">-{formatPeso(discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-neutral-950 pt-2 border-t border-neutral-200">
              <span>Total</span>
              <span className="tabular-nums text-red-600">{formatPeso(grandTotalCents)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>Place Order · {formatPeso(grandTotalCents)}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
