import { expect, it } from "vitest";
import { readPreferences, savePreferences, COLOR_FADE_MS, COLORS, OPTIONS } from "./preferences";
it("defaults to Rainbow and sounds off", () => { expect(readPreferences({ getItem: () => null })).toEqual({ color: "Rainbow", sounds: false }); });
it("starts demo sounds on when no viewer choice exists", () => { expect(readPreferences({ getItem: () => null }, true).sounds).toBe(true); });
it("a remembered off choice overrides sounds=true", () => { expect(readPreferences({ getItem: () => '{"sounds":false}' }, true).sounds).toBe(false); });
it("preserves existing viewer choices across the Glaze rename", () => {
  const storage={getItem:(key:string)=>key==="squishy-preferences"?'{"color":"Lilac","sounds":false}':null};
  expect(readPreferences(storage,true)).toEqual({color:"Lilac",sounds:false});
});
it("a remembered on choice overrides the off default", () => { expect(readPreferences({ getItem: () => '{"sounds":true}' }, false).sounds).toBe(true); });
it("restores the viewer's chosen color and sound switch", () => { expect(readPreferences({ getItem: () => '{"color":"Strawberry","sounds":true}' })).toEqual({ color: "Strawberry", sounds: true }); });
it("handles blocked storage and invalid color safely", () => {
  expect(readPreferences({ getItem: () => { throw Error(); } })).toEqual({ color: "Rainbow", sounds: false });
  expect(readPreferences({ getItem: () => '{"color":"bad"}' }).color).toBe("Rainbow");
  expect(() => savePreferences({ setItem: () => { throw Error(); } }, "Matcha", false)).not.toThrow();
});
it("fades color over 400ms", () => { expect(COLOR_FADE_MS).toBe(400); });
it("offers exactly Rainbow, Strawberry, Lilac and Matcha in order", () => { expect(COLORS).toEqual(["Rainbow", "Strawberry", "Lilac", "Matcha"]); });
it("keeps Rainbow candy with pink foam as the default style", () => { expect(OPTIONS.Rainbow.glazeStyle).toBe("candy"); });
it("uses Candy for Strawberry", () => { expect(OPTIONS.Strawberry.glazeStyle).toBe("candy"); });
it("uses sprinkle-free Mono for Lilac", () => { expect(OPTIONS.Lilac.glazeStyle).toBe("mono"); });
it("uses sprinkle-free Mono for Matcha", () => { expect(OPTIONS.Matcha.glazeStyle).toBe("mono"); });
it("remembers a combined Lilac choice", () => { expect(readPreferences({ getItem: () => '{"color":"Lilac","sounds":false}' }).color).toBe("Lilac"); });