"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store, Phone, MapPin, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { becomeSeller } from "@/lib/firebase/services";
import { UNIVERSITY_LOCATIONS } from "@/lib/constants";

export default function SellerActivatePage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUserData, updateUserProfile } = useAuth();

  const [phone, setPhone] = useState(user?.phone || "");
  const [location, setLocation] = useState(user?.location || "Main Gate");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/login?redirect=/seller/activate");
      return;
    }

    if (!phone.trim()) {
      setError("Please provide a valid phone number for buyers to reach you.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await becomeSeller(user.id, phone.trim(), location);
      await updateUserProfile({
        phone: phone.trim(),
        location,
        seller: true,
        isSeller: true,
      });
      await refreshUserData();
      setSuccess(true);
      setTimeout(() => {
        router.push("/seller/dashboard");
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Activation failed. Please try again.");
      setLoading(false);
    }
  };

  if (!user) {
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
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
          <Store className="w-8 h-8 text-secondary" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sign In to Become a Seller</h2>
        <p className="text-xs sm:text-sm text-slate-500">
          You need an active MUST student account to start listing items on campus.
        </p>
        <Link
          href="/login?redirect=/seller/activate"
          className="inline-block px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm"
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  if (user.isSeller && !success) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">You're Already a Seller!</h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Your account is fully activated. You can post items and manage your inventory.
        </p>
        <Link
          href="/seller/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm"
        >
          <span>Go to Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-8">

      {/* Main Activation Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-card space-y-6">
        {success ? (
          <div className="text-center py-8 space-y-3 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              You're Now a Verified Seller! 🎉
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Your seller profile is now verified and active. Redirecting to your dashboard...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Phone Number / WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  placeholder="+254 712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Buyers will use this number to contact you or send WhatsApp inquiries.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Primary Campus Location / Hostel
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  {UNIVERSITY_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Seller Code of Conduct</span>
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Only list authentic items you personally own on campus.</li>
                <li>Meet buyers in open daylight campus locations (e.g. Student Center).</li>
                <li>Accurately state the item's condition (New or Second Hand).</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-secondary hover:bg-secondary-dark disabled:opacity-50 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>{loading ? "Activating..." : "Activate Seller Account"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
