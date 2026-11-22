"use client";

import Link from "next/link";
import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Transition,
} from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export { motion };
export const spring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 28,
};
/** Strong ease-out (Emil) — enter / exit under ~300ms */
export const soft: Transition = {
  duration: 0.28,
  ease: [0.23, 1, 0.32, 1],
};

export function PageEnter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={soft}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  delay = 0.04,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: soft },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionNavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="contents"
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={spring}
    >
      <Link href={href} className={className}>
        {children}
      </Link>
    </motion.div>
  );
}

export function MotionButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      className={cn(className)}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={spring}
      {...(props as HTMLMotionProps<"button">)}
    >
      {children}
    </motion.button>
  );
}
