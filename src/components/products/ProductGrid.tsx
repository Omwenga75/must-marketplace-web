import React from "react";
import ProductCard from "./ProductCard";
import { Product } from "@/types";
import { PackageSearch } from "lucide-react";

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onResetFilters?: () => void;
  columns?: 4 | 5;
}

export default function ProductGrid({
  products,
  loading = false,
  emptyTitle = "No products found",
  emptyMessage = "We couldn't find any items matching your current filters. Try changing your search keywords or category.",
  onResetFilters,
  columns = 5,
}: ProductGridProps) {
  const gridClasses =
    columns === 4
      ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5"
      : "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-5";

  if (loading) {
    return (
      <div className={gridClasses}>
        {Array.from({ length: columns === 4 ? 4 : 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm animate-pulse"
          >
            <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800 w-full" />
            <div className="p-3.5 space-y-2.5">
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-8 sm:p-12 text-center max-w-xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-4">
          <PackageSearch className="w-7 h-7 text-secondary" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">
          {emptyTitle}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {emptyMessage}
        </p>
        {onResetFilters && (
          <button
            onClick={onResetFilters}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm"
          >
            Reset All Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={gridClasses}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
