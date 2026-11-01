"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
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

  // Fallback and images handling
  const fallbackImg =
    CATEGORY_FALLBACK_IMAGES[product.category?.id || "1"] ||
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=800";

  const allImages =
    product.imageUrls && product.imageUrls.length > 0
      ? product.imageUrls
      : [fallbackImg];

  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const displayImage = allImages[currentImgIndex] || fallbackImg;
  const [imgSrc, setImgSrc] = useState(displayImage);

  // Keep imgSrc updated when index changes
  useEffect(() => {
    setImgSrc(allImages[currentImgIndex] || fallbackImg);
  }, [currentImgIndex, allImages, fallbackImg]);

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

  const handleCardPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleCardNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const isSold = product.status === "SOLD";
  const isBooked = product.status === "BOOKED";

  return (
    <div className="group relative flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-card hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
      {/* Classic Square Thumbnail Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <Link
          href={`/product/${product.id}`}
          className="block w-full h-full relative"
        >
          <img
            src={imgSrc}
            alt={product.title}
            onError={() => setImgSrc(fallbackImg)}
            className={`h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300 ${
              isSold ? "grayscale opacity-60" : ""
            }`}
            loading="lazy"
          />
        </Link>

        {/* Multi-image navigation arrows on card (subtle on hover) */}
        {allImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handleCardPrev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-all duration-150 shadow-md flex items-center justify-center hover:scale-110 active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCardNext}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-all duration-150 shadow-md flex items-center justify-center hover:scale-110 active:scale-95 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Micro Dots Indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
              {allImages.slice(0, 5).map((_, i) => (
                <span
                  key={i}
                  className={`rounded-full transition-all ${
                    currentImgIndex === i
                      ? "w-3 h-1 bg-white shadow-xs"
                      : "w-1 h-1 bg-white/60"
                  }`}
                />
              ))}
            </div>

            {/* Photo count badge */}
            <div className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-xs text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {currentImgIndex + 1}/{allImages.length}
            </div>
          </>
        )}

        {/* Favorite Heart Button */}
        <button
          onClick={handleFavoriteClick}
          aria-label={favorited ? "Remove from saved" : "Save item"}
          className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all duration-150 z-20 cursor-pointer ${
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
          <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center z-10 pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-red-600 text-white font-extrabold text-xs tracking-wider uppercase shadow-md">
              Sold
            </span>
          </div>
        )}

        {isBooked && (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[11px] shadow-sm">
              Reserved
            </span>
          </div>
        )}

        {/* Condition Badge */}
        {!isSold && !isBooked && (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
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
      </div>

      {/* Card Info Content */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {/* Category & Location Header */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 gap-2">
          <span className="font-medium truncate">
            {product.category?.icon || "📦"} {product.category?.name || "General"}
          </span>
          <span className="flex items-center gap-0.5 shrink-0 text-slate-500 dark:text-slate-400">
            <MapPin className="w-3 h-3 text-secondary" />
            <span className="truncate max-w-[90px]">{product.location || "Campus"}</span>
          </span>
        </div>

        {/* Title */}
        <Link
          href={`/product/${product.id}`}
          className="group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors"
        >
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
