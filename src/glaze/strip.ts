import type { ShellBreak, ShellPoint } from "./shell";

export const DRAG_THRESHOLD = 6;
export const TOUCH_DRAG_THRESHOLD = 8;
export function dragThreshold(pointerType: string) { return pointerType === "touch" ? TOUCH_DRAG_THRESHOLD : DRAG_THRESHOLD; }
export function isGlazeDrag(origin: ShellPoint, point: ShellPoint, threshold = DRAG_THRESHOLD) { return Math.hypot(point.x-origin.x,point.y-origin.y)>threshold; }
export function stripWidth(pointerType: string) { return pointerType === "touch" ? 36 : 28; }
/** Short overlapping capsules give the strip a continuous center and broken outer lip. */
export function createGlazeStrip(a: ShellPoint,b: ShellPoint,width: number,random=Math.random): ShellBreak {
  const angle=Math.atan2(b.y-a.y,b.x-a.x),radius=width/2;
  const cap=(center:ShellPoint,start:number)=>Array.from({length:9},(_,i)=>{
    const t=start+i*Math.PI/8,r=radius+(random()-.5)*3.5-(i%4===2?random()*2:0);
    return {x:center.x+Math.cos(t)*r,y:center.y+Math.sin(t)*r};
  });
  const boundary=[...cap(b,angle-Math.PI/2),...cap(a,angle+Math.PI/2)];
  return {boundary,plates:[],cracks:[],arcs:[],removed:new Set()};
}