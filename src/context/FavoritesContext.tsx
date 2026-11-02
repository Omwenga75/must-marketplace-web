"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "./AuthContext";
import { getUserFavorites, toggleFavorite } from "@/lib/firebase/services";
import { database } from "@/lib/firebase/config";
import { ref, onValue } from "firebase/database";

interface FavoritesContextType {
  favoriteIds: Set<string>;
  toggle: (productId: string) => Promise<boolean>;
  isFavorite: (productId: string) => boolean;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rawFavoriteIds, setRawFavoriteIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const activeUid = localStorage.getItem("must_active_uid");
        if (activeUid) {
          const cached = localStorage.getItem(`must_fav_${activeUid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return new Set(parsed);
          }
        }
      } catch {}
    }
    return new Set();
  });
  const [soldProductIds, setSoldProductIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 1. Real-time Firebase listener on favorites for active account across all devices
  useEffect(() => {
    if (!user?.id) {
      setRawFavoriteIds(new Set());
      return;
    }

    // Read local cache immediately for instant heart render without remote delay
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`must_fav_${user.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRawFavoriteIds(new Set(parsed));
          }
        }
      } catch {}
    }

    if (!database) return;

    setLoading(true);
    const favRef = ref(database, `favorites/${user.id}`);
    const unsubscribe = onValue(
      favRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          if (val && typeof val === "object") {
            const ids = Object.keys(val).filter((k) => Boolean(val[k]));
            setRawFavoriteIds(new Set(ids));
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(`must_fav_${user.id}`, JSON.stringify(ids));
              } catch {}
            }
          } else {
            setRawFavoriteIds(new Set());
          }
        } else {
          setRawFavoriteIds(new Set());
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Favorites RTDB listener error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  // 2. Real-time Firebase listener on products to track SOLD items
  useEffect(() => {
    if (!database) return;
    try {
      const prodsRef = ref(database, "products");
      const unsubscribe = onValue(prodsRef, (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === "object") {
          const soldIds = new Set<string>();
          Object.entries(val).forEach(([id, item]: [string, any]) => {
            const status = (item?.status || "ACTIVE").toUpperCase();
            if (status === "SOLD") {
              soldIds.add(item?.id || id);
            }
          });
          setSoldProductIds(soldIds);
        }
      });
      return () => unsubscribe();
    } catch {}
  }, []);

  // Filter out SOLD products: counts and saves automatically drop when an item is sold
  const favoriteIds = useMemo(() => {
    const active = new Set<string>();
    rawFavoriteIds.forEach((id) => {
      if (!soldProductIds.has(id)) {
        active.add(id);
      }
    });
    return active;
  }, [rawFavoriteIds, soldProductIds]);

  // Synchronize across open tabs for the SAME active user
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCustomEvent = (e: any) => {
      const { productId, isFavorited } = e?.detail || {};
      if (productId) {
        setRawFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isFavorited) next.add(productId);
          else next.delete(productId);
          return next;
        });
      }
    };

    window.addEventListener("must_favorites_updated", handleCustomEvent);
    return () => {
      window.removeEventListener("must_favorites_updated", handleCustomEvent);
    };
  }, []);

  // In-flight mutex lock so rapid taps or multi-card clicks cannot fire concurrent writes
  const inFlightRef = useRef<Set<string>>(new Set());

  const toggle = async (productId: string): Promise<boolean> => {
    if (!user?.id || !productId) return false;

    // Block concurrent toggle on the same product
    if (inFlightRef.current.has(productId)) {
      return favoriteIds.has(productId);
    }
    inFlightRef.current.add(productId);

    const isCurrentlyFav = favoriteIds.has(productId);
    const nextIsFav = !isCurrentlyFav;

    // Optimistic UI update
    setRawFavoriteIds((prev) => {
      const next = new Set(prev);
      if (nextIsFav) next.add(productId);
      else next.delete(productId);
      return next;
    });

    // Write to local cache immediately
    if (typeof window !== "undefined") {
      try {
        const updatedIds = Array.from(
          nextIsFav
            ? new Set([...rawFavoriteIds, productId])
            : new Set([...rawFavoriteIds].filter((id) => id !== productId))
        );
        localStorage.setItem(`must_fav_${user.id}`, JSON.stringify(updatedIds));
      } catch {}
    }

    try {
      const result = await toggleFavorite(productId, user.id, nextIsFav);
      // Synchronize exact state with authoritative result
      setRawFavoriteIds((prev) => {
        const next = new Set(prev);
        if (result) next.add(productId);
        else next.delete(productId);
        return next;
      });
      return result;
    } catch (e) {
      console.error("Favorite toggle failed:", e);
      // In case of error, still keep the optimistic state unless explicitly reverting
      return nextIsFav;
    } finally {
      inFlightRef.current.delete(productId);
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
