import { describe, expect, it } from "vitest";
import { nextPlaybackRate } from "./controls";

describe("playback speed", () => {
  it("cycles 1x, 1.5x, 2x, 0.5x and back to 1x", () => {
    expect([1, 1.5, 2, 0.5].map(nextPlaybackRate)).toEqual([1.5, 2, 0.5, 1]);
  });
});