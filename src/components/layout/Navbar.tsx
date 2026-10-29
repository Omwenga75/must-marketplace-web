"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShoppingBag,
  Search,
  Heart,
  MessageCircle,
  Bell,
  User,
  Plus,
  PlusCircle,
  Menu,
  X,
  Sun,
  Moon,
  ShieldCheck,
  Store,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { subscribeToConversations, subscribeToNotifications, getLocalNotifications, createNotification } from "@/lib/firebase/services";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { favoriteIds } = useFavorites();

  const isMarketplace = pathname?.startsWith("/marketplace");

  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // Initialize theme from documentElement class and synchronize with system settings
  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);

    // If user hasn't explicitly set a preference, dynamically follow phone system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem("must_theme");
      if (!savedTheme) {
        if (e.matches) {
          document.documentElement.classList.add("dark");
          setIsDarkMode(true);
        } else {
          document.documentElement.classList.remove("dark");
          setIsDarkMode(false);
        }
      }
    };

    mediaQuery.addEventListener?.("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener?.("change", handleSystemThemeChange);
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
  };

  // Subscribe to live unread counts if user is logged in
  useEffect(() => {
    if (!user?.id) {
      setUnreadMessages(0);
      setUnreadNotifs(0);
      return;
    }

    const unsubConvs = subscribeToConversations(user.id, (convs) => {
      const totalUnread = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setUnreadMessages(totalUnread);
    });

    const unsubNotifs = subscribeToNotifications(user.id, (notifs) => {
      const unreadCount = notifs.filter((n) => !n.isRead).length;
      setUnreadNotifs(unreadCount);
    });

    // Recovery: if a real user has no notifications after Firebase settles,
    // create a welcome notification so they never see a permanently empty inbox.
    const recoveryTimer = !user.id.startsWith("demo_")
      ? setTimeout(() => {
          const current = getLocalNotifications(user.id);
          if (current.length === 0) {
            createNotification(user.id, {
              title: "Welcome to MUST Marketplace! 🎉",
              message:
                "Buy & sell affordable electronics, books, furniture & campus essentials safely with fellow students across Main Gate, Nchiru & California.",
              type: "welcome",
              priority: "NORMAL",
            }).catch(() => {});
          }
        }, 3000)
      : null;

    return () => {
      unsubConvs();
      unsubNotifs();
      if (recoveryTimer) clearTimeout(recoveryTimer);
    };
  }, [user?.id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 glass-nav transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-1.5 sm:gap-2.5 font-bold tracking-tight text-slate-900 dark:text-white shrink-0 group"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center bg-white dark:bg-slate-800 p-0.5 border border-emerald-500/20">
              <img
                src="/logo.png"
                alt="MUST Marketplace"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm sm:text-base lg:text-lg font-black tracking-tight flex items-center gap-1">
                MUST <span className="text-secondary font-bold">Marketplace</span>
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wider uppercase">
                Meru University
              </span>
            </div>
          </Link>

          {/* Desktop Search Bar - Only in Marketplace */}
          {isMarketplace ? (
            <form
              onSubmit={handleSearchSubmit}
              className="hidden md:flex flex-1 max-w-md mx-4 relative"
            >
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search any item here..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                />
              </div>
            </form>
          ) : (
            <div className="flex-1" />
          )}

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/marketplace"
              className={`px-3 py-2 rounded-lg transition-colors ${
                pathname === "/marketplace"
                  ? "bg-primary text-primary-dark font-semibold dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Marketplace
            </Link>
            <Link
              href="/saved"
              className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                pathname === "/saved"
                  ? "bg-primary text-primary-dark font-semibold dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>Saved</span>
              {mounted && favoriteIds.size > 0 && (
                <span className="px-1.5 py-0.2 text-[11px] font-bold rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                  {favoriteIds.size}
                </span>
              )}
            </Link>
            <Link
              href="/about"
              className={`px-3 py-2 rounded-lg transition-colors ${
                pathname === "/about"
                  ? "bg-primary text-primary-dark font-semibold dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              About Us
            </Link>
            <Link
              href="/contact"
              className={`px-3 py-2 rounded-lg transition-colors ${
                pathname === "/contact"
                  ? "bg-primary text-primary-dark font-semibold dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Contact Us
            </Link>
          </nav>

          {/* Right Action Icons & Auth */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Post Item Circular Button */}
            <Link
              href={
                user?.isSeller
                  ? "/seller/products/new"
                  : user
                  ? "/seller/activate"
                  : "/register?role=seller"
              }
              className="hidden sm:inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-secondary text-white hover:bg-secondary-dark shadow-sm hover:scale-105 transition-all shrink-0"
              title="Post Item"
              aria-label="Post Item"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </Link>

            {/* Messages Icon (Desktop only, mobile has it in bottom nav) */}
            {user && (
              <Link
                href="/messages"
                className="hidden sm:inline-flex relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Messages"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadMessages}
                  </span>
                )}
              </Link>
            )}

            {/* Notifications Icon */}
            {user && (
              <Link
                href="/notifications"
                className="relative p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center">
                    {unreadNotifs}
                  </span>
                )}
              </Link>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 hidden dark:block" />
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-300 block dark:hidden" />
            </button>

            {/* User Dropdown / Login */}
            {!mounted ? (
              /* Neutral placeholder during SSR/initial hydration — prevents flash of login buttons */
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="hidden sm:block w-16 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              </div>
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-1 sm:gap-2 p-1 sm:pl-2 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary-container text-primary-dark font-bold text-xs flex items-center justify-center overflow-hidden">
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt={user.fullName} className="w-full h-full object-cover" />
                    ) : (
                      user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline-block">
                    {user.fullName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-0.5 sm:mr-1" />
                </button>

                {profileDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-fade-in"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {user.fullName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                      <div className="mt-1 flex gap-1">
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {user.isSeller ? "Buyer · Seller" : "Buyer"}
                        </span>
                        {user.isAdmin && (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary-container text-primary-dark">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      href="/profile"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>My Profile</span>
                    </Link>

                    {user.isSeller ? (
                      <Link
                        href="/seller/dashboard"
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Store className="w-4 h-4 text-emerald-600" />
                        <span>Dashboard</span>
                      </Link>
                    ) : (
                      <Link
                        href="/seller/activate"
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-600 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      >
                        <Store className="w-4 h-4 text-emerald-600" />
                        <span>Become a Seller</span>
                      </Link>
                    )}

                    {user.isAdmin && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-secondary font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/40"
                      >
                        <ShieldCheck className="w-4 h-4 text-secondary" />
                        <span>Admin Portal</span>
                      </Link>
                    )}

                    <Link
                      href="/saved"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Heart className="w-4 h-4 text-rose-500" />
                      <span>Saved Products ({mounted ? favoriteIds.size : 0})</span>
                    </Link>

                    <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                    <button
                      onClick={() => logout()}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search & Slide-down Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3 pb-6 space-y-3 animate-fade-in">
            {isMarketplace && (
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search any item here..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </form>
            )}

            <div className="flex flex-col gap-1 text-sm font-medium pt-2">
              <Link
                href="/marketplace"
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  pathname === "/marketplace"
                    ? "bg-primary/20 text-primary-dark font-semibold dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "text-slate-800 dark:text-slate-200"
                }`}
              >
                Marketplace
              </Link>
              <Link
                href="/saved"
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between ${
                  pathname === "/saved"
                    ? "bg-primary/20 text-primary-dark font-semibold dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "text-slate-800 dark:text-slate-200"
                }`}
              >
                <span>Saved</span>
                {mounted && favoriteIds.size > 0 && (
                  <span className="text-xs bg-rose-100 dark:bg-rose-950 text-rose-600 px-2 py-0.5 rounded-full font-bold">
                    {favoriteIds.size}
                  </span>
                )}
              </Link>
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  pathname === "/about"
                    ? "bg-primary/20 text-primary-dark font-semibold dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "text-slate-800 dark:text-slate-200"
                }`}
              >
                About Us
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  pathname === "/contact"
                    ? "bg-primary/20 text-primary-dark font-semibold dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "text-slate-800 dark:text-slate-200"
                }`}
              >
                Contact Us
              </Link>

              {user ? (
                <>
                  <Link
                    href={user.isSeller ? "/seller/dashboard" : "/seller/activate"}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold"
                  >
                    {user.isSeller ? "Dashboard" : "Become a Seller"}
                  </Link>

                  {user.isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-3 py-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-secondary font-semibold"
                    >
                      Admin Portal
                    </Link>
                  )}
                </>
              ) : loading ? null : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-center py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-center py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Bottom Navigation Bar (Matching Android Bottom Navigation Bar) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-around text-[10px] font-medium text-slate-500 dark:text-slate-400">
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 p-1 ${
            pathname === "/" ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Home</span>
        </Link>

        <Link
          href="/marketplace"
          className={`flex flex-col items-center gap-0.5 p-1 ${
            pathname.startsWith("/marketplace")
              ? "text-emerald-600 dark:text-emerald-400 font-bold"
              : ""
          }`}
        >
          <Search className="w-5 h-5" />
          <span>Explore</span>
        </Link>

        <Link
          href={
            user?.isSeller
              ? "/seller/products/new"
              : user
              ? "/seller/activate"
              : "/register?role=seller"
          }
          className="flex flex-col items-center gap-0.5 -mt-4"
        >
          <div className="w-11 h-11 rounded-full bg-secondary text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Post Item
          </span>
        </Link>

        <Link
          href="/messages"
          className={`flex flex-col items-center gap-0.5 p-1 relative ${
            pathname.startsWith("/messages")
              ? "text-emerald-600 dark:text-emerald-400 font-bold"
              : ""
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          {unreadMessages > 0 && (
            <span className="absolute top-0 right-1 w-3.5 h-3.5 rounded-full bg-secondary text-white text-[9px] font-bold flex items-center justify-center">
              {unreadMessages}
            </span>
          )}
          <span>Chats</span>
        </Link>

        <Link
          href={user ? "/profile" : "/login"}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            pathname === "/profile" ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""
          }`}
        >
          <User className="w-5 h-5" />
          <span>{!mounted ? "" : user ? "Profile" : "Sign In"}</span>
        </Link>
      </nav>
    </>
  );
}
