import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      encoding: false,
    };
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "pino-pretty",
      "lokijs",
    ];
    // Desktop-only: stub Solana Mobile (avoids @solana/kit ESM webpack break)
    const empty = path.resolve(__dirname, "src/lib/empty-module.js");
    config.resolve.alias = {
      ...config.resolve.alias,
      "@solana-mobile/wallet-adapter-mobile": empty,
      "@solana-mobile/mobile-wallet-adapter-protocol": empty,
    };
    return config;
  },
};

export default nextConfig;
