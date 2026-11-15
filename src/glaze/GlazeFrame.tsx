import { useEffect, useRef, useState } from "react";
import { createFrameRenderer, isOnRing, smoothDents, stampDent, type FrameRenderer } from "./frame-gl";
import { playCrack, playCrunch, playShatter, playSquelch } from "./sounds";
import { vibratePress } from "./haptics";
import { dentDepth, dentRadius, faceExpression, frameInsets, pressureScale } from "./touch";

import { breakGlaze, hasGlaze } from "./glaze";

import { createShellBreak, createCrackTrail, takeShellChips, peelShell, SHELL_BREAK_MS, paintCoating, insideShellPolygon, framePressStage, type ShellBreak } from "./shell";

import { recoverySettings, recoveryFactor, immediateDepth } from "./recovery";
import type { GlazeColor } from "./preferences";
import { DEFAULT_GLAZE_STYLE, monoStyleAmount, type GlazeStyle } from "./glaze-style";
const RESET_MS = 1500;

interface Press { x: number; y: number; start: number; radius: number; pressure: number | null; sound: ((depth: number) => void) | undefined; spots: {x:number;y:number}[]; trailDistance:number; branchSpacing:number }

/** WebGL squishy frame. Dents stay until `resetKey` changes. */
export function GlazeFrame({ resetKey, color = "Rainbow", glazeStyle = DEFAULT_GLAZE_STYLE, onFallback }: { resetKey: number; color?: GlazeColor; glazeStyle?: GlazeStyle; onFallback: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FrameRenderer | null>(null);
  const kick = useRef<() => void>(() => {});
  const clearTransient = useRef<() => void>(() => {});
  const resetRef = useRef<{ start: number; snap: Float32Array; glaze: Float32Array; coating: HTMLCanvasElement } | null>(null);
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
    let released = -1000;
    const breaks: { x: number; y: number; radius: number; start: number; duration: number; shape: ShellBreak }[] = [];

    const cracked: { x:number; y:number; radius:number; shape:ShellBreak; removed:boolean; start:number; drawn:boolean }[]=[];
    const protectedRects = () => {
      const bounds=canvas.getBoundingClientRect();
      return Array.from(canvas.parentElement?.querySelectorAll<HTMLElement>(".sq-frame-colors, .sq-frame-actions, .sq-stage")??[]).map(el=>{const b=el.getBoundingClientRect();return {x:b.left-bounds.left-3,y:b.top-bounds.top-3,w:b.width+6,h:b.height+6};});
    };
    const safe = (x:number,y:number) => {
      const insets=frameInsets(size.w), faceY=size.h-insets.b/2;
      return isOnRing(x,y,size.w,size.h,insets) && Math.hypot((x-size.w/2)/43,(y-faceY)/24)>1 && !protectedRects().some(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
    };
    const paint = (shape:ShellBreak,hole:boolean,progress=1) => {
      const ctx=r.coating.getContext("2d");if(!ctx)return;
      const scale=r.coating.width/size.w;
      ctx.save();ctx.scale(scale,scale);ctx.beginPath();ctx.rect(0,0,size.w,size.h);
      for(const b of protectedRects())ctx.rect(b.x,b.y,b.w,b.h);
      ctx.moveTo(size.w/2+43,size.h-frameInsets(size.w).b/2);ctx.ellipse(size.w/2,size.h-frameInsets(size.w).b/2,43,24,0,0,Math.PI*2);
      ctx.clip("evenodd");ctx.scale(1/scale,1/scale);paintCoating(r.coating,size.w,shape,hole,progress);ctx.restore();
    };
    const recoveries: { start:number; duration:number; fraction:number; cells:{i:number;depth:number}[] }[]=[];
    clearTransient.current=()=>{breaks.length=0;cracked.length=0;recoveries.length=0;canvas.parentElement?.querySelectorAll(".sq-shell-plate").forEach(p=>p.remove());};
    const loop = (now: number) => {
      raf = 0;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      r.face = faceExpression(presses.size, now - released, reduce);
      for(let j=recoveries.length-1;j>=0;j--){
        const rec=recoveries[j]; if(!rec)continue;
        const factor=recoveryFactor(now-rec.start,rec.duration,rec.fraction);
        for(const cell of rec.cells) r.dent[cell.i]=cell.depth*factor;
        if(now-rec.start>=rec.duration)recoveries.splice(j,1);
      }
      for(const c of cracked) if(!c.removed && !c.drawn){
        paint(c.shape,false);c.drawn=true;
      }
      for (const p of presses.values()) {
        const held = (now - p.start) / 1000;
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
        breakGlaze(r, b.x, b.y, b.radius, Math.min(1,t/.35), b.shape.boundary);
        paint(b.shape,true,Math.min(1,t/.35));
        if (t === 1) breaks.splice(i, 1);
      }
      const rs = resetRef.current;
      if (rs) {
        breaks.length = 0; cracked.length=0; recoveries.length=0;
        const ctx=r.coating.getContext("2d");
        if(ctx){ctx.clearRect(0,0,r.coating.width,r.coating.height);ctx.globalAlpha=Math.pow(1-Math.min(1,(now-rs.start)/RESET_MS),3);ctx.drawImage(rs.coating,0,0);ctx.globalAlpha=1;}
        canvas.parentElement?.querySelectorAll(".sq-shell-plate").forEach(piece => piece.remove());
        const t = Math.min(1, (now - rs.start) / RESET_MS);
        const k = 1 - (1 - Math.pow(1 - t, 3));
        for (let i = 0; i < r.dent.length; i++) {
          r.dent[i] = (rs.snap[i] ?? 0) * k;
          r.glaze[i] = (rs.glaze[i] ?? 0) * k;
        }
        if (t >= 1) resetRef.current = null;
      }
      r.render();
      if (presses.size || breaks.length || recoveries.length || cracked.some(c=>!c.removed&&!c.drawn) || resetRef.current || r.face > 0 || r.paletteAnimating()) raf = requestAnimationFrame(loop);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    kick.current = schedule;

    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      size = { w: rect.width, h: rect.height };
      if (snapSize(r, size)) schedule();
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
    const crack = (x:number,y:number,pointerType:string,dragging=false) => {
      if(!safe(x,y))return "foam";
      const existing=cracked.find(c=>insideShellPolygon(x,y,c.shape.boundary));
      if(framePressStage(hasGlaze(r,x,y),Boolean(existing))==="foam")return "foam";
      if(existing){
        const before=new Set(existing.shape.removed);
        const plates=takeShellChips(existing.shape,x,y).filter(poly=>{
          if(poly.every(p=>safe(p.x,p.y)))return true;
          const index=existing.shape.plates.indexOf(poly);if(!before.has(index))existing.shape.removed.delete(index);
          return false;
        });
        if(!plates.length)return "cracked";
        const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        for(const poly of plates){
          const shape={...existing.shape,boundary:poly,plates:[poly]};
          if(reduce){breakGlaze(r,existing.x,existing.y,existing.radius,1,poly);paint(shape,true);}
          else {
          const layer=canvas.parentElement?.querySelector<HTMLElement>(".sq-flakes");
          if(layer)peelShell(layer,r.snapshot(existing.x,existing.y,existing.radius),shape,existing.x,existing.y,existing.radius);
          breaks.push({x:existing.x,y:existing.y,radius:existing.radius,start:performance.now(),duration:SHELL_BREAK_MS,shape});
          }
        }
        if(dragging)playCrunch();else playShatter();return "shatter";
      }
      const radius=60;
      cracked.push({x,y,radius,shape:createShellBreak(x,y,radius),removed:false,start:performance.now(),drawn:false});
      if(dragging)playCrunch();else playCrack();
      return "crack";
    };
    const down = (e: PointerEvent) => {
      const { x, y } = local(e);
      if (!isOnRing(x, y, size.w, size.h, frameInsets(size.w))) return;
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      const pressure = pressureScale(e);
      // A new press owns these cells; an older rise must not pull against it.
      for(const rec of recoveries)rec.cells=rec.cells.filter(c=>Math.hypot((c.i%r.dw)*2-x,Math.floor(c.i/r.dw)*2-y)>dentRadius(e.pointerType)*2.5);
      const result=crack(x,y,e.pointerType);
      const radius=dentRadius(e.pointerType);
      stampDent(r,x,y,radius,immediateDepth(1),1);
      presses.set(e.pointerId, { x, y, start: performance.now(), radius, pressure, sound: result==="foam"?playSquelch(immediateDepth(1)):undefined, spots:[{x,y}],trailDistance:0,branchSpacing:15+Math.random()*10 });
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
      if(dist>0){
        const trail=createCrackTrail({x:p.x,y:p.y},{x,y});paint(trail,false);
        p.trailDistance+=dist;
        if(dist<15&&p.trailDistance>=p.branchSpacing){
          const branch=createCrackTrail({x,y},{x:x-(y-p.y)/dist*12,y:y+(x-p.x)/dist*12});paint(branch,false);
          p.trailDistance=0;p.branchSpacing=15+Math.random()*10;
        }
        // Sample longer moves too, so a fast finger leaves no skipped cracked regions.
        const samples=Math.ceil(dist/18);
        for(let i=1;i<=samples;i++){const t=i/samples;const tx=p.x+(x-p.x)*t,ty=p.y+(y-p.y)*t;if(safe(tx,ty))crack(tx,ty,e.pointerType,true);}
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
        const settings=recoverySettings();
        const cells:{i:number;depth:number}[]=[];
        const visited=new Set<number>();
        for(const spot of press.spots){
          const ext=press.radius*2.5;
          for(let y=Math.max(0,Math.floor((spot.y-ext)/2));y<=Math.min(r.dh-1,Math.ceil((spot.y+ext)/2));y++)
            for(let x=Math.max(0,Math.floor((spot.x-ext)/2));x<=Math.min(r.dw-1,Math.ceil((spot.x+ext)/2));x++){
              const i=y*r.dw+x;
              if(!visited.has(i)&&Math.hypot(x*2-spot.x,y*2-spot.y)<ext){visited.add(i);cells.push({i,depth:r.dent[i]??0});}
            }
        }
        const indices=new Set(cells.map(c=>c.i));
        for(const rec of recoveries)rec.cells=rec.cells.filter(c=>!indices.has(c.i));
        recoveries.push({start:performance.now(),...settings,cells});
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
      const coating=document.createElement("canvas");coating.width=r.coating.width;coating.height=r.coating.height;coating.getContext("2d")?.drawImage(r.coating,0,0);
      resetRef.current = { start: performance.now(), snap: r.dent.slice(), glaze: r.glaze.slice(),coating };
    }
    kick.current();
  }, [resetKey]);

  return <canvas ref={canvasRef} className="sq-canvas" data-ready={ready || undefined} aria-hidden="true" />;
}
