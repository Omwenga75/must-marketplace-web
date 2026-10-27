"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Email must be like omwenga@gmail.com and must end with @gmail.com");
      return;
    }

    setLoading(true);

    try {
      await resetPassword(trimmedEmail);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Failed to send reset link. Please check your email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center pt-2 sm:pt-4 px-4 pb-12">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-primary-dark text-primary flex items-center justify-center font-black shadow-sm">
              <ShoppingBag className="w-6 h-6 text-emerald-400" />
            </div>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Reset Password
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Enter your MUST student email to receive a password reset link
          </p>
        </div>

        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-card space-y-5">
          {submitted ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                Check Your Inbox
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                If an account exists for <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>, you will receive instructions to reset your password.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Login</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="omwenga@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Must end with @gmail.com
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all"
              >
                {loading ? "Sending link..." : "Send Reset Link"}
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
