/** Format seconds as mm:ss or hh:mm:ss for countdowns. */
export function formatClock(totalSecs: number): string {
  const s = Math.max(0, Math.floor(totalSecs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatMinutesLabel(secs: number): string {
  const m = Math.max(1, Math.round(secs / 60));
  return `${m} min`;
}
