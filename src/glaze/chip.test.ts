import { describe, it, expect } from "vitest";
import { angularCell, maxPiece, chipPlates, clipToCircle, extent, snapToGlaze, snapRadius, chipRadius } from "./chip";
import { insideShellPolygon } from "./shell";
const box = (x: number, y: number, w: number, h: number) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
describe("chip", () => {
  it("snaps taps to glaze within 24px on phones and 16px on desktop", () => {
    expect(snapRadius(true)).toBe(24); expect(snapRadius(false)).toBe(16);
    const glaze = (x: number) => x >= 120;
    expect(snapToGlaze(100, 0, 24, glaze)).not.toBeNull();
    expect(snapToGlaze(100, 0, 16, glaze)).toBeNull();
  });
  it("finds nothing on bare squishy", () => { expect(snapToGlaze(0, 0, 24, () => false)).toBeNull(); });
  it("keeps a break-off from a big plate within the finger disc", () => {
    const big = box(0, 0, 200, 200), r = chipRadius(true);
    const parts = chipPlates([big], new Set(), 100, 100, r, () => true, insideShellPolygon);
    expect(parts.length).toBe(1);
    const size = extent(parts[0]!); expect(size).toBeGreaterThanOrEqual(25); expect(size).toBeLessThanOrEqual(55);
  });
  it("never makes a piece where there is no glaze", () => {
    expect(chipPlates([box(0, 0, 200, 200)], new Set(), 100, 100, 22, () => false, insideShellPolygon)).toEqual([]);
  });
  it("clears small islands whole, and loose crumbs with them", () => {
    const removed = new Set<number>();
    const parts = chipPlates([box(90, 90, 30, 30), box(300, 300, 8, 8)], removed, 100, 100, 20, () => true, insideShellPolygon, 48);
    expect(parts.length).toBe(2); expect(removed.size).toBe(2);
  });
  it("removes whole crack pieces up to 48px on phones instead of cutting circles", () => {
    expect(maxPiece(true)).toBe(48); expect(maxPiece(false)).toBe(36);
    const piece = box(95, 95, 40, 30);
    const parts = chipPlates([piece], new Set(), 100, 100, chipRadius(true), () => true, insideShellPolygon, maxPiece(true));
    expect(parts[0]).toBe(piece);
  });
  it("splits big pieces into an angular shard of 4 to 6 corners", () => {
    const cell = angularCell(0, 0, 20); expect(cell.length).toBeGreaterThanOrEqual(4); expect(cell.length).toBeLessThanOrEqual(6);
  });
  it("clips to a disc", () => { expect(clipToCircle(box(-50, -50, 100, 100), 0, 0, 10).every(p => Math.hypot(p.x, p.y) <= 10.01)).toBe(true); });
});
