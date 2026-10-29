"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Check,
  Trash2,
  BellOff,
  MailCheck,
  Star,
  Tag,
  Megaphone,
  Package,
  CheckCheck,
  Clock,
  Inbox,
  CalendarDays,
  CalendarClock,
  CircleDot,
  Filter,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AppNotification } from "@/types";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeToNotifications,
  getLocalNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
  deleteNotification,
} from "@/lib/firebase/services";
import { formatRelativeTime } from "@/lib/utils";

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    gradient: string;
    iconColor: string;
    label: string;
    accentClass: string;
  }
> = {
  welcome: {
    icon: <Sparkles className="w-[18px] h-[18px]" />,
    gradient: "from-emerald-400 to-teal-500",
    iconColor: "text-white",
    label: "Welcome",
    accentClass: "border-l-emerald-500",
  },
  message: {
    icon: <MessageCircle className="w-[18px] h-[18px]" />,
    gradient: "from-blue-400 to-indigo-500",
    iconColor: "text-white",
    label: "Message",
    accentClass: "border-l-blue-500",
  },
  security: {
    icon: <ShieldCheck className="w-[18px] h-[18px]" />,
    gradient: "from-amber-400 to-orange-500",
    iconColor: "text-white",
    label: "Safety",
    accentClass: "border-l-amber-500",
  },
  listing: {
    icon: <Package className="w-[18px] h-[18px]" />,
    gradient: "from-violet-400 to-purple-500",
    iconColor: "text-white",
    label: "New Listing",
    accentClass: "border-l-violet-500",
  },
  price: {
    icon: <Tag className="w-[18px] h-[18px]" />,
    gradient: "from-rose-400 to-pink-500",
    iconColor: "text-white",
    label: "Price Drop",
    accentClass: "border-l-rose-500",
  },
  tip: {
    icon: <Star className="w-[18px] h-[18px]" />,
    gradient: "from-yellow-400 to-amber-500",
    iconColor: "text-white",
    label: "Tip",
    accentClass: "border-l-yellow-500",
  },
  system: {
    icon: <Megaphone className="w-[18px] h-[18px]" />,
    gradient: "from-slate-400 to-slate-500",
    iconColor: "text-white",
    label: "Announcement",
    accentClass: "border-l-slate-400",
  },
};

function getConfig(type: string) {
  return (
    TYPE_CONFIG[type.toLowerCase()] ?? {
      icon: <Bell className="w-[18px] h-[18px]" />,
      gradient: "from-slate-400 to-slate-500",
      iconColor: "text-white",
      label: "Update",
      accentClass: "border-l-slate-400",
    }
  );
}

// ─── Time group helper ────────────────────────────────────────────────────────
function getGroup(ts: number): "today" | "yesterday" | "this_week" | "earlier" {
  const diff = Date.now() - ts;
  if (diff < 24 * 3600 * 1000) return "today";
  if (diff < 48 * 3600 * 1000) return "yesterday";
  if (diff < 7 * 24 * 3600 * 1000) return "this_week";
  return "earlier";
}

const GROUP_LABELS: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  earlier: "Earlier",
};

// ─── Filter options ───────────────────────────────────────────────────────────
type FilterKey = "all" | "unread" | "read" | "today" | "this_week";

// ─── Shimmer ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 animate-pulse">
      <div className="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-slate-700 shrink-0" />
      <div className="flex-1 space-y-3 pt-0.5">
        <div className="flex justify-between gap-4">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded-full w-2/5" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-12 shrink-0" />
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-full" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-3/4" />
      </div>
    </div>
  );
}

// ─── Notification Card ────────────────────────────────────────────────────────
function NotificationCard({
  notif,
  onMarkRead,
  onDelete,
}: {
  notif: AppNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = getConfig(notif.type);
  const isRead = notif.isRead;

  return (
    <div
      onClick={() => !isRead && onMarkRead(notif.id)}
      className={`group relative flex items-start gap-4 p-5 rounded-2xl border-l-4 border border-slate-100 dark:border-slate-800/80 transition-all duration-200 ${
        isRead
          ? `${cfg.accentClass} opacity-60 bg-white dark:bg-slate-900 hover:opacity-95`
          : `${cfg.accentClass} bg-white dark:bg-slate-900 shadow-xs hover:shadow-md cursor-pointer hover:border-slate-300 dark:hover:border-slate-700`
      }`}
    >
      {/* Icon bubble */}
      <div
        className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shrink-0 shadow-sm ${
          isRead ? "opacity-50" : "shadow-md"
        }`}
      >
        <span className={cfg.iconColor}>{cfg.icon}</span>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <p
              className={`text-sm leading-snug truncate ${
                isRead
                  ? "font-medium text-slate-500 dark:text-slate-400"
                  : "font-bold text-slate-900 dark:text-white"
              }`}
            >
              {notif.title}
            </p>
            {!isRead && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap mt-0.5">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(notif.timestamp)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notif.id);
              }}
              title="Delete notification"
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p
          className={`text-xs leading-relaxed line-clamp-2 ${
            isRead ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"
          }`}
        >
          {notif.message}
        </p>

        <div className="flex items-center gap-2 pt-0.5">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider bg-gradient-to-r ${cfg.gradient} text-white`}
          >
            {cfg.label}
          </span>
          {!isRead && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Tap to mark read
            </span>
          )}
          {isRead && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
              <CheckCheck className="w-3 h-3" /> Read
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: FilterKey }) {
  const msgs: Record<FilterKey, { icon: React.ReactNode; title: string; sub: string }> = {
    all: {
      icon: <BellOff className="w-10 h-10 text-slate-400" />,
      title: "No Notifications",
      sub: "You'll see messages, listings & campus updates here.",
    },
    unread: {
      icon: <MailCheck className="w-10 h-10 text-emerald-500" />,
      title: "All Caught Up!",
      sub: "No unread notifications right now.",
    },
    read: {
      icon: <CheckCheck className="w-10 h-10 text-slate-400" />,
      title: "Nothing Read Yet",
      sub: "Tap any notification to mark it as read.",
    },
    today: {
      icon: <CalendarDays className="w-10 h-10 text-slate-400" />,
      title: "Nothing Today",
      sub: "No notifications from today yet.",
    },
    this_week: {
      icon: <CalendarClock className="w-10 h-10 text-slate-400" />,
      title: "Nothing This Week",
      sub: "No notifications from this week.",
    },
  };
  const m = msgs[filter];
  return (
    <div className="w-full flex flex-col items-center justify-center py-16 sm:py-20 text-center space-y-4 px-4 sm:px-6 mx-auto">
      <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mx-auto">
        {m.icon}
      </div>
      <div className="space-y-1 max-w-sm flex flex-col items-center text-center mx-auto">
        <h3 className="text-base font-black text-slate-900 dark:text-white">{m.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{m.sub}</p>
      </div>
    </div>
  );
}

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────
function SideItem({
  label,
  icon,
  count,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
        active
          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span className={active ? "opacity-100" : "opacity-60"}>{icon}</span>
        {label}
      </span>
      {typeof count === "number" && count > 0 && (
        <span
          className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
            active
              ? "bg-white/20 dark:bg-black/20"
              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Divider label ────────────────────────────────────────────────────────────
function GroupLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const initial = getLocalNotifications(user.id);
    setNotifications(initial);
    setLoading(false);

    const unsub = subscribeToNotifications(user.id, (list) => {
      setNotifications(list);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const readCount = notifications.filter((n) => n.isRead).length;
  const todayCount = notifications.filter((n) => getGroup(n.timestamp) === "today").length;
  const thisWeekCount = notifications.filter((n) =>
    ["today", "yesterday", "this_week"].includes(getGroup(n.timestamp))
  ).length;

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case "unread":
        return notifications.filter((n) => !n.isRead);
      case "read":
        return notifications.filter((n) => n.isRead);
      case "today":
        return notifications.filter((n) => getGroup(n.timestamp) === "today");
      case "this_week":
        return notifications.filter((n) =>
          ["today", "yesterday", "this_week"].includes(getGroup(n.timestamp))
        );
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  // Group for display (only used in "all" view)
  const grouped = useMemo(() => {
    if (activeFilter !== "all") return null;
    const map: Record<string, AppNotification[]> = {};
    const order: string[] = [];
    for (const n of filtered) {
      const g = GROUP_LABELS[getGroup(n.timestamp)];
      if (!map[g]) {
        map[g] = [];
        order.push(g);
      }
      map[g].push(n);
    }
    return order.map((g) => ({ label: g, items: map[g] }));
  }, [filtered, activeFilter]);

  const handleMarkOne = (id: string) => {
    setNotifications((prev) => (prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))));
    if (user) markNotificationAsRead(user.id, id).catch(() => {});
  };
  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (user) markAllNotificationsAsRead(user.id).catch(() => {});
  };
  const handleDeleteOne = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (user?.id) deleteNotification(user.id, id).catch(() => {});
  };
  const handleClearAll = () => {
    setNotifications([]);
    if (user?.id) clearAllNotifications(user.id).catch(() => {});
  };

  if (!user) {
    // While auth is still resolving from localStorage / Firebase, show skeletons
    // so a logged-in user never sees the "Sign In Required" flash on page refresh.
    if (authLoading) {
      return (
        <div className="w-full px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-stretch md:items-start">
            <aside className="hidden md:block w-60 lg:w-64 shrink-0 space-y-3 animate-pulse">
              <div className="flex items-center gap-3 px-1 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-28" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-20" />
                </div>
              </div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              ))}
            </aside>
            <main className="w-full flex-1 min-w-0 space-y-3">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </main>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mx-auto">
          <Bell className="w-9 h-9 text-secondary" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Sign In Required</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Log in to see your campus notifications.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm hover:bg-emerald-700 transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
      <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-stretch md:items-start">
        {/* ── LEFT SIDEBAR (Desktop only) ─────────────────────────────────── */}
        <aside className="hidden md:block w-60 lg:w-64 shrink-0 md:sticky md:top-24 self-start">
          {/* Top Title Card */}
          <div className="flex items-center gap-3 px-1 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-secondary/10 dark:bg-secondary/20 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                Notifications
              </h1>
              {unreadCount > 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  {unreadCount} new
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">All caught up</p>
              )}
            </div>
          </div>

          {/* Filter Navigation */}
          <nav className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3.5 mb-2">
              Filters
            </p>

            <SideItem
              label="All"
              icon={<Inbox className="w-4 h-4" />}
              count={notifications.length}
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            />
            <SideItem
              label="Unread"
              icon={<CircleDot className="w-4 h-4" />}
              count={unreadCount}
              active={activeFilter === "unread"}
              onClick={() => setActiveFilter("unread")}
            />
            <SideItem
              label="Read"
              icon={<CheckCheck className="w-4 h-4" />}
              count={readCount}
              active={activeFilter === "read"}
              onClick={() => setActiveFilter("read")}
            />

            <div className="my-3 h-px bg-slate-200 dark:bg-slate-800 mx-2" />

            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3.5 mb-2">
              By Time
            </p>

            <SideItem
              label="Today"
              icon={<CalendarDays className="w-4 h-4" />}
              count={todayCount}
              active={activeFilter === "today"}
              onClick={() => setActiveFilter("today")}
            />
            <SideItem
              label="This Week"
              icon={<CalendarClock className="w-4 h-4" />}
              count={thisWeekCount}
              active={activeFilter === "this_week"}
              onClick={() => setActiveFilter("this_week")}
            />
          </nav>

          {/* Actions */}
          {notifications.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3.5 mb-2">
                Actions
              </p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors text-left"
                >
                  <Check className="w-4 h-4" />
                  Mark all as read
                </button>
              )}
              <button
                onClick={handleClearAll}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 transition-colors text-left"
              >
                <Trash2 className="w-4 h-4" />
                Clear all
              </button>
            </div>
          )}
        </aside>

        {/* ── RIGHT: Notification Cards ─────────────────────────────────────── */}
        <main className="w-full flex-1 min-w-0 space-y-4">
          {/* ── MOBILE TOP BAR (Phone only: Shows right at the top) ────────── */}
          <div className="flex md:hidden items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Filters</span>
              <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black leading-none">
                {activeFilter === "all"
                  ? `All (${notifications.length})`
                  : activeFilter === "unread"
                  ? `Unread (${unreadCount})`
                  : activeFilter === "read"
                  ? `Read (${readCount})`
                  : activeFilter === "today"
                  ? `Today (${todayCount})`
                  : `Week (${thisWeekCount})`}
              </span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  title="Clear all notifications"
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Cards List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : grouped ? (
            <div className="space-y-6">
              {grouped.map(({ label, items }) => (
                <div key={label} className="space-y-2.5">
                  <GroupLabel label={label} />
                  {items.map((n) => (
                    <NotificationCard
                      key={n.id}
                      notif={n}
                      onMarkRead={handleMarkOne}
                      onDelete={handleDeleteOne}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((n) => (
                <NotificationCard
                  key={n.id}
                  notif={n}
                  onMarkRead={handleMarkOne}
                  onDelete={handleDeleteOne}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── MOBILE LEFT DRAWER ──────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Panel Sliding in from Left */}
          <div className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col p-5 overflow-y-auto z-10 border-r border-slate-200 dark:border-slate-800 animate-in slide-in-from-left duration-200">
            {/* Header: Title + Unread + Close Button */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-secondary/10 dark:bg-secondary/20 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                    Notifications
                  </h2>
                  {unreadCount > 0 ? (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      {unreadCount} new
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-0.5">All caught up</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Navigation */}
            <nav className="space-y-1 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3.5 mb-2">
                Filters
              </p>

              <SideItem
                label="All"
                icon={<Inbox className="w-4 h-4" />}
                count={notifications.length}
                active={activeFilter === "all"}
                onClick={() => {
                  setActiveFilter("all");
                  setDrawerOpen(false);
                }}
              />
              <SideItem
                label="Unread"
                icon={<CircleDot className="w-4 h-4" />}
                count={unreadCount}
                active={activeFilter === "unread"}
                onClick={() => {
                  setActiveFilter("unread");
                  setDrawerOpen(false);
                }}
              />
              <SideItem
                label="Read"
                icon={<CheckCheck className="w-4 h-4" />}
                count={readCount}
                active={activeFilter === "read"}
                onClick={() => {
                  setActiveFilter("read");
                  setDrawerOpen(false);
                }}
              />

              <div className="my-3.5 h-px bg-slate-200 dark:bg-slate-800 mx-2" />

              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3.5 mb-2">
                By Time
              </p>

              <SideItem
                label="Today"
                icon={<CalendarDays className="w-4 h-4" />}
                count={todayCount}
                active={activeFilter === "today"}
                onClick={() => {
                  setActiveFilter("today");
                  setDrawerOpen(false);
                }}
              />
              <SideItem
                label="This Week"
                icon={<CalendarClock className="w-4 h-4" />}
                count={thisWeekCount}
                active={activeFilter === "this_week"}
                onClick={() => {
                  setActiveFilter("this_week");
                  setDrawerOpen(false);
                }}
              />
            </nav>

            {/* Actions */}
            {notifications.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3.5 mb-2">
                  Actions
                </p>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      handleMarkAllRead();
                      setDrawerOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors text-left"
                  >
                    <Check className="w-4 h-4" />
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={() => {
                    handleClearAll();
                    setDrawerOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
