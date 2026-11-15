import { FRAME } from "./frame-gl";

export function frameInsets(width: number) {
  const small = width < 480;
  return { l: small ? 12 : FRAME.side, t: small ? 12 : FRAME.top, r: small ? 12 : FRAME.side, b: small ? 110 : FRAME.bottom };
}

export function pressureScale(event: Pick<PointerEvent, "pointerType" | "pressure">): number | null {
  if ((event.pointerType !== "touch" && event.pointerType !== "pen") || event.pressure === 0 || event.pressure === 0.5 || !Number.isFinite(event.pressure)) return null;
  return 0.6 + Math.max(0, Math.min(1, event.pressure));
}

export function dentRadius(pointerType: string) {
  return pointerType === "touch" ? 22 : 16;
}

export function dentDepth(held: number, pressure: number | null) {
  return pressure === null ? Math.min(1, 0.32 + held * 0.45) : 0.6 * pressure;
}

export function faceExpression(presses: number, sinceRelease: number, reducedMotion: boolean) {
  if (presses > 0) return 1;
  return reducedMotion ? 0 : Math.pow(Math.max(0, 1 - sinceRelease / 1000), 2);
}
/** Phones and tablets (coarse pointers) draw at most 1.5x; desktop at most 2x. */
export function phoneRendering(coarse: boolean, width: number, touchPoints = 0) { return coarse || touchPoints > 0 || width < 768; }
export function coarsePointer() {
  return typeof window !== "undefined" && phoneRendering(typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches, window.innerWidth, navigator.maxTouchPoints || 0);
}
export function canvasDpr(dpr: number, coarse: boolean) { return Math.min(dpr || 1, coarse ? 1.5 : 2); }
export function flyingLimit(coarse: boolean) { return coarse ? 20 : 40; }
