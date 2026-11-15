export interface FingerPad {angle:number;width:number;length:number}
export function fingerPad(type:string,random=Math.random):FingerPad{const width=type==="touch"?32:24;return {width,length:width*1.4,angle:(random()-.5)*50*Math.PI/180};}
export function fingerDepth(held:number,pressure:number|null){return (1+Math.min(1,Math.max(0,held)/2)*.5)*(pressure??1);}
export function fingertipHeight(dx:number,dy:number,pad:FingerPad,depth:number,stretch=1){
 const c=Math.cos(pad.angle),s=Math.sin(pad.angle),u=(dx*c+dy*s)/(pad.width*.5),v=(-dx*s+dy*c)/(pad.length*.5*stretch);
 const bowl=Math.exp(-2*(u*u+(v+1/3)**2)),side=(Math.exp(-2.5*(u-1.12)**2)+Math.exp(-2.5*(u+1.12)**2))*Math.exp(-.8*v*v),base=Math.exp(-1.2*u*u-2*(v-1.05)**2);
 return depth*(bowl-.15*(side+base)*(1-Math.exp(-3*(u*u+(v+1/3)**2))));
}
export function stampFingertip(r:{dent:Float32Array;dw:number;dh:number;width:number;height:number},x:number,y:number,pad:FingerPad,depth:number,rate:number,stretch=1){
 for(let yy=0;yy<r.dh;yy++)for(let xx=0;xx<r.dw;xx++){
  const target=fingertipHeight(xx*r.width/r.dw-x,yy*r.height/r.dh-y,pad,depth,stretch),i=yy*r.dw+xx,cur=r.dent[i]??0,delta=target-cur,soft=.002*Math.abs(target);
  r.dent[i]=cur+(target>=0?.5*(delta+Math.sqrt(delta*delta+soft*soft)):.5*(delta-Math.sqrt(delta*delta+soft*soft)))*rate;
 }
}