import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "./crust";
import { vibratePress } from "./haptics";
import { attachPressSounds } from "./sounds";

const RISE_MS = 1500;

/**
 * Makes an element press in like a squishy: a dent at the press point and a
 * squash that deepens while held (up to 1.5x), then a slow, bounce-free rise.
 * Writes --sq-s (0..1.5), --sq-px, --sq-py on the element; CSS on
 * `.sq-squish-body` turns them into the shape and the dent.
 */
export function attachSquish(el: HTMLElement): () => void {
  const removeSounds = attachPressSounds(el);
  let s = 0, pressing = false, t0 = 0, s0 = 0, rel0 = 0, relFrom = 0, raf = 0;
  let keyTimer: number | undefined;

  const tick = (now: number) => {
    raf = 0;
    if (pressing) {
      const t = (now - t0) / 1000;
      const target = Math.min(1.5, 1 + 0.25 * t);
      s = s0 + (target - s0) * (1 - Math.exp(-t / 0.18));
    } else {
      const t = Math.min(1, (now - rel0) / RISE_MS);
      s = relFrom * Math.pow(1 - t, 3);
      if (t >= 1) s = 0;
    }
    el.style.setProperty("--sq-s", s.toFixed(4));
    if (pressing || s > 0) raf = requestAnimationFrame(tick);
  };
  const run = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const start = (px: number, py: number) => {
    vibratePress();
    if (prefersReducedMotion()) {
      el.setAttribute("data-squish-pressed", "");
      return;
    }
    el.style.setProperty("--sq-px", `${px}%`);
    el.style.setProperty("--sq-py", `${py}%`);
    pressing = true;
    t0 = performance.now();
    s0 = s;
    run();
  };
  const end = () => {
    el.removeAttribute("data-squish-pressed");
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    if (!pressing) return;
    pressing = false;
    rel0 = performance.now();
    relFrom = s;
    run();
  };
  const down = (e: PointerEvent) => {
    if (e.button > 0) return;
    const r = el.getBoundingClientRect();
    start(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const key = (e: KeyboardEvent) => {
    if (e.repeat || e.target !== el || (e.key !== " " && e.key !== "Enter")) return;
    start(50, 50);
    window.clearTimeout(keyTimer);
    keyTimer = window.setTimeout(end, 140);
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("keydown", key);
  return () => {
    removeSounds();
    cancelAnimationFrame(raf);
    window.clearTimeout(keyTimer);
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("keydown", key);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
  };
}

/** Attach squish to every `.sq-squish` element inside a container. */
export function useSquishAll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>(".sq-squish") ?? []);
    const offs = els.map(attachSquish);
    return () => offs.forEach((off) => off());
  }, [ref]);
}

/** Attach squish to one element. */
export function useSquish(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    return ref.current ? attachSquish(ref.current) : undefined;
  }, [ref]);
}
