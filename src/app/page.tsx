"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Zap,
  MapPin,
  TrendingUp,
  Sparkles,
  Users,
  Store,
  ChevronRight,
  CheckCircle2,
  Smartphone,
  Shirt,
  BookOpen,
  Home,
  Armchair,
  Dumbbell,
  Package,
} from "lucide-react";
import { Product } from "@/types";
import { SAMPLE_CATEGORIES, UNIVERSITY_LOCATIONS } from "@/lib/constants";
import { fetchProducts } from "@/lib/firebase/services";
import ProductCard from "@/components/products/ProductCard";
import ProductGrid from "@/components/products/ProductGrid";
import { useAuth } from "@/context/AuthContext";

// Professional icon + gradient mapping for each category
const categoryIcons: Record<string, { icon: React.ComponentType<{ className?: string }>; gradient: string }> = {
  "1": { icon: Smartphone, gradient: "from-blue-500 to-blue-600" },
  "2": { icon: Shirt, gradient: "from-pink-500 to-rose-500" },
  "3": { icon: BookOpen, gradient: "from-amber-500 to-orange-500" },
  "4": { icon: Home, gradient: "from-emerald-500 to-teal-500" },
  "5": { icon: Armchair, gradient: "from-violet-500 to-purple-500" },
  "7": { icon: Dumbbell, gradient: "from-red-500 to-rose-600" },
  "8": { icon: Package, gradient: "from-slate-500 to-slate-600" },
};

export default function HomePage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Deterministic sorting: Recent by createdAt, Featured by views/popularity
  const sortedByRecent = [...products].sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  const sortedByPopular = [...products].sort((a, b) => {
    return (b.views || 0) + (b.likes || 0) - ((a.views || 0) + (a.likes || 0));
  });

  const featuredProducts = sortedByPopular.slice(0, 4);
  const recentProducts = sortedByRecent.slice(0, 4);

  const getCategoryCount = (catId: string) => {
    return products.filter((p) => p.category?.id === catId).length;
  };

  return (
    <div className="w-full space-y-8 sm:space-y-16 pb-4 sm:pb-12">
      {/* ── HERO SECTION ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/30 via-primary/10 to-transparent dark:from-emerald-950/40 dark:via-slate-900/50 dark:to-transparent border-b border-slate-200/60 dark:border-slate-800/60 pt-6 pb-12 sm:pt-8 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
                Buy. Sell. Connect. <br />
                <span className="text-secondary">Your Campus</span> Marketplace.
              </h1>

              {/* Description */}
              <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                The easiest way to buy & sell books, smartphones, house appliances, laptops,
                and other second-hand items with fellow comrades across Main Gate, Nchiru, California, and other places.
              </p>

              {/* Hero Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                <Link
                  href="/marketplace"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>Explore Marketplace</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href={user?.isSeller ? "/seller/products/new" : "/seller/activate"}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Store className="w-5 h-5 text-secondary" />
                  <span>{user?.isSeller ? "Post a Listing" : "Sell an Item"}</span>
                </Link>
              </div>

              {/* University Highlights */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-left">
                <div className="space-y-0.5">
                  <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
                    120+
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Items Listed
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
                    KSh 0
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Listing Commission
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-lg sm:text-2xl font-black text-secondary">
                    Campus-Wide
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Instant Chat & Meet
                  </p>
                </div>
              </div>
            </div>

            {/* Right Card / Visual Showcase */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-sm sm:max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-floating">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Live Campus Deals
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
                    MUST Verified
                  </span>
                </div>

                {/* Preview Mini Carousel / Product Sample */}
                <div className="mt-4 space-y-3">
                  {products.slice(0, 3).map((item) => (
                    <Link
                      key={item.id}
                      href={`/product/${item.id}`}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                      <img
                        src={item.imageUrls[0]}
                        alt={item.title}
                        className="w-14 h-14 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          KSh {item.price.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-secondary" />
                          <span>{item.location}</span>
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </Link>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Meet at Public Places.</span>
                  <Link
                    href="/marketplace"
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    View 50+ items →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BROWSE BY CATEGORIES ───────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Popular Categories
              </h2>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {SAMPLE_CATEGORIES.length} Categories
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Browse essential student gear organized by category
            </p>
          </div>
          <Link
            href="/marketplace"
            className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 leading-none"
          >
            <span>All Categories</span>
            <ChevronRight className="w-4 h-4 translate-y-px shrink-0" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {SAMPLE_CATEGORIES.map((cat) => {
            const iconConfig = categoryIcons[cat.id] || { icon: Package, gradient: "from-slate-500 to-slate-600" };
            const IconComponent = iconConfig.icon;
            const count = getCategoryCount(cat.id);
            return (
              <Link
                key={cat.id}
                href={`/marketplace?category=${cat.id}`}
                className="group flex flex-col items-center p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-center"
              >
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${iconConfig.gradient} flex items-center justify-center group-hover:scale-110 group-hover:shadow-md transition-all duration-200 mb-2`}>
                  <IconComponent className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate w-full">
                  {cat.name}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                  {count} {count === 1 ? "Item" : "Items"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Featured Student Listings
              </h2>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                {featuredProducts.length} Items
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Top picks from verified student sellers on campus
            </p>
          </div>
          <Link
            href="/marketplace"
            className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 leading-none"
          >
            <span>See more</span>
            <ChevronRight className="w-4 h-4 translate-y-px shrink-0" />
          </Link>
        </div>

        <ProductGrid products={featuredProducts} loading={loading} columns={4} />
      </section>

      {/* ── RECENTLY ADDED LISTINGS ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Recently Added on Campus
              </h2>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                {recentProducts.length} Items
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Fresh listings posted within the last few days
            </p>
          </div>
          <Link
            href="/marketplace"
            className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 leading-none"
          >
            <span>Browse All</span>
            <ChevronRight className="w-4 h-4 translate-y-px shrink-0" />
          </Link>
        </div>

        <ProductGrid products={recentProducts} loading={loading} columns={4} />
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-10 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mb-8">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              How MUST Marketplace Works
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Engineered specifically for comrades to exchange items without scams or middleman cuts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-black flex items-center justify-center text-lg">
                1
              </div>
              <h3 className="font-bold text-base text-white">Find What You Need</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Filter by condition (New or Second Hand), category, and campus hostels (Main Gate,
                Nchiru, California, Mascan).
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-secondary text-white font-black flex items-center justify-center text-lg">
                2
              </div>
              <h3 className="font-bold text-base text-white">Chat in Real-Time</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Message the student seller directly in the web app with photos and product context.
                Negotiate easily.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-primary-container text-primary-dark font-black flex items-center justify-center text-lg">
                3
              </div>
              <h3 className="font-bold text-base text-white">Meet On-Campus & Transact</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Inspect the item at the Library Foyer, Student Center, or Gate A. Pay via M-Pesa once
                you're fully satisfied.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SELLER CTA BANNER ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-card">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
              Have something to sell?
            </h3>
            <p className="text-emerald-100 text-xs sm:text-sm max-w-lg">
              Declutter your room or house, sell your textbooks to junior students, and make instant cash. Activate your
              seller profile in under 30 seconds.
            </p>
          </div>
          <Link
            href={user?.isSeller ? "/seller/products/new" : "/seller/activate"}
            className="px-6 py-3.5 rounded-xl bg-secondary hover:bg-secondary-dark text-white font-extrabold text-sm sm:text-base shrink-0 shadow-lg hover:scale-105 transition-all"
          >
            {user?.isSeller ? "Add New Product" : "Become a Seller Now"}
          </Link>
        </div>
      </section>
    </div>
  );
}
