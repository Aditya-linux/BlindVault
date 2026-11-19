/**
 * Wallet presentation state machine.
 * Never stores private keys/seeds. Signing always requires user wallet approval.
 */

export type WalletStatus =
  | "guest"
  | "detecting"
  | "ready"
  | "connecting"
  | "connected"
  | "wrong_network"
  | "rejected"
  | "unavailable"
  | "mobile_handoff";

export type WalletSnapshot = {
  status: WalletStatus;
  publicKey: string | null;
  message: string;
};

const STORAGE_KEY = "pulse.call.wallet.pubkey";

export class WalletController {
  private status: WalletStatus = "guest";
  private publicKey: string | null = null;
  private message = "Practice as guest or connect a Devnet wallet.";

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(saved)) {
        // Public key only — never a secret. Still requires fresh connect to sign.
        this.publicKey = saved;
        this.status = "ready";
        this.message =
          "Previous wallet remembered (public key only). Reconnect to sign.";
      }
    } catch {
      // ignore storage failures
    }
  }

  snapshot(): WalletSnapshot {
    return {
      status: this.status,
      publicKey: this.publicKey,
      message: this.message,
    };
  }

  /** Detect injected Wallet Standard / windowed provider without auto-connecting. */
  detect(): WalletSnapshot {
    this.status = "detecting";
    const injected =
      typeof window !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Boolean((window as any).solana || (window as any).phantom?.solana);

    if (!injected) {
      const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      this.status = mobile ? "mobile_handoff" : "unavailable";
      this.message = mobile
        ? "Open this site in your wallet’s in-app browser to connect on mobile."
        : "No Solana wallet extension detected. Guest practice still works.";
      return this.snapshot();
    }

    this.status = "ready";
    this.message = "Wallet detected. Connect to place onchain Pulse Calls on Devnet.";
    return this.snapshot();
  }

  async connect(): Promise<WalletSnapshot> {
    this.detect();
    if (this.status === "unavailable" || this.status === "mobile_handoff") {
      return this.snapshot();
    }

    this.status = "connecting";
    this.message = "Approve connection in your wallet…";

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = (window as any).solana || (window as any).phantom?.solana;
      if (!provider?.connect) {
        this.status = "unavailable";
        this.message = "Wallet provider missing connect().";
        return this.snapshot();
      }
      const res = await provider.connect();
      const key = String(res.publicKey?.toString?.() ?? res.publicKey ?? "");
      if (!key) {
        this.status = "rejected";
        this.message = "Connection returned no public key.";
        return this.snapshot();
      }
      this.publicKey = key;
      localStorage.setItem(STORAGE_KEY, key);
      this.status = "connected";
      this.message =
        "Connected on Devnet path. Signing still requires your approval each time.";
      return this.snapshot();
    } catch {
      this.status = "rejected";
      this.message = "Connection rejected or failed. Guest practice remains available.";
      return this.snapshot();
    }
  }

  disconnect(): WalletSnapshot {
    this.status = "guest";
    this.publicKey = null;
    localStorage.removeItem(STORAGE_KEY);
    this.message = "Disconnected. Continuing as guest.";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = (window as any).solana;
      provider?.disconnect?.();
    } catch {
      // ignore
    }
    return this.snapshot();
  }
}
