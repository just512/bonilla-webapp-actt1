import { Menu, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { PageView, useApp } from '../context/AppContext';

export function Navbar() {
  const { page, setPage, setPostAuthRedirect, cartItems, setCartOpen, user } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const go = (target: PageView) => {
    setPage(target);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navLinkClass = (active: boolean) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 cursor-pointer ${
      active
        ? 'text-red-600 border-red-600'
        : 'text-neutral-700 border-transparent hover:text-red-600'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          onClick={() => go('home')}
          className="font-display text-xl font-extrabold tracking-tight text-neutral-900 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Angel&apos;s <span className="text-red-600">Burger</span> Online
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          <button onClick={() => go('home')} className={navLinkClass(page === 'home')}>
            Home
          </button>
          <button onClick={() => go('menu')} className={navLinkClass(page === 'menu')}>
            Menu
          </button>
          <button onClick={() => go('track')} className={navLinkClass(page === 'track')}>
            My Orders
          </button>
          {user ? (
            <button onClick={() => go('account')} className={navLinkClass(page === 'account')}>
              My Account
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setPostAuthRedirect(null);
                  go('login');
                }}
                className={navLinkClass(page === 'login' || page === 'forgot-password')}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setPostAuthRedirect(null);
                  go('register');
                }}
                className={navLinkClass(page === 'register')}
              >
                Register
              </button>
            </>
          )}
          {user?.role === 'admin' && (
            <button onClick={() => go('admin')} className={navLinkClass(page === 'admin')}>
              Admin
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Action (My Cart) + Mobile Menu Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCartOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>My Cart</span>
            <span className="tabular-nums bg-yellow-400 text-neutral-900 text-xs font-bold px-2 py-0.5 rounded-full">
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-neutral-700 hover:bg-neutral-100"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-200 bg-white px-4 py-3 space-y-1">
          <button
            onClick={() => go('home')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Home
          </button>
          <button
            onClick={() => go('menu')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Menu
          </button>
          <button
            onClick={() => go('track')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            My Orders
          </button>
          {user ? (
            <button
              onClick={() => go('account')}
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              My Account
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setPostAuthRedirect(null);
                  go('login');
                }}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setPostAuthRedirect(null);
                  go('register');
                }}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-800 hover:bg-neutral-50"
              >
                Register
              </button>
            </>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={() => go('admin')}
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Admin Dashboard
            </button>
          )}
        </div>
      )}
    </header>
  );
}
