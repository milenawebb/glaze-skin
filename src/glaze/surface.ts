/** Shared numeric limits used by the shader and its regression tests. */
export const FOAM_DARKENING_LIMIT = .15;
export const SURFACE_SMOOTHING = 12;

export function foamLightRatio(value: number) {
  return Math.max(1 - FOAM_DARKENING_LIMIT, Math.min(1.08, value));
}

/** Fully smooth interior distance, without max/length branch seams at the corner axes. */
export function smoothCornerDistance(x: number, y: number, radius: number) {
  const k = SURFACE_SMOOTHING;
  const positive = (a: number) => (a + Math.sqrt(a * a + k * k)) * .5;
  const maximum = (x + y + Math.sqrt((x - y) ** 2 + k * k)) * .5;
  const negative = (maximum - Math.sqrt(maximum * maximum + k * k)) * .5;
  return Math.hypot(positive(x), positive(y)) + negative - radius;
}