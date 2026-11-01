"use client";

import React, { useState, useEffect } from "react";
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
  Sparkles,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from "lucide-react";
import { Product } from "@/types";
import { getProductById, recordProductView, getProductLikes } from "@/lib/firebase/services";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { CATEGORY_FALLBACK_IMAGES } from "@/lib/constants";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [copiedShare, setCopiedShare] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    if (product) {
      setLikesCount(getProductLikes(product.id, product.likes || 0));
    }
  }, [product]);

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
    if (!product) return;
    const nextIsFav = !favorited;
    setLikesCount((prev) => (nextIsFav ? prev + 1 : Math.max(0, prev - 1)));
    await toggle(product.id);
  };

  useEffect(() => {
    if (!productId) return;

    getProductById(productId)
      .then((data) => {
        setProduct(data);
        setLoading(false);
        // Record product view
        if (data && user?.id) {
          recordProductView(data.id, user.id);
        }
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
      window.removeEventListener("must_product_deleted", onDeleted);
      window.removeEventListener("storage", onStorage);
      if (bc) bc.close();
    };
  }, [productId, user?.id]);

  const fallbackImg =
    CATEGORY_FALLBACK_IMAGES[product?.category?.id || "1"] ||
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=800";
  const images = product?.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : [fallbackImg];
  const activeImage = images[selectedImageIndex] || fallbackImg;

  // Previous and Next scroll navigation handlers
  const handlePrevImage = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  // Keyboard navigation for image gallery
  useEffect(() => {
    if (images.length <= 1) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (e.key === "ArrowRight") {
        setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 45) {
      // Swiped left -> next
      handleNextImage();
    } else if (diff < -45) {
      // Swiped right -> prev
      handlePrevImage();
    }
    setTouchStartX(null);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-pulse space-y-6">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-28" />
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

  const handleChatWithSeller = () => {
    if (!user) {
      router.push(`/login?redirect=/product/${product.id}`);
      return;
    }
    // Navigate to messages with pre-attached product context
    const sellerId = product.sellerId || "demo_seller_456";
    const sellerName = product.sellerName || "Seller";
    router.push(
      `/messages?sellerId=${encodeURIComponent(sellerId)}&sellerName=${encodeURIComponent(
        sellerName
      )}&productId=${encodeURIComponent(product.id)}&productTitle=${encodeURIComponent(
        product.title
      )}`
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2.5 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Share listing"
          >
            {copiedShare ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleToggleFavorite}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all text-xs font-bold cursor-pointer ${
              favorited
                ? "bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-950/40 dark:border-rose-900 shadow-xs"
                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
            }`}
            title={favorited ? "Unlike listing" : "Like & Save listing"}
          >
            <Heart className={`w-4 h-4 transition-transform active:scale-125 ${favorited ? "fill-rose-500 text-rose-500" : ""}`} />
            <span>{likesCount} {likesCount === 1 ? "Like" : "Likes"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Gallery + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left: Product Images Gallery with Scroll Arrows */}
        <div className="lg:col-span-6 space-y-4 flex flex-col items-center lg:items-start">
          <div
            className="group relative w-full max-w-[460px] aspect-square rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Active Display Image */}
            <img
              src={activeImage}
              alt={product.title}
              className="w-full h-full object-cover object-center cursor-zoom-in transition-all duration-300"
              onClick={() => setIsFullscreen(true)}
            />

            {/* Left Scroll Arrow */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handlePrevImage}
                aria-label="Previous image"
                className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/65 hover:bg-slate-900/90 text-white backdrop-blur-md border border-white/20 shadow-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer group/arrow"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover/arrow:-translate-x-0.5" />
              </button>
            )}

            {/* Right Scroll Arrow */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handleNextImage}
                aria-label="Next image"
                className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/65 hover:bg-slate-900/90 text-white backdrop-blur-md border border-white/20 shadow-xl flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer group/arrow"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover/arrow:translate-x-0.5" />
              </button>
            )}

            {/* Fullscreen Expand Action */}
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              aria-label="Expand photo"
              className="absolute top-3.5 right-3.5 z-20 p-2.5 rounded-full bg-slate-900/65 hover:bg-slate-900/90 text-white backdrop-blur-md border border-white/20 shadow-md hover:scale-105 transition-all cursor-pointer"
              title="View full size"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Image Counter Badge */}
            {images.length > 1 && (
              <div className="absolute bottom-3.5 right-3.5 z-20 px-3 py-1 rounded-full bg-slate-900/70 backdrop-blur-md text-white text-xs font-bold tracking-wider border border-white/10 shadow-sm pointer-events-none">
                {selectedImageIndex + 1} / {images.length}
              </div>
            )}

            {/* Bottom Dots Indicator */}
            {images.length > 1 && (
              <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-sm">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageIndex(idx);
                    }}
                    aria-label={`Go to image ${idx + 1}`}
                    className={`rounded-full transition-all cursor-pointer ${
                      selectedImageIndex === idx
                        ? "w-6 h-1.5 bg-white shadow-xs"
                        : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
                    }`}
                  />
                ))}
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

          {/* Thumbnails Row */}
          {images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 w-full max-w-[460px] scrollbar-none">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
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

        {/* Right: Product Details & Actions */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            {/* Condition & Category Badges */}
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${
                  product.condition === "NEW"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {product.condition === "NEW" ? "Brand New" : "Second Hand"}
              </span>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {product.category?.icon} {product.category?.name}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              {product.title}
            </h1>

            {/* Price */}
            <div className="text-3xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
              <span>{formatPrice(product.price)}</span>
            </div>

            {/* Location & Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
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
                className={`flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                  favorited
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                }`}
                title={favorited ? "Unlike listing" : "Like listing"}
              >
                <Heart className={`w-4 h-4 transition-transform active:scale-125 ${favorited ? "fill-rose-500 text-rose-500" : "text-slate-400"}`} />
                <span>{likesCount} {likesCount === 1 ? "like" : "likes"}</span>
              </button>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatRelativeTime(product.createdAt)}</span>
              </span>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleChatWithSeller}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Chat with Seller Now</span>
            </button>

            {product.sellerPhone && (
              <a
                href={`https://wa.me/${product.sellerPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `Hi ${product.sellerName}, I saw your listing for "${product.title}" on MUST Marketplace.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Seller ({product.sellerPhone})</span>
              </a>
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

          {/* Seller Profile Card */}
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

          {/* Safety Notice Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-secondary" />
              <span>Campus Safety Guidelines</span>
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              Always meet in busy campus spaces such as the Library Foyer, Student Center, or Gate
              A. Inspect and test items before making payments.
            </p>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-200"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Top Bar */}
          <div
            className="absolute top-0 inset-x-0 h-14 px-4 sm:px-6 flex items-center justify-between text-white z-50 bg-gradient-to-b from-black/80 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold tracking-wide bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-xs truncate max-w-[60%]">
              {product.title} • {selectedImageIndex + 1} of {images.length}
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2.5 rounded-full bg-white/15 hover:bg-white/30 text-white transition-colors cursor-pointer shrink-0"
              aria-label="Close fullscreen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Image Area — fills the whole screen minus top bar and bottom thumbs */}
          <div
            className="relative flex-1 flex items-center justify-center overflow-hidden"
            style={{ paddingTop: "56px", paddingBottom: images.length > 1 ? "100px" : "20px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeImage}
              alt={product.title}
              className="w-full h-full object-contain select-none"
              style={{ maxHeight: "100%", maxWidth: "100%" }}
            />

            {/* Lightbox Left Arrow */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handlePrevImage}
                aria-label="Previous image"
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md border border-white/20 shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-7 h-7 sm:w-8 sm:h-8" />
              </button>
            )}

            {/* Lightbox Right Arrow */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handleNextImage}
                aria-label="Next image"
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md border border-white/20 shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer"
              >
                <ChevronRight className="w-7 h-7 sm:w-8 sm:h-8" />
              </button>
            )}
          </div>

          {/* Lightbox Bottom Thumbnails */}
          {images.length > 1 && (
            <div
              className="absolute bottom-0 inset-x-0 h-[100px] flex items-center justify-center gap-2.5 px-6 overflow-x-auto z-50 bg-gradient-to-t from-black/80 to-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    selectedImageIndex === idx
                      ? "border-emerald-500 scale-110 shadow-lg ring-2 ring-emerald-500/40"
                      : "border-white/20 opacity-50 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
