"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "bv-btn inline-flex items-center justify-center gap-2 whitespace-nowrap text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent font-semibold text-[#041018]",
        teal: "bg-accent font-semibold text-[#041018]",
        paper: "border border-line bg-paper/95 text-ink",
        danger: "bg-stamp-red font-semibold text-[#18060a]",
        brass: "border border-line bg-cardboard text-ink",
        ghost: "bg-transparent text-ink hover:bg-cardboard/60",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-12 px-7 text-[15px]",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  motionless?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      motionless: _motionless,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size, className }));
    if (asChild) {
      return <Slot className={classes} ref={ref} {...props} />;
    }
    return <button type={type} className={classes} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
