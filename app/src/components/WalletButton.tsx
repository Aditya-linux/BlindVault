"use client";

import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  {
    ssr: false,
    loading: () => (
      <span className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-medium text-paper opacity-70">
        Wallet…
      </span>
    ),
  },
);

export function WalletButton() {
  return (
    <div className="wallet-btn-wrap relative z-50 shrink-0">
      <WalletMultiButton />
    </div>
  );
}
