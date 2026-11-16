export function recoverySettings(random = Math.random) {
  return { duration: 2000 + random() * 2000, fraction: .5 + random() * .4 };
}
export function recoveryFactor(elapsed: number, duration: number, fraction: number) {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  return 1 - fraction * (1 - Math.pow(1 - t, 3));
}
export function immediateDepth(normalHoldDepth: number) { return Math.max(.5, normalHoldDepth * .5); }
/** Recovery-only drawing is capped at 20Hz, with an exact final bake. */
export const RECOVERY_UPDATE_MS = 50;
export function recoveryDelay(now: number, start: number, duration: number) {
  return Math.max(0, Math.min(RECOVERY_UPDATE_MS, start + duration - now));
}