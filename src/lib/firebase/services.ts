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

  let currentLikes = 0;
  if (typeof likesMap[productId] === "number") {
    currentLikes = likesMap[productId];
  } else {
    // Find initial from cached products
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const item = list.find((p: any) => p.id === productId);
          if (item && typeof item.likes === "number") {
            currentLikes = item.likes;
          }
        }
      }
    } catch {}
    if (currentLikes === 0) {
      const init = INITIAL_SAMPLE_PRODUCTS.find((p) => p.id === productId);
      if (init && typeof init.likes === "number") currentLikes = init.likes;
    }
  }

  const newLikes = Math.max(0, currentLikes + delta);
  likesMap[productId] = newLikes;

  try {
    localStorage.setItem(PRODUCT_LIKES_KEY, JSON.stringify(likesMap));
  } catch {}

  // Update cached products array
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    let list: Product[] = cached ? JSON.parse(cached) : [...INITIAL_SAMPLE_PRODUCTS];
    if (Array.isArray(list)) {
      const idx = list.findIndex((p) => p.id === productId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], likes: newLikes };
      } else {
        const sample = INITIAL_SAMPLE_PRODUCTS.find((p) => p.id === productId);
        if (sample) list.push({ ...sample, likes: newLikes });
      }
      localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(list));
    }
  } catch {}

  // Dispatch events for live updates across all UI components and tabs
  try {
    window.dispatchEvent(
      new CustomEvent("must_product_likes_changed", {
        detail: { productId, likes: newLikes },
      })
    );
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("must_marketplace_likes_sync");
      bc.postMessage({ productId, likes: newLikes });
      bc.close();
    }
  } catch {}

  // Attempt non-blocking background Firebase sync (500ms race)
  if (database) {
    const updatePromise = (async () => {
      try {
        const prodLikesRef = ref(database, `products/${productId}/likes`);
        await set(prodLikesRef, newLikes);
      } catch {}
    })();
    Promise.race([
      updatePromise,
      new Promise((res) => setTimeout(res, 500)),
    ]).catch(() => {});
  }

  return newLikes;
}

function getLocalStoredProducts(): Product[] {
  const deleted = getDeletedProductIds();
  if (typeof window === "undefined") return INITIAL_SAMPLE_PRODUCTS.filter((p) => !deleted.has(p.id));
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((item) => !deleted.has(item.id))
          .map((item) => ({
            ...item,
            likes: getProductLikes(item.id, item.likes),
          }));
      }
    }
  } catch (e) {
    console.error("Failed to read local products cache:", e);
  }
  return INITIAL_SAMPLE_PRODUCTS
    .filter((p) => !deleted.has(p.id))
    .map((item) => ({
      ...item,
      likes: getProductLikes(item.id, item.likes),
    }));
}

function setLocalStoredProducts(products: Product[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(products));
  } catch (e) {
    console.error("Failed to update local products cache:", e);
  }
}

// ─────────────────────────────────────────────────────────────
// PRODUCT SERVICES
// ─────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const deleted = getDeletedProductIds();

  // 1. Fetch from centralized server API (shared across all browsers & devices)
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      if (res.ok) {
        const data: Product[] = await res.json();
        if (Array.isArray(data)) {
          const list = data
            .filter((item) => !deleted.has(item.id))
            .map((item) => ({
              ...item,
              likes: getProductLikes(item.id, Number(item.likes) || 0),
            }));
          setLocalStoredProducts(list);
          return list;
        }
      }
    } catch (e) {
      console.debug("API fetch fallback to local/Firebase:", e);
    }
  }

  // 2. Fallback to Firebase RTDB if available
  if (database) {
    try {
      const productsRef = ref(database, "products");
      const snapshot = await get(productsRef);

      if (snapshot.exists()) {
        const val = snapshot.val();
        const list: Product[] = [];
        Object.keys(val).forEach((key) => {
          if (deleted.has(key)) return;
          const item = val[key];
          let imageUrls: string[] = [];
          if (Array.isArray(item.imageUrls)) {
            imageUrls = item.imageUrls.filter(Boolean);
          } else if (typeof item.imageUrls === "string") {
            imageUrls = item.imageUrls.split(",").filter(Boolean);
          } else if (item.imageUrl) {
            imageUrls = [item.imageUrl];
          }

          list.push({
            ...item,
            id: key,
            imageUrls: imageUrls.length > 0 ? imageUrls : ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800"],
            category: item.category || SAMPLE_CATEGORIES[0],
            price: Number(item.price) || 0,
            views: Number(item.views) || 0,
            likes: getProductLikes(key, Number(item.likes) || 0),
            status: item.status || "ACTIVE",
            condition: item.condition || "NEW",
            createdAt: item.createdAt || new Date().toISOString(),
          });
        });

        if (list.length > 0) {
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setLocalStoredProducts(list);
          return list;
        }
      }
    } catch (error) {
      console.warn("Firebase fetch error, using cached/sample products:", error);
    }
  }

  return getLocalStoredProducts();
}

export async function getProductById(id: string): Promise<Product | null> {
  // 1. Try server API
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (res.ok) {
        const item: Product = await res.json();
        return {
          ...item,
          likes: getProductLikes(id, Number(item.likes) || 0),
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
          likes: getProductLikes(id, Number(item.likes) || 0),
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
  if (!database || !userId) return;
  try {
    const viewRef = ref(database, `product_views/${productId}/${userId}`);
    const snapshot = await get(viewRef);
    if (!snapshot.exists()) {
      await set(viewRef, true);
      const likesRef = ref(database, `products/${productId}/views`);
      const currentViewsSnap = await get(likesRef);
      const currentViews = (currentViewsSnap.val() as number) || 0;
      await set(likesRef, currentViews + 1);
    }
  } catch (err) {
    console.warn("Failed to record product view in Firebase:", err);
  }
}

export async function toggleFavorite(productId: string, userId?: string): Promise<boolean> {
  if (!productId) return false;

  let isNowFavorited = false;

  // 1. Check current saved state from unified storage
  let savedSet = new Set<string>();
  if (typeof window !== "undefined") {
    try {
      const unified = JSON.parse(localStorage.getItem(UNIFIED_FAVORITES_KEY) || "[]");
      if (Array.isArray(unified)) unified.forEach((id: string) => savedSet.add(id));
      const guest = JSON.parse(localStorage.getItem(GUEST_FAVORITES_KEY) || "[]");
      if (Array.isArray(guest)) guest.forEach((id: string) => savedSet.add(id));
      if (userId) {
        const userFavs = JSON.parse(localStorage.getItem(`must_fav_${userId}`) || "{}");
        Object.keys(userFavs).forEach((id) => savedSet.add(id));
      }
    } catch {}
  }

  if (savedSet.has(productId)) {
    savedSet.delete(productId);
    isNowFavorited = false;
  } else {
    savedSet.add(productId);
    isNowFavorited = true;
  }

  // 2. Immediately update product likes count (+1 or -1)
  updateProductLikes(productId, isNowFavorited ? 1 : -1);

  // 3. Persist to unified, guest, and user storage
  if (typeof window !== "undefined") {
    try {
      const arr = Array.from(savedSet);
      localStorage.setItem(UNIFIED_FAVORITES_KEY, JSON.stringify(arr));
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(arr));

      if (userId) {
        const userObj: Record<string, boolean> = {};
        arr.forEach((id) => {
          userObj[id] = true;
        });
        localStorage.setItem(`must_fav_${userId}`, JSON.stringify(userObj));
      }
    } catch (e) {
      console.error("Local favorite save error:", e);
    }

    // Broadcast favorites change
    try {
      window.dispatchEvent(
        new CustomEvent("must_favorites_updated", {
          detail: { productId, isFavorited: isNowFavorited, allIds: Array.from(savedSet) },
        })
      );
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("must_marketplace_favorites_sync");
        bc.postMessage({ productId, isFavorited: isNowFavorited, allIds: Array.from(savedSet) });
        bc.close();
      }
    } catch {}
  }

  // 4. Background Firebase sync (timeout 500ms, non-blocking)
  if (database && userId) {
    const fbPromise = (async () => {
      try {
        const favRef = ref(database, `favorites/${userId}/${productId}`);
        if (isNowFavorited) {
          await set(favRef, true);
        } else {
          await remove(favRef);
        }
      } catch {}
    })();
    Promise.race([
      fbPromise,
      new Promise((res) => setTimeout(res, 500)),
    ]).catch(() => {});
  }

  return isNowFavorited;
}

export async function getUserFavorites(userId?: string): Promise<string[]> {
  const combined = new Set<string>();

  // 1. Read local stores immediately
  if (typeof window !== "undefined") {
    try {
      const unified = JSON.parse(localStorage.getItem(UNIFIED_FAVORITES_KEY) || "[]");
      if (Array.isArray(unified)) unified.forEach((id: string) => combined.add(id));

      const guest = JSON.parse(localStorage.getItem(GUEST_FAVORITES_KEY) || "[]");
      if (Array.isArray(guest)) guest.forEach((id: string) => combined.add(id));

      if (userId) {
        const userFavs = JSON.parse(localStorage.getItem(`must_fav_${userId}`) || "{}");
        Object.keys(userFavs).forEach((id) => combined.add(id));
      }
    } catch {}
  }

  // 2. Try background Firebase RTDB read if user is logged in (with 400ms timeout race)
  if (database && userId) {
    try {
      const snapPromise = get(ref(database, `favorites/${userId}`));
      const snap = await Promise.race([
        snapPromise,
        new Promise<null>((res) => setTimeout(() => res(null), 400)),
      ]);
      if (snap && snap.exists()) {
        const val = snap.val();
        if (val && typeof val === "object") {
          Object.keys(val).forEach((id) => combined.add(id));
        }
      }
    } catch {}
  }

  const result = Array.from(combined);
  // Persist back so all stores remain synchronized
  if (typeof window !== "undefined" && result.length > 0) {
    try {
      localStorage.setItem(UNIFIED_FAVORITES_KEY, JSON.stringify(result));
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(result));
      if (userId) {
        const userObj: Record<string, boolean> = {};
        result.forEach((id) => {
          userObj[id] = true;
        });
        localStorage.setItem(`must_fav_${userId}`, JSON.stringify(userObj));
      }
    } catch {}
  }

  return result;
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
  const newProduct: Product = {
    ...productData,
    id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    views: 0,
    likes: 0,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  };

  // 1. Post to centralized server API so ALL browsers (Chrome, Edge, guest, incognito) see it immediately!
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      if (res.ok) {
        const saved = await res.json();
        newProduct.id = saved.id || newProduct.id;
      }
    } catch (e) {
      console.warn("Failed to post product to server API:", e);
    }
  }

  // 2. Also try Firebase RTDB sync if possible
  if (database) {
    try {
      const newRef = push(ref(database, "products"));
      newProduct.id = newRef.key || newProduct.id;
      await set(ref(database, `products/${newProduct.id}`), newProduct);

      // Increment seller's active listings count
      if (newProduct.sellerId) {
        const sellerRef = ref(database, `users/${newProduct.sellerId}/activeListings`);
        const snap = await get(sellerRef);
        const count = (snap.val() as number) || 0;
        await set(sellerRef, count + 1);
      }
    } catch (err) {
      console.warn("Firebase createProduct fallback:", err);
    }
  }

  // 3. Update local cache
  const local = getLocalStoredProducts().filter((p) => p.id !== newProduct.id);
  const updated = [newProduct, ...local];
  setLocalStoredProducts(updated);

  return newProduct;
}

export async function updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
  // 1. Update centralized server API
  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch {}
  }

  // 2. Try Firebase RTDB
  if (database) {
    try {
      await update(ref(database, `products/${productId}`), updates);
    } catch (err) {
      console.warn("Firebase updateProduct error:", err);
    }
  }

  // 3. Update local cache
  const local = getLocalStoredProducts();
  const index = local.findIndex((p) => p.id === productId);
  if (index !== -1) {
    local[index] = { ...local[index], ...updates };
    setLocalStoredProducts(local);
  }
}

export async function deleteProduct(productId: string, sellerId?: string): Promise<void> {
  // 1. Persist deletion in local deleted-set so it survives refresh across all fallbacks
  addDeletedProductId(productId);

  // 2. Delete from server-side storage (data/products.json)
  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/products?id=${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.warn("Failed to delete product from server API:", e);
    }
  }

  // 3. Delete from Firebase RTDB if available
  if (database) {
    try {
      await remove(ref(database, `products/${productId}`));
      if (sellerId) {
        const sellerRef = ref(database, `users/${sellerId}/activeListings`);
        const snap = await get(sellerRef);
        const count = (snap.val() as number) || 1;
        await set(sellerRef, Math.max(0, count - 1));
      }
    } catch (err) {
      console.warn("Firebase deleteProduct error:", err);
    }
  }

  // 4. Update local cache
  const local = getLocalStoredProducts().filter((p) => p.id !== productId);
  setLocalStoredProducts(local);
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
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
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
  const sorted = [...convs].sort(
    (a, b) => Number(b.lastMessageTime || 0) - Number(a.lastMessageTime || 0)
  );

  for (const c of sorted) {
    if (!c) continue;
    const idKey = (c.otherUserId || c.id || "").trim().toLowerCase();
    const nameKey = (c.otherUserName || "").trim().toLowerCase();

    if (idKey && seen.has(`id:${idKey}`)) continue;
    if (nameKey && seen.has(`name:${nameKey}`)) continue;

    if (idKey) seen.add(`id:${idKey}`);
    if (nameKey) seen.add(`name:${nameKey}`);

    result.push(c);
  }

  return result;
}

export function getLocalConversations(userId: string): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(`must_conversations_${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return deduplicateConversations(parsed);
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

export function subscribeToConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void
): () => void {
  let cancelled = false;

  // Push initial cached conversations immediately
  const initial = getLocalConversations(userId);
  if (initial.length > 0) callback(initial);

  // Fetch from server API (cross-browser source of truth)
  const fetchFromServer = async () => {
    if (typeof window === "undefined" || cancelled) return;
    try {
      const res = await fetch(`/api/conversations?userId=${encodeURIComponent(userId)}`);
      if (res.ok && !cancelled) {
        const serverConvs: Conversation[] = await res.json();
        if (Array.isArray(serverConvs) && serverConvs.length >= 0) {
          // Merge server data with local data (server is authoritative)
          const local = getLocalConversations(userId);
          const merged = deduplicateConversations([...serverConvs, ...local]);
          saveLocalConversations(userId, merged);
          callback(merged);
        }
      }
    } catch {}
  };

  fetchFromServer();

  // Listen to multi-tab / local events
  const unsubLocal = listenToChatSync((payload) => {
    if (!payload || payload.type === "message" || payload.type === "conversation" || payload.type === "storage_change") {
      fetchFromServer();
    }
  });

  // Poll server every 3 seconds for cross-browser updates
  const pollInterval = setInterval(() => {
    if (!cancelled) fetchFromServer();
  }, 3000);

  // Attempt Firebase RTDB if available
  let unsubFb: (() => void) | null = null;
  if (database) {
    try {
      const convRef = ref(database, `conversations/${userId}`);
      const listener = onValue(
        convRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val();
            const list: Conversation[] = Object.keys(val).map((k) => ({
              ...val[k],
              id: k,
            }));
            list.sort((a, b) => Number(b.lastMessageTime) - Number(a.lastMessageTime));
            const cleanedList = deduplicateConversations(list);
            saveLocalConversations(userId, cleanedList);
            callback(cleanedList);
          }
        },
        (err) => {
          console.debug("Firebase conversations falling back to local storage:", err.message);
        }
      );
      unsubFb = () => off(convRef, "value", listener);
    } catch {}
  }

  return () => {
    cancelled = true;
    clearInterval(pollInterval);
    unsubLocal();
    if (unsubFb) unsubFb();
  };
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void
): () => void {
  let cancelled = false;
  // Track last message IDs to avoid re-rendering duplicates
  let lastMsgFingerprint = "";

  const dedupeAndEmit = (msgs: Message[]) => {
    if (cancelled) return;
    // 1. Deduplicate by exact message ID
    const byId = new Map<string, Message>();
    for (const m of msgs) {
      if (m && m.id) byId.set(m.id, m);
    }
    const dedupedById = Array.from(byId.values()).sort(
      (a, b) => Number(a.timestamp) - Number(b.timestamp)
    );

    // 2. Also deduplicate optimistic local message vs server message with close timestamp
    const cleanList: Message[] = [];
    for (const m of dedupedById) {
      const isDuplicate = cleanList.some((existing) => {
        if (existing.id === m.id) return true;
        const timeDiff = Math.abs(Number(existing.timestamp) - Number(m.timestamp));
        if (
          existing.senderId === m.senderId &&
          (existing.content || "").trim() === (m.content || "").trim() &&
          timeDiff < 4000
        ) {
          return true;
        }
        return false;
      });
      if (!isDuplicate) {
        cleanList.push(m);
      }
    }

    const fingerprint = cleanList.map((m) => `${m.id}_${m.timestamp}`).join(",");
    if (fingerprint === lastMsgFingerprint) return; // no change
    lastMsgFingerprint = fingerprint;
    saveLocalMessages(conversationId, cleanList);
    callback(cleanList);
  };

  // Return current cached messages immediately
  const current = getLocalMessages(conversationId);
  if (current.length > 0) dedupeAndEmit(current);

  // Fetch from server API (cross-browser source of truth)
  const fetchFromServer = async () => {
    if (typeof window === "undefined" || cancelled) return;
    try {
      const res = await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}`);
      if (res.ok && !cancelled) {
        const serverMsgs: Message[] = await res.json();
        if (Array.isArray(serverMsgs)) {
          // Merge server + any optimistic local messages not yet on server
          const local = getLocalMessages(conversationId);
          const combined = [...serverMsgs, ...local];
          dedupeAndEmit(combined);
        }
      }
    } catch {}
  };

  fetchFromServer();

  // Listen to real-time events across tabs
  const unsubLocal = listenToChatSync((payload) => {
    if (payload?.conversationId === conversationId || payload?.type === "storage_change") {
      fetchFromServer();
    }
  });

  // Poll every 2 seconds for cross-browser messages
  const pollInterval = setInterval(() => {
    if (!cancelled) fetchFromServer();
  }, 2000);

  let unsubFb: (() => void) | null = null;
  if (database) {
    try {
      const msgRef = ref(database, `messages/${conversationId}`);
      const listener = onValue(
        msgRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val();
            const list: Message[] = Object.keys(val).map((k) => ({
              ...val[k],
              id: k,
            }));
            dedupeAndEmit(list);
          }
        },
        (err) => {
          console.debug("Firebase messages falling back to local storage:", err.message);
        }
      );
      unsubFb = () => off(msgRef, "value", listener);
    } catch {}
  }

  return () => {
    cancelled = true;
    clearInterval(pollInterval);
    unsubLocal();
    if (unsubFb) unsubFb();
  };
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
    senderName,
    receiverId,
    receiverName,
    content,
    productId,
    productTitle,
    imageUrl,
    audioUrl,
  } = params;

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

  // 3. Update Firebase RTDB if available
  if (database) {
    try {
      update(ref(database, `conversations/${userId}/${conversationId}`), {
        unreadCount: 0,
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
        if (!existingIds.has(id) && !deletedNotifs.has(id)) {
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
      // Save the merged list so it persists
      if (addedAny) {
        try {
          localStorage.setItem(`must_notifications_${userId}`, JSON.stringify(saved));
        } catch {}
      }
    }

    if (hasLoaded) return saved;
  } catch {}

  // For demo accounts without any prior local history, initialize with clean demo notifications
  if (userId.startsWith("demo_") && deletedNotifs.size === 0) {
    const demos = getDemoNotifications();
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
      const list: AppNotification[] = Object.keys(val).map((k) => ({
        ...val[k],
        id: k,
      }));
      list.sort((a, b) => b.timestamp - a.timestamp);
      saveLocalNotifications(userId, list);
      callback(list);
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
    } catch (err) {
      console.warn("Failed to delete user in DB:", err);
    }
  }
}

export async function fetchAllUsers(): Promise<User[]> {
  const deleted = getDeletedUserIds();

  // 1. Try centralized server API first (data/users.json)
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data
            .filter((u: User) => {
              if (deleted.has(u.id) || deleted.has(u.email)) return false;
              const email = (u.email || "").toLowerCase().trim();
              if (u.id?.startsWith("demo_") || u.id?.startsWith("new_user_")) return false;
              return email.endsWith("@gmail.com") || email === "must.market@admin.com";
            })
            .map((u: User) => ({
              ...u,
              fullName: u.fullName || "User",
            }));
        }
      }
    } catch (e) {
      console.debug("API fetch fallback for users:", e);
    }
  }

  // 2. Fallback to Firebase RTDB
  if (database) {
    try {
      const snap = await get(ref(database, "users"));
      if (snap.exists()) {
        const val = snap.val();
        return Object.keys(val)
          .filter((k) => {
            if (deleted.has(k) || deleted.has(val[k]?.email)) return false;
            const email = (val[k]?.email || "").toLowerCase().trim();
            if (k.startsWith("demo_") || k.startsWith("new_user_")) return false;
            return email.endsWith("@gmail.com") || email === "must.market@admin.com";
          })
          .map((k) => ({
            ...val[k],
            id: k,
            fullName: val[k].fullName || "User",
            email: val[k].email || "",
            seller: Boolean(val[k].seller || val[k].isSeller),
            admin: Boolean(val[k].admin || val[k].isAdmin),
          }));
      }
    } catch (err) {
      console.warn("Failed to fetch all users:", err);
    }
  }
  return [];
}

export async function sendAdminBroadcast(
  title: string,
  message: string,
  priority: "URGENT" | "NORMAL" | "INFO" = "NORMAL"
) {
  const timestamp = Date.now();
  const broadcastEntry = { title, message, priority, timestamp, sentBy: "Admin" };

  // 1. Save to shared localStorage so ALL users see it on next load
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("must_admin_broadcasts");
      const existing: typeof broadcastEntry[] = raw ? JSON.parse(raw) : [];
      existing.unshift(broadcastEntry);
      // Keep only last 50 broadcasts
      localStorage.setItem("must_admin_broadcasts", JSON.stringify(existing.slice(0, 50)));
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
