import { expect, it } from "vitest";
import { bakeRecovery, queueRecovery, REST_THRESHOLD, immediateDepth, recoveryDelay, recoveryFactor, recoverySettings } from "./recovery";
it("starts at at least half normal hold depth", () => { expect(immediateDepth(1)).toBeGreaterThanOrEqual(.5); });
it("recovers every dent completely over the existing two to four seconds", () => {
  expect(recoverySettings(() => 0)).toEqual({ duration: 2000, fraction: 1 });
  expect(recoverySettings(() => 1)).toEqual({ duration: 4000, fraction: 1 });
});
it("eases out without fully erasing or bouncing", () => {
  expect(recoveryFactor(0, 3000, .7)).toBe(1);
  expect(recoveryFactor(3000, 3000, .7)).toBeCloseTo(.3);
  expect(recoveryFactor(1000, 3000, .7) - recoveryFactor(2000, 3000, .7)).toBeGreaterThan(recoveryFactor(2000, 3000, .7) - recoveryFactor(3000, 3000, .7));
});
it("limits recovery-only updates to 20 per second", () => {
  expect(recoveryDelay(1000, 1000, 3000)).toBe(50);
  expect(recoveryDelay(2000, 1000, 3000)).toBe(50);
});
it("schedules the final recovery update without extending its duration", () => {
  expect(recoveryDelay(3980, 1000, 3000)).toBe(20);
  expect(recoveryDelay(4000, 1000, 3000)).toBe(0);
  expect(recoveryDelay(4100, 1000, 3000)).toBe(0);
});
it("recovers three repeated presses and two swipes without another touch", () => {
  const dent=new Float32Array(64),rise=new Float32Array(64),area={x0:0,y0:0,x1:7,y1:7};
  for(let gesture=0;gesture<5;gesture++){
    dent[18]=(dent[18]??0)+.3;dent[19]=-.12;
    const bounds=queueRecovery(dent,rise,8,area);
    expect(bounds).not.toBeNull();
    if(!bounds)throw new Error("Missing recovery");
    if(gesture<4)bakeRecovery(dent,rise,8,bounds,recoveryFactor(250,3000,1)-1,false);
    else bakeRecovery(dent,rise,8,bounds,-1,true);
  }
  expect(Math.max(...dent.map(Math.abs))).toBeLessThanOrEqual(REST_THRESHOLD);
  expect(Math.max(...rise.map(Math.abs))).toBe(0);
});
it("queues only the active rectangle and includes previously stranded depth", () => {
  const dent=new Float32Array(64),rise=new Float32Array(64);
  dent[18]=.4;dent[27]=-.15;dent[0]=REST_THRESHOLD/2;
  expect(queueRecovery(dent,rise,8,{x0:0,y0:0,x1:7,y1:7})).toEqual({x0:2,y0:2,x1:3,y1:3});
  expect(rise[18]).toBeCloseTo(.4);expect(rise[27]).toBeCloseTo(-.15);expect(dent[0]).toBe(0);
});
it("bakes only the dirty cells and stops only after exact rest", () => {
  const dent=new Float32Array(64),rise=new Float32Array(64);dent[18]=.8;rise[18]=.8;dent[60]=.9;
  const bounds={x0:2,y0:2,x1:2,y1:2};
  bakeRecovery(dent,rise,8,bounds,-.5,false);
  expect(dent[18]).toBeCloseTo(.4);expect(rise[18]).toBeCloseTo(.4);expect(dent[60]).toBeCloseTo(.9);
  bakeRecovery(dent,rise,8,bounds,-1,true);
  expect(dent[18]).toBe(0);expect(rise[18]).toBe(0);expect(queueRecovery(dent,rise,8,bounds)).toBeNull();
});