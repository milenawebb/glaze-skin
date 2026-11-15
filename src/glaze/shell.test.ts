import { describe, expect, it, vi } from "vitest";
import { createShellBreak, takeShellChips, createCrackTrail, SHELL_BREAK_MS, framePressStage, MAX_FLYING_PIECES, pieceMotion, debrisPolygon, peelShell, cancelShellDebris } from "./shell";
import { breakGlaze, hasGlaze } from "./glaze";

describe("wax shell", () => {
  it("limits flying pieces to forty even during overlapping breaks",()=>{
    vi.useFakeTimers();cancelShellDebris();
    const layer=document.createElement("div");document.body.append(layer);for(let i=0;i<45;i++){const el=document.createElement("canvas");el.className="sq-shell-plate";layer.append(el);}
    const image=document.createElement("canvas");image.width=20;image.height=20;
    const animate=HTMLCanvasElement.prototype.animate;
    HTMLCanvasElement.prototype.animate=()=>({onfinish:null} as Animation);
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=(()=>({scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},drawImage(){}})) as unknown as typeof get;
    Element.prototype.getAnimations??=()=>[];
    try{peelShell(layer,image,{boundary:[],plates:[[{x:0,y:0},{x:20,y:0},{x:0,y:20}]],cracks:[],arcs:[],removed:new Set()},10,10,10);vi.advanceTimersByTime(300);expect(MAX_FLYING_PIECES).toBe(40);expect(layer.querySelectorAll(".sq-shell-plate")).toHaveLength(40);expect(layer.querySelectorAll('[data-debris="crumb"]')).toHaveLength(8);}
    finally{layer.remove();cancelShellDebris();vi.useRealTimers();HTMLCanvasElement.prototype.animate=animate;HTMLCanvasElement.prototype.getContext=get;}
  });
  it("gives pieces individual 0.4–1.1 second falls and thin or thick edges",()=>{
    expect(pieceMotion(false,()=>0).duration).toBe(400);expect(pieceMotion(false,()=>1).duration).toBe(1100);
    expect(pieceMotion(false,()=>0).thickness).toBe(.6);expect(pieceMotion(false,()=>1).thickness).toBe(4.6);
    expect(Math.abs(pieceMotion(true,()=>1).dx)).toBeGreaterThan(Math.abs(pieceMotion(false,()=>1).dx));
  });
  it("mixes sliver and notched outlines with jittered three-to-nine primary sides",()=>{
    const chunk=debrisPolygon({x:0,y:0},20,0,()=>.5),sliver=debrisPolygon({x:0,y:0},20,1,()=>.5);
    const span=(p:typeof chunk,axis:"x"|"y")=>Math.max(...p.map(v=>v[axis]))-Math.min(...p.map(v=>v[axis]));
    expect(span(sliver,"x")/span(sliver,"y")).toBeGreaterThan(3);
    expect(chunk.length).toBeGreaterThan(9);expect(chunk).not.toEqual(sliver);
  });
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