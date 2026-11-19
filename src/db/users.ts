import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { profiles, users } from './schema.ts';

const ADMIN_EMAILS = new Set(['justinbonilla1999@gmail.com', 'admin@angelsburger.ph']);

export async function getOrCreateFirebaseUser(uid: string, email: string, fullName?: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const isDesignatedAdmin = ADMIN_EMAILS.has(normalizedEmail);

    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    let user = existing[0];

    if (!user) {
      const byEmail = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
      if (byEmail[0]) {
        const updated = await db
          .update(users)
          .set({
            uid,
            role: isDesignatedAdmin ? 'admin' : byEmail[0].role,
            updatedAt: new Date(),
          })
          .where(eq(users.id, byEmail[0].id))
          .returning();
        user = updated[0];
      } else {
        const inserted = await db
          .insert(users)
          .values({
            uid,
            email: normalizedEmail,
            role: isDesignatedAdmin ? 'admin' : 'customer',
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: { email: normalizedEmail, updatedAt: new Date() },
          })
          .returning();
        user = inserted[0];
      }
    } else if (isDesignatedAdmin && user.role !== 'admin') {
      const updated = await db
        .update(users)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      user = updated[0];
    }

    const existingProfile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);

    if (!existingProfile[0]) {
      await db
        .insert(profiles)
        .values({
          userId: user.id,
          fullName: fullName?.trim() || normalizedEmail.split('@')[0],
          phone: '',
        })
        .onConflictDoNothing();
    }

    return user;
  } catch (error) {
    console.error('Failed to sync Firebase user:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function registerLocalUser(params: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}) {
  try {
    const normalizedEmail = params.email.trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing[0]) {
      throw new Error('EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(params.password, 10);
    const uid = `local_${crypto.randomUUID()}`;
    const role = ADMIN_EMAILS.has(normalizedEmail) ? 'admin' : 'customer';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        passwordHash,
        role,
      })
      .returning();

    const user = inserted[0];
    await db.insert(profiles).values({
      userId: user.id,
      fullName: params.fullName.trim(),
      phone: params.phone.trim(),
    });

    return user;
  } catch (error: any) {
    if (error?.message === 'EMAIL_EXISTS') {
      throw error;
    }
    console.error('Failed to register user:', error);
    throw new Error('Registration failed. Please try again.', { cause: error });
  }
}

export async function authenticateLocalUser(email: string, password: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const found = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    const user = found[0];
    if (!user || !user.passwordHash) {
      return null;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Failed to authenticate user:', error);
    throw new Error('Authentication failed. Please try again.', { cause: error });
  }
}
