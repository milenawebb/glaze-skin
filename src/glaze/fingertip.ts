import {region,tailWeight,type Region} from "./regions";
export interface FingerPad {angle:number;width:number;length:number}
export function fingerPad(type:string,random=Math.random):FingerPad{const width=type==="touch"?32:24;return {width,length:width*1.4,angle:(random()-.5)*50*Math.PI/180};}
export function fingerDepth(held:number,pressure:number|null){return (1+Math.min(1,Math.max(0,held)/2)*.5)*(pressure??1);}
export function fingertipHeight(dx:number,dy:number,pad:FingerPad,depth:number,stretch=1){
 return padHeight(dx,dy,Math.cos(pad.angle),Math.sin(pad.angle),2/pad.width,2/(pad.length*stretch),depth);
}
function padHeight(dx:number,dy:number,c:number,s:number,iw:number,il:number,depth:number){
 const u=(dx*c+dy*s)*iw,v=(-dx*s+dy*c)*il;
 const bowl=Math.exp(-2*(u*u+(v+1/3)**2)),side=(Math.exp(-2.5*(u-1.12)**2)+Math.exp(-2.5*(u+1.12)**2))*Math.exp(-.8*v*v),base=Math.exp(-1.2*u*u-2*(v-1.05)**2);
 return depth*(bowl-.15*(side+base)*(1-Math.exp(-3*(u*u+(v+1/3)**2))));
}
export function stampFingertip(r:{dent:Float32Array;dw:number;dh:number;width:number;height:number;dirtyHeight?:(bounds:Region)=>void},x:number,y:number,pad:FingerPad,depth:number,rate:number,stretch=1){
 const extent=pad.length*stretch*3,bounds=region(r.dw,r.dh,(x-extent)*r.dw/r.width,(y-extent)*r.dh/r.height,(x+extent)*r.dw/r.width,(y+extent)*r.dh/r.height);r.dirtyHeight?.(bounds);
 const c=Math.cos(pad.angle),s=Math.sin(pad.angle),iw=2/pad.width,il=2/(pad.length*stretch),sx=r.width/r.dw,sy=r.height/r.dh;
 for(let yy=bounds.y0;yy<=bounds.y1;yy++)for(let xx=bounds.x0;xx<=bounds.x1;xx++){
  const dx=xx*sx-x,dy=yy*sy-y;
  const target=padHeight(dx,dy,c,s,iw,il,depth)*tailWeight(Math.hypot(dx,dy)/(extent/6)),i=yy*r.dw+xx,cur=r.dent[i]??0,delta=target-cur,soft=.002*Math.abs(target);
  // A swept envelope, not repeated soft additions: stationary ends and overlaps cannot accumulate depth.
  r.dent[i]=cur+(target>=0?Math.max(delta,0):Math.min(delta,0))*rate;
 }
}