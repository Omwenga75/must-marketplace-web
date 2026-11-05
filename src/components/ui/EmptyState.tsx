import React from "react";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Fill the viewport height minus nav (use in full-page contexts) */
  fullPage?: boolean;
  /** Subtle — no border/card; just the centred content */
  inline?: boolean;
}

/**
 * Shared empty-state component used across admin, seller dashboard,
 * marketplace, saved items, and anywhere else a list can be empty.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Users className="w-8 h-8" />}
 *     title="No users found"
 *     description="No accounts match the selected filters."
 *     action={<button …>Clear filters</button>}
 *   />
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  fullPage = false,
  inline = false,
}: EmptyStateProps) {
  const heightClass = fullPage
    ? "min-h-[calc(100dvh_-_12rem)]"
    : inline
    ? "py-16"
    : "py-16";

  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 ${heightClass}`}
    >
      {/* Icon bubble */}
      <div className="relative mb-5">
        {/* Soft glow ring */}
        <div className="absolute inset-0 rounded-full bg-slate-200/60 dark:bg-slate-700/40 blur-xl scale-150 pointer-events-none" />
        <div className="relative w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center shadow-sm text-slate-400 dark:text-slate-500">
          {icon}
        </div>
      </div>

      {/* Text */}
      <div className="max-w-xs space-y-2 mb-5">
        <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Optional CTA */}
      {action && <div>{action}</div>}
    </div>
  );
}
