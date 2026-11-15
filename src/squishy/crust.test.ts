import { afterEach, describe, expect, it, vi } from "vitest";
import { crackCrust } from "./crust";
vi.mock("./sounds", () => ({ playCrunch: vi.fn() }));
vi.mock("./haptics", () => ({ vibrateBreak: vi.fn(), vibrateCrack: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe("glass coating motion", () => {
  it("fades in 200ms without shards or sparkles for reduced motion", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const coat = document.createElement("span"), layer = document.createElement("div"), remove = vi.fn();
    crackCrust(coat, layer, { onRemove: remove });
    vi.advanceTimersByTime(199);
    expect(remove).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(remove).toHaveBeenCalledOnce();
    expect(layer.querySelectorAll(".sq-flake,.sq-sparkle")).toHaveLength(0);
    vi.unstubAllGlobals();
  });
  it("spreads eight lines then releases tiny shards within the 0.8s crack", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("Animation", class {});
    Object.defineProperty(Element.prototype, "animate", { configurable: true, value: vi.fn(() => ({ onfinish: null })) });
    const coat = document.createElement("span"), layer = document.createElement("div"), remove = vi.fn();
    crackCrust(coat, layer, { onRemove: remove });
    expect(coat.querySelectorAll("polyline")).toHaveLength(8);
    vi.advanceTimersByTime(239);
    expect(remove).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(remove).toHaveBeenCalledOnce();
    expect(layer.querySelectorAll(".sq-flake")).toHaveLength(28);
    expect(layer.querySelectorAll(".sq-sparkle")).toHaveLength(4);
    vi.unstubAllGlobals();
  });
});