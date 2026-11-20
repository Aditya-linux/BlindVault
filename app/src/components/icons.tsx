/**
 * HD vector icons — Lucide strokes when available, crisp custom fallbacks otherwise.
 * absoluteStrokeWidth keeps hairlines sharp at any DPR (wallet-app quality).
 */
"use client";

import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  Lock,
  Landmark,
  Package,
  Stamp,
  Mail,
  Gavel,
  Search,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/cn";

type IconProps = {
  className?: string;
  title?: string;
};

const stroke: Pick<LucideProps, "strokeWidth"> = {
  strokeWidth: 2.25,
};

function wrap(
  Icon: ComponentType<LucideProps>,
  { className, title }: IconProps,
  label: string,
) {
  return (
    <Icon
      className={cn("size-5", className)}
      aria-label={title ?? label}
      {...stroke}
    />
  );
}

export function IconPadlock(p: IconProps) {
  return wrap(Lock, p, "Padlock");
}
export function IconVaultDoor(p: IconProps) {
  return wrap(Landmark, p, "Vault");
}
export function IconPaddle(p: IconProps) {
  return wrap(Ticket, p, "Auction paddle");
}
export function IconCrate(p: IconProps) {
  return wrap(Package, p, "Warehouse crate");
}
export function IconStamp(p: IconProps) {
  return wrap(Stamp, p, "Evidence stamp");
}
export function IconEnvelope(p: IconProps) {
  return wrap(Mail, p, "Sealed bid");
}
export function IconGavel(p: IconProps) {
  return wrap(Gavel, p, "Gavel");
}
export function IconMagnifier(p: IconProps) {
  return wrap(Search, p, "Inspect");
}
