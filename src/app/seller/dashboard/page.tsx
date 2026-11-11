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
  X,
  Save,
  Loader2,
} from "lucide-react";
import { Product } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { fetchProducts, updateProduct, deleteProduct, getLocalStoredProducts } from "@/lib/firebase/services";
import { database } from "@/lib/firebase/config";
import { ref, onValue } from "firebase/database";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import { SAMPLE_CATEGORIES, UNIVERSITY_LOCATIONS } from "@/lib/constants";
import EmptyState from "@/components/ui/EmptyState";

export default function SellerDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"ACTIVE" | "SOLD" | "ALL">("ACTIVE");

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    price: 0,
    description: "",
    location: "Main Gate",
    condition: "SECOND_HAND" as Product["condition"],
    categoryId: "1",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [cachedUser, setCachedUser] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("must_active_user");
      if (stored) setCachedUser(JSON.parse(stored));
    } catch {}
  }, []);

  const activeUser = user || cachedUser;

  useEffect(() => {
    // 0. Instantly load listings from local cache on mount/refresh (0ms latency!)
    let effective = user;
    if (!effective && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("must_active_user");
        if (stored) effective = JSON.parse(stored);
      } catch {}
    }
    if (effective) {
      const cached = getLocalStoredProducts();
      const myListings = cached.filter(
        (p) => p.sellerId === effective.id || p.sellerName === effective.fullName || effective.id === "demo_seller_456"
      );
      if (myListings.length > 0) {
        setProducts(myListings);
        setLoading(false);
      }
    }

    if (!user) return;
    // 1. Initial fetch from API / cache
    fetchProducts()
      .then((all) => {
        const myListings = all.filter(
          (p) => p.sellerId === user.id || p.sellerName === user.fullName || user.id === "demo_seller_456"
        );
        setProducts(myListings);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 2. Live real-time listener so likes and views update INSTANTLY across all devices!
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
            const myListings = list.filter(
              (p) => p.sellerId === user.id || p.sellerName === user.fullName || user.id === "demo_seller_456"
            );
            setProducts(myListings);
            setLoading(false);
          }
        });
      } catch (e) {
        console.warn("Seller dashboard RTDB listener error:", e);
      }
    }

    const handleProductDeletedEvent = (pid: string) => {
      if (pid) setProducts((prev) => prev.filter((p) => p.id !== pid));
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
  }, [user]);

  if (!activeUser) {
    if (authLoading) {
      return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
          {/* Header Row Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
            <div className="space-y-2">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-56" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-72" />
            </div>
            <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-xl w-36 self-start sm:self-auto" />
          </div>

          {/* 4 Stat Cards Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
                  <div className="h-4 w-4 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-14" />
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-28" />
              </div>
            ))}
          </div>

          {/* Section Header Skeleton */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-60" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-80" />
              </div>
              <div className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl w-48 self-start sm:self-auto" />
            </div>

            {/* 2-in-a-row listing card skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 min-h-[96px]"
                >
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28" />
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-12" />
                      </div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                    <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                    <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
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

  const activeProducts = products.filter((p) => (p.status || "ACTIVE").toUpperCase() === "ACTIVE");
  const activeCount = activeProducts.length;
  const soldCount = products.filter((p) => (p.status || "").toUpperCase() === "SOLD").length;
  const totalViews = activeProducts.reduce((acc, p) => acc + (p.views || 0), 0);
  const totalLikes = activeProducts.reduce((acc, p) => acc + (p.likes || 0), 0);

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
      const sellerId = user?.id || activeUser?.id;
      await deleteProduct(productId, sellerId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditForm({
      title: p.title || "",
      price: p.price || 0,
      description: p.description || "",
      location: p.location || "Main Gate",
      condition: p.condition || "SECOND_HAND",
      categoryId: p.category?.id || "1",
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const matchedCat =
      SAMPLE_CATEGORIES.find((c) => c.id === editForm.categoryId) || editingProduct.category;

    const updates: Partial<Product> = {
      title: editForm.title.trim(),
      price: Number(editForm.price) || 0,
      description: editForm.description.trim(),
      location: editForm.location,
      condition: editForm.condition,
      category: matchedCat,
    };

    const targetId = editingProduct.id;
    const previousProducts = products;
    const updatedItem = { ...editingProduct, ...updates };

    // Optimistic UI: Close modal & update dashboard view INSTANTLY with 0 delay!
    setProducts((prev) =>
      prev.map((p) => (p.id === targetId ? updatedItem : p))
    );
    setEditingProduct(null);

    // Broadcast update across open tabs and windows immediately
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel("must_marketplace_products_sync");
        bc.postMessage({
          type: "UPDATE",
          productId: targetId,
          product: updatedItem,
        });
        bc.close();
      } catch {}
    }

    // Persist changes in the background without freezing the UI
    updateProduct(targetId, updates).catch((err) => {
      console.error("Failed to save changes in background:", err);
      setProducts(previousProducts);
      alert("Failed to save changes. Please try again.");
    });
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
          <p className="text-[11px] text-slate-400">Live on marketplace</p>
        </div>

        {/* Sold Listings */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Sold Items</span>
            <CheckCircle2 className="w-4 h-4 text-secondary" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {soldCount}
          </p>
          <p className="text-[11px] text-slate-400">Successfully completed</p>
        </div>

        {/* Total Views */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Impressions</span>
            <Eye className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {totalViews}
          </p>
          <p className="text-[11px] text-slate-400">Total Views</p>
        </div>

        {/* Total Favorites */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Favorites</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {totalLikes}
          </p>
          <p className="text-[11px] text-slate-400">Liked Items</p>
        </div>
      </div>

      {/* Listings Management */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Your Campus Listings ({displayedListings.length})
            </h2>
            <p className="text-xs text-slate-500">
              Manage status, edit details, or remove sold advertisements
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold self-start sm:self-auto">
            <button
              onClick={() => setFilterTab("ACTIVE")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterTab === "ACTIVE"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilterTab("SOLD")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterTab === "SOLD"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Sold ({soldCount})
            </button>
            <button
              onClick={() => setFilterTab("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterTab === "ALL"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All ({products.length})
            </button>
          </div>
        </div>

        {/* Listings Grid - Exactly Two In A Row */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200/60 dark:border-slate-800"
              />
            ))}
          </div>
        ) : displayedListings.length === 0 ? (
          <EmptyState
            icon={
              filterTab === "SOLD"
                ? <CheckCircle2 className="w-8 h-8" />
                : <Package className="w-8 h-8" />
            }
            title={
              filterTab === "SOLD"
                ? "No sold items yet"
                : filterTab === "ACTIVE"
                ? "No active listings"
                : "No listings yet"
            }
            description={
              filterTab === "SOLD"
                ? "Items you've marked as sold will appear here. Keep selling!"
                : "You haven't posted any ads yet. Start by listing something you want to sell on campus."
            }
            action={
              <Link
                href="/seller/products/new"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Post Your First Ad
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedListings.map((prod) => (
              <div
                key={prod.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={prod.imageUrls?.[0] || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=800"}
                    alt={prod.title}
                    className="w-16 h-16 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/60 dark:border-slate-800"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={prod.title}>
                        {prod.title}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase shrink-0 ${
                          prod.status === "SOLD"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {prod.status}
                      </span>
                    </div>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatPrice(prod.price, prod.condition)}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>{prod.location}</span>
                      <span>•</span>
                      <span>{prod.views || 0} views</span>
                      <span>•</span>
                      <span>{prod.likes || 0} likes</span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 text-xs font-semibold">
                  <Link
                    href={`/product/${prod.id}`}
                    target="_blank"
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                    title="View live page"
                    onClick={() => {
                      try { sessionStorage.setItem(`must_item_${prod.id}`, JSON.stringify(prod)); } catch {}
                    }}
                    onMouseEnter={() => {
                      try { sessionStorage.setItem(`must_item_${prod.id}`, JSON.stringify(prod)); } catch {}
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>

                  <button
                    onClick={() => handleOpenEdit(prod)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-colors cursor-pointer"
                    title="Edit item details"
                  >
                    <Edit className="w-3.5 h-3.5 text-secondary" />
                    <span>Edit</span>
                  </button>

                  {prod.status === "ACTIVE" ? (
                    <button
                      onClick={() => handleMarkAsSold(prod.id)}
                      className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer text-xs font-bold"
                    >
                      Mark as Sold
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMarkAsActive(prod.id)}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer text-xs font-bold"
                    >
                      Mark as Active
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteListing(prod.id)}
                    className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-colors cursor-pointer"
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

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Edit Item Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Changes will save permanently across the marketplace
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Item Title
                </label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                  placeholder="e.g. Scientific Calculator"
                />
              </div>

              {/* Price & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {editForm.condition === "BUSINESS" ? "Price (From KSh)" : "Price (KSh)"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 pointer-events-none">
                      {editForm.condition === "BUSINESS" ? "From KSh" : "KSh"}
                    </span>
                    <input
                      type="number"
                      required
                      min={0}
                      value={editForm.price}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                      className={`w-full ${editForm.condition === "BUSINESS" ? "pl-20" : "pl-12"} pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500 font-bold`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Condition
                  </label>
                  <select
                    value={editForm.condition}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        condition: e.target.value as Product["condition"],
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="SECOND_HAND">Second Hand</option>
                    <option value="NEW">Brand New</option>
                    <option value="BUSINESS">Business</option>
                  </select>
                </div>
              </div>

              {/* Category & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    {SAMPLE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Campus Zone / Location
                  </label>
                  <select
                    value={editForm.location}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    {UNIVERSITY_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Item Description
                </label>
                <textarea
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500 leading-relaxed resize-none"
                  placeholder="Describe condition, battery health, accessories included..."
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  disabled={savingEdit}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Permanently...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}