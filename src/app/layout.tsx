import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "MUST Marketplace | Meru University of Science and Technology",
  description:
    "Official campus marketplace for Meru University students. Buy, sell, and connect with fellow students safely for electronics, books, house items, and fashion.",
  keywords: [
    "MUST Marketplace",
    "Meru University",
    "MUST students",
    "Campus marketplace",
    "Buy and sell MUST",
    "Nchiru marketplace",
    "Kenya campus marketplace",
  ],
  authors: [{ name: "MUST Student Community" }],
  openGraph: {
    title: "MUST Marketplace — Buy. Sell. Connect on Campus",
    description: "The trusted marketplace for Meru University students.",
    siteName: "MUST Marketplace",
    locale: "en_KE",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#DEF5E5" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('must_theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-brand-light dark:bg-brand-dark antialiased">
        <AuthProvider>
          <FavoritesProvider>
            <Navbar />
            <main className="flex-1 w-full pb-16 sm:pb-0">{children}</main>
            <Footer />
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
