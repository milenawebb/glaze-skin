import { expect, it } from "vitest";
import { DEFAULT_GLAZE_STYLE, monoStyleAmount } from "./glaze-style";
it("keeps Candy as the default glaze", () => { expect(DEFAULT_GLAZE_STYLE).toBe("candy"); expect(monoStyleAmount()).toBe(0); });
it("selects Mono without changing the Candy selection", () => { expect(monoStyleAmount("mono")).toBe(1); expect(monoStyleAmount("candy")).toBe(0); });