import { describe, expect, it } from "vitest";
import { nextPlaybackRate, POPUP_SPEEDS, VOLUME_CLOSE_MS, CONTROLS_IDLE_MS, controlsVisible } from "./controls";

describe("playback speed", () => {
  it("cycles 1x, 1.5x, 2x, 0.5x and back to 1x", () => {
    expect([1, 1.5, 2, 0.5].map(nextPlaybackRate)).toEqual([1.5, 2, 0.5, 1]);
  });
});
it("offers the four requested popup speeds in order", () => { expect(POPUP_SPEEDS).toEqual([0.5, 1, 1.5, 2]); });
it("delays volume dismissal by 300ms", () => { expect(VOLUME_CLOSE_MS).toBe(300); });
it("hides idle playing controls after 2000ms", () => { expect(CONTROLS_IDLE_MS).toBe(2000); expect(controlsVisible(false, false, false, false)).toBe(false); });
it("keeps controls visible when paused, active, in a popup, or keyboard focused", () => {
  expect(controlsVisible(true, false, false, false)).toBe(true);
  expect(controlsVisible(false, true, false, false)).toBe(true);
  expect(controlsVisible(false, false, true, false)).toBe(true);
  expect(controlsVisible(false, false, false, true)).toBe(true);
});