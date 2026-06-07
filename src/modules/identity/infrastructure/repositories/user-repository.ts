import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { users } from '@/db/schemas/identity/users';
import type { User } from '@/db/types';

/**
 * Ensure an app `users` row exists for an authenticated Supabase user, keeping
 * email / name in sync. The `users` table is platform-global (no org context),
 * so this uses the admin escape hatch keyed on the auth user id.
 */
export async function ensureUser(input: {
  id: string;
  email: string;
  fullName: string | null;
}): Promise<User> {
  const db = getRawClient({ as: 'admin' });
  const rows = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      fullName: input.fullName,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        fullName: input.fullName,
        updatedAt: new Date(),
      },
    })
    .returning();

  const user = rows[0];
  if (!user) {
    throw new Error(`Failed to upsert user ${input.id}`);
  }
  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  const db = getRawClient({ as: 'admin' });
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Generate a correlation id for a fresh request. */
export function newCorrelationId(): string {
  return randomUUID();
}
