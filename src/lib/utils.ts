import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount).replace("KES", "KSh");
}

export function formatRelativeTime(dateStringOrTimestamp: string | number): string {
  try {
    if (!dateStringOrTimestamp) return "recently";
    let timestamp = 0;
    if (typeof dateStringOrTimestamp === "number") {
      timestamp = dateStringOrTimestamp;
    } else {
      const num = Number(dateStringOrTimestamp);
      if (!isNaN(num) && num > 1000000000) {
        timestamp = num;
      } else {
        timestamp = new Date(dateStringOrTimestamp).getTime();
      }
    }

    if (isNaN(timestamp) || timestamp <= 0) return String(dateStringOrTimestamp);

    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);

    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return "Yesterday";
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

    // For older: show "27 Oct" style
    return new Date(timestamp).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return String(dateStringOrTimestamp);
  }
}

/** Format timestamp for inside a chat bubble: show time (10:34 AM) or date+time */
export function formatMessageTime(dateStringOrTimestamp: string | number): string {
  try {
    if (!dateStringOrTimestamp) return "";
    let timestamp = 0;
    if (typeof dateStringOrTimestamp === "number") {
      timestamp = dateStringOrTimestamp;
    } else {
      const num = Number(dateStringOrTimestamp);
      timestamp = !isNaN(num) && num > 1000000000 ? num : new Date(dateStringOrTimestamp).getTime();
    }
    if (isNaN(timestamp) || timestamp <= 0) return "";

    const diff = Math.floor((Date.now() - timestamp) / 1000);
    const d = new Date(timestamp);

    // Within last 60 seconds → "just now"
    if (diff < 60) return "just now";

    // Same day → show time only: "10:34 AM"
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (sameDay) {
      return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Yesterday ${d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`;
    }

    // Older: "27 Oct, 10:34 AM"
    return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "";
  }
}

export function getInitials(name: string): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
