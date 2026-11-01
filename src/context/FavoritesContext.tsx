"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getUserFavorites, toggleFavorite } from "@/lib/firebase/services";

interface FavoritesContextType {
  favoriteIds: Set<string>;
  toggle: (productId: string) => Promise<boolean>;
  isFavorite: (productId: string) => boolean;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

function getInitialLocalFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const set = new Set<string>();
  try {
    const unified = JSON.parse(localStorage.getItem("must_saved_product_ids") || "[]");
    if (Array.isArray(unified)) unified.forEach((id: string) => set.add(id));
    const guest = JSON.parse(localStorage.getItem("must_guest_favorites") || "[]");
    if (Array.isArray(guest)) guest.forEach((id: string) => set.add(id));
  } catch {}
  return set;
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Always start with an empty Set (matches server render) – populate after mount
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Hydrate from localStorage only after mount (avoids SSR/client mismatch)
  useEffect(() => {
    setMounted(true);
    const initial = getInitialLocalFavorites();
    if (initial.size > 0) {
      setFavoriteIds(initial);
    }
  }, []);

  // Sync favorites when user mounts or changes (e.g. login/logout)
  const refreshFavorites = useCallback(async () => {
    try {
      const ids = await getUserFavorites(user?.id);
      setFavoriteIds((prev) => {
        // Union with current to prevent losing anything
        const union = new Set(prev);
        ids.forEach((id) => union.add(id));
        return union;
      });
    } catch {
      // Ignore errors, preserve existing favorites
    }
  }, [user?.id]);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  // Synchronize across multiple browser tabs and windows
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCustomEvent = (e: any) => {
      if (e?.detail?.allIds && Array.isArray(e.detail.allIds)) {
        setFavoriteIds(new Set(e.detail.allIds));
      } else if (e?.detail?.productId && e?.detail?.isFavorited === false) {
        setFavoriteIds((prev) => {
          if (!prev.has(e.detail.productId)) return prev;
          const next = new Set(prev);
          next.delete(e.detail.productId);
          return next;
        });
      }
    };

    const handleProductDeletedEvent = (e: any) => {
      const pid = e?.detail?.productId;
      if (pid) {
        setFavoriteIds((prev) => {
          if (!prev.has(pid)) return prev;
          const next = new Set(prev);
          next.delete(pid);
          return next;
        });
      }
    };

    window.addEventListener("must_favorites_updated", handleCustomEvent);
    window.addEventListener("must_product_deleted", handleProductDeletedEvent);

    let bc: BroadcastChannel | null = null;
    let bcProd: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("must_marketplace_favorites_sync");
      bc.onmessage = (event) => {
        if (event?.data?.allIds && Array.isArray(event.data.allIds)) {
          setFavoriteIds(new Set(event.data.allIds));
        }
      };

      bcProd = new BroadcastChannel("must_marketplace_products_sync");
      bcProd.onmessage = (event) => {
        if (event.data?.type === "DELETE" && event.data?.productId) {
          const pid = event.data.productId;
          setFavoriteIds((prev) => {
            if (!prev.has(pid)) return prev;
            const next = new Set(prev);
            next.delete(pid);
            return next;
          });
        }
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "must_last_deleted_product_sync" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.productId) {
            setFavoriteIds((prev) => {
              if (!prev.has(parsed.productId)) return prev;
              const next = new Set(prev);
              next.delete(parsed.productId);
              return next;
            });
          }
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("must_favorites_updated", handleCustomEvent);
      window.removeEventListener("must_product_deleted", handleProductDeletedEvent);
      window.removeEventListener("storage", onStorage);
      if (bc) bc.close();
      if (bcProd) bcProd.close();
    };
  }, []);

  const toggle = async (productId: string): Promise<boolean> => {
    const isCurrentlyFav = favoriteIds.has(productId);
    const updated = new Set(favoriteIds);

    if (isCurrentlyFav) {
      updated.delete(productId);
    } else {
      updated.add(productId);
    }
    setFavoriteIds(updated);

    try {
      const result = await toggleFavorite(productId, user?.id);
      return result;
    } catch (e) {
      console.error("Favorite toggle failed:", e);
      return !isCurrentlyFav;
    }
  };

  const isFavorite = (productId: string) => favoriteIds.has(productId);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, toggle, isFavorite, loading }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
