import { expect, it } from "vitest";
import { embedFit, embedLayout } from "./embed-fit";
it("contains the complete frame and bar in a short iframe with uniform scaling", () => {
  const fit = embedFit(900, 300, 900, 680);
  expect(fit.height).toBe(300);
  expect(fit.width).toBeCloseTo(900 * 300 / 680);
  expect(fit.scale).toBeCloseTo(300 / 680);
});
it("fits a narrow iframe without enlarging its phone layout", () => {
  expect(embedFit(358, 600, 358, 380)).toEqual({ scale: 1, width: 358, height: 380 });
  expect(embedFit(358, 190, 358, 380)).toEqual({ scale: .5, width: 179, height: 190 });
});
it("uses a fixed 960px desktop design only for the desktop option with a fine pointer", () => {
  expect(embedLayout("desktop", true, 358)).toEqual({ desktop: true, width: 960 });
  expect(embedLayout("desktop", true, 1200).width).toBe(960);
});
it("keeps the current narrow layout for coarse pointers even with the desktop option", () => {
  expect(embedLayout("desktop", false, 358)).toEqual({ desktop: false, width: 358 });
});
it("preserves the default embed width regardless of pointer or unknown option", () => {
  expect(embedLayout("", true, 358)).toEqual({ desktop: false, width: 358 });
  expect(embedLayout("", false, 1200).width).toBe(900);
  expect(embedLayout("other", true, 358).desktop).toBe(false);
});
it("uniformly contains the 960px desktop design in a short narrow iframe", () => {
  expect(embedFit(358, 200, 960, 680)).toEqual({ scale: 200 / 680, width: 960 * 200 / 680, height: 200 });
});