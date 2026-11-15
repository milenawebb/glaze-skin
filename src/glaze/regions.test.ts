import {expect,it} from "vitest";
import {RESET_MS,resetAmount,resetDuration,region,union} from "./regions";
import {stampDent,type FrameRenderer} from "./frame-gl";
import {stampFingertip,fingerPad} from "./fingertip";
it("puffs out and recoats together in 600ms with ease-out",()=>{expect(RESET_MS).toBe(600);expect(resetAmount(0)).toBe(1);expect(resetAmount(300)).toBe(.125);expect(resetAmount(600)).toBe(0);});
it("reduced motion resets with a short 200ms fade",()=>{expect(resetDuration(true)).toBe(200);expect(resetAmount(100,true)).toBe(.5);expect(resetAmount(200,true)).toBe(0);});
it("marks only a local height rectangle for a press",()=>{let dirty=null;const r={dw:512,dh:512,width:960,height:680,dent:new Float32Array(512*512),dirtyHeight(b:ReturnType<typeof region>){dirty=b;}} as FrameRenderer;stampDent(r,480,620,16,.5,1);expect(dirty).toEqual(region(512,512,384*512/960,524*512/680,576*512/960,716*512/680));expect(r.dent[0]).toBe(0);});
it("starts the fingertip dent in one local stamp",()=>{const r={dw:512,dh:512,width:960,height:680,dent:new Float32Array(512*512)};stampFingertip(r,480,620,fingerPad("mouse",()=>.5),1,1);expect(r.dent[Math.floor(615*512/680)*512+256]).toBeGreaterThan(.9);expect(r.dent[0]).toBe(0);});
it("merges changed rectangles without expanding to the full map",()=>{expect(union(region(512,512,10,20,30,40),region(512,512,25,35,50,60))).toEqual({x0:10,y0:20,x1:50,y1:60});});