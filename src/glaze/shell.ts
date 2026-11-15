/** Crack paths are generated once and shared by the mask and removable chips. */
export interface ShellPoint { x: number; y: number }
export interface ShellBreak { boundary: ShellPoint[]; plates: ShellPoint[][]; cracks: ShellPoint[][]; arcs: ShellPoint[][]; removed: Set<number> }
export const SHELL_BREAK_MS = 600;
export function framePressStage(glazed: boolean, cracked: boolean) { return !glazed ? "foam" : cracked ? "shatter" : "crack"; }

function jagged(a: ShellPoint, b: ShellPoint, random: () => number, bend = 1.5) {
  const length = Math.hypot(b.x-a.x,b.y-a.y), steps = Math.max(2,Math.ceil(length/(4+random()*4)));
  return Array.from({length:steps+1},(_,i)=>{
    const t=i/steps, jitter=i===0||i===steps?0:(random()-.5)*bend*2;
    return {x:a.x+(b.x-a.x)*t-(b.y-a.y)/length*jitter,y:a.y+(b.y-a.y)*t+(b.x-a.x)/length*jitter};
  });
}
export function createShellBreak(x: number, y: number, radius: number, random = Math.random): ShellBreak {
  const count=5+Math.min(3,Math.floor(random()*4)), offset=random()*Math.PI*2, center={x,y};
  const rays=Array.from({length:count},(_,i)=>{
    const angle=offset+(i+(random()-.5)*.35)*Math.PI*2/count;
    const length=20+random()*Math.min(40,Math.max(0,radius-20));
    return jagged(center,{x:x+Math.cos(angle)*length,y:y+Math.sin(angle)*length},random);
  });
  const cracks=[...rays];
  rays.forEach((ray,i)=>{if(i%3!==0)return;const start=ray[Math.floor(ray.length*.55)], end=ray.at(-1);if(!start||!end)return;cracks.push(jagged(start,{x:start.x+(end.x-start.x)*.35-(end.y-start.y)*.5,y:start.y+(end.y-start.y)*.35+(end.x-start.x)*.5},random));});
  const arcs:ShellPoint[][]=[], plates:ShellPoint[][]=[];
  const inner=rays.map(ray=>ray[Math.max(1,Math.floor((ray.length-1)*.45))]??center);
  for(let i=0;i<count;i++){
    const ray=rays[i], next=rays[(i+1)%count], a=inner[i], b=inner[(i+1)%count];if(!ray||!next||!a||!b)continue;
    const arc=jagged(a,b,random,1.2), outer=jagged(ray.at(-1)??a,next.at(-1)??b,random,2.5);
    const ai=ray.indexOf(a), bi=next.indexOf(b);
    plates.push([...ray.slice(0,ai+1),...arc.slice(1),...next.slice(0,bi).reverse()]);
    plates.push([...ray.slice(ai),...outer.slice(1),...next.slice(bi).reverse(),...arc.slice().reverse()]);
    // Two incomplete arc runs: gaps prevent a closed spider-web outline.
    if(i!==0&&i!==Math.floor(count/2)){
      // Leave a small open gap at one radial junction: no triangle closes.
      const open=arc.slice(1,-1);if(open.length>1)arcs.push(open);
    }
  }
  const boundary=rays.flatMap((ray,i)=>jagged(ray.at(-1)??center,rays[(i+1)%count]?.at(-1)??center,random,2.5));
  return {boundary,plates,cracks,arcs,removed:new Set()};
}
export function insideShellPolygon(x: number, y: number, poly: ShellPoint[]) {
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];if(a&&b&&(a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
/** Only one to three still-attached chips nearest the actual press are removed. */
export function takeShellChips(shape: ShellBreak,x:number,y:number,random=Math.random) {
  const first=shape.removed.size===0;
  const count=(first?2:1)+Math.min(first?1:2,Math.floor(random()*(first?2:3)));
  const distance=(poly:ShellPoint[])=>Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length]??a;const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(a.x+t*dx-x,a.y+t*dy-y);}));
  const candidates=shape.plates.map((poly,index)=>({poly,index,distance:distance(poly)})).filter(p=>!shape.removed.has(p.index));
  candidates.sort((a,b)=>Number(insideShellPolygon(x,y,b.poly))-Number(insideShellPolygon(x,y,a.poly))||a.distance-b.distance);
  const nearby=candidates.filter(p=>insideShellPolygon(x,y,p.poly)||p.distance<5);
  const extent=(items:typeof candidates)=>{const points=items.flatMap(p=>p.poly);return Math.max(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)));};
  if(first&&nearby.length>1){const anchor=nearby[0];if(anchor)nearby.sort((a,b)=>extent([anchor,b])-extent([anchor,a]));}
  const touching=nearby.slice(0,count);
  if(first){
    const span=()=>{const points=touching.flatMap(p=>p.poly);return Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))>=20||Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))>=20;};
    for(const next of candidates){
      if(touching.length>=2&&span())break;
      if(!touching.includes(next)&&touching.length<3)touching.push(next);
    }
    if(!span()){
      const anchor=touching.slice(0,-1);
      const larger=candidates.filter(p=>!anchor.includes(p)).sort((a,b)=>extent([...anchor,b])-extent([...anchor,a]))[0];
      if(larger)touching.splice(touching.length-1,1,larger);
    }
  }
  touching.forEach(p=>shape.removed.add(p.index));return touching.map(p=>p.poly);
}
export function createCrackTrail(a:ShellPoint,b:ShellPoint,random=Math.random) {
  const path=jagged(a,b,random), cracks=[path];
  const length=Math.hypot(b.x-a.x,b.y-a.y),spacing=15+random()*10;
  for(let d=spacing;d<length;d+=spacing){const t=d/length,start={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};cracks.push(jagged(start,{x:start.x-(b.y-a.y)/length*(7+random()*6),y:start.y+(b.x-a.x)/length*(7+random()*6)},random));}
  return {boundary:[],plates:[],cracks,arcs:[],removed:new Set<number>()};
}
/** Textured chips preserve the original crack geometry and material. */
export function peelShell(layer: HTMLElement,image:HTMLCanvasElement,shape:ShellBreak,x:number,y:number,radius:number) {
  for(const [i,poly] of shape.plates.entries()){
    const piece=document.createElement("canvas");piece.className="sq-shell-plate";piece.width=image.width;piece.height=image.height;
    piece.style.width=`${radius*2}px`;piece.style.height=`${radius*2}px`;piece.style.left=`${x-radius}px`;piece.style.top=`${y-radius}px`;
    const ctx=piece.getContext("2d");if(!ctx||!poly.length)continue;
    ctx.scale(image.width/(radius*2),image.height/(radius*2));ctx.beginPath();poly.forEach((p,j)=>j===0?ctx.moveTo(p.x-x+radius,p.y-y+radius):ctx.lineTo(p.x-x+radius,p.y-y+radius));ctx.closePath();ctx.clip();ctx.drawImage(image,0,0,radius*2,radius*2);layer.appendChild(piece);
    const direction=(i-(shape.plates.length-1)/2)*9;
    const anim=piece.animate([{transform:"translate(0,0) rotateX(0deg) rotate(0deg)",opacity:1},{transform:`translate(${direction*.25}px,-7px) rotateX(24deg) rotate(${direction*.3}deg)`,opacity:1,offset:.35},{transform:`translate(${direction}px,64px) rotateX(55deg) rotate(${direction*2}deg)`,opacity:0}],{duration:SHELL_BREAK_MS,easing:"cubic-bezier(.3,.15,.65,1)",fill:"forwards"});anim.onfinish=()=>piece.remove();
  }
}
/** Red holes and green fissures, rasterized only when damage changes. */
export function paintCoating(canvas:HTMLCanvasElement,width:number,shape:ShellBreak,hole:boolean,progress=1) {
 const ctx=canvas.getContext("2d");if(!ctx)return;ctx.save();ctx.scale(canvas.width/width,canvas.width/width);
 if(hole){ctx.globalCompositeOperation="source-over";ctx.fillStyle=`rgb(${Math.round(255*progress)},0,0)`;ctx.beginPath();shape.boundary.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();}
 else {ctx.strokeStyle="rgb(0,255,0)";ctx.lineJoin="round";ctx.lineCap="round";for(const path of [...shape.cracks,...shape.arcs])for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(!a||!b)continue;ctx.lineWidth=.14+.65*(1-i/path.length);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
 ctx.restore();
 if(hole&&shape.boundary.length){
   const scale=canvas.width/width;
   const x=Math.max(0,Math.floor(Math.min(...shape.boundary.map(p=>p.x))*scale)-2),y=Math.max(0,Math.floor(Math.min(...shape.boundary.map(p=>p.y))*scale)-2);
   const w=Math.min(canvas.width-x,Math.ceil(Math.max(...shape.boundary.map(p=>p.x))*scale)+2-x),h=Math.min(canvas.height-y,Math.ceil(Math.max(...shape.boundary.map(p=>p.y))*scale)+2-y);
   if(w>0&&h>0){const image=ctx.getImageData(x,y,w,h);for(let i=0;i<image.data.length;i+=4)if((image.data[i]??0)>=128)image.data[i+1]=0;ctx.putImageData(image,x,y);}
 }
}
