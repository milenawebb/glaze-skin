/** Visit-scoped discovery only. Never writes to the frame's damage maps. */
export const HINT_KEY = "glaze-frame-hints";
export const HINT_DELAY = 2000;
export const HINT_INTERVAL = 6000;
export const HINT_LIMIT = 3;
export const HINT_LABEL_MS = 4000;
export const HINT_PRESS_MS = 600;
export const HINT_DURATION = 3000;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

export function hintPose(elapsed: number, reduced = false) {
  if (reduced || elapsed < 0 || elapsed >= HINT_DURATION) return { depth: 0, crack: 0, glance: 0, blink: 0, smile: 0 };
  const depth = .26 * ease(elapsed / HINT_PRESS_MS) * (1 - ease((elapsed - 800) / 2200));
  const reaction = ease(elapsed / 450) * (1 - ease((elapsed - 1100) / 900));
  return { depth, crack: ease((elapsed - 500) / 150) * (1 - ease((elapsed - 1100) / 1300)), glance: reaction, blink: ease((elapsed - 650) / 100) * (1 - ease((elapsed - 800) / 130)), smile: reaction };
}

export function createFrameHint(now: number, storage?: Storage) {
  let stopped = false, count = 0, labelShown = false;
  try { const saved = JSON.parse(storage?.getItem(HINT_KEY) || "{}"); stopped = saved.stopped === true; count = Number(saved.count) || 0; labelShown = saved.labelShown === true; } catch { /* Optional storage. */ }
  let next = now + HINT_DELAY, start = -Infinity, labelStart = -Infinity;
  const save = () => { try { storage?.setItem(HINT_KEY, JSON.stringify({ stopped, count, labelShown })); } catch { /* Optional storage. */ } };
  return {
    stop() { stopped = true; start = labelStart = -Infinity; save(); },
    tick(time: number, blocked: boolean, reduced: boolean) {
      if (blocked) { start = labelStart = -Infinity; next = time + HINT_DELAY; }
      if (!stopped && !blocked && count < HINT_LIMIT && time >= next) {
        start = time; count++; next = time + HINT_INTERVAL;
        if (!labelShown) { labelShown = true; labelStart = time; }
        save();
      }
      const elapsed = time - start;
      return {
        ...hintPose(elapsed, reduced),
        active: !stopped && !blocked && !reduced && elapsed < HINT_DURATION,
        label: !stopped && !blocked && time - labelStart < HINT_LABEL_MS,
        // Slightly varied positions, always to the left of the face.
        x: [.30, .27, .33][Math.max(0, count - 1)] ?? .30,
        count,
      };
    },
  };
}