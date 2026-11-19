import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Package,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../lib/api';
import { formatDateTime, formatPaymentLabel, formatPeso, getStatusStyle } from '../lib/format';
import { Branch, Category, OrderRecord, OrderStatus, Product } from '../types';
import { FoodImage } from './FoodImage';
import { AdminLoginPage } from './CustomerAuthPages';

type AdminTab =
  | 'overview'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'branches'
  | 'reports';

interface OverviewData {
  kpis: {
    totalOrders: number;
    completedOrdersCount: number;
    totalSalesCents: number;
    dailySalesCents: number;
    weeklySalesCents: number;
    monthlySalesCents: number;
    totalCustomers: number;
    totalProducts: number;
    pendingOrders: number;
    lowStockCount: number;
  };
  lowStockProducts: Array<{
    productId: number;
    productName: string;
    stockQuantity: number;
    lowStockThreshold: number;
  }>;
  salesSeries: Array<{ date: string; salesCents: number; orders: number }>;
  bestSellingProducts: Array<{ productName: string; quantity: number; revenueCents: number }>;
  recentOrders: OrderRecord[];
}

export function AdminDashboard() {
  const { user, products, categories, refreshCatalog, lastOrderEventAt, showToast } =
    useApp();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [inventoryRows, setInventoryRows] = useState<
    Array<{
      productId: number;
      productName: string;
      stockQuantity: number;
      lowStockThreshold: number;
      isAvailable: boolean;
    }>
  >([]);
  const [customers, setCustomers] = useState<
    Array<{
      id: number;
      email: string;
      role: string;
      fullName: string;
      phone: string;
      orderCount: number;
      totalSpentCents: number;
      orders: OrderRecord[];
    }>
  >([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [coupons, setCoupons] = useState<
    Array<{
      id: number;
      code: string;
      description: string;
      discountType: string;
      discountValue: number;
      minOrderCents: number;
      isActive: boolean;
    }>
  >([]);

  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  // Product Editor Modal state
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [prodStockInput, setProdStockInput] = useState(40);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Branch form
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [newBranchHours, setNewBranchHours] = useState('8:00 AM – 10:00 PM');
  const [newBranchFeePesos, setNewBranchFeePesos] = useState('35');

  // Category form
  const [newCatName, setNewCatName] = useState('');

  // Coupon form
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDesc, setNewCouponDesc] = useState('');
  const [newCouponType, setNewCouponType] = useState<'percent' | 'fixed'>('percent');
  const [newCouponValue, setNewCouponValue] = useState('10');

  const loadOverview = useCallback(async () => {
    const qs = new URLSearchParams();
    if (reportStartDate) qs.set('startDate', reportStartDate);
    if (reportEndDate) qs.set('endDate', reportEndDate);
    const data = await apiFetch<OverviewData>(`/api/admin/overview?${qs.toString()}`);
    setOverview(data);
  }, [reportStartDate, reportEndDate]);

  const loadOrders = useCallback(async () => {
    const qs = new URLSearchParams();
    if (orderStatusFilter !== 'All') qs.set('status', orderStatusFilter);
    if (orderDateFilter) qs.set('date', orderDateFilter);
    const res = await apiFetch<{ orders: OrderRecord[] }>(`/api/admin/orders?${qs.toString()}`);
    setOrders(res.orders);
  }, [orderStatusFilter, orderDateFilter]);

  const loadInventory = useCallback(async () => {
    const res = await apiFetch<{ inventory: typeof inventoryRows }>('/api/admin/inventory');
    setInventoryRows(res.inventory);
  }, []);

  const loadCustomers = useCallback(async () => {
    const res = await apiFetch<{ customers: typeof customers }>('/api/admin/customers');
    setCustomers(res.customers);
  }, []);

  const loadBranchesAndCoupons = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([
      apiFetch<{ branches: Branch[] }>('/api/admin/branches'),
      apiFetch<{ coupons: typeof coupons }>('/api/admin/coupons'),
    ]);
    setBranches(bRes.branches);
    setCoupons(cRes.coupons);
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    loadOverview().catch(() => {});
    loadOrders().catch(() => {});
    loadInventory().catch(() => {});
    loadCustomers().catch(() => {});
    loadBranchesAndCoupons().catch(() => {});
  }, [
    user,
    lastOrderEventAt,
    loadOverview,
    loadOrders,
    loadInventory,
    loadCustomers,
    loadBranchesAndCoupons,
  ]);

  if (!user || user.role !== 'admin') {
    return <AdminLoginPage />;
  }

  const updateOrderStatus = async (orderId: number, status: OrderStatus) => {
    try {
      await apiFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(`Order status updated to ${status}.`);
      await Promise.all([loadOrders(), loadOverview(), loadInventory()]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update order status.', 'error');
    }
  };

  const handleUploadImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await apiFetch<{ imageUrl: string }>('/api/admin/upload', {
        method: 'POST',
        body: form,
      });
      setEditingProduct((prev) => (prev ? { ...prev, imageUrl: res.imageUrl } : prev));
      showToast('Product image uploaded.');
    } catch (err: any) {
      showToast(err?.message || 'Image upload failed.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const payload = {
        name: editingProduct.name,
        description: editingProduct.description,
        categoryId: editingProduct.categoryId || categories[0]?.id,
        priceCents: Number(editingProduct.priceCents || 5000),
        imageUrl:
          editingProduct.imageUrl || '/src/assets/images/menu_classic_burger_1795052474012.jpg',
        isAvailable: editingProduct.isAvailable !== false,
        isFeatured: Boolean(editingProduct.isFeatured),
        isBestSeller: Boolean(editingProduct.isBestSeller),
        badgeText: editingProduct.badgeText || null,
        stockQuantity: prodStockInput,
      };
      if (editingProduct.id) {
        await apiFetch(`/api/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Product updated.');
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Product added.');
      }
      setEditingProduct(null);
      await Promise.all([refreshCatalog(), loadInventory(), loadOverview()]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save product.', 'error');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    try {
      await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      showToast('Product deleted.', 'info');
      await Promise.all([refreshCatalog(), loadInventory(), loadOverview()]);
    } catch (err: any) {
      showToast(err?.message || 'Could not delete product.', 'error');
    }
  };

  const handleAdjustStock = async (
    productId: number,
    stockQuantity: number,
    lowStockThreshold: number
  ) => {
    try {
      await apiFetch(`/api/admin/inventory/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stockQuantity, lowStockThreshold }),
      });
      showToast('Inventory updated.');
      await Promise.all([loadInventory(), refreshCatalog(), loadOverview()]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update stock.', 'error');
    }
  };

  const handleToggleBranch = async (branch: Branch, updates: Partial<Branch>) => {
    try {
      await apiFetch(`/api/admin/branches/${branch.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...branch, ...updates }),
      });
      showToast(`Branch ${branch.name} updated.`);
      await Promise.all([loadBranchesAndCoupons(), refreshCatalog()]);
    } catch (err: any) {
      showToast(err?.message || 'Could not update branch.', 'error');
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: newBranchName,
          address: newBranchAddress,
          contactNumber: newBranchPhone,
          operatingHours: newBranchHours,
          deliveryFeeCents: Math.round(Number(newBranchFeePesos || 35) * 100),
        }),
      });
      setNewBranchName('');
      setNewBranchAddress('');
      setNewBranchPhone('');
      showToast('Branch created.');
      await Promise.all([loadBranchesAndCoupons(), refreshCatalog()]);
    } catch (err: any) {
      showToast(err?.message || 'Could not create branch.', 'error');
    }
  };

  const maxChartSales = Math.max(
    10000,
    ...(overview?.salesSeries.map((d) => d.salesCents) || [0])
  );

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-neutral-50 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-neutral-200 p-4 lg:p-6 shrink-0">
        <div className="mb-4 px-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-red-600">
            Store Operations
          </div>
          <h2 className="font-display text-lg font-bold text-neutral-900">Admin Console</h2>
        </div>

        <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'orders', label: 'Orders', icon: ClipboardList },
            { id: 'products', label: 'Products', icon: Package },
            { id: 'inventory', label: 'Inventory', icon: Boxes },
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'branches', label: 'Branches & Coupons', icon: MapPin },
            { id: 'reports', label: 'Sales Reports', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id as AdminTab)}
                className={`inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === item.id
                    ? 'bg-red-600 text-white'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 p-5 sm:p-8 space-y-8 overflow-x-hidden">
        {/* OVERVIEW */}
        {tab === 'overview' && overview && (
          <div className="space-y-8">
            <h1 className="font-display text-2xl font-extrabold text-neutral-950">
              Dashboard Overview
            </h1>

            {/* 6 KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {[
                { label: 'Total Orders', value: String(overview.kpis.totalOrders) },
                { label: 'Total Sales', value: formatPeso(overview.kpis.totalSalesCents) },
                { label: 'Total Customers', value: String(overview.kpis.totalCustomers) },
                { label: 'Total Products', value: String(overview.kpis.totalProducts) },
                { label: 'Pending Orders', value: String(overview.kpis.pendingOrders) },
                { label: 'Low Stock Items', value: String(overview.kpis.lowStockCount) },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="p-4 rounded-2xl bg-white border border-neutral-200 space-y-1"
                >
                  <div className="text-xs font-medium text-neutral-500">{kpi.label}</div>
                  <div className="font-display text-xl font-extrabold text-neutral-950 tabular-nums">
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Sales Chart */}
              <div className="xl:col-span-7 p-6 rounded-2xl bg-white border border-neutral-200 space-y-4">
                <h3 className="font-display text-base font-bold text-neutral-900">
                  Daily Revenue Trend
                </h3>
                {overview.salesSeries.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-8">No sales data in selected period.</p>
                ) : (
                  <div className="h-56 flex items-end gap-3 pt-4">
                    {overview.salesSeries.map((pt) => {
                      const heightPct = Math.max(8, Math.round((pt.salesCents / maxChartSales) * 100));
                      return (
                        <div key={pt.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <span className="text-[11px] font-mono text-neutral-600 tabular-nums">
                            {formatPeso(pt.salesCents)}
                          </span>
                          <div
                            className="w-full max-w-[44px] rounded-t-lg bg-red-600 transition-all"
                            style={{ height: `${heightPct}%` }}
                            title={`${pt.date}: ${formatPeso(pt.salesCents)} (${pt.orders} orders)`}
                          />
                          <span className="text-[11px] font-mono text-neutral-500">
                            {pt.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Best Selling & Low Stock */}
              <div className="xl:col-span-5 p-6 rounded-2xl bg-white border border-neutral-200 space-y-4">
                <h3 className="font-display text-base font-bold text-neutral-900">
                  Best-Selling Products
                </h3>
                <div className="space-y-2.5">
                  {overview.bestSellingProducts.map((item) => (
                    <div
                      key={item.productName}
                      className="flex items-center justify-between text-xs py-2 border-b border-neutral-100 last:border-b-0"
                    >
                      <span className="font-semibold text-neutral-800">{item.productName}</span>
                      <span className="font-mono text-neutral-600 tabular-nums">
                        {item.quantity} sold · {formatPeso(item.revenueCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="p-6 rounded-2xl bg-white border border-neutral-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-neutral-900">
                  Recent Order Activity
                </h3>
                <button
                  onClick={() => setTab('orders')}
                  className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                >
                  Manage all orders
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-neutral-500">
                    <tr>
                      <th className="py-2.5 pr-4">Order #</th>
                      <th className="py-2.5 pr-4">Customer</th>
                      <th className="py-2.5 pr-4">Branch</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {overview.recentOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-neutral-50">
                        <td className="py-2.5 pr-4 font-mono font-semibold text-neutral-900">
                          {o.orderNumber}
                        </td>
                        <td className="py-2.5 pr-4 text-neutral-700">{o.customerName}</td>
                        <td className="py-2.5 pr-4 text-neutral-600">{o.branchName}</td>
                        <td className="py-2.5 pr-4 font-semibold text-neutral-800">{o.status}</td>
                        <td className="py-2.5 text-right font-mono font-semibold tabular-nums">
                          {formatPeso(o.grandTotalCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ORDER MANAGEMENT */}
        {tab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="font-display text-2xl font-extrabold text-neutral-950">
                Order Management
              </h1>
              <div className="flex flex-wrap gap-2">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-semibold"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Ready for Pickup">Ready for Pickup</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <input
                  type="date"
                  value={orderDateFilter}
                  onChange={(e) => setOrderDateFilter(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-neutral-300 bg-white text-xs"
                />
              </div>
            </div>

            <div className="space-y-4">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-neutral-950">
                          {o.orderNumber}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg border text-xs font-semibold ${getStatusStyle(
                            o.status
                          )}`}
                        >
                          {o.status}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-600 mt-1">
                        {o.customerName} ({o.customerPhone}) · {o.fulfillmentType.toUpperCase()} ·{' '}
                        {formatPaymentLabel(o.paymentMethod)} ({o.paymentStatus}) ·{' '}
                        {formatDateTime(o.createdAt)}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">{o.deliveryAddress}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-display text-lg font-bold text-red-600 tabular-nums">
                        {formatPeso(o.grandTotalCents)}
                      </div>
                      <div className="text-xs text-neutral-500">{o.branch?.name}</div>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-700 bg-neutral-50 rounded-xl p-3">
                    {o.items?.map((i) => `${i.quantity}× ${i.productName} (${i.optionsSummary})`).join(' · ')}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        'Confirmed',
                        'Preparing',
                        o.fulfillmentType === 'pickup' ? 'Ready for Pickup' : 'Out for Delivery',
                        'Completed',
                      ] as OrderStatus[]
                    ).map((next) => (
                      <button
                        key={next}
                        disabled={o.status === next || o.status === 'Cancelled'}
                        onClick={() => updateOrderStatus(o.id, next)}
                        className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-xs font-semibold text-neutral-800 cursor-pointer disabled:opacity-40"
                      >
                        Mark {next}
                      </button>
                    ))}
                    {o.status !== 'Cancelled' && o.status !== 'Completed' && (
                      <button
                        onClick={() => updateOrderStatus(o.id, 'Cancelled')}
                        className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-semibold text-red-700 cursor-pointer"
                      >
                        Reject / Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCT MANAGEMENT */}
        {tab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="font-display text-2xl font-extrabold text-neutral-950">
                Product Management
              </h1>
              <button
                onClick={() => {
                  setProdStockInput(40);
                  setEditingProduct({
                    name: '',
                    description: '',
                    categoryId: categories[0]?.id,
                    priceCents: 6500,
                    imageUrl: '/src/assets/images/menu_classic_burger_1795052474012.jpg',
                    isAvailable: true,
                    isFeatured: false,
                    isBestSeller: false,
                    badgeText: '',
                  });
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Quick Add Category */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newCatName.trim()) return;
                await apiFetch('/api/admin/categories', {
                  method: 'POST',
                  body: JSON.stringify({ name: newCatName }),
                });
                setNewCatName('');
                await refreshCatalog();
                showToast('Category added.');
              }}
              className="flex flex-wrap items-center gap-2 p-4 rounded-2xl bg-white border border-neutral-200"
            >
              <span className="text-xs font-semibold text-neutral-700">Categories:</span>
              {categories.map((c: Category) => (
                <span key={c.id} className="text-xs text-neutral-600 px-2.5 py-1 bg-neutral-100 rounded-lg">
                  {c.name}
                </span>
              ))}
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name"
                className="ml-auto px-3 py-1.5 rounded-lg border border-neutral-300 text-xs"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold cursor-pointer"
              >
                Add Category
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-white border border-neutral-200 flex gap-4"
                >
                  <div className="h-20 w-20 rounded-xl overflow-hidden bg-neutral-100 shrink-0">
                    <FoodImage src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-sm font-bold text-neutral-900 truncate">{p.name}</div>
                    <div className="text-xs font-semibold text-red-600 tabular-nums">
                      {formatPeso(p.priceCents)} · {p.isAvailable ? 'Available' : 'Hidden'}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => {
                          setProdStockInput(p.stockQuantity);
                          setEditingProduct(p);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-neutral-300 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 cursor-pointer"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {tab === 'inventory' && (
          <div className="space-y-6">
            <h1 className="font-display text-2xl font-extrabold text-neutral-950">
              Inventory Management
            </h1>
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Stock Qty</th>
                    <th className="px-5 py-3">Low Stock Alert</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {inventoryRows.map((row) => {
                    const isOut = row.stockQuantity <= 0;
                    const isLow = row.stockQuantity > 0 && row.stockQuantity <= row.lowStockThreshold;
                    return (
                      <tr key={row.productId}>
                        <td className="px-5 py-3 font-semibold text-neutral-900">
                          {row.productName}
                        </td>
                        <td className="px-5 py-3">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" /> Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-700">In Stock</span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono tabular-nums font-bold">
                          {row.stockQuantity}
                        </td>
                        <td className="px-5 py-3 font-mono tabular-nums text-neutral-600">
                          {row.lowStockThreshold}
                        </td>
                        <td className="px-5 py-3 text-right space-x-2">
                          <button
                            onClick={() =>
                              handleAdjustStock(
                                row.productId,
                                Math.max(0, row.stockQuantity - 5),
                                row.lowStockThreshold
                              )
                            }
                            className="px-2.5 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50 cursor-pointer"
                          >
                            -5
                          </button>
                          <button
                            onClick={() =>
                              handleAdjustStock(
                                row.productId,
                                row.stockQuantity + 10,
                                row.lowStockThreshold
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 cursor-pointer"
                          >
                            +10 Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CUSTOMERS */}
        {tab === 'customers' && (
          <div className="space-y-6">
            <h1 className="font-display text-2xl font-extrabold text-neutral-950">
              Customer Management
            </h1>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-7 bg-white rounded-2xl border border-neutral-200 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-right">Orders</th>
                      <th className="px-4 py-3 text-right">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {customers.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCustomerId(c.id)}
                        className={`cursor-pointer hover:bg-neutral-50 ${
                          selectedCustomerId === c.id ? 'bg-red-50/40' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-neutral-900">{c.fullName}</div>
                          <div className="text-neutral-500">{c.email}</div>
                        </td>
                        <td className="px-4 py-3 capitalize">{c.role}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {c.orderCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                          {formatPeso(c.totalSpentCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="xl:col-span-5 p-6 rounded-2xl bg-white border border-neutral-200 space-y-4">
                <h3 className="font-display text-base font-bold text-neutral-900">
                  {selectedCustomer ? `${selectedCustomer.fullName} — Orders` : 'Select a Customer'}
                </h3>
                {selectedCustomer ? (
                  <div className="space-y-3 text-xs">
                    <div className="text-neutral-600">
                      Phone: {selectedCustomer.phone || 'Not provided'}
                    </div>
                    {selectedCustomer.orders.length === 0 ? (
                      <p className="text-neutral-500">No orders placed yet.</p>
                    ) : (
                      selectedCustomer.orders.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-3 rounded-xl border border-neutral-200 flex justify-between"
                        >
                          <div>
                            <div className="font-mono font-semibold">{ord.orderNumber}</div>
                            <div className="text-neutral-500">{ord.status}</div>
                          </div>
                          <div className="font-mono font-bold tabular-nums">
                            {formatPeso(ord.grandTotalCents)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Click any customer row to view contact info and order history.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BRANCHES & COUPONS */}
        {tab === 'branches' && (
          <div className="space-y-8">
            <h1 className="font-display text-2xl font-extrabold text-neutral-950">
              Branches &amp; Promotions
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-bold text-neutral-900">
                          {b.name}
                        </h3>
                        <p className="text-xs text-neutral-600">{b.address}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {b.operatingHours} · {b.contactNumber} · Delivery:{' '}
                          <span className="font-mono font-semibold">
                            {formatPeso(b.deliveryFeeCents)}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleBranch(b, { isAvailable: !b.isAvailable })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          b.isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {b.isAvailable ? 'Store Open' : 'Store Closed'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs pt-2 border-t border-neutral-100">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={b.supportsCod}
                          onChange={() => handleToggleBranch(b, { supportsCod: !b.supportsCod })}
                          className="accent-red-600"
                        />
                        <span>Cash on Delivery</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={b.supportsGcash}
                          onChange={() => handleToggleBranch(b, { supportsGcash: !b.supportsGcash })}
                          className="accent-red-600"
                        />
                        <span>GCash Supported</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-5 space-y-6">
                <form
                  onSubmit={handleAddBranch}
                  className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-3"
                >
                  <h3 className="font-display text-base font-bold text-neutral-900">Add Branch</h3>
                  <input
                    type="text"
                    required
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Branch Name"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    placeholder="Street Address"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={newBranchPhone}
                      onChange={(e) => setNewBranchPhone(e.target.value)}
                      placeholder="Contact Number"
                      className="px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                    />
                    <input
                      type="number"
                      required
                      value={newBranchFeePesos}
                      onChange={(e) => setNewBranchFeePesos(e.target.value)}
                      placeholder="Delivery Fee (₱)"
                      className="px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    value={newBranchHours}
                    onChange={(e) => setNewBranchHours(e.target.value)}
                    placeholder="Operating Hours"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Create Branch
                  </button>
                </form>

                {/* Coupons */}
                <div className="p-5 rounded-2xl bg-white border border-neutral-200 space-y-3">
                  <h3 className="font-display text-base font-bold text-neutral-900">
                    Discount Coupons
                  </h3>
                  <div className="space-y-2">
                    {coupons.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-neutral-50 border border-neutral-200"
                      >
                        <div>
                          <span className="font-mono font-bold text-neutral-900">{c.code}</span>
                          <div className="text-neutral-500">{c.description}</div>
                        </div>
                        <button
                          onClick={async () => {
                            await apiFetch(`/api/admin/coupons/${c.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ isActive: !c.isActive }),
                            });
                            await loadBranchesAndCoupons();
                          }}
                          className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                            c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {c.isActive ? 'Active' : 'Paused'}
                        </button>
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await apiFetch('/api/admin/coupons', {
                        method: 'POST',
                        body: JSON.stringify({
                          code: newCouponCode,
                          description: newCouponDesc,
                          discountType: newCouponType,
                          discountValue:
                            newCouponType === 'fixed'
                              ? Number(newCouponValue) * 100
                              : Number(newCouponValue),
                        }),
                      });
                      setNewCouponCode('');
                      setNewCouponDesc('');
                      await Promise.all([loadBranchesAndCoupons(), refreshCatalog()]);
                      showToast('Coupon created.');
                    }}
                    className="pt-2 border-t border-neutral-100 space-y-2"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={newCouponCode}
                        onChange={(e) => setNewCouponCode(e.target.value)}
                        placeholder="CODE"
                        className="px-3 py-2 rounded-xl border border-neutral-300 text-xs uppercase font-mono"
                      />
                      <select
                        value={newCouponType}
                        onChange={(e) => setNewCouponType(e.target.value as any)}
                        className="px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      >
                        <option value="percent">% Off</option>
                        <option value="fixed">Fixed ₱ Off</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        required
                        value={newCouponValue}
                        onChange={(e) => setNewCouponValue(e.target.value)}
                        placeholder="Value"
                        className="px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={newCouponDesc}
                        onChange={(e) => setNewCouponDesc(e.target.value)}
                        placeholder="Short description"
                        className="col-span-2 px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      Add Coupon
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SALES REPORTS */}
        {tab === 'reports' && overview && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <h1 className="font-display text-2xl font-extrabold text-neutral-950">
                Sales Reports
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-neutral-300 bg-white"
                />
                <span className="text-neutral-500">to</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-neutral-300 bg-white"
                />
                {(reportStartDate || reportEndDate) && (
                  <button
                    onClick={() => {
                      setReportStartDate('');
                      setReportEndDate('');
                    }}
                    className="px-3 py-2 rounded-xl bg-neutral-200 font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-neutral-200">
                <div className="text-xs text-neutral-500">Daily Sales (Today)</div>
                <div className="font-display text-2xl font-extrabold text-neutral-950 tabular-nums mt-1">
                  {formatPeso(overview.kpis.dailySalesCents)}
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-neutral-200">
                <div className="text-xs text-neutral-500">Weekly Sales (7 Days)</div>
                <div className="font-display text-2xl font-extrabold text-neutral-950 tabular-nums mt-1">
                  {formatPeso(overview.kpis.weeklySalesCents)}
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-neutral-200">
                <div className="text-xs text-neutral-500">Monthly Sales (30 Days)</div>
                <div className="font-display text-2xl font-extrabold text-neutral-950 tabular-nums mt-1">
                  {formatPeso(overview.kpis.monthlySalesCents)}
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-neutral-200">
                <div className="text-xs text-neutral-500">Completed Orders</div>
                <div className="font-display text-2xl font-extrabold text-neutral-950 tabular-nums mt-1">
                  {overview.kpis.completedOrdersCount}
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-neutral-200 space-y-4">
              <h3 className="font-display text-base font-bold text-neutral-900">
                Best-Selling Products Breakdown
              </h3>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 text-neutral-500">
                  <tr>
                    <th className="py-2">Product</th>
                    <th className="py-2 text-right">Units Sold</th>
                    <th className="py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {overview.bestSellingProducts.map((b) => (
                    <tr key={b.productName}>
                      <td className="py-2.5 font-semibold text-neutral-900">{b.productName}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{b.quantity}</td>
                      <td className="py-2.5 text-right font-mono font-bold tabular-nums">
                        {formatPeso(b.revenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-neutral-200 shadow-2xl"
          >
            <h2 className="font-display text-xl font-bold text-neutral-900">
              {editingProduct.id ? 'Edit Product' : 'Add Product'}
            </h2>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Product Name
              </label>
              <input
                type="text"
                required
                value={editingProduct.name || ''}
                onChange={(e) =>
                  setEditingProduct((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Category
                </label>
                <select
                  value={editingProduct.categoryId || categories[0]?.id}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({ ...prev, categoryId: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Price (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={((editingProduct.priceCents || 0) / 100).toFixed(2)}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({
                      ...prev,
                      priceCents: Math.round(Number(e.target.value || 0) * 100),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                required
                value={editingProduct.description || ''}
                onChange={(e) =>
                  setEditingProduct((prev) => ({ ...prev, description: e.target.value }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-700">
                Product Image (Upload JPG/PNG/WebP max 5MB)
              </label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-xs font-semibold cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <span>{uploadingImage ? 'Uploading...' : 'Upload File'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file);
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={editingProduct.imageUrl || ''}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({ ...prev, imageUrl: e.target.value }))
                  }
                  placeholder="/src/assets/images/..."
                  className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 text-xs"
                />
              </div>
            </div>

            {!editingProduct.id && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Initial Stock Quantity
                </label>
                <input
                  type="number"
                  min={0}
                  value={prodStockInput}
                  onChange={(e) => setProdStockInput(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-xs pt-1">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProduct.isAvailable !== false}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({ ...prev, isAvailable: e.target.checked }))
                  }
                  className="accent-red-600"
                />
                <span>Available</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editingProduct.isFeatured)}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({ ...prev, isFeatured: e.target.checked }))
                  }
                  className="accent-red-600"
                />
                <span>Featured</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editingProduct.isBestSeller)}
                  onChange={(e) =>
                    setEditingProduct((prev) => ({ ...prev, isBestSeller: e.target.checked }))
                  }
                  className="accent-red-600"
                />
                <span>Best Seller</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Save Product
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
