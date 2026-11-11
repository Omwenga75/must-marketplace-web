"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  Share2,
  MapPin,
  ShieldCheck,
  MessageCircle,
  Phone,
  ArrowLeft,
  Eye,
  Calendar,
  Check,
  AlertCircle,
  Store,
} from "lucide-react";
import { Product } from "@/types";
import { getProductById, recordProductView, getProductLikes } from "@/lib/firebase/services";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { CATEGORY_FALLBACK_IMAGES } from "@/lib/constants";
import { database } from "@/lib/firebase/config";
import { ref, onValue } from "firebase/database";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const { user, loading: authLoading } = useAuth();
  const { isFavorite, toggle } = useFavorites();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTogglingFav, setIsTogglingFav] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [copiedShare, setCopiedShare] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRecordedViewRef = useRef(false);

  useEffect(() => {
    if (product) {
      setLikesCount(Number(product.likes) || 0);
    }
  }, [product]);

  // Real-time listener for live likes & views updates
  useEffect(() => {
    if (!database || !productId) return;
    try {
      const prodRef = ref(database, `products/${productId}`);
      const unsub = onValue(prodRef, (snap) => {
        const val = snap.val();
        if (val && typeof val === "object") {
          if (typeof val.likes === "number") setLikesCount(val.likes);
          setProduct((prev) => prev ? { ...prev, likes: val.likes, views: val.views } : prev);
        }
      });
      return () => unsub();
    } catch {}
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    const handleLikesChanged = (e: any) => {
      if (e?.detail?.productId === productId && typeof e.detail.likes === "number") {
        setLikesCount(e.detail.likes);
      }
    };
    window.addEventListener("must_product_likes_changed", handleLikesChanged);
    return () => {
      window.removeEventListener("must_product_likes_changed", handleLikesChanged);
    };
  }, [productId]);

  const handleToggleFavorite = async () => {
    if (!product || isTogglingFav) return;
    if (!user) {
      router.push(`/login?redirect=/product/${product.id}`);
      return;
    }
    // Do NOT do any local optimistic counter increment here.
    // The authoritative count comes from two places:
    //   1. Real-time onValue on products/${productId} (cross-device, all users)
    //   2. must_product_likes_changed custom event (same-tab instant update)
    // Adding a local increment would double-count when the RTDB event fires.
    setIsTogglingFav(true);
    try {
      await toggle(product.id);
    } finally {
      setIsTogglingFav(false);
    }
  };

  // Dedicated view recording effect: waits for auth to initialize so accounts never get guest views
  useEffect(() => {
    if (!productId || authLoading || hasRecordedViewRef.current) return;

    hasRecordedViewRef.current = true;
    if (user?.id) {
      // 1 Account = 1 View (enforced in Firebase RTDB via product_views/{productId}/{userId})
      recordProductView(productId, user.id);
    } else {
      // Unauthenticated Guest: 1 view per browser session
      const sessionKey = `must_view_${productId}`;
      if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "1");
        let sessionId = sessionStorage.getItem("must_guest_session_id");
        if (!sessionId) {
          sessionId = "g_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          sessionStorage.setItem("must_guest_session_id", sessionId);
        }
        recordProductView(productId, `guest_${sessionId}`);
      }
    }
  }, [productId, user?.id, authLoading]);

  // Product data loading and real-time deletion listener
  useEffect(() => {
    if (!productId) return;

    getProductById(productId)
      .then((data) => {
        setProduct(data);
        document.title = `${data.title} | Ksh ${data.price}`;
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    const onDeleted = (e: any) => {
      const pid = e.detail?.productId;
      if (pid === productId) setProduct(null);
    };
    window.addEventListener("must_product_deleted", onDeleted);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("must_marketplace_products_sync");
      bc.onmessage = (event) => {
        if (event.data?.type === "DELETE" && event.data?.productId === productId) {
          setProduct(null);
        }
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "must_last_deleted_product_sync" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.productId === productId) setProduct(null);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      document.title = "MUST Marketplace";
      window.removeEventListener("must_product_deleted", onDeleted);
      window.removeEventListener("storage", onStorage);
      if (bc) bc.close();
    };
  }, [productId]);

  const fallbackImg =
    CATEGORY_FALLBACK_IMAGES[product?.category?.id || "1"] ||
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=800";
  const images =
    product?.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : [fallbackImg];
  const activeImage = images[selectedImageIndex] || fallbackImg;

  // Auto-scroll every 5 seconds
  useEffect(() => {
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [images.length]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-pulse space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-6">
            <div className="w-full max-w-[460px] aspect-square bg-slate-200 dark:bg-slate-800 rounded-3xl mx-auto lg:mx-0" />
          </div>
          <div className="lg:col-span-6 space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
            <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-secondary" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product Not Found</h2>
        <p className="text-sm text-slate-500">
          This listing may have been sold or removed by the student seller.
        </p>
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </Link>
      </div>
    );
  }

  const favorited = isFavorite(product.id);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const isOwner = Boolean(
    user &&
    product &&
    (
      (product.sellerId && user.id && product.sellerId === user.id) ||
      (product.sellerPhone && user.phone && product.sellerPhone.replace(/\D/g, "") === user.phone.replace(/\D/g, "")) ||
      (product.sellerId && user.email && product.sellerId.toLowerCase() === user.email.toLowerCase())
    )
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left: Gallery with Auto-scroll */}
        <div className="lg:col-span-6 space-y-4 flex flex-col items-center lg:items-start">
          <div className="relative w-full max-w-[460px] aspect-square rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm select-none">
            {/* Auto-scrolling Image */}
            <img
              src={activeImage}
              alt={product.title}
              className="w-full h-full object-cover object-center transition-all duration-700 ease-in-out"
            />

            {/* Dots Indicator */}
            {images.length > 1 && (
              <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-sm pointer-events-none">
                {images.map((_, idx) => (
                  <span
                    key={idx}
                    className={`rounded-full transition-all duration-300 ${
                      selectedImageIndex === idx
                        ? "w-6 h-1.5 bg-white"
                        : "w-1.5 h-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Image Counter */}
            {images.length > 1 && (
              <div className="absolute bottom-3.5 right-3.5 z-20 px-3 py-1 rounded-full bg-slate-900/70 backdrop-blur-md text-white text-xs font-bold tracking-wider border border-white/10 shadow-sm pointer-events-none">
                {selectedImageIndex + 1} / {images.length}
              </div>
            )}

            {/* Sold Badge */}
            {product.status === "SOLD" && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-30 pointer-events-none">
                <span className="px-5 py-2 rounded-full bg-red-600 text-white font-extrabold text-sm tracking-wider uppercase shadow-lg">
                  Item Sold
                </span>
              </div>
            )}
          </div>

          {/* Thumbnail Row */}
          {images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 w-full max-w-[460px]">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedImageIndex(idx);
                    // Reset timer on manual selection
                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = setInterval(() => {
                      setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                    }, 5000);
                  }}
                  className={`relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    selectedImageIndex === idx
                      ? "border-emerald-600 scale-105 shadow-md ring-2 ring-emerald-500/20"
                      : "border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Details */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            {/* Badges */}
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${
                  product.condition === "NEW"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : product.condition === "BUSINESS"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {product.condition === "NEW"
                  ? "Brand New"
                  : product.condition === "BUSINESS"
                  ? "Business"
                  : "Second Hand"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {product.category?.icon} {product.category?.name}
              </span>
            </div>

            {/* Title & Price on one row */}
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                {product.title}
              </h1>
              <span className="text-xl sm:text-2xl font-bold text-slate-300 dark:text-slate-600">|</span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {formatPrice(product.price, product.condition)}
              </span>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                <MapPin className="w-4 h-4 text-secondary shrink-0" />
                <span>{product.location || "MUST Main Gate"}</span>
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                <span>{product.views || 0} views</span>
              </span>
              <button
                type="button"
                onClick={handleToggleFavorite}
                disabled={isTogglingFav}
                className={`flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                  favorited
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                }`}
              >
                <Heart className={`w-4 h-4 transition-transform active:scale-125 ${favorited ? "fill-rose-500 text-rose-500" : "text-slate-400"}`} />
                <span>{likesCount} {likesCount === 1 ? "like" : "likes"}</span>
              </button>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatRelativeTime(product.createdAt)}</span>
              </span>
              {/* Share — inline with metadata */}
              <button
                onClick={handleShare}
                className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Share listing"
              >
                {copiedShare ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                <span>{copiedShare ? "Copied!" : "Share"}</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            {product.status === "SOLD" ? (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-1">
                <p className="text-rose-700 dark:text-rose-400 font-extrabold text-sm uppercase tracking-wide">
                  Item Sold
                </p>
                <p className="text-xs text-rose-600/90 dark:text-rose-300">
                  This listing is no longer available. Explore active items on the marketplace.
                </p>
                <div className="pt-2">
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <span>Browse Active Listings</span>
                  </Link>
                </div>
              </div>
            ) : isOwner ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm">
                  <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Your Campus Listing</span>
                </div>
                <p className="text-xs text-emerald-700/90 dark:text-emerald-400">
                  This is your own advertisement.
                </p>
                <div className="pt-1">
                  <Link
                    href="/seller/dashboard"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
                  >
                    <span>Manage in Seller Dashboard</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const rawPhone = product.sellerPhone || "";
                  let cleanDigits = rawPhone.replace(/[^0-9]/g, "");
                  if (cleanDigits.startsWith("0") && cleanDigits.length === 10) {
                    cleanDigits = "254" + cleanDigits.slice(1);
                  } else if ((cleanDigits.startsWith("7") || cleanDigits.startsWith("1")) && cleanDigits.length === 9) {
                    cleanDigits = "254" + cleanDigits;
                  }

                  const waGreeting = `Hi ${product.sellerName || "Seller"}, I saw your listing for "${product.title}" on MUST Marketplace. Is it still available?`;
                  const waUrl = cleanDigits
                    ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(waGreeting)}`
                    : null;

                  return (
                    <>
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold text-base flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
                        >
                          <MessageCircle className="w-5 h-5" />
                          <span>Chat on WhatsApp ({product.sellerPhone})</span>
                        </a>
                      ) : (
                        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-center text-xs font-semibold">
                          Seller WhatsApp contact not available
                        </div>
                      )}

                      {product.sellerPhone && (
                        <a
                          href={`tel:${product.sellerPhone.replace(/\s+/g, "")}`}
                          className="w-full py-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Phone className="w-4 h-4 text-emerald-600" />
                          <span>Call Seller Directly</span>
                        </a>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Description
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {product.description || "No description provided."}
            </p>
          </div>

          {/* Seller */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              About the Seller
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-container text-primary-dark font-black text-lg flex items-center justify-center">
                {product.sellerName ? product.sellerName.charAt(0) : "S"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {product.sellerName || "MUST Student"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Campus Comrade</span>
                </p>
              </div>
            </div>
          </div>

          {/* Safety */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-secondary" />
              <span>Campus Security Notice</span>
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              Always meet at public places and inspect the items before paying for them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
