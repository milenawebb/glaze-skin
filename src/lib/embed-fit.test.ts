import { expect, it } from "vitest";
import { embedFit } from "./embed-fit";
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