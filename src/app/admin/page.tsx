"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Store,
  Package,
  Eye,
  Megaphone,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Product, User } from "@/types";
import {
  fetchProducts,
  deleteProduct,
  updateProduct,
  fetchAllUsers,
  sendAdminBroadcast,
} from "@/lib/firebase/services";
import { formatPrice, formatRelativeTime } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { user, loginAsDemoUser } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "users" | "broadcast">(
    "overview"
  );

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchAllUsers()])
      .then(([prods, users]) => {
        setProducts(prods);
        if (users.length > 0) {
          setUsersList(users);
        } else {
          // Demo users
          setUsersList([
            {
              id: "u1",
              fullName: "James Mutua",
              email: "james.mutua@student.must.ac.ke",
              phone: "+254 712 345 678",
              location: "Nchiru",
              isSeller: true,
              seller: true,
              memberSince: "1704067200000",
              activeListings: 2,
              soldItems: 5,
              likes: 45,
            },
            {
              id: "u2",
              fullName: "Mary Kamau",
              email: "mary.kamau@student.must.ac.ke",
              phone: "+254 722 987 654",
              location: "Main Gate",
              isSeller: true,
              seller: true,
              memberSince: "1706745600000",
              activeListings: 1,
              soldItems: 3,
              likes: 48,
            },
            {
              id: "u3",
              fullName: "Brian Njoroge",
              email: "brian.njoroge@student.must.ac.ke",
              location: "California",
              isSeller: false,
              seller: false,
              memberSince: "1709251200000",
              activeListings: 0,
              soldItems: 0,
              likes: 12,
            },
          ]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Access check
  if (!user || !user.isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950 text-secondary mx-auto flex items-center justify-center">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Admin Authorization Required
        </h2>
        <p className="text-xs text-slate-500">
          You must be logged in as a verified administrator to access the campus moderation console.
        </p>
        <button
          onClick={() => loginAsDemoUser("admin")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-white font-bold text-xs shadow-md hover:bg-secondary-dark transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Switch to Admin Test Persona</span>
        </button>
      </div>
    );
  }

  // Metrics
  const totalListings = products.length;
  const activeListings = products.filter((p) => p.status === "ACTIVE").length;
  const totalViews = products.reduce((sum, p) => sum + (p.views || 0), 0);
  const totalLikes = products.reduce((sum, p) => sum + (p.likes || 0), 0);
  const sellerCount = usersList.filter((u) => u.isSeller || u.seller).length;

  const handleDelete = async (productId: string) => {
    if (confirm("Admin: Permanently delete this listing?")) {
      await deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;
    setBroadcastSending(true);

    try {
      await sendAdminBroadcast(broadcastTitle, broadcastMessage, "NORMAL");
      setBroadcastSuccess(true);
      setBroadcastTitle("");
      setBroadcastMessage("");
      setTimeout(() => setBroadcastSuccess(false), 3000);
    } catch (err) {
      console.warn(err);
    } finally {
      setBroadcastSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-secondary" />
              <span>MUST Admin Console</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-secondary font-bold text-xs">
              Super Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Moderation, student verification, platform metrics, and university broadcasts
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl overflow-x-auto text-xs font-bold">
          {(["overview", "products", "users", "broadcast"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-2 rounded-xl capitalize transition-all ${
                activeTab === tab
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: OVERVIEW & ANALYTICS ─────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-fade-in">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Total Listings</span>
                <Package className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">
                {totalListings}
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold">
                {activeListings} active on campus
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Verified Sellers</span>
                <Store className="w-4 h-4 text-secondary" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">
                {sellerCount}
              </p>
              <p className="text-[11px] text-slate-500">Students with seller role</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Total Views</span>
                <Eye className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{totalViews}</p>
              <p className="text-[11px] text-slate-500">Student ad impressions</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Total Likes</span>
                <Users className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{totalLikes}</p>
              <p className="text-[11px] text-slate-500">Comrade bookmarks</p>
            </div>
          </div>

          {/* Quick moderation prompt */}
          <div className="p-6 rounded-3xl bg-primary/30 dark:bg-emerald-950/20 border border-primary-container dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Campus Broadcast Ready
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Send official alerts, safety guidelines or platform announcements to all student users.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("broadcast")}
              className="px-4 py-2.5 rounded-xl bg-secondary text-white font-bold text-xs shadow-sm shrink-0"
            >
              Compose Broadcast
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 2: PRODUCT MANAGEMENT ───────────────────────────────────── */}
      {activeTab === "products" && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            All Campus Listings ({products.length})
          </h2>

          <div className="space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={p.imageUrls[0]}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {p.title}
                    </h4>
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {formatPrice(p.price)}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Seller: {p.sellerName} • {p.location} • {p.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/product/${p.id}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50"
                    title="Remove listing"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: USER MANAGEMENT ──────────────────────────────────────── */}
      {activeTab === "users" && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Student Accounts ({usersList.length})
          </h2>

          <div className="space-y-3">
            {usersList.map((u) => (
              <div
                key={u.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-primary-container text-primary-dark font-black flex items-center justify-center shrink-0">
                    {u.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {u.fullName}
                    </h4>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    <p className="text-[11px] text-slate-400">
                      Role: {u.isSeller || u.seller ? "Seller" : "Buyer"} • {u.location || "Campus"}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    u.isSeller || u.seller
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {u.isSeller || u.seller ? "Verified Seller" : "Student"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: CAMPUS BROADCAST ─────────────────────────────────────── */}
      {activeTab === "broadcast" && (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-secondary" />
              <span>Campus-Wide Broadcast</span>
            </h2>
            <p className="text-xs text-slate-500">
              Send an instant push notification and in-app alert to all registered students.
            </p>
          </div>

          <form
            onSubmit={handleSendBroadcast}
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-card"
          >
            {broadcastSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Broadcast successfully dispatched to all student accounts!</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Broadcast Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. End of Semester Textbook Drive or Safety Reminder"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Message Body
              </label>
              <textarea
                rows={4}
                required
                placeholder="Enter announcement details..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={broadcastSending}
              className="w-full py-3.5 rounded-xl bg-secondary hover:bg-secondary-dark disabled:opacity-50 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{broadcastSending ? "Dispatching..." : "Send Broadcast to Comrades"}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
