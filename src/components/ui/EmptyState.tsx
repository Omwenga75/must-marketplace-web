import React from "react";
import { Sparkles } from "lucide-react";

export type EmptyStateColorScheme =
  | "emerald"
  | "indigo"
  | "blue"
  | "amber"
  | "rose"
  | "violet"
  | "slate";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  badge?: React.ReactNode;
  hints?: string[];
  /** Fill the viewport height minus nav (use in full-page contexts) */
  fullPage?: boolean;
  /** Subtle — no border/card; just the centred content */
  inline?: boolean;
  /** Presentation variant: card wraps in a styled card with glow, dashed gives a dashed border */
  variant?: "default" | "card" | "dashed";
  /** Accent color scheme for glows, badges and icon highlights */
  colorScheme?: EmptyStateColorScheme;
  className?: string;
}

const COLOR_MAP: Record<
  EmptyStateColorScheme,
  {
    glow: string;
    iconRing: string;
    iconBg: string;
    iconBorder: string;
    iconText: string;
    badge: string;
    hintDot: string;
  }
> = {
  emerald: {
    glow: "from-emerald-500/25 via-teal-500/10 to-transparent",
    iconRing: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20",
    iconBg: "bg-gradient-to-br from-emerald-500/15 to-teal-500/20 dark:from-emerald-500/20 dark:to-teal-500/30",
    iconBorder: "border-emerald-500/30 dark:border-emerald-500/40",
    iconText: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    hintDot: "bg-emerald-500",
  },
  indigo: {
    glow: "from-indigo-500/25 via-blue-500/10 to-transparent",
    iconRing: "bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/20",
    iconBg: "bg-gradient-to-br from-indigo-500/15 to-blue-500/20 dark:from-indigo-500/20 dark:to-blue-500/30",
    iconBorder: "border-indigo-500/30 dark:border-indigo-500/40",
    iconText: "text-indigo-600 dark:text-indigo-400",
    badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
    hintDot: "bg-indigo-500",
  },
  blue: {
    glow: "from-blue-500/25 via-sky-500/10 to-transparent",
    iconRing: "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20",
    iconBg: "bg-gradient-to-br from-blue-500/15 to-sky-500/20 dark:from-blue-500/20 dark:to-sky-500/30",
    iconBorder: "border-blue-500/30 dark:border-blue-500/40",
    iconText: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    hintDot: "bg-blue-500",
  },
  amber: {
    glow: "from-amber-500/25 via-orange-500/10 to-transparent",
    iconRing: "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20",
    iconBg: "bg-gradient-to-br from-amber-500/15 to-orange-500/20 dark:from-amber-500/20 dark:to-orange-500/30",
    iconBorder: "border-amber-500/30 dark:border-amber-500/40",
    iconText: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    hintDot: "bg-amber-500",
  },
  rose: {
    glow: "from-rose-500/25 via-pink-500/10 to-transparent",
    iconRing: "bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20",
    iconBg: "bg-gradient-to-br from-rose-500/15 to-pink-500/20 dark:from-rose-500/20 dark:to-pink-500/30",
    iconBorder: "border-rose-500/30 dark:border-rose-500/40",
    iconText: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
    hintDot: "bg-rose-500",
  },
  violet: {
    glow: "from-violet-500/25 via-purple-500/10 to-transparent",
    iconRing: "bg-violet-500/10 dark:bg-violet-500/15 border-violet-500/20",
    iconBg: "bg-gradient-to-br from-violet-500/15 to-purple-500/20 dark:from-violet-500/20 dark:to-purple-500/30",
    iconBorder: "border-violet-500/30 dark:border-violet-500/40",
    iconText: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
    hintDot: "bg-violet-500",
  },
  slate: {
    glow: "from-slate-400/20 via-slate-500/10 to-transparent",
    iconRing: "bg-slate-100 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60",
    iconBg: "bg-slate-100 dark:bg-slate-800",
    iconBorder: "border-slate-200 dark:border-slate-700",
    iconText: "text-slate-600 dark:text-slate-400",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    hintDot: "bg-slate-400",
  },
};

/**
 * Shared executive EmptyState component used across Admin, Seller Dashboard,
 * Marketplace, and Search views.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  badge,
  hints,
  fullPage = false,
  inline = false,
  variant = "default",
  colorScheme = "slate",
  className = "",
}: EmptyStateProps) {
  const cfg = COLOR_MAP[colorScheme] || COLOR_MAP.slate;

  const containerClasses =
    variant === "card"
      ? "relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-b from-white/95 via-slate-50/50 to-white/95 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950/90 border border-slate-200/90 dark:border-slate-800 shadow-sm dark:shadow-2xl py-12 sm:py-16 px-6 sm:px-10"
      : variant === "dashed"
      ? "relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 py-12 sm:py-16 px-6 sm:px-10"
      : fullPage
      ? "min-h-[calc(100dvh_-_12rem)] py-16 px-6"
      : inline
      ? "py-10 px-4"
      : "py-16 px-6";

  return (
    <div
      className={`relative flex flex-col items-center justify-center text-center ${containerClasses} ${className}`}
    >
      {/* Top ambient radial glow for card/dashed variants */}
      {(variant === "card" || variant === "dashed") && (
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b ${cfg.glow} blur-3xl opacity-70 pointer-events-none`}
        />
      )}

      {/* Optional Badge */}
      {badge && (
        <div className="relative mb-5 z-10">
          {typeof badge === "string" ? (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border ${cfg.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.hintDot} animate-pulse`} />
              {badge}
            </span>
          ) : (
            badge
          )}
        </div>
      )}

      {/* Layered Icon with ambient depth */}
      <div className="relative mb-6 z-10">
        {/* Soft background glow */}
        <div
          className={`absolute inset-0 rounded-full blur-2xl scale-150 pointer-events-none opacity-60 bg-gradient-to-tr ${cfg.glow}`}
        />

        {/* Outer decorative ring */}
        <div
          className={`relative p-2.5 sm:p-3 rounded-3xl border shadow-sm backdrop-blur-xs transition-transform duration-300 hover:scale-105 ${cfg.iconRing}`}
        >
          {/* Inner vibrant icon bubble */}
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border flex items-center justify-center shadow-md ${cfg.iconBg} ${cfg.iconBorder} ${cfg.iconText}`}
          >
            {icon}
          </div>
        </div>
      </div>

      {/* Title & Description */}
      <div className="relative z-10 max-w-lg space-y-2 mb-2">
        <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Quick Suggestions / Helpful Tips */}
      {hints && hints.length > 0 && (
        <div className="relative z-10 w-full max-w-md mx-auto mt-4 mb-2 p-3.5 sm:p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-left shadow-2xs backdrop-blur-xs">
          <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Admin Suggestions</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {hints.map((hint, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.hintDot} mt-1.5 shrink-0`} />
                <span className="leading-snug">{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 mt-6">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
