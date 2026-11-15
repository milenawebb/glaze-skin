import type { ShellBreak } from "./shell";

/** Geometry is retained in unit-frame space; raster masks are disposable. */
export function mapShell(shape: ShellBreak, w: number, h: number): ShellBreak {
  const path = (points: ShellBreak["boundary"]) => points.map(p => ({ x: p.x * w, y: p.y * h }));
  return { boundary: path(shape.boundary), plates: shape.plates.map(path), cracks: shape.cracks.map(path), arcs: shape.arcs.map(path), removed: shape.removed };
}

/** Sample normalized height data into a fresh device-resolution map. */
export function rasterHeight(values: Float32Array, sw: number, sh: number, w: number, h: number) {
  const out = new Float32Array(w * h);
  const at = (xx: number, yy: number) => values[Math.min(sh - 1, yy) * sw + Math.min(sw - 1, xx)] ?? 0;
  for (let y = 0; y < h; y++) {
    const sy = y / Math.max(1, h - 1) * (sh - 1), y0 = Math.floor(sy), fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = x / Math.max(1, w - 1) * (sw - 1), x0 = Math.floor(sx), fx = sx - x0;
      out[y * w + x] = (at(x0,y0)*(1-fx)+at(x0+1,y0)*fx)*(1-fy)+(at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx)*fy;
    }
  }
  return out;
}