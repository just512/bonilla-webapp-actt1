import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Flame,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../lib/api';

function BrandAuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center space-y-3">
      <div className="inline-flex items-center justify-center gap-2.5">
        <div className="h-11 w-11 rounded-2xl bg-red-600 flex items-center justify-center shadow-sm">
          <Flame className="h-6 w-6 text-yellow-400" />
        </div>
        <div className="text-left">
          <div className="font-display text-xl font-extrabold tracking-tight text-neutral-950 leading-none">
            Angel&apos;s <span className="text-red-600">Burger</span>
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mt-0.5">
            Online Ordering
          </div>
        </div>
      </div>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-950">
          {title}
        </h1>
        <p className="text-sm text-neutral-600 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function getPasswordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
  };
}

export function LoginPage() {
  const { setPage, postAuthRedirect, loginLocal, signInWithGoogle } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await loginLocal(email, password, rememberMe);
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-red-50/40 via-white to-white py-12 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <BrandAuthHeader
          title="Welcome Back"
          subtitle="Sign in to place your order and track kitchen updates."
        />

        {postAuthRedirect === 'checkout' && (
          <div className="p-3.5 rounded-2xl bg-yellow-50 border border-yellow-300 text-xs font-semibold text-neutral-900 text-center">
            Sign in or create an account to continue to Checkout. Your cart items are saved.
          </div>
        )}

        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-3.5 pr-11 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-neutral-800 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 accent-red-600 rounded"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => setPage('forgot-password')}
                className="font-semibold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Sign In</span>
            </button>
          </form>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-neutral-200" />
            <span className="px-3 text-xs text-neutral-500">or</span>
            <div className="flex-grow border-t border-neutral-200" />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-sm font-semibold text-neutral-800 transition-colors cursor-pointer disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.4c-.2 1.2-1.5 3.6-5.4 3.6-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c6.9 0 9.6-4.8 9.6-7.3 0-.5 0-.9-.1-1.3H12z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="pt-2 border-t border-neutral-100 text-center space-y-2 text-xs text-neutral-600">
            <div>
              New to Angel&apos;s Burger Online?{' '}
              <button
                type="button"
                onClick={() => setPage('register')}
                className="font-bold text-red-600 hover:underline cursor-pointer"
              >
                Create an Account
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setPage('admin-login')}
                className="text-neutral-500 hover:text-neutral-800 underline underline-offset-4 cursor-pointer"
              >
                Store Administrator Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { setPage, postAuthRedirect, registerLocal, signInWithGoogle } = useApp();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = useMemo(() => getPasswordChecks(password), [password]);
  const isPasswordStrong = checks.length && checks.upper && checks.lower && checks.number;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setError('Please enter a valid contact number (at least 7 digits).');
      return;
    }
    if (!isPasswordStrong) {
      setError('Please create a stronger password meeting all requirements below.');
      return;
    }
    if (!passwordsMatch) {
      setError('Password and Confirm Password do not match.');
      return;
    }
    if (!agreeToTerms) {
      setError('Please agree to the Terms and Conditions before creating your account.');
      return;
    }

    setSubmitting(true);
    try {
      await registerLocal({
        fullName,
        email,
        phone,
        password,
        confirmPassword,
        agreeToTerms,
      });
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-red-50/40 via-white to-white py-10 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        <BrandAuthHeader
          title="Create Your Account"
          subtitle="Register once for faster checkout, saved addresses, and live order tracking."
        />

        {postAuthRedirect === 'checkout' && (
          <div className="p-3.5 rounded-2xl bg-yellow-50 border border-yellow-300 text-xs font-semibold text-neutral-900 text-center">
            Create an account to complete your order. We&apos;ll send you right back to Checkout.
          </div>
        )}

        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Full Name *
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Dela Cruz"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Email Address *
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Contact Number *
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 917 000 0000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full pl-3.5 pr-11 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-neutral-800 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Checklist */}
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                {[
                  { ok: checks.length, label: 'At least 8 characters' },
                  { ok: checks.upper, label: 'One uppercase letter' },
                  { ok: checks.lower, label: 'One lowercase letter' },
                  { ok: checks.number, label: 'One number' },
                ].map((rule) => (
                  <div
                    key={rule.label}
                    className={`inline-flex items-center gap-1.5 ${
                      rule.ok ? 'text-emerald-700 font-semibold' : 'text-neutral-500'
                    }`}
                  >
                    <Check className={`h-3 w-3 ${rule.ok ? 'opacity-100' : 'opacity-30'}`} />
                    <span>{rule.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full pl-3.5 pr-11 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-neutral-800 cursor-pointer"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">
                  Passwords do not match.
                </p>
              )}
            </div>

            <label className="flex items-start gap-2.5 text-xs text-neutral-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="h-4 w-4 mt-0.5 accent-red-600 rounded shrink-0"
              />
              <span>
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => setTermsModalOpen(true)}
                  className="font-semibold text-red-600 hover:underline cursor-pointer"
                >
                  Terms and Conditions
                </button>{' '}
                of Angel&apos;s Burger Online.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Create Account</span>
            </button>
          </form>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-neutral-200" />
            <span className="px-3 text-xs text-neutral-500">or</span>
            <div className="flex-grow border-t border-neutral-200" />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => signInWithGoogle()}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-sm font-semibold text-neutral-800 transition-colors cursor-pointer disabled:opacity-60"
          >
            <span>Continue with Google</span>
          </button>

          <div className="pt-2 border-t border-neutral-100 text-center text-xs text-neutral-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setPage('login')}
              className="font-bold text-red-600 hover:underline cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      {termsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-neutral-200 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-neutral-900">
                Terms &amp; Conditions
              </h3>
              <button
                onClick={() => setTermsModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-neutral-600 space-y-2.5 leading-relaxed">
              <p>
                By creating an account on Angel&apos;s Burger Online, you agree to provide accurate
                contact and delivery details so our branch kitchens can prepare and fulfill your
                orders accurately.
              </p>
              <p>
                Prices and menu availability are verified on the server at checkout. Your account
                information and order history are private and protected by authenticated access
                controls.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAgreeToTerms(true);
                setTermsModalOpen(false);
              }}
              className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold cursor-pointer"
            >
              Accept &amp; Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ForgotPasswordPage() {
  const { setPage, showToast } = useApp();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [issuedCodeHint, setIssuedCodeHint] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = useMemo(() => getPasswordChecks(newPassword), [newPassword]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string; verificationCode?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setIssuedCodeHint(res.verificationCode || null);
      if (res.verificationCode) {
        setCode(res.verificationCode);
      }
      setStep('reset');
      showToast(res.message, 'info');
    } catch (err: any) {
      setError(err?.message || 'Unable to process reset request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword, confirmPassword }),
      });
      showToast(res.message);
      setPage('login');
    } catch (err: any) {
      setError(err?.message || 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-red-50/40 via-white to-white py-12 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <BrandAuthHeader
          title="Reset Your Password"
          subtitle={
            step === 'request'
              ? 'Enter your registered email address to receive a verification code.'
              : 'Enter your verification code and choose a strong new password.'
          }
        />

        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Send Verification Code</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {issuedCodeHint && (
                <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-300 text-xs text-neutral-900">
                  Preview verification code: <span className="font-mono font-bold">{issuedCodeHint}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-mono focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full pl-3.5 pr-11 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 cursor-pointer"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-neutral-500">
                  <span className={checks.length ? 'text-emerald-700 font-semibold' : ''}>
                    8+ characters
                  </span>
                  <span className={checks.upper ? 'text-emerald-700 font-semibold' : ''}>
                    1 uppercase
                  </span>
                  <span className={checks.lower ? 'text-emerald-700 font-semibold' : ''}>
                    1 lowercase
                  </span>
                  <span className={checks.number ? 'text-emerald-700 font-semibold' : ''}>
                    1 number
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Reset Password</span>
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-neutral-100 text-center">
            <button
              type="button"
              onClick={() => setPage('login')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminLoginPage() {
  const { adminLoginLocal, signInWithGoogle, setPage } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminLoginLocal(email, password);
    } catch (err: any) {
      setError(err?.message || 'Administrator authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-neutral-950 py-12 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-red-600 flex items-center justify-center text-yellow-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-neutral-950">
            Store Admin Portal
          </h1>
          <p className="text-xs text-neutral-600">
            Authorized administrators only. Customer accounts cannot access store management.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs font-medium text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Administrator Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@angelsburger.ph"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full pl-3.5 pr-11 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-red-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Sign In to Admin Console</span>
          </button>
        </form>

        <button
          type="button"
          disabled={submitting}
          onClick={() => signInWithGoogle('admin')}
          className="w-full py-2.5 px-4 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 cursor-pointer"
        >
          Sign In with Authorized Google Admin
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setPage('home')}
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer"
          >
            Return to Customer Storefront
          </button>
        </div>
      </div>
    </div>
  );
}
