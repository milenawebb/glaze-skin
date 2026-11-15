import { expect, it } from "vitest";
import { mapShell, rasterHeight } from "./damage";
import { createShellBreak } from "./shell";

it("retains normalized crack and chip geometry after repeated preview resizes",()=>{
  const source=createShellBreak(480,550,60,()=>.5);
  source.removed.add(2);
  const data=mapShell(source,1/960,1/650);
  for(const [w,h] of [[768,530],[390,320],[960,650],[390,320],[960,650]] as const){
    const view=mapShell(data,w,h);
    expect(mapShell(view,1/w,1/h).boundary[0]?.x).toBeCloseTo(data.boundary[0]?.x??0,12);
    expect(view.removed.has(2)).toBe(true);
  }
  expect(mapShell(data,960,650).cracks[0]?.[0]).toEqual({x:480,y:550});
});

it("rebuilds full resolution dents without changing normalized source depths",()=>{
  const data=new Float32Array([0,.6,.3,1]);
  const original=Array.from(data);
  for(const size of [3,8,20,3]){const view=rasterHeight(data,2,2,size,size);expect(view).toHaveLength(size*size);expect(view[0]).toBe(0);expect(view.at(-1)).toBe(1);}
  expect(Array.from(data)).toEqual(original);
});