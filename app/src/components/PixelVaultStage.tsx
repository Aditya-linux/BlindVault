"use client";

import { useReducedMotion } from "motion/react";
import { motion } from "@/components/motion";

/** Animated 2D pixel vault — mystery box for the landing stage. */
export function PixelVaultStage() {
  const reduce = useReducedMotion();

  return (
    <div className="pixel-stage relative mx-auto aspect-[16/10] w-full max-w-xl select-none">
      {/* Sky / warehouse depth */}
      <div className="pixel-stage__sky absolute inset-0 overflow-hidden rounded-sm">
        {!reduce &&
          Array.from({ length: 18 }).map((_, i) => (
            <motion.span
              key={i}
              className="pixel-stage__star"
              style={{
                left: `${6 + ((i * 17) % 88)}%`,
                top: `${8 + ((i * 23) % 42)}%`,
                width: i % 3 === 0 ? 3 : 2,
                height: i % 3 === 0 ? 3 : 2,
              }}
              animate={{ opacity: [0.2, 0.9, 0.2] }}
              transition={{
                duration: 2.2 + (i % 5) * 0.4,
                repeat: Infinity,
                delay: i * 0.12,
                ease: "easeInOut",
              }}
            />
          ))}
      </div>

      {/* Floating mystery cards */}
      {!reduce && (
        <>
          <FloatingCard className="left-[6%] top-[22%]" delay={0} rotate={-8} />
          <FloatingCard className="right-[8%] top-[18%]" delay={0.6} rotate={10} />
          <FloatingCard className="left-[12%] bottom-[18%]" delay={1.1} rotate={6} />
        </>
      )}

      {/* Main vault unit */}
      <motion.div
        className="absolute left-1/2 top-[52%] w-[58%] max-w-[280px] -translate-x-1/2 -translate-y-1/2"
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, -5, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <VaultSprite />
        </motion.div>

        {/* Lock bob */}
        <motion.div
          className="absolute left-1/2 top-[42%] -translate-x-1/2"
          animate={reduce ? undefined : { y: [0, 3, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <PadlockSprite />
        </motion.div>

        {/* Mystery sparkles */}
        {!reduce && (
          <>
            <Sparkle className="-left-2 top-[30%]" delay={0} />
            <Sparkle className="-right-1 top-[36%]" delay={0.5} />
            <Sparkle className="left-[20%] -top-1" delay={1} />
          </>
        )}
      </motion.div>

      {/* Ground shadow */}
      <motion.div
        className="pixel-stage__shadow absolute bottom-[10%] left-1/2 h-3 w-[48%] -translate-x-1/2 rounded-[100%]"
        animate={reduce ? undefined : { scaleX: [1, 1.06, 1], opacity: [0.35, 0.5, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Scanlines */}
      <div className="pixel-stage__scan absolute inset-0 rounded-sm" aria-hidden />
    </div>
  );
}

function VaultSprite() {
  return (
    <svg viewBox="0 0 64 56" className="h-auto w-full" shapeRendering="crispEdges">
      {/* Unit body */}
      <rect x="8" y="10" width="48" height="40" fill="#2a4036" />
      <rect x="10" y="12" width="44" height="36" fill="#3d5a4c" />
      {/* Door */}
      <rect x="16" y="16" width="32" height="28" fill="#1d1d1f" />
      <rect x="18" y="18" width="28" height="24" fill="#2f4a3c" />
      {/* Rivets */}
      <rect x="12" y="14" width="2" height="2" fill="#c9c2b4" />
      <rect x="50" y="14" width="2" height="2" fill="#c9c2b4" />
      <rect x="12" y="44" width="2" height="2" fill="#c9c2b4" />
      <rect x="50" y="44" width="2" height="2" fill="#c9c2b4" />
      {/* Chains */}
      <rect x="20" y="8" width="2" height="10" fill="#8a8780" />
      <rect x="42" y="8" width="2" height="10" fill="#8a8780" />
      <rect x="18" y="6" width="6" height="2" fill="#c9c2b4" />
      <rect x="40" y="6" width="6" height="2" fill="#c9c2b4" />
      {/* ? glyph */}
      <rect x="28" y="24" width="8" height="2" fill="#e6eee8" />
      <rect x="34" y="26" width="2" height="4" fill="#e6eee8" />
      <rect x="30" y="30" width="4" height="2" fill="#e6eee8" />
      <rect x="31" y="34" width="2" height="2" fill="#e6eee8" />
    </svg>
  );
}

function PadlockSprite() {
  return (
    <svg width="28" height="32" viewBox="0 0 14 16" shapeRendering="crispEdges">
      <rect x="4" y="1" width="6" height="2" fill="#c9c2b4" />
      <rect x="3" y="3" width="2" height="4" fill="#c9c2b4" />
      <rect x="9" y="3" width="2" height="4" fill="#c9c2b4" />
      <rect x="2" y="6" width="10" height="8" fill="#a33b2d" />
      <rect x="3" y="7" width="8" height="6" fill="#8a2f24" />
      <rect x="6" y="9" width="2" height="3" fill="#c9c2b4" />
    </svg>
  );
}

function FloatingCard({
  className,
  delay,
  rotate,
}: {
  className?: string;
  delay: number;
  rotate: number;
}) {
  return (
    <motion.div
      className={`absolute h-10 w-7 border-2 border-[#1d1d1f] bg-[#e7e2d8] shadow-[2px_2px_0_#1d1d1f] sm:h-12 sm:w-9 ${className ?? ""}`}
      style={{ rotate }}
      animate={{ y: [0, -10, 0], rotate: [rotate, rotate + 4, rotate] }}
      transition={{ duration: 4 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <div className="m-[3px] h-[40%] bg-[#2f4a3c]" />
      <div className="mx-[3px] mt-1 h-1 bg-[#1d1d1f]/25" />
      <div className="mx-[3px] mt-0.5 h-1 w-[60%] bg-[#1d1d1f]/15" />
    </motion.div>
  );
}

function Sparkle({ className, delay }: { className?: string; delay: number }) {
  return (
    <motion.span
      className={`absolute block size-2 bg-[#e6eee8] ${className ?? ""}`}
      animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.6] }}
      transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}
