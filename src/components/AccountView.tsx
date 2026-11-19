import React, { useEffect, useState } from 'react';
import {
  Bell,
  Heart,
  KeyRound,
  LogOut,
  MapPin,
  Package,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../lib/api';
import { formatDateTime, formatPeso, getStatusStyle } from '../lib/format';
import { OrderRecord } from '../types';
import { FoodImage } from './FoodImage';

export function AccountView() {
  const {
    user,
    branches,
    products,
    addresses,
    favoriteIds,
    notifications,
    refreshAccount,
    addToCart,
    setCartOpen,
    setTrackedOrderNumber,
    setPage,
    setPostAuthRedirect,
    logout,
    markAllNotificationsRead,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<'profile' | 'orders' | 'addresses' | 'favorites' | 'notifications'>(
    'orders'
  );
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [preferredBranchId, setPreferredBranchId] = useState<number | ''>(
    user?.preferredBranchId || ''
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrDefault, setAddrDefault] = useState(true);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone);
      setPreferredBranchId(user.preferredBranchId || '');
      setAddrRecipient(user.fullName);
      setAddrPhone(user.phone);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoadingOrders(true);
    apiFetch<{ orders: OrderRecord[] }>('/api/orders/my')
      .then((res) => setOrders(res.orders))
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-5">
        <div className="h-14 w-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-600">
          <User className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Sign In to Your Account</h1>
        <p className="text-sm text-neutral-600">
          Manage your profile, saved delivery addresses, favorite burgers, and reorder past meals
          in one click.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setPostAuthRedirect('account');
              setPage('login');
            }}
            className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setPostAuthRedirect('account');
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/account/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          phone,
          preferredBranchId: preferredBranchId ? Number(preferredBranchId) : null,
        }),
      });
      await refreshAccount();
      showToast('Profile updated successfully.');
    } catch (err: any) {
      showToast(err?.message || 'Could not update profile.', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/account/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password updated successfully.');
    } catch (err: any) {
      showToast(err?.message || 'Could not update password.', 'error');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/account/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: addrLabel,
          recipientName: addrRecipient,
          phone: addrPhone,
          streetAddress: addrStreet,
          city: addrCity,
          isDefault: addrDefault,
        }),
      });
      setAddrStreet('');
      setAddrCity('');
      await refreshAccount();
      showToast('Address saved.');
    } catch (err: any) {
      showToast(err?.message || 'Could not save address.', 'error');
    }
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      await apiFetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
      await refreshAccount();
      showToast('Address deleted.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Could not delete address.', 'error');
    }
  };

  const handleReorder = async (order: OrderRecord) => {
    if (!order.items || order.items.length === 0) return;
    let addedAny = false;
    for (const item of order.items) {
      if (!item.productId) continue;
      const prod = products.find((p) => p.id === item.productId);
      if (prod && prod.inStock) {
        await addToCart(prod, item.quantity, []);
        addedAny = true;
      }
    }
    if (addedAny) {
      setCartOpen(true);
    } else {
      showToast('Items from this order are currently unavailable.', 'error');
    }
  };

  const favoriteProducts = products.filter((p) => favoriteIds.includes(p.id));
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-neutral-950">My Account</h1>
          <p className="text-sm text-neutral-600 mt-1">
            {user.fullName || user.email} · {user.email}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user.role === 'admin' && (
            <button
              onClick={() => setPage('admin')}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer"
            >
              Open Admin Dashboard
            </button>
          )}
          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'orders', label: 'Order History', icon: Package },
          { id: 'profile', label: 'Profile & Password', icon: User },
          { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
          { id: 'favorites', label: `Favorites (${favoriteProducts.length})`, icon: Heart },
          { id: 'notifications', label: `Notifications (${unreadCount})`, icon: Bell },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {loadingOrders ? (
            <div className="p-8 text-sm text-neutral-500">Loading order history...</div>
          ) : orders.length === 0 ? (
            <div className="p-10 rounded-2xl border border-neutral-200 bg-neutral-50 text-center space-y-3">
              <p className="text-sm text-neutral-600">You have not placed any orders yet.</p>
              <button
                onClick={() => setPage('menu')}
                className="px-5 py-2.5 rounded-full bg-red-600 text-white text-xs font-semibold cursor-pointer"
              >
                Explore Menu
              </button>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="p-5 rounded-2xl border border-neutral-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-neutral-900">
                      {order.orderNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg border text-xs font-semibold ${getStatusStyle(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {formatDateTime(order.createdAt)} · {order.branch?.name || 'Branch'} ·{' '}
                    {order.items?.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-neutral-900 tabular-nums">
                    {formatPeso(order.grandTotalCents)}
                  </span>
                  <button
                    onClick={() => {
                      setTrackedOrderNumber(order.orderNumber);
                      setPage('track');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 cursor-pointer"
                  >
                    Track
                  </button>
                  <button
                    onClick={() => handleReorder(order)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reorder</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Profile & Password Tab */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <form
            onSubmit={handleSaveProfile}
            className="p-6 rounded-2xl border border-neutral-200 bg-white space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-neutral-900">Profile Details</h2>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Preferred Branch
              </label>
              <select
                value={preferredBranchId}
                onChange={(e) =>
                  setPreferredBranchId(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
              >
                <option value="">No preference</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
            >
              Save Profile
            </button>
          </form>

          <form
            onSubmit={handleChangePassword}
            className="p-6 rounded-2xl border border-neutral-200 bg-white space-y-4"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-red-600" />
              <h2 className="font-display text-lg font-bold text-neutral-900">Change Password</h2>
            </div>
            <p className="text-xs text-neutral-500">
              Update your email sign-in password (leave current password blank if you signed up with
              Google and are setting a password for the first time).
            </p>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold cursor-pointer"
            >
              Update Password
            </button>
          </form>
        </div>
      )}

      {/* Addresses Tab */}
      {tab === 'addresses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-neutral-900">Saved Addresses</h2>
            {addresses.length === 0 ? (
              <p className="text-sm text-neutral-500">No saved addresses yet.</p>
            ) : (
              addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-4 rounded-2xl border border-neutral-200 bg-white flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-neutral-900">
                      {addr.label} {addr.isDefault ? '· Default' : ''}
                    </div>
                    <div className="text-neutral-700">
                      {addr.recipientName} · {addr.phone}
                    </div>
                    <div className="text-neutral-500">
                      {addr.streetAddress}, {addr.city}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer"
                    aria-label="Delete address"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleAddAddress}
            className="p-6 rounded-2xl border border-neutral-200 bg-white space-y-3.5"
          >
            <h2 className="font-display text-lg font-bold text-neutral-900">Add New Address</h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
                placeholder="Label (Home, Office)"
                className="px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
              />
              <input
                type="text"
                required
                value={addrCity}
                onChange={(e) => setAddrCity(e.target.value)}
                placeholder="City"
                className="px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
              />
            </div>
            <input
              type="text"
              required
              value={addrRecipient}
              onChange={(e) => setAddrRecipient(e.target.value)}
              placeholder="Recipient Name"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
            />
            <input
              type="tel"
              required
              value={addrPhone}
              onChange={(e) => setAddrPhone(e.target.value)}
              placeholder="Phone Number"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
            />
            <input
              type="text"
              required
              value={addrStreet}
              onChange={(e) => setAddrStreet(e.target.value)}
              placeholder="Street Address, Building, Barangay"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={addrDefault}
                onChange={(e) => setAddrDefault(e.target.checked)}
                className="accent-red-600"
              />
              <span>Set as default delivery address</span>
            </label>
            <div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                Save Address
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Favorites Tab */}
      {tab === 'favorites' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoriteProducts.length === 0 ? (
            <p className="text-sm text-neutral-500 col-span-full">
              You have not favorited any products yet.
            </p>
          ) : (
            favoriteProducts.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl border border-neutral-200 bg-white flex items-center gap-4"
              >
                <div className="h-16 w-16 rounded-xl overflow-hidden bg-neutral-100 shrink-0">
                  <FoodImage src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-neutral-900 truncate">{p.name}</div>
                  <div className="text-xs font-semibold text-red-600 tabular-nums">
                    {formatPeso(p.priceCents)}
                  </div>
                </div>
                <button
                  onClick={() => addToCart(p, 1, [])}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Add
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-neutral-900">Order Notifications</h2>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-neutral-500">No notifications yet.</p>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-xl border ${
                    n.isRead ? 'border-neutral-200 bg-white' : 'border-yellow-300 bg-yellow-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-900">{n.title}</span>
                    <span className="text-neutral-400">{formatDateTime(n.createdAt)}</span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-1">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
