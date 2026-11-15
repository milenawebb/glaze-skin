import { expect, it } from "vitest";
import { stampDent, smoothDents, type FrameRenderer } from "./frame-gl";
import { recoveryFactor } from "./recovery";

function field(){return {dent:new Float32Array(160*160),dw:160,dh:160,width:160,height:160} as FrameRenderer;}
it("retains smooth Gaussian tails past the former 2.2-radius cutoff",()=>{
  const r=field();stampDent(r,80,80,16,.5,1);
  expect(r.dent[80*160+120]).toBeCloseTo(.5*Math.exp(-40*40/(2*16*16)),3);
  expect(r.dent[80*160+130]).toBeGreaterThan(0);
  for(let x=81;x<145;x++)expect(r.dent[80*160+x]).toBeLessThan(r.dent[80*160+x-1]??0);
});
it("partial rise scales the whole smoothed contribution, including beyond 2.5 radii",()=>{
  const r=field();stampDent(r,80,80,16,.5,1);smoothDents(r,45,45,115,115);
  const before=r.dent.slice(),factor=recoveryFactor(4000,4000,.7);
  for(let i=0;i<r.dent.length;i++)r.dent[i]=(before[i]??0)*factor;
  for(const x of [80,100,120,130])expect((r.dent[80*160+x]??0)/(before[80*160+x]??1)).toBeCloseTo(.3);
});
it("a 2 to 3 pixel smoothing pass blends an impulse without a hard region boundary",()=>{
  const r=field();r.dent[80*160+80]=1;smoothDents(r,64,64,96,96);
  expect(r.dent[80*160+80]).toBeCloseTo(.25);
  expect(r.dent[80*160+83]).toBeGreaterThan(.1);
  expect(r.dent[83*160+83]).toBeGreaterThan(0);
});