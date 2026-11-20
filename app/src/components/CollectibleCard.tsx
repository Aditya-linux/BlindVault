"use client";

import type { CSSProperties } from "react";
import { categoryLabel, rarityLabel } from "@/lib/format";
import { creaturePalette, creatureShape } from "@/lib/creatureArt";

type Props = {
  index: number;
  name: string;
  rarity: number;
  category: number;
  value: number;
  sold?: boolean;
  compact?: boolean;
};

export function CollectibleCard({
  index,
  name,
  rarity,
  category,
  value,
  sold = false,
  compact = false,
}: Props) {
  const palette = creaturePalette(index, rarity);
  const shape = creatureShape(index);
  const rarityName = rarityLabel(rarity);
  const shiny = rarity >= 2;
  const legendary = rarity >= 4;
  const epic = rarity === 3;

  return (
    <article
      className={[
        "collectible-card pressable relative overflow-hidden",
        shiny ? "collectible-card--shiny" : "",
        epic ? "collectible-card--epic" : "",
        legendary ? "collectible-card--legendary" : "",
        compact ? "collectible-card--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--card-bg": palette.bg,
          "--card-mid": palette.mid,
          "--card-accent": palette.accent,
          "--card-ink": palette.ink,
          "--card-foil": palette.foil,
        } as CSSProperties
      }
    >
      <div className="collectible-card__frame">
        <div className="collectible-card__header">
          <span className="collectible-card__name">{name}</span>
          <span className="collectible-card__hp">{value}</span>
        </div>

        <div className="collectible-card__art" aria-hidden>
          {shiny && <div className="collectible-card__holo" />}
          <CreatureSvg index={index} shape={shape} palette={palette} legendary={legendary} />
          <span className="collectible-card__no">No. {String(index + 1).padStart(3, "0")}</span>
        </div>

        <div className="collectible-card__meta">
          <span className={`collectible-card__rarity rarity-${rarity}`}>{rarityName}</span>
          <span className="collectible-card__type">{categoryLabel(category)}</span>
        </div>

        {!compact && (
          <p className="collectible-card__flavor">
            Sealed warehouse find · pulls from private vault fills
          </p>
        )}
      </div>

      {sold && <span className="collectible-card__sold">Sold</span>}
    </article>
  );
}

function CreatureSvg({
  index,
  shape,
  palette,
  legendary,
}: {
  index: number;
  shape: ReturnType<typeof creatureShape>;
  palette: ReturnType<typeof creaturePalette>;
  legendary: boolean;
}) {
  const ear = 18 + (index % 5) * 3;
  const eye = 6 + (index % 3);
  const smile = index % 2 === 0;

  return (
    <svg viewBox="0 0 200 200" className="collectible-card__creature" role="img">
      <defs>
        <radialGradient id={`glow-${index}`} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor={palette.foil} stopOpacity="0.85" />
          <stop offset="70%" stopColor={palette.mid} stopOpacity="0.55" />
          <stop offset="100%" stopColor={palette.bg} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#glow-${index})`} />
      {legendary && (
        <circle cx="100" cy="96" r="78" fill="none" stroke={palette.foil} strokeWidth="3" opacity="0.55" />
      )}

      {shape === "tall" && (
        <ellipse cx="100" cy="112" rx="42" ry="62" fill={palette.accent} />
      )}
      {shape === "wide" && (
        <ellipse cx="100" cy="118" rx="68" ry="44" fill={palette.accent} />
      )}
      {shape === "spiky" && (
        <path
          d="M100 42 L128 88 L168 92 L136 120 L148 162 L100 140 L52 162 L64 120 L32 92 L72 88 Z"
          fill={palette.accent}
        />
      )}
      {shape === "round" && <circle cx="100" cy="108" r="58" fill={palette.accent} />}
      {shape === "blob" && (
        <path
          d="M70 70 C55 95 58 140 88 155 C110 165 140 150 148 120 C156 88 130 55 100 58 C88 59 78 62 70 70 Z"
          fill={palette.accent}
        />
      )}

      {/* ears / horns */}
      <ellipse cx={70} cy={70} rx={ear / 3} ry={ear / 2} fill={palette.mid} transform="rotate(-18 70 70)" />
      <ellipse cx={130} cy={70} rx={ear / 3} ry={ear / 2} fill={palette.mid} transform="rotate(18 130 70)" />

      {/* face */}
      <circle cx={82} cy={100} r={eye} fill={palette.ink} />
      <circle cx={118} cy={100} r={eye} fill={palette.ink} />
      <circle cx={84} cy={98} r={eye / 3} fill="#fff" />
      <circle cx={120} cy={98} r={eye / 3} fill="#fff" />
      {smile ? (
        <path d="M86 122 Q100 136 114 122" fill="none" stroke={palette.ink} strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M88 128 Q100 118 112 128" fill="none" stroke={palette.ink} strokeWidth="3" strokeLinecap="round" />
      )}

      {/* cheek shine */}
      <circle cx={68} cy={112} r="6" fill={palette.foil} opacity="0.55" />
      <circle cx={132} cy={112} r="6" fill={palette.foil} opacity="0.55" />
    </svg>
  );
}
