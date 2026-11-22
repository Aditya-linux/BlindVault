/** First-time hand-guided tour — client persistence only. */

export const TUTORIAL_STORAGE_KEY = "bv_tutorial_v1";

export type TutorialStepId =
  | "welcome"
  | "watch"
  | "wallet"
  | "paddle"
  | "bid"
  | "peek"
  | "reveal"
  | "done";

export type TutorialStep = {
  id: TutorialStepId;
  title: string;
  body: string;
  tip?: string;
  cta: string;
  href: string | null;
  secondaryCta?: string;
  secondaryHref?: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Blind Vault",
    body: "You’re bidding on a mystery box of creature cards. What’s inside stays secret until the timer ends. Highest bid wins the cards.",
    tip: "This is a free test game on Solana Devnet. SCRIP credits are play money — not real cash.",
    cta: "Show me around",
    href: null,
  },
  {
    id: "watch",
    title: "Look around first (no wallet needed)",
    body: "Browse the card warehouse and watch a live lot anytime. You only need a wallet when you’re ready to bid or peek.",
    tip: "Watching is free and public. Bidding is private.",
    cta: "Browse cards",
    href: "/warehouse",
    secondaryCta: "Skip for now",
  },
  {
    id: "wallet",
    title: "Use a Devnet wallet",
    body: "Install Phantom or Solflare, then switch it to Devnet (Settings → Developer → Testnet / Devnet). Grab a little free Devnet SOL from faucet.solana.com for tiny network fees.",
    tip: "Mainnet won’t work here. This app is Devnet-only.",
    cta: "Go to setup",
    href: "/paddle",
  },
  {
    id: "paddle",
    title: "Three quick setup steps",
    body: "On the setup page: connect your wallet → sign the guest book (free message) → claim free SCRIP credits for bidding.",
    tip: "The guest book is just a signature. SCRIP claims cool down every 12 hours.",
    cta: "Open setup",
    href: "/paddle",
  },
  {
    id: "bid",
    title: "Place one sealed bid",
    body: "When a lot is open, enter it and seal one SCRIP bid. Nobody else can see how much you bid until the round ends. One bid per wallet.",
    tip: "If bidding is closed, wait for “Bidding opens in,” then join the next lot.",
    cta: "Go to live lot",
    href: "/",
  },
  {
    id: "peek",
    title: "Optional: buy a peek",
    body: "A peek costs a little SCRIP and shows one card slot’s rarity and type — not the exact creature. Only your wallet can see it.",
    tip: "Skip peeks if you prefer to bid fully blind.",
    cta: "Continue",
    href: null,
  },
  {
    id: "reveal",
    title: "When the timer hits zero",
    body: "The vault opens and shows the cards. If you won, you’ll get a “You packed …” moment. Every vault’s prize also lands in History for everyone to see.",
    tip: "Losing bids get refunded. Check History for past winners, or My bids for your packs.",
    cta: "Open History",
    href: "/history",
  },
  {
    id: "done",
    title: "You’re ready",
    body: "Loop: set up → sealed bid → optional peek → reveal → pack. Past vaults stay in History so the prize chain stays in sync with the clock.",
    tip: "Still a test build on Devnet — have fun, no real money at risk.",
    cta: "Finish tour",
    href: null,
  },
];

export type TutorialState = {
  completed: boolean;
  stepIndex: number;
  resumed?: boolean;
};

export function defaultTutorialState(): TutorialState {
  return { completed: false, stepIndex: 0 };
}

export function loadTutorialState(): TutorialState {
  if (typeof window === "undefined") return defaultTutorialState();
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) return defaultTutorialState();
    const parsed = JSON.parse(raw) as Partial<TutorialState>;
    return {
      completed: Boolean(parsed.completed),
      stepIndex: Math.min(
        Math.max(0, Number(parsed.stepIndex) || 0),
        TUTORIAL_STEPS.length - 1,
      ),
      resumed: Boolean(parsed.resumed),
    };
  } catch {
    return defaultTutorialState();
  }
}

export function saveTutorialState(state: TutorialState): void {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function isFirstVisit(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TUTORIAL_STORAGE_KEY) == null;
}
