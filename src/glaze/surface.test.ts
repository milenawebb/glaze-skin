import { expect, it } from "vitest";
import { foamLightRatio, smoothCornerDistance } from "./surface";

it("never darkens exposed foam more than 18 percent, even at deep overlapping swipe ends", () => {
  for (const light of [-10, -.5, 0, .4, .8, 1]) expect(foamLightRatio(light)).toBeGreaterThanOrEqual(.82);
  expect(foamLightRatio(.2)).toBeCloseTo(.82);
  expect(foamLightRatio(.97)).toBe(.97);
});

it("has continuous corner slopes across both axes and the diagonal", () => {
  const f = smoothCornerDistance;
  for (const [x, y] of [[0, 20], [20, 0], [-20, -20], [8, 8]] as const) {
    const e = .001;
    const left = (f(x, y, 16) - f(x - e, y, 16)) / e;
    const right = (f(x + e, y, 16) - f(x, y, 16)) / e;
    expect(Math.abs(left - right)).toBeLessThan(.001);
    expect(f(x, y, 16)).toBeCloseTo(f(y, x, 16), 8);
  }
});