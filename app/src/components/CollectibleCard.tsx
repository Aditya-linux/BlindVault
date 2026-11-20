"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { categoryLabel, rarityLabel } from "@/lib/format";
import {
  creatureDisplayName,
  creatureImageSrc,
  rarityOddsLabel,
} from "@/lib/creatureCatalog";
import { creaturePalette } from "@/lib/creatureArt";

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
  const displayName = creatureDisplayName(index, name);
  const src = creatureImageSrc(index);
  const rarityName = rarityLabel(rarity);
  const shiny = rarity === 2;
  const gold = rarity === 3;
  const legendary = rarity >= 4;
  const silver = rarity === 1;

  return (
    <article
      className={[
        "collectible-card pressable relative overflow-hidden",
        silver ? "collectible-card--silver" : "",
        shiny ? "collectible-card--shiny" : "",
        gold ? "collectible-card--gold" : "",
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
          <span className="collectible-card__name">{displayName}</span>
          <span className="collectible-card__hp">{value}</span>
        </div>

        <div className="collectible-card__art">
          {(shiny || gold || legendary) && (
            <div className="collectible-card__holo" aria-hidden />
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
            {categoryLabel(category)} · {rarityOddsLabel(rarity)}
          </span>
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
