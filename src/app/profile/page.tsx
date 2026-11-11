"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Store,
  Heart,
  ShieldCheck,
  LogOut,
  Edit2,
  Check,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { UNIVERSITY_LOCATIONS } from "@/lib/constants";
import { formatDate, isAdministratorEmail } from "@/lib/utils";
import { update } from "firebase/database";
import { ref } from "firebase/database";
import { database } from "@/lib/firebase/config";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, logout, updateUserProfile } = useAuth();
  const { favoriteIds } = useFavorites();

  const isUserAdmin = Boolean(
    user?.isAdmin ||
    user?.admin ||
    isAdministratorEmail(user?.email)
  );

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(
    user?.phone ? user.phone.replace(/^\+254\s?/, "") : ""
  );
  const [location, setLocation] = useState(user?.location || "Main Gate");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  React.useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setPhone(user.phone ? user.phone.replace(/^\+254\s?/, "") : "");
      setLocation(user.location || "Main Gate");
    }
  }, [user]);

  if (!user) {
    if (authLoading) {
      return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pulse">
          {/* Header Skeleton */}
          <div className="space-y-2 pb-6 border-b border-slate-200/80 dark:border-slate-800">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-48" />
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-72" />
          </div>

          {/* Profile Card Skeleton */}
          <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
              <div className="space-y-2 text-center sm:text-left flex-1">
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-36 mx-auto sm:mx-0" />
                <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-48 mx-auto sm:mx-0" />
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-24 mx-auto sm:mx-0 mt-2" />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
                <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl w-full" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24" />
                <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl w-full" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-28" />
                <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl w-full" />
              </div>
              <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-xl w-32" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
          <UserIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sign In Required</h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Please sign in to view your profile and manage your listings.
        </p>
        <Link
          href="/login"
          className="inline-block px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Build full phone from the 9-digit input
    const digits = phone.trim().replace(/\s/g, "");
    const fullPhone = digits
      ? `+254 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
      : null;

    try {
      const phoneChanged = fullPhone && fullPhone !== user.phone;
      await updateUserProfile({
        fullName: fullName.trim() || user.fullName,
        phone: fullPhone,
        location: location || "Main Gate",
      });
      setIsEditing(false);
      if (phoneChanged) {
        setSavedMsg("✓ Profile saved — WhatsApp/Call number updated on all your listings.");
      } else {
        setSavedMsg("✓ Profile saved.");
      }
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      console.warn("Failed to update profile:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6 sm:py-12 space-y-6 sm:space-y-8">
      {/* Profile Header Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {/* Avatar */}
          <div className="relative w-24 h-24 rounded-full bg-primary-container text-primary-dark font-black text-3xl flex items-center justify-center overflow-hidden border-4 border-white dark:border-slate-800 shadow-md">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={user.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              user.fullName.charAt(0).toUpperCase()
            )}
          </div>

          {/* User Details */}
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white truncate">
                {user.fullName}
              </h1>
              <div className="flex items-center justify-center sm:justify-start gap-1.5">
                {isUserAdmin ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-950 text-secondary">
                    Administrator
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {user.isSeller ? "Buyer · Seller" : "Buyer"}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{user.email}</span>
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-secondary" />
                <span>{user.location || "MUST Main Gate"}</span>
              </span>
              {user.phone && (
                <span className="flex items-center gap-1 font-medium">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{user.phone}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {formatDate(user.memberSince)}</span>
              </span>
            </div>
          </div>

          {/* Edit Toggle */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors self-center sm:self-auto"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditing ? "Cancel" : "Edit Profile"}</span>
          </button>
        </div>

        {/* Success toast notification */}
        {savedMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedMsg}</span>
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <form
            onSubmit={handleSaveProfile}
            className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-fade-in"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Update Profile Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Omwenga"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Phone / WhatsApp Number
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-emerald-500/30">
                  <div className="flex items-center gap-1.5 px-3 border-r border-slate-200 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-700/60 select-none">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">+254</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="712 345 678"
                    value={phone}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d\s]/g, "");
                      const digitsOnly = raw.replace(/\s/g, "");
                      if (digitsOnly.length <= 9) setPhone(raw);
                    }}
                    inputMode="numeric"
                    maxLength={11}
                    className="flex-1 px-3 py-2.5 text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <span className={`flex items-center pr-3 text-[10px] font-semibold tabular-nums ${
                    phone.replace(/\s/g, "").length === 9 ? "text-emerald-500" : "text-slate-400"
                  }`}>
                    {phone.replace(/\s/g, "").length}/9
                  </span>
                </div>
                {phone.replace(/\s/g, "").length > 0 && !/^[17]/.test(phone.replace(/\s/g, "")) && (
                  <p className="text-[10px] text-rose-500 font-semibold">
                    Must start with 1 or 7 after +254
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Campus Location / Residence
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  {UNIVERSITY_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Account Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Seller Status Card */}
        {user.isSeller ? (
          <Link
            href="/seller/dashboard"
            className="p-6 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 hover:border-emerald-500 transition-all flex items-center justify-between group"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-emerald-600" />
                <span>Seller Mode Active</span>
              </p>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Go to Dashboard
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Manage your listings, mark items as sold, view statistics
              </p>
            </div>
          </Link>
        ) : (
          <Link
            href="/seller/activate"
            className="p-6 rounded-3xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-800 hover:border-secondary transition-all flex items-center justify-between group"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <Store className="w-4 h-4 text-secondary" />
                <span>Start Selling on Campus</span>
              </p>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Become a MUST Seller
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Activate seller privileges in 30 seconds for free
              </p>
            </div>
          </Link>
        )}

        {/* Saved Items Quick Card */}
        <Link
          href="/saved"
          className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between group shadow-sm"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
              <Heart className="w-4 h-4 fill-rose-500" />
              <span>Bookmarks</span>
            </p>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              My Saved Items ({favoriteIds.size})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              View and chat on items you've bookmarked
            </p>
          </div>
        </Link>
      </div>

      {/* Logout button */}
      <div className="pt-6 sm:pt-8 flex justify-center items-center w-full">
        <button
          onClick={() => {
            logout();
            router.push("/");
          }}
          className="w-full max-w-xs sm:max-w-sm py-3 px-6 rounded-2xl border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-all shadow-xs hover:shadow-sm active:scale-98"
        >
          <LogOut className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>Log Out of Account</span>
        </button>
      </div>
    </div>
  );
}
