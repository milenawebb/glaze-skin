/** Dirty rectangles are in CPU-map pixels, with inclusive bounds. */
export interface Region { x0:number;y0:number;x1:number;y1:number }
export function region(w:number,h:number,x0:number,y0:number,x1:number,y1:number):Region {
 return {x0:Math.max(0,Math.floor(x0)),y0:Math.max(0,Math.floor(y0)),x1:Math.min(w-1,Math.ceil(x1)),y1:Math.min(h-1,Math.ceil(y1))};
}
export function union(a:Region|null,b:Region):Region {return a?{x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)}:b;}
export const RESET_MS=600;
export function resetAmount(elapsed:number,reduced=false){return reduced?0:Math.pow(1-Math.max(0,Math.min(1,elapsed/RESET_MS)),3);}
/** A five-sigma work window ends below display precision, with a smooth tail. */
export function tailWeight(distance:number){const t=Math.max(0,Math.min(1,(distance-4)/2));return 1-t*t*(3-2*t);}