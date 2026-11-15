import { expect, it } from "vitest";
import { PREVIEW_WIDTHS, PREVIEW_MODES, PREVIEW_TRANSITION_MS, nextPreview } from "./demo-preview";
it("defaults to Desktop", () => { expect(PREVIEW_MODES[0]).toBe("Desktop"); });
it("uses a 960px Desktop maximum", () => { expect(PREVIEW_WIDTHS.Desktop).toBe(960); });
it("uses a 768px Tablet area", () => { expect(PREVIEW_WIDTHS.Tablet).toBe(768); });
it("uses a 390px Mobile area", () => { expect(PREVIEW_WIDTHS.Mobile).toBe(390); });
it("animates resizing over 300ms", () => { expect(PREVIEW_TRANSITION_MS).toBe(300); });
it("moves between preview modes with arrow keys", () => { expect(nextPreview("Desktop", "ArrowRight")).toBe("Tablet"); expect(nextPreview("Desktop", "ArrowLeft")).toBe("Mobile"); });