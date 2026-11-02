"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
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
  const [rawFavoriteIds, setRawFavoriteIds] = useState<Set<string>>(new Set());
  const [soldProductIds, setSoldProductIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 1. Real-time Firebase listener on favorites for active account across all devices
  useEffect(() => {
    if (!database || !user?.id) {
      setRawFavoriteIds(new Set());
      return;
    }

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

  const toggle = async (productId: string): Promise<boolean> => {
    if (!user?.id) return false;

    const isCurrentlyFav = favoriteIds.has(productId);
    const nextIsFav = !isCurrentlyFav;

    // Optimistic UI update
    setRawFavoriteIds((prev) => {
      const next = new Set(prev);
      if (nextIsFav) next.add(productId);
      else next.delete(productId);
      return next;
    });

    try {
      const result = await toggleFavorite(productId, user.id);
      if (result !== nextIsFav) {
        // Revert if remote result differed
        setRawFavoriteIds((prev) => {
          const next = new Set(prev);
          if (result) next.add(productId);
          else next.delete(productId);
          return next;
        });
      }
      return result;
    } catch (e) {
      console.error("Favorite toggle failed:", e);
      // Revert optimistic update
      setRawFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyFav) next.add(productId);
        else next.delete(productId);
        return next;
      });
      return isCurrentlyFav;
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
