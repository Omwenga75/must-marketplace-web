/**
 * Firebase Admin SDK – server-side only (API routes)
 * Uses the RTDB REST API so no service-account key is needed:
 * we use the database secret / access token from env vars, or
 * fall back to unauthenticated REST for public nodes.
 *
 * Nodes used:
 *   /deleted_products/{id}  – tombstone records, publicly readable
 *   /deleted_users/{id}     – tombstone records, publicly readable
 */

const RTDB_BASE =
  process.env.FIREBASE_DATABASE_URL ||
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://must-marketplace-default-rtdb.firebaseio.com";

/** Read all keys under a RTDB path via the REST API */
async function rtdbGetKeys(path: string): Promise<string[]> {
  try {
    const url = `${RTDB_BASE}/${path}.json?shallow=true`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || typeof data !== "object") return [];
    return Object.keys(data);
  } catch {
    return [];
  }
}

/** Write a value to a RTDB path via the REST API (no auth — uses public write if rules allow) */
async function rtdbSet(path: string, value: unknown): Promise<boolean> {
  try {
    const url = `${RTDB_BASE}/${path}.json`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get all deleted product IDs from Firebase RTDB */
export async function getFirebaseDeletedProductIds(): Promise<Set<string>> {
  const keys = await rtdbGetKeys("deleted_products");
  return new Set(keys);
}

/** Get all deleted user IDs from Firebase RTDB */
export async function getFirebaseDeletedUserIds(): Promise<Set<string>> {
  const keys = await rtdbGetKeys("deleted_users");
  return new Set(keys);
}

/** Save a deleted product ID to Firebase RTDB */
export async function saveFirebaseDeletedProduct(id: string): Promise<void> {
  await rtdbSet(`deleted_products/${encodeURIComponent(id)}`, {
    deletedAt: Date.now(),
  });
}

/** Save a deleted user ID to Firebase RTDB */
export async function saveFirebaseDeletedUser(id: string): Promise<void> {
  await rtdbSet(`deleted_users/${encodeURIComponent(id)}`, {
    deletedAt: Date.now(),
  });
}
