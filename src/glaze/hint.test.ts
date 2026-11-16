import { expect, it } from "vitest";
import { createFrameHint, hintPose, HINT_KEY } from "./hint";

it("waits 2 seconds before the first quiet hint", () => {
  const hint = createFrameHint(0);
  expect(hint.tick(1999, false, false).count).toBe(0);
  expect(hint.tick(2000, false, false)).toMatchObject({ active: true, label: true, x: .30, count: 1 });
});
it("repeats at six second intervals at most three times", () => {
  const hint = createFrameHint(0);
  expect(hint.tick(2000, false, false).count).toBe(1);
  expect(hint.tick(7999, false, false).count).toBe(1);
  expect(hint.tick(8000, false, false).count).toBe(2);
  expect(hint.tick(14000, false, false).count).toBe(3);
  expect(hint.tick(20000, false, false)).toMatchObject({ count: 3, active: false });
});
it("shows the label once for four seconds", () => {
  const hint = createFrameHint(0);
  hint.tick(2000, false, false);
  expect(hint.tick(5999, false, false).label).toBe(true);
  expect(hint.tick(6000, false, false).label).toBe(false);
  expect(hint.tick(8000, false, false).label).toBe(false);
});
it("presses over 0.6 seconds and restores the dent and crack completely", () => {
  expect(hintPose(300).depth).toBeCloseTo(.13);
  expect(hintPose(600).depth).toBeCloseTo(.26);
  expect(hintPose(750).crack).toBe(1);
  expect(hintPose(3000)).toEqual({ depth: 0, crack: 0, glance: 0, blink: 0, smile: 0 });
});
it("blinks only once and returns the face to normal", () => {
  expect(hintPose(750).blink).toBe(1);
  expect(hintPose(1100).blink).toBe(0);
  expect(hintPose(2000).glance).toBe(0);
  expect(hintPose(2000).smile).toBe(0);
});
it("stops immediately and stays stopped for the visit", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const hint = createFrameHint(0, storage);
  hint.tick(2000, false, false); hint.stop();
  expect(hint.tick(2100, false, false)).toMatchObject({ active: false, label: false, depth: 0, crack: 0 });
  expect(JSON.parse(values.get(HINT_KEY) || "{}").stopped).toBe(true);
  expect(createFrameHint(3000, storage).tick(20000, false, false).active).toBe(false);
});
it("suppresses and cancels hints during fullscreen or control use", () => {
  const hint = createFrameHint(0);
  expect(hint.tick(2000, true, false)).toMatchObject({ count: 0, active: false, label: false });
  expect(hint.tick(3999, false, false).count).toBe(0);
  hint.tick(4000, false, false);
  expect(hint.tick(4500, true, false)).toMatchObject({ active: false, label: false, depth: 0 });
});
it("reduced motion shows only the label, without dent, crack or face motion", () => {
  const hint = createFrameHint(0);
  hint.tick(2000, false, true);
  expect(hint.tick(2750, false, true)).toMatchObject({ active: false, label: true, depth: 0, crack: 0, glance: 0, blink: 0, smile: 0 });
});