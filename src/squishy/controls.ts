/** Tap order shared by the speed control and its behavior tests. */
const SPEEDS = [1, 1.5, 2, 0.5] as const;

export function nextPlaybackRate(current: number): number {
  const index = SPEEDS.findIndex((speed) => speed === current);
  return SPEEDS[(index + 1) % SPEEDS.length] ?? 1;
}