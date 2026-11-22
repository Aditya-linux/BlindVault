"use client";

import { useTutorial } from "@/hooks/useTutorial";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type StartTutorialButtonProps = {
  className?: string;
  variant?: "default" | "paper" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
};

/** Restart / open the first-time hand-guided tour. */
export function StartTutorialButton({
  className,
  variant = "paper",
  size = "sm",
  label = "Guided tutorial",
}: StartTutorialButtonProps) {
  const tour = useTutorial();
  if (!tour.hydrated) {
    return (
      <span
        className={cn(buttonVariants({ variant, size }), "opacity-50", className)}
        aria-hidden
      >
        {label}
      </span>
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => tour.start()}
    >
      {label}
    </Button>
  );
}
