"use client";

import React, { useState, useEffect } from "react";
import { Product } from "@/types";
import { fetchProducts } from "@/lib/firebase/services";
import { database } from "@/lib/firebase/config";
import { ref, onValue } from "firebase/database";
import { useFavorites } from "@/context/FavoritesContext";
import ProductGrid from "@/components/products/ProductGrid";

export default function SavedItemsPage() {
  const { favoriteIds } = useFavorites();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setAllProducts(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    // Real-time listener for updates and status changes
    let unsubDb: (() => void) | null = null;
    if (database) {
      try {
        const prodsRef = ref(database, "products");
        unsubDb = onValue(prodsRef, (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === "object") {
            const list: Product[] = Object.entries(val).map(([k, v]: [string, any]) => ({
              ...v,
              id: v.id || k,
              likes: typeof v.likes === "number" ? v.likes : (Number(v.likes) || 0),
              views: typeof v.views === "number" ? v.views : (Number(v.views) || 0),
            }));
            setAllProducts(list);
            setLoading(false);
          }
        });
      } catch (e) {
        console.warn("Saved page RTDB error:", e);
      }
    }

    const handleProductDeletedEvent = (pid: string) => {
      if (pid) setAllProducts((prev) => prev.filter((p) => p.id !== pid));
    };

    const onProductDeleted = (e: any) => {
      handleProductDeletedEvent(e.detail?.productId);
    };

    window.addEventListener("must_product_deleted", onProductDeleted);

    // Cross-tab BroadcastChannel
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("must_marketplace_products_sync");
      bc.onmessage = (event) => {
        if (event.data?.type === "DELETE" && event.data?.productId) {
          handleProductDeletedEvent(event.data.productId);
        }
      };
    }

    // Cross-window storage event
    const onStorage = (e: StorageEvent) => {
      if (e.key === "must_last_deleted_product_sync" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.productId) handleProductDeletedEvent(parsed.productId);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      if (unsubDb) unsubDb();
      window.removeEventListener("must_product_deleted", onProductDeleted);
      window.removeEventListener("storage", onStorage);
      if (bc) bc.close();
    };
  }, []);

  const savedProducts = allProducts.filter(
    (p) => favoriteIds.has(p.id) && (p.status || "ACTIVE").toUpperCase() !== "SOLD"
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3 pb-6 sm:pb-10 space-y-4 sm:space-y-5">
      {/* Header with Item Count */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 sm:pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Saved Items
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              {savedProducts.length} {savedProducts.length === 1 ? "Item" : "Items"}
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <ProductGrid
        products={savedProducts}
        loading={loading}
        emptyTitle="No saved items yet"
        emptyMessage="Tap the heart icon on any listing to bookmark items you're interested in buying."
      />
    </div>
  );
}
