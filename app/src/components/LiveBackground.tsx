"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";

/** Atmospheric site video — stronger on home, quieter elsewhere. */
export function LiveBackground() {
  const path = usePathname();
  const isHome = path === "/";

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <motion.video
        key={isHome ? "hero" : "soft"}
        className={
          isHome
            ? "absolute inset-0 h-full w-full scale-105 object-cover"
            : "absolute inset-0 h-full w-full scale-105 object-cover opacity-[0.32] saturate-[0.6] contrast-[0.95]"
        }
        style={isHome ? undefined : { filter: "blur(1.5px)" }}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHome ? 1 : 0.32 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <source src="/media/hero-bg.mp4" type="video/mp4" />
      </motion.video>

      {isHome ? (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,14,12,0.55)_0%,rgba(12,14,12,0.28)_42%,rgba(18,20,18,0.72)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_35%,transparent_0%,rgba(10,12,10,0.45)_100%)]" />
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
