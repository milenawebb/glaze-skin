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
it("uses 34x24 desktop ovals with plus or minus 25 degree tilt and larger touch",()=>{const p=fingerPad("mouse",()=>0);expect(p.width).toBe(24);expect(p.length).toBeCloseTo(33.6);expect(p.angle*180/Math.PI).toBeCloseTo(-25);expect(fingerPad("mouse",()=>1).angle*180/Math.PI).toBeCloseTo(25);expect(fingerPad("touch").width).toBe(32);});
it("holding sinks to at most 1.8 times single-press depth",()=>{expect(fingerDepth(0,null)).toBe(1);expect(fingerDepth(2,null)).toBe(1.8);expect(fingerDepth(20,null)).toBe(1.8);});
it("has a top-third bowl with soft raised sides and base and no cutoff",()=>{const p=fingerPad("mouse",()=>.5);expect(fingertipHeight(0,-p.length/6,p,1)).toBeGreaterThan(.99);expect(fingertipHeight(16,0,p,1)).toBeLessThan(-.1);expect(fingertipHeight(0,22,p,1)).toBeLessThan(0);expect(Math.abs(fingertipHeight(100,100,p,1))).toBeLessThan(.00001);});
it("stretches the groove and scales bowl and bulge equally during recovery",()=>{const p=fingerPad("mouse",()=>.5);expect(fingertipHeight(0,-18,p,1,1.6)).toBeGreaterThan(fingertipHeight(0,-18,p,1));for(const [x,y] of [[0,-5],[16,0]])expect(fingertipHeight(x??0,y??0,p,.3)).toBeCloseTo(fingertipHeight(x??0,y??0,p,1)*.3);});
it("round groove end caps have continuous slopes on either side of the endpoint",()=>{
 const p=fingerPad("touch",()=>.5),e=.001;
 for(const y of [-p.length*1.6/2,p.length*1.6/2]){
  const h=(v:number)=>fingertipHeight(0,v,p,1,1.6);
  expect(Math.abs((h(y)-h(y-e))/e-(h(y+e)-h(y))/e)).toBeLessThan(.001);
 }
});