import {
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  off,
  query,
  orderByChild,
  equalTo,
  runTransaction,
} from "firebase/database";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { database, storage, auth } from "./config";
import {
  Product,
  User,
  Conversation,
  Message,
  AppNotification,
  Category,
  ProductCondition,
  ProductStatus,
  ChatroomMessage,
  ChatroomTopic,
} from "@/types";
import { INITIAL_SAMPLE_PRODUCTS, SAMPLE_CATEGORIES } from "../constants";
import { resolveCanonicalId, getCanonicalConversationId } from "@/lib/userCanonical";

// Helper for local caching to allow offline demo & resilience
const LOCAL_STORAGE_PRODUCTS_KEY = "must_marketplace_cached_products";
const PRODUCT_LIKES_KEY = "must_product_likes";
const UNIFIED_FAVORITES_KEY = "must_saved_product_ids";
const GUEST_FAVORITES_KEY = "must_guest_favorites";
const DELETED_PRODUCT_IDS_KEY = "must_deleted_product_ids";
const DELETED_USER_IDS_KEY = "must_deleted_user_ids";
const DELETED_NOTIFICATION_IDS_KEY = "must_deleted_notification_ids";

export function getDeletedProductIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_PRODUCT_IDS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function addDeletedProductId(id: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    const ids = getDeletedProductIds();
    ids.add(id);
    localStorage.setItem(DELETED_PRODUCT_IDS_KEY, JSON.stringify([...ids]));

    // Immediately purge from cached products
    const cached = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    if (cached) {
      const list = JSON.parse(cached);
      if (Array.isArray(list)) {
        const cleaned = list.filter((p: any) => p.id !== id);
        localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(cleaned));
      }
    }
  } catch {}
}

export function addDeletedProductIds(newIds: string[]) {
  if (typeof window === "undefined" || !Array.isArray(newIds) || newIds.length === 0) return;
  try {
    const current = getDeletedProductIds();
    let changed = false;
    newIds.forEach((id) => {
      if (id && !current.has(id)) {
        current.add(id);
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(DELETED_PRODUCT_IDS_KEY, JSON.stringify([...current]));
      const cached = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const cleaned = list.filter((p: any) => !current.has(p.id));
          localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(cleaned));
        }
      }
    }
  } catch {}
}

export function getDeletedUserIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_USER_IDS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function addDeletedUserId(id: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    const ids = getDeletedUserIds();
    ids.add(id);
    localStorage.setItem(DELETED_USER_IDS_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function addDeletedUserIds(newIds: string[]) {
  if (typeof window === "undefined" || !Array.isArray(newIds) || newIds.length === 0) return;
  try {
    const current = getDeletedUserIds();
    let changed = false;
    newIds.forEach((id) => {
      if (id && !current.has(id)) {
        current.add(id);
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(DELETED_USER_IDS_KEY, JSON.stringify([...current]));
    }
  } catch {}
}

export function getDeletedNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_NOTIFICATION_IDS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function addDeletedNotificationId(id: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    const ids = getDeletedNotificationIds();
    ids.add(id);
    localStorage.setItem(DELETED_NOTIFICATION_IDS_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function getProductLikes(productId: string, fallbackLikes?: number): number {
  if (typeof window === "undefined" || !productId) return fallbackLikes || 0;
  try {
    const raw = localStorage.getItem(PRODUCT_LIKES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed[productId] === "number") {
        return parsed[productId];
      }
    }
  } catch {}

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    if (cached) {
      const list = JSON.parse(cached);
      if (Array.isArray(list)) {
        const item = list.find((p: any) => p.id === productId);
        if (item && typeof item.likes === "number") {
          return item.likes;
        }
      }
    }
  } catch {}

  return typeof fallbackLikes === "number" ? fallbackLikes : 0;
}

export function updateProductLikes(productId: string, delta: number): number {
  if (typeof window === "undefined" || !productId) return 0;
  let likesMap: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(PRODUCT_LIKES_KEY);
    if (raw) likesMap = JSON.parse(raw);
  } catch {}

  const currentLikes = typeof likesMap[productId] === "number" ? likesMap[productId] : 0;
  const newLikes = Math.max(0, currentLikes + delta);
  likesMap[productId] = newLikes;

  try {
    localStorage.setItem(PRODUCT_LIKES_KEY, JSON.stringify(likesMap));
  } catch {}

  // Dispatch events for same-window tabs
  try {
    window.dispatchEvent(
      new CustomEvent("must_product_likes_changed", {
        detail: { productId, likes: newLikes },
      })
    );
  } catch {}

  return newLikes;
}

export function getLocalStoredProducts(): Product[] {
  const deleted = getDeletedProductIds();
  if (typeof window === "undefined") return [];
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter(
            (item) =>
              item &&
              item.id &&
              !deleted.has(item.id) &&
              !item.id.startsWith("prod-")
          )
          .map((item) => ({
            ...item,
            likes: typeof item.likes === "number" ? item.likes : (Number(item.likes) || 0),
          }));
      }
    }
  } catch (e) {
    console.error("Failed to read local products cache:", e);
  }
  return [];
}

function setLocalStoredProducts(products: Product[]) {
  if (typeof window === "undefined") return;
  try {
    const clean = products.filter(
      (item) => item && item.id && !item.id.startsWith("prod-")
    );
    localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(clean));
  } catch (e) {
    console.error("Failed to update local products cache:", e);
  }
}

// ─────────────────────────────────────────────────────────────
// PRODUCT SERVICES
// ─────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const deleted = getDeletedProductIds();
  const productsMap = new Map<string, Product>();
  // Track whether a remote source was successfully reached (even if empty)
  // so we don't fall back to stale localStorage when the server says "no products"
  let remoteContactedSuccessfully = false;

  // Helper to add or merge product if NOT deleted
  const addProd = (item: any, idKey?: string) => {
    if (!item) return;
    const id = idKey || item.id;
    if (!id || deleted.has(id)) return;

    let imageUrls: string[] = [];
    if (Array.isArray(item.imageUrls)) {
      imageUrls = item.imageUrls.filter(Boolean);
    } else if (typeof item.imageUrls === "string") {
      imageUrls = item.imageUrls.split(",").filter(Boolean);
    } else if (item.imageUrl) {
      imageUrls = [item.imageUrl];
    }

    const prod: Product = {
      ...item,
      id,
      imageUrls:
        imageUrls.length > 0
          ? imageUrls
          : ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800"],
      category: item.category || SAMPLE_CATEGORIES[0],
      price: Number(item.price) || 0,
      views: Number(item.views) || 0,
      likes: typeof item.likes === "number" ? item.likes : (Number(item.likes) || 0),
      status: item.status || "ACTIVE",
      condition: item.condition || "NEW",
      createdAt: item.createdAt || new Date().toISOString(),
    };
    productsMap.set(id, prod);
  };

  // 1. Fetch from centralized server API (single call for both products and deleted IDs header)
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      if (res.ok) {
        remoteContactedSuccessfully = true;
        const deletedHeader = res.headers.get("x-deleted-products");
        if (deletedHeader) {
          try {
            const parsed = JSON.parse(deletedHeader);
            if (Array.isArray(parsed) && parsed.length > 0) {
              addDeletedProductIds(parsed);
              parsed.forEach((id: string) => deleted.add(id));
            }
          } catch {}
        }
        const data: Product[] = await res.json();
        if (Array.isArray(data)) {
          data.forEach((p) => {
            if (!deleted.has(p.id)) addProd(p);
          });
        }
      }
    } catch (e) {
      console.debug("API fetch error for products:", e);
    }
  }

  // 2. Best-effort Firebase RTDB fetch (runs ONLY if server API was not reached)
  if (database && !remoteContactedSuccessfully) {
    try {
      // Sync deleted products tombstone from Firebase
      const delSnapPromise = get(ref(database, "deleted_products"));
      const delSnap = await Promise.race([
        delSnapPromise,
        new Promise<null>((res) => setTimeout(() => res(null), 500)),
      ]);
      if (delSnap && delSnap.exists()) {
        const val = delSnap.val();
        if (val && typeof val === "object") {
          const fbDeleted = Object.keys(val);
          addDeletedProductIds(fbDeleted);
          fbDeleted.forEach((id) => deleted.add(id));
        }
      }

      // Read remote products
      const prodSnapPromise = get(ref(database, "products"));
      const snapshot = await Promise.race([
        prodSnapPromise,
        new Promise<null>((res) => setTimeout(() => res(null), 600)),
      ]);
      if (snapshot && snapshot.exists()) {
        const val = snapshot.val();
        if (val && typeof val === "object") {
          Object.keys(val).forEach((key) => {
            if (!deleted.has(key)) addProd(val[key], key);
          });
        }
      } else if (snapshot !== null) {
        // Firebase responded but has no products — mark as successfully contacted
        // so we don't resurrect stale localStorage entries
        remoteContactedSuccessfully = true;
      }
    } catch (error) {
      console.warn("Firebase fetch error for products:", error);
    }
  }

  // 3. Fallback to local cache ONLY if both remote sources failed (network error),
  //    NOT if they successfully returned empty — that would resurrect deleted items
  if (productsMap.size === 0 && !remoteContactedSuccessfully) {
    const cachedList = getLocalStoredProducts();
    cachedList.forEach((p) => {
      if (!deleted.has(p.id)) addProd(p);
    });
  }

  // Purge any deleted items before sorting and saving
  const result = Array.from(productsMap.values()).filter((p) => !deleted.has(p.id));
  result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // Keep local browser cache cleanly synchronized
  setLocalStoredProducts(result);
  return result;
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!id || getDeletedProductIds().has(id)) return null;

  // 1. Try server API
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (res.ok) {
        const item: Product = await res.json();
        return {
          ...item,
          likes: typeof item.likes === "number" ? item.likes : (Number(item.likes) || 0),
        };
      }
    } catch {}
  }

  // 2. Try Firebase RTDB
  if (database) {
    try {
      const prodRef = ref(database, `products/${id}`);
      const snapshot = await get(prodRef);
      if (snapshot.exists()) {
        const item = snapshot.val();
        let imageUrls: string[] = [];
        if (Array.isArray(item.imageUrls)) {
          imageUrls = item.imageUrls;
        } else if (typeof item.imageUrls === "string") {
          imageUrls = item.imageUrls.split(",").filter(Boolean);
        } else if (item.imageUrl) {
          imageUrls = [item.imageUrl];
        }

        return {
          ...item,
          id,
          imageUrls: imageUrls.length > 0 ? imageUrls : ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800"],
          category: item.category || SAMPLE_CATEGORIES[0],
          price: Number(item.price) || 0,
          views: Number(item.views) || 0,
          likes: typeof item.likes === "number" ? item.likes : (Number(item.likes) || 0),
        };
      }
    } catch (err) {
      console.warn("Firebase getProductById error:", err);
    }
  }

  // 3. Fallback to local
  const localList = getLocalStoredProducts();
  return localList.find((p) => p.id === id) || null;
}

export async function recordProductView(productId: string, userId?: string) {
  if (!database || !productId) return;
  try {
    let viewerKey = userId;
    if (!viewerKey && typeof window !== "undefined") {
      // Guest: use a stable session-scoped visitor ID
      let vid = sessionStorage.getItem("must_guest_session_id");
      if (!vid) {
        vid = "g_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem("must_guest_session_id", vid);
      }
      viewerKey = "guest_" + vid;
    }
    if (!viewerKey) return;

    // Atomically claim the view slot for this viewer.
    // runTransaction only proceeds if the node is currently null/undefined.
    // If two concurrent requests race, Firebase guarantees exactly one wins.
    const viewRecordRef = ref(database, `product_views/${productId}/${viewerKey}`);
    const result = await runTransaction(viewRecordRef, (current) => {
      if (current !== null && current !== undefined) {
        // Already viewed — abort, do not increment counter
        return undefined; // returning undefined aborts the transaction
      }
      return true; // claim the slot
    });

    if (!result.committed) {
      // View already existed — do nothing
      return;
    }

    // Only if the slot was newly claimed: atomically increment views counter
    const viewsRef = ref(database, `products/${productId}/views`);
    await runTransaction(viewsRef, (current) => {
      return (typeof current === "number" ? current : 0) + 1;
    });
  } catch (err) {
    console.warn("Failed to record product view in Firebase:", err);
  }
}

export async function toggleFavorite(
  productId: string,
  userId?: string,
  explicitTargetState?: boolean
): Promise<boolean> {
  if (!productId) return false;
  if (!userId) {
    // 1 Account = 1 Like: Must be signed in to like items!
    return false;
  }

  if (!database) return typeof explicitTargetState === "boolean" ? explicitTargetState : false;

  try {
    const prodLikeRef = ref(database, `product_likes/${productId}/${userId}`);
    const favRef = ref(database, `favorites/${userId}/${productId}`);

    let isNowLiked: boolean;
    if (typeof explicitTargetState === "boolean") {
      isNowLiked = explicitTargetState;
    } else {
      const [prodLikeSnap, favSnap] = await Promise.all([
        get(prodLikeRef),
        get(favRef),
      ]);
      const currentlyLiked =
        (prodLikeSnap.exists() && prodLikeSnap.val() === true) ||
        (favSnap.exists() && favSnap.val() === true);
      isNowLiked = !currentlyLiked;
    }

    let trueLikesCount = 0;
    try {
      if (isNowLiked) {
        await Promise.all([
          set(prodLikeRef, true),
          set(favRef, true),
        ]);
      } else {
        await Promise.all([
          remove(prodLikeRef),
          remove(favRef),
        ]);
      }

      // Recount from the authoritative source: product_likes/{productId}
      // Count = number of unique userIds that have value === true.
      // This is the ONLY place the count is derived from. Never incremented blindly.
      // 1 account = 1 record = 1 like. Concurrent writes from multiple devices
      // all resolve to the same set() for the same userId, so the final count is correct.
      const allLikesSnap = await get(ref(database, `product_likes/${productId}`));
      if (allLikesSnap.exists()) {
        const val = allLikesSnap.val();
        if (val && typeof val === "object") {
          trueLikesCount = Object.keys(val).filter((k) => val[k] === true).length;
        }
      }

      // Overwrite products/${productId}/likes with the exact true count.
      // This corrects any prior counter drift automatically on every toggle.
      await set(ref(database, `products/${productId}/likes`), trueLikesCount);
    } catch (fbErr) {
      console.warn("Firebase like write warning:", fbErr);
    }

    // Dispatch real-time events across components in the current window
    if (typeof window !== "undefined") {
      // Always dispatch — even when trueLikesCount is 0 (e.g. last like removed)
      window.dispatchEvent(
        new CustomEvent("must_product_likes_changed", {
          detail: { productId, likes: trueLikesCount },
        })
      );
      window.dispatchEvent(
        new CustomEvent("must_favorites_updated", {
          detail: { productId, isFavorited: isNowLiked },
        })
      );
    }

    return isNowLiked;
  } catch (err) {
    console.error("toggleFavorite error:", err);
    // Return explicitTargetState if provided so UI does not abruptly revert
    return typeof explicitTargetState === "boolean" ? explicitTargetState : false;
  }
}

export async function getUserFavorites(userId?: string): Promise<string[]> {
  if (!userId || !database) return [];
  try {
    const snap = await get(ref(database, `favorites/${userId}`));
    if (snap.exists()) {
      const val = snap.val();
      if (val && typeof val === "object") {
        return Object.keys(val).filter((k) => Boolean(val[k]));
      }
    }
  } catch (err) {
    console.warn("getUserFavorites error:", err);
  }
  return [];
}

// Fast client-side image compression: reduces 10MB phone camera photos to ~100KB in under 60ms
export async function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve("");
      return;
    }

    if (!file.type.startsWith("image/") || file.type.includes("svg")) {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        } else {
          resolve((e.target?.result as string) || "");
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || "");
      img.src = (e.target?.result as string) || "";
    };
    reader.onerror = () => {
      try {
        resolve(URL.createObjectURL(file));
      } catch {
        resolve("");
      }
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadProductImage(file: File): Promise<string> {
  // 1. Immediately compress the image in browser memory (instant < 60ms)
  const compressedDataUrl = await compressImage(file);

  // 2. If storage is available, attempt remote upload with a fast 2.5s timeout race
  if (storage) {
    try {
      const uploadWithTimeout = new Promise<string>(async (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Storage timeout")), 2500);
        try {
          const fileExt = file.name.split(".").pop() || "jpg";
          const fileName = `product_images/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const fileRef = storageRef(storage, fileName);
          await uploadBytes(fileRef, file);
          const downloadUrl = await getDownloadURL(fileRef);
          clearTimeout(timer);
          resolve(downloadUrl);
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });

      return await uploadWithTimeout;
    } catch {
      // Fallback seamlessly to the optimized compressed image
      return compressedDataUrl;
    }
  }

  return compressedDataUrl;
}

export async function createProduct(
  productData: Omit<Product, "id" | "views" | "likes" | "createdAt" | "status">
): Promise<Product> {
  // Generate unified unique ID up-front so API, Firebase RTDB, and client cache share the exact same ID
  let unifiedId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  if (database) {
    try {
      const newRef = push(ref(database, "products"));
      if (newRef.key) unifiedId = newRef.key;
    } catch {}
  }

  const newProduct: Product = {
    ...productData,
    id: unifiedId,
    views: 0,
    likes: 0,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  };

  // 1. Update local cache and broadcast immediately for zero-lag UI response
  const local = getLocalStoredProducts().filter((p) => p.id !== newProduct.id);
  const updated = [newProduct, ...local];
  setLocalStoredProducts(updated);

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("must_product_created", { detail: { product: newProduct } }));
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("must_marketplace_products_sync");
        bc.postMessage({ type: "CREATE", product: newProduct });
        bc.close();
      }
    } catch {}
  }

  // 2. Parallel persistence: server API and Firebase RTDB run concurrently
  const networkTasks: Promise<any>[] = [];

  if (typeof window !== "undefined") {
    networkTasks.push(
      fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      }).catch((e) => {
        console.warn("Failed to post product to server API:", e);
      })
    );
  }

  if (database) {
    networkTasks.push(
      set(ref(database, `products/${unifiedId}`), newProduct)
        .then(() => {
          if (newProduct.sellerId) {
            const sellerRef = ref(database, `users/${newProduct.sellerId}/activeListings`);
            get(sellerRef)
              .then((snap) => {
                const count = (snap.val() as number) || 0;
                set(sellerRef, count + 1).catch(() => {});
              })
              .catch(() => {});
          }
        })
        .catch((err) => {
          console.warn("Firebase createProduct fallback:", err);
        })
    );
  }

  await Promise.allSettled(networkTasks);
  return newProduct;
}

export async function updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
  // 1. Update local cache immediately
  const local = getLocalStoredProducts();
  const index = local.findIndex((p) => p.id === productId);
  if (index !== -1) {
    local[index] = { ...local[index], ...updates };
    setLocalStoredProducts(local);
  }

  // 2. Parallel persistence: server API and Firebase RTDB run concurrently
  const networkTasks: Promise<any>[] = [];

  if (typeof window !== "undefined") {
    networkTasks.push(
      fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).catch(() => {})
    );
  }

  if (database) {
    networkTasks.push(
      update(ref(database, `products/${productId}`), updates).catch((err) => {
        console.warn("Firebase updateProduct error:", err);
      })
    );
  }

  await Promise.allSettled(networkTasks);
}

export async function deleteProduct(productId: string, sellerId?: string): Promise<void> {
  if (!productId) return;

  // 1. Persist deletion in local deleted-set so it survives refresh across all fallbacks
  addDeletedProductId(productId);

  // 2. Immediately purge from local cached products
  const local = getLocalStoredProducts().filter((p) => p.id !== productId);
  setLocalStoredProducts(local);

  // 3. Purge from all favorites stores (unified, guest, and user caches)
  if (typeof window !== "undefined") {
    try {
      const cleanFavArray = (key: string) => {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              localStorage.setItem(key, JSON.stringify(arr.filter((id: string) => id !== productId)));
            }
          } catch {}
        }
      };
      cleanFavArray(UNIFIED_FAVORITES_KEY);
      cleanFavArray(GUEST_FAVORITES_KEY);
      if (sellerId) cleanFavArray(`must_fav_${sellerId}`);

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("must_fav_")) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const obj = JSON.parse(raw);
              if (obj && typeof obj === "object" && obj[productId]) {
                delete obj[productId];
                localStorage.setItem(key, JSON.stringify(obj));
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  // 4. Update seller's active listings in local storage if known
  if (typeof window !== "undefined" && sellerId) {
    try {
      const userKey = `must_user_${sellerId}`;
      const rawUser = localStorage.getItem(userKey);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (typeof parsed.activeListings === "number") {
          parsed.activeListings = Math.max(0, parsed.activeListings - 1);
          localStorage.setItem(userKey, JSON.stringify(parsed));
        }
      }
      const activeRaw = localStorage.getItem("must_active_user");
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw);
        if (parsed.id === sellerId && typeof parsed.activeListings === "number") {
          parsed.activeListings = Math.max(0, parsed.activeListings - 1);
          localStorage.setItem("must_active_user", JSON.stringify(parsed));
        }
      }
    } catch {}
  }

  // 5. Delete from server-side storage (data/products.json) and save in deleted_products.json
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.deletedIds && Array.isArray(data.deletedIds)) {
          addDeletedProductIds(data.deletedIds);
        }
      }
    } catch (e) {
      console.warn("Failed to delete product from server API:", e);
    }
  }

  // 6. Delete from Firebase RTDB (fast non-blocking 500ms race)
  if (database) {
    const fbPromise = (async () => {
      try {
        await remove(ref(database, `products/${productId}`));
        await set(ref(database, `deleted_products/${productId}`), {
          deletedAt: Date.now(),
          sellerId: sellerId || null,
        });

        if (sellerId) {
          const sellerRef = ref(database, `users/${sellerId}/activeListings`);
          const snap = await get(sellerRef);
          const count = (snap.val() as number) || 1;
          await set(sellerRef, Math.max(0, count - 1));
        }
      } catch (err) {
        console.warn("Firebase deleteProduct error:", err);
      }
    })();
    Promise.race([
      fbPromise,
      new Promise((res) => setTimeout(res, 500)),
    ]).catch(() => {});
  }

  // 7. Broadcast deletion across open tabs, windows, and roles immediately
  if (typeof window !== "undefined") {
    try {
      // Local events
      window.dispatchEvent(new CustomEvent("must_product_deleted", { detail: { productId, sellerId } }));
      window.dispatchEvent(new CustomEvent("must_favorites_updated", { detail: { productId, isFavorited: false } }));

      // BroadcastChannel for cross-tab in same browser
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("must_marketplace_products_sync");
        bc.postMessage({ type: "DELETE", productId, sellerId });
        setTimeout(() => bc.close(), 1000);
      }

      // Storage event for cross-tab & cross-window sync
      localStorage.setItem(
        "must_last_deleted_product_sync",
        JSON.stringify({ productId, sellerId, timestamp: Date.now() })
      );
    } catch {}
  }
}

// ─────────────────────────────────────────────────────────────
// USER & SELLER SERVICES
// ─────────────────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<User | null> {
  if (database) {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snap = await get(userRef);
      if (snap.exists()) {
        const val = snap.val();
        return {
          id: userId,
          fullName: val.fullName || "MUST Student",
          email: val.email || "",
          phone: val.phone || null,
          location: val.location || "Main Gate",
          profileImageUrl: val.profileImageUrl || null,
          seller: Boolean(val.seller || val.isSeller),
          isSeller: Boolean(val.seller || val.isSeller),
          admin: Boolean(val.admin || val.isAdmin),
          isAdmin: Boolean(val.admin || val.isAdmin),
          memberSince: val.memberSince || String(Date.now()),
          activeListings: val.activeListings || 0,
          soldItems: val.soldItems || 0,
          likes: val.likes || 0,
        };
      }
    } catch (err) {
      console.warn("Failed to get user profile from Firebase:", err);
    }
  }

  // Local storage fallback for auth persistence
  try {
    const cachedUser = localStorage.getItem(`must_user_${userId}`);
    if (cachedUser) return JSON.parse(cachedUser);
  } catch {}

  return null;
}

export async function becomeSeller(userId: string, phone: string, location: string): Promise<void> {
  const updates = {
    phone,
    location,
    seller: true,
    isSeller: true,
  };

  // 1. Persist to centralized server API so it stays permanent across all browsers & sessions
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          phone,
          location,
          seller: true,
          isSeller: true,
        }),
      });
    } catch (e) {
      console.warn("Failed to update user via /api/users:", e);
    }
  }

  if (database) {
    try {
      await update(ref(database, `users/${userId}`), updates);

      // Add a notification
      await createNotification(userId, {
        title: "Seller Activated! 🚀",
        message: "You're now an official seller on MUST Marketplace. Start listing your items today!",
        type: "welcome",
        priority: "NORMAL",
      });
    } catch (err) {
      console.warn("Firebase becomeSeller error:", err);
    }
  }

  // Update local user cache
  try {
    const cachedUser = localStorage.getItem(`must_user_${userId}`);
    const parsed = cachedUser ? JSON.parse(cachedUser) : {};
    const merged = { ...parsed, ...updates, seller: true, isSeller: true };
    localStorage.setItem(`must_user_${userId}`, JSON.stringify(merged));

    const activeUser = localStorage.getItem("must_active_user");
    if (activeUser) {
      const parsedActive = JSON.parse(activeUser);
      if (parsedActive.id === userId) {
        localStorage.setItem("must_active_user", JSON.stringify({ ...parsedActive, ...merged }));
      }
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// MESSAGING & CHAT SERVICES
// ─────────────────────────────────────────────────────────────

export function getConversationId(uid1: string, uid2: string): string {
  return getCanonicalConversationId(uid1, uid2);
}

// Helper broadcast channel for multi-tab live chat synchronization
function notifyChatSync(payload: { type: string; [key: string]: any }) {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel("must_marketplace_chat_sync");
    channel.postMessage(payload);
    channel.close();
  } catch {}
  window.dispatchEvent(new CustomEvent("must_chat_sync_event", { detail: payload }));
}

function listenToChatSync(callback: (payload: any) => void): () => void {
  if (typeof window === "undefined") return () => {};

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel("must_marketplace_chat_sync");
    channel.onmessage = (event) => {
      callback(event.data);
    };
  } catch {}

  const handleCustom = (e: any) => {
    callback(e.detail);
  };
  window.addEventListener("must_chat_sync_event", handleCustom);
  window.addEventListener("storage", () => callback({ type: "storage_change" }));

  return () => {
    if (channel) channel.close();
    window.removeEventListener("must_chat_sync_event", handleCustom);
  };
}

// Deduplicate conversation lists by user ID or user name, keeping the freshest
export function deduplicateConversations(convs: Conversation[]): Conversation[] {
  if (!Array.isArray(convs)) return [];
  const seen = new Set<string>();
  const result: Conversation[] = [];

  // Sort by lastMessageTime descending (most recent first)
  const sorted = [...convs].sort((a, b) => {
    const timeA = a?.lastMessageTime ? (isNaN(Number(a.lastMessageTime)) ? new Date(a.lastMessageTime).getTime() : Number(a.lastMessageTime)) : 0;
    const timeB = b?.lastMessageTime ? (isNaN(Number(b.lastMessageTime)) ? new Date(b.lastMessageTime).getTime() : Number(b.lastMessageTime)) : 0;
    return (timeB || 0) - (timeA || 0);
  });

  for (const c of sorted) {
    if (!c) continue;
    const idKey = (c.otherUserId || c.id || "").trim().toLowerCase();
    const nameKey = (c.otherUserName || "").trim().toLowerCase();

    if (idKey && seen.has(`id:${idKey}`)) continue;
    const isGenericName = !nameKey || nameKey === "student seller" || nameKey === "seller" || nameKey.includes("comrade");
    if (nameKey && !isGenericName && seen.has(`name:${nameKey}`)) continue;

    if (idKey) seen.add(`id:${idKey}`);
    if (nameKey) seen.add(`name:${nameKey}`);

    const cleanName =
      c.otherUserName && !c.otherUserName.toLowerCase().includes("comrade")
        ? c.otherUserName
        : userNameCache.get(c.otherUserId || "") || "Student Seller";

    result.push({
      ...c,
      id: c.id || idKey,
      otherUserId: c.otherUserId || "",
      otherUserName: cleanName,
      lastMessage: c.lastMessage || "",
      lastMessageTime: c.lastMessageTime || String(Date.now()),
      unreadCount: typeof c.unreadCount === "number" ? c.unreadCount : 0,
    });
  }

  return result;
}

export function getLocalConversations(userId: string): Conversation[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const stored = localStorage.getItem(`must_conversations_${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const sanitized = parsed.map((item: any) => {
          const rawName = item?.otherUserName;
          const cleanName =
            rawName && !rawName.toLowerCase().includes("comrade")
              ? rawName
              : userNameCache.get(item?.otherUserId || "") || "Student Seller";

          return {
            ...item,
            id: item?.id || "",
            otherUserId: item?.otherUserId || "",
            otherUserName: cleanName,
            lastMessage: item?.lastMessage || "",
            lastMessageTime: item?.lastMessageTime || String(Date.now()),
            unreadCount: typeof item?.unreadCount === "number" ? item.unreadCount : 0,
          };
        });
        return deduplicateConversations(sanitized);
      }
    }
  } catch {}
  return [];
}

export function saveLocalConversations(userId: string, conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  try {
    const cleaned = deduplicateConversations(conversations);
    localStorage.setItem(`must_conversations_${userId}`, JSON.stringify(cleaned));
  } catch {}
}

export function getLocalMessages(conversationId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(`must_chat_messages_${conversationId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalMessages(conversationId: string, messages: Message[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`must_chat_messages_${conversationId}`, JSON.stringify(messages));
  } catch {}
}

// In-memory cache for user names
const userNameCache = new Map<string, string>();

export async function resolveRealUserName(userId: string): Promise<string> {
  if (!userId) return "Student Seller";
  if (userNameCache.has(userId)) return userNameCache.get(userId)!;

  // Check localStorage cache
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`must_user_name_${userId}`);
      if (
        cached &&
        !cached.toLowerCase().includes("comrade") &&
        !cached.toLowerCase().includes("must seller")
      ) {
        userNameCache.set(userId, cached);
        return cached;
      }
    } catch {}
  }

  // 1. Check Firebase RTDB users/${userId}
  if (database) {
    try {
      const snap = await get(ref(database, `users/${userId}`));
      if (snap.exists()) {
        const val = snap.val();
        const name = (val?.fullName || val?.name || val?.displayName || "").trim();
        if (name && !name.toLowerCase().includes("comrade")) {
          userNameCache.set(userId, name);
          if (typeof window !== "undefined") {
            try { localStorage.setItem(`must_user_name_${userId}`, name); } catch {}
          }
          return name;
        }
      }
    } catch {}
  }

  // 2. Fetch from /api/users?id=${userId}
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        const name = (data?.fullName || data?.name || data?.displayName || "").trim();
        if (name && !name.toLowerCase().includes("comrade")) {
          userNameCache.set(userId, name);
          try { localStorage.setItem(`must_user_name_${userId}`, name); } catch {}
          return name;
        }
      }
    } catch {}
  }

  return "Student Seller";
}

export function subscribeToConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void
): () => void {
  callback([]);
  return () => {};
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void
): () => void {
  callback([]);
  return () => {};
}

export async function sendMessage(params: {
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  productId?: string | null;
  productTitle?: string | null;
  imageUrl?: string | null;
  audioUrl?: string | null;
}): Promise<void> {
  const {
    senderId,
    senderName: rawSenderName,
    receiverId,
    receiverName: rawReceiverName,
    content,
    productId,
    productTitle,
    imageUrl,
    audioUrl,
  } = params;

  if (senderId === receiverId) {
    console.warn("Cannot send message to oneself");
    return;
  }

  // Ensure real names are always used (never fallback to generic "MUST Comrade")
  let senderName = (rawSenderName || "").trim();
  if (!senderName || senderName.toLowerCase().includes("comrade") || senderName === "MUST Student") {
    senderName = await resolveRealUserName(senderId);
  }
  let receiverName = (rawReceiverName || "").trim();
  if (!receiverName || receiverName.toLowerCase().includes("comrade") || receiverName === "MUST Seller" || receiverName === "Seller") {
    receiverName = await resolveRealUserName(receiverId);
  }

  const conversationId = getConversationId(senderId, receiverId);
  const timestamp = String(Date.now());
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const message: Message = {
    id: msgId,
    senderId,
    receiverId,
    productId: productId || null,
    content,
    imageUrl: imageUrl || null,
    audioUrl: audioUrl || null,
    timestamp,
    isRead: false,
  };

  // 1. Optimistically update local storage (instant UI feedback for sender)
  const existingMsgs = getLocalMessages(conversationId);
  const newMsgs = [...existingMsgs, message];
  saveLocalMessages(conversationId, newMsgs);

  const preview = content || (imageUrl ? "Photo" : audioUrl ? "Voice message" : "New message");

  // 2. Update sender conversation list locally
  const senderConvs = getLocalConversations(senderId);
  const otherSenderConvs = senderConvs.filter(
    (c) =>
      c.id !== conversationId &&
      c.otherUserId !== receiverId &&
      c.otherUserName?.trim().toLowerCase() !== receiverName.trim().toLowerCase()
  );
  const updatedSenderConv: Conversation = {
    id: conversationId,
    otherUserId: receiverId,
    otherUserName: receiverName,
    lastMessage: preview,
    lastMessageTime: timestamp,
    unreadCount: 0,
    productId: productId || null,
    productTitle: productTitle || null,
  };
  saveLocalConversations(senderId, [updatedSenderConv, ...otherSenderConvs]);

  // 3. Update receiver conversation list locally (same device / tab)
  const receiverConvs = getLocalConversations(receiverId);
  const existingReceiver = receiverConvs.find((c) => c.id === conversationId);
  const otherReceiverConvs = receiverConvs.filter(
    (c) =>
      c.id !== conversationId &&
      c.otherUserId !== senderId &&
      c.otherUserName?.trim().toLowerCase() !== senderName.trim().toLowerCase()
  );
  const updatedReceiverConv: Conversation = {
    id: conversationId,
    otherUserId: senderId,
    otherUserName: senderName,
    lastMessage: preview,
    lastMessageTime: timestamp,
    unreadCount: (existingReceiver?.unreadCount || 0) + 1,
    productId: productId || null,
    productTitle: productTitle || null,
  };
  saveLocalConversations(receiverId, [updatedReceiverConv, ...otherReceiverConvs]);

  // 4. Broadcast live sync event to other tabs on same browser
  notifyChatSync({
    type: "message",
    conversationId,
    senderId,
    receiverId,
    message,
  });

  // 5. Persist to server API (cross-browser source of truth)
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: msgId,
          timestamp,
          senderId,
          senderName,
          receiverId,
          receiverName,
          content,
          productId: productId || null,
          productTitle: productTitle || null,
          imageUrl: imageUrl || null,
          audioUrl: audioUrl || null,
        }),
      });
    } catch (e) {
      console.warn("Failed to send message to server:", e);
    }
  }

  // 6. Attempt Firebase RTDB sync
  if (database) {
    try {
      await set(ref(database, `messages/${conversationId}/${msgId}`), message);
      await set(ref(database, `conversations/${senderId}/${conversationId}`), updatedSenderConv);
      await set(ref(database, `conversations/${receiverId}/${conversationId}`), updatedReceiverConv);
    } catch {}
  }
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  newContent: string
): Promise<void> {
  const clean = newContent.trim();
  if (!clean) return;

  // 1. Update local storage immediately (0ms instant UI feedback)
  const msgs = getLocalMessages(conversationId);
  const updated = msgs.map((m) =>
    m.id === messageId
      ? { ...m, content: clean, isEdited: true, editedAt: String(Date.now()) }
      : m
  );
  saveLocalMessages(conversationId, updated);

  // 2. Broadcast live event across tabs
  notifyChatSync({
    type: "message_edit",
    conversationId,
    messageId,
    content: clean,
  });

  // 3. Update server API
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messageId,
          action: "edit",
          content: clean,
        }),
      });
    } catch {}
  }

  // 4. Update Firebase RTDB
  if (database) {
    try {
      await update(ref(database, `messages/${conversationId}/${messageId}`), {
        content: clean,
        isEdited: true,
        editedAt: Date.now(),
      });
    } catch {}
  }
}

export async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  // 1. Update local storage (WhatsApp-like: marks deleted so it shows "This message was deleted")
  const msgs = getLocalMessages(conversationId);
  const updated = msgs.map((m) =>
    m.id === messageId
      ? { ...m, isDeleted: true, content: "🚫 This message was deleted" }
      : m
  );
  saveLocalMessages(conversationId, updated);

  // 2. Broadcast live event
  notifyChatSync({
    type: "message_delete",
    conversationId,
    messageId,
  });

  // 3. Update server API
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messageId,
          action: "delete",
        }),
      });
    } catch {}
  }

  // 4. Update Firebase RTDB
  if (database) {
    try {
      await update(ref(database, `messages/${conversationId}/${messageId}`), {
        isDeleted: true,
        content: "🚫 This message was deleted",
      });
    } catch {}
  }
}

export async function toggleMessageReaction(
  conversationId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const msgs = getLocalMessages(conversationId);
  const target = msgs.find((m) => m.id === messageId);
  if (!target) return;

  const reactions = { ...(target.reactions || {}) };
  if (reactions[userId] === emoji) {
    delete reactions[userId];
  } else {
    reactions[userId] = emoji;
  }
  const primaryReaction = Object.values(reactions)[0] || null;

  const updated = msgs.map((m) =>
    m.id === messageId
      ? { ...m, reactions, reaction: primaryReaction }
      : m
  );
  saveLocalMessages(conversationId, updated);

  // Broadcast
  notifyChatSync({
    type: "message_reaction",
    conversationId,
    messageId,
    userId,
    emoji,
    reactions,
  });

  // Update server API
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messageId,
          userId,
          emoji,
          action: "react",
        }),
      });
    } catch {}
  }

  // Update Firebase RTDB
  if (database) {
    try {
      await set(
        ref(database, `messages/${conversationId}/${messageId}/reactions`),
        reactions
      );
    } catch {}
  }
}

export async function deleteConversation(
  userId: string,
  conversationId: string
): Promise<void> {
  // 1. Update local storage
  const convs = getLocalConversations(userId);
  const remaining = convs.filter((c) => c.id !== conversationId && c.otherUserId !== conversationId);
  saveLocalConversations(userId, remaining);
  saveLocalMessages(conversationId, []);

  // 2. Broadcast
  notifyChatSync({
    type: "conversation_delete",
    conversationId,
    userId,
  });

  // 3. Update server API
  if (typeof window !== "undefined") {
    try {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          userId,
          action: "delete",
        }),
      });
      await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });
    } catch {}
  }

  // 4. Update Firebase RTDB
  if (database) {
    try {
      await remove(ref(database, `conversations/${userId}/${conversationId}`));
    } catch {}
  }
}

export async function clearConversationMessages(
  conversationId: string
): Promise<void> {
  saveLocalMessages(conversationId, []);

  notifyChatSync({
    type: "messages_cleared",
    conversationId,
  });

  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });
    } catch {}
  }

  if (database) {
    try {
      await remove(ref(database, `messages/${conversationId}`));
    } catch {}
  }
}

export function markConversationAsRead(userId: string, conversationId: string) {
  if (!userId || !conversationId) return;

  // 1. Immediately update local storage
  const convs = getLocalConversations(userId);
  let changed = false;
  const updated = convs.map((c) => {
    if (c.id === conversationId || c.otherUserId === conversationId) {
      if (c.unreadCount > 0) changed = true;
      return { ...c, unreadCount: 0 };
    }
    return c;
  });

  if (changed || true) {
    saveLocalConversations(userId, updated);
    notifyChatSync({ type: "conversation_read", conversationId, userId });
  }

  // 2. Persist to server API so polling doesn't restore the unread badge
  if (typeof window !== "undefined") {
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark_read",
        userId,
        conversationId,
      }),
    }).catch(() => {});
  }

  // 3. Update Firebase RTDB if available (only if conversation node already exists to avoid creating empty stubs)
  if (database) {
    try {
      const convNodeRef = ref(database, `conversations/${userId}/${conversationId}`);
      get(convNodeRef).then((snap) => {
        if (snap.exists()) {
          update(convNodeRef, { unreadCount: 0 }).catch(() => {});
        }
      }).catch(() => {});
    } catch {}
  }
}

export function subscribeToTyping(
  conversationId: string,
  otherUserId: string,
  callback: (isTyping: boolean) => void
): () => void {
  const handler = (payload: any) => {
    if (
      payload?.type === "typing" &&
      payload?.conversationId === conversationId &&
      payload?.userId === otherUserId
    ) {
      callback(Boolean(payload?.isTyping));
    }
  };

  const unsub = listenToChatSync(handler);
  return unsub;
}

export async function setTypingStatus(
  conversationId: string,
  userId: string,
  isTyping: boolean
) {
  notifyChatSync({
    type: "typing",
    conversationId,
    userId,
    isTyping,
  });
}

// ─────────────────────────────────────────────────────────────
// CAMPUS CHATROOM (COMMUNITY CHATROOM)
// ─────────────────────────────────────────────────────────────

const initialChatroomMessages: Record<ChatroomTopic, ChatroomMessage[]> = {
  general: [],
  hostels: [],
  requests: [],
  study: [],
};

export function getLocalChatroomMessages(topic: ChatroomTopic): ChatroomMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(`must_chatroom_${topic}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Purge any stored fake/seed messages (ids starting with "cm-")
      const real = parsed.filter((m: ChatroomMessage) => !m.id.startsWith("cm-"));
      if (Array.isArray(real) && real.length > 0) return real;
    }
  } catch {}
  return [];
}

export function saveLocalChatroomMessages(topic: ChatroomTopic, msgs: ChatroomMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`must_chatroom_${topic}`, JSON.stringify(msgs));
  } catch {}
}

export function subscribeToChatroom(
  topic: ChatroomTopic,
  callback: (messages: ChatroomMessage[]) => void
): () => void {
  // Return current messages
  const current = getLocalChatroomMessages(topic);
  callback(current);

  const unsub = listenToChatSync((payload) => {
    if (payload?.type === "chatroom_message" || payload?.type === "chatroom_like" || payload?.type === "storage_change") {
      const updated = getLocalChatroomMessages(topic);
      callback(updated);
    }
  });

  return unsub;
}

export async function sendChatroomMessage(params: {
  senderId: string;
  senderName: string;
  senderRole?: "student" | "seller" | "admin";
  content: string;
  topic: ChatroomTopic;
  productTag?: { id: string; title: string; price: number };
}): Promise<ChatroomMessage> {
  const { senderId, senderName, senderRole, content, topic, productTag } = params;

  const msg: ChatroomMessage = {
    id: `cm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderId,
    senderName,
    senderRole: senderRole || "student",
    content,
    topic,
    timestamp: String(Date.now()),
    likes: 0,
    likedBy: [],
    productTag,
  };

  const existing = getLocalChatroomMessages(topic);
  const updated = [...existing, msg];
  saveLocalChatroomMessages(topic, updated);

  notifyChatSync({
    type: "chatroom_message",
    topic,
    message: msg,
  });

  return msg;
}

export function likeChatroomMessage(messageId: string, topic: ChatroomTopic, userId: string) {
  const existing = getLocalChatroomMessages(topic);
  const updated = existing.map((m) => {
    if (m.id === messageId) {
      const likedBy = m.likedBy || [];
      const hasLiked = likedBy.includes(userId);
      const nextLikedBy = hasLiked ? likedBy.filter((id) => id !== userId) : [...likedBy, userId];
      return {
        ...m,
        likes: nextLikedBy.length,
        likedBy: nextLikedBy,
      };
    }
    return m;
  });

  saveLocalChatroomMessages(topic, updated);
  notifyChatSync({
    type: "chatroom_like",
    topic,
    messageId,
  });
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS SERVICES
// ─────────────────────────────────────────────────────────────

export function getDemoNotifications(name: string = "Comrade"): AppNotification[] {
  return [
    {
      id: "demo_welcome",
      title: `Welcome to MUST Marketplace, ${name}! 🎉`,
      message:
        "Buy & sell affordable electronics, books, furniture & campus essentials with fellow students across Main Gate, Nchiru & California.",
      timestamp: Date.now() - 5 * 60 * 1000,
      isRead: false,
      type: "welcome",
      priority: "NORMAL",
    },
    {
      id: "demo_safety",
      title: "Campus Safety Reminder",
      message:
        "Always meet at busy campus zones — Library Foyer, Student Center, or Gate A. Inspect all items before M-Pesa payments.",
      timestamp: Date.now() - 24 * 3600 * 1000,
      isRead: true,
      type: "security",
      priority: "INFO",
    },
    {
      id: "demo_tip",
      title: "Tip: Post Your First Listing",
      message:
        "Got items collecting dust? Turn them into quick cash! Tap the + button to create a listing in under 2 minutes.",
      timestamp: Date.now() - 2 * 24 * 3600 * 1000,
      isRead: true,
      type: "tip",
      priority: "INFO",
    },
    {
      id: "demo_promo",
      title: "MUST Marketplace Community",
      message:
        "Electronics, textbooks, furniture & fashion — all from verified student sellers. Browse what's trending today.",
      timestamp: Date.now() - 3 * 24 * 3600 * 1000,
      isRead: true,
      type: "system",
      priority: "INFO",
    },
  ];
}

export function deduplicateNotifications(list: AppNotification[]): AppNotification[] {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: AppNotification[] = [];

  for (const n of list) {
    if (!n || !n.id) continue;
    if (seenIds.has(n.id)) continue;

    // Normalize title & message: strip non-alphanumeric and compare
    const cleanTitle = (n.title || "")
      .replace(/[^\w\s]/gi, "")
      .trim()
      .toLowerCase();
    const cleanMsg = (n.message || "")
      .replace(/[^\w\s]/gi, "")
      .trim()
      .toLowerCase();
    const sig = `${cleanTitle}:::${cleanMsg}`;

    if (seenSignatures.has(sig)) {
      continue;
    }

    seenIds.add(n.id);
    seenSignatures.add(sig);
    result.push(n);
  }

  return result;
}

export function getLocalNotifications(userId: string): AppNotification[] {
  if (typeof window === "undefined" || !userId) return [];
  const deletedNotifs = getDeletedNotificationIds();
  try {
    const raw = localStorage.getItem(`must_notifications_${userId}`);
    let saved: AppNotification[] = [];
    let hasLoaded = false;
    if (raw !== null) {
      hasLoaded = true;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          saved = parsed.filter((n) => !deletedNotifs.has(n.id));
        }
      } catch {}
    }

    // Merge any admin broadcasts the user hasn't seen yet
    const broadcastsRaw = localStorage.getItem("must_admin_broadcasts");
    if (broadcastsRaw) {
      const broadcasts: { title: string; message: string; priority: string; timestamp: number }[] =
        JSON.parse(broadcastsRaw);
      const existingIds = new Set(saved.map((n) => n.id));
      let addedAny = false;
      broadcasts.forEach((b) => {
        const id = `broadcast_${b.timestamp}`;
        const cleanBTitle = (b.title || "").replace(/[^\w\s]/gi, "").trim().toLowerCase();
        const cleanBMsg = (b.message || "").replace(/[^\w\s]/gi, "").trim().toLowerCase();
        const bSig = `${cleanBTitle}:::${cleanBMsg}`;

        const alreadyExists = saved.some((s) => {
          if (s.id === id) return true;
          const sTitle = (s.title || "").replace(/[^\w\s]/gi, "").trim().toLowerCase();
          const sMsg = (s.message || "").replace(/[^\w\s]/gi, "").trim().toLowerCase();
          return `${sTitle}:::${sMsg}` === bSig;
        });

        if (!existingIds.has(id) && !alreadyExists && !deletedNotifs.has(id)) {
          addedAny = true;
          saved.unshift({
            id,
            title: `📢 ${b.title}`,
            message: b.message,
            type: "system",
            priority: b.priority as "URGENT" | "NORMAL" | "INFO",
            timestamp: b.timestamp,
            isRead: false,
          });
        }
      });

      // Deduplicate to clean up any past legacy duplicates
      saved = deduplicateNotifications(saved);

      // Save the merged list so it persists
      if (addedAny || raw !== null) {
        try {
          localStorage.setItem(`must_notifications_${userId}`, JSON.stringify(saved));
        } catch {}
      }
    } else {
      saved = deduplicateNotifications(saved);
    }

    if (hasLoaded) return saved;
  } catch {}

  // For demo accounts without any prior local history, initialize with clean demo notifications
  if (userId.startsWith("demo_") && deletedNotifs.size === 0) {
    const demos = deduplicateNotifications(getDemoNotifications());
    saveLocalNotifications(userId, demos);
    return demos;
  }

  return [];
}

export function saveLocalNotifications(userId: string, notifications: AppNotification[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`must_notifications_${userId}`, JSON.stringify(notifications));
  } catch {}
}

export async function createNotification(
  userId: string,
  data: Omit<AppNotification, "id" | "timestamp" | "isRead">
) {
  if (!userId) return;
  const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const notification: AppNotification = {
    ...data,
    id,
    timestamp: Date.now(),
    isRead: false,
  };

  // 1. Save to local storage for instant multi-tab UI
  if (typeof window !== "undefined") {
    const current = getLocalNotifications(userId);
    const updated = [notification, ...current.filter((n) => n.id !== id)];
    saveLocalNotifications(userId, updated);
    notifyChatSync({ type: "notification_change", userId });
  }

  // 2. Persist to Firebase Realtime Database if connected
  if (database) {
    try {
      await set(ref(database, `notifications/${userId}/${id}`), notification);
    } catch (err) {
      console.warn("Failed to create notification in Firebase:", err);
    }
  }
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  // 1. Immediately return local notifications for this user
  const initial = getLocalNotifications(userId);
  callback(initial);

  // 2. Listen to cross-tab notification updates
  const unsubLocal = listenToChatSync((payload) => {
    if (payload?.type === "notification_change" && payload.userId === userId) {
      callback(getLocalNotifications(userId));
    }
  });

  if (!database) {
    return () => unsubLocal();
  }

  const notifRef = ref(database, `notifications/${userId}`);
  const listener = onValue(notifRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      const list: AppNotification[] = (typeof val === "object" && val !== null)
        ? Object.keys(val)
            .filter((k) => val[k] && typeof val[k] === "object" && (val[k].title || val[k].message))
            .map((k) => ({
              ...val[k],
              id: val[k].id || k,
            }))
        : [];
      list.sort((a, b) => b.timestamp - a.timestamp);
      const dedupled = deduplicateNotifications(list);
      saveLocalNotifications(userId, dedupled);
      callback(dedupled);
    } else {
      if (!userId.startsWith("demo_")) {
        // Real user has no notifications in DB -> sync local to empty as well
        saveLocalNotifications(userId, []);
        callback([]);
      } else {
        // Demo account uses localStorage
        callback(getLocalNotifications(userId));
      }
    }
  });

  return () => {
    unsubLocal();
    off(notifRef, "value", listener);
  };
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
  if (!userId) return;

  // 1. Mark read locally
  if (typeof window !== "undefined") {
    const list = getLocalNotifications(userId);
    const updated = list.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n));
    saveLocalNotifications(userId, updated);
    notifyChatSync({ type: "notification_change", userId });
  }

  // 2. Mark read in Firebase
  if (database) {
    try {
      await update(ref(database, `notifications/${userId}/${notificationId}`), {
        isRead: true,
      });
    } catch (err) {
      console.warn(err);
    }
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  if (!userId) return;

  // 1. Mark all read locally
  if (typeof window !== "undefined") {
    const list = getLocalNotifications(userId);
    const updated = list.map((n) => ({ ...n, isRead: true }));
    saveLocalNotifications(userId, updated);
    notifyChatSync({ type: "notification_change", userId });
  }

  // 2. Mark all read in Firebase
  if (database) {
    try {
      const notifRef = ref(database, `notifications/${userId}`);
      const snap = await get(notifRef);
      if (snap.exists()) {
        const updates: Record<string, boolean> = {};
        Object.keys(snap.val()).forEach((k) => {
          updates[`${k}/isRead`] = true;
        });
        await update(notifRef, updates);
      }
    } catch (err) {
      console.warn(err);
    }
  }
}

export async function deleteNotification(userId: string, notificationId: string) {
  if (!userId || !notificationId) return;

  // Track deletion so it never returns on refresh
  addDeletedNotificationId(notificationId);

  // 1. Delete locally
  if (typeof window !== "undefined") {
    const list = getLocalNotifications(userId);
    const updated = list.filter((n) => n.id !== notificationId);
    saveLocalNotifications(userId, updated);
    notifyChatSync({ type: "notification_change", userId });
  }

  // 2. Delete in Firebase
  if (database) {
    try {
      await remove(ref(database, `notifications/${userId}/${notificationId}`));
    } catch (err) {
      console.warn("Failed to delete notification in DB:", err);
    }
  }
}

export async function clearAllNotifications(userId: string) {
  if (!userId) return;

  // Track all current notifications as deleted
  if (typeof window !== "undefined") {
    const list = getLocalNotifications(userId);
    list.forEach((n) => addDeletedNotificationId(n.id));
    saveLocalNotifications(userId, []);
    notifyChatSync({ type: "notification_change", userId });
  }

  // 2. Clear in Firebase
  if (database) {
    try {
      await remove(ref(database, `notifications/${userId}`));
    } catch (err) {
      console.warn("Failed to clear notifications in DB:", err);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN SERVICES
// ─────────────────────────────────────────────────────────────

export async function deleteUserAccount(userId: string): Promise<void> {
  addDeletedUserId(userId);

  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.warn("Failed to delete user via API:", e);
    }
  }

  if (database) {
    try {
      await remove(ref(database, `users/${userId}`));
      await set(ref(database, `deleted_users/${userId}`), { deletedAt: Date.now() });
    } catch (err) {
      console.warn("Failed to delete user in DB:", err);
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("must_user_deleted", { detail: { userId } }));
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("must_marketplace_users_sync");
        bc.postMessage({ type: "DELETE", userId });
        bc.close();
      }
    } catch {}
  }
}

export async function fetchAllUsers(): Promise<User[]> {
  // 1. Sync deleted user IDs from server API header
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (res.ok) {
        const delHeader = res.headers.get("x-deleted-users");
        if (delHeader) {
          try {
            const parsed = JSON.parse(delHeader);
            if (Array.isArray(parsed)) addDeletedUserIds(parsed);
          } catch {}
        }
      }
    } catch {}
  }

  // 2. Sync deleted user IDs from Firebase RTDB
  if (database) {
    try {
      const delSnap = await get(ref(database, "deleted_users"));
      if (delSnap.exists()) {
        const val = delSnap.val();
        if (val && typeof val === "object") {
          addDeletedUserIds(Object.keys(val));
        }
      }
    } catch {}
  }

  const deleted = getDeletedUserIds();
  const usersMap = new Map<string, User>();

  const addUser = (u: any, fallbackId?: string) => {
    if (!u) return;
    const id = u.id || u.uid || fallbackId;
    const email = (u.email || "").toLowerCase().trim();
    if (!id && !email) return;

    if (deleted.has(id) || deleted.has(email)) return;
    if (id?.startsWith("demo_") || id?.startsWith("new_user_")) return;

    // Only allow real @gmail.com accounts or the administrator account
    if (!email.endsWith("@gmail.com") && email !== "must.market@admin.com") return;

    const key = email || id;
    const existing = usersMap.get(key) || (id ? usersMap.get(id) : undefined);

    const isSeller = Boolean(u.seller || u.isSeller || existing?.seller || existing?.isSeller);
    const isAdmin = Boolean(u.admin || u.isAdmin || email === "must.market@admin.com" || email === "admin@must.ac.ke");

    const merged: User = {
      ...(existing || {}),
      ...u,
      id: id || existing?.id || key,
      fullName: u.fullName || existing?.fullName || (email ? email.split("@")[0] : "User"),
      email: email || existing?.email || "",
      phone: u.phone || existing?.phone || null,
      location: u.location || existing?.location || "Main Gate",
      profileImageUrl: u.profileImageUrl || existing?.profileImageUrl || null,
      seller: isSeller,
      isSeller: isSeller,
      admin: isAdmin,
      isAdmin: isAdmin,
      memberSince: u.memberSince || existing?.memberSince || String(Date.now()),
      activeListings: typeof u.activeListings === "number" ? u.activeListings : (existing?.activeListings || 0),
      soldItems: typeof u.soldItems === "number" ? u.soldItems : (existing?.soldItems || 0),
      likes: typeof u.likes === "number" ? u.likes : (existing?.likes || 0),
    };

    usersMap.set(key, merged);
    if (id) usersMap.set(id, merged);
  };

  // 3. Fetch from centralized server API (data/users.json)
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach((u) => addUser(u));
        }
      }
    } catch (e) {
      console.debug("API fetch fallback for users:", e);
    }
  }

  // 4. ALWAYS query Firebase RTDB to discover all real live registered students & sellers
  if (database) {
    try {
      const snap = await get(ref(database, "users"));
      if (snap.exists()) {
        const val = snap.val();
        if (val && typeof val === "object") {
          Object.keys(val).forEach((k) => {
            addUser(val[k], k);
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fetch all users from Firebase RTDB:", err);
    }
  }

  // 5. Also check active user in local storage
  if (typeof window !== "undefined") {
    try {
      const rawActive = localStorage.getItem("must_active_user");
      if (rawActive) {
        const parsed = JSON.parse(rawActive);
        addUser(parsed);
      }
    } catch {}
  }

  // Return deduplicated array – use email or id as dedup key (Map already deduped by key)
  const seen = new Set<string>();
  const uniqueUsers: User[] = [];
  for (const u of usersMap.values()) {
    const key = u.email || u.id;
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueUsers.push(u);
    }
  }
  return uniqueUsers;
}

export async function sendAdminBroadcast(
  title: string,
  message: string,
  priority: "URGENT" | "NORMAL" | "INFO" = "NORMAL"
) {
  const timestamp = Date.now();
  const cleanTitle = (title || "").trim();
  const cleanMessage = (message || "").trim();
  const broadcastEntry = { title: cleanTitle, message: cleanMessage, priority, timestamp, sentBy: "Admin" };

  // 1. Save to shared localStorage so ALL users see it on next load
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("must_admin_broadcasts");
      const existing: typeof broadcastEntry[] = raw ? JSON.parse(raw) : [];

      // Avoid double-dispatch of identical broadcast within 30 seconds
      const isRecentDuplicate = existing.some(
        (b) =>
          b.title.toLowerCase().trim() === cleanTitle.toLowerCase() &&
          b.message.toLowerCase().trim() === cleanMessage.toLowerCase() &&
          Math.abs(timestamp - b.timestamp) < 30 * 1000
      );

      if (!isRecentDuplicate) {
        existing.unshift(broadcastEntry);
        // Keep only last 50 broadcasts
        localStorage.setItem("must_admin_broadcasts", JSON.stringify(existing.slice(0, 50)));
      }
    } catch {}
  }

  // 2. Notify all real Firebase users (if connected)
  if (database) {
    try {
      const users = await fetchAllUsers();
      await Promise.all(
        users.map((u) =>
          createNotification(u.id, {
            title: `📢 ${title}`,
            message,
            type: "system",
            priority,
          })
        )
      );
      // Log broadcast to Firebase
      const bRef = push(ref(database, "admin_broadcasts"));
      await set(bRef, broadcastEntry);
    } catch (err) {
      console.warn("Firebase broadcast failed (local delivery still succeeded):", err);
    }
  }
}
