import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { AccountView } from './components/AccountView';
import { AdminDashboard } from './components/AdminDashboard';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutView } from './components/CheckoutView';
import {
  AdminLoginPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
} from './components/CustomerAuthPages';
import { HomeView } from './components/HomeView';
import { MenuView } from './components/MenuView';
import { Navbar } from './components/Navbar';
import { OrderTrackingView } from './components/OrderTrackingView';
import { ProductModal } from './components/ProductModal';

function ToastHost() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
            t.type === 'error'
              ? 'bg-red-600 border-red-700 text-white'
              : t.type === 'info'
                ? 'bg-neutral-900 border-neutral-800 text-white'
                : 'bg-emerald-700 border-emerald-800 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {t.type === 'error' ? (
              <XCircle className="h-4 w-4 shrink-0" />
            ) : t.type === 'info' ? (
              <Info className="h-4 w-4 shrink-0 text-yellow-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            <span>{t.message}</span>
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="opacity-80 hover:opacity-100 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AppShell() {
  const { page } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      <Navbar />
      <main className="flex-1">
        {page === 'home' && <HomeView />}
        {page === 'menu' && <MenuView />}
        {page === 'checkout' && <CheckoutView />}
        {page === 'track' && <OrderTrackingView />}
        {page === 'account' && <AccountView />}
        {page === 'admin' && <AdminDashboard />}
        {page === 'login' && <LoginPage />}
        {page === 'register' && <RegisterPage />}
        {page === 'forgot-password' && <ForgotPasswordPage />}
        {page === 'admin-login' && <AdminLoginPage />}
      </main>
      <ProductModal />
      <CartDrawer />
      <ToastHost />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
