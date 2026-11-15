import { insideShellPolygon, type ShellPoint } from "./shell";
/** Separate coating map: breaking glaze never changes the permanent dent map. */
export interface GlazeMap { glaze: Float32Array; dw: number; dh: number }
export function hasGlaze(r: GlazeMap, x: number, y: number) {
  const i = Math.min(r.dh - 1, Math.max(0, Math.floor(y / 2))) * r.dw + Math.min(r.dw - 1, Math.max(0, Math.floor(x / 2)));
  return (r.glaze[i] ?? 0) < 0.5;
}
export function breakGlaze(r: GlazeMap, x: number, y: number, radius: number, progress: number, boundary?: ShellPoint[]) {
  const cx = x / 2, cy = y / 2, rad = radius / 2;
  for (let py = Math.max(0, Math.floor(cy - rad)); py <= Math.min(r.dh - 1, Math.ceil(cy + rad)); py++) {
    for (let px = Math.max(0, Math.floor(cx - rad)); px <= Math.min(r.dw - 1, Math.ceil(cx + rad)); px++) {
      const distance = Math.hypot(px - cx, py - cy) / rad;
      const edge = boundary ? (insideShellPolygon(px * 2, py * 2, boundary) ? 1 : 0) : Math.max(0, Math.min(1, (1 - distance) / 0.18));
      const i = py * r.dw + px;
      r.glaze[i] = Math.max(r.glaze[i] ?? 0, edge * progress);
    }
  }
}