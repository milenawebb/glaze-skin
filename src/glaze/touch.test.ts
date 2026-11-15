import { describe, expect, it } from "vitest";
import { dentDepth, dentRadius, faceExpression, frameInsets, pressureScale } from "./touch";

describe("phone and tablet frame rules", () => {
  it("keeps eyes shut for any finger and relaxes fully after one second", () => {
    expect(faceExpression(1, 1500, false)).toBe(1);
    expect(faceExpression(3, 1500, false)).toBe(1);
    expect(faceExpression(0, 0, false)).toBe(1);
    expect(faceExpression(0, 500, false)).toBe(0.25);
    expect(faceExpression(0, 1000, false)).toBe(0);
    expect(faceExpression(0, 0, true)).toBe(0);
  });
  it("uses 12px sides and top and a 110px bottom below 480px", () => {
    expect(frameInsets(479)).toEqual({ l: 12, t: 12, r: 12, b: 110 });
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
describe("phone speed caps", () => {
  it("uses phone limits below 768px or on any touch-capable device", async () => {
    const { phoneRendering,canvasDpr,flyingLimit }=await import("./touch");
    expect(canvasDpr(3,phoneRendering(false,767))).toBe(1.5);
    expect(flyingLimit(phoneRendering(false,1024,5))).toBe(20);
    expect(phoneRendering(false,768,0)).toBe(false);
  });
  it("caps canvas resolution at 1.5 on touch devices and 2 on desktop", async () => {
    const { canvasDpr } = await import("./touch");
    expect(canvasDpr(3, true)).toBe(1.5);
    expect(canvasDpr(3, false)).toBe(2);
    expect(canvasDpr(1, true)).toBe(1);
  });
  it("allows about 20 flying pieces on phones and 40 on desktop", async () => {
    const { flyingLimit } = await import("./touch");
    expect(flyingLimit(true)).toBe(20);
    expect(flyingLimit(false)).toBe(40);
  });
});
