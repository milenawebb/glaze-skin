import { expect, it } from "vitest";
import { immediateDepth, recoveryFactor, recoverySettings } from "./recovery";
it("starts at at least half normal hold depth", () => { expect(immediateDepth(1)).toBeGreaterThanOrEqual(.5); });
it("recovers 50 to 90 percent over two to four seconds", () => {
  expect(recoverySettings(() => 0)).toEqual({ duration: 2000, fraction: .5 });
  expect(recoverySettings(() => 1)).toEqual({ duration: 4000, fraction: .9 });
});
it("eases out without fully erasing or bouncing", () => {
  expect(recoveryFactor(0, 3000, .7)).toBe(1);
  expect(recoveryFactor(3000, 3000, .7)).toBeCloseTo(.3);
  expect(recoveryFactor(1000, 3000, .7) - recoveryFactor(2000, 3000, .7)).toBeGreaterThan(recoveryFactor(2000, 3000, .7) - recoveryFactor(3000, 3000, .7));
});