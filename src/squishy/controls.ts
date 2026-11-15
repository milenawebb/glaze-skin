/** Tap order shared by the speed control and its behavior tests. */
const SPEEDS = [1, 1.5, 2, 0.5] as const;
export const POPUP_SPEEDS = [0.5, 1, 1.5, 2] as const;
export const VOLUME_CLOSE_MS = 300;
export const CONTROLS_IDLE_MS = 2000;
export function controlsVisible(paused: boolean, active: boolean, popup: boolean, keyboardFocus: boolean) {
  return paused || active || popup || keyboardFocus;
}

export function nextPlaybackRate(current: number): number {
  const index = SPEEDS.findIndex((speed) => speed === current);
  return SPEEDS[(index + 1) % SPEEDS.length] ?? 1;
}