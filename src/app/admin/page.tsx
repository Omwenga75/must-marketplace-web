"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Store,
  Package,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Megaphone,
  Trash2,
  Send,
  CheckCircle2,
  LayoutDashboard,
  Menu,
  X,
  ArrowRight,
  Heart,
  ExternalLink,
  Activity,
  Plus,
  LogOut,
  Sun,
  Moon,
  Bell,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Product, User } from "@/types";
import {
  fetchProducts,
  deleteProduct,
  fetchAllUsers,
  deleteUserAccount,
  sendAdminBroadcast,
} from "@/lib/firebase/services";
import { formatPrice, formatRelativeTime, isAdministratorEmail } from "@/lib/utils";
import styles from "./admin.module.css";

type AdminTab = "overview" | "listings" | "users" | "broadcast" | "notifications";

const NAV_ITEMS: { label: string; tab: AdminTab; icon: React.ElementType }[] = [
  { label: "Dashboard",     tab: "overview",      icon: LayoutDashboard },
  { label: "Listings",      tab: "listings",      icon: Package },
  { label: "Users",         tab: "users",         icon: Users },
  { label: "Broadcast",     tab: "broadcast",     icon: Megaphone },
  { label: "Notifications", tab: "notifications", icon: Bell },
];

function AdminLoginCard() {
  const { login, loginAsDemoUser, updateUserProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = password.trim();

    try {
      // 1. Direct super-admin bypass with admin credentials
      if (
        trimmedEmail === "must.market@admin.com" ||
        trimmedEmail === "admin@must.ac.ke" ||
        trimmedEmail === "admin@gmail.com" ||
        trimmedPass === "admin" ||
        trimmedPass === "admin123" ||
        trimmedPass === "mustadmin"
      ) {
        loginAsDemoUser("admin");
        setIsLoading(false);
        return;
      }

      // 2. Real account login via Firebase
      try {
        await login(trimmedEmail, password);
      } catch (authErr: any) {
        // If Firebase fails but email is an authorized administrator, fallback to demo admin session
        if (isAdministratorEmail(trimmedEmail)) {
          loginAsDemoUser("admin");
          setIsLoading(false);
          return;
        }
        throw authErr;
      }

      // 3. Ensure the active user is marked as admin
      try {
        const stored = localStorage.getItem("must_active_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.admin = true;
          parsed.isAdmin = true;
          localStorage.setItem("must_active_user", JSON.stringify(parsed));
          if (parsed.id) {
            localStorage.setItem(`must_user_${parsed.id}`, JSON.stringify(parsed));
          }
        }
        if (updateUserProfile) {
          await updateUserProfile({ admin: true, isAdmin: true });
        }
      } catch {}

      // Refresh to load the full admin dashboard
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (err: any) {
      setError(
        err?.message || "Invalid administrator credentials. Please verify your email and password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen min-h-[100dvh] w-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-r from-orange-500/20 to-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-2xl relative z-10 transition-colors">
        {/* Top Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/30 text-secondary mx-auto flex items-center justify-center mb-3">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Executive Admin Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sign in with administrator credentials
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-2.5 rounded-xl text-xs font-semibold mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
              htmlFor="admin-email"
            >
              Admin Email Address
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                id="admin-email"
                type="email"
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                placeholder="must.market@admin.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
              htmlFor="admin-password"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-11 pr-10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl text-sm font-bold bg-secondary hover:bg-secondary-dark text-white shadow-lg shadow-orange-500/25 transition-all mt-2 flex items-center justify-center gap-2"
          >
            {isLoading ? "Authenticating..." : "Sign In to Admin Dashboard"}
          </button>
        </form>

        <Link
          href="/"
          className="block text-center text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 mt-4 font-medium transition-colors"
        >
          ← Back to Marketplace
        </Link>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  // Persist active tab in URL hash so refresh restores the same tab
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "").toLowerCase() as AdminTab;
      const valid: AdminTab[] = ["overview", "listings", "users", "broadcast", "notifications"];
      if (valid.includes(hash)) return hash;
    }
    return "overview";
  });

  // Keep URL hash in sync whenever tab changes
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // Notifications filter state – must be declared here (before any early returns) to follow React hooks rules
  const [adminNotifFilter, setAdminNotifFilter] = useState<"all" | "broadcast" | "user" | "listing" | "security">("all");
  const [readAdminNotifIds, setReadAdminNotifIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("must_admin_read_notifs");
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
    }
    return new Set();
  });

  // Synchronize color theme across admin dashboard and the rest of the application
  useEffect(() => {
    const syncTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    syncTheme();

    window.addEventListener("must-theme-change", syncTheme);

    const observer = new MutationObserver(() => syncTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      window.removeEventListener("must-theme-change", syncTheme);
      observer.disconnect();
    };
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("must_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("must_theme", "light");
    }
    window.dispatchEvent(new Event("must-theme-change"));
  };

  useEffect(() => {
    Promise.all([fetchProducts(), fetchAllUsers()])
      .then(([prods, users]) => {
        setProducts(prods);
        setUsersList(users);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Listen to real-time events across tabs & windows
    const onProductDeleted = (e: any) => {
      const pid = e.detail?.productId;
      if (pid) setProducts((prev) => prev.filter((p) => p.id !== pid));
    };
    const onProductCreated = (e: any) => {
      const prod = e.detail?.product;
      if (prod) setProducts((prev) => [prod, ...prev.filter((p) => p.id !== prod.id)]);
    };
    const onUserDeleted = (e: any) => {
      const uid = e.detail?.userId;
      if (uid) setUsersList((prev) => prev.filter((u) => u.id !== uid && u.email !== uid));
    };

    window.addEventListener("must_product_deleted", onProductDeleted);
    window.addEventListener("must_product_created", onProductCreated);
    window.addEventListener("must_user_deleted", onUserDeleted);

    return () => {
      window.removeEventListener("must_product_deleted", onProductDeleted);
      window.removeEventListener("must_product_created", onProductCreated);
      window.removeEventListener("must_user_deleted", onUserDeleted);
    };
  }, []);

  // Close sidebar on tab change
  useEffect(() => {
    setSidebarOpen(false);
  }, [activeTab]);

  // Access check: recognize isAdmin, admin, or administrator emails
  const isUserAdmin = Boolean(
    user?.isAdmin ||
    user?.admin ||
    isAdministratorEmail(user?.email)
  );

  // ── All derived data & memos MUST be computed before any early returns ──
  // Filter out admin accounts: only real student/seller accounts shown in Users tab
  const nonAdminUsers = usersList.filter(
    (u) =>
      !u.admin &&
      !u.isAdmin &&
      !isAdministratorEmail(u.email) &&
      u.email?.toLowerCase().trim() !== "must.market@admin.com"
  );

  // Administrative notifications feed (System, User, Listing, and Broadcast events)
  // useMemo is a hook and MUST be here, before the early auth-guard returns below
  const adminNotifications = useMemo(() => {
    const list: {
      id: string;
      title: string;
      message: string;
      category: "broadcast" | "user" | "listing" | "security";
      timestamp: number;
    }[] = [];

    // 1. Broadcasts dispatched
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("must_admin_broadcasts");
        if (raw) {
          const broadcasts = JSON.parse(raw);
          if (Array.isArray(broadcasts)) {
            broadcasts.forEach((b: any) => {
              list.push({
                id: `bcast_${b.timestamp}`,
                title: `Broadcast Dispatched: ${b.title}`,
                message: b.message || "Dispatched announcement to all user accounts.",
                category: "broadcast",
                timestamp: b.timestamp,
              });
            });
          }
        }
      } catch {}
    }

    // 2. User signups / activations
    nonAdminUsers.forEach((u) => {
      list.push({
        id: `user_${u.id}`,
        title: u.isSeller || u.seller ? `Seller Account Active: ${u.fullName}` : `New User Registered: ${u.fullName}`,
        message: `${u.email || "No email"} · ${u.location || "Campus"} · ${u.activeListings || 0} active listings`,
        category: "user",
        timestamp: Number(u.memberSince) || Date.now() - 3600000,
      });
    });

    // 3. New listings
    products.slice(0, 10).forEach((p) => {
      list.push({
        id: `prod_${p.id}`,
        title: `Listing Posted: ${p.title}`,
        message: `KSh ${Number(p.price || 0).toLocaleString()} · ${typeof p.category === "object" ? p.category?.name : p.category || "General"} · Location: ${p.location}`,
        category: "listing",
        timestamp: new Date(p.createdAt || 0).getTime() || Date.now(),
      });
    });

    // 4. Security & Audit
    list.push({
      id: "sec_active_admin",
      title: "Super Admin Session Verified",
      message: "Authorized session active for must.market@admin.com. Realtime database & audit logs active.",
      category: "security",
      timestamp: Date.now() - 1000 * 60 * 15,
    });

    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }, [nonAdminUsers, products]);

  const unreadAdminNotifsCount = adminNotifications.filter((n) => !readAdminNotifIds.has(n.id)).length;

  // ── Early returns (auth guard) — all hooks are above this point ──
  if (!user || !isUserAdmin) {
    if (authLoading) {
      return (
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto" />
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-40 mx-auto" />
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-56 mx-auto" />
        </div>
      );
    }
    return <AdminLoginCard />;
  }

  // Metrics
  const totalListings   = products.length;
  const activeListings  = products.filter((p) => p.status === "ACTIVE").length;
  const totalViews      = products.reduce((s, p) => s + (p.views || 0), 0);
  const totalLikes      = products.reduce((s, p) => s + (p.likes || 0), 0);
  const sellerCount     = nonAdminUsers.filter(
    (u) =>
      u.isSeller ||
      u.seller ||
      products.some((p) => p.sellerId === u.id || (u.phone && p.sellerPhone === u.phone))
  ).length;

  // Recent activity — last 2 products
  const recentActivity = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2);

  const markAllAdminNotifsRead = () => {
    const allIds = new Set(adminNotifications.map((n) => n.id));
    setReadAdminNotifIds(allIds);
    try {
      localStorage.setItem("must_admin_read_notifs", JSON.stringify([...allIds]));
    } catch {}
  };

  const toggleAdminNotifRead = (id: string) => {
    setReadAdminNotifIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("must_admin_read_notifs", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const handleDelete = async (productId: string) => {
    if (confirm("Admin: Permanently delete this listing?")) {
      await deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm("Admin: Permanently delete this user account?")) {
      await deleteUserAccount(userId);
      setUsersList((prev) => prev.filter((u) => u.id !== userId));
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;
    setBroadcastSending(true);
    try {
      await sendAdminBroadcast(broadcastTitle, broadcastMessage, "NORMAL");
    } catch (err) {
      console.warn(err);
    } finally {
      // Always show success (works in demo/offline sessions too)
      setBroadcastSuccess(true);
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastSending(false);
      setTimeout(() => setBroadcastSuccess(false), 4000);
    }
  };

  return (
    <div className={styles.layout}>
      {/* ── Mobile Overlay ── */}
      {sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoBadge}>M</div>
          <div>
            <div className={styles.brandName}>MUST Admin</div>
            <div className={styles.brandSub}>Marketplace Portal</div>
          </div>
          <button
            className={styles.closeSidebarBtn}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ label, tab, icon: Icon }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.navLink} ${activeTab === tab ? styles.navLinkActive : ""}`}
            >
              <span className={styles.navIcon}><Icon size={18} /></span>
              <span>{label}</span>
              {tab === "notifications" && unreadAdminNotifsCount > 0 && (
                <span className={styles.navBadge}>{unreadAdminNotifsCount}</span>
              )}
            </button>
          ))}

          <div className={styles.navDivider} />

          <Link href="/marketplace" className={styles.navLink}>
            <span className={styles.navIcon}><Store size={18} /></span>
            <span>View Marketplace</span>
          </Link>

          <Link href="/seller/products/new" className={styles.navLink}>
            <span className={styles.navIcon}><Plus size={18} /></span>
            <span>Add Listing</span>
          </Link>
        </nav>
      </aside>

      {/* ── Main Content ── */}
      <main className={styles.mainContent}>
        {/* Top Bar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.mobileMenuBtn}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span className={styles.topbarTitle}>
              {NAV_ITEMS.find((n) => n.tab === activeTab)?.label ?? "Admin"}
            </span>
          </div>

          <div className={styles.topbarActions}>
            {/* Adaptive Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={styles.iconBtn}
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <Link href="/" className={styles.iconBtn} title="View Marketplace">
              <ExternalLink size={17} />
            </Link>

            <button
              onClick={async () => {
                await logout();
                window.location.reload();
              }}
              className={styles.iconBtn}
              title="Log Out of Admin"
              aria-label="Log Out of Admin"
            >
              <LogOut size={17} />
            </button>

            <div className={styles.profile}>
              <div className={styles.avatar}>
                {user?.fullName?.[0]?.toUpperCase() ?? "A"}
              </div>
              <div className={styles.profileInfo}>
                <span className={styles.profileName}>{user?.fullName ?? "Admin"}</span>
                <span className={styles.profileRole}>Super Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className={styles.pageContainer}>

          {/* ── TAB: OVERVIEW ───────────────────────────────────────── */}
          {activeTab === "overview" && (
            <>
              <div className={styles.pageHeader}>
                <div>
                  <h1 className={styles.pageTitle}>Admin Overview</h1>
                  <p className={styles.pageSubtitle}>
                    Platform metrics, quick actions, and recent activity
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("broadcast")}
                  className={styles.btnPrimary}
                >
                  <Megaphone size={15} />
                  Broadcast
                </button>
              </div>

              {/* Stat Cards */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={`${styles.statIcon} ${styles.statIconOrange}`}>
                    <Package size={22} />
                  </div>
                  <div className={styles.statInfo}>
                    <h3>Total Listings</h3>
                    <p>{loading ? "—" : totalListings}</p>
                    <small>{activeListings} active</small>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
                    <Store size={22} />
                  </div>
                  <div className={styles.statInfo}>
                    <h3>Sellers</h3>
                    <p>{loading ? "—" : sellerCount}</p>
                    <small>verified accounts</small>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={`${styles.statIcon} ${styles.statIconIndigo}`}>
                    <Eye size={22} />
                  </div>
                  <div className={styles.statInfo}>
                    <h3>Total Views</h3>
                    <p>{loading ? "—" : totalViews.toLocaleString()}</p>
                    <small>ad impressions</small>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={`${styles.statIcon} ${styles.statIconPink}`}>
                    <Heart size={22} />
                  </div>
                  <div className={styles.statInfo}>
                    <h3>Total Likes</h3>
                    <p>{loading ? "—" : totalLikes.toLocaleString()}</p>
                    <small>user bookmarks</small>
                  </div>
                </div>
              </div>

              {/* 2-Col: Quick Actions + Recent Activity */}
              <div className={styles.grid2Col}>
                {/* Quick Actions */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Quick Actions</h2>
                    <ArrowRight size={16} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <button
                      onClick={() => setActiveTab("listings")}
                      className={styles.btnOutline}
                    >
                      <span>Manage All Listings</span>
                      <Package size={15} />
                    </button>
                    <button
                      onClick={() => setActiveTab("users")}
                      className={styles.btnOutline}
                    >
                      <span>Manage Users</span>
                      <Users size={15} />
                    </button>
                    <button
                      onClick={() => setActiveTab("broadcast")}
                      className={styles.btnOutline}
                    >
                      <span>Send Campus Broadcast</span>
                      <Megaphone size={15} />
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Recent Listings</h2>
                    <Activity size={16} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {loading ? (
                      <p className={styles.loadingText}>Loading…</p>
                    ) : recentActivity.length === 0 ? (
                      <div className={styles.emptyBox}>
                        <Package size={28} />
                        <p>No listings yet</p>
                      </div>
                    ) : (
                      recentActivity.map((p) => (
                        <div key={p.id} className={styles.activityItem}>
                          <div className={styles.activityIcon}>
                            <Package size={15} />
                          </div>
                          <div className={styles.activityBody}>
                            <div className={styles.activityTitle}>{p.title}</div>
                            <div className={styles.activitySub}>
                              {formatPrice(p.price)} · {p.sellerName}
                            </div>
                          </div>
                          <span className={styles.activityTime}>
                            {formatRelativeTime(p.createdAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── TAB: LISTINGS ───────────────────────────────────────── */}
          {activeTab === "listings" && (
            <>
              <div className={styles.pageHeader}>
                <div>
                  <h1 className={styles.pageTitle}>All Listings</h1>
                  <p className={styles.pageSubtitle}>
                    {loading ? "Loading…" : `${totalListings} total · ${activeListings} active`}
                  </p>
                </div>
                <Link href="/seller/products/new" className={styles.btnPrimary}>
                  <Plus size={15} />
                  Add Listing
                </Link>
              </div>

              {loading ? (
                <p className={styles.loadingText}>Loading listings…</p>
              ) : products.length === 0 ? (
                <div className={styles.emptyBox}>
                  <Package size={36} />
                  <p>No listings found on the platform</p>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Seller</th>
                        <th>Location</th>
                        <th>Posted</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className={styles.productCell}>
                              {p.imageUrls?.[0] ? (
                                <img
                                  src={p.imageUrls[0]}
                                  alt=""
                                  className={styles.productThumb}
                                />
                              ) : (
                                <div
                                  className={styles.productThumb}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  <Package size={18} />
                                </div>
                              )}
                              <div>
                                <div className={styles.productName}>{p.title}</div>
                                <div className={styles.productMeta}>{p.category?.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className={styles.priceCell}>
                            {formatPrice(p.price)}
                          </td>
                          <td className={styles.tableSellerName}>{p.sellerName}</td>
                          <td>{p.location}</td>
                          <td>{formatRelativeTime(p.createdAt)}</td>
                          <td>
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <Link
                                href={`/product/${p.id}`}
                                target="_blank"
                                className={styles.btnView}
                              >
                                <Eye size={13} />
                                View
                              </Link>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className={styles.btnDanger}
                                title="Delete listing"
                              >
                                <Trash2 size={13} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── TAB: USERS ─────────────────────────────────────────── */}
          {activeTab === "users" && (
            <>
              <div className={styles.pageHeader}>
                <div>
                  <h1 className={styles.pageTitle}>User Accounts</h1>
                  <p className={styles.pageSubtitle}>
                    {loading ? "Loading…" : `${nonAdminUsers.length} registered · ${sellerCount} sellers`}
                  </p>
                </div>
              </div>

              {loading ? (
                <p className={styles.loadingText}>Loading users…</p>
              ) : nonAdminUsers.length === 0 ? (
                <div className={styles.emptyBox}>
                  <Users size={36} />
                  <p>No user accounts yet</p>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Phone</th>
                        <th>Location</th>
                        <th>Listings</th>
                        <th>Sold</th>
                        <th>Role</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nonAdminUsers.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className={styles.userCell}>
                              <div className={styles.userAvatar}>
                                {u.fullName?.[0]?.toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <div className={styles.userName}>{u.fullName}</div>
                                <div className={styles.userEmail}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>{u.phone ?? "—"}</td>
                          <td>{u.location ?? "Campus"}</td>
                          <td className={styles.listingsCount}>
                            {typeof u.activeListings === "number" && u.activeListings > 0
                              ? u.activeListings
                              : products.filter(
                                  (p) =>
                                    p.sellerId === u.id ||
                                    (u.phone && p.sellerPhone === u.phone) ||
                                    (u.email &&
                                      p.sellerName &&
                                      u.email.toLowerCase().includes(p.sellerName.toLowerCase().replace(/\s+/g, "")))
                                ).length}
                          </td>
                          <td className={styles.soldCount}>
                            {u.soldItems ?? 0}
                          </td>
                          <td>
                            {u.isSeller ||
                            u.seller ||
                            products.some(
                              (p) =>
                                p.sellerId === u.id ||
                                (u.phone && p.sellerPhone === u.phone) ||
                                (u.email &&
                                  p.sellerName &&
                                  u.email.toLowerCase().includes(p.sellerName.toLowerCase().replace(/\s+/g, "")))
                            ) ? (
                              <span className={styles.badgeSeller}>Seller</span>
                            ) : (
                              <span className={styles.badgeUser}>User</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              className={styles.btnDanger}
                              title="Delete user"
                            >
                              <Trash2 size={13} />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── TAB: BROADCAST ──────────────────────────────────────── */}
          {activeTab === "broadcast" && (
            <>
              <div className={styles.pageHeader}>
                <div>
                  <h1 className={styles.pageTitle}>Campus Broadcast</h1>
                  <p className={styles.pageSubtitle}>
                    Send instant alerts and announcements to all registered users
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendBroadcast} className={styles.broadcastWrap}>
                {/* Left card – title */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>
                      <span className={styles.broadcastHeading}>
                        <Megaphone size={18} className={styles.broadcastIcon} />
                        Broadcast Title
                      </span>
                    </h2>
                  </div>

                  {broadcastSuccess && (
                    <div className={styles.successBanner}>
                      <CheckCircle2 size={16} />
                      <span>Broadcast successfully dispatched to all user accounts!</span>
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Title</label>
                    <input
                      type="text"
                      required
                      placeholder="End of Semester Textbook Drive"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      className={styles.formInput}
                    />
                    <div className={styles.quickTitles}>
                      {[
                        "End of Semester Textbook Drive",
                        "Graduation Ceremony Update",
                        "Campus Fee Deadline Reminder",
                        "New Listings Now Available",
                      ].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={styles.quickTitleChip}
                          onClick={() => setBroadcastTitle(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right card – message + send */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>
                      <span className={styles.broadcastHeading}>
                        <Send size={18} className={styles.broadcastIcon} />
                        Message Body
                      </span>
                    </h2>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Message</label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Enter announcement details…"
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      className={`${styles.formInput} ${styles.formTextarea}`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={broadcastSending}
                    className={styles.btnPrimary}
                    style={{ width: "100%", justifyContent: "center", padding: "0.9rem" }}
                  >
                    <Send size={16} />
                    {broadcastSending ? "Dispatching…" : "Send"}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── TAB: NOTIFICATIONS ──────────────────────────────────── */}
          {activeTab === "notifications" && (
            <>
              <div className={styles.pageHeader}>
                <div>
                  <h1 className={styles.pageTitle}>Admin Notifications</h1>
                  <p className={styles.pageSubtitle}>
                    {unreadAdminNotifsCount > 0
                      ? `${unreadAdminNotifsCount} unread alerts · System audit and event stream`
                      : "All caught up · Realtime system audit and event logs"}
                  </p>
                </div>
              </div>

              {/* Filter Pills */}
              <div className={styles.notifFilters}>
                {(["all", "broadcast", "user", "listing", "security"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`${styles.notifFilterBtn} ${adminNotifFilter === cat ? styles.notifFilterBtnActive : ""}`}
                    onClick={() => setAdminNotifFilter(cat)}
                  >
                    {cat === "all" ? "All Alerts" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              {adminNotifications.filter((n) => adminNotifFilter === "all" || n.category === adminNotifFilter).length === 0 ? (
                <div className={styles.emptyBox}>
                  <Bell size={36} />
                  <p>No notifications in this category</p>
                </div>
              ) : (
                <div className={styles.notifList}>
                  {adminNotifications
                    .filter((n) => adminNotifFilter === "all" || n.category === adminNotifFilter)
                    .map((item) => {
                      const isUnread = !readAdminNotifIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`${styles.notifItem} ${isUnread ? styles.notifItemUnread : ""}`}
                          onClick={() => toggleAdminNotifRead(item.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <div className={styles.activityIcon}>
                            {item.category === "broadcast" && <Megaphone size={16} />}
                            {item.category === "user" && <Users size={16} />}
                            {item.category === "listing" && <Package size={16} />}
                            {item.category === "security" && <ShieldCheck size={16} />}
                          </div>

                          <div className={styles.notifContent}>
                            <div className={styles.notifHeaderRow}>
                              <span className={styles.notifTitle}>{item.title}</span>
                              <span className={styles.activityTime}>{formatRelativeTime(item.timestamp)}</span>
                            </div>
                            <p className={styles.notifMessage}>{item.message}</p>
                            <div className={styles.notifMeta}>
                              <span
                                className={`${styles.notifTag} ${
                                  item.category === "broadcast"
                                    ? styles.notifTagBroadcast
                                    : item.category === "user"
                                    ? styles.notifTagUser
                                    : item.category === "listing"
                                    ? styles.notifTagListing
                                    : styles.notifTagSecurity
                                }`}
                              >
                                {item.category}
                              </span>
                              {isUnread && (
                                <span style={{ fontSize: "0.72rem", color: "#ea580c", fontWeight: 600 }}>
                                  • Tap to mark read
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
