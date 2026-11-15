import { FRAME } from "./frame-gl";

export function frameInsets(width: number) {
  const small = width < 480;
  return { l: small ? 14 : FRAME.side, t: small ? 14 : FRAME.top, r: small ? 14 : FRAME.side, b: small ? 110 : FRAME.bottom };
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