"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  SlidersHorizontal,
  X,
  MapPin,
  ArrowUpDown,
  Tag,
  Check,
  RefreshCw,
} from "lucide-react";
import { Product, ProductCondition } from "@/types";
import { SAMPLE_CATEGORIES, UNIVERSITY_LOCATIONS } from "@/lib/constants";
import { fetchProducts } from "@/lib/firebase/services";
import ProductGrid from "@/components/products/ProductGrid";

function MarketplaceContent() {
  const searchParams = useSearchParams();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "all"
  );
  const [selectedCondition, setSelectedCondition] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "price_asc" | "price_desc" | "views"
  >("newest");

  // Mobile filters drawer
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Update query when URL params change
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearchQuery(q);
    const cat = searchParams.get("category");
    if (cat) setSelectedCategory(cat);
  }, [searchParams]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = product.title.toLowerCase().includes(q);
          const matchDesc = product.description.toLowerCase().includes(q);
          const matchCategory = product.category?.name.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchCategory) return false;
        }

        // Category
        if (selectedCategory !== "all" && product.category?.id !== selectedCategory) {
          return false;
        }

        // Condition
        if (selectedCondition !== "all" && product.condition !== selectedCondition) {
          return false;
        }

        // Location
        if (selectedLocation !== "all" && product.location !== selectedLocation) {
          return false;
        }

        // Max price
        if (maxPrice && !isNaN(Number(maxPrice))) {
          if (product.price > Number(maxPrice)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "price_asc") {
          return a.price - b.price;
        }
        if (sortBy === "price_desc") {
          return b.price - a.price;
        }
        if (sortBy === "views") {
          return b.views - a.views;
        }
        return 0;
      });
  }, [
    products,
    searchQuery,
    selectedCategory,
    selectedCondition,
    selectedLocation,
    maxPrice,
    sortBy,
  ]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedCondition("all");
    setSelectedLocation("all");
    setMaxPrice("");
    setSortBy("newest");
  };

  const hasActiveFilters =
    searchQuery !== "" ||
    selectedCategory !== "all" ||
    selectedCondition !== "all" ||
    selectedLocation !== "all" ||
    maxPrice !== "";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Filters, Sort & Categories in a Single Consistent Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none pt-1">
        {/* Filter Card Pill */}
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            hasActiveFilters
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          }`}
        >
          <Filter className={`w-3.5 h-3.5 ${hasActiveFilters ? "text-white" : "text-emerald-600"}`} />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5" />
          )}
        </button>

        {/* Sort Card Pill */}
        <div className="relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-slate-700 dark:text-slate-300 font-bold focus:outline-none cursor-pointer pr-1 text-xs"
          >
            <option value="newest" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Sort: Newest</option>
            <option value="price_asc" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Price: Low to High</option>
            <option value="price_desc" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Price: High to Low</option>
            <option value="views" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Most Viewed</option>
            <option value="oldest" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Oldest</option>
          </select>
        </div>

        {/* Vertical Divider */}
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-1" />

        {/* All Items Pill */}
        <button
          onClick={() => setSelectedCategory("all")}
          className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            selectedCategory === "all"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          }`}
        >
          All Items
        </button>

        {/* Category Pills */}
        {SAMPLE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === cat.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs">
          <span className="font-bold text-emerald-800 dark:text-emerald-300">
            Active filters:
          </span>

          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold shadow-xs">
              Search: "{searchQuery}"
              <X
                className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600"
                onClick={() => setSearchQuery("")}
              />
            </span>
          )}

          {selectedCategory !== "all" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold shadow-xs">
              Category:{" "}
              {SAMPLE_CATEGORIES.find((c) => c.id === selectedCategory)?.name}
              <X
                className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600"
                onClick={() => setSelectedCategory("all")}
              />
            </span>
          )}

          {selectedCondition !== "all" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold shadow-xs">
              Condition: {selectedCondition === "NEW" ? "New" : "Second Hand"}
              <X
                className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600"
                onClick={() => setSelectedCondition("all")}
              />
            </span>
          )}

          {selectedLocation !== "all" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold shadow-xs">
              Location: {selectedLocation}
              <X
                className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600"
                onClick={() => setSelectedLocation("all")}
              />
            </span>
          )}

          {maxPrice && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold shadow-xs">
              Max: KSh {Number(maxPrice).toLocaleString()}
              <X
                className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600"
                onClick={() => setMaxPrice("")}
              />
            </span>
          )}

          <button
            onClick={resetAllFilters}
            className="ml-auto text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Product Grid Area - Full Width */}
      <main className="w-full">
        <ProductGrid
          products={filteredProducts}
          loading={loading}
          onResetFilters={resetAllFilters}
        />
      </main>

      {/* Filters Modal / Drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto p-5 sm:p-6 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
                <span>Filter Marketplace</span>
              </h3>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Keyword in modal */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Keyword Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by title or keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Condition in modal */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Condition
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "NEW", label: "New" },
                  { value: "SECOND_HAND", label: "Used" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setSelectedCondition(item.value)}
                    className={`p-2 rounded-xl text-xs font-bold text-center border ${
                      selectedCondition === item.value
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location in mobile modal */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Campus Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full text-sm font-medium p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Locations</option>
                {UNIVERSITY_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Max Budget in mobile modal */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Max Price (KSh)
              </label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full p-3 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                onClick={resetAllFilters}
                className="py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Reset Filters
              </button>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md"
              >
                Show {filteredProducts.length} Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Loading marketplace...</div>}>
      <MarketplaceContent />
    </Suspense>
  );
}
