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
  Send,
  Sparkles,
  CheckCircle2,
  LayoutDashboard,
  Menu,
  X,
  ArrowRight,
  TrendingUp,
  Heart,
  ExternalLink,
  Activity,
  Plus,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Product, User } from "@/types";
import {
  fetchProducts,
  deleteProduct,
  fetchAllUsers,
  sendAdminBroadcast,
} from "@/lib/firebase/services";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import styles from "./admin.module.css";

type AdminTab = "overview" | "listings" | "students" | "broadcast";

const NAV_ITEMS: { label: string; tab: AdminTab; icon: React.ElementType }[] = [
  { label: "Dashboard",  tab: "overview",   icon: LayoutDashboard },
  { label: "Listings",   tab: "listings",   icon: Package },
  { label: "Students",   tab: "students",   icon: Users },
  { label: "Broadcast",  tab: "broadcast",  icon: Megaphone },
];

function statusBadge(status: string, styles: Record<string, string>) {
  if (status === "ACTIVE")
    return <span className={styles.badgeActive}>Active</span>;
  if (status === "SOLD")
    return <span className={styles.badgeSold}>Sold</span>;
  return (
    <span className={styles.badgeSold}>{status}</span>
  );
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading, loginAsDemoUser } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Close sidebar on tab change
  useEffect(() => {
    setSidebarOpen(false);
  }, [activeTab]);

  // Access check
  if (!user || !user.isAdmin) {
    if (authLoading) {
      return (
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto" />
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-40 mx-auto" />
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-56 mx-auto" />
        </div>
      );
    }
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
  const totalListings   = products.length;
  const activeListings  = products.filter((p) => p.status === "ACTIVE").length;
  const totalViews      = products.reduce((s, p) => s + (p.views || 0), 0);
  const totalLikes      = products.reduce((s, p) => s + (p.likes || 0), 0);
  const sellerCount     = usersList.filter((u) => u.isSeller || u.seller).length;

  // Recent activity — last 5 products
  const recentActivity = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

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
      setTimeout(() => setBroadcastSuccess(false), 4000);
    } catch (err) {
      console.warn(err);
    } finally {
      setBroadcastSending(false);
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
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#f8fafc" }}>
              {NAV_ITEMS.find((n) => n.tab === activeTab)?.label ?? "Admin"}
            </span>
          </div>

          <div className={styles.topbarActions}>
            <Link href="/" className={styles.iconBtn} title="Back to site">
              <LogOut size={17} />
            </Link>
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
                  <div className={styles.statIcon}>
                    <Package size={22} />
                  </div>
                  <div className={styles.statInfo}>
                    <h3>Total Listings</h3>
                    <p>{loading ? "—" : totalListings}</p>
                    <small>{activeListings} active</small>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statIcon} style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}>
                    <TrendingUp size={22} />
                  </div>
                  <div className={styles.statInfo}>
                    <h3>Active Listings</h3>
                    <p>{loading ? "—" : activeListings}</p>
                    <small>currently on market</small>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statIcon} style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
                    <Store size={22} />
                  </div>
                  <div className={styles.statInfo}>
                    <h3>Sellers</h3>
                    <p>{loading ? "—" : sellerCount}</p>
                    <small>verified accounts</small>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statIcon} style={{ background: "rgba(96,165,250,0.12)", color: "#93c5fd" }}>
                    <Eye size={22} />
                  </div>
                  <div className={styles.statInfo}>
                    <h3>Total Views</h3>
                    <p>{loading ? "—" : totalViews.toLocaleString()}</p>
                    <small>ad impressions</small>
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statIcon} style={{ background: "rgba(244,114,182,0.12)", color: "#f472b6" }}>
                    <Heart size={22} />
                  </div>
                  <div className={styles.statInfo}>
                    <h3>Total Likes</h3>
                    <p>{loading ? "—" : totalLikes.toLocaleString()}</p>
                    <small>student bookmarks</small>
                  </div>
                </div>
              </div>

              {/* 2-Col: Quick Actions + Recent Activity */}
              <div className={styles.grid2Col}>
                {/* Quick Actions */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Quick Actions</h2>
                    <ArrowRight size={16} style={{ color: "#64748b" }} />
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
                      onClick={() => setActiveTab("students")}
                      className={styles.btnOutline}
                    >
                      <span>Manage Students</span>
                      <Users size={15} />
                    </button>
                    <button
                      onClick={() => setActiveTab("broadcast")}
                      className={styles.btnOutline}
                    >
                      <span>Send Campus Broadcast</span>
                      <Megaphone size={15} />
                    </button>
                    <Link href="/seller/products/new" className={styles.btnOutline}>
                      <span>Add New Listing</span>
                      <Plus size={15} />
                    </Link>
                    <Link href="/marketplace" className={styles.btnOutline}>
                      <span>View Marketplace</span>
                      <ExternalLink size={15} />
                    </Link>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Recent Listings</h2>
                    <Activity size={16} style={{ color: "#fb923c" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {loading ? (
                      <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Loading…</p>
                    ) : recentActivity.length === 0 ? (
                      <div className={styles.emptyBox}>
                        <Package size={28} />
                        <p>No listings yet</p>
                      </div>
                    ) : (
                      recentActivity.map((p) => (
                        <div key={p.id} className={styles.activityItem}>
                          <div
                            className={styles.activityIcon}
                            style={{ background: "rgba(249,115,22,0.12)", color: "#fb923c" }}
                          >
                            <Package size={15} />
                          </div>
                          <div className={styles.activityBody}>
                            <div className={styles.activityTitle}>{p.title}</div>
                            <div className={styles.activitySub}>
                              {formatPrice(p.price)} · {p.sellerName} · {p.status}
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
                <p style={{ color: "#94a3b8" }}>Loading listings…</p>
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
                        <th>Status</th>
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
                                  <Package size={18} style={{ color: "#475569" }} />
                                </div>
                              )}
                              <div>
                                <div className={styles.productName}>{p.title}</div>
                                <div className={styles.productMeta}>{p.category?.name}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, color: "#34d399" }}>
                            {formatPrice(p.price)}
                          </td>
                          <td style={{ color: "#f8fafc" }}>{p.sellerName}</td>
                          <td>{p.location}</td>
                          <td>{statusBadge(p.status, styles)}</td>
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

          {/* ── TAB: STUDENTS ───────────────────────────────────────── */}
          {activeTab === "students" && (
            <>
              <div className={styles.pageHeader}>
                <div>
                  <h1 className={styles.pageTitle}>Student Accounts</h1>
                  <p className={styles.pageSubtitle}>
                    {loading ? "Loading…" : `${usersList.length} registered · ${sellerCount} sellers`}
                  </p>
                </div>
              </div>

              {loading ? (
                <p style={{ color: "#94a3b8" }}>Loading students…</p>
              ) : usersList.length === 0 ? (
                <div className={styles.emptyBox}>
                  <Users size={36} />
                  <p>No student accounts yet</p>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Phone</th>
                        <th>Location</th>
                        <th>Listings</th>
                        <th>Sold</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((u) => (
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
                          <td style={{ color: "#fb923c", fontWeight: 700 }}>
                            {u.activeListings ?? 0}
                          </td>
                          <td style={{ color: "#34d399", fontWeight: 700 }}>
                            {u.soldItems ?? 0}
                          </td>
                          <td>
                            {u.isSeller || u.seller ? (
                              <span className={styles.badgeSeller}>Seller</span>
                            ) : (
                              <span className={styles.badgeStudent}>Student</span>
                            )}
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
                    Send instant alerts and announcements to all registered students
                  </p>
                </div>
              </div>

              <div className={styles.broadcastWrap}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Megaphone size={18} style={{ color: "#fb923c" }} />
                        Compose Broadcast
                      </span>
                    </h2>
                  </div>

                  {broadcastSuccess && (
                    <div className={styles.successBanner}>
                      <CheckCircle2 size={16} />
                      <span>Broadcast successfully dispatched to all student accounts!</span>
                    </div>
                  )}

                  <form onSubmit={handleSendBroadcast}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Broadcast Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. End of Semester Textbook Drive"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        className={styles.formInput}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Message Body</label>
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
                      {broadcastSending ? "Dispatching…" : "Send to All Students"}
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
