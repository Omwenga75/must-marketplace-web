/**
 * Firebase Admin SDK & RTDB REST Integration – Server-Side Only
 *
 * Authenticates using Google OAuth2 Service Account with RS256 JWT.
 * Connects directly to the live Firebase Realtime Database shared with the MUST Marketplace Android app.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Product, User, Conversation, Message } from "@/types";
import { SAMPLE_CATEGORIES } from "@/lib/constants";

const RTDB_BASE =
  process.env.FIREBASE_DATABASE_URL ||
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://must-marketplace-default-rtdb.firebaseio.com";

// Cached OAuth token
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

function getServiceAccount(): ServiceAccount | null {
  // 1. Check environment variable (Vercel & .env.local)
  const envRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (envRaw) {
    try {
      const clean = envRaw.trim().replace(/^['"]|['"]$/g, "");
      return JSON.parse(clean);
    } catch (e) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY from env:", e);
    }
  }

  // 2. Check local filesystem fallbacks (for local dev)
  const localCandidates = [
    path.join(process.cwd(), "service-account.json"),
    "C:\\Users\\USER\\must-marketplace\\app\\must-marketplace-firebase-adminsdk-fbsvc-3be2c44d21.json",
  ];

  for (const p of localCandidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        return JSON.parse(raw);
      }
    } catch {}
  }

  return null;
}

/** Generate or retrieve a valid Google OAuth access token for Firebase RTDB */
async function getAdminAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const sa = getServiceAccount();
  if (!sa || !sa.client_email || !sa.private_key) {
    return null;
  }

  try {
    const header = { alg: "RS256", typ: "JWT" };
    const iat = Math.floor(now / 1000);
    const claim = {
      iss: sa.client_email,
      scope:
        "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database",
      aud: "https://oauth2.googleapis.com/token",
      exp: iat + 3600,
      iat,
    };

    const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const unsigned = `${b64(header)}.${b64(claim)}`;

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsigned);
    const signature = signer.sign(sa.private_key, "base64url");
    const jwt = `${unsigned}.${signature}`;

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString();

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      console.warn("OAuth token request failed with status:", res.status);
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      cachedToken = data.access_token;
      tokenExpiresAt = now + ((data.expires_in || 3600) - 120) * 1000;
      return cachedToken;
    }
  } catch (err) {
    console.warn("Error obtaining Firebase admin token:", err);
  }

  return null;
}

/** Perform an authenticated REST request to Firebase RTDB */
async function rtdbRequest(
  pathWithQuery: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: any }> {
  try {
    const token = await getAdminAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      // Fallback: check database secret if set
      const secret = process.env.FIREBASE_DATABASE_SECRET || process.env.FIREBASE_SECRET;
      if (secret) {
        const sep = pathWithQuery.includes("?") ? "&" : "?";
        pathWithQuery += `${sep}auth=${encodeURIComponent(secret)}`;
      }
    }

    const url = `${RTDB_BASE}/${pathWithQuery}`;
    const res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return { ok: false, status: res.status };
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 500 };
  }
}

// ── Normalizers ─────────────────────────────────────────────────────────────

function normalizeProduct(raw: any, id: string): Product {
  let imageUrls: string[] = [];
  if (Array.isArray(raw.imageUrls)) {
    imageUrls = raw.imageUrls.filter(Boolean);
  } else if (typeof raw.imageUrls === "string") {
    imageUrls = raw.imageUrls.split(",").map((s: string) => s.trim()).filter(Boolean);
  } else if (raw.imageUrl) {
    imageUrls = [raw.imageUrl];
  }

  if (imageUrls.length === 0) {
    imageUrls = ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800"];
  }

  let createdAt = raw.createdAt;
  if (!createdAt) {
    createdAt = new Date().toISOString();
  } else if (typeof createdAt === "number" || (/^\d+$/.test(createdAt) && Number(createdAt) > 1000000000)) {
    try {
      createdAt = new Date(Number(createdAt)).toISOString();
    } catch {}
  }

  return {
    id: id || raw.id,
    title: raw.title || "Untitled Product",
    description: raw.description || "",
    price: Number(raw.price) || 0,
    sellerId: raw.sellerId || "system",
    sellerName: raw.sellerName || "MUST Seller",
    sellerPhone: raw.sellerPhone || "",
    sellerImageUrl: raw.sellerImageUrl || null,
    sellerLikes: Number(raw.sellerLikes) || 0,
    condition: raw.condition || "NEW",
    category: raw.category || SAMPLE_CATEGORIES[0],
    location: raw.location || "Nchiru",
    imageUrls,
    status: raw.status || "ACTIVE",
    views: Number(raw.views) || 0,
    likes: Number(raw.likes) || 0,
    createdAt: String(createdAt),
    bookedBy: raw.bookedBy || null,
    bookedAt: raw.bookedAt ? Number(raw.bookedAt) : null,
    isBookedByMe: Boolean(raw.bookedByMe || raw.isBookedByMe),
    isFavorited: Boolean(raw.favorited || raw.isFavorited),
  };
}

function normalizeUser(raw: any, id: string): User {
  let memberSince = raw.memberSince || raw.sellerRegisteredAt || raw.createdAt;
  if (typeof memberSince === "number" || (/^\d+$/.test(memberSince) && Number(memberSince) > 1000000000)) {
    try {
      memberSince = new Date(Number(memberSince)).toISOString();
    } catch {}
  }
  if (!memberSince) memberSince = new Date().toISOString();

  const isSeller = Boolean(raw.seller || raw.isSeller);
  const isAdmin = Boolean(raw.admin || raw.isAdmin || raw.adminRole);

  return {
    id: id || raw.id,
    fullName: raw.fullName || raw.displayName || raw.name || "User",
    email: raw.email || "",
    phone: raw.phone || null,
    location: raw.location || null,
    profileImageUrl: raw.profileImageUrl || raw.photoURL || null,
    seller: isSeller,
    isSeller: isSeller,
    admin: isAdmin,
    isAdmin: isAdmin,
    memberSince: String(memberSince),
    activeListings: Number(raw.activeListings) || 0,
    soldItems: Number(raw.soldItems) || 0,
    likes: Number(raw.likes) || 0,
  };
}

// ── Product Operations ───────────────────────────────────────────────────────

/** Fetch all active products directly from Firebase Realtime Database */
export async function getFirebaseProducts(): Promise<Product[]> {
  const res = await rtdbRequest("products.json");
  if (!res.ok || !res.data || typeof res.data !== "object") {
    return [];
  }

  const products: Product[] = [];
  for (const [id, val] of Object.entries(res.data)) {
    if (val && typeof val === "object") {
      products.push(normalizeProduct(val, id));
    }
  }

  return products;
}

/** Fetch a single product by ID directly from Firebase RTDB */
export async function getFirebaseProductById(id: string): Promise<Product | null> {
  if (!id) return null;
  const res = await rtdbRequest(`products/${encodeURIComponent(id)}.json`);
  if (!res.ok || !res.data || typeof res.data !== "object") {
    return null;
  }
  return normalizeProduct(res.data, id);
}

/** Save or update a product directly in Firebase RTDB */
export async function saveFirebaseProduct(product: Product): Promise<boolean> {
  if (!product || !product.id) return false;
  const res = await rtdbRequest(`products/${encodeURIComponent(product.id)}.json`, {
    method: "PUT",
    body: JSON.stringify(product),
  });
  return res.ok;
}

/** Permanently delete a product from Firebase RTDB and record tombstone */
export async function deleteFirebaseProduct(id: string): Promise<boolean> {
  if (!id) return false;

  // 1. Remove node from /products/{id}
  const delRes = await rtdbRequest(`products/${encodeURIComponent(id)}.json`, {
    method: "DELETE",
  });

  // 2. Add tombstone to /deleted_products/{id} for cross-client sync
  await rtdbRequest(`deleted_products/${encodeURIComponent(id)}.json`, {
    method: "PUT",
    body: JSON.stringify({ deletedAt: Date.now() }),
  });

  return delRes.ok;
}

/** Get all deleted product IDs (tombstones) from Firebase RTDB */
export async function getFirebaseDeletedProductIds(): Promise<Set<string>> {
  const res = await rtdbRequest("deleted_products.json?shallow=true");
  if (!res.ok || !res.data || typeof res.data !== "object") {
    return new Set();
  }
  return new Set(Object.keys(res.data));
}

/** Save tombstone for deleted product */
export async function saveFirebaseDeletedProduct(id: string): Promise<void> {
  if (!id) return;
  await rtdbRequest(`deleted_products/${encodeURIComponent(id)}.json`, {
    method: "PUT",
    body: JSON.stringify({ deletedAt: Date.now() }),
  });
}

// ── User Operations ─────────────────────────────────────────────────────────

/** Fetch all registered users directly from Firebase RTDB */
export async function getFirebaseUsers(): Promise<User[]> {
  const res = await rtdbRequest("users.json");
  if (!res.ok || !res.data || typeof res.data !== "object") {
    return [];
  }

  const users: User[] = [];
  for (const [id, val] of Object.entries(res.data)) {
    if (val && typeof val === "object") {
      users.push(normalizeUser(val, id));
    }
  }

  return users;
}

/** Fetch user by ID or email directly from Firebase RTDB */
export async function getFirebaseUserById(idOrEmail: string): Promise<User | null> {
  if (!idOrEmail) return null;

  // 1. Try by ID direct lookup
  const byId = await rtdbRequest(`users/${encodeURIComponent(idOrEmail)}.json`);
  if (byId.ok && byId.data && typeof byId.data === "object") {
    return normalizeUser(byId.data, idOrEmail);
  }

  // 2. Try scanning all users for email match
  if (idOrEmail.includes("@")) {
    const all = await getFirebaseUsers();
    const found = all.find(
      (u) => u.email.toLowerCase() === idOrEmail.toLowerCase().trim()
    );
    if (found) return found;
  }

  return null;
}

/** Save or update user in Firebase RTDB */
export async function saveFirebaseUser(user: User): Promise<boolean> {
  if (!user || !user.id) return false;
  const res = await rtdbRequest(`users/${encodeURIComponent(user.id)}.json`, {
    method: "PUT",
    body: JSON.stringify(user),
  });
  return res.ok;
}

/** Permanently delete user from Firebase RTDB and delete user's listings */
export async function deleteFirebaseUser(id: string): Promise<boolean> {
  if (!id) return false;

  // 1. Delete user record
  const delRes = await rtdbRequest(`users/${encodeURIComponent(id)}.json`, {
    method: "DELETE",
  });

  // 2. Record tombstone
  await rtdbRequest(`deleted_users/${encodeURIComponent(id)}.json`, {
    method: "PUT",
    body: JSON.stringify({ deletedAt: Date.now() }),
  });

  // 3. Remove all products belonging to this seller
  try {
    const products = await getFirebaseProducts();
    const userProducts = products.filter((p) => p.sellerId === id);
    for (const p of userProducts) {
      await deleteFirebaseProduct(p.id);
    }
  } catch (e) {
    console.warn("Failed cascading product deletions for user:", id, e);
  }

  return delRes.ok;
}

/** Get deleted user IDs */
export async function getFirebaseDeletedUserIds(): Promise<Set<string>> {
  const res = await rtdbRequest("deleted_users.json?shallow=true");
  if (!res.ok || !res.data || typeof res.data !== "object") {
    return new Set();
  }
  return new Set(Object.keys(res.data));
}

/** Save tombstone for deleted user */
export async function saveFirebaseDeletedUser(id: string): Promise<void> {
  if (!id) return;
  await rtdbRequest(`deleted_users/${encodeURIComponent(id)}.json`, {
    method: "PUT",
    body: JSON.stringify({ deletedAt: Date.now() }),
  });
}

// ── Chat & Conversation Operations ──────────────────────────────────────────

/** Fetch all conversations for a user directly from Firebase RTDB */
export async function getFirebaseConversations(userId: string): Promise<Conversation[]> {
  if (!userId) return [];
  const res = await rtdbRequest(`conversations/${encodeURIComponent(userId)}.json`);
  if (!res.ok || !res.data || typeof res.data !== "object") return [];

  const list: Conversation[] = [];
  for (const [key, item] of Object.entries<any>(res.data)) {
    if (!item || typeof item !== "object") continue;
    let otherId = item.otherUserId;
    if (!otherId && key.includes("_")) {
      const parts = key.split("_");
      otherId = parts[0] === userId ? parts.slice(1).join("_") : parts[0];
    }
    list.push({
      id: item.id || key,
      otherUserId: otherId || "",
      otherUserName: item.otherUserName || "Student Seller",
      lastMessage: item.lastMessage || "",
      lastMessageTime: String(item.lastMessageTime || Date.now()),
      unreadCount: typeof item.unreadCount === "number" ? item.unreadCount : 0,
      productId: item.productId || null,
      productTitle: item.productTitle || null,
      otherUserPhoto: item.otherUserPhoto || null,
    });
  }
  return list;
}

/** Save or update a conversation node for a user in Firebase RTDB */
export async function saveFirebaseConversation(
  userId: string,
  conversation: Conversation
): Promise<boolean> {
  if (!userId || !conversation || !conversation.id) return false;
  const res = await rtdbRequest(
    `conversations/${encodeURIComponent(userId)}/${encodeURIComponent(conversation.id)}.json`,
    {
      method: "PUT",
      body: JSON.stringify(conversation),
    }
  );
  return res.ok;
}

/** Delete a conversation from a user's node in Firebase RTDB */
export async function deleteFirebaseConversation(
  userId: string,
  conversationId: string
): Promise<boolean> {
  if (!userId || !conversationId) return false;
  const res = await rtdbRequest(
    `conversations/${encodeURIComponent(userId)}/${encodeURIComponent(conversationId)}.json`,
    {
      method: "DELETE",
    }
  );
  return res.ok;
}

/** Fetch all messages for a conversation directly from Firebase RTDB */
export async function getFirebaseMessages(conversationId: string): Promise<Message[]> {
  if (!conversationId) return [];
  const res = await rtdbRequest(`messages/${encodeURIComponent(conversationId)}.json`);
  if (!res.ok || !res.data || typeof res.data !== "object") return [];

  const msgs: Message[] = [];
  for (const [id, m] of Object.entries<any>(res.data)) {
    if (m && typeof m === "object") {
      msgs.push({
        id: m.id || id,
        senderId: m.senderId || "",
        receiverId: m.receiverId || "",
        content: m.content || "",
        timestamp: String(m.timestamp || Date.now()),
        isRead: Boolean(m.isRead),
        productId: m.productId || null,
        imageUrl: m.imageUrl || null,
        audioUrl: m.audioUrl || null,
        reactions: m.reactions || (m.reaction ? { default: m.reaction } : undefined),
        isEdited: Boolean(m.isEdited),
        editedAt: m.editedAt || null,
        isDeleted: Boolean(m.isDeleted),
      });
    }
  }
  return msgs.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
}

/** Save a message to Firebase RTDB */
export async function saveFirebaseMessage(
  conversationId: string,
  message: Message
): Promise<boolean> {
  if (!conversationId || !message || !message.id) return false;
  const res = await rtdbRequest(
    `messages/${encodeURIComponent(conversationId)}/${encodeURIComponent(message.id)}.json`,
    {
      method: "PUT",
      body: JSON.stringify(message),
    }
  );
  return res.ok;
}

/** Update a message in Firebase RTDB (edit, reaction, delete) */
export async function updateFirebaseMessage(
  conversationId: string,
  messageId: string,
  updates: Partial<Message>
): Promise<boolean> {
  if (!conversationId || !messageId) return false;
  const res = await rtdbRequest(
    `messages/${encodeURIComponent(conversationId)}/${encodeURIComponent(messageId)}.json`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  );
  return res.ok;
}

/** Clear all messages for a conversation in Firebase RTDB */
export async function clearFirebaseMessages(conversationId: string): Promise<boolean> {
  if (!conversationId) return false;
  const res = await rtdbRequest(`messages/${encodeURIComponent(conversationId)}.json`, {
    method: "DELETE",
  });
  return res.ok;
}
