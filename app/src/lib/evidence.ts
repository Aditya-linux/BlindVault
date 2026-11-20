import stamped from "../../../data/exhibits.json";

export type EvidenceEntry = {
  vaultId: string;
  label: string;
  sig: string;
  layer: "solana" | "tee";
  at: number;
};

const KEY = "bv_evidence";

const STAMPED = stamped as EvidenceEntry[];

export function pushEvidence(entry: EvidenceEntry): void {
  try {
    const all = loadLocal();
    all.unshift(entry);
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

function loadLocal(): EvidenceEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EvidenceEntry[];
  } catch {
    return [];
  }
}

export function loadEvidence(vaultId?: string): EvidenceEntry[] {
  const local = loadLocal();
  const seen = new Set(local.map((e) => e.sig));
  const merged = [
    ...local,
    ...STAMPED.filter((e) => !seen.has(e.sig)),
  ];
  if (!vaultId) return merged;
  return merged.filter((e) => e.vaultId === vaultId);
}
