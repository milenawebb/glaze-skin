import { expect, it } from "vitest";
import { clipCrackPaths, mapShell, rasterHeight } from "./damage";
import { createShellBreak } from "./shell";

it("clips cracks on either side of an exposed hole, including a hole between intact endpoints",()=>{
  const paths=clipCrackPaths([[{x:0,y:10},{x:40,y:10}]],x=>x<10||x>30);
  expect(paths).toHaveLength(2);
  expect(paths[0]?.at(-1)?.x).toBeLessThan(10);
  expect(paths[1]?.[0]?.x).toBeGreaterThan(30);
  expect(paths.flat().some(p=>p.x>=10&&p.x<=30)).toBe(false);
});
it("foam-only dragging retains no crack lines and crossings crack only intact material",()=>{
  expect(clipCrackPaths([[{x:10,y:0},{x:30,y:0}]],()=>false)).toEqual([]);
  for(const path of [[{x:0,y:0},{x:40,y:0}],[{x:40,y:0},{x:0,y:0}]]){
    const clipped=clipCrackPaths([path],x=>x>=20);
    expect(clipped).toHaveLength(1);
    expect(clipped.flat().every(p=>p.x>=20)).toBe(true);
  }
});

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