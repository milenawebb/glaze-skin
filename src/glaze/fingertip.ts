import {region,tailWeight,type Region} from "./regions";
export interface FingerPad {angle:number;width:number;length:number;waves?:number;phase?:number;wobble?:number}
export function fingerPad(type:string,random=Math.random):FingerPad{
 const angle=(random()-.5)*50*Math.PI/180,width=(type==="touch"?32:24)*(.85+random()*.3),length=width*(1.2+random()*.3);
 // Gentle low-frequency outline wobble so no two presses match.
 return {width,length,angle,waves:random()<.5?2:3,phase:random()*Math.PI*2,wobble:.06+random()*.02};
}
const FAR=(4.2*1.08)**2;
export const MAX_FINGER_DEPTH = 1.8;
export function fingerDepth(held:number,pressure:number|null){return (1+Math.min(1,Math.max(0,held)/2)*.8)*(pressure??1);}
export function fingertipHeight(dx:number,dy:number,pad:FingerPad,depth:number,stretch=1){
 return padHeight(dx,dy,Math.cos(pad.angle),Math.sin(pad.angle),2/pad.width,2/(pad.length*stretch),depth,pad);
}
function padHeight(dx:number,dy:number,c:number,s:number,iw:number,il:number,depth:number,pad?:FingerPad){
 const v=(-dx*s+dy*c)*il,w=v+1/3;
 // Egg profile: about 20 percent wider at the fingertip (negative v) than at the base.
 const u=(dx*c+dy*s)*iw/(1-.1*Math.max(-1.5,Math.min(1.5,v)));
 const amp=pad?.wobble??0,k=amp?1+amp*Math.sin((pad?.waves??2)*Math.atan2(w,u)+(pad?.phase??0)):1;
 const q=(u*u+w*w)/(k*k),r=Math.sqrt(q);
 // Longer, softer ease into the surface plus one gentle raised ring following the outline.
 const bowl=Math.exp(-2*q/(1+.3*r)),ring=Math.exp(-2*(r-1.7)**2)*(1-Math.exp(-3*q));
 return depth*(Math.min(1,bowl)-.06*ring);
}
export function stampFingertip(r:{dent:Float32Array;dw:number;dh:number;width:number;height:number;dirtyHeight?:(bounds:Region)=>void},x:number,y:number,pad:FingerPad,depth:number,rate:number,stretch=1){
 const extent=pad.length*stretch*3,bounds=region(r.dw,r.dh,(x-extent)*r.dw/r.width,(y-extent)*r.dh/r.height,(x+extent)*r.dw/r.width,(y+extent)*r.dh/r.height);r.dirtyHeight?.(bounds);
 const c=Math.cos(pad.angle),s=Math.sin(pad.angle),iw=2/pad.width,il=2/(pad.length*stretch),sx=r.width/r.dw,sy=r.height/r.dh;
 for(let yy=bounds.y0;yy<=bounds.y1;yy++)for(let xx=bounds.x0;xx<=bounds.x1;xx++){
  const dx=xx*sx-x,dy=yy*sy-y;
  // Beyond 4.2 pad radii (wobble included) bowl and ring are below 1e-6 and the update is a no-op: skip the cell.
  const v=(-dx*s+dy*c)*il,u=(dx*c+dy*s)*iw/(1-.1*Math.max(-1.5,Math.min(1.5,v))),w=v+1/3;
  if(u*u+w*w>FAR)continue;
  const shape=padHeight(dx,dy,c,s,iw,il,1,pad)*tailWeight(Math.hypot(dx,dy)/(extent/6)),target=shape*depth,i=yy*r.dw+xx,cur=r.dent[i]??0,delta=target-cur;
  // Soft additions approach a bounded sink instead of flattening repeated presses.
  const limit=Math.abs(shape)*Math.max(depth,MAX_FINGER_DEPTH),soft=.04*Math.abs(target)*Math.max(0,1-Math.abs(cur)/Math.max(limit,1e-9));
  const change=(target>=0?.5*(delta+Math.sqrt(delta*delta+soft*soft)):.5*(delta-Math.sqrt(delta*delta+soft*soft)))*rate;
  r.dent[i]=target>=0?Math.max(cur,Math.min(limit,cur+change)):Math.min(cur,Math.max(-limit,cur+change));
 }
}