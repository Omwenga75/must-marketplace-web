"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Users,
  Package,
  TrendingUp,
  Trash2,
  Eye,
  Heart,
  Megaphone,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserX,
  Activity,
  BarChart3,
  Search,
  X,
  Send,
  UserCheck,
  Store,
  RefreshCw,
  PackageSearch,
  Plus,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchProducts,
  fetchAllUsers,
  deleteProduct,
  deleteUserAccount,
  sendAdminBroadcast,
  createNotification,
} from "@/lib/firebase/services";
import { database } from "@/lib/firebase/config";
import { ref, onValue } from "firebase/database";
import { formatRelativeTime, formatPrice, getInitials, isAdministratorEmail } from "@/lib/utils";
import { Product, User } from "@/types";
import EmptyState from "@/components/ui/EmptyState";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Robustly parse a timestamp that may be:
 *  - a Unix-ms number or string  (e.g. "1793530586392" or 1793530586392)
 *  - an ISO 8601 string          (e.g. "2026-10-26T18:00:00.000Z")
 *  - a locale-formatted string   (last resort)
 * Returns a Unix-ms number, or 0 if un-parseable.
 */
function toTimestamp(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;

  // Numeric string → treat as Unix-ms if > 1 trillion (post year 2001)
  const asNum = Number(raw);
  if (!isNaN(asNum) && asNum > 1_000_000_000_000) return asNum;

  // ISO 8601 / any date string
  const parsed = new Date(raw).getTime();
  if (!isNaN(parsed) && parsed > 0) return parsed;

  return 0;
}

type ActivityEvent = {
  id: string;
  type: "user_joined" | "listing_added" | "item_sold" | "item_booked";
  title: string;
  subtitle: string;
  timestamp: number; // always Unix ms
};

type AdminTab = "overview" | "products" | "users" | "broadcast";

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Activity pagination
  const [activityPage, setActivityPage] = useState(0);
  const ACTIVITY_PAGE_SIZE = 6;

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState<"URGENT" | "NORMAL" | "INFO">("NORMAL");
  const [sending, setSending] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);

  // Search/filter
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState<"all" | "active" | "sold">("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "sellers" | "buyers">("all");

  // Delete confirmation
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  const isAdmin = Boolean(
    user?.isAdmin || user?.admin || isAdministratorEmail(user?.email)
  );

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace("/login");
    }
  }, [authLoading, isAdmin, router]);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoadingData(true);
    try {
      const [prods, allUsers] = await Promise.all([fetchProducts(), fetchAllUsers()]);
      setProducts(prods);
      setUsers(allUsers);
    } catch (err) {
      console.warn("Admin data fetch error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  // ── Live RTDB listener (products) ─────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin || !database) return;
    const prodsRef = ref(database, "products");
    const unsub = onValue(prodsRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === "object") {
        const list: Product[] = Object.entries(val).map(([k, v]: [string, any]) => ({
          ...v,
          id: v.id || k,
          likes: typeof v.likes === "number" ? v.likes : Number(v.likes) || 0,
          views: typeof v.views === "number" ? v.views : Number(v.views) || 0,
        }));
        setProducts(list);
      }
    });
    return () => unsub();
  }, [isAdmin]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeProducts = useMemo(
    () => products.filter((p) => (p.status || "ACTIVE").toUpperCase() === "ACTIVE"),
    [products]
  );
  const soldProducts = useMemo(
    () => products.filter((p) => (p.status || "").toUpperCase() === "SOLD"),
    [products]
  );
  const totalViews = useMemo(
    () => products.reduce((acc, p) => acc + (p.views || 0), 0),
    [products]
  );
  const totalLikes = useMemo(
    () => products.reduce((acc, p) => acc + (p.likes || 0), 0),
    [products]
  );
  const sellerCount = useMemo(
    () => users.filter((u) => u.seller || u.isSeller).length,
    [users]
  );

  // ── Activity log ───────────────────────────────────────────────────────────
  // Build chronological activity events from real product & user timestamps.
  // toTimestamp() robustly handles Unix-ms strings AND ISO strings.
  const activityEvents: ActivityEvent[] = useMemo(() => {
    const events: ActivityEvent[] = [];

    // New user registrations
    users.forEach((u) => {
      const ts = toTimestamp(u.memberSince);
      if (ts > 0) {
        events.push({
          id: `user_${u.id}`,
          type: "user_joined",
          title: "New User Registered",
          subtitle: u.fullName || u.email || "Unknown",
          timestamp: ts,
        });
      }
    });

    // Product listings
    products.forEach((p) => {
      const ts = toTimestamp(p.createdAt);
      if (ts > 0) {
        if ((p.status || "ACTIVE").toUpperCase() === "SOLD") {
          events.push({
            id: `sold_${p.id}`,
            type: "item_sold",
            title: "Item Sold",
            subtitle: p.title || "Unknown item",
            timestamp: ts,
          });
        } else if ((p.status || "").toUpperCase() === "BOOKED") {
          events.push({
            id: `booked_${p.id}`,
            type: "item_booked",
            title: "Item Booked",
            subtitle: p.title || "Unknown item",
            timestamp: ts,
          });
        } else {
          events.push({
            id: `listing_${p.id}`,
            type: "listing_added",
            title: "New Listing Added",
            subtitle: p.title || "Unknown item",
            timestamp: ts,
          });
        }
      }
    });

    // Sort newest first
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [products, users]);

  const paginatedActivity = useMemo(() => {
    const start = activityPage * ACTIVITY_PAGE_SIZE;
    return activityEvents.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [activityEvents, activityPage]);

  const totalActivityPages = Math.ceil(activityEvents.length / ACTIVITY_PAGE_SIZE);

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.title?.toLowerCase().includes(q) ||
        p.sellerName?.toLowerCase().includes(q) ||
        p.category?.name?.toLowerCase().includes(q);

      const status = (p.status || "ACTIVE").toUpperCase();
      const matchesStatus =
        productStatusFilter === "all" ||
        (productStatusFilter === "active" && status === "ACTIVE") ||
        (productStatusFilter === "sold" && status === "SOLD");

      return matchesSearch && matchesStatus;
    });
  }, [products, productSearch, productStatusFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q);
      const isSeller = u.seller || u.isSeller;
      const matchesRole =
        userRoleFilter === "all" ||
        (userRoleFilter === "sellers" && isSeller) ||
        (userRoleFilter === "buyers" && !isSeller);
      return matchesSearch && matchesRole;
    });
  }, [users, userSearch, userRoleFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDeleteProduct = async (productId: string) => {
    if (deletingProductId === productId) {
      await deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setDeletingProductId(null);
    } else {
      setDeletingProductId(productId);
      setTimeout(() => setDeletingProductId(null), 3000);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (deletingUserId === userId) {
      await deleteUserAccount(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setDeletingUserId(null);
    } else {
      setDeletingUserId(userId);
      setTimeout(() => setDeletingUserId(null), 3000);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setSending(true);
    try {
      await sendAdminBroadcast(broadcastTitle.trim(), broadcastMessage.trim(), broadcastPriority);
      setBroadcastSent(true);
      setBroadcastTitle("");
      setBroadcastMessage("");
      setTimeout(() => setBroadcastSent(false), 4000);
    } catch (err) {
      console.warn("Broadcast error:", err);
    } finally {
      setSending(false);
    }
  };

  // ── Activity icon map ──────────────────────────────────────────────────────
  const activityIconMap: Record<ActivityEvent["type"], { bg: string; icon: React.ReactNode; badge: string; badgeColor: string }> = {
    user_joined: {
      bg: "bg-emerald-500/10",
      icon: <UserCheck className="w-5 h-5 text-emerald-500" />,
      badge: "User Joined",
      badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    },
    listing_added: {
      bg: "bg-blue-500/10",
      icon: <Package className="w-5 h-5 text-blue-400" />,
      badge: "Listing Added",
      badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    },
    item_sold: {
      bg: "bg-orange-500/10",
      icon: <Store className="w-5 h-5 text-orange-400" />,
      badge: "Item Sold",
      badgeColor: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    },
    item_booked: {
      bg: "bg-violet-500/10",
      icon: <CheckCircle2 className="w-5 h-5 text-violet-400" />,
      badge: "Booked",
      badgeColor: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    },
  };

  // ── Loading / guard states ─────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-48" />
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-64" />
          </div>
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-40" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className="h-96 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "products", label: `Listings (${products.length})`, icon: <Package className="w-4 h-4" /> },
    { id: "users", label: `Users (${users.length})`, icon: <Users className="w-4 h-4" /> },
    { id: "broadcast", label: "Broadcast", icon: <Megaphone className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Super Admin Console
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 ml-0.5">
            Meru University of Science &amp; Technology — Marketplace Control Centre
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Total Users",
                value: users.length,
                sub: `${sellerCount} sellers`,
                icon: <Users className="w-4 h-4 text-blue-500" />,
                color: "text-blue-600 dark:text-blue-400",
              },
              {
                label: "Active Listings",
                value: activeProducts.length,
                sub: `${soldProducts.length} sold`,
                icon: <Package className="w-4 h-4 text-emerald-500" />,
                color: "text-emerald-600 dark:text-emerald-400",
              },
              {
                label: "Total Views",
                value: totalViews.toLocaleString(),
                sub: "across all listings",
                icon: <Eye className="w-4 h-4 text-violet-500" />,
                color: "text-violet-600 dark:text-violet-400",
              },
              {
                label: "Total Likes",
                value: totalLikes.toLocaleString(),
                sub: "student favourites",
                icon: <Heart className="w-4 h-4 text-rose-500" />,
                color: "text-rose-600 dark:text-rose-400",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">{stat.label}</span>
                  {stat.icon}
                </div>
                <p className={`text-2xl sm:text-3xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] text-slate-400">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl bg-slate-900 dark:bg-slate-900 border border-slate-700/60 overflow-hidden shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <Activity className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-white text-sm sm:text-base">Recent Activity</h2>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-xs text-slate-400">Real-time marketplace audit log</p>
                </div>
              </div>

            </div>

            {/* Events list */}
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
            ) : activityEvents.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-1">
                  <Activity className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-300">No Recent Activity Recorded</p>
                <p className="text-xs text-slate-500 max-w-sm">
                  New student registrations, product listings, and campus sales will stream here automatically.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {paginatedActivity.map((event) => {
                  const cfg = activityIconMap[event.type];
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                        {cfg.icon}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{event.title}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeColor}`}
                          >
                            {cfg.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{event.subtitle}</p>
                      </div>

                      {/* Correct relative time — computed from real timestamp */}
                      <span className="text-xs font-semibold text-slate-500 whitespace-nowrap flex-shrink-0">
                        {event.timestamp > 0 ? formatRelativeTime(event.timestamp) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalActivityPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/60">
                <button
                  onClick={() => setActivityPage((p) => Math.max(0, p - 1))}
                  disabled={activityPage === 0}
                  className="text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800 disabled:hover:bg-transparent"
                >
                  ← Prev
                </button>
                <span className="text-xs text-slate-500">
                  Page {activityPage + 1} of {totalActivityPages}
                </span>
                <button
                  onClick={() => setActivityPage((p) => Math.min(totalActivityPages - 1, p + 1))}
                  disabled={activityPage >= totalActivityPages - 1}
                  className="text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800 disabled:hover:bg-transparent"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          PRODUCTS / LISTINGS TAB
      ══════════════════════════════════════════════ */}
      {activeTab === "products" && (
        <div className={!loadingData && filteredProducts.length === 0 && productSearch.trim().length === 0 && productStatusFilter === "all" ? "flex flex-col min-h-[32rem]" : "space-y-4"}>
          {/* Controls: Search and Status Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search by title, seller or category…"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Filter Tabs (All / Active / Sold) */}
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-xs font-semibold self-start sm:self-auto shrink-0">
              {(
                [
                  { key: "all" as const, label: `All (${products.length})` },
                  { key: "active" as const, label: `Active (${activeProducts.length})` },
                  { key: "sold" as const, label: `Sold (${soldProducts.length})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setProductStatusFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    productStatusFilter === f.key
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Header Bar when listings exist */}
          {filteredProducts.length > 0 && !loadingData && (
            <div className="hidden md:flex items-center justify-between px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-4 flex-1">
                <span className="w-12 text-center">Thumbnail</span>
                <span>Listing Details</span>
              </div>
              <div className="w-48 text-left">Seller &amp; Price</div>
              <div className="w-28 text-center">Status</div>
              <div className="w-20 text-right">Actions</div>
            </div>
          )}

          {/* Products list */}
          {loadingData ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
            </div>
          ) : filteredProducts.length === 0 ? (
            productSearch.trim().length > 0 || productStatusFilter !== "all" ? (
              <EmptyState
                variant="card"
                colorScheme="amber"
                icon={<PackageSearch className="w-8 h-8" />}
                badge="Search & Filter Active"
                title={
                  productSearch.trim().length > 0
                    ? `No listings matching "${productSearch}"`
                    : `No ${productStatusFilter} listings found`
                }
                description={
                  productSearch.trim().length > 0
                    ? `We couldn't find any marketplace items matching "${productSearch}" with the current filters. Try adjusting your query or resetting filters.`
                    : `There are currently no listings categorized as "${productStatusFilter.toUpperCase()}". Switch to "All" or "Active" to browse other ads.`
                }
                hints={[
                  "Try searching by broader keywords or brand (e.g. 'Laptop', 'Calculus', 'Hostel')",
                  "Search by student seller name or campus location",
                  "Toggle between All, Active, and Sold filters",
                ]}
                action={
                  <button
                    onClick={() => {
                      setProductSearch("");
                      setProductStatusFilter("all");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 shadow-md transition-all cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reset Search &amp; Filters
                  </button>
                }
                secondaryAction={
                  <button
                    onClick={loadData}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`} />
                    Refresh Feed
                  </button>
                }
              />
            ) : (
              <EmptyState
                variant="default"
                fullPage={false}
                colorScheme="emerald"
                className="flex-1"
                title="No Campus Listings Yet"
                description="No products or services have been listed for sale on MUST Marketplace yet. When student sellers create listings, they will appear here in real-time."
              />
            )
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800">
                    {p.imageUrls?.[0] ? (
                      <img
                        src={p.imageUrls[0]}
                        alt={p.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{p.title}</p>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          p.status === "SOLD"
                            ? "bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400"
                            : p.status === "BOOKED"
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {p.status || "ACTIVE"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      by {p.sellerName} · {formatPrice(p.price)} ·{" "}
                      {p.createdAt ? formatRelativeTime(toTimestamp(p.createdAt)) : "—"}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {p.views || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {p.likes || 0}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/product/${p.id}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className={`p-2 rounded-lg transition-all ${
                        deletingProductId === p.id
                          ? "bg-rose-500 text-white"
                          : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      }`}
                      title={deletingProductId === p.id ? "Click again to confirm delete" : "Delete listing"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          USERS TAB
      ══════════════════════════════════════════════ */}
      {activeTab === "users" && (
        <div className={!loadingData && filteredUsers.length === 0 && userSearch.trim().length === 0 && userRoleFilter === "all" ? "flex flex-col min-h-[32rem]" : "space-y-4"}>
          {/* Controls: Search and Role Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Role filter tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-xs font-semibold self-start sm:self-auto shrink-0">
              {(
                [
                  { key: "all" as const, label: `All (${users.length})` },
                  { key: "sellers" as const, label: `Sellers (${users.filter((u) => u.seller || u.isSeller).length})` },
                  { key: "buyers" as const, label: `Buyers (${users.filter((u) => !(u.seller || u.isSeller)).length})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setUserRoleFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    userRoleFilter === f.key
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Header Bar when users exist */}
          {filteredUsers.length > 0 && !loadingData && (
            <div className="hidden md:flex items-center justify-between px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-4 flex-1">
                <span className="w-10 text-center">User</span>
                <span>Name &amp; Contact</span>
              </div>
              <div className="w-36 text-left">Role</div>
              <div className="w-44 text-left">Activity / Member Since</div>
              <div className="w-20 text-right">Actions</div>
            </div>
          )}

          {/* Users list */}
          {loadingData ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
            </div>
          ) : filteredUsers.length === 0 ? (
            userSearch.trim().length > 0 || userRoleFilter !== "all" ? (
              <EmptyState
                variant="card"
                colorScheme="amber"
                icon={<UserX className="w-8 h-8" />}
                badge="Search & Filter Active"
                title={
                  userSearch.trim().length > 0
                    ? `No users matching "${userSearch}"`
                    : `No ${userRoleFilter === "sellers" ? "seller" : "buyer"} accounts found`
                }
                description={
                  userSearch.trim().length > 0
                    ? `No campus accounts matched your query "${userSearch}". Try searching by university email (@must.ac.ke) or clearing active filters.`
                    : `There are currently no accounts matching the "${userRoleFilter}" role filter. Switch back to "All" to browse all registered students.`
                }
                hints={[
                  "Search by student full name or student ID",
                  "Search by university email domain (e.g. '@must.ac.ke')",
                  "Toggle between All, Sellers, and Buyers Only filters above",
                ]}
                action={
                  <button
                    onClick={() => {
                      setUserSearch("");
                      setUserRoleFilter("all");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 shadow-md transition-all cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reset Search &amp; Filters
                  </button>
                }
                secondaryAction={
                  <button
                    onClick={loadData}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`} />
                    Refresh Directory
                  </button>
                }
              />
            ) : (
              <EmptyState
                variant="default"
                fullPage={false}
                colorScheme="indigo"
                className="flex-1"
                title="No Registered Users Yet"
                description="No student or campus accounts have registered yet. As students sign in, list items, and engage, their accounts and activity will show up here."
              />
            )
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    {u.profileImageUrl ? (
                      <img src={u.profileImageUrl} alt={u.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-sm">{getInitials(u.fullName)}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{u.fullName}</p>
                      {(u.admin || u.isAdmin) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                          Admin
                        </span>
                      )}
                      {(u.seller || u.isSeller) && !(u.admin || u.isAdmin) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                          Seller
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Joined{" "}
                      {u.memberSince && toTimestamp(u.memberSince) > 0
                        ? formatRelativeTime(toTimestamp(u.memberSince))
                        : "—"}
                      {" · "}
                      {u.activeListings || 0} listings · {u.soldItems || 0} sold
                    </p>
                  </div>

                  {/* Delete (not self, not other admins) */}
                  {!(u.admin || u.isAdmin) && u.id !== user?.id && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                        deletingUserId === u.id
                          ? "bg-rose-500 text-white"
                          : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      }`}
                      title={deletingUserId === u.id ? "Click again to confirm" : "Remove account"}
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          BROADCAST TAB
      ══════════════════════════════════════════════ */}
      {activeTab === "broadcast" && (
        <div className="max-w-2xl space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10">
                <Megaphone className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Broadcast Notification</h2>
                <p className="text-xs text-slate-400">Send an announcement to all registered students</p>
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</label>
              <div className="flex gap-2">
                {(["URGENT", "NORMAL", "INFO"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setBroadcastPriority(p)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                      broadcastPriority === p
                        ? p === "URGENT"
                          ? "bg-rose-500 text-white border-rose-500"
                          : p === "NORMAL"
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-blue-500 text-white border-blue-500"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Title
              </label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="e.g. Marketplace Maintenance Tonight"
                maxLength={80}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Message
              </label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Write your campus-wide announcement here…"
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
              />
              <p className="text-right text-[11px] text-slate-400">{broadcastMessage.length}/500</p>
            </div>

            {/* Send button */}
            <button
              onClick={handleSendBroadcast}
              disabled={sending || !broadcastTitle.trim() || !broadcastMessage.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : broadcastSent ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? "Sending…" : broadcastSent ? "Sent Successfully!" : "Send Broadcast"}
            </button>

            {broadcastSent && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Broadcast delivered to {users.length} student{users.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
