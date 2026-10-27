import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // App Theme Matching Android MUST Marketplace
        primary: {
          DEFAULT: "#DEF5E5",      // PrimaryGreen (Pale Mint)
          foreground: "#0F172A", // OnPrimary (Dark Navy)
          container: "#BBE5C7",  // PrimaryContainer
          dark: "#064E3B",       // OnPrimaryContainer
          emerald: "#059669",    // Accent Emerald for buttons/links
          accent: "#10B981",     // SuccessGreen
        },
        secondary: {
          DEFAULT: "#F97316",      // SecondaryAmber (Sunset Orange)
          foreground: "#FFFFFF", // OnSecondary
          container: "#FFEDD5",  // SecondaryContainer
          dark: "#C2410C",       // OnSecondaryContainer
        },
        brand: {
          dark: "#0F172A",       // BackgroundDark / Navy Slate
          cardDark: "#1E293B",   // SurfaceDark
          cardVariantDark: "#334155", // SurfaceVariantDark
          light: "#F8FAFC",      // BackgroundLight
          cardLight: "#FFFFFF",  // SurfaceLight
          cardVariantLight: "#F1F5F9", // SurfaceVariantLight
          textMuted: "#64748B",  // TextMediumEmphasisLight
          textMutedDark: "#94A3B8", // TextMediumEmphasisDark
        },
        status: {
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        card: "0 4px 20px -2px rgba(15, 23, 42, 0.08)",
        floating: "0 10px 30px -5px rgba(15, 23, 42, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
