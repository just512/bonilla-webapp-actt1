import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import express, { Router } from 'express';
import multer from 'multer';
import { db } from '../db/index.ts';
import {
  addresses,
  branches,
  cartItems,
  carts,
  categories,
  coupons,
  favorites,
  inventory,
  notifications,
  orderItems,
  orders,
  passwordResetTokens,
  payments,
  productOptions,
  products,
  profiles,
  reviews,
  users,
} from '../db/schema.ts';
import { ensureSeeded } from '../db/seed.ts';
import { authenticateLocalUser, registerLocalUser } from '../db/users.ts';
import {
  AuthRequest,
  clearSessionCookie,
  optionalAuth,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  signSessionToken,
} from '../middleware/auth.ts';
import { broadcastOrderEvent } from './realtime.ts';

const VALID_ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready for Pickup',
  'Out for Delivery',
  'Completed',
  'Cancelled',
] as const;

const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
      };
      const ext = extMap[file.mimetype] || '.jpg';
      cb(null, `product_${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images under 5MB are allowed.'));
    }
  },
});

function sanitizeText(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/[<>]/g, '').slice(0, maxLen);
}

function validateStrongPassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  return null;
}

function slugify(val: string): string {
  return val
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function computeCouponDiscount(
  code: string | undefined | null,
  subtotalCents: number
): Promise<{ discountCents: number; couponCode: string | null; couponError?: string }> {
  if (!code || !code.trim()) {
    return { discountCents: 0, couponCode: null };
  }
  const normalized = code.trim().toUpperCase();
  const found = await db.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  const coupon = found[0];
  if (!coupon || !coupon.isActive) {
    return { discountCents: 0, couponCode: null, couponError: 'Coupon code is invalid or inactive.' };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    return { discountCents: 0, couponCode: null, couponError: 'This coupon has expired.' };
  }
  if (subtotalCents < coupon.minOrderCents) {
    return {
      discountCents: 0,
      couponCode: null,
      couponError: `Minimum order of ₱${(coupon.minOrderCents / 100).toFixed(2)} required for ${coupon.code}.`,
    };
  }
  const discountCents =
    coupon.discountType === 'percent'
      ? Math.round((subtotalCents * coupon.discountValue) / 100)
      : Math.min(subtotalCents, coupon.discountValue);

  return { discountCents, couponCode: coupon.code };
}

export function createApiRouter() {
  const router = Router();

  // Lazy seed middleware on API traffic
  router.use(async (_req, res, next) => {
    try {
      await ensureSeeded();
      next();
    } catch (error) {
      console.error('Database seed/init check failed:', error);
      res.status(503).json({ error: 'Service is initializing. Please retry shortly.' });
    }
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ---------------------------------------------------------------------------
  // PUBLIC CATALOG
  // ---------------------------------------------------------------------------
  router.get('/catalog', async (_req, res) => {
    try {
      const [allCategories, allProducts, allOptions, allInventory, allBranches, allReviews, allCoupons] =
        await Promise.all([
          db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
          db.select().from(products).orderBy(asc(products.id)),
          db.select().from(productOptions).where(eq(productOptions.isAvailable, true)),
          db.select().from(inventory),
          db.select().from(branches).orderBy(asc(branches.id)),
          db.select().from(reviews).orderBy(desc(reviews.createdAt)),
          db.select().from(coupons).where(eq(coupons.isActive, true)),
        ]);

      const invMap = new Map(allInventory.map((inv) => [inv.productId, inv]));
      const optMap = new Map<number, typeof allOptions>();
      for (const opt of allOptions) {
        const list = optMap.get(opt.productId) || [];
        list.push(opt);
        optMap.set(opt.productId, list);
      }

      const revMap = new Map<number, { count: number; sum: number; recent: typeof allReviews }>();
      for (const rev of allReviews) {
        const entry = revMap.get(rev.productId) || { count: 0, sum: 0, recent: [] };
        entry.count += 1;
        entry.sum += rev.rating;
        if (entry.recent.length < 10) entry.recent.push(rev);
        revMap.set(rev.productId, entry);
      }

      const enrichedProducts = allProducts.map((p) => {
        const inv = invMap.get(p.id);
        const rev = revMap.get(p.id);
        const stockQuantity = inv?.stockQuantity ?? 0;
        return {
          ...p,
          stockQuantity,
          lowStockThreshold: inv?.lowStockThreshold ?? 10,
          inStock: p.isAvailable && stockQuantity > 0,
          options: optMap.get(p.id) || [],
          reviewCount: rev?.count ?? 0,
          avgRating: rev && rev.count > 0 ? Number((rev.sum / rev.count).toFixed(1)) : 0,
          reviews: rev?.recent || [],
        };
      });

      res.json({
        categories: allCategories,
        products: enrichedProducts,
        branches: allBranches,
        promotions: allCoupons.map((c) => ({
          code: c.code,
          description: c.description,
          discountType: c.discountType,
          discountValue: c.discountValue,
          minOrderCents: c.minOrderCents,
        })),
      });
    } catch (error) {
      console.error('Failed to load catalog:', error);
      res.status(500).json({ error: 'Unable to load menu catalog.' });
    }
  });

  // ---------------------------------------------------------------------------
  // AUTHENTICATION & ACCOUNT
  // ---------------------------------------------------------------------------
  router.post('/auth/register', async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 160).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const confirmPassword =
        typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';
      const fullName = sanitizeText(req.body?.fullName, 120);
      const phone = sanitizeText(req.body?.phone, 40);
      const agreeToTerms = Boolean(req.body?.agreeToTerms);

      if (!fullName) {
        return res.status(400).json({ error: 'Full name is required.' });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (!phone || phone.replace(/\D/g, '').length < 7) {
        return res.status(400).json({ error: 'Please enter a valid contact number.' });
      }
      const pwError = validateStrongPassword(password);
      if (pwError) {
        return res.status(400).json({ error: pwError });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }
      if (!agreeToTerms) {
        return res.status(400).json({ error: 'You must agree to the Terms and Conditions.' });
      }

      const user = await registerLocalUser({ email, password, fullName, phone });
      const token = signSessionToken({ userId: user.id, uid: user.uid, email: user.email }, true);
      setSessionCookie(req, res, token, true);

      res.status(201).json({
        token,
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          role: user.role,
          fullName,
          phone,
        },
      });
    } catch (error: any) {
      if (error?.message === 'EMAIL_EXISTS') {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      console.error('Registration failed:', error);
      res.status(500).json({ error: 'Could not register account.' });
    }
  });

  router.post('/auth/login', async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 160).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const rememberMe = req.body?.rememberMe !== false;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (!password) {
        return res.status(400).json({ error: 'Password is required.' });
      }

      const user = await authenticateLocalUser(email, password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const profileRows = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
      const profile = profileRows[0];
      const token = signSessionToken(
        { userId: user.id, uid: user.uid, email: user.email },
        rememberMe
      );
      setSessionCookie(req, res, token, rememberMe);

      res.json({
        token,
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          role: user.role,
          fullName: profile?.fullName || '',
          phone: profile?.phone || '',
        },
      });
    } catch (error) {
      console.error('Login failed:', error);
      res.status(500).json({ error: 'Sign in failed. Please try again.' });
    }
  });

  router.post('/auth/admin-login', async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 160).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password) {
        return res.status(400).json({ error: 'Administrator email and password are required.' });
      }

      const user = await authenticateLocalUser(email, password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid administrator credentials.' });
      }
      if (user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access denied: This account does not have administrator privileges.',
        });
      }

      const profileRows = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
      const profile = profileRows[0];
      const token = signSessionToken({ userId: user.id, uid: user.uid, email: user.email }, false);
      setSessionCookie(req, res, token, false);

      res.json({
        token,
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          role: user.role,
          fullName: profile?.fullName || 'Store Administrator',
          phone: profile?.phone || '',
        },
      });
    } catch (error) {
      console.error('Admin login failed:', error);
      res.status(500).json({ error: 'Administrator sign in failed.' });
    }
  });

  router.post('/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  router.post('/auth/forgot-password', async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 160).toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = found[0];

      if (!user) {
        return res.json({
          message:
            'If an account exists for that email, a 6-digit password reset code has been generated.',
        });
      }

      const code = String(crypto.randomInt(100000, 999999));
      const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      res.json({
        message: 'A 6-digit verification code has been generated and expires in 15 minutes.',
        ...(process.env.NODE_ENV !== 'production' ? { verificationCode: code } : {}),
      });
    } catch (error) {
      console.error('Forgot password failed:', error);
      res.status(500).json({ error: 'Unable to start password reset.' });
    }
  });

  router.post('/auth/reset-password', async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 160).toLowerCase();
      const code = sanitizeText(req.body?.code, 20);
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      const confirmPassword =
        typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

      if (!email || !code) {
        return res.status(400).json({ error: 'Email and verification code are required.' });
      }
      const pwError = validateStrongPassword(newPassword);
      if (pwError) {
        return res.status(400).json({ error: pwError });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = found[0];
      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired verification code.' });
      }

      const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
      const tokenRows = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            eq(passwordResetTokens.tokenHash, tokenHash)
          )
        )
        .orderBy(desc(passwordResetTokens.createdAt))
        .limit(1);

      const record = tokenRows[0];
      if (!record || record.usedAt || new Date(record.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({ error: 'Invalid or expired verification code.' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(users.id, user.id));
        await tx
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.id, record.id));
      });

      res.json({ message: 'Your password has been reset. You can now sign in.' });
    } catch (error) {
      console.error('Reset password failed:', error);
      res.status(500).json({ error: 'Unable to reset password.' });
    }
  });

  router.post('/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const authUser = req.authUser!;
      const profileRows = await db.select().from(profiles).where(eq(profiles.userId, authUser.id)).limit(1);
      const profile = profileRows[0];

      res.json({
        user: {
          id: authUser.id,
          uid: authUser.uid,
          email: authUser.email,
          role: authUser.role,
          fullName: profile?.fullName || '',
          phone: profile?.phone || '',
          preferredBranchId: profile?.preferredBranchId || null,
        },
      });
    } catch (error) {
      console.error('Auth sync error:', error);
      res.status(500).json({ error: 'Failed to synchronize account.' });
    }
  });

  router.get('/account/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const [profileRows, userAddresses, userFavorites, userNotifications] = await Promise.all([
        db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
        db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault)),
        db.select().from(favorites).where(eq(favorites.userId, userId)),
        db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, userId))
          .orderBy(desc(notifications.createdAt))
          .limit(20),
      ]);

      res.json({
        user: req.authUser,
        profile: profileRows[0] || { fullName: '', phone: '', preferredBranchId: null },
        addresses: userAddresses,
        favoriteProductIds: userFavorites.map((f) => f.productId),
        notifications: userNotifications,
      });
    } catch (error) {
      console.error('Failed to fetch account:', error);
      res.status(500).json({ error: 'Unable to load account details.' });
    }
  });

  router.put('/account/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const fullName = sanitizeText(req.body?.fullName, 120);
      const phone = sanitizeText(req.body?.phone, 40);
      const preferredBranchId =
        typeof req.body?.preferredBranchId === 'number' ? req.body.preferredBranchId : null;

      if (!fullName) {
        return res.status(400).json({ error: 'Full name cannot be empty.' });
      }

      const updated = await db
        .insert(profiles)
        .values({ userId, fullName, phone, preferredBranchId, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { fullName, phone, preferredBranchId, updatedAt: new Date() },
        })
        .returning();

      res.json({ profile: updated[0] });
    } catch (error) {
      console.error('Failed to update profile:', error);
      res.status(500).json({ error: 'Could not update profile.' });
    }
  });

  router.post('/account/change-password', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

      const pwError = validateStrongPassword(newPassword);
      if (pwError) {
        return res.status(400).json({ error: pwError });
      }

      const found = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = found[0];
      if (!user) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      if (user.passwordHash) {
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
          return res.status(400).json({ error: 'Current password is incorrect.' });
        }
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

      res.json({ message: 'Password updated successfully.' });
    } catch (error) {
      console.error('Change password failed:', error);
      res.status(500).json({ error: 'Could not update password.' });
    }
  });

  router.post('/account/addresses', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const label = sanitizeText(req.body?.label, 40) || 'Home';
      const recipientName = sanitizeText(req.body?.recipientName, 120);
      const phone = sanitizeText(req.body?.phone, 40);
      const streetAddress = sanitizeText(req.body?.streetAddress, 250);
      const city = sanitizeText(req.body?.city, 80);
      const notes = sanitizeText(req.body?.notes, 200);
      const isDefault = Boolean(req.body?.isDefault);

      if (!recipientName || !phone || !streetAddress || !city) {
        return res.status(400).json({ error: 'All address fields are required.' });
      }

      if (isDefault) {
        await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
      }

      const inserted = await db
        .insert(addresses)
        .values({
          userId,
          label,
          recipientName,
          phone,
          streetAddress,
          city,
          notes,
          isDefault,
        })
        .returning();

      res.status(201).json({ address: inserted[0] });
    } catch (error) {
      console.error('Add address failed:', error);
      res.status(500).json({ error: 'Could not save address.' });
    }
  });

  router.delete('/account/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const userId = req.authUser!.id;
      await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete address failed:', error);
      res.status(500).json({ error: 'Could not delete address.' });
    }
  });

  router.post('/favorites/toggle', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const productId = Number(req.body?.productId);
      if (!Number.isInteger(productId)) {
        return res.status(400).json({ error: 'Invalid product ID.' });
      }

      const existing = await db
        .select()
        .from(favorites)
        .where(and(eq(favorites.userId, userId), eq(favorites.productId, productId)))
        .limit(1);

      if (existing[0]) {
        await db.delete(favorites).where(eq(favorites.id, existing[0].id));
        return res.json({ favorited: false });
      }

      await db.insert(favorites).values({ userId, productId });
      res.json({ favorited: true });
    } catch (error) {
      console.error('Favorite toggle failed:', error);
      res.status(500).json({ error: 'Could not update favorites.' });
    }
  });

  router.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, req.authUser!.id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Mark notifications read failed:', error);
      res.status(500).json({ error: 'Failed to update notifications.' });
    }
  });

  // ---------------------------------------------------------------------------
  // SERVER-PERSISTED CART
  // ---------------------------------------------------------------------------
  async function getOrCreateCart(sessionToken: string, userId?: number) {
    const existing = await db.select().from(carts).where(eq(carts.sessionToken, sessionToken)).limit(1);
    if (existing[0]) {
      if (userId && !existing[0].userId) {
        await db.update(carts).set({ userId, updatedAt: new Date() }).where(eq(carts.id, existing[0].id));
      }
      return existing[0];
    }
    const inserted = await db
      .insert(carts)
      .values({ sessionToken, userId: userId ?? null })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) return inserted[0];
    const retry = await db.select().from(carts).where(eq(carts.sessionToken, sessionToken)).limit(1);
    return retry[0];
  }

  async function buildCartResponse(cartId: number) {
    const rows = await db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        selectedOptionIdsJson: cartItems.selectedOptionIdsJson,
        productName: products.name,
        productPriceCents: products.priceCents,
        imageUrl: products.imageUrl,
        isAvailable: products.isAvailable,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cartId))
      .orderBy(asc(cartItems.id));

    const allOptions = await db.select().from(productOptions);
    const optById = new Map(allOptions.map((o) => [o.id, o]));

    const items = rows.map((row) => {
      let optionIds: number[] = [];
      try {
        optionIds = JSON.parse(row.selectedOptionIdsJson || '[]');
      } catch {
        optionIds = [];
      }
      const selectedOptions = optionIds
        .map((id) => optById.get(id))
        .filter((o): o is NonNullable<typeof o> => Boolean(o && o.productId === row.productId));
      const optionsDelta = selectedOptions.reduce((sum, o) => sum + o.priceDeltaCents, 0);
      const unitPriceCents = row.productPriceCents + optionsDelta;

      return {
        id: row.id,
        productId: row.productId,
        productName: row.productName,
        imageUrl: row.imageUrl,
        isAvailable: row.isAvailable,
        quantity: row.quantity,
        selectedOptions: selectedOptions.map((o) => ({
          id: o.id,
          name: o.name,
          priceDeltaCents: o.priceDeltaCents,
        })),
        unitPriceCents,
        lineTotalCents: unitPriceCents * row.quantity,
      };
    });

    const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);
    return { items, subtotalCents };
  }

  router.get('/cart', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = sanitizeText(req.headers['x-cart-session'] as string, 100);
      if (!sessionToken) {
        return res.json({ items: [], subtotalCents: 0 });
      }
      const cart = await getOrCreateCart(sessionToken, req.authUser?.id);
      const payload = await buildCartResponse(cart.id);
      res.json(payload);
    } catch (error) {
      console.error('Get cart failed:', error);
      res.status(500).json({ error: 'Unable to load shopping cart.' });
    }
  });

  router.post('/cart/items', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = sanitizeText(req.headers['x-cart-session'] as string, 100);
      if (!sessionToken) {
        return res.status(400).json({ error: 'Missing cart session token.' });
      }

      const productId = Number(req.body?.productId);
      const quantity = Math.max(1, Math.min(50, Number(req.body?.quantity || 1)));
      const selectedOptionIds = Array.isArray(req.body?.selectedOptionIds)
        ? req.body.selectedOptionIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n))
        : [];

      const prodRows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      const product = prodRows[0];
      if (!product || !product.isAvailable) {
        return res.status(400).json({ error: 'This product is currently unavailable.' });
      }

      const invRows = await db.select().from(inventory).where(eq(inventory.productId, productId)).limit(1);
      const availableStock = invRows[0]?.stockQuantity ?? 0;
      if (availableStock <= 0) {
        return res.status(400).json({ error: 'This product is currently out of stock.' });
      }

      const validOptions = selectedOptionIds.length
        ? await db
            .select()
            .from(productOptions)
            .where(and(eq(productOptions.productId, productId), inArray(productOptions.id, selectedOptionIds)))
        : [];
      const sortedOptionIds = validOptions.map((o) => o.id).sort((a, b) => a - b);
      const optionsDelta = validOptions.reduce((sum, o) => sum + o.priceDeltaCents, 0);
      const unitPriceCents = product.priceCents + optionsDelta;
      const optionKey = JSON.stringify(sortedOptionIds);

      const cart = await getOrCreateCart(sessionToken, req.authUser?.id);
      const existingItems = await db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId)));

      const matching = existingItems.find((i) => i.selectedOptionIdsJson === optionKey);
      if (matching) {
        const nextQty = Math.min(availableStock, matching.quantity + quantity);
        await db
          .update(cartItems)
          .set({ quantity: nextQty, unitPriceCents })
          .where(eq(cartItems.id, matching.id));
      } else {
        await db.insert(cartItems).values({
          cartId: cart.id,
          productId,
          quantity: Math.min(availableStock, quantity),
          selectedOptionIdsJson: optionKey,
          unitPriceCents,
        });
      }

      const payload = await buildCartResponse(cart.id);
      res.json(payload);
    } catch (error) {
      console.error('Add cart item failed:', error);
      res.status(500).json({ error: 'Could not add item to cart.' });
    }
  });

  router.patch('/cart/items/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = sanitizeText(req.headers['x-cart-session'] as string, 100);
      const itemId = Number(req.params.id);
      const quantity = Number(req.body?.quantity);
      if (!sessionToken || !Number.isInteger(itemId)) {
        return res.status(400).json({ error: 'Invalid request.' });
      }

      const cart = await getOrCreateCart(sessionToken, req.authUser?.id);
      if (quantity <= 0) {
        await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
      } else {
        await db
          .update(cartItems)
          .set({ quantity: Math.min(50, quantity) })
          .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
      }
      const payload = await buildCartResponse(cart.id);
      res.json(payload);
    } catch (error) {
      console.error('Update cart item failed:', error);
      res.status(500).json({ error: 'Could not update cart.' });
    }
  });

  router.delete('/cart/items/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = sanitizeText(req.headers['x-cart-session'] as string, 100);
      const itemId = Number(req.params.id);
      const cart = await getOrCreateCart(sessionToken, req.authUser?.id);
      await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
      const payload = await buildCartResponse(cart.id);
      res.json(payload);
    } catch (error) {
      console.error('Remove cart item failed:', error);
      res.status(500).json({ error: 'Could not remove item.' });
    }
  });

  router.delete('/cart', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const sessionToken = sanitizeText(req.headers['x-cart-session'] as string, 100);
      if (sessionToken) {
        const cart = await getOrCreateCart(sessionToken, req.authUser?.id);
        await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      }
      res.json({ items: [], subtotalCents: 0 });
    } catch (error) {
      console.error('Clear cart failed:', error);
      res.status(500).json({ error: 'Could not clear cart.' });
    }
  });

  // ---------------------------------------------------------------------------
  // COUPONS & REVIEWS
  // ---------------------------------------------------------------------------
  router.post('/coupons/validate', async (req, res) => {
    try {
      const code = sanitizeText(req.body?.code, 40);
      const subtotalCents = Math.max(0, Number(req.body?.subtotalCents || 0));
      const result = await computeCouponDiscount(code, subtotalCents);
      if (result.couponError) {
        return res.status(400).json({ error: result.couponError });
      }
      res.json({
        couponCode: result.couponCode,
        discountCents: result.discountCents,
      });
    } catch (error) {
      console.error('Validate coupon failed:', error);
      res.status(500).json({ error: 'Could not validate coupon.' });
    }
  });

  router.post('/products/:id/reviews', requireAuth, async (req: AuthRequest, res) => {
    try {
      const productId = Number(req.params.id);
      const rating = Number(req.body?.rating);
      const comment = sanitizeText(req.body?.comment, 600);
      if (!Number.isInteger(productId) || rating < 1 || rating > 5 || !comment) {
        return res.status(400).json({ error: 'Rating (1-5) and comment are required.' });
      }

      const profileRows = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, req.authUser!.id))
        .limit(1);
      const authorName = profileRows[0]?.fullName || req.authUser!.email.split('@')[0];

      const inserted = await db
        .insert(reviews)
        .values({
          productId,
          userId: req.authUser!.id,
          authorName,
          rating,
          comment,
        })
        .returning();

      res.status(201).json({ review: inserted[0] });
    } catch (error) {
      console.error('Create review failed:', error);
      res.status(500).json({ error: 'Could not submit review.' });
    }
  });

  // ---------------------------------------------------------------------------
  // CHECKOUT, ORDER PLACEMENT & TRACKING (AUTHENTICATED & SERVER-VALIDATED)
  // ---------------------------------------------------------------------------
  router.post('/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const customerName = sanitizeText(req.body?.customerName, 120);
      const customerPhone = sanitizeText(req.body?.customerPhone, 40);
      const branchId = Number(req.body?.branchId);
      const fulfillmentType = req.body?.fulfillmentType === 'pickup' ? 'pickup' : 'delivery';
      const deliveryAddress =
        fulfillmentType === 'delivery'
          ? sanitizeText(req.body?.deliveryAddress, 300)
          : sanitizeText(req.body?.deliveryAddress, 300) || 'Store Pickup';
      const pickupTime =
        fulfillmentType === 'pickup' ? sanitizeText(req.body?.pickupTime, 60) || 'ASAP (15-20 mins)' : null;
      const paymentMethod = req.body?.paymentMethod as 'cod' | 'cop' | 'gcash';
      const couponCodeInput = sanitizeText(req.body?.couponCode, 40);
      const notes = sanitizeText(req.body?.notes, 300);
      const gcashReference = sanitizeText(req.body?.gcashReference, 80);
      const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

      if (!customerName || !customerPhone) {
        return res.status(400).json({ error: 'Customer full name and contact number are required.' });
      }
      if (!Number.isInteger(branchId)) {
        return res.status(400).json({ error: 'Please select a branch.' });
      }
      if (fulfillmentType === 'delivery' && !deliveryAddress) {
        return res.status(400).json({ error: 'Delivery address is required for delivery orders.' });
      }
      if (!['cod', 'cop', 'gcash'].includes(paymentMethod)) {
        return res.status(400).json({ error: 'Please select a valid payment method.' });
      }
      if (rawItems.length === 0) {
        return res.status(400).json({ error: 'Your cart is empty.' });
      }

      const branchRows = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1);
      const branch = branchRows[0];
      if (!branch || !branch.isAvailable) {
        return res.status(400).json({ error: 'Selected branch is currently unavailable.' });
      }
      if (paymentMethod === 'cod' && (fulfillmentType !== 'delivery' || !branch.supportsCod)) {
        return res.status(400).json({ error: 'Cash on Delivery is not available for this order.' });
      }
      if (paymentMethod === 'cop' && fulfillmentType !== 'pickup') {
        return res.status(400).json({ error: 'Cash on Pickup is only available for pickup orders.' });
      }
      if (paymentMethod === 'gcash' && !branch.supportsGcash) {
        return res.status(400).json({ error: 'GCash is not currently enabled for this branch.' });
      }

      // Server-side price lookup & inventory verification
      const productIds: number[] = Array.from(
        new Set<number>(
          rawItems.map((i: any) => Number(i.productId)).filter((n: number) => Number.isInteger(n))
        )
      );
      if (productIds.length === 0) {
        return res.status(400).json({ error: 'No valid products found in order.' });
      }
      const [dbProducts, dbOptions, dbInventory] = await Promise.all([
        db.select().from(products).where(inArray(products.id, productIds)),
        db.select().from(productOptions).where(inArray(productOptions.productId, productIds)),
        db.select().from(inventory).where(inArray(inventory.productId, productIds)),
      ]);

      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));
      const optMap = new Map(dbOptions.map((o) => [o.id, o]));
      const invMap = new Map(dbInventory.map((inv) => [inv.productId, inv.stockQuantity]));

      const requestedQtyPerProduct = new Map<number, number>();
      const preparedLines: Array<{
        productId: number;
        productName: string;
        unitPriceCents: number;
        quantity: number;
        optionsSummary: string;
        lineTotalCents: number;
      }> = [];

      for (const raw of rawItems) {
        const pid = Number(raw.productId);
        const qty = Math.max(1, Math.min(50, Number(raw.quantity || 1)));
        const prod = prodMap.get(pid);
        if (!prod || !prod.isAvailable) {
          return res.status(400).json({ error: `Item "${prod?.name || pid}" is currently unavailable.` });
        }

        const optIds: number[] = Array.isArray(raw.selectedOptionIds)
          ? raw.selectedOptionIds.map((x: unknown) => Number(x))
          : [];
        const chosenOpts = optIds
          .map((oid) => optMap.get(oid))
          .filter((o): o is NonNullable<typeof o> => Boolean(o && o.productId === pid && o.isAvailable));

        const delta = chosenOpts.reduce((sum, o) => sum + o.priceDeltaCents, 0);
        const unitPriceCents = prod.priceCents + delta;
        const lineTotalCents = unitPriceCents * qty;

        requestedQtyPerProduct.set(pid, (requestedQtyPerProduct.get(pid) || 0) + qty);
        preparedLines.push({
          productId: pid,
          productName: prod.name,
          unitPriceCents,
          quantity: qty,
          optionsSummary: chosenOpts.map((o) => o.name).join(', ') || 'Standard',
          lineTotalCents,
        });
      }

      for (const [pid, neededQty] of requestedQtyPerProduct.entries()) {
        const available = invMap.get(pid) ?? 0;
        if (available < neededQty) {
          const pName = prodMap.get(pid)?.name || 'Selected item';
          return res.status(400).json({
            error: `Insufficient stock for ${pName}. Only ${available} remaining.`,
          });
        }
      }

      const subtotalCents = preparedLines.reduce((sum, l) => sum + l.lineTotalCents, 0);
      const deliveryFeeCents = fulfillmentType === 'delivery' ? branch.deliveryFeeCents : 0;
      const couponResult = await computeCouponDiscount(couponCodeInput, subtotalCents);
      if (couponResult.couponError) {
        return res.status(400).json({ error: couponResult.couponError });
      }
      const discountCents = couponResult.discountCents;
      const grandTotalCents = Math.max(0, subtotalCents + deliveryFeeCents - discountCents);
      const orderNumber = `AB-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      const createdOrder = await db.transaction(async (tx) => {
        // Atomic stock decrement
        for (const [pid, neededQty] of requestedQtyPerProduct.entries()) {
          const updatedInv = await tx
            .update(inventory)
            .set({
              stockQuantity: sql`${inventory.stockQuantity} - ${neededQty}`,
              updatedAt: new Date(),
            })
            .where(and(eq(inventory.productId, pid), gte(inventory.stockQuantity, neededQty)))
            .returning();

          if (!updatedInv[0]) {
            throw new Error(`STOCK_CONFLICT_${pid}`);
          }
        }

        const [order] = await tx
          .insert(orders)
          .values({
            orderNumber,
            userId: req.authUser?.id ?? null,
            branchId: branch.id,
            customerName,
            customerPhone,
            deliveryAddress:
              fulfillmentType === 'pickup' ? `Pickup at ${branch.name}` : deliveryAddress,
            fulfillmentType,
            pickupTime,
            paymentMethod,
            paymentStatus: paymentMethod === 'gcash' && gcashReference ? 'Paid' : 'Pending',
            status: 'Pending',
            subtotalCents,
            deliveryFeeCents,
            discountCents,
            grandTotalCents,
            couponCode: couponResult.couponCode,
            notes: notes || null,
          })
          .returning();

        await tx.insert(orderItems).values(
          preparedLines.map((line) => ({
            orderId: order.id,
            ...line,
          }))
        );

        await tx.insert(payments).values({
          orderId: order.id,
          method: paymentMethod,
          amountCents: grandTotalCents,
          status: paymentMethod === 'gcash' && gcashReference ? 'Paid' : 'Pending',
          referenceCode: paymentMethod === 'gcash' ? gcashReference || `GC-${orderNumber.slice(-6)}` : null,
          paidAt: paymentMethod === 'gcash' && gcashReference ? new Date() : null,
        });

        if (req.authUser?.id) {
          await tx.insert(notifications).values({
            userId: req.authUser.id,
            orderId: order.id,
            title: `Order ${orderNumber} Placed`,
            message: `We received your order totaling ₱${(grandTotalCents / 100).toFixed(2)}.`,
            isRead: false,
          });
        }

        const cartSession = sanitizeText(req.headers['x-cart-session'] as string, 100);
        if (cartSession) {
          const existingCart = await tx
            .select()
            .from(carts)
            .where(eq(carts.sessionToken, cartSession))
            .limit(1);
          if (existingCart[0]) {
            await tx.delete(cartItems).where(eq(cartItems.cartId, existingCart[0].id));
          }
        }

        return order;
      });

      broadcastOrderEvent('order:created', createdOrder);

      res.status(201).json({
        order: {
          ...createdOrder,
          branch,
          items: preparedLines,
        },
      });
    } catch (error: any) {
      if (typeof error?.message === 'string' && error.message.startsWith('STOCK_CONFLICT_')) {
        return res.status(409).json({ error: 'Stock changed during checkout. Please review your cart.' });
      }
      console.error('Place order failed:', error);
      res.status(500).json({ error: 'Could not place order. Please try again.' });
    }
  });

  router.get('/orders/my', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, req.authUser!.id))
        .orderBy(desc(orders.createdAt));

      if (!userOrders.length) {
        return res.json({ orders: [] });
      }

      const orderIds = userOrders.map((o) => o.id);
      const [items, allBranches] = await Promise.all([
        db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
        db.select().from(branches),
      ]);
      const branchMap = new Map(allBranches.map((b) => [b.id, b]));
      const itemMap = new Map<number, typeof items>();
      for (const item of items) {
        const list = itemMap.get(item.orderId) || [];
        list.push(item);
        itemMap.set(item.orderId, list);
      }

      res.json({
        orders: userOrders.map((o) => ({
          ...o,
          branch: branchMap.get(o.branchId) || null,
          items: itemMap.get(o.id) || [],
        })),
      });
    } catch (error) {
      console.error('Fetch my orders failed:', error);
      res.status(500).json({ error: 'Unable to fetch order history.' });
    }
  });

  router.get('/orders/track/:orderNumber', requireAuth, async (req: AuthRequest, res) => {
    try {
      const orderNumber = sanitizeText(req.params.orderNumber, 40).toUpperCase();
      if (!orderNumber) {
        return res.status(400).json({ error: 'Order number is required.' });
      }

      const found = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
      const order = found[0];
      if (!order) {
        return res.status(404).json({ error: `Order ${orderNumber} was not found.` });
      }

      const isOwnerOrAdmin =
        req.authUser!.role === 'admin' || req.authUser!.id === order.userId;
      if (!isOwnerOrAdmin) {
        return res.status(403).json({
          error: 'Access denied: You can only view tracking details for your own orders.',
        });
      }

      const [items, branchRows] = await Promise.all([
        db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
        db.select().from(branches).where(eq(branches.id, order.branchId)).limit(1),
      ]);

      res.json({
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          fulfillmentType: order.fulfillmentType,
          pickupTime: order.pickupTime,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          subtotalCents: order.subtotalCents,
          deliveryFeeCents: order.deliveryFeeCents,
          discountCents: order.discountCents,
          grandTotalCents: order.grandTotalCents,
          couponCode: order.couponCode,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          deliveryAddress: order.deliveryAddress,
          branch: branchRows[0] || null,
          items,
        },
      });
    } catch (error) {
      console.error('Track order failed:', error);
      res.status(500).json({ error: 'Could not retrieve order status.' });
    }
  });

  // ---------------------------------------------------------------------------
  // ADMIN DASHBOARD ROUTES (STRICTLY PROTECTED BY requireAdmin)
  // ---------------------------------------------------------------------------
  router.get('/admin/overview', requireAdmin, async (req, res) => {
    try {
      const startStr = typeof req.query.startDate === 'string' ? req.query.startDate : '';
      const endStr = typeof req.query.endDate === 'string' ? req.query.endDate : '';

      const dateConditions = [];
      if (startStr) {
        const d = new Date(startStr);
        if (!Number.isNaN(d.getTime())) dateConditions.push(gte(orders.createdAt, d));
      }
      if (endStr) {
        const d = new Date(endStr);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          dateConditions.push(lte(orders.createdAt, d));
        }
      }

      const [allOrders, filteredOrders, allCustomers, allProducts, lowStockRows, allOrderItems, allBranches] =
        await Promise.all([
          db.select().from(orders).orderBy(desc(orders.createdAt)),
          dateConditions.length
            ? db
                .select()
                .from(orders)
                .where(and(...dateConditions))
                .orderBy(desc(orders.createdAt))
            : db.select().from(orders).orderBy(desc(orders.createdAt)),
          db.select().from(users).where(eq(users.role, 'customer')),
          db.select().from(products),
          db
            .select({
              productId: inventory.productId,
              stockQuantity: inventory.stockQuantity,
              lowStockThreshold: inventory.lowStockThreshold,
              productName: products.name,
            })
            .from(inventory)
            .innerJoin(products, eq(inventory.productId, products.id)),
          db.select().from(orderItems),
          db.select().from(branches),
        ]);

      const completedOrders = filteredOrders.filter((o) => o.status !== 'Cancelled');
      const totalSalesCents = completedOrders.reduce((sum, o) => sum + o.grandTotalCents, 0);
      const pendingOrdersCount = allOrders.filter((o) => o.status === 'Pending').length;
      const lowStockProducts = lowStockRows.filter((r) => r.stockQuantity <= r.lowStockThreshold);

      // Daily, weekly, monthly breakdowns
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

      const dailySalesCents = completedOrders
        .filter((o) => new Date(o.createdAt).getTime() >= startOfToday)
        .reduce((sum, o) => sum + o.grandTotalCents, 0);
      const weeklySalesCents = completedOrders
        .filter((o) => new Date(o.createdAt).getTime() >= sevenDaysAgo)
        .reduce((sum, o) => sum + o.grandTotalCents, 0);
      const monthlySalesCents = completedOrders
        .filter((o) => new Date(o.createdAt).getTime() >= thirtyDaysAgo)
        .reduce((sum, o) => sum + o.grandTotalCents, 0);

      // Chart series grouped by YYYY-MM-DD
      const dayBuckets = new Map<string, { date: string; salesCents: number; orders: number }>();
      for (const o of completedOrders) {
        const dateKey = new Date(o.createdAt).toISOString().slice(0, 10);
        const existing = dayBuckets.get(dateKey) || { date: dateKey, salesCents: 0, orders: 0 };
        existing.salesCents += o.grandTotalCents;
        existing.orders += 1;
        dayBuckets.set(dateKey, existing);
      }
      const salesSeries = Array.from(dayBuckets.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Best-selling products
      const completedOrderIdSet = new Set(completedOrders.map((o) => o.id));
      const productSalesMap = new Map<string, { productName: string; quantity: number; revenueCents: number }>();
      for (const item of allOrderItems) {
        if (!completedOrderIdSet.has(item.orderId)) continue;
        const curr = productSalesMap.get(item.productName) || {
          productName: item.productName,
          quantity: 0,
          revenueCents: 0,
        };
        curr.quantity += item.quantity;
        curr.revenueCents += item.lineTotalCents;
        productSalesMap.set(item.productName, curr);
      }
      const bestSellingProducts = Array.from(productSalesMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 6);

      const branchMap = new Map(allBranches.map((b) => [b.id, b.name]));

      res.json({
        kpis: {
          totalOrders: filteredOrders.length,
          completedOrdersCount: filteredOrders.filter((o) => o.status === 'Completed').length,
          totalSalesCents,
          dailySalesCents,
          weeklySalesCents,
          monthlySalesCents,
          totalCustomers: allCustomers.length,
          totalProducts: allProducts.length,
          pendingOrders: pendingOrdersCount,
          lowStockCount: lowStockProducts.length,
        },
        lowStockProducts,
        salesSeries,
        bestSellingProducts,
        recentOrders: allOrders.slice(0, 8).map((o) => ({
          ...o,
          branchName: branchMap.get(o.branchId) || 'Branch',
        })),
      });
    } catch (error) {
      console.error('Admin overview failed:', error);
      res.status(500).json({ error: 'Unable to load dashboard analytics.' });
    }
  });

  router.post('/admin/upload', requireAdmin, (req, res) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Image upload failed.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided.' });
      }
      res.json({ imageUrl: `/uploads/${req.file.filename}` });
    });
  });

  router.post('/admin/products', requireAdmin, async (req, res) => {
    try {
      const name = sanitizeText(req.body?.name, 140);
      const description = sanitizeText(req.body?.description, 600);
      const categoryId = Number(req.body?.categoryId);
      const priceCents = Math.max(100, Math.round(Number(req.body?.priceCents || 0)));
      const imageUrl =
        sanitizeText(req.body?.imageUrl, 300) ||
        '/src/assets/images/menu_classic_burger_1795052474012.jpg';
      const isAvailable = req.body?.isAvailable !== false;
      const isFeatured = Boolean(req.body?.isFeatured);
      const isBestSeller = Boolean(req.body?.isBestSeller);
      const badgeText = sanitizeText(req.body?.badgeText, 40) || null;
      const stockQuantity = Math.max(0, Number(req.body?.stockQuantity ?? 40));
      const lowStockThreshold = Math.max(1, Number(req.body?.lowStockThreshold ?? 10));

      if (!name || !description || !Number.isInteger(categoryId)) {
        return res.status(400).json({ error: 'Name, description, and category are required.' });
      }

      const slug = `${slugify(name)}-${Date.now().toString().slice(-5)}`;
      const [created] = await db
        .insert(products)
        .values({
          categoryId,
          name,
          slug,
          description,
          priceCents,
          imageUrl,
          isAvailable,
          isFeatured,
          isBestSeller,
          badgeText,
        })
        .returning();

      await db.insert(inventory).values({
        productId: created.id,
        stockQuantity,
        lowStockThreshold,
      });

      res.status(201).json({ product: created });
    } catch (error) {
      console.error('Create product failed:', error);
      res.status(500).json({ error: 'Could not create product.' });
    }
  });

  router.put('/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const name = sanitizeText(req.body?.name, 140);
      const description = sanitizeText(req.body?.description, 600);
      const categoryId = Number(req.body?.categoryId);
      const priceCents = Math.max(100, Math.round(Number(req.body?.priceCents || 0)));
      const imageUrl = sanitizeText(req.body?.imageUrl, 300);
      const isAvailable = Boolean(req.body?.isAvailable);
      const isFeatured = Boolean(req.body?.isFeatured);
      const isBestSeller = Boolean(req.body?.isBestSeller);
      const badgeText = sanitizeText(req.body?.badgeText, 40) || null;

      const [updated] = await db
        .update(products)
        .set({
          name,
          description,
          categoryId,
          priceCents,
          ...(imageUrl ? { imageUrl } : {}),
          isAvailable,
          isFeatured,
          isBestSeller,
          badgeText,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Product not found.' });
      }
      res.json({ product: updated });
    } catch (error) {
      console.error('Update product failed:', error);
      res.status(500).json({ error: 'Could not update product.' });
    }
  });

  router.delete('/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(products).where(eq(products.id, id));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete product failed:', error);
      res.status(500).json({ error: 'Could not delete product.' });
    }
  });

  router.get('/admin/categories', requireAdmin, async (_req, res) => {
    const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    res.json({ categories: rows });
  });

  router.post('/admin/categories', requireAdmin, async (req, res) => {
    try {
      const name = sanitizeText(req.body?.name, 80);
      const description = sanitizeText(req.body?.description, 250);
      if (!name) return res.status(400).json({ error: 'Category name is required.' });
      const [created] = await db
        .insert(categories)
        .values({
          name,
          slug: slugify(name),
          description,
          sortOrder: Number(req.body?.sortOrder || 10),
          isActive: true,
        })
        .returning();
      res.status(201).json({ category: created });
    } catch (error) {
      console.error('Create category failed:', error);
      res.status(500).json({ error: 'Could not create category.' });
    }
  });

  router.get('/admin/orders', requireAdmin, async (req, res) => {
    try {
      const statusFilter = typeof req.query.status === 'string' ? req.query.status : '';
      const dateFilter = typeof req.query.date === 'string' ? req.query.date : '';

      const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
      const filtered = allOrders.filter((o) => {
        if (statusFilter && statusFilter !== 'All' && o.status !== statusFilter) return false;
        if (dateFilter && new Date(o.createdAt).toISOString().slice(0, 10) !== dateFilter) return false;
        return true;
      });

      const orderIds = filtered.map((o) => o.id);
      const [items, allBranches] = await Promise.all([
        orderIds.length ? db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)) : [],
        db.select().from(branches),
      ]);
      const branchMap = new Map(allBranches.map((b) => [b.id, b]));
      const itemMap = new Map<number, typeof items>();
      for (const item of items) {
        const list = itemMap.get(item.orderId) || [];
        list.push(item);
        itemMap.set(item.orderId, list);
      }

      res.json({
        orders: filtered.map((o) => ({
          ...o,
          branch: branchMap.get(o.branchId) || null,
          items: itemMap.get(o.id) || [],
        })),
      });
    } catch (error) {
      console.error('Admin get orders failed:', error);
      res.status(500).json({ error: 'Could not load orders.' });
    }
  });

  router.patch('/admin/orders/:id/status', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const nextStatus = req.body?.status;
      if (!VALID_ORDER_STATUSES.includes(nextStatus)) {
        return res.status(400).json({ error: 'Invalid order status.' });
      }

      const existingRows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      const updatedOrder = await db.transaction(async (tx) => {
        // Restore stock if cancelling a previously active order
        if (nextStatus === 'Cancelled' && existing.status !== 'Cancelled') {
          const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, existing.id));
          for (const item of items) {
            if (item.productId) {
              await tx
                .update(inventory)
                .set({
                  stockQuantity: sql`${inventory.stockQuantity} + ${item.quantity}`,
                  updatedAt: new Date(),
                })
                .where(eq(inventory.productId, item.productId));
            }
          }
        }

        const nextPaymentStatus =
          nextStatus === 'Completed'
            ? 'Paid'
            : nextStatus === 'Cancelled'
              ? 'Cancelled'
              : existing.paymentStatus;

        const [updated] = await tx
          .update(orders)
          .set({
            status: nextStatus,
            paymentStatus: nextPaymentStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, id))
          .returning();

        if (nextStatus === 'Completed') {
          await tx
            .update(payments)
            .set({ status: 'Paid', paidAt: new Date() })
            .where(eq(payments.orderId, id));
        }

        if (existing.userId) {
          await tx.insert(notifications).values({
            userId: existing.userId,
            orderId: existing.id,
            title: `Order ${existing.orderNumber} — ${nextStatus}`,
            message:
              nextStatus === 'Preparing'
                ? 'Your order is being prepared fresh on the grill.'
                : `Your order status has been updated to ${nextStatus}.`,
            isRead: false,
          });
        }

        return updated;
      });

      broadcastOrderEvent('order:updated', updatedOrder);
      res.json({ order: updatedOrder });
    } catch (error) {
      console.error('Update order status failed:', error);
      res.status(500).json({ error: 'Could not update order status.' });
    }
  });

  router.get('/admin/inventory', requireAdmin, async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: inventory.id,
          productId: inventory.productId,
          stockQuantity: inventory.stockQuantity,
          lowStockThreshold: inventory.lowStockThreshold,
          updatedAt: inventory.updatedAt,
          productName: products.name,
          isAvailable: products.isAvailable,
          priceCents: products.priceCents,
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .orderBy(asc(inventory.stockQuantity));
      res.json({ inventory: rows });
    } catch (error) {
      console.error('Admin inventory failed:', error);
      res.status(500).json({ error: 'Could not load inventory.' });
    }
  });

  router.patch('/admin/inventory/:productId', requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.productId);
      const stockQuantity = Math.max(0, Number(req.body?.stockQuantity ?? 0));
      const lowStockThreshold = Math.max(1, Number(req.body?.lowStockThreshold ?? 10));

      const [updated] = await db
        .update(inventory)
        .set({ stockQuantity, lowStockThreshold, updatedAt: new Date() })
        .where(eq(inventory.productId, productId))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Inventory record not found.' });
      }
      res.json({ inventory: updated });
    } catch (error) {
      console.error('Update inventory failed:', error);
      res.status(500).json({ error: 'Could not update stock level.' });
    }
  });

  router.get('/admin/customers', requireAdmin, async (_req, res) => {
    try {
      const [allUsers, allProfiles, allOrders] = await Promise.all([
        db.select().from(users).orderBy(desc(users.createdAt)),
        db.select().from(profiles),
        db.select().from(orders).orderBy(desc(orders.createdAt)),
      ]);

      const profMap = new Map(allProfiles.map((p) => [p.userId, p]));
      const ordersByUser = new Map<number, typeof allOrders>();
      for (const ord of allOrders) {
        if (!ord.userId) continue;
        const list = ordersByUser.get(ord.userId) || [];
        list.push(ord);
        ordersByUser.set(ord.userId, list);
      }

      res.json({
        customers: allUsers.map((u) => {
          const prof = profMap.get(u.id);
          const uOrders = ordersByUser.get(u.id) || [];
          const totalSpentCents = uOrders
            .filter((o) => o.status !== 'Cancelled')
            .reduce((sum, o) => sum + o.grandTotalCents, 0);
          return {
            id: u.id,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
            fullName: prof?.fullName || u.email.split('@')[0],
            phone: prof?.phone || '',
            orderCount: uOrders.length,
            totalSpentCents,
            orders: uOrders.slice(0, 10),
          };
        }),
      });
    } catch (error) {
      console.error('Admin customers failed:', error);
      res.status(500).json({ error: 'Could not load customer directory.' });
    }
  });

  router.get('/admin/branches', requireAdmin, async (_req, res) => {
    const rows = await db.select().from(branches).orderBy(asc(branches.id));
    res.json({ branches: rows });
  });

  router.post('/admin/branches', requireAdmin, async (req, res) => {
    try {
      const name = sanitizeText(req.body?.name, 120);
      const address = sanitizeText(req.body?.address, 250);
      const contactNumber = sanitizeText(req.body?.contactNumber, 50);
      const operatingHours = sanitizeText(req.body?.operatingHours, 100);
      const deliveryFeeCents = Math.max(0, Math.round(Number(req.body?.deliveryFeeCents ?? 3500)));

      if (!name || !address || !contactNumber || !operatingHours) {
        return res.status(400).json({ error: 'All branch details are required.' });
      }

      const [created] = await db
        .insert(branches)
        .values({
          name,
          address,
          contactNumber,
          operatingHours,
          deliveryFeeCents,
          isAvailable: req.body?.isAvailable !== false,
          supportsCod: req.body?.supportsCod !== false,
          supportsGcash: req.body?.supportsGcash !== false,
        })
        .returning();

      res.status(201).json({ branch: created });
    } catch (error) {
      console.error('Create branch failed:', error);
      res.status(500).json({ error: 'Could not create branch.' });
    }
  });

  router.put('/admin/branches/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [updated] = await db
        .update(branches)
        .set({
          name: sanitizeText(req.body?.name, 120),
          address: sanitizeText(req.body?.address, 250),
          contactNumber: sanitizeText(req.body?.contactNumber, 50),
          operatingHours: sanitizeText(req.body?.operatingHours, 100),
          deliveryFeeCents: Math.max(0, Math.round(Number(req.body?.deliveryFeeCents ?? 3500))),
          isAvailable: Boolean(req.body?.isAvailable),
          supportsCod: Boolean(req.body?.supportsCod),
          supportsGcash: Boolean(req.body?.supportsGcash),
        })
        .where(eq(branches.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Branch not found.' });
      }
      res.json({ branch: updated });
    } catch (error) {
      console.error('Update branch failed:', error);
      res.status(500).json({ error: 'Could not update branch.' });
    }
  });

  router.get('/admin/coupons', requireAdmin, async (_req, res) => {
    const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    res.json({ coupons: rows });
  });

  router.post('/admin/coupons', requireAdmin, async (req, res) => {
    try {
      const code = sanitizeText(req.body?.code, 30).toUpperCase();
      const description = sanitizeText(req.body?.description, 200);
      const discountType = req.body?.discountType === 'fixed' ? 'fixed' : 'percent';
      const discountValue = Math.max(1, Number(req.body?.discountValue || 10));
      const minOrderCents = Math.max(0, Number(req.body?.minOrderCents || 0));

      if (!code || !description) {
        return res.status(400).json({ error: 'Coupon code and description are required.' });
      }

      const [created] = await db
        .insert(coupons)
        .values({ code, description, discountType, discountValue, minOrderCents, isActive: true })
        .returning();
      res.status(201).json({ coupon: created });
    } catch (error) {
      console.error('Create coupon failed:', error);
      res.status(500).json({ error: 'Could not create coupon.' });
    }
  });

  router.patch('/admin/coupons/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [updated] = await db
        .update(coupons)
        .set({ isActive: Boolean(req.body?.isActive) })
        .where(eq(coupons.id, id))
        .returning();
      res.json({ coupon: updated });
    } catch (error) {
      console.error('Update coupon failed:', error);
      res.status(500).json({ error: 'Could not update coupon.' });
    }
  });

  return router;
}
