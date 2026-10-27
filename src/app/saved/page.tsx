"use client";

import React, { useState, useEffect } from "react";
import { Product } from "@/types";
import { fetchProducts } from "@/lib/firebase/services";
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
  }, []);

  const savedProducts = allProducts.filter((p) => favoriteIds.has(p.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* Header with Item Count */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Saved Items
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              {savedProducts.length} {savedProducts.length === 1 ? "Item" : "Items"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Comrade listings you've liked and saved across campus.
          </p>
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
