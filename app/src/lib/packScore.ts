import type { StackedItem } from "@/lib/stackInventory";

/** Sticker-value total for a revealed pack (SCRIP UI units). */
export function packStickerValue(cards: StackedItem[]): number {
  return cards.reduce((sum, c) => sum + Number(c.value) * Number(c.count), 0);
}

export type PackScore = {
  investedScrip: number;
  wonScrip: number;
  multiple: number | null;
  ahead: boolean;
};

/** Compare sealed bid (raw or UI) vs pack sticker value. */
export function scorePack(opts: {
  highestBidRaw?: number | null;
  cards: StackedItem[];
}): PackScore {
  const investedScrip = Math.max(0, Number(opts.highestBidRaw ?? 0) / 1_000_000);
  const wonScrip = packStickerValue(opts.cards);
  const multiple =
    investedScrip > 0 ? Math.round((wonScrip / investedScrip) * 10) / 10 : null;
  return {
    investedScrip,
    wonScrip,
    multiple,
    ahead: multiple != null ? multiple >= 1 : wonScrip > 0,
  };
}

export function formatPackScoreLine(score: PackScore): string {
  const inv = formatScrip(score.investedScrip);
  const won = formatScrip(score.wonScrip);
  if (score.multiple == null) {
    return `You won cards worth ${won} SCRIP`;
  }
  if (score.multiple >= 1) {
    return `You invested ${inv} SCRIP · won ~${won} SCRIP of cards · ${score.multiple}× your bid`;
  }
  return `You invested ${inv} SCRIP · won ~${won} SCRIP of cards · ${score.multiple}× your bid`;
}

function formatScrip(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace(/\.0$/, "");
}
