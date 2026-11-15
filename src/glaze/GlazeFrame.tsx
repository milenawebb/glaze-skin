import { clipCrackPaths, mapShell } from "./damage";
import { useEffect, useRef, useState } from "react";
import { createFrameRenderer, isOnRing, smoothDents, stampDent, type FrameRenderer } from "./frame-gl";
import { playCrack, playCrunch, playShatter, playSquelch } from "./sounds";
import { vibratePress } from "./haptics";
import { dentDepth, dentRadius, faceExpression, frameInsets, pressureScale } from "./touch";

import { breakGlaze, hasGlaze } from "./glaze";

import { createShellBreak, takeShellChips, peelShell, SHELL_BREAK_MS, paintCoating, insideShellPolygon, framePressStage, type ShellBreak } from "./shell";
import { createGlazeStrip, isGlazeDrag, stripWidth } from "./strip";

import { recoverySettings, recoveryFactor, immediateDepth } from "./recovery";
import { settledResize } from "./resize";
import type { GlazeColor } from "./preferences";
import { DEFAULT_GLAZE_STYLE, monoStyleAmount, type GlazeStyle } from "./glaze-style";
const RESET_MS = 1500;

interface Press { before:Float32Array; x: number; y: number; origin: {x:number;y:number}; dragging:boolean; pointerType:string; exposed:ShellBreak[]; initialFoam:boolean; start: number; radius: number; pressure: number | null; sound: ((depth: number) => void) | undefined; foam: boolean; spots: {x:number;y:number}[]; flakeDistance:number }

/** WebGL squishy frame. Dents stay until `resetKey` changes. */
export function GlazeFrame({ resetKey, color = "Rainbow", glazeStyle = DEFAULT_GLAZE_STYLE, onFallback }: { resetKey: number; color?: GlazeColor; glazeStyle?: GlazeStyle; onFallback: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FrameRenderer | null>(null);
  const kick = useRef<() => void>(() => {});
  const clearTransient = useRef<() => void>(() => {});
  const resetRef = useRef<{ start: number; snap: Float32Array; glaze: Float32Array; damage: { shape: ShellBreak; hole: boolean; progress: number }[] } | null>(null);
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
    setReady(true);
    const presses = new Map<number, Press>();
    let size = { w: 1, h: 1 };
    let raf = 0;
    let resizing = false;
    let released = -1000;
    const breaks: { x: number; y: number; radius: number; start: number; duration: number; shape: ShellBreak }[] = [];

    const cracked: { x:number; y:number; radius:number; shape:ShellBreak; removed:boolean; start:number; drawn:boolean }[]=[];
    const protectedRects = () => {
      const bounds=canvas.getBoundingClientRect();
      return Array.from(canvas.parentElement?.querySelectorAll<HTMLElement>(".sq-stage")??[]).map(el=>{const b=el.getBoundingClientRect();return {x:b.left-bounds.left-3,y:b.top-bounds.top-3,w:b.width+6,h:b.height+6};});
    };
    const safe = (x:number,y:number) => {
      const insets=frameInsets(size.w);
      return isOnRing(x,y,size.w,size.h,insets) && !protectedRects().some(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
    };
    const damage=damageRef.current;
    const intact = (x:number,y:number) => safe(x,y) && hasGlaze(r,x,y) && !damage.some(d=>d.hole&&insideShellPolygon(x/size.w,y/size.h,d.shape.boundary));
    let replaying=false;
    const paint = (shape:ShellBreak,hole:boolean,progress=1) => {
      if(!hole)shape={...shape,cracks:clipCrackPaths(shape.cracks,intact),arcs:clipCrackPaths(shape.arcs,intact)};
      if(!hole&&!shape.cracks.length&&!shape.arcs.length)return;
      if(!replaying){
        const normalized=mapShell(shape,1/size.w,1/size.h);
        const retained=hole?damage.find(d=>d.hole&&d.shape.boundary.length===normalized.boundary.length&&d.shape.boundary.every((p,i)=>Math.abs(p.x-(normalized.boundary[i]?.x??-1))<1e-9&&Math.abs(p.y-(normalized.boundary[i]?.y??-1))<1e-9)):undefined;
        if(retained)retained.progress=progress;else damage.push({shape:normalized,hole,progress});
      }
      const ctx=r.coating.getContext("2d");if(!ctx)return;
      const scale=r.coating.width/size.w;
      ctx.save();ctx.scale(scale,scale);ctx.beginPath();ctx.rect(0,0,size.w,size.h);
      for(const b of protectedRects())ctx.rect(b.x,b.y,b.w,b.h);
      ctx.clip("evenodd");ctx.scale(1/scale,1/scale);paintCoating(r.coating,size.w,shape,hole,progress);ctx.restore();
    };
    const recoveries: { start:number; duration:number; fraction:number; lastFactor:number; cells:{i:number;depth:number}[] }[]=[];
    clearTransient.current=()=>{breaks.length=0;cracked.length=0;recoveries.length=0;damage.length=0;canvas.parentElement?.querySelectorAll(".sq-shell-plate").forEach(p=>p.remove());};
    const loop = (now: number) => {
      raf = 0;
      // CSS stretches the last rendered bitmap; no mask replay or upload mid-resize.
      if(resizing)return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      r.face = faceExpression(presses.size, now - released, reduce);
      for(let j=recoveries.length-1;j>=0;j--){
        const rec=recoveries[j]; if(!rec)continue;
        const factor=recoveryFactor(now-rec.start,rec.duration,rec.fraction);
        for(const cell of rec.cells) r.dent[cell.i]=(r.dent[cell.i]??0)+cell.depth*(factor-rec.lastFactor);
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
        const radius = p.radius + (p.pressure === null ? Math.min(held, 2) * 3 : 0);
        stampDent(r, p.x, p.y, radius, Math.max(immediateDepth(1), dentDepth(held, p.pressure)), 0.18);
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
        if (t === 1) breaks.splice(i, 1);
      }
      const rs = resetRef.current;
      if (rs) {
        breaks.length = 0; cracked.length=0; recoveries.length=0;
        const ctx=r.coating.getContext("2d");
        if(ctx){ctx.clearRect(0,0,r.coating.width,r.coating.height);ctx.globalAlpha=Math.pow(1-Math.min(1,(now-rs.start)/RESET_MS),3);replaying=true; for(const d of rs.damage) paint(mapShell(d.shape,size.w,size.h),d.hole,d.progress); replaying=false;ctx.globalAlpha=1;}
        canvas.parentElement?.querySelectorAll(".sq-shell-plate").forEach(piece => piece.remove());
        const t = Math.min(1, (now - rs.start) / RESET_MS);
        const k = 1 - (1 - Math.pow(1 - t, 3));
        for (let i = 0; i < r.dent.length; i++) {
          r.dent[i] = (rs.snap[i] ?? 0) * k;
          r.glaze[i] = (rs.glaze[i] ?? 0) * k;
        }
        if (t >= 1) { resetRef.current = null; damage.length=0; }
      }
      r.render();
      if (presses.size || breaks.length || recoveries.length || cracked.some(c=>!c.removed&&!c.drawn) || resetRef.current || r.face > 0 || r.paletteAnimating()) raf = requestAnimationFrame(loop);
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
      if(resizing){resizeJob.cancel();rebuild();}
      const { x, y } = local(e);
      if (!isOnRing(x, y, size.w, size.h, frameInsets(size.w))) return;
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      const pressure = pressureScale(e);
      // A new press owns these cells; an older rise must not pull against it.
      for(const rec of recoveries)for(const c of rec.cells){const dx=(c.i%r.dw)/r.dw*size.w-x,dy=Math.floor(c.i/r.dw)/r.dh*size.h-y;c.depth*=1-Math.exp(-(dx*dx+dy*dy)/(2*Math.pow(dentRadius(e.pointerType)*2.5,2)));}
      const foam=!intact(x,y);
      const radius=dentRadius(e.pointerType);
      const before=r.dent.slice();
      stampDent(r,x,y,radius,immediateDepth(1),1);
      smoothDents(r,x-radius*2.2,y-radius*2.2,x+radius*2.2,y+radius*2.2);
      presses.set(e.pointerId, { before,x, y, origin:{x,y},dragging:false,pointerType:e.pointerType,exposed:damage.filter(d=>d.hole).map(d=>d.shape),initialFoam:foam,start: performance.now(), radius, pressure, sound: foam?playSquelch(immediateDepth(1)):undefined, foam, spots:[{x,y}],flakeDistance:20 });
      resetRef.current = null;

      vibratePress();
      schedule();
    };
    const move = (e: PointerEvent) => {
      const p = presses.get(e.pointerId);
      if (!p) return;
      const { x, y } = local(e);
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
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        stampDent(r, p.x + (x - p.x) * t, p.y + (y - p.y) * t, p.radius - 1, depth * 0.85, 1);
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
        if(e.type==="pointerup"&&!press.dragging&&!press.initialFoam)crack(press.origin.x,press.origin.y);
        const settings=recoverySettings();
        const cells:{i:number;depth:number}[]=[];
        // Recover the complete smooth contribution, including its tails, not a disc.
        for(let i=0;i<r.dent.length;i++)cells.push({i,depth:(r.dent[i]??0)-(press.before[i]??0)});
        recoveries.push({start:performance.now(),...settings,lastFactor:1,cells});
        if (!presses.size) released = performance.now();
        schedule();
      }
    };
    // Native non-passive touch listeners keep iOS Safari from scrolling / bouncing.
    const stopTouch = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    canvas.addEventListener("touchstart", stopTouch, { passive: false });
    canvas.addEventListener("touchmove", stopTouch, { passive: false });
    canvas.addEventListener("touchend", stopTouch, { passive: false });
    return () => {
      ro.disconnect();
      resizeJob.cancel();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.removeEventListener("touchstart", stopTouch);
      canvas.removeEventListener("touchmove", stopTouch);
      canvas.removeEventListener("touchend", stopTouch);
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
      resetRef.current = null;
    } else {
      resetRef.current = { start: performance.now(), snap: r.dent.slice(), glaze: r.glaze.slice(),damage:damageRef.current.slice() };
    }
    kick.current();
  }, [resetKey]);

  return <canvas ref={canvasRef} className="sq-canvas" data-ready={ready || undefined} aria-hidden="true" />;
}
