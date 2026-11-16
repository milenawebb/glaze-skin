import { createFrameHint } from "./hint";
import { clipCrackPaths, mapShell } from "./damage";
import { useEffect, useRef, useState } from "react";
import { createFrameRenderer, isOnRing, smoothDents, stampDent, type FrameRenderer } from "./frame-gl";
import { playCrack, playCrunch, playShatter, playSquelch } from "./sounds";
import { vibratePress } from "./haptics";
import { coarsePointer, dentDepth, dentRadius, faceExpression, frameInsets, pressureScale } from "./touch";

import { breakGlaze, hasGlaze } from "./glaze";

import { prepareShellDebris, cancelShellDebris, createShellBreak, peelShell, SHELL_BREAK_MS, paintCoating, insideShellPolygon, framePressStage, type ShellBreak } from "./shell";
import { angularCell, maxPiece, chipPlates, chipRadius, snapRadius, snapToGlaze, ISLAND_SIZE } from "./chip";
import { createGlazeStrip, dragThreshold, isGlazeDrag, stripWidth } from "./strip";

import { recoverySettings, recoveryFactor, immediateDepth } from "./recovery";
import { settledResize } from "./resize";
import { fingerPad, fingerDepth, stampFingertip, type FingerPad } from "./fingertip";
import type { GlazeColor } from "./preferences";
import { DEFAULT_GLAZE_STYLE, monoStyleAmount, type GlazeStyle } from "./glaze-style";
import { region, resetAmount, resetDuration, REDUCED_FADE_MS, union, type Region } from "./regions";

/** Same rounded corners as the video stage, so no layer gets a square box. */
function insideRounded(x:number,y:number,b:{x:number;y:number;w:number;h:number;r:number}){const qx=Math.abs(x-(b.x+b.w/2))-b.w/2+b.r,qy=Math.abs(y-(b.y+b.h/2))-b.h/2+b.r;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-b.r<=0;}

interface Press { target:{x:number;y:number}|null; crackedOnDown:boolean; pad:FingerPad; before:Float32Array; x: number; y: number; origin: {x:number;y:number}; dragging:boolean; pointerType:string; exposed:ShellBreak[]; initialFoam:boolean; start: number; radius: number; pressure: number | null; sound: ((depth: number) => void) | undefined; foam: boolean; spots: {x:number;y:number}[]; flakeDistance:number }

/** WebGL squishy frame. Dents stay until `resetKey` changes. */
export function GlazeFrame({ resetKey, color = "Rainbow", glazeStyle = DEFAULT_GLAZE_STYLE, onFallback, onReset }: { resetKey: number; color?: GlazeColor; glazeStyle?: GlazeStyle; onFallback: () => void; onReset?: () => void }) {
  const onResetRef = useRef(onReset); onResetRef.current = onReset;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hintLabelRef = useRef<HTMLSpanElement>(null);
  const hintFingerRef = useRef<HTMLSpanElement>(null);
  const hintRippleRef = useRef<HTMLSpanElement>(null);
  const rendererRef = useRef<FrameRenderer | null>(null);
  const kick = useRef<() => void>(() => {});
  const clearTransient = useRef<() => void>(() => {});
  const resetRef = useRef<{ start: number; reduced: boolean } | null>(null);
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
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* Optional storage. */ }
    const hint = createFrameHint(performance.now(), storage);
    const root = canvas.parentElement;
    const label = hintLabelRef.current, finger = hintFingerRef.current, ripple = hintRippleRef.current;
    let onScreen = false;
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => { onScreen = Boolean(entry?.isIntersecting); schedule(); }, { threshold: .5 });
    if (io) io.observe(canvas); else onScreen = true;
    if (label) label.textContent = coarsePointer() ? "Tap me" : "Press me";
    let controlUntil = 0, nativeFullscreen = false;
    const controlSelector = ".sq-controls, .sq-frame-tools, .sq-frame-colors, .sq-frame-actions, .sq-replay";
    const controlUse = (e: Event) => { if (e.target instanceof Element && e.target.closest(controlSelector)) { controlUntil = performance.now() + 2000; schedule(); } };
    const fullscreenStart = () => { nativeFullscreen = true; schedule(); };
    const fullscreenEnd = () => { nativeFullscreen = false; schedule(); };
    const hintBlocked = () => !onScreen || nativeFullscreen || Boolean(document.fullscreenElement) || document.visibilityState === "hidden" || performance.now() < controlUntil || Boolean(root?.querySelector(`${controlSelector.split(", ").map(s => `${s}:hover`).join(", ")}`)) || Boolean(document.activeElement instanceof Element && root?.contains(document.activeElement) && document.activeElement.closest(controlSelector));
    const stopHint = () => { hint.stop(); if(label)label.removeAttribute("data-visible"); if(finger)finger.style.opacity="0"; if(ripple)ripple.style.opacity="0"; r.hint = { x: 0, y: 0, depth: 0, crack: 0, glance: 0, blink: 0, smile: 0 }; schedule(); };

    let size = { w: 1, h: 1 };
    let raf = 0;
    let resizing = false;
    let released = -1000;
    const breaks: { x: number; y: number; radius: number; start: number; duration: number; shape: ShellBreak }[] = [];

    // Live reduced-motion setting; updates without reload.
    const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced=motion.matches;
    const onMotion=()=>{reduced=motion.matches;};
    motion.addEventListener("change",onMotion);
    const cracked: { x:number; y:number; radius:number; shape:ShellBreak; removed:boolean; start:number; drawn:boolean }[]=[];
    let protectedCache:{x:number;y:number;w:number;h:number;r:number}[]=[];
    const refreshProtected = () => {
      const bounds=canvas.getBoundingClientRect();
      protectedCache=Array.from(canvas.parentElement?.querySelectorAll<HTMLElement>(".sq-stage")??[]).map(el=>{const b=el.getBoundingClientRect();return {x:b.left-bounds.left-3,y:b.top-bounds.top-3,w:b.width+6,h:b.height+6,r:(parseFloat(getComputedStyle(el).borderTopLeftRadius)||0)+3};});
    };
    const safe = (x:number,y:number) => {
      const insets=frameInsets(size.w);
      return isOnRing(x,y,size.w,size.h,insets) && !protectedCache.some(b=>insideRounded(x,y,b));
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
      ctx.save();ctx.scale(scale,scale);ctx.beginPath();if(ctx.roundRect)ctx.roundRect(0,0,size.w,size.h,46);else ctx.rect(0,0,size.w,size.h);
      for(const b of protectedCache){if(ctx.roundRect)ctx.roundRect(b.x,b.y,b.w,b.h,b.r);else ctx.rect(b.x,b.y,b.w,b.h);}
      ctx.clip("evenodd");ctx.scale(1/scale,1/scale);paintCoating(r.coating,size.w,shape,hole,progress);ctx.restore();
      const points=hole?shape.boundary:[...shape.cracks,...shape.arcs].flat();
      if(points.length)r.dirtyCoating(Math.min(...points.map(p=>p.x))-2,Math.min(...points.map(p=>p.y))-2,Math.max(...points.map(p=>p.x))+2,Math.max(...points.map(p=>p.y))+2);
    };
    // Rise-back lives on the GPU: r.rise holds depth still to rise, the shader eases it by r.riseK.
    let rise:{start:number;duration:number;bounds:Region}|null=null;
    const riseK=(now:number)=>rise?recoveryFactor(now-rise.start,rise.duration,1)-1:0;
    /** Fold the current rise progress into the dent map; the remainder keeps rising. */
    const bakeRise=(now:number,finish=false)=>{
      if(!rise){r.riseK=0;return;}
      const k=finish?-1:riseK(now),b=rise.bounds,remaining=Math.max(300,rise.duration-(now-rise.start));
      for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++){const i=y*r.dw+x,l=r.rise[i]??0;if(l!==0){r.dent[i]=(r.dent[i]??0)+l*k;r.rise[i]=finish?0:l*(1+k);}}
      r.dirtyHeight(b);r.dirtyRise(b);r.riseK=0;
      rise=finish?null:{start:now,duration:remaining,bounds:b};
    };
    const clearRise=()=>{bakeRise(performance.now());if(rise){r.rise.fill(0);r.dirtyRise(region(r.dw,r.dh,0,0,r.dw-1,r.dh-1));}rise=null;r.riseK=0;};
    const beforePool:Float32Array[]=[];
    clearTransient.current=()=>{cancelShellDebris();breaks.length=0;cracked.length=0;clearRise();damage.length=0;holeBins.clear();pending.length=0;canvas.parentElement?.querySelectorAll(".sq-shell-plate").forEach(p=>p.remove());};
    const loop = (now: number) => {
      raf = 0;
      const frameStart=performance.now();
      // CSS stretches the last rendered bitmap; no mask replay or upload mid-resize.
      if(resizing)return;
      refreshProtected();
      const deadline=performance.now()+6;
      while(pending.length&&performance.now()<deadline){const event=pending.shift();if(event)processEvent(event);if(event?.type==="pointermove")break;}
      const pose = hint.tick(now, hintBlocked(), reduced);
      const bottom = parseFloat(getComputedStyle(canvas.parentElement ?? canvas).paddingBottom) || 96;
      const hx = size.w * .5 + pose.x * Math.min(1, size.w / 600), hy = size.h - bottom * .5;
      r.hint = { x: hx, y: hy, depth: intact(hx,hy) ? pose.depth : 0, crack: intact(hx,hy) ? pose.crack : 0, glance: pose.glance, blink: pose.blink, smile: pose.smile };
      label?.toggleAttribute("data-visible", pose.label);
      if (label) { label.style.left = `${hx}px`; label.style.top = `${hy}px`; }
      if (finger) { finger.style.opacity = String(pose.active ? pose.finger : 0); finger.style.transform = `translate(${hx}px, ${hy - pose.fingerY * 26}px) translate(-50%, -50%) scale(${1 - .06 * pose.depth / .52})`; }
      if (ripple) { const t = pose.active ? pose.ripple : 0; ripple.style.opacity = t ? String((1 - t) * .8) : "0"; ripple.style.transform = `translate(${hx}px, ${hy}px) translate(-50%, -50%) scale(${.4 + t * 1.4})`; }
      r.face = faceExpression(presses.size, now - released, reduced);
      // Only a uniform changes while dents rise; the maps are baked once at the end.
      if(rise){if(now-rise.start>=rise.duration)bakeRise(now,true);else r.riseK=riseK(now);}
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
        breaks.length = 0; cracked.length=0;
        r.resetAmount=resetAmount(now-rs.start,rs.reduced);
        if(now-rs.start>=resetDuration(rs.reduced)){
          r.dent.fill(0);r.rise.fill(0);r.dirtyRise(region(r.dw,r.dh,0,0,r.dw-1,r.dh-1));r.glaze.fill(0);r.coating.getContext("2d")?.clearRect(0,0,r.coating.width,r.coating.height);
          r.dirtyHeight(region(r.dw,r.dh,0,0,r.dw-1,r.dh-1));r.dirtyCoating(0,0,size.w,size.h);
          resetRef.current=null;damage.length=0;holeBins.clear();r.resetAmount=1;
        }
      }

      r.render();
      const spent=performance.now()-frameStart;
      if(import.meta.env?.DEV&&spent>30)console.warn(`[glaze] slow frame: ${spent.toFixed(1)}ms`);
      if (pose.active || pending.length || presses.size || breaks.length || rise || cracked.some(c=>!c.removed&&!c.drawn) || resetRef.current || r.face > 0 || r.paletteAnimating()) raf = requestAnimationFrame(loop);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    kick.current = schedule;
    const hintTimer = window.setInterval(() => {
      const pose = hint.tick(performance.now(), hintBlocked(), reduced);
      if (pose.count >= 3 && !pose.active && !pose.label) { clearInterval(hintTimer); return; }
      schedule();
    }, 100);
    root?.addEventListener("pointerdown", controlUse, true);
    root?.addEventListener("pointermove", controlUse, true);
    root?.addEventListener("keydown", controlUse, true);
    root?.addEventListener("webkitbeginfullscreen", fullscreenStart, true);
    root?.addEventListener("webkitendfullscreen", fullscreenEnd, true);
    document.addEventListener("fullscreenchange", schedule);
    // A lost GPU context (common on phones when video starts) restores from the retained maps.
    r.onRestore=()=>{fullUploadPending();schedule();};
    const fullUploadPending=()=>{r.dirtyHeight(region(r.dw,r.dh,0,0,r.dw-1,r.dh-1));r.dirtyCoating(0,0,size.w,size.h);};

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
        const pixelShape=mapShell(existing.shape,size.w,size.h);
        // Only the glaze under the finger breaks off; small islands and loose crumbs go with it.
        const plates=chipPlates(pixelShape.plates,existing.shape.removed,x,y,chipRadius(coarsePointer()),intact,insideShellPolygon,maxPiece(coarsePointer()));
        if(!plates.length)return "cracked";
        // One snapshot per break-off; pieces are cut from it over the next frames.
        let snap:HTMLCanvasElement|null=null;
        for(const poly of plates){
          const shape={...pixelShape,boundary:poly,plates:[poly]};
          // Reduced motion: the piece fades away in place over ~200ms (the fade spans the first 35% of a break).
          if(reduced)breaks.push({x:existing.x,y:existing.y,radius:existing.radius,start:performance.now(),duration:REDUCED_FADE_MS/.35,shape:mapShell(shape,1/size.w,1/size.h)});
          else {
          const layer=canvas.parentElement?.querySelector<HTMLElement>(".sq-flakes");
          if(layer){snap??=r.snapshot(existing.x*size.w,existing.y*size.h,existing.radius*size.w);peelShell(layer,snap,shape,existing.x*size.w,existing.y*size.h,existing.radius*size.w);}
          breaks.push({x:existing.x,y:existing.y,radius:existing.radius,start:performance.now(),duration:SHELL_BREAK_MS,shape:mapShell(shape,1/size.w,1/size.h)});
          }
        }
        playShatter();return "shatter";
      }
      // A small cut-off island chips off right away instead of cracking first.
      let glazed=0,total=0;
      for(let gy=-ISLAND_SIZE/2;gy<=ISLAND_SIZE/2;gy+=5)for(let gx=-ISLAND_SIZE/2;gx<=ISLAND_SIZE/2;gx+=5){const px=x+gx,py=y+gy;if(!safe(px,py))continue;total++;if(intact(px,py))glazed++;}
      if(total&&glazed/total<.35){
        const cr=chipRadius(coarsePointer()),poly=angularCell(x,y,cr);
        const shape={boundary:poly,plates:[poly],cracks:[],arcs:[],removed:new Set<number>()};
        const layer=reduced?null:canvas.parentElement?.querySelector<HTMLElement>(".sq-flakes");
        if(layer)peelShell(layer,r.snapshot(x,y,cr),shape,x,y,cr);
        breaks.push({x:x/size.w,y:y/size.h,radius:cr/size.w,start:performance.now(),duration:reduced?REDUCED_FADE_MS/.35:SHELL_BREAK_MS,shape:mapShell(shape,1/size.w,1/size.h)});
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
      if(rise){
        bakeRise(performance.now());
        const reach=dentRadius(e.pointerType)*2.5,inv=1/(2*reach*reach),b=region(r.dw,r.dh,(x-reach*3)*r.dw/size.w,(y-reach*3)*r.dh/size.h,(x+reach*3)*r.dw/size.w,(y+reach*3)*r.dh/size.h);
        for(let yy=b.y0;yy<=b.y1;yy++)for(let xx=b.x0;xx<=b.x1;xx++){const i=yy*r.dw+xx,l=r.rise[i]??0;if(l===0)continue;const dx=xx/r.dw*size.w-x,dy=yy/r.dh*size.h-y;r.rise[i]=l*(1-Math.exp(-(dx*dx+dy*dy)*inv));}
        r.dirtyRise(b);
      }
      const foam=!intact(x,y);
      const radius=dentRadius(e.pointerType);
      const before=beforePool.pop()??new Float32Array(r.dent.length);before.set(r.dent);
      const pad=fingerPad(e.pointerType);
      if(foam)stampFingertip(r,x,y,pad,fingerDepth(0,pressure),1);else stampDent(r,x,y,radius,immediateDepth(1),1);
      smoothDents(r,x-radius*2.2,y-radius*2.2,x+radius*2.2,y+radius*2.2);
      // Fresh glaze shows its first crack lines immediately; click vs drag only decides what follows.
      // Taps on bare squishy act on glaze within reach; with none nearby they only squish.
      const target=foam?snapToGlaze(x,y,snapRadius(coarsePointer()),intact):{x,y};
      const crackedOnDown=!!target&&!cracked.some(c=>insideShellPolygon(target.x/size.w,target.y/size.h,c.shape.boundary))&&crack(target.x,target.y)!=="foam";
      presses.set(e.pointerId, { target,crackedOnDown,pad,before,x, y, origin:{x,y},dragging:false,pointerType:e.pointerType,exposed:damage.filter(d=>d.hole).map(d=>d.shape),initialFoam:foam,start: e.timeStamp, radius, pressure, sound: foam?playSquelch(immediateDepth(1)):undefined, foam, spots:[{x,y}],flakeDistance:20 });
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
      if(!p.dragging&&isGlazeDrag(p.origin,{x,y},dragThreshold(p.pointerType))){
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
          // Live check: a swipe over glaze already stripped (even earlier in this drag) only squishes.
          const glazed=intact(point.x,point.y)&&!p.exposed.some(shape=>insideShellPolygon(point.x/size.w,point.y/size.h,shape.boundary));
          if(glazed){
            p.sound=undefined;playCrunch();p.flakeDistance+=distance/samples;
            if(p.flakeDistance>=(coarsePointer()?30:12)&&!reduced){
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
        if(e.type==="pointerup"&&!press.dragging&&press.target&&!press.crackedOnDown)crack(press.target.x,press.target.y);
        const settings=recoverySettings(),now=performance.now();
        bakeRise(now);
        // Queue the complete smooth contribution, tails included, for the shader to raise.
        const radius=press.pad.length*5;const area=region(r.dw,r.dh,(Math.min(...press.spots.map(p=>p.x))-radius)*r.dw/size.w,(Math.min(...press.spots.map(p=>p.y))-radius)*r.dh/size.h,(Math.max(...press.spots.map(p=>p.x))+radius)*r.dw/size.w,(Math.max(...press.spots.map(p=>p.y))+radius)*r.dh/size.h);
        let bx0=r.dw,by0=r.dh,bx1=-1,by1=-1;const before=press.before;
        for(let y=area.y0;y<=area.y1;y++)for(let x=area.x0;x<=area.x1;x++){const i=y*r.dw+x;const depth=(r.dent[i]??0)-(before[i]??0);if(depth!==0){r.rise[i]=(r.rise[i]??0)+depth*settings.fraction;if(x<bx0)bx0=x;if(x>bx1)bx1=x;if(y<by0)by0=y;if(y>by1)by1=y;}}
        beforePool.push(before);
        if(bx1>=0){const b={x0:bx0,y0:by0,x1:bx1,y1:by1};r.dirtyRise(b);rise={start:now,duration:settings.duration,bounds:union(rise?.bounds??null,b)};}
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
        stopHint();
        e.preventDefault();canvas.setPointerCapture?.(e.pointerId);
      }
      if(e.type==="pointermove"){
        const last=pending.at(-1);
        if(last?.type==="pointermove"&&last.pointerId===e.pointerId)pending.pop();
      }
      pending.push(e);schedule();
    };
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat || resizing) return;
      if (e.key === "Enter") {
        stopHint();
        e.preventDefault(); e.stopPropagation(); refreshProtected();
        for (let i = 0; i < 200; i++) {
          const x = Math.random() * size.w, y = Math.random() * size.h;
          if (safe(x, y) && intact(x, y) && crack(x, y) !== "foam") { schedule(); break; }
        }
      } else if (e.key.toLowerCase() === "r") { e.preventDefault(); e.stopPropagation(); onResetRef.current?.(); }
    };
    canvas.addEventListener("keydown", key);
    const noMenu=(e:Event)=>e.preventDefault();
    const frameEl=canvas.parentElement;
    canvas.addEventListener("contextmenu", noMenu);frameEl?.addEventListener("contextmenu", noMenu);
    canvas.addEventListener("pointerdown", queue);
    canvas.addEventListener("pointermove", queue);
    canvas.addEventListener("pointerup", queue);
    canvas.addEventListener("pointercancel", queue);
    canvas.addEventListener("lostpointercapture", queue);
    return () => {
      clearInterval(hintTimer);
      io?.disconnect();
      root?.removeEventListener("pointerdown", controlUse, true);
      root?.removeEventListener("pointermove", controlUse, true);
      root?.removeEventListener("keydown", controlUse, true);
      root?.removeEventListener("webkitbeginfullscreen", fullscreenStart, true);
      root?.removeEventListener("webkitendfullscreen", fullscreenEnd, true);
      document.removeEventListener("fullscreenchange", schedule);
      ro.disconnect();
      resizeJob.cancel();
      cancelAnimationFrame(raf);
      motion.removeEventListener("change", onMotion);
      canvas.removeEventListener("keydown", key);
      canvas.removeEventListener("contextmenu", noMenu);frameEl?.removeEventListener("contextmenu", noMenu);
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
    clearTransient.current();
    resetRef.current = { start: performance.now(), reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches };
    kick.current();
  }, [resetKey]);

  return <><span ref={hintRippleRef} className="sq-hint-ripple" aria-hidden="true" /><span ref={hintFingerRef} className="sq-hint-finger" aria-hidden="true" /><span ref={hintLabelRef} className="sq-press-hint" aria-hidden="true">Press me</span><canvas ref={canvasRef} className="sq-canvas" data-ready={ready || undefined} tabIndex={0} role="button" aria-label="Glaze frame, press Enter to crack, R to reset" aria-keyshortcuts="Enter r" /></>;
}
