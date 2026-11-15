import { expect,it } from "vitest";
import { createGlazeStrip,isGlazeDrag,stripWidth } from "./strip";
import { insideShellPolygon } from "./shell";

it("clicks stay clicks through 6px and become drags beyond 6px",()=>{
  expect(isGlazeDrag({x:0,y:0},{x:6,y:0})).toBe(false);
  expect(isGlazeDrag({x:0,y:0},{x:6.01,y:0})).toBe(true);
});
it("strips are 28px wide for mouse and pen and 36px for touch",()=>{
  expect(stripWidth("mouse")).toBe(28);expect(stripWidth("pen")).toBe(28);expect(stripWidth("touch")).toBe(36);
  for(const width of [28,36]){
    const shape=createGlazeStrip({x:20,y:40},{x:60,y:40},width,()=>.5);
    expect(Math.max(...shape.boundary.map(p=>p.y))-Math.min(...shape.boundary.map(p=>p.y))).toBe(width);
    expect(insideShellPolygon(40,40,shape.boundary)).toBe(true);
    expect(shape.cracks).toEqual([]);expect(shape.arcs).toEqual([]);
  }
});