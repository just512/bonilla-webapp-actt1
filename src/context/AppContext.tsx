import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch, setAuthToken } from '../lib/api';
import {
  Address,
  AppNotification,
  Branch,
  CartItem,
  Category,
  Product,
  Promotion,
  UserProfile,
} from '../types';

export type PageView =
  | 'home'
  | 'menu'
  | 'checkout'
  | 'track'
  | 'account'
  | 'admin'
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'admin-login';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextValue {
  page: PageView;
  setPage: (p: PageView) => void;
  postAuthRedirect: PageView | null;
  setPostAuthRedirect: (p: PageView | null) => void;
  proceedToCheckout: () => void;

  categories: Category[];
  products: Product[];
  branches: Branch[];
  promotions: Promotion[];
  catalogLoading: boolean;
  catalogError: string | null;
  refreshCatalog: () => Promise<void>;

  selectedBranchId: number | null;
  setSelectedBranchId: (id: number) => void;
  menuCategorySlug: string;
  setMenuCategorySlug: (slug: string) => void;
  activeProduct: Product | null;
  setActiveProduct: (p: Product | null) => void;

  cartItems: CartItem[];
  cartSubtotalCents: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  appliedCoupon: { code: string; discountCents: number } | null;
  setAppliedCoupon: (c: { code: string; discountCents: number } | null) => void;
  addToCart: (product: Product, quantity?: number, optionIds?: number[]) => Promise<void>;
  updateCartItemQty: (itemId: number, quantity: number) => Promise<void>;
  removeCartItem: (itemId: number) => Promise<void>;
  refreshCart: () => Promise<void>;

  user: UserProfile | null;
  authLoading: boolean;
  addresses: Address[];
  favoriteIds: number[];
  notifications: AppNotification[];
  signInWithGoogle: (redirectOverride?: PageView) => Promise<void>;
  loginLocal: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  adminLoginLocal: (email: string, password: string) => Promise<void>;
  registerLocal: (data: {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    phone: string;
    agreeToTerms: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccount: () => Promise<boolean>;
  toggleFavorite: (productId: number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  trackedOrderNumber: string;
  setTrackedOrderNumber: (num: string) => void;
  lastOrderEventAt: number;

  toasts: ToastItem[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [page, setPage] = useState<PageView>('home');
  const [postAuthRedirect, setPostAuthRedirect] = useState<PageView | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [menuCategorySlug, setMenuCategorySlug] = useState<string>('all');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartSubtotalCents, setCartSubtotalCents] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountCents: number } | null>(
    null
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [trackedOrderNumber, setTrackedOrderNumber] = useState('');
  const [lastOrderEventAt, setLastOrderEventAt] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshCatalog = useCallback(async () => {
    try {
      setCatalogError(null);
      const data = await apiFetch<{
        categories: Category[];
        products: Product[];
        branches: Branch[];
        promotions: Promotion[];
      }>('/api/catalog');
      setCategories(data.categories);
      setProducts(data.products);
      setBranches(data.branches);
      setPromotions(data.promotions);
      setSelectedBranchId((prev) => {
        if (prev && data.branches.some((b) => b.id === prev)) return prev;
        const firstAvailable = data.branches.find((b) => b.isAvailable) || data.branches[0];
        return firstAvailable ? firstAvailable.id : null;
      });
    } catch (err: any) {
      setCatalogError(err?.message || 'Could not load menu catalog.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: CartItem[]; subtotalCents: number }>('/api/cart');
      setCartItems(data.items);
      setCartSubtotalCents(data.subtotalCents);
      if (data.items.length === 0) {
        setAppliedCoupon(null);
      }
    } catch {
      // ignore initial cart sync failure
    }
  }, []);

  const refreshAccount = useCallback(async (): Promise<boolean> => {
    try {
      const data = await apiFetch<{
        user: { id: number; uid: string; email: string; role: 'customer' | 'admin' };
        profile: { fullName: string; phone: string; preferredBranchId?: number | null };
        addresses: Address[];
        favoriteProductIds: number[];
        notifications: AppNotification[];
      }>('/api/account/me');
      setUser({
        id: data.user.id,
        uid: data.user.uid,
        email: data.user.email,
        role: data.user.role,
        fullName: data.profile.fullName,
        phone: data.profile.phone,
        preferredBranchId: data.profile.preferredBranchId,
      });
      setAddresses(data.addresses);
      setFavoriteIds(data.favoriteProductIds);
      setNotifications(data.notifications);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
    refreshCart();
    // Restore HTTP-only cookie session if present
    refreshAccount().finally(() => {
      setAuthLoading(false);
    });
  }, [refreshCatalog, refreshCart, refreshAccount]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          setAuthToken(token);
          await apiFetch('/api/auth/sync', { method: 'POST' });
          await refreshAccount();
        } catch (err) {
          console.error('Firebase sync error:', err);
        }
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [refreshAccount]);

  // Real-time WebSocket connection for order updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let reconnectTimer: number | undefined;
    let active = true;

    const connect = () => {
      if (!active) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            userId: user?.id,
            isAdmin: user?.role === 'admin',
            orderNumber: trackedOrderNumber || undefined,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type === 'order:updated' || msg?.type === 'order:created') {
            setLastOrderEventAt(Date.now());
            if (msg.type === 'order:updated' && msg.order?.orderNumber) {
              const statusText =
                msg.order.status === 'Preparing'
                  ? `Order ${msg.order.orderNumber}: Your order is being prepared.`
                  : `Order ${msg.order.orderNumber} is now ${msg.order.status}.`;
              showToast(statusText, 'info');
            }
            if (user) {
              refreshAccount();
            }
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (active) {
          reconnectTimer = window.setTimeout(connect, 4000);
        }
      };
    };

    connect();
    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [user, trackedOrderNumber, refreshAccount, showToast]);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'subscribe',
          userId: user?.id,
          isAdmin: user?.role === 'admin',
          orderNumber: trackedOrderNumber || undefined,
        })
      );
    }
  }, [user, trackedOrderNumber]);

  const completeAuthRedirect = useCallback(
    (overrideTarget?: PageView) => {
      const target = overrideTarget || postAuthRedirect || 'menu';
      setPostAuthRedirect(null);
      setPage(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [postAuthRedirect]
  );

  const proceedToCheckout = useCallback(() => {
    setCartOpen(false);
    if (!user) {
      setPostAuthRedirect('checkout');
      setPage('login');
      showToast('Please sign in or create an account to continue to checkout.', 'info');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setPage('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user, showToast]);

  const signInWithGoogle = async (redirectOverride?: PageView) => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setAuthToken(token);
      await apiFetch('/api/auth/sync', { method: 'POST' });
      await refreshAccount();
      showToast('Signed in with Google successfully.');
      completeAuthRedirect(redirectOverride);
    } catch (err: any) {
      showToast(err?.message || 'Google sign-in was cancelled or failed.', 'error');
      throw err;
    }
  };

  const loginLocal = async (email: string, password: string, rememberMe: boolean) => {
    const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshAccount();
    showToast('Welcome back! Signed in successfully.');
    completeAuthRedirect();
  };

  const adminLoginLocal = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshAccount();
    showToast('Administrator session active.');
    setPostAuthRedirect(null);
    setPage('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const registerLocal = async (data: {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    phone: string;
    agreeToTerms: boolean;
  }) => {
    const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshAccount();
    showToast('Account created! Welcome to Angel\'s Burger Online.');
    completeAuthRedirect();
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore if local session
    }
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setAddresses([]);
    setFavoriteIds([]);
    setNotifications([]);
    setPostAuthRedirect(null);
    if (page === 'admin' || page === 'checkout' || page === 'account') {
      setPage('home');
    }
    showToast('You have been signed out securely.', 'info');
  };

  const addToCart = async (product: Product, quantity = 1, optionIds: number[] = []) => {
    if (!product.isAvailable || product.stockQuantity <= 0) {
      showToast('This product is currently unavailable.', 'error');
      return;
    }
    try {
      const data = await apiFetch<{ items: CartItem[]; subtotalCents: number }>('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          quantity,
          selectedOptionIds: optionIds,
        }),
      });
      setCartItems(data.items);
      setCartSubtotalCents(data.subtotalCents);
      showToast('Product added to cart!');
    } catch (err: any) {
      showToast(err?.message || 'Could not add product to cart.', 'error');
    }
  };

  const updateCartItemQty = async (itemId: number, quantity: number) => {
    try {
      const data = await apiFetch<{ items: CartItem[]; subtotalCents: number }>(
        `/api/cart/items/${itemId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        }
      );
      setCartItems(data.items);
      setCartSubtotalCents(data.subtotalCents);
      if (data.items.length === 0) setAppliedCoupon(null);
    } catch (err: any) {
      showToast(err?.message || 'Could not update cart.', 'error');
    }
  };

  const removeCartItem = async (itemId: number) => {
    try {
      const data = await apiFetch<{ items: CartItem[]; subtotalCents: number }>(
        `/api/cart/items/${itemId}`,
        { method: 'DELETE' }
      );
      setCartItems(data.items);
      setCartSubtotalCents(data.subtotalCents);
      if (data.items.length === 0) setAppliedCoupon(null);
      showToast('Item removed from cart.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Could not remove item.', 'error');
    }
  };

  const toggleFavorite = async (productId: number) => {
    if (!user) {
      setPostAuthRedirect('menu');
      setPage('login');
      showToast('Please sign in to save favorite products.', 'info');
      return;
    }
    try {
      const res = await apiFetch<{ favorited: boolean }>('/api/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      setFavoriteIds((prev) =>
        res.favorited ? Array.from(new Set([...prev, productId])) : prev.filter((id) => id !== productId)
      );
      showToast(res.favorited ? 'Saved to favorites.' : 'Removed from favorites.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Could not update favorites.', 'error');
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  return (
    <AppContext.Provider
      value={{
        page,
        setPage,
        postAuthRedirect,
        setPostAuthRedirect,
        proceedToCheckout,
        categories,
        products,
        branches,
        promotions,
        catalogLoading,
        catalogError,
        refreshCatalog,
        selectedBranchId,
        setSelectedBranchId,
        menuCategorySlug,
        setMenuCategorySlug,
        activeProduct,
        setActiveProduct,
        cartItems,
        cartSubtotalCents,
        cartOpen,
        setCartOpen,
        appliedCoupon,
        setAppliedCoupon,
        addToCart,
        updateCartItemQty,
        removeCartItem,
        refreshCart,
        user,
        authLoading,
        addresses,
        favoriteIds,
        notifications,
        signInWithGoogle,
        loginLocal,
        adminLoginLocal,
        registerLocal,
        logout,
        refreshAccount,
        toggleFavorite,
        markAllNotificationsRead,
        trackedOrderNumber,
        setTrackedOrderNumber,
        lastOrderEventAt,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
