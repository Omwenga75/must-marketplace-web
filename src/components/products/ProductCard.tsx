"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import { useFavorites } from "@/context/FavoritesContext";
import { getProductLikes } from "@/lib/firebase/services";
import { CATEGORY_FALLBACK_IMAGES } from "@/lib/constants";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { isFavorite, toggle } = useFavorites();
  const favorited = isFavorite(product.id);
  const [isTogglingFav, setIsTogglingFav] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(() =>
    getProductLikes(product.id, product.likes || 0)
  );

  // Sync likes with global events and storage updates
  useEffect(() => {
    setLikesCount(getProductLikes(product.id, product.likes || 0));

    const handleLikesChanged = (e: any) => {
      if (e?.detail?.productId === product.id && typeof e.detail.likes === "number") {
        setLikesCount(e.detail.likes);
      }
    };

    window.addEventListener("must_product_likes_changed", handleLikesChanged);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("must_marketplace_likes_sync");
      bc.onmessage = (event) => {
        if (event?.data?.productId === product.id && typeof event.data.likes === "number") {
          setLikesCount(event.data.likes);
        }
      };
    }

    return () => {
      window.removeEventListener("must_product_likes_changed", handleLikesChanged);
      if (bc) bc.close();
    };
  }, [product.id, product.likes]);

  // Fallback image handling
  const fallbackImg =
    CATEGORY_FALLBACK_IMAGES[product.category?.id || "1"] ||
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=800";
  const displayImage =
    product.imageUrls && product.imageUrls.length > 0 && product.imageUrls[0]
      ? product.imageUrls[0]
      : fallbackImg;

  const [imgSrc, setImgSrc] = useState(displayImage);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTogglingFav) return;
    setIsTogglingFav(true);

    // Instant optimistic update
    const nextIsFav = !favorited;
    setLikesCount((prev) => (nextIsFav ? prev + 1 : Math.max(0, prev - 1)));

    await toggle(product.id);
    setIsTogglingFav(false);
  };

  const isSold = product.status === "SOLD";
  const isBooked = product.status === "BOOKED";

  return (
    <div className="group relative flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-card hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
      {/* Thumbnail Container */}
      <Link href={`/product/${product.id}`} className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img
          src={imgSrc}
          alt={product.title}
          onError={() => setImgSrc(fallbackImg)}
          className={`h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300 ${
            isSold ? "grayscale opacity-60" : ""
          }`}
          loading="lazy"
        />

        {/* Favorite Heart Button */}
        <button
          onClick={handleFavoriteClick}
          aria-label={favorited ? "Remove from saved" : "Save item"}
          className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all duration-150 z-10 ${
            favorited
              ? "bg-rose-500 text-white shadow-md scale-105"
              : "bg-black/30 text-white hover:bg-black/50 hover:scale-110"
          }`}
        >
          <Heart
            className={`w-4 h-4 transition-transform active:scale-125 ${
              favorited ? "fill-white text-white" : "stroke-white"
            }`}
          />
        </button>

        {/* Status Overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-red-600 text-white font-extrabold text-xs tracking-wider uppercase shadow-md">
              Sold
            </span>
          </div>
        )}

        {isBooked && (
          <div className="absolute top-2.5 left-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[11px] shadow-sm">
              Reserved
            </span>
          </div>
        )}

        {/* Condition Badge */}
        {!isSold && !isBooked && (
          <div className="absolute top-2.5 left-2.5">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide uppercase backdrop-blur-md shadow-sm ${
                product.condition === "NEW"
                  ? "bg-emerald-500/90 text-white"
                  : "bg-slate-900/80 text-slate-100"
              }`}
            >
              {product.condition === "NEW" ? "Brand New" : "Second Hand"}
            </span>
          </div>
        )}
      </Link>

      {/* Card Info Content */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {/* Category & Location Header */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="font-medium truncate max-w-[120px]">
            {product.category?.icon || "📦"} {product.category?.name || "General"}
          </span>
          <span className="flex items-center gap-0.5 shrink-0 text-slate-500 dark:text-slate-400">
            <MapPin className="w-3 h-3 text-secondary" />
            <span className="truncate max-w-[100px]">{product.location || "Campus"}</span>
          </span>
        </div>

        {/* Title */}
        <Link href={`/product/${product.id}`} className="group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
            {product.title}
          </h3>
        </Link>

        {/* Price */}
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {formatPrice(product.price)}
          </span>
        </div>

        {/* Seller Info & Like Counter Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-full bg-primary-container text-primary-dark font-bold text-[10px] flex items-center justify-center shrink-0">
              {product.sellerName ? product.sellerName.charAt(0) : "S"}
            </div>
            <span className="truncate font-medium text-[11px] text-slate-700 dark:text-slate-300">
              {product.sellerName || "Verified Seller"}
            </span>
          </div>

          {/* Interactive Likes Badge */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              favorited
                ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 shadow-xs"
                : "text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title={favorited ? "Unlike product" : "Like product"}
          >
            <Heart
              className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                favorited ? "fill-rose-500 text-rose-500" : "text-slate-400 group-hover:text-rose-400"
              }`}
            />
            <span>{likesCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
