import { expect, it, vi } from "vitest";
import { attachSquish } from "./squish";
vi.mock("./sounds", () => ({ attachPressSounds: () => () => {} }));
vi.mock("./haptics", () => ({ vibratePress: () => {} }));
vi.mock("./crust", () => ({ prefersReducedMotion: () => false }));

it("releases a slider even when it stops pointerup propagation", () => {
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  const el = document.createElement("div");
  document.body.appendChild(el);
  const off = attachSquish(el);
  el.addEventListener("pointerup", e => e.stopPropagation());
  el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  const listener = add.mock.calls.find(call => call[0] === "pointerup");
  expect(listener?.[2]).toBe(true);
  el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
  expect(remove).toHaveBeenCalledWith("pointerup", listener?.[1], true);
  off(); el.remove(); vi.restoreAllMocks();
});