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

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Strictly sync favorites for the CURRENT active user account (no cross-account leakage)
  const refreshFavorites = useCallback(async () => {
    if (!user?.id) {
      // If user is logged out, clear favorites completely!
      setFavoriteIds(new Set());
      return;
    }

    try {
      setLoading(true);
      // Fetch only this user's true favorites from Firebase
      const ids = await getUserFavorites(user.id);
      setFavoriteIds(new Set(ids));
    } catch (e) {
      console.warn("refreshFavorites error:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  // Synchronize across open tabs for the SAME active user
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCustomEvent = (e: any) => {
      const { productId, isFavorited } = e?.detail || {};
      if (productId) {
        setFavoriteIds((prev) => {
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
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (nextIsFav) next.add(productId);
      else next.delete(productId);
      return next;
    });

    try {
      const result = await toggleFavorite(productId, user.id);
      if (result !== nextIsFav) {
        // Revert if remote result differed
        setFavoriteIds((prev) => {
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
      setFavoriteIds((prev) => {
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
