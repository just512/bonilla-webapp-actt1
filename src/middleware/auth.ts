import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { getOrCreateFirebaseUser } from '../db/users.ts';

const RUNTIME_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(process.env.SQL_PASSWORD || 'angels-burger-local-ephemeral-secret')
    .digest('hex');

export const SESSION_COOKIE_NAME = 'ab_session';

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  role: 'customer' | 'admin';
  authProvider: 'firebase' | 'local';
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function signSessionToken(
  payload: { userId: number; uid: string; email: string },
  rememberMe = true
) {
  const ttlSeconds = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 12; // 30 days or 12 hours
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', RUNTIME_SECRET).update(data).digest('base64url');
  return `local.${data}.${sig}`;
}

export function setSessionCookie(req: Request, res: Response, token: string, rememberMe: boolean) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
    ...(rememberMe ? { maxAge: 1000 * 60 * 60 * 24 * 30 } : {}),
  });
}

export function clearSessionCookie(req: Request, res: Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
  });
}

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

function verifySessionToken(token: string): { userId: number; uid: string; email: string } | null {
  if (!token.startsWith('local.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', RUNTIME_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { userId: parsed.userId, uid: parsed.uid, email: parsed.email };
  } catch {
    return null;
  }
}

async function resolveAuthenticatedUser(req: Request): Promise<AuthenticatedUser | undefined> {
  const authHeader = req.headers.authorization;
  let token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : undefined;

  if (!token) {
    token = parseCookie(req.headers.cookie, SESSION_COOKIE_NAME);
  }
  if (!token) return undefined;

  if (token.startsWith('local.')) {
    const payload = verifySessionToken(token);
    if (!payload) return undefined;
    const found = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    const user = found[0];
    if (!user) return undefined;
    return {
      id: user.id,
      uid: user.uid,
      email: user.email,
      role: user.role === 'admin' ? 'admin' : 'customer',
      authProvider: 'local',
    };
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const email = decoded.email || `${decoded.uid}@firebase.user`;
  const user = await getOrCreateFirebaseUser(decoded.uid, email, decoded.name);
  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'customer',
    authProvider: 'firebase',
  };
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    req.authUser = await resolveAuthenticatedUser(req);
  } catch {
    req.authUser = undefined;
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.authUser = user;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Administrator sign in required.' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
    }
    req.authUser = user;
    next();
  } catch (error) {
    console.error('Admin verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
};
