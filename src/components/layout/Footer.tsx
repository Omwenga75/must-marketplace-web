"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, ShieldCheck, MapPin, Phone, Mail, Clock, Calendar } from "lucide-react";
import { UNIVERSITY_LOCATIONS } from "@/lib/constants";

export default function Footer() {
  const pathname = usePathname();

  // Hide footer on chat & messaging screens for an app-like viewport experience
  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return null;
  }

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 mt-20 pb-16 sm:pb-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-5 sm:gap-x-8 gap-y-8">
          {/* Brand Info */}
          <div className="col-span-2 lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-white dark:bg-slate-800 p-0.5 border border-emerald-500/20 shadow-sm">
                <img
                  src="/logo.png"
                  alt="MUST Marketplace"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                MUST <span className="text-secondary font-bold">Marketplace</span>
              </span>
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
              The dedicated student-to-student marketplace for Meru University of Science and
              Technology. Buy, sell, and connect safely right on campus.
            </p>
            <div className="inline-flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-400 bg-primary/80 dark:bg-emerald-950/60 px-3 py-1.5 rounded-full border border-primary-container dark:border-emerald-800 w-fit">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>Safety Tip: Inspect items before paying.</span>
            </div>
          </div>

          {/* Support */}
          <div className="col-span-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
              Support
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <a
                  href="tel:+254111307585"
                  className="flex items-center gap-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>+254 111 307 585</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:must.marketplace@gmail.com"
                  className="flex items-start gap-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span className="break-all leading-snug">must.marketplace@gmail.com</span>
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>24/7</span>
              </li>
              <li className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span>Sun - Mon</span>
              </li>
            </ul>
          </div>

          {/* Campus Hubs */}
          <div className="col-span-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
              Campus Zones
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              {UNIVERSITY_LOCATIONS.slice(0, 5).map((loc) => (
                <li key={loc} className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-secondary shrink-0" />
                  <span>{loc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation & Policies */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
              Platform
            </h4>
            <ul className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/marketplace" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/seller/activate" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Become a Seller
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="border-t border-slate-200 dark:border-slate-800 mt-10 pt-6 flex flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400 gap-2.5">
          <p>© {new Date().getFullYear()} MUST Marketplace. Meru University of Science & Technology.</p>
          <p className="text-xs text-slate-400 dark:text-slate-400 font-medium tracking-wide">
            Powered By Programmer - Software Engineer
          </p>
        </div>
      </div>
    </footer>
  );
}
