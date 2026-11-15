import { afterEach, describe, expect, it, vi } from "vitest";
import { setSoundsEnabled } from "./sounds";
import { vibrateBreak, vibrateCrack, vibratePress } from "./haptics";

afterEach(() => { setSoundsEnabled(false); vi.restoreAllMocks(); });

describe("sound-linked vibration", () => {
  it("never vibrates while sounds are off", () => {
    const buzz = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: buzz });
    setSoundsEnabled(false);
    vibratePress(); vibrateCrack(); vibrateBreak();
    expect(buzz).not.toHaveBeenCalled();
  });
  it("uses 10ms on press, 25ms on a new crack, and [15,30,15] on break-off", () => {
    const buzz = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: buzz });
    setSoundsEnabled(true);
    vibratePress(); vibrateCrack(); vibrateBreak();
    expect(buzz.mock.calls).toEqual([[10], [25], [[15, 30, 15]]]);
  });
  it("silently tolerates an absent API", () => {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: undefined });
    setSoundsEnabled(true);
    expect(() => { vibratePress(); vibrateCrack(); vibrateBreak(); }).not.toThrow();
  });
  it("silently tolerates an API that throws", () => {
    const buzz = vi.fn(() => { throw new Error("not supported"); });
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: buzz });
    setSoundsEnabled(true);
    expect(() => { vibratePress(); vibrateCrack(); vibrateBreak(); }).not.toThrow();
    expect(buzz).toHaveBeenCalledTimes(3);
  });
});