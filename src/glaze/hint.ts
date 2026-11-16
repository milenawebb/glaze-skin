/** Visit-scoped discovery only. Never writes to the frame's damage maps. */
export const HINT_KEY = "glaze-frame-hints";
/** Delay after the player becomes visible on screen. */
export const HINT_DELAY = 1500;
export const HINT_INTERVAL = 5000;
export const HINT_LIMIT = 3;
export const HINT_LABEL_MS = 5000;
/** Label returns with this many demo presses. */
export const HINT_LABEL_PRESSES = 2;
export const HINT_APPROACH_MS = 500;
export const HINT_PRESS_MS = 600;
export const HINT_HOLD_MS = 800;
export const HINT_LIFT_MS = 500;
export const HINT_RIPPLE_MS = 900;
export const HINT_DEPTH = .52;
export const HINT_DURATION = 4200;
const LIFT = HINT_APPROACH_MS + HINT_PRESS_MS + HINT_HOLD_MS;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const still = { depth: 0, crack: 0, glance: 0, blink: 0, smile: 0, finger: 0, fingerY: 0, ripple: 0 };

export function hintPose(elapsed: number, reduced = false) {
  if (reduced || elapsed < 0 || elapsed >= HINT_DURATION) return { ...still };
  const pressAt = HINT_APPROACH_MS;
  const depth = HINT_DEPTH * ease((elapsed - pressAt) / HINT_PRESS_MS) * (1 - ease((elapsed - LIFT) / 2000));
  const reaction = ease((elapsed - pressAt) / 450) * (1 - ease((elapsed - LIFT - 300) / 900));
  const crack = ease((elapsed - pressAt - 450) / 250) * (1 - ease((elapsed - LIFT - 200) / 1500));
  // Fingertip fades in above, settles down, holds, then lifts away.
  const finger = ease(elapsed / 300) * (1 - ease((elapsed - LIFT) / HINT_LIFT_MS));
  const fingerY = (1 - ease(elapsed / (pressAt + HINT_PRESS_MS))) + ease((elapsed - LIFT) / HINT_LIFT_MS);
  const rippleT = (elapsed - LIFT) / HINT_RIPPLE_MS;
  const ripple = rippleT > 0 && rippleT < 1 ? rippleT : 0;
  const blinkAt = pressAt + 650;
  return { depth, crack, glance: reaction, blink: ease((elapsed - blinkAt) / 100) * (1 - ease((elapsed - blinkAt - 150) / 130)), smile: reaction, finger, fingerY, ripple };
}

export function createFrameHint(now: number, storage?: Storage) {
  let stopped = false, count = 0;
  try { const saved = JSON.parse(storage?.getItem(HINT_KEY) || "{}"); stopped = saved.stopped === true; count = Number(saved.count) || 0; } catch { /* Optional storage. */ }
  let next = now + HINT_DELAY, start = -Infinity, labelStart = -Infinity;
  const save = () => { try { storage?.setItem(HINT_KEY, JSON.stringify({ stopped, count })); } catch { /* Optional storage. */ } };
  return {
    stop() { stopped = true; start = labelStart = -Infinity; save(); },
    /** `blocked` covers fullscreen, control use and the player being off screen. */
    tick(time: number, blocked: boolean, reduced: boolean) {
      if (blocked) { start = labelStart = -Infinity; next = time + HINT_DELAY; }
      if (!stopped && !blocked && count < HINT_LIMIT && time >= next) {
        start = time; count++; next = time + HINT_INTERVAL;
        if (count <= HINT_LABEL_PRESSES) labelStart = time;
        save();
      }
      const elapsed = time - start;
      return {
        ...hintPose(elapsed, reduced),
        active: !stopped && !blocked && !reduced && elapsed < HINT_DURATION,
        label: !stopped && !blocked && time - labelStart < HINT_LABEL_MS,
        count,
      };
    },
  };
}
