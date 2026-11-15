import { describe, expect, it } from "vitest";
import { createShellBreak, SHELL_BREAK_MS, framePressStage } from "./shell";
import { breakGlaze, hasGlaze } from "./glaze";

describe("wax shell", () => {
  it("first press cracks without exposing foam", () => { expect(framePressStage(true,false)).toBe("crack"); });
  it("second press shatters an already cracked shell", () => { expect(framePressStage(true,true)).toBe("shatter"); });
  it("exposed foam only squishes", () => { expect(framePressStage(false,true)).toBe("foam"); });
  it("makes three to six Voronoi plates", () => {
    expect(createShellBreak(50, 50, 20, () => 0).plates).toHaveLength(3);
    expect(createShellBreak(50, 50, 20, () => .999).plates).toHaveLength(6);
  });
  it("peels over 0.6 seconds", () => { expect(SHELL_BREAK_MS).toBe(600); });
  it("exposes foam only within the broken boundary without modifying dents", () => {
    const r = { dw: 50, dh: 50, glaze: new Float32Array(2500), dent: new Float32Array(2500).fill(.6) };
    const shape = createShellBreak(50, 50, 20, () => .5);
    breakGlaze(r, 50, 50, 20, 1, shape.boundary);
    expect(hasGlaze(r, 50, 50)).toBe(false);
    expect(hasGlaze(r, 80, 50)).toBe(true);
    expect(r.dent[1275]).toBeCloseTo(.6);
    r.glaze.fill(0);
    expect(hasGlaze(r, 50, 50)).toBe(true);
  });
});