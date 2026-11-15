import { describe, expect, it } from "vitest";
import { breakGlaze, hasGlaze } from "./glaze";
describe("local glass coating", () => {
  it("breaks only the pressed area and does not break it twice", () => {
    const r = { glaze: new Float32Array(2500), dw: 50, dh: 50 };
    expect(hasGlaze(r, 40, 40)).toBe(true);
    breakGlaze(r, 40, 40, 24, 1);
    expect(hasGlaze(r, 40, 40)).toBe(false);
    expect(hasGlaze(r, 90, 90)).toBe(true);
  });
  it("fades the coating without touching dents and restores on Reset", () => {
    const r = { glaze: new Float32Array(2500), dw: 50, dh: 50, dent: new Float32Array(2500).fill(0.6) };
    breakGlaze(r, 40, 40, 24, 0.25);
    expect(r.glaze[1020]).toBeCloseTo(0.25);
    expect(r.dent[1020]).toBeCloseTo(0.6);
    r.glaze.fill(0);
    expect(hasGlaze(r, 40, 40)).toBe(true);
  });
});