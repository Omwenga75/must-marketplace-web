import React from "react";
import Link from "next/link";
import {
  ShoppingBag,
  ShieldCheck,
  Users,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  HeartHandshake,
} from "lucide-react";
import { UNIVERSITY_LOCATIONS } from "@/lib/constants";

export const metadata = {
  title: "About Us | MUST Marketplace",
  description: "Learn more about Meru University of Science and Technology campus marketplace.",
};

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-16 space-y-8 sm:space-y-12">
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          About Us
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          The dedicated student-to-student commerce community built for Meru University of Science and
          Technology. We empower comrades to buy, sell, and exchange essentials safely within campus.
        </p>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Exclusively for Students
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Every listing comes directly from student sellers across campus hostels and nearby residencies.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Zero Commission
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Keep 100% of what you earn. We don't take any cuts or transaction fees from student trades.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Safe On-Campus Meetups
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Inspect items physically at recognized campus hubs such as the Library Foyer, Student Center, or Gate A before paying.
          </p>
        </div>
      </div>

      {/* Campus Zones Section */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Active Campus Zones
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse and meet sellers convenient to where you live or study:
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {UNIVERSITY_LOCATIONS.map((loc) => (
            <div
              key={loc}
              className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              <MapPin className="w-4 h-4 text-secondary shrink-0" />
              <span>{loc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Call to Action */}
      <div className="rounded-3xl bg-primary-dark text-white p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-card">
        <div className="space-y-2 text-center sm:text-left">
          <h3 className="text-2xl font-black tracking-tight">Ready to start trading?</h3>
          <p className="text-emerald-100 text-xs sm:text-sm max-w-md">
            Explore listings or post an item today to connect with hundreds of students.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            href="/marketplace"
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm text-center shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>Explore Marketplace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/contact"
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm text-center border border-white/20 transition-all"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
