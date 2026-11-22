import type { Metadata } from "next";
import { AppProviders } from "@/providers/AppProviders";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://blind-vault-amber.vercel.app"),
  title: "Blind Vault — mystery card auctions",
  description:
    "Bid on sealed creature packs. Contents and bids stay private until reveal. Free play on Solana Devnet.",
  applicationName: "Blind Vault",

  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/logo-mark.png", sizes: "180x180", type: "image/png" },
      { url: "/brand/logo-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon-32.png"],
  },
  openGraph: {
    title: "Blind Vault",
    description:
      "Sealed creature-card auctions on Solana Devnet — private lots, sealed bids, MagicBlock PER.",
    images: [{ url: "/brand/logo-512.png", width: 512, height: 512, alt: "Blind Vault octopus logo" }],
  },
  twitter: {
    card: "summary",
    title: "Blind Vault",
    description:
      "Sealed creature-card auctions on Solana Devnet — private lots, sealed bids, MagicBlock PER.",
    images: ["/brand/logo-512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body>
        <AppProviders>
          <Shell>{children}</Shell>
        </AppProviders>
      </body>
    </html>
  );
}
