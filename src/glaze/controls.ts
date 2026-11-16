/** Tap order shared by the speed control and its behavior tests. */
const SPEEDS = [1, 1.5, 2, 0.5] as const;
export const POPUP_SPEEDS = [0.5, 1, 1.5, 2] as const;
export const VOLUME_CLOSE_MS = 300;
export const CONTROLS_IDLE_MS = 2000;
/** Capture before the player hotkey listener, leaving native range keys and Escape intact. */
export function isolateVolumeKey(event: { key: string; stopPropagation: () => void }) {
  if (event.key !== "Escape") event.stopPropagation();
}
export function controlsVisible(paused: boolean, active: boolean, popup: boolean, keyboardFocus: boolean) {
  return paused || active || popup || keyboardFocus;
}

/** Only a phone touch/pen tap on the video toggles control visibility. */
export function videoTapActivity(compact: boolean, pointerType: string, paused: boolean, visible: boolean): boolean | undefined {
  if (!compact || (pointerType !== "touch" && pointerType !== "pen")) return undefined;
  return paused || !visible;
}

export function nextPlaybackRate(current: number): number {
  const index = SPEEDS.findIndex((speed) => speed === current);
  return SPEEDS[(index + 1) % SPEEDS.length] ?? 1;
}