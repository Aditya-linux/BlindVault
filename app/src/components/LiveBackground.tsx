"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

/**
 * Halftone navy/cyan atmosphere.
 * Landing: full-bleed photo. Inner pages: same feel via tinted crop + soft scrim
 * so body copy never sits raw on the busy dots.
 */
export function LiveBackground() {
  const path = usePathname();
  const reduce = useReducedMotion();
  const isHome = path === "/";

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-[#050a14] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/media/halftone-bg.jpg')",
          backgroundPosition: isHome ? "center center" : "70% 40%",
          transform: reduce ? undefined : "scale(1.02)",
        }}
      />

      {/* Keep the photo visible on home; deepen elsewhere for long-form readability */}
      <div
        className={
          isHome
            ? "absolute inset-0 bg-[linear-gradient(160deg,rgba(5,10,20,0.18)_0%,rgba(5,12,28,0.35)_42%,rgba(4,8,18,0.72)_100%)]"
            : "absolute inset-0 bg-[linear-gradient(160deg,rgba(5,10,20,0.55)_0%,rgba(5,12,28,0.72)_45%,rgba(4,8,18,0.88)_100%)]"
        }
      />

      {!reduce && (
        <motion.div
          className="absolute -left-1/4 top-[-10%] h-[55vmax] w-[55vmax] rounded-full bg-[#2b8cff]/12 blur-3xl"
          animate={{ opacity: [0.2, 0.35, 0.2], scale: [1, 1.05, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
