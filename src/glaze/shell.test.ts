import { describe, expect, it } from "vitest";
import { createShellBreak, takeShellChips, createCrackTrail, SHELL_BREAK_MS, framePressStage } from "./shell";
import { breakGlaze, hasGlaze } from "./glaze";

describe("wax shell", () => {
  it("first press cracks without exposing foam", () => { expect(framePressStage(true,false)).toBe("crack"); });
  it("second press shatters an already cracked shell", () => { expect(framePressStage(true,true)).toBe("shatter"); });
  it("exposed foam only squishes", () => { expect(framePressStage(false,true)).toBe("foam"); });
  it("makes five to eight 20–60px open radiating cracks plus branches", () => {
    for(const value of [0,.999]){
      const count=value===0?5:8,shape=createShellBreak(80,80,60,()=>value);
      const rays=shape.cracks.filter(path=>path[0]?.x===80&&path[0]?.y===80);
      expect(rays).toHaveLength(count);
      for(const ray of rays){const end=ray.at(-1);expect(Math.hypot((end?.x??80)-80,(end?.y??80)-80)).toBeGreaterThanOrEqual(19.999);expect(Math.hypot((end?.x??80)-80,(end?.y??80)-80)).toBeLessThanOrEqual(60);expect(end).not.toEqual(ray[0]);}
      expect(shape.cracks.length-count).toBe(Math.ceil(count/3));
      expect(shape.arcs.length).toBe(count-2);
      for(const arc of shape.arcs){expect(rays.flat().some(p=>p===arc[0])).toBe(false);expect(rays.flat().some(p=>p===arc.at(-1))).toBe(false);}
    }
  });
  it("initial chipping removes at least two pieces spanning at least 20px",()=>{
    for(const value of [0,.5,.999]){const shape=createShellBreak(80,80,60,()=>value);const chips=takeShellChips(shape,80,80,()=>0);expect(chips.length).toBeGreaterThanOrEqual(2);expect(chips.length).toBeLessThanOrEqual(3);const points=chips.flat();expect(Math.max(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))).toBeGreaterThanOrEqual(20);expect(takeShellChips(shape,80,80,()=>0)).not.toContain(chips[0]);}
  });
  it("drag trails join endpoints with side branches at 15–25px intervals",()=>{
    const trail=createCrackTrail({x:0,y:0},{x:100,y:0},()=>.5);
    expect(trail.cracks[0]?.[0]).toEqual({x:0,y:0});expect(trail.cracks[0]?.at(-1)).toEqual({x:100,y:0});
    expect(trail.cracks.slice(1).map(path=>path[0]?.x)).toEqual([20,40,60,80]);
  });
  it("peels over 0.6 seconds", () => { expect(SHELL_BREAK_MS).toBe(600); });
  it("exposes foam only within the broken boundary without modifying dents", () => {
    const r = { dw: 50, dh: 50, glaze: new Float32Array(2500), dent: new Float32Array(2500).fill(.6) };
    const shape = createShellBreak(50, 50, 20, () => .5);
    breakGlaze(r, 50, 50, 20, 1, shape.boundary);
    expect(hasGlaze(r, 50, 50)).toBe(false);
    expect(hasGlaze(r, 80, 50)).toBe(true);
    expect(r.dent[1275]).toBeCloseTo(.6);
    r.glaze.fill(0);
    expect(hasGlaze(r, 50, 50)).toBe(true);
  });
});