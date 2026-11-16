import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPLAY_ARC, REPLAY_HEAD } from "./replay-glyph";

const css = readFileSync(resolve("src/glaze/glaze.css"), "utf8");
const player = readFileSync(resolve("src/glaze/GlazePlayer.tsx"), "utf8");

/** Reads "A rx ry rot largeArc sweep x y" out of an arc path. */
function arcParts(d: string) {
  const m = /A\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d)\s+(\d)\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(d);
  expect(m, "arc path should carry arc flags").not.toBeNull();
  return { largeArc: m![4], sweep: m![5], x: Number(m![6]), y: Number(m![7]) };
}

/** The head triangle: tip first, then the two base corners. */
function headPoints(d: string) {
  const n = d.match(/-?[\d.]+/g)!.map(Number);
  const [tipX, tipY, ax, ay, bx, by] = n;
  return {
    tip: { x: tipX ?? 0, y: tipY ?? 0 },
    baseA: { x: ax ?? 0, y: ay ?? 0 },
    baseB: { x: bx ?? 0, y: by ?? 0 },
  };
}

/** Bodies of every rule whose selector mentions the given text. */
function ruleBodies(needle: string) {
  const bodies: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1]?.includes(needle)) bodies.push(m[2] ?? "");
  }
  return bodies;
}

function declaredPx(needle: string) {
  const match = new RegExp(`${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{]*\\{[^}]*width:\\s*(\\d+)px`).exec(css);
  expect(match, `${needle} should set a pixel width`).not.toBeNull();
  return Number(match![1]);
}

describe("replay bubble glyph", () => {
  it("curves clockwise with the head on the arc's own end", () => {
    const arc = arcParts(REPLAY_ARC);
    expect(arc.largeArc).toBe("1");
    expect(arc.sweep).toBe("1");
    const head = headPoints(REPLAY_HEAD);
    const centre = { x: (head.baseA.x + head.baseB.x) / 2, y: (head.baseA.y + head.baseB.y) / 2 };
    expect(centre.x).toBeCloseTo(arc.x);
    expect(centre.y).toBeCloseTo(arc.y);
    expect(head.tip.y).toBeLessThan(centre.y);
  });

  it("fills about 40 percent of the bubble on desktop and on phones", () => {
    const desktop = declaredPx(".sq-root .sq-replay .sq-play-icon") / declaredPx(".sq-replay .sq-center-bubble");
    const phone = declaredPx(".sq-root[data-compact] .sq-replay .sq-play-icon") / declaredPx(".sq-root[data-compact] .sq-replay .sq-center-bubble");
    expect(desktop).toBeGreaterThanOrEqual(0.38);
    expect(desktop).toBeLessThanOrEqual(0.42);
    expect(phone).toBeGreaterThanOrEqual(0.38);
    expect(phone).toBeLessThanOrEqual(0.42);
  });

  it("never spins and keeps the control plum plus a system colour in forced colors", () => {
    for (const needle of ["sq-replay-glyph", "sq-replay-arc", "sq-replay-head"]) {
      for (const body of ruleBodies(needle)) {
        expect(body, `${needle} must not carry an animation`).not.toMatch(/animation/);
      }
    }
    expect(ruleBodies(".sq-play-icon.sq-replay-glyph").join(" ")).toContain("stroke: var(--sq-liquid-ink)");
    const forced = css.slice(css.indexOf("@media (forced-colors: active)"));
    expect(forced).toContain(".sq-root .sq-replay-glyph");
    expect(forced).toContain("ButtonText");
  });

  it("keeps the button's accessible name", () => {
    expect(player).toContain('aria-label="Replay"');
  });
});
