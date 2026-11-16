import { expect, it } from "vitest";
import { createFrameHint, hintPose, HINT_KEY } from "./hint";

it("waits 1.5 seconds before the first hint", () => {
  const hint = createFrameHint(0);
  expect(hint.tick(1499, false, false).count).toBe(0);
  expect(hint.tick(1500, false, false)).toMatchObject({ active: true, label: true, count: 1 });
});
it("does not start while off screen, then waits 1.5 seconds once visible", () => {
  const hint = createFrameHint(0);
  expect(hint.tick(5000, true, false).count).toBe(0);
  expect(hint.tick(6499, false, false).count).toBe(0);
  expect(hint.tick(6500, false, false).count).toBe(1);
});
it("repeats five seconds apart at most three times", () => {
  const hint = createFrameHint(0);
  hint.tick(1500, false, false);
  expect(hint.tick(6499, false, false).count).toBe(1);
  expect(hint.tick(6500, false, false).count).toBe(2);
  expect(hint.tick(11500, false, false).count).toBe(3);
  expect(hint.tick(20000, false, false)).toMatchObject({ count: 3, active: false });
});
it("shows the label for five seconds with the first two presses only", () => {
  const hint = createFrameHint(0);
  hint.tick(1500, false, false);
  expect(hint.tick(6499, false, false).label).toBe(true);
  expect(hint.tick(6500, false, false).label).toBe(true);
  expect(hint.tick(11499, false, false).label).toBe(true);
  expect(hint.tick(11500, false, false).label).toBe(false);
});
it("presses twice as deep, holds 0.8 seconds, then restores completely", () => {
  expect(hintPose(1100).depth).toBeCloseTo(.52);
  expect(hintPose(1900).depth).toBeCloseTo(.52);
  expect(hintPose(1800).crack).toBe(1);
  expect(hintPose(2300).ripple).toBeGreaterThan(0);
  expect(hintPose(4200)).toEqual({ depth: 0, crack: 0, glance: 0, blink: 0, smile: 0, finger: 0, fingerY: 0, ripple: 0 });
});
it("shows the fingertip during the press and lifts it away", () => {
  expect(hintPose(1500).finger).toBe(1);
  expect(hintPose(1500).fingerY).toBe(0);
  expect(hintPose(2400).finger).toBe(0);
});
it("stops immediately and stays stopped for the visit", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const hint = createFrameHint(0, storage);
  hint.tick(1500, false, false); hint.stop();
  expect(hint.tick(1600, false, false)).toMatchObject({ active: false, label: false, depth: 0, crack: 0 });
  expect(JSON.parse(values.get(HINT_KEY) || "{}").stopped).toBe(true);
  expect(createFrameHint(3000, storage).tick(20000, false, false).active).toBe(false);
});
it("suppresses and cancels hints during fullscreen or control use", () => {
  const hint = createFrameHint(0);
  hint.tick(1500, false, false);
  expect(hint.tick(2000, true, false)).toMatchObject({ active: false, label: false, depth: 0 });
});
it("reduced motion shows only the label, without movement", () => {
  const hint = createFrameHint(0);
  hint.tick(1500, false, true);
  expect(hint.tick(2500, false, true)).toMatchObject({ active: false, label: true, depth: 0, crack: 0, finger: 0, ripple: 0, glance: 0 });
});
