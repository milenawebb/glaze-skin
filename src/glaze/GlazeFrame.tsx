import { clipCrackPaths, mapShell } from "./damage";
import { useEffect, useRef, useState } from "react";
import { createFrameRenderer, isOnRing, smoothDents, stampDent, type FrameRenderer } from "./frame-gl";
import { playCrack, playCrunch, playShatter, playSquelch } from "./sounds";
import { vibratePress } from "./haptics";
import { dentDepth, dentRadius, faceExpression, frameInsets, pressureScale } from "./touch";

import { breakGlaze, hasGlaze } from "./glaze";

import { prepareShellDebris, cancelShellDebris, createShellBreak, takeShellChips, peelShell, SHELL_BREAK_MS, paintCoating, insideShellPolygon, framePressStage, type ShellBreak } from "./shell";
import { createGlazeStrip, isGlazeDrag, stripWidth } from "./strip";

import { recoverySettings, recoveryFactor, immediateDepth } from "./recovery";
import { settledResize } from "./resize";
import { fingerPad, fingerDepth, stampFingertip, type FingerPad } from "./fingertip";
import type { GlazeColor } from "./preferences";
import { DEFAULT_GLAZE_STYLE, monoStyleAmount, type GlazeStyle } from "./glaze-style";
import { region, resetAmount, RESET_MS, type Region } from "./regions";

interface Press { crackedOnDown:boolean; pad:FingerPad; before:Float32Array; x: number; y: number; origin: {x:number;y:number}; dragging:boolean; pointerType:string; exposed:ShellBreak[]; initialFoam:boolean; start: number; radius: number; pressure: number | null; sound: ((depth: number) => void) | undefined; foam: boolean; spots: {x:number;y:number}[]; flakeDistance:number }

/** WebGL squishy frame. Dents stay until `resetKey` changes. */
export function GlazeFrame({ resetKey, color = "Rainbow", glazeStyle = DEFAULT_GLAZE_STYLE, onFallback }: { resetKey: number; color?: GlazeColor; glazeStyle?: GlazeStyle; onFallback: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FrameRenderer | null>(null);
  const kick = useRef<() => void>(() => {});
  const clearTransient = useRef<() => void>(() => {});
  const resetRef = useRef<{ start: number } | null>(null);
  const damageRef = useRef<{ shape: ShellBreak; hole: boolean; progress: number }[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { const renderer = rendererRef.current; if (renderer) { renderer.mono = monoStyleAmount(glazeStyle); renderer.updatePalette(); kick.current(); } }, [color, glazeStyle, ready]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = createFrameRenderer(canvas);
    if (!r) {
      onFallback();
      return;
    }
    rendererRef.current = r;
    prepareShellDebris();
    setReady(true);
    const presses = new Map<number, Press>();
    let size = { w: 1, h: 1 };
    let raf = 0;
    let resizing = false;
    let released = -1000;
    const breaks: { x: number; y: number; radius: number; start: number; duration: number; shape: ShellBreak }[] = [];

    const cracked: { x:number; y:number; radius:number; shape:ShellBreak; removed:boolean; start:number; drawn:boolean }[]=[];
    let protectedCache:{x:number;y:number;w:number;h:number}[]=[];
    const refreshProtected = () => {
      const bounds=canvas.getBoundingClientRect();
      protectedCache=Array.from(canvas.parentElement?.querySelectorAll<HTMLElement>(".sq-stage")??[]).map(el=>{const b=el.getBoundingClientRect();return {x:b.left-bounds.left-3,y:b.top-bounds.top-3,w:b.width+6,h:b.height+6};});
    };
    const safe = (x:number,y:number) => {
      const insets=frameInsets(size.w);
      return isOnRing(x,y,size.w,size.h,insets) && !protectedCache.some(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
    };
    const damage=damageRef.current;
    const holeBins=new Map<string,ShellBreak[]>();
    const binKey=(x:number,y:number)=>`${Math.floor(x/32)},${Math.floor(y/32)}`;
    const indexHole=(shape:ShellBreak)=>{const points=shape.boundary;if(!points.length)return;const x0=Math.floor(Math.min(...points.map(p=>p.x))*size.w/32),x1=Math.floor(Math.max(...points.map(p=>p.x))*size.w/32),y0=Math.floor(Math.min(...points.map(p=>p.y))*size.h/32),y1=Math.floor(Math.max(...points.map(p=>p.y))*size.h/32);for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const key=`${x},${y}`,items=holeBins.get(key)??[];if(!items.includes(shape))items.push(shape);holeBins.set(key,items);}};
    const intact = (x:number,y:number) => safe(x,y) && hasGlaze(r,x,y) && !(holeBins.get(binKey(x,y))??[]).some(shape=>insideShellPolygon(x/size.w,y/size.h,shape.boundary));
    let replaying=false;
    const paint = (shape:ShellBreak,hole:boolean,progress=1) => {
      if(!hole)shape={...shape,cracks:clipCrackPaths(shape.cracks,intact),arcs:clipCrackPaths(shape.arcs,intact)};
      if(!hole&&!shape.cracks.length&&!shape.arcs.length)return;
      if(!replaying){
        const normalized=mapShell(shape,1/size.w,1/size.h);
        const retained=hole?damage.find(d=>d.hole&&d.shape.boundary.length===normalized.boundary.length&&d.shape.boundary.every((p,i)=>Math.abs(p.x-(normalized.boundary[i]?.x??-1))<1e-9&&Math.abs(p.y-(normalized.boundary[i]?.y??-1))<1e-9)):undefined;
        if(retained)retained.progress=progress;else {damage.push({shape:normalized,hole,progress});if(hole)indexHole(normalized);}
      }
      const ctx=r.coating.getContext("2d");if(!ctx)return;
      const scale=r.coating.width/size.w;
      ctx.save();ctx.scale(scale,scale);ctx.beginPath();ctx.rect(0,0,size.w,size.h);
      for(const b of protectedCache)ctx.rect(b.x,b.y,b.w,b.h);
      ctx.clip("evenodd");ctx.scale(1/scale,1/scale);paintCoating(r.coating,size.w,shape,hole,progress);ctx.restore();
      const points=hole?shape.boundary:[...shape.cracks,...shape.arcs].flat();
      if(points.length)r.dirtyCoating(Math.min(...points.map(p=>p.x))-2,Math.min(...points.map(p=>p.y))-2,Math.max(...points.map(p=>p.x))+2,Math.max(...points.map(p=>p.y))+2);
    };
    const recoveries: { start:number; duration:number; fraction:number; lastFactor:number; bounds:Region|undefined; idx:Int32Array; depth:Float32Array }[]=[];
    const beforePool:Float32Array[]=[];let scanIdx=new Int32Array(512*512),scanDepth=new Float32Array(512*512);
    clearTransient.current=()=>{cancelShellDebris();breaks.length=0;cracked.length=0;recoveries.length=0;damage.length=0;holeBins.clear();pending.length=0;canvas.parentElement?.querySelectorAll(".sq-shell-plate").forEach(p=>p.remove());};
    const loop = (now: number) => {
      raf = 0;
      // CSS stretches the last rendered bitmap; no mask replay or upload mid-resize.
      if(resizing)return;
      refreshProtected();
      const deadline=performance.now()+6;
      while(pending.length&&performance.now()<deadline){const event=pending.shift();if(event)processEvent(event);if(event?.type==="pointermove")break;}
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      r.face = faceExpression(presses.size, now - released, reduce);
      for(let j=recoveries.length-1;j>=0;j--){
        const rec=recoveries[j]; if(!rec)continue;
        const factor=recoveryFactor(now-rec.start,rec.duration,rec.fraction);
        const k=factor-rec.lastFactor,ids=rec.idx,ds=rec.depth;for(let c=0;c<ids.length;c++){const i=ids[c]??0;r.dent[i]=(r.dent[i]??0)+(ds[c]??0)*k;}
        if(rec.bounds)r.dirtyHeight(rec.bounds);
        rec.lastFactor=factor;
        if(now-rec.start>=rec.duration)recoveries.splice(j,1);
      }
      for(const c of cracked) if(!c.removed && !c.drawn){
        paint(mapShell(c.shape,size.w,size.h),false);c.drawn=true;
      }
      for (const p of presses.values()) {
        const held = (now - p.start) / 1000;
        // A click keeps its press-down material choice; only actual drags switch voices.
        p.sound?.(dentDepth(held, p.pressure));
        if(now-p.start<25)continue;
        const radius = p.radius + (p.pressure === null ? Math.min(held, 2) * 3 : 0);
        if(p.foam)stampFingertip(r,p.x,p.y,p.pad,fingerDepth(held,p.pressure),.18,p.dragging?1.6:1);
        else stampDent(r, p.x, p.y, radius, Math.max(immediateDepth(1), dentDepth(held, p.pressure)), 0.18);
        const extent = radius * 2.2;
        smoothDents(r, p.x - extent, p.y - extent, p.x + extent, p.y + extent);
      }
      for (let i = breaks.length - 1; i >= 0; i--) {
        const b = breaks[i];
        if (!b) continue;
        const t = Math.min(1, (now - b.start) / b.duration);
        const shape=mapShell(b.shape,size.w,size.h);
        breakGlaze(r, b.x*size.w, b.y*size.h, b.radius*size.w, Math.min(1,t/.35), shape.boundary);
        paint(shape,true,Math.min(1,t/.35));
        if (t >= .35) breaks.splice(i, 1);
      }
      const rs = resetRef.current;
      if (rs) {
        breaks.length = 0; cracked.length=0; recoveries.length=0;
        r.resetAmount=resetAmount(now-rs.start);
        if(now-rs.start>=RESET_MS){
          r.dent.fill(0);r.glaze.fill(0);r.coating.getContext("2d")?.clearRect(0,0,r.coating.width,r.coating.height);
          r.dirtyHeight(region(r.dw,r.dh,0,0,r.dw-1,r.dh-1));r.dirtyCoating(0,0,size.w,size.h);
          resetRef.current=null;damage.length=0;holeBins.clear();r.resetAmount=1;
        }
      }

      r.render();
      if (pending.length || presses.size || breaks.length || recoveries.length || cracked.some(c=>!c.removed&&!c.drawn) || resetRef.current || r.face > 0 || r.paletteAnimating()) raf = requestAnimationFrame(loop);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    kick.current = schedule;

    const rebuild = () => {
      const rect = canvas.getBoundingClientRect();
      const old=size;
      size = { w: rect.width, h: rect.height };
      for(const p of presses.values()){p.x=p.x/old.w*size.w;p.y=p.y/old.h*size.h;p.origin={x:p.origin.x/old.w*size.w,y:p.origin.y/old.h*size.h};p.spots=p.spots.map(v=>({x:v.x/old.w*size.w,y:v.y/old.h*size.h}));}
      refreshProtected();holeBins.clear();for(const d of damage)if(d.hole)indexHole(d.shape);
      if (snapSize(r, size)) {
        r.coating.getContext("2d")?.clearRect(0,0,r.coating.width,r.coating.height);
        replaying=true;
        for(const d of damage) paint(mapShell(d.shape,size.w,size.h),d.hole,d.progress);
        replaying=false;
        // Upload the freshly replayed normalized maps in this idle task, not RAF.
        r.render();
      }
      resizing=false;schedule();
    };
    const resizeJob=settledResize(rebuild);
    const ro = new ResizeObserver(() => {
      if(size.w===1){rebuild();return;}
      resizing=true;
      cancelAnimationFrame(raf);raf=0;
      resizeJob.schedule();
    });
    const snapSize = (rr: FrameRenderer, s: { w: number; h: number }) => {
      if (s.w < 2 || s.h < 2) return false;
      const parent = canvas.parentElement;
      if (!parent) return false;
      const css = getComputedStyle(parent);
      rr.resize(s.w, s.h, { l: parseFloat(css.paddingLeft), t: parseFloat(css.paddingTop), r: parseFloat(css.paddingRight), b: parseFloat(css.paddingBottom) });
      return true;
    };
    ro.observe(canvas);

    const local = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const crack = (x:number,y:number) => {
      if(!safe(x,y))return "foam";
      const existing=cracked.find(c=>insideShellPolygon(x/size.w,y/size.h,c.shape.boundary));
      if(framePressStage(intact(x,y),Boolean(existing))==="foam")return "foam";
      if(existing){
        const before=new Set(existing.shape.removed);
        const pixelShape=mapShell(existing.shape,size.w,size.h);
        const plates=takeShellChips(pixelShape,x,y).filter(poly=>{
          if(poly.every(p=>safe(p.x,p.y))&&poly.some(p=>intact(p.x,p.y)))return true;
          const index=pixelShape.plates.indexOf(poly);if(!before.has(index))existing.shape.removed.delete(index);
          return false;
        });
        if(!plates.length)return "cracked";
        const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        for(const poly of plates){
          const shape={...pixelShape,boundary:poly,plates:[poly]};
          if(reduce){breakGlaze(r,existing.x*size.w,existing.y*size.h,existing.radius*size.w,1,poly);paint(shape,true);}
          else {
          const layer=canvas.parentElement?.querySelector<HTMLElement>(".sq-flakes");
          if(layer)peelShell(layer,r.snapshot(existing.x*size.w,existing.y*size.h,existing.radius*size.w),shape,existing.x*size.w,existing.y*size.h,existing.radius*size.w);
          breaks.push({x:existing.x,y:existing.y,radius:existing.radius,start:performance.now(),duration:SHELL_BREAK_MS,shape:mapShell(shape,1/size.w,1/size.h)});
          }
        }
        playShatter();return "shatter";
      }
      const radius=60;
      cracked.push({x:x/size.w,y:y/size.h,radius:radius/size.w,shape:mapShell(createShellBreak(x,y,radius),1/size.w,1/size.h),removed:false,start:performance.now(),drawn:false});
      playCrack();
      return "crack";
    };
    const down = (e: PointerEvent) => {
      if(resizing)return;
      const { x, y } = local(e);
      if (!isOnRing(x, y, size.w, size.h, frameInsets(size.w))) return;

      const pressure = pressureScale(e);
      // A new press owns these cells; an older rise must not pull against it.
      const inv=1/(2*Math.pow(dentRadius(e.pointerType)*2.5,2));for(const rec of recoveries){const ids=rec.idx,ds=rec.depth;for(let c=0;c<ids.length;c++){const i=ids[c]??0,dx=(i%r.dw)/r.dw*size.w-x,dy=Math.floor(i/r.dw)/r.dh*size.h-y;ds[c]=(ds[c]??0)*(1-Math.exp(-(dx*dx+dy*dy)*inv));}}
      const foam=!intact(x,y);
      const radius=dentRadius(e.pointerType);
      const before=beforePool.pop()??new Float32Array(r.dent.length);before.set(r.dent);
      const pad=fingerPad(e.pointerType);
      if(foam)stampFingertip(r,x,y,pad,fingerDepth(0,pressure),1);else stampDent(r,x,y,radius,immediateDepth(1),1);
      smoothDents(r,x-radius*2.2,y-radius*2.2,x+radius*2.2,y+radius*2.2);
      // Fresh glaze shows its first crack lines immediately; click vs drag only decides what follows.
      const crackedOnDown=!foam&&!cracked.some(c=>insideShellPolygon(x/size.w,y/size.h,c.shape.boundary))&&crack(x,y)==="crack";
      presses.set(e.pointerId, { crackedOnDown,pad,before,x, y, origin:{x,y},dragging:false,pointerType:e.pointerType,exposed:damage.filter(d=>d.hole).map(d=>d.shape),initialFoam:foam,start: e.timeStamp, radius, pressure, sound: foam?playSquelch(immediateDepth(1)):undefined, foam, spots:[{x,y}],flakeDistance:20 });
      resetRef.current = null;r.resetAmount=1;

      vibratePress();
      schedule();
    };
    const move = (e: PointerEvent) => {
      const p = presses.get(e.pointerId);
      if (!p) return;
      let { x, y } = local(e);
      const remaining=Math.hypot(x-p.x,y-p.y);
      if(remaining>9){const t=9/remaining;x=p.x+(x-p.x)*t;y=p.y+(y-p.y)*t;pending.unshift(e);}
      const held = (performance.now() - p.start) / 1000;
      p.pressure = pressureScale(e);
      const depth = dentDepth(held, p.pressure);
      const dist = Math.hypot(x - p.x, y - p.y);
      if(!p.dragging&&isGlazeDrag(p.origin,{x,y})){
        p.dragging=true;
        // Include all the initial jitter once the gesture becomes a drag.
        p.x=p.origin.x;p.y=p.origin.y;
      }
      if(p.dragging){
        const distance=Math.hypot(x-p.x,y-p.y),samples=Math.max(1,Math.ceil(distance/5)),width=stripWidth(p.pointerType);
        let previous={x:p.x,y:p.y};
        for(let i=1;i<=samples;i++){
          const t=i/samples,point={x:p.x+(x-p.x)*t,y:p.y+(y-p.y)*t};
          if(!safe(point.x,point.y)){previous=point;continue;}
          const shape=createGlazeStrip(previous,point,width);
          const glazed=!p.exposed.some(shape=>insideShellPolygon(point.x/size.w,point.y/size.h,shape.boundary));
          if(glazed){
            p.sound=undefined;playCrunch();p.flakeDistance+=distance/samples;
            if(p.flakeDistance>=12&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
              const layer=canvas.parentElement?.querySelector<HTMLElement>(".sq-flakes");
              const chips=shape.boundary.filter(v=>intact(v.x,v.y)).slice(0,3).map(v=>{
                const dx=v.x-point.x,dy=v.y-point.y,length=Math.hypot(dx,dy)||1;
                const center={x:v.x+dx/length*3,y:v.y+dy/length*3};
                return createGlazeStrip(center,{x:center.x+2,y:center.y+1},5).boundary;
              }).filter(poly=>poly.every(v=>safe(v.x,v.y)));
              if(layer&&chips.length)peelShell(layer,r.snapshot(point.x,point.y,width),{...shape,plates:chips},point.x,point.y,width);
              p.flakeDistance=0;
            }
            // The vector swath is retained even where it passes beneath frame buttons.
            breakGlaze(r,point.x,point.y,width,1,shape.boundary);paint(shape,true);
          }else if(!p.foam||!p.sound)p.sound=playSquelch(depth);
          p.foam=!glazed;previous=point;
        }
      }
      const steps = Math.max(1, Math.ceil(dist / 3));
      if(p.dragging&&dist>0)p.pad.angle=Math.atan2(y-p.y,x-p.x)-Math.PI/2;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const px=p.x+(x-p.x)*t,py=p.y+(y-p.y)*t;
        if(!intact(px,py))stampFingertip(r,px,py,p.pad,fingerDepth(held,p.pressure),1,p.dragging?1.6:1);
        else stampDent(r,px,py,p.radius-1,depth*.85,1);
      }
      const extent = p.radius * 2.2;
      smoothDents(r, Math.min(p.x, x) - extent, Math.min(p.y, y) - extent, Math.max(p.x, x) + extent, Math.max(p.y, y) + extent);
      p.spots.push({x,y});
      p.x = x;
      p.y = y;
      schedule();
    };
    const up = (e: PointerEvent) => {
      const press=presses.get(e.pointerId);
      if (press && presses.delete(e.pointerId)) {
        if(e.type==="pointerup"&&!press.dragging&&!press.initialFoam&&!press.crackedOnDown)crack(press.origin.x,press.origin.y);
        const settings=recoverySettings();
        // Recover the complete smooth contribution, including its tails, not a disc.
        let bounds:Region|null=null,n=0;
        const radius=press.pad.length*5;const area=region(r.dw,r.dh,(Math.min(...press.spots.map(p=>p.x))-radius)*r.dw/size.w,(Math.min(...press.spots.map(p=>p.y))-radius)*r.dh/size.h,(Math.max(...press.spots.map(p=>p.x))+radius)*r.dw/size.w,(Math.max(...press.spots.map(p=>p.y))+radius)*r.dh/size.h);
        let bx0=r.dw,by0=r.dh,bx1=-1,by1=-1;const before=press.before;
        for(let y=area.y0;y<=area.y1;y++)for(let x=area.x0;x<=area.x1;x++){const i=y*r.dw+x;const depth=(r.dent[i]??0)-(before[i]??0);if(depth!==0){scanIdx[n]=i;scanDepth[n++]=depth;if(x<bx0)bx0=x;if(x>bx1)bx1=x;if(y<by0)by0=y;if(y>by1)by1=y;}}
        if(n)bounds={x0:bx0,y0:by0,x1:bx1,y1:by1};
        beforePool.push(before);
        recoveries.push({start:performance.now(),...settings,lastFactor:1,bounds:bounds??undefined,idx:scanIdx.slice(0,n),depth:scanDepth.slice(0,n)});
        if (!presses.size) released = performance.now();
        schedule();
      }
    };
    // Handlers enqueue only input; all mutation runs in the next frame.
    const pending:PointerEvent[]=[];
    const processEvent=(e:PointerEvent)=>{if(e.type==="pointerdown")down(e);else if(e.type==="pointermove")move(e);else up(e);};
    const queue=(e:PointerEvent)=>{
      if(e.target instanceof Element && e.target.closest('button, [data-glaze-control]'))return;
      if(e.type==="pointerdown"){
        const {x,y}=local(e);if(!isOnRing(x,y,size.w,size.h,frameInsets(size.w)))return;
        e.preventDefault();canvas.setPointerCapture?.(e.pointerId);
      }
      if(e.type==="pointermove"){
        const last=pending.at(-1);
        if(last?.type==="pointermove"&&last.pointerId===e.pointerId)pending.pop();
      }
      pending.push(e);schedule();
    };
    canvas.addEventListener("pointerdown", queue);
    canvas.addEventListener("pointermove", queue);
    canvas.addEventListener("pointerup", queue);
    canvas.addEventListener("pointercancel", queue);
    canvas.addEventListener("lostpointercapture", queue);
    return () => {
      ro.disconnect();
      resizeJob.cancel();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", queue);
      canvas.removeEventListener("pointermove", queue);
      canvas.removeEventListener("pointerup", queue);
      canvas.removeEventListener("pointercancel", queue);
      canvas.removeEventListener("lostpointercapture", queue);
      r.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r || resetKey === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      clearTransient.current();
      r.dent.fill(0);
      r.glaze.fill(0);
      r.coating.getContext("2d")?.clearRect(0,0,r.coating.width,r.coating.height);
      r.dirtyHeight(region(r.dw,r.dh,0,0,r.dw-1,r.dh-1));r.dirtyCoating(0,0,r.width,r.height);r.resetAmount=1;
      resetRef.current = null;
    } else {
      clearTransient.current();
      resetRef.current = { start: performance.now() };
    }
    kick.current();
  }, [resetKey]);

  return <canvas ref={canvasRef} className="sq-canvas" data-ready={ready || undefined} aria-hidden="true" />;
}
