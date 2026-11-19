/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_NETWORK: string;
  readonly VITE_SOLANA_RPC_URL: string;
  readonly VITE_MAGICBLOCK_ER_RPC_URL: string;
  readonly VITE_MAGICBLOCK_ER_WS_URL: string;
  readonly VITE_PROGRAM_ID: string;
  readonly VITE_PRICE_FEED_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
