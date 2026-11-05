import React from "react";
import ProductCard from "./ProductCard";
import { Product } from "@/types";
import { PackageSearch, X } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onResetFilters?: () => void;
  columns?: 4 | 5;
  /** On small screens, render cards in a horizontally-scrollable single row */
  scrollableOnMobile?: boolean;
}

export default function ProductGrid({
  products,
  loading = false,
  emptyTitle = "No products found",
  emptyMessage = "We couldn't find any items matching your current filters. Try changing your search keywords or category.",
  onResetFilters,
  columns = 5,
  scrollableOnMobile = false,
}: ProductGridProps) {
  // On sm+ always use the grid; on xs we switch to horizontal scroll when scrollableOnMobile=true
  const gridClasses =
    columns === 4
      ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5"
      : "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-5";

  // Mobile-scroll wrapper: hidden on sm+, shown on xs
  const mobileScrollClasses =
    "flex gap-3 overflow-x-auto pb-3 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0";

  if (loading) {
    const skeletonCard = (i: number) => (
      <div
        key={i}
        className="flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm animate-pulse"
      >
        <div className="aspect-square bg-slate-200 dark:bg-slate-800 w-full" />
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
    );
    const count = columns === 4 ? 4 : 8;
    if (scrollableOnMobile) {
      return (
        <div className="flex sm:grid overflow-x-auto sm:overflow-visible gap-3 sm:gap-5 pb-3 sm:pb-0 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="shrink-0 w-[185px] sm:shrink sm:w-auto">
              {skeletonCard(i)}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className={gridClasses}>
        {Array.from({ length: count }).map((_, i) => skeletonCard(i))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<PackageSearch className="w-8 h-8" />}
        title={emptyTitle}
        description={emptyMessage}
        action={
          onResetFilters ? (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
            >
              <X className="w-3.5 h-3.5" />
              Reset All Filters
            </button>
          ) : undefined
        }
      />
    );
  }

  if (scrollableOnMobile) {
    return (
      <div className="flex sm:grid overflow-x-auto sm:overflow-visible gap-3 sm:gap-5 pb-3 sm:pb-0 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {products.map((product) => (
          <div key={product.id} className="shrink-0 w-[185px] sm:shrink sm:w-auto">
            <ProductCard product={product} />
          </div>
        ))}
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
