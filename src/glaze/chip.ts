import type { ShellPoint } from "./shell";

/** Tap reach and break-off size; phones get larger targets. */
export function snapRadius(coarse: boolean) { return coarse ? 24 : 16; }
export function chipRadius(coarse: boolean) { return coarse ? 22 : 16; }
export const ISLAND_SIZE = 40;
export const CRUMB_SIZE = 12;

/** Nearest point within reach where `test` holds, or null. Rings outward so the closest glaze wins. */
export function snapToGlaze(x: number, y: number, reach: number, test: (x: number, y: number) => boolean): ShellPoint | null {
  if (test(x, y)) return { x, y };
  for (let r = 4; r <= reach; r += 4) {
    const n = Math.max(8, Math.round(r * 1.2));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (test(px, py)) return { x: px, y: py }; }
  }
  return null;
}

export function polygonArea(poly: ShellPoint[]) {
  let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2;
}
export function extent(poly: ShellPoint[]) {
  if (!poly.length) return 0;
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/** Clip any polygon to a disc (convex clipper, Sutherland-Hodgman) so break-offs stay finger-sized. */
export function clipToCircle(poly: ShellPoint[], cx: number, cy: number, radius: number, sides = 20): ShellPoint[] {
  let out = poly;
  for (let k = 0; k < sides && out.length; k++) {
    const a0 = k / sides * Math.PI * 2, a1 = (k + 1) / sides * Math.PI * 2;
    const e0 = { x: cx + Math.cos(a0) * radius, y: cy + Math.sin(a0) * radius }, e1 = { x: cx + Math.cos(a1) * radius, y: cy + Math.sin(a1) * radius };
    const inside = (p: ShellPoint) => (e1.x - e0.x) * (p.y - e0.y) - (e1.y - e0.y) * (p.x - e0.x) >= 0;
    const cross = (p: ShellPoint, q: ShellPoint) => { const dx = q.x - p.x, dy = q.y - p.y, ex = e1.x - e0.x, ey = e1.y - e0.y, den = dx * ey - dy * ex; const t = den ? ((e0.x - p.x) * ey - (e0.y - p.y) * ex) / den : 0; return { x: p.x + dx * t, y: p.y + dy * t }; };
    const input = out; out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]!, prev = input[(i + input.length - 1) % input.length]!;
      if (inside(cur)) { if (!inside(prev)) out.push(cross(prev, cur)); out.push(cur); } else if (inside(prev)) out.push(cross(prev, cur));
    }
  }
  return out.length >= 3 ? out : [];
}

/** Fraction of sample points inside the polygon that still have glaze. */
export function glazedFraction(poly: ShellPoint[], intact: (x: number, y: number) => boolean, inside: (x: number, y: number, poly: ShellPoint[]) => boolean) {
  if (poly.length < 3) return 0;
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const step = Math.max(2, Math.max(x1 - x0, y1 - y0) / 8);
  let total = 0, glazed = 0;
  for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) if (inside(x, y, poly)) { total++; if (intact(x, y)) glazed++; }
  return total ? glazed / total : 0;
}

/**
 * Pieces to remove for a tap at (x,y): whole plates when they are mostly under the finger or tiny,
 * otherwise only the part inside the finger disc. Plates without glaze under them are skipped.
 */
export function chipPlates(plates: ShellPoint[][], removed: Set<number>, x: number, y: number, radius: number, intact: (x: number, y: number) => boolean, inside: (x: number, y: number, poly: ShellPoint[]) => boolean): ShellPoint[][] {
  const out: ShellPoint[][] = [];
  plates.forEach((poly, index) => {
    if (removed.has(index)) return;
    const small = extent(poly) < ISLAND_SIZE;
    const clipped = clipToCircle(poly, x, y, small ? radius * 1.6 : radius);
    if (!clipped.length) return;
    const whole = small || polygonArea(clipped) >= polygonArea(poly) * .8;
    const piece = whole ? poly : clipped;
    if (glazedFraction(piece, intact, inside) < .15) { if (whole) removed.add(index); return; }
    if (whole) removed.add(index);
    out.push(piece);
  });
  if (out.length) plates.forEach((poly, index) => { if (!removed.has(index) && extent(poly) < CRUMB_SIZE) { removed.add(index); out.push(poly); } });
  return out;
}
