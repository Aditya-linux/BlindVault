"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

type BrandMarkProps = {
  /** Visual size in px (rendered square). */
  size?: number;
  /** Prefer navy disc for tiny nav chips; transparent mark for hero. */
  variant?: "mark" | "plain";
  className?: string;
  priority?: boolean;
};

/**
 * Blindfolded octopus logo — square transparent asset (no letterbox bars).
 */
export function BrandMark({
  size = 40,
  variant = "mark",
  className,
  priority = false,
}: BrandMarkProps) {
  const src =
    variant === "mark" ? "/brand/logo-mark.png" : "/brand/logo.png";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full",
        variant === "mark" && "bg-[#071428] ring-1 ring-white/10",
        variant === "plain" && "bg-transparent",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain"
        priority={priority}
        sizes={`${size}px`}
      />
    </span>
  );
}
