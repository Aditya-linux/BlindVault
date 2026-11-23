"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { categoryLabel, rarityLabel } from "@/lib/format";
import {
  creatureDisplayName,
  creatureImageSrc,
} from "@/lib/creatureCatalog";
import { creaturePalette } from "@/lib/creatureArt";
import { motion, soft } from "@/components/motion";

type Props = {
  index: number;
  name: string;
  rarity: number;
  category: number;
  value: number;
  sold?: boolean;
  compact?: boolean;
  /** Stack count for duplicates — show ×N when > 1. */
  count?: number;
};

function rarityTier(
  rarity: number,
): "common" | "silver" | "shiny" | "gold" | "legendary" {
  if (rarity >= 4) return "legendary";
  if (rarity === 3) return "gold";
  if (rarity === 2) return "shiny";
  if (rarity === 1) return "silver";
  return "common";
}

const HOVER_LIFT = {
  common: { y: -8, scale: 1.04 },
  silver: { y: -9, scale: 1.045 },
  shiny: { y: -10, scale: 1.05 },
  gold: { y: -12, scale: 1.06 },
  legendary: { y: -14, scale: 1.07 },
} as const;

export function CollectibleCard({
  index,
  name,
  rarity,
  category,
  value,
  sold = false,
  compact = false,
  count = 1,
}: Props) {
  const reduce = useReducedMotion();
  const [hot, setHot] = useState(false);
  const palette = creaturePalette(index, rarity);
  const displayName = creatureDisplayName(index, name);
  const src = creatureImageSrc(index);
  const rarityName = rarityLabel(rarity);
  const tier = rarityTier(rarity);
  const lift = HOVER_LIFT[tier];

  return (
    <motion.article
      className={[
        "collectible-card relative",
        `collectible-card--${tier}`,
        compact ? "collectible-card--compact" : "",
        hot ? "is-hot" : "",
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
      onHoverStart={() => setHot(true)}
      onHoverEnd={() => setHot(false)}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      animate={hot && !reduce ? lift : { y: 0, scale: 1 }}
      transition={soft}
    >
      <div className="collectible-card__glow" aria-hidden />
      <div className="collectible-card__sheen" aria-hidden />
      <div className="collectible-card__frame">
        <div className="collectible-card__header">
          <span className="collectible-card__name">
            {displayName}
            {count > 1 ? (
              <span className="collectible-card__qty" aria-label={`times ${count}`}>
                {" "}
                ×{count}
              </span>
            ) : null}
          </span>
          <span className="collectible-card__hp">{value}</span>
        </div>

        <div className="collectible-card__art">
          {(tier === "shiny" || tier === "gold" || tier === "legendary") && (
            <div className="collectible-card__holo" aria-hidden />
          )}
          {tier === "legendary" && (
            <div className="collectible-card__sparkles" aria-hidden />
          )}
          {src ? (
            <div className="collectible-card__img-wrap">
              <Image
                src={src}
                alt={displayName}
                fill
                sizes="(max-width:640px) 45vw, (max-width:1024px) 22vw, 180px"
                className="collectible-card__img"
                unoptimized
                priority={index < 8}
              />
            </div>
          ) : (
            <div className="collectible-card__img-fallback">{index}</div>
          )}
          <span className="collectible-card__no">
            No. {String(index + 1).padStart(3, "0")}
          </span>
        </div>

        <div className="collectible-card__meta">
          <span className={`collectible-card__rarity rarity-${rarity}`}>
            {rarityName}
          </span>
          <span className="collectible-card__type">
            {categoryLabel(category)}
          </span>
        </div>

        {!compact && (
          <p className="collectible-card__flavor">
            Sealed warehouse find · pulls from private vault fills
          </p>
        )}
      </div>

      {count > 1 && (
        <span className="collectible-card__count" aria-hidden>
          ×{count}
        </span>
      )}
      {sold && <span className="collectible-card__sold">Sold</span>}
    </motion.article>
  );
}
