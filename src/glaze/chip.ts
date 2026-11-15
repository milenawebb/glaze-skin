import type { ShellPoint } from "./shell";

/** Tap reach and break-off size; phones get larger targets. */
export function snapRadius(coarse: boolean) { return coarse ? 24 : 16; }
/** Half the break-off size: about 30 to 50px across on phones. */
export function chipRadius(coarse: boolean) { return coarse ? 20 : 15; }
/** Crack pieces larger than this are split before removal. */
export function maxPiece(coarse: boolean) { return coarse ? 48 : 36; }
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

/** Clip any polygon to a convex counter-clockwise polygon (Sutherland-Hodgman). */
export function clipToConvex(poly: ShellPoint[], clip: ShellPoint[]): ShellPoint[] {
  let out = poly;
  for (let k = 0; k < clip.length && out.length; k++) {
    const e0 = clip[k]!, e1 = clip[(k + 1) % clip.length]!;
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
/** An angular, never round, convex shard of 4 to 6 corners around the finger: the short new cracks that split a big piece. */
export function angularCell(x: number, y: number, radius: number, random = Math.random): ShellPoint[] {
  const n = 4 + Math.floor(random() * 3), offset = random() * Math.PI * 2;
  const angles = Array.from({ length: n }, (_, i) => offset + (i + (random() - .5) * .5) / n * Math.PI * 2);
  return angles.map(a => { const r = radius * (.8 + random() * .45); return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r }; });
}
/** Kept for tests: clip to a many-sided polygon. */
export function clipToCircle(poly: ShellPoint[], cx: number, cy: number, radius: number, sides = 20): ShellPoint[] {
  return clipToConvex(poly, Array.from({ length: sides }, (_, k) => ({ x: cx + Math.cos(k / sides * Math.PI * 2) * radius, y: cy + Math.sin(k / sides * Math.PI * 2) * radius })));
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

function edgeDistance(poly: ShellPoint[], x: number, y: number) {
  return Math.min(...poly.map((a, i) => { const b = poly[(i + 1) % poly.length] ?? a, dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(a.x + t * dx - x, a.y + t * dy - y); }));
}
/**
 * Pieces to remove for a tap at (x,y), following the cracks: whole crack pieces under and right next to the finger.
 * A piece bigger than `max` is split by a small angular shard around the finger and only that shard goes.
 * Plates without glaze under them are skipped; loose crumbs go with the break.
 */
export function chipPlates(plates: ShellPoint[][], removed: Set<number>, x: number, y: number, radius: number, intact: (x: number, y: number) => boolean, inside: (x: number, y: number, poly: ShellPoint[]) => boolean, max = radius * 2.4, random = Math.random): ShellPoint[][] {
  const out: ShellPoint[][] = [];
  const near = plates.map((poly, index) => ({ poly, index, d: inside(x, y, poly) ? 0 : edgeDistance(poly, x, y) }))
    .filter(p => !removed.has(p.index) && p.d <= radius * .6).sort((a, b) => a.d - b.d);
  let budget = 0;
  for (const { poly, index, d } of near) {
    if (budget >= 3) break;
    let piece = poly, whole = true;
    if (extent(poly) > max) { if (d > 0 && out.length) continue; piece = clipToConvex(poly, angularCell(x, y, radius, random)); whole = false; if (!piece.length) continue; }
    if (glazedFraction(piece, intact, inside) < .15) { if (whole) removed.add(index); continue; }
    if (whole) removed.add(index);
    out.push(piece); budget++;
  }
  if (out.length) plates.forEach((poly, index) => { if (!removed.has(index) && extent(poly) < CRUMB_SIZE) { removed.add(index); out.push(poly); } });
  return out;
}
