"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  X,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Camera,
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  Check,
  Tag,
  Loader2,
  Info,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  SAMPLE_CATEGORIES,
  UNIVERSITY_LOCATIONS,
  CATEGORY_FALLBACK_IMAGES,
} from "@/lib/constants";
import { createProduct, uploadProductImage } from "@/lib/firebase/services";
import { ProductCondition, Category } from "@/types";
import { formatPrice } from "@/lib/utils";

const QUICK_TAGS = [
  "Price is negotiable",
  "Original accessories included",
  "Barely used / Like new",
  "Used for 1 semester only",
  "Can meet at Library or Student Center",
];

const PRICE_SHORTCUTS = [500, 1000, 2500, 5000, 10000];

export default function NewProductPage() {
  const router = useRouter();
  const { user, loading: authLoading, updateUserProfile } = useAuth();

  // Form State
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>(SAMPLE_CATEGORIES[0]);
  const [condition, setCondition] = useState<ProductCondition>("SECOND_HAND");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<string>(user?.location || UNIVERSITY_LOCATIONS[0]);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    if (authLoading) {
      return (
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-700 mx-auto" />
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-40 mx-auto" />
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-56 mx-auto" />
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Sign In to Post a Listing
        </h2>
        <p className="text-xs text-slate-500">
          Only verified MUST student comrades can list products on campus.
        </p>
        <Link
          href="/login?redirect=/seller/products/new"
          className="inline-block px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm"
        >
          Sign In
        </Link>
      </div>
    );
  }

  // Handle local picture upload with instant parallel processing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingCapacity = Math.max(0, 5 - images.length);
    if (remainingCapacity <= 0) return;

    const filesToUpload = Array.from(files).slice(0, remainingCapacity);
    setUploading(true);

    try {
      // Process all selected images in parallel
      const uploadedUrls = await Promise.all(
        filesToUpload.map((file) => uploadProductImage(file))
      );
      const validUrls = uploadedUrls.filter((url) => Boolean(url));
      setImages((prev) => [...prev, ...validUrls].slice(0, 5));
    } catch (err) {
      console.warn("Upload processing error:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick 1-click photo auto-fill for testing/demo
  const handleAddSuggestedPhotos = () => {
    const stock =
      CATEGORY_FALLBACK_IMAGES[selectedCategory.id] ||
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=800";
    const additional = [
      stock,
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800",
    ];
    setImages((prev) => Array.from(new Set([...prev, ...additional])).slice(0, 5));
  };

  const appendQuickTag = (tag: string) => {
    setDescription((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.includes(tag)) return trimmed;
      return `${trimmed}. ${tag}`;
    });
  };

  const isValidTitle = title.trim().length >= 3;
  const numericPrice = Number(price);
  const isValidPrice = !isNaN(numericPrice) && numericPrice > 0;
  const hasPhotos = images.length > 0;
  const canPublish = isValidTitle && isValidPrice && hasPhotos && !uploading;

  const handlePublish = async () => {
    if (!canPublish) return;
    setError("");
    setUploading(true);

    try {
      const finalImages =
        images.length > 0
          ? images
          : [
              CATEGORY_FALLBACK_IMAGES[selectedCategory.id] ||
                "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=800",
            ];

      const created = await createProduct({
        title: title.trim(),
        description:
          description.trim() ||
          `${selectedCategory.name} in ${
            condition === "NEW" ? "brand new" : "second hand"
          } condition at MUST ${location}.`,
        price: numericPrice,
        condition,
        category: selectedCategory,
        location,
        imageUrls: finalImages,
        sellerId: user.id,
        sellerName: user.fullName,
        sellerPhone: user.phone || undefined,
        sellerImageUrl: user.profileImageUrl || null,
        sellerLikes: user.likes || 10,
      });

      if (!user.isSeller) {
        try {
          await updateUserProfile({ seller: true, isSeller: true });
        } catch {}
      }

      router.push(`/product/${created.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create product listing.");
      setUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Create a Listing
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Reach verified students across Meru University of Science and Technology
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>0% Commission</span>
          </span>
        </div>
      </div>

      {/* ── TWO-COLUMN WORKFLOW LAYOUT ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── LEFT COLUMN: CREATION FORM (7 cols) ────────────────────────────── */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 1: PHOTOS */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Photos ({images.length}/5)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  First photo will be your cover image. At least 1 photo is required.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSuggestedPhotos}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Fill Samples</span>
              </button>
            </div>

            {/* Photo Cards Grid */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              {/* Uploaded Photos */}
              {images.map((url, i) => (
                <div
                  key={`img-${i}`}
                  className="relative shrink-0 w-[100px] h-[100px] sm:w-[110px] sm:h-[110px] rounded-2xl overflow-hidden group border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                >
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-emerald-600/90 text-[8px] font-bold text-white shadow-xs">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-xs"
                    title="Remove photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add Photo Button Slot */}
              {images.length < 5 && (
                <label className="cursor-pointer shrink-0 w-[100px] h-[100px] sm:w-[110px] sm:h-[110px] rounded-2xl border-2 border-dashed border-emerald-400/80 dark:border-emerald-600/80 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40 flex flex-col items-center justify-center gap-1 transition-all">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    {uploading ? "Uploading..." : "+ Add Photo"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {/* Placeholder Slots */}
              {images.length < 4 &&
                Array.from({ length: Math.min(3, 4 - images.length - 1) }).map((_, i) => (
                  <div
                    key={`slot-${i}`}
                    className="shrink-0 w-[100px] h-[100px] sm:w-[110px] sm:h-[110px] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col items-center justify-center gap-1 text-slate-300 dark:text-slate-700"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-[9px] font-medium">Slot {images.length + i + 2}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* SECTION 2: BASIC INFO & PRICING */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
              Item Details & Pricing
            </h2>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Title *</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {title.length}/80 characters
                </span>
              </label>
              <input
                type="text"
                required
                maxLength={80}
                placeholder="e.g. HP Laptop 15 Core i5 8GB RAM 256GB SSD"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
              />
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Category *
              </label>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory.id === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Condition & Price Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Condition Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Condition *
                </label>
                <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCondition("SECOND_HAND")}
                    className={`py-2 rounded-lg transition-all ${
                      condition === "SECOND_HAND"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Second Hand
                  </button>
                  <button
                    type="button"
                    onClick={() => setCondition("NEW")}
                    className={`py-2 rounded-lg transition-all ${
                      condition === "NEW"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Brand New
                  </button>
                </div>
              </div>

              {/* Price Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Price (KSh) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                    KSh
                  </span>
                  <input
                    type="number"
                    min="1"
                    placeholder="2500"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full pl-12 pr-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Quick Price Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] font-semibold text-slate-400 shrink-0">Suggestions:</span>
              {PRICE_SHORTCUTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPrice(String(amt))}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 text-[10px] font-bold shrink-0 transition-colors"
                >
                  KSh {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 3: DESCRIPTION */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Description
              </label>
              <span className="text-[10px] text-slate-400">
                {description.length} characters
              </span>
            </div>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State key features, reason for selling, accessories included, and condition notes..."
              className="w-full p-3.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 leading-relaxed font-medium transition-all resize-none"
            />

            {/* Quick Tags Helper */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Quick Description Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => appendQuickTag(tag)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-[11px] font-medium transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 4: CAMPUS LOCATION */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Campus Location & Meetup Zone
              </h2>
              <span className="text-xs font-bold text-secondary flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{location}</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select where around campus you prefer to meet comrades for inspection.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
              {UNIVERSITY_LOCATIONS.map((loc) => {
                const isSelected = location === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 truncate ${
                      isSelected
                        ? "bg-secondary text-white border-secondary shadow-xs font-extrabold"
                        : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white" : "text-secondary"}`} />
                    <span className="truncate">{loc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: LIVE BUYER PREVIEW & PUBLISH (5 cols) ───────────── */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Buyer Preview</span>
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                Live Mockup
              </span>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Simulated Live Product Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800/80 shadow-md">
              {/* Product Card Image */}
              <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                {images.length > 0 ? (
                  <img
                    src={images[0]}
                    alt={title || "Preview"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-600">
                    <ImageIcon className="w-10 h-10 stroke-[1.5]" />
                    <span className="text-xs font-medium">Cover photo will appear here</span>
                  </div>
                )}

                {/* Badge Overlays */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-extrabold uppercase shadow-xs">
                    {condition === "NEW" ? "Brand New" : "Second Hand"}
                  </span>
                </div>

                <div className="absolute top-2.5 right-2.5">
                  <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-bold">
                    {selectedCategory.name}
                  </span>
                </div>
              </div>

              {/* Product Card Content */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">
                    {title || "Your Product Title"}
                  </h4>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {formatPrice(numericPrice || 0)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-secondary" />
                    <span>{location}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-700/60">
                  {description || "Add a description to tell comrades about condition, accessories, and availability."}
                </p>

                {/* Seller Preview Info */}
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary-container text-primary-dark font-black text-[10px] flex items-center justify-center">
                      {user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {user.fullName}
                    </span>
                  </div>
                  <span className="text-emerald-600 font-semibold">Verified Student</span>
                </div>
              </div>
            </div>

            {/* Validation Checklist */}
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Listing Readiness:
              </span>
              <div className="flex items-center gap-2">
                {isValidTitle ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block shrink-0" />
                )}
                <span className={isValidTitle ? "text-slate-800 dark:text-slate-200 font-medium" : "text-slate-400"}>
                  Clear title (3+ characters)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isValidPrice ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block shrink-0" />
                )}
                <span className={isValidPrice ? "text-slate-800 dark:text-slate-200 font-medium" : "text-slate-400"}>
                  Realistic price in KSh
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasPhotos ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block shrink-0" />
                )}
                <span className={hasPhotos ? "text-slate-800 dark:text-slate-200 font-medium" : "text-slate-400"}>
                  At least 1 photo uploaded
                </span>
              </div>
            </div>

            {/* Publish Button */}
            <button
              type="button"
              disabled={!canPublish}
              onClick={handlePublish}
              className="w-full py-3.5 rounded-2xl bg-secondary hover:bg-secondary-dark disabled:opacity-40 text-white font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Listing...</span>
                </>
              ) : (
                <span>Publish Listing</span>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400">
              Safe student commerce • Instant notification to interested comrades
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
