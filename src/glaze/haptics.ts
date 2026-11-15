import { getSoundsEnabled } from "./sounds";

/** Haptics share the sound switch and silently skip unsupported devices. */
export function vibrate(pattern: number | number[]) {
  try {
    if (getSoundsEnabled() && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // Some browsers expose the API but refuse vibration.
  }
}

export const vibratePress = () => vibrate(10);
export const vibrateCrack = () => vibrate(25);
export const vibrateBreak = () => vibrate([15, 30, 15]);