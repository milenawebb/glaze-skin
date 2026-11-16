import type { Region } from "./regions";

export function recoverySettings(random = Math.random) {
  return { duration: 2000 + random() * 2000, fraction: 1 };
}
export const REST_THRESHOLD = 1e-5;
/** Queue all remaining signed displacement, not just the latest press delta. */
export function queueRecovery(dent: Float32Array, rise: Float32Array, width: number, area: Region): Region | null {
  let x0=width,y0=dent.length/width,x1=-1,y1=-1;
  for(let y=area.y0;y<=area.y1;y++)for(let x=area.x0;x<=area.x1;x++){
    const i=y*width+x,value=dent[i]??0;
    if(Math.abs(value)<=REST_THRESHOLD){dent[i]=0;rise[i]=0;continue;}
    rise[i]=value;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
  }
  return x1<0?null:{x0,y0,x1,y1};
}
/** Fold only active cells into the height map, with an exact rest at completion. */
export function bakeRecovery(dent: Float32Array, rise: Float32Array, width: number, bounds: Region, k: number, finish: boolean) {
  for(let y=bounds.y0;y<=bounds.y1;y++)for(let x=bounds.x0;x<=bounds.x1;x++){
    const i=y*width+x,value=rise[i]??0;
    if(value===0)continue;
    const next=(dent[i]??0)+value*k;
    dent[i]=Math.abs(next)<=REST_THRESHOLD?0:next;
    rise[i]=finish?0:value*(1+k);
  }
}
export function recoveryFactor(elapsed: number, duration: number, fraction: number) {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  return 1 - fraction * (1 - Math.pow(1 - t, 3));
}
export function immediateDepth(normalHoldDepth: number) { return Math.max(.5, normalHoldDepth * .5); }
/** Recovery-only drawing is capped at 20Hz, with an exact final bake. */
export const RECOVERY_UPDATE_MS = 50;
export function recoveryDelay(now: number, start: number, duration: number) {
  return Math.max(0, Math.min(RECOVERY_UPDATE_MS, start + duration - now));
}