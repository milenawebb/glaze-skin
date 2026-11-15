/** Activate on release without relying on iOS generating a compatibility click. */
export function attachFrameAction(el: HTMLButtonElement, action: () => void) {
  let press: { id: number; x: number; y: number } | undefined;
  let lastRelease = -Infinity;
  const down = (e: PointerEvent) => {
    e.stopPropagation();
    if (e.button > 0) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const up = (e: PointerEvent) => {
    e.stopPropagation();
    const start = press; press = undefined;
    if (!start || start.id !== e.pointerId || Math.hypot(e.clientX-start.x,e.clientY-start.y)>12) return;
    lastRelease = performance.now();
    action();
  };
  const cancel = () => { press = undefined; };
  const click = (e: MouseEvent) => {
    e.stopPropagation();
    if (e.detail > 0 && performance.now()-lastRelease < 700) return;
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