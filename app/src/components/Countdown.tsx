"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

export function Countdown({ deadlineTs }: { deadlineTs: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, deadlineTs - now);
  const m = Math.floor(left / 60);
  const s = left % 60;
  const label = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const urgent = left > 0 && left < 60;
  const expired = deadlineTs > 0 && left === 0;

  return (
    <div
      className="text-right"
      aria-live="polite"
      aria-label={`Time left ${label}`}
    >
      <motion.p
        key={label}
        className={`font-display text-[2.75rem] leading-none tracking-[-0.04em] tabular-nums sm:text-5xl ${
          urgent || expired ? "text-stamp-red" : "text-ink"
        }`}
        initial={{ opacity: 0.35, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {deadlineTs > 0 ? label : "—"}
      </motion.p>
      <p className="mt-2 text-[12px] font-medium text-steel-deep">
        {expired ? "Closed" : "Remaining"}
      </p>
    </div>
  );
}
