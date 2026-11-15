import { describe, expect, it } from "vitest";
import { dentDepth, dentRadius, frameInsets, pressureScale } from "./touch";

describe("phone and tablet frame rules", () => {
  it("uses 22px sides and top and a 120px bottom below 480px", () => {
    expect(frameInsets(479)).toEqual({ l: 22, t: 22, r: 22, b: 120 });
    expect(frameInsets(480)).toEqual({ l: 30, t: 30, r: 30, b: 96 });
  });
  it("maps real touch and pen pressure to 0.6x through 1.6x", () => {
    expect(pressureScale({ pointerType: "touch", pressure: 0.001 })).toBeCloseTo(0.601);
    expect(pressureScale({ pointerType: "pen", pressure: 1 })).toBe(1.6);
    expect(dentDepth(0, 0.6)).toBeCloseTo(0.36);
    expect(dentDepth(8, 0.6)).toBeCloseTo(0.36);
    expect(dentDepth(0, 1.6)).toBeCloseTo(0.96);
  });
  it("keeps hold-depth behavior for synthetic pressure and mouse input", () => {
    for (const pointerType of ["touch", "pen", "mouse"]) {
      for (const pressure of [0, 0.5]) expect(pressureScale({ pointerType, pressure })).toBeNull();
    }
    expect(pressureScale({ pointerType: "mouse", pressure: 0.9 })).toBeNull();
    expect(dentDepth(0, null)).toBe(0.32);
    expect(dentDepth(2, null)).toBe(1);
  });
  it("gives fingers wider dents than a mouse or pen", () => {
    expect(dentRadius("touch")).toBe(22);
    expect(dentRadius("mouse")).toBe(16);
    expect(dentRadius("pen")).toBe(16);
  });
});