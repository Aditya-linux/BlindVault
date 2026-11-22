"use client";

import { useEffect, useState } from "react";

/**
 * Wall-clock ms, ticking on an aligned cadence so countdowns don't stutter
 * or jump when parents re-render from React Query.
 */
export function useNowMs(intervalMs = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    let intervalId = 0;

    const tick = () => {
      if (!cancelled) setNow(Date.now());
    };

    // Align first tick to the next interval boundary for smooth second flips.
    const delay = intervalMs - (Date.now() % intervalMs);
    timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, intervalMs);
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [intervalMs]);

  return now;
}

export function useNowSecs(intervalMs = 200): number {
  return Math.floor(useNowMs(intervalMs) / 1000);
}
