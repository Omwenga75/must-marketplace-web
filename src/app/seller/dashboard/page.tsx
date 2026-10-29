"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  PlusCircle,
  Eye,
  Heart,
  Package,
  CheckCircle2,
  Trash2,
  Edit,
  ExternalLink,
  AlertCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Product } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { fetchProducts, updateProduct, deleteProduct } from "@/lib/firebase/services";
import { formatPrice, formatRelativeTime } from "@/lib/utils";

export default function SellerDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"ACTIVE" | "SOLD" | "ALL">("ACTIVE");

  useEffect(() => {
    if (!user) return;
    fetchProducts()
      .then((all) => {
        // Find products belonging to this seller or demo seller
        const myListings = all.filter(
          (p) => p.sellerId === user.id || p.sellerName === user.fullName || user.id === "demo_seller_456"
        );
        setProducts(myListings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user) {
    if (authLoading) {
      return (
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4 animate-pulse">
          <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 mx-auto" />
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-40 mx-auto" />
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-56 mx-auto" />
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <Store className="w-12 h-12 text-secondary mx-auto" />
        <h2 className="text-xl font-bold">Sign In Required</h2>
        <Link href="/login" className="inline-block px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm">
          Sign In
        </Link>
      </div>
    );
  }

  const activeCount = products.filter((p) => p.status === "ACTIVE").length;
  const soldCount = products.filter((p) => p.status === "SOLD").length;
  const totalViews = products.reduce((acc, p) => acc + (p.views || 0), 0);
  const totalLikes = products.reduce((acc, p) => acc + (p.likes || 0), 0);

  const displayedListings = products.filter((p) => {
    if (filterTab === "ALL") return true;
    return p.status === filterTab;
  });

  const handleMarkAsSold = async (productId: string) => {
    await updateProduct(productId, { status: "SOLD" });
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, status: "SOLD" } : p))
    );
  };

  const handleMarkAsActive = async (productId: string) => {
    await updateProduct(productId, { status: "ACTIVE" });
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, status: "ACTIVE" } : p))
    );
  };

  const handleDeleteListing = async (productId: string) => {
    if (confirm("Are you sure you want to permanently delete this listing?")) {
      await deleteProduct(productId, user.id);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
              Verified
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your campus listings and monitor student engagement
          </p>
        </div>

        <Link
          href="/seller/products/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-secondary hover:bg-secondary-dark text-white font-bold text-sm shadow-md transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Post New Ad</span>
        </Link>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Listings */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Active Ads</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {activeCount}
          </p>
          <p className="text-[11px] text-slate-500">Live in marketplace</p>
        </div>

        {/* Total Views */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Views</span>
            <Eye className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {totalViews}
          </p>
          <p className="text-[11px] text-slate-500">Student impressions</p>
        </div>

        {/* Favorites / Likes */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Bookmarks</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {totalLikes}
          </p>
          <p className="text-[11px] text-slate-500">Comrades interested</p>
        </div>

        {/* Sold Items */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Items Sold</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {soldCount}
          </p>
          <p className="text-[11px] text-slate-500">Completed deals</p>
        </div>
      </div>

      {/* Listings Section */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {(["ACTIVE", "SOLD", "ALL"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                filterTab === tab
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab === "ACTIVE"
                ? `Active Listings (${activeCount})`
                : tab === "SOLD"
                ? `Sold (${soldCount})`
                : `All Items (${products.length})`}
            </button>
          ))}
        </div>

        {/* Listings List / Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : displayedListings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
            <Package className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              No listings in this tab
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Ready to post something? Tap the button below to reach students on campus.
            </p>
            <Link
              href="/seller/products/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Post Your First Ad</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedListings.map((prod) => (
              <div
                key={prod.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={prod.imageUrls[0]}
                    alt={prod.title}
                    className="w-16 h-16 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {prod.title}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          prod.status === "SOLD"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {prod.status}
                      </span>
                    </div>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatPrice(prod.price)}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>{prod.location}</span>
                      <span>•</span>
                      <span>{prod.views} views</span>
                      <span>•</span>
                      <span>{prod.likes} saves</span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 text-xs font-semibold">
                  <Link
                    href={`/product/${prod.id}`}
                    target="_blank"
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    title="View live page"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>

                  {prod.status === "ACTIVE" ? (
                    <button
                      onClick={() => handleMarkAsSold(prod.id)}
                      className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                    >
                      Mark as Sold
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMarkAsActive(prod.id)}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                    >
                      Mark as Active
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteListing(prod.id)}
                    className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500"
                    title="Delete ad"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
