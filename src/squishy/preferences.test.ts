import { expect, it } from "vitest";
import { readPreferences, savePreferences, COLOR_FADE_MS } from "./preferences";
it("defaults to Rainbow and sounds off", () => { expect(readPreferences({ getItem: () => null })).toEqual({ color: "Rainbow", sounds: false }); });
it("restores the viewer's chosen color and sound switch", () => { expect(readPreferences({ getItem: () => '{"color":"Strawberry","sounds":true}' })).toEqual({ color: "Strawberry", sounds: true }); });
it("handles blocked storage and invalid color safely", () => {
  expect(readPreferences({ getItem: () => { throw Error(); } })).toEqual({ color: "Rainbow", sounds: false });
  expect(readPreferences({ getItem: () => '{"color":"bad"}' }).color).toBe("Rainbow");
  expect(() => savePreferences({ setItem: () => { throw Error(); } }, "Matcha", false)).not.toThrow();
});
it("fades color over 400ms", () => { expect(COLOR_FADE_MS).toBe(400); });