"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";

/** Soft atmospheric video — stronger game-grid wash on home. */
export function LiveBackground() {
  const path = usePathname();
  const isHome = path === "/";

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <motion.video
        className={
          isHome
            ? "absolute inset-0 h-full w-full scale-105 object-cover opacity-[0.22] saturate-[0.45] contrast-[1.05]"
            : "absolute inset-0 h-full w-full scale-105 object-cover opacity-[0.35] saturate-[0.55] contrast-[0.95]"
        }
        style={{ filter: isHome ? "blur(3px)" : "blur(2px)" }}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHome ? 0.22 : 0.35 }}
        transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <source src="/media/hero-bg.mp4" type="video/mp4" />
      </motion.video>

      {isHome ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_40%,rgba(46,74,60,0.18)_0%,rgba(247,245,241,0.92)_62%,#f3f1ec_100%)]" />
          <div className="landing-pixel-grid absolute inset-0 opacity-[0.14]" />
          <motion.div
            className="absolute left-1/2 top-[28%] h-[36vmax] w-[48vmax] -translate-x-1/2 rounded-full bg-[#dfe8e2]/40 blur-3xl"
            animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.05, 1] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_-10%,rgba(250,249,247,0.2)_0%,rgba(243,241,236,0.88)_48%,#f3f1ec_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(250,249,247,0.55)_0%,transparent_28%,rgba(243,241,236,0.75)_100%)]" />
          <motion.div
            className="absolute left-1/2 top-[18%] h-[42vmax] w-[58vmax] -translate-x-1/2 rounded-full bg-[#dfe8e2]/35 blur-3xl"
            animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.04, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}
    </div>
  );
}
