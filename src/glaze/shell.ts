import { coarsePointer, flyingLimit } from "./touch";
/** Crack paths are generated once and shared by the mask and removable chips. */
export interface ShellPoint { x: number; y: number }
export interface ShellBreak { boundary: ShellPoint[]; plates: ShellPoint[][]; cracks: ShellPoint[][]; arcs: ShellPoint[][]; removed: Set<number> }
export const SHELL_BREAK_MS = 600;
export const MAX_FLYING_PIECES = 40;
export function pieceMotion(crumb:boolean,random=Math.random){
  return {duration:400+random()*700,dx:(random()-.5)*(crumb?240:100),dy:40+random()*100,lift:random()<.65?4+random()*24:0,spin:(random()-.5)*640,tilt:random()<.3?20+random()*35:random()*12,thickness:crumb?.3+random()*.6:.6+random()*4};
}
/** Three to nine primary sides, each bent and jittered, with slivers and bites. */
export function debrisPolygon(center:ShellPoint,radius:number,index:number,random=Math.random){
  const sides=3+Math.min(6,Math.floor(random()*7)),angle=random()*Math.PI*2;
  const sliver=index%4===1,vertices=Array.from({length:sides},(_,i)=>{
    const a=angle+i*Math.PI*2/sides,r=radius*(.65+random()*.35)*(i===1&&index%3===0?.35:1);
    return {x:center.x+Math.cos(a)*r*(sliver?1.6:1),y:center.y+Math.sin(a)*r*(sliver?.3:1)};
  });
  return vertices.flatMap((a,i)=>jagged(a,vertices[(i+1)%sides]??a,random,radius*.12));
}
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
  const inner=rays.map((ray,i)=>ray[Math.max(1,Math.floor((ray.length-1)*(.2+(i%3)*.2+random()*.15)))]??center);
  for(let i=0;i<count;i++){
    const ray=rays[i], next=rays[(i+1)%count], a=inner[i], b=inner[(i+1)%count];if(!ray||!next||!a||!b)continue;
    const arc=jagged(a,b,random,2.2), outer=jagged(ray.at(-1)??a,next.at(-1)??b,random,3.5);
    if(arc.length===3){const midpoint=arc[1];if(midpoint)arc.splice(1,0,{x:(a.x+midpoint.x)*.5,y:(a.y+midpoint.y)*.5});}
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
/** Mixed debris clips to removed chips, retaining the original shell material. */
export function peelShell(layer: HTMLElement,image:HTMLCanvasElement,shape:ShellBreak,x:number,y:number,radius:number) {
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const polygons=shape.plates.filter(poly=>poly.length>2);
  const generation=debrisGeneration;
  const jobs=debrisJobs;
  for(const poly of polygons){
    const center={x:poly.reduce((n,p)=>n+p.x,0)/poly.length,y:poly.reduce((n,p)=>n+p.y,0)/poly.length};
    const span=Math.max(Math.max(...poly.map(p=>p.x))-Math.min(...poly.map(p=>p.x)),Math.max(...poly.map(p=>p.y))-Math.min(...poly.map(p=>p.y)));
    // One substantial chunk, three midsize flakes, and eight crumbs/dust specks.
    // Phones: one chunk, one flake and one crumb, drawn as plain few-sided shapes.
    const phone=coarsePointer();
    for(const i of phone?[0,1,4]:[0,1,2,3,4,5,6,7,8,9,10,11]){
      jobs.push(()=>{if(generation!==debrisGeneration||!layer.isConnected)return;
      const flying=layer.getElementsByClassName("sq-shell-plate");const cap=flyingLimit(coarsePointer());while(flying.length>=cap){const oldest=flying[0] as HTMLCanvasElement|undefined;if(!oldest)break;oldest.getAnimations().forEach(a=>a.cancel());recyclePiece(oldest);}
      const crumb=i>=4,size=i===0?span*.44:i<4?span*(.1+Math.random()*.12):.35+Math.random()*2;
      let origin=center;
      if(i>0){for(let attempt=0;attempt<20;attempt++){const candidate={x:center.x+(Math.random()-.5)*span,y:center.y+(Math.random()-.5)*span};if(insideShellPolygon(candidate.x,candidate.y,poly)){origin=candidate;break;}}}
      const prepared=phone?{shape:simpleShape(i),motion:pieceMotion(crumb)}:piecePool[i]?.shift();
      const fragment=prepared?prepared.shape.map(p=>({x:origin.x+p.x*size,y:origin.y+p.y*size})):debrisPolygon(origin,size,i),motion=prepared?.motion??pieceMotion(crumb);
      prepareShellDebris();
      const left=Math.min(...fragment.map(p=>p.x))-1,top=Math.min(...fragment.map(p=>p.y))-1;
      const w=Math.max(2,Math.max(...fragment.map(p=>p.x))-left+1),h=Math.max(2,Math.max(...fragment.map(p=>p.y))-top+1);
      const piece=canvasPool.pop()??document.createElement("canvas");piece.className="sq-shell-plate";piece.removeAttribute("style");piece.dataset['debris']=crumb?"crumb":i===0?"chunk":"flake";
      const scale=crumb?1:Math.min(2,image.width/(radius*2));piece.width=Math.ceil(w*scale);piece.height=Math.ceil(h*scale);
      piece.style.width=`${w}px`;piece.style.height=`${h}px`;piece.style.left=`${left}px`;piece.style.top=`${top}px`;piece.style.setProperty("--sq-piece-thickness",`${motion.thickness}px`);piece.style.transformOrigin=`${Math.random()*100}% ${Math.random()*100}%`;
      const ctx=piece.getContext("2d");if(!ctx)return;ctx.scale(scale,scale);
      const clip=(points:ShellPoint[])=>{ctx.beginPath();points.forEach((p,j)=>j===0?ctx.moveTo(p.x-left,p.y-top):ctx.lineTo(p.x-left,p.y-top));ctx.closePath();ctx.clip();};
      clip(poly);clip(fragment);ctx.drawImage(image,x-radius-left,y-radius-top,radius*2,radius*2);layer.appendChild(piece);
      const anim=piece.animate([{transform:"translate(0,0) rotateX(0deg) rotate(0deg)",opacity:1},{transform:`translate(${motion.dx*.25}px,${-motion.lift}px) rotateX(${motion.tilt}deg) rotate(${motion.spin*.2}deg)`,opacity:1,offset:.25},{transform:`translate(${motion.dx}px,${motion.dy}px) rotateX(${motion.tilt*2}deg) rotate(${motion.spin}deg)`,opacity:0}],{duration:motion.duration,easing:"cubic-bezier(.3,.15,.65,1)",fill:"forwards"});anim.onfinish=()=>recyclePiece(piece);
      if(coarsePointer())trackPhonePiece(piece,layer,anim,left,top,w,h,motion);
      });
    }
  }
  // The first few pieces appear in this frame; the rest follow over the next frames.
  runDebris(1);scheduleDebris();
}
function simpleShape(i:number){const sides=4+(i%2),a=Math.random()*Math.PI*2;return Array.from({length:sides},(_,k)=>{const t=a+k*Math.PI*2/sides,r=.7+Math.random()*.3;return {x:Math.cos(t)*r,y:Math.sin(t)*r};});}
const canvasPool:HTMLCanvasElement[]=[];
const phonePieces=new Map<HTMLCanvasElement,{layer:HTMLElement;anim:Animation;left:number;top:number;w:number;h:number;motion:ReturnType<typeof pieceMotion>}>();
let cleanupFrame=0;
function trackPhonePiece(piece:HTMLCanvasElement,layer:HTMLElement,anim:Animation,left:number,top:number,w:number,h:number,motion:ReturnType<typeof pieceMotion>){
  phonePieces.set(piece,{layer,anim,left,top,w,h,motion});
  if(!cleanupFrame)cleanupFrame=requestAnimationFrame(cleanPhonePieces);
}
function cleanPhonePieces(){
  cleanupFrame=0;
  for(const [piece,p] of phonePieces){
    const progress=p.anim.effect?.getComputedTiming().progress;
    if(typeof progress!=="number")continue;
    const first=progress<.25,t=first?progress/.25:(progress-.25)/.75;
    const dx=p.motion.dx*(first?t*.25:.25+t*.75),dy=first?-p.motion.lift*t:-p.motion.lift+(p.motion.dy+p.motion.lift)*t;
    const margin=Math.hypot(p.w,p.h);
    if(p.left+dx+margin<0||p.left+dx-margin>p.layer.clientWidth||p.top+dy+margin<0||p.top+dy-margin>p.layer.clientHeight){p.anim.cancel();recyclePiece(piece);}
  }
  if(phonePieces.size)cleanupFrame=requestAnimationFrame(cleanPhonePieces);
}
function recyclePiece(piece:HTMLCanvasElement){phonePieces.delete(piece);piece.remove();if(!canvasPool.includes(piece)&&canvasPool.length<MAX_FLYING_PIECES)canvasPool.push(piece);}
function runDebris(max:number){const start=performance.now();let count=0;while(debrisJobs.length&&count<max&&performance.now()-start<4){debrisJobs.shift()?.();count++;}}
const piecePool=Array.from({length:12},()=>[] as {shape:ShellPoint[];motion:ReturnType<typeof pieceMotion>}[]);
let preparation=0;
export function prepareShellDebris(){if(preparation)return;preparation=requestAnimationFrame(()=>{preparation=0;const start=performance.now();for(let i=0;i<12;i++){const pool=piecePool[i];if(pool&&pool.length<8)pool.push({shape:debrisPolygon({x:0,y:0},1,i),motion:pieceMotion(i>=4)});if(performance.now()-start>1)break;}if(piecePool.some(p=>p.length<8))prepareShellDebris();});}
let debrisGeneration=0,debrisFrame=0;
const debrisJobs:(()=>void)[]=[];
function scheduleDebris(){if(debrisFrame)return;debrisFrame=requestAnimationFrame(()=>{debrisFrame=0;runDebris(3);if(debrisJobs.length)scheduleDebris();});}
export function cancelShellDebris(){debrisGeneration++;debrisJobs.length=0;cancelAnimationFrame(debrisFrame);debrisFrame=0;cancelAnimationFrame(cleanupFrame);cleanupFrame=0;for(const [piece,p] of phonePieces){p.anim.cancel();recyclePiece(piece);}}
/** Red holes and green fissures, rasterized only when damage changes. */
export function paintCoating(canvas:HTMLCanvasElement,width:number,shape:ShellBreak,hole:boolean,progress=1) {
 const ctx=canvas.getContext("2d");if(!ctx)return;ctx.save();ctx.scale(canvas.width/width,canvas.width/width);
 if(hole){ctx.globalCompositeOperation="source-over";ctx.fillStyle=`rgb(${Math.round(255*progress)},0,0)`;ctx.beginPath();tornOutline(shape.boundary).forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();
   // A thin same-colour edge stroke covers antialiased fissure pixels: no readback needed.
   ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=width/canvas.width;ctx.lineJoin="round";ctx.stroke();}
 else {ctx.strokeStyle="rgb(0,255,0)";ctx.lineJoin="round";ctx.lineCap="round";for(const path of [...shape.cracks,...shape.arcs])for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(!a||!b)continue;ctx.lineWidth=.14+.65*(1-i/path.length);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
 ctx.restore();
}

const tornHash=(x:number,y:number)=>{const v=Math.sin(x*12.9898+y*78.233)*43758.5453;return v-Math.floor(v);};
/** Breaks long straight edges into small notches; seeded by position so resize replay draws the same tear. */
export function tornOutline(points:ShellPoint[],step=4,depth=1.6):ShellPoint[]{
  if(points.length<3)return points;const out:ShellPoint[]=[];
  for(let i=0;i<points.length;i++){const a=points[i]!,b=points[(i+1)%points.length]!,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);out.push(a);if(len<step*1.5)continue;
    const n=Math.floor(len/step),nx=-dy/len,ny=dx/len;
    for(let k=1;k<n;k++){const t=k/n,px=a.x+dx*t,py=a.y+dy*t,h=tornHash(Math.round(px*2)/2,Math.round(py*2)/2),o=(h-.5)*2*depth*(h>.85?1.8:1);out.push({x:px+nx*o,y:py+ny*o});}}
  return out;
}
