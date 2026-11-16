/** One tap, one action: pointer presses act only on pointerup; click is kept for the keyboard only (detail 0). */
export function attachFrameAction(el: HTMLButtonElement, action: () => void, blocked: () => boolean = () => false) {
  let press: { id: number; x: number; y: number } | undefined;
  const down = (e: PointerEvent) => {
    e.stopPropagation();
    if (e.button > 0) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const up = (e: PointerEvent) => {
    e.stopPropagation();
    const start = press; press = undefined;
    if (!start || start.id !== e.pointerId || Math.hypot(e.clientX-start.x,e.clientY-start.y)>12) return;
    if (blocked()) return;
    action();
  };
  const cancel = () => { press = undefined; };
  const click = (e: MouseEvent) => {
    e.stopPropagation();
    // Pointer-made clicks (including ghost clicks landing on a newly shown button) never act.
    if (e.detail > 0 || blocked()) return;
    action();
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("click", click);
  return () => {
    el.removeEventListener("pointerdown", down); el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", cancel); el.removeEventListener("pointerleave", cancel);
    el.removeEventListener("click", click);
  };
}

/** Taps on the flavor dots are ignored this long after the row opens. */
export const CHOICE_GUARD_MS = 350;
