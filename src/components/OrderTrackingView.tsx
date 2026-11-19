import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Loader2, Printer, Search, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../lib/api';
import { formatDateTime, formatPaymentLabel, formatPeso, getStatusStyle } from '../lib/format';
import { OrderRecord } from '../types';

const DELIVERY_STEPS = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Out for Delivery',
  'Completed',
];

const PICKUP_STEPS = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready for Pickup',
  'Completed',
];

export function OrderTrackingView() {
  const {
    trackedOrderNumber,
    setTrackedOrderNumber,
    lastOrderEventAt,
    user,
    setPage,
    setPostAuthRedirect,
  } = useApp();

  const [lookupInput, setLookupInput] = useState(trackedOrderNumber || '');
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [myOrders, setMyOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async (orderNum: string) => {
    if (!user) return;
    const clean = orderNum.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ order: OrderRecord }>(`/api/orders/track/${encodeURIComponent(clean)}`);
      setOrder(res.order);
    } catch (err: any) {
      setOrder(null);
      setError(err?.message || 'Order not found.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (trackedOrderNumber && user) {
      setLookupInput(trackedOrderNumber);
      fetchOrder(trackedOrderNumber);
    }
  }, [trackedOrderNumber, lastOrderEventAt, fetchOrder, user]);

  useEffect(() => {
    if (!user) {
      setMyOrders([]);
      return;
    }
    apiFetch<{ orders: OrderRecord[] }>('/api/orders/my')
      .then((res) => setMyOrders(res.orders))
      .catch(() => {});
  }, [user, lastOrderEventAt]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-5">
        <div className="h-14 w-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-600">
          <Clock className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">
          Sign In to Track Your Orders
        </h1>
        <p className="text-sm text-neutral-600">
          For your privacy and security, order history and live tracking are restricted to your
          authenticated customer account.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setPostAuthRedirect('track');
              setPage('login');
            }}
            className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setPostAuthRedirect('track');
              setPage('register');
            }}
            className="px-6 py-3 rounded-full border border-neutral-300 text-neutral-800 hover:bg-neutral-50 text-sm font-semibold cursor-pointer"
          >
            Register
          </button>
        </div>
      </div>
    );
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupInput.trim()) return;
    setTrackedOrderNumber(lookupInput.trim().toUpperCase());
  };

  const steps = order?.fulfillmentType === 'pickup' ? PICKUP_STEPS : DELIVERY_STEPS;
  const activeStepIndex = order ? steps.indexOf(order.status) : -1;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="no-print flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-neutral-950">Order Tracking</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Monitor live kitchen updates from Pending through Completed or print your receipt.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-4 w-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Order # (e.g. AB-2026-1004)"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-300 text-sm font-mono uppercase focus:outline-none focus:border-red-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
          >
            Track
          </button>
        </form>
      </div>

      {user && myOrders.length > 0 && (
        <div className="no-print space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Your Recent Orders
          </h2>
          <div className="flex flex-wrap gap-2">
            {myOrders.slice(0, 6).map((o) => (
              <button
                key={o.id}
                onClick={() => setTrackedOrderNumber(o.orderNumber)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  order?.orderNumber === o.orderNumber
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <span className="font-mono font-semibold">{o.orderNumber}</span>
                <span className="mx-1.5 text-neutral-400">·</span>
                <span>{o.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin text-red-600" />
          <span>Loading order details...</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      {!order && !loading && !error && (
        <div className="p-10 rounded-2xl border border-neutral-200 bg-neutral-50 text-center space-y-2">
          <Clock className="h-8 w-8 text-red-600 mx-auto" />
          <h3 className="font-display text-lg font-bold text-neutral-900">
            Enter an order number to track
          </h3>
          <p className="text-sm text-neutral-600 max-w-md mx-auto">
            Sample seeded orders such as <span className="font-mono font-semibold">AB-2026-1004</span>{' '}
            or <span className="font-mono font-semibold">AB-2026-1005</span> can also be tracked
            right away.
          </p>
        </div>
      )}

      {order && !loading && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
            <div>
              <div className="text-xs text-neutral-500">
                Placed {formatDateTime(order.createdAt)} · {order.branch?.name || 'Branch'}
              </div>
              <h2 className="font-mono text-2xl font-bold text-neutral-950 mt-1">
                {order.orderNumber}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold ${getStatusStyle(
                  order.status
                )}`}
              >
                {order.status}
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>

          {/* Progress Timeline */}
          {order.status === 'Cancelled' ? (
            <div className="p-5 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-800">
              <XCircle className="h-6 w-6 shrink-0" />
              <div>
                <div className="text-sm font-bold">Order Cancelled</div>
                <div className="text-xs">
                  This order was cancelled. Any reserved stock has been released.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {steps.map((step, idx) => {
                const completed = activeStepIndex >= idx;
                const current = activeStepIndex === idx;
                return (
                  <div
                    key={step}
                    className={`p-3.5 rounded-xl border transition-colors ${
                      current
                        ? 'border-red-600 bg-red-50/70'
                        : completed
                          ? 'border-emerald-200 bg-emerald-50/60'
                          : 'border-neutral-200 bg-neutral-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[11px] font-semibold text-neutral-500">
                        0{idx + 1}
                      </span>
                      {completed && <Check className="h-4 w-4 text-emerald-700" />}
                    </div>
                    <div
                      className={`text-xs font-bold ${
                        current
                          ? 'text-red-700'
                          : completed
                            ? 'text-neutral-900'
                            : 'text-neutral-400'
                      }`}
                    >
                      {step}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Receipt Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            <div className="space-y-3 text-sm">
              <h3 className="font-display text-base font-bold text-neutral-900">
                Order &amp; Fulfillment Details
              </h3>
              <div className="space-y-1.5 text-neutral-600 text-xs">
                <div>
                  <span className="font-semibold text-neutral-900">Customer:</span> {order.customerName}
                </div>
                <div>
                  <span className="font-semibold text-neutral-900">Contact:</span> {order.customerPhone}
                </div>
                <div>
                  <span className="font-semibold text-neutral-900">Fulfillment:</span>{' '}
                  {order.fulfillmentType === 'pickup' ? 'Store Pickup' : 'Delivery'}
                  {order.pickupTime ? ` (${order.pickupTime})` : ''}
                </div>
                <div>
                  <span className="font-semibold text-neutral-900">Address / Branch:</span>{' '}
                  {order.deliveryAddress}
                </div>
                <div>
                  <span className="font-semibold text-neutral-900">Payment:</span>{' '}
                  {formatPaymentLabel(order.paymentMethod)} ({order.paymentStatus})
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-base font-bold text-neutral-900">Items &amp; Total</h3>
              <div className="space-y-2 border-b border-neutral-200 pb-3">
                {order.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <div>
                      <span className="font-semibold text-neutral-900 tabular-nums">
                        {item.quantity}× {item.productName}
                      </span>
                      {item.optionsSummary && (
                        <div className="text-neutral-500">{item.optionsSummary}</div>
                      )}
                    </div>
                    <span className="font-semibold text-neutral-900 tabular-nums">
                      {formatPeso(item.lineTotalCents)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPeso(order.subtotalCents)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Delivery Fee</span>
                  <span className="tabular-nums">{formatPeso(order.deliveryFeeCents)}</span>
                </div>
                {order.discountCents > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount ({order.couponCode})</span>
                    <span className="tabular-nums">-{formatPeso(order.discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-neutral-950 pt-2 border-t border-neutral-200">
                  <span>Grand Total</span>
                  <span className="tabular-nums text-red-600">{formatPeso(order.grandTotalCents)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
