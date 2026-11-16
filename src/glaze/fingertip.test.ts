import {expect,it} from "vitest";
import {fingerPad,fingerDepth,fingertipHeight,stampFingertip} from "./fingertip";
it("repeated presses sink deeper but never beyond 1.8 times a single press",()=>{
 const r={dent:new Float32Array(64*64),dw:64,dh:64,width:128,height:128},pad=fingerPad("touch",()=>.5);
 stampFingertip(r,64,64,pad,1,1,1.6);const single=r.dent.slice();
 for(let i=0;i<100;i++)stampFingertip(r,64,64,pad,1,1,1.6);
 expect(Math.max(...r.dent)).toBeGreaterThan(Math.max(...single));
 for(let i=0;i<1000;i++)stampFingertip(r,64,64,pad,1,1,1.6);
 expect(Math.max(...r.dent)).toBeLessThanOrEqual(1.8);
});
it("varies width 0.85 to 1.15, length ratio 1.2 to 1.5 and tilt plus or minus 25 degrees",()=>{const p=fingerPad("mouse",()=>0);expect(p.width).toBeCloseTo(20.4);expect(p.length/p.width).toBeCloseTo(1.2);const q=fingerPad("mouse",()=>.9999999);expect(q.width).toBeCloseTo(27.6);expect(q.length/q.width).toBeCloseTo(1.5);expect(p.angle*180/Math.PI).toBeCloseTo(-25);expect(fingerPad("mouse",()=>1).angle*180/Math.PI).toBeCloseTo(25);expect(fingerPad("touch",()=>.5).width).toBe(32);expect(p.wobble).toBeGreaterThanOrEqual(.06);expect(q.wobble).toBeLessThanOrEqual(.08);});
it("holding sinks to at most 1.8 times single-press depth",()=>{expect(fingerDepth(0,null)).toBe(1);expect(fingerDepth(2,null)).toBe(1.8);expect(fingerDepth(20,null)).toBe(1.8);});
it("has a top-third egg bowl wider at the tip, a gentle 0.06 ring and no cutoff",()=>{const p=fingerPad("mouse",()=>.5);expect(fingertipHeight(0,-p.length/6,p,1)).toBeGreaterThan(.99);expect(fingertipHeight(10,-p.length/2,p,1)).toBeGreaterThan(fingertipHeight(10,p.length/6,p,1));let low=0;for(let a=0;a<64;a++)for(let d=8;d<40;d+=.5)low=Math.min(low,fingertipHeight(Math.cos(a)*d,Math.sin(a)*d,p,1));expect(low).toBeLessThan(-.02);expect(low).toBeGreaterThan(-.07);expect(Math.abs(fingertipHeight(100,100,p,1))).toBeLessThan(.00001);});
it("stretches the groove and scales bowl and bulge equally during recovery",()=>{const p=fingerPad("mouse",()=>.5);expect(fingertipHeight(0,-18,p,1,1.6)).toBeGreaterThan(fingertipHeight(0,-18,p,1));for(const [x,y] of [[0,-5],[16,0]])expect(fingertipHeight(x??0,y??0,p,.3)).toBeCloseTo(fingertipHeight(x??0,y??0,p,1)*.3);});
it("round groove end caps have continuous slopes on either side of the endpoint",()=>{
 const p=fingerPad("touch",()=>.5),e=.001;
 for(const y of [-p.length*1.6/2,p.length*1.6/2]){
  const h=(v:number)=>fingertipHeight(0,v,p,1,1.6);
  expect(Math.abs((h(y)-h(y-e))/e-(h(y+e)-h(y))/e)).toBeLessThan(.001);
 }
});