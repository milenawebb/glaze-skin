import { useEffect, useRef, useState } from "react";
import { createFrameRenderer, isOnRing, smoothDents, stampDent, type FrameRenderer } from "./frame-gl";
import { playCrunch, playSquelch } from "./sounds";
import { vibratePress } from "./haptics";
import { dentDepth, dentRadius, faceExpression, frameInsets, pressureScale } from "./touch";

import { breakGlaze, hasGlaze } from "./glaze";
import { crackFrameGlaze } from "./crust";

const RESET_MS = 1500;

interface Press { x: number; y: number; start: number; radius: number; pressure: number | null; sound: ((depth: number) => void) | undefined }

/** WebGL squishy frame. Dents stay until `resetKey` changes. */
export function SquishyFrame({ resetKey, onFallback }: { resetKey: number; onFallback: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FrameRenderer | null>(null);
  const kick = useRef<() => void>(() => {});
  const resetRef = useRef<{ start: number; snap: Float32Array; glaze: Float32Array } | null>(null);
  const [ready, setReady] = useState(false);

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
    const breaks: { x: number; y: number; radius: number; start: number; duration: number }[] = [];

    const loop = (now: number) => {
      raf = 0;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      r.face = faceExpression(presses.size, now - released, reduce);
      for (const p of presses.values()) {
        const held = (now - p.start) / 1000;
        p.sound?.(dentDepth(held, p.pressure));
        const radius = p.radius + (p.pressure === null ? Math.min(held, 2) * 3 : 0);
        stampDent(r, p.x, p.y, radius, dentDepth(held, p.pressure), 0.18);
        const extent = radius * 2.2;
        smoothDents(r, p.x - extent, p.y - extent, p.x + extent, p.y + extent);
      }
      for (let i = breaks.length - 1; i >= 0; i--) {
        const b = breaks[i];
        if (!b) continue;
        const t = Math.min(1, (now - b.start) / b.duration);
        breakGlaze(r, b.x, b.y, b.radius, t);
        if (t === 1) breaks.splice(i, 1);
      }
      const rs = resetRef.current;
      if (rs) {
        const t = Math.min(1, (now - rs.start) / RESET_MS);
        const k = 1 - (1 - Math.pow(1 - t, 3));
        for (let i = 0; i < r.dent.length; i++) {
          r.dent[i] = (rs.snap[i] ?? 0) * k;
          r.glaze[i] = (rs.glaze[i] ?? 0) * k;
        }
        if (t >= 1) resetRef.current = null;
      }
      r.render();
      if (presses.size || breaks.length || resetRef.current || r.face > 0) raf = requestAnimationFrame(loop);
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
    const crack = (x: number, y: number, pointerType: string, dragging = false) => {
      if (!hasGlaze(r, x, y) || breaks.some(b => Math.hypot(x - b.x, y - b.y) < b.radius * .8)) return;
      const radius = dentRadius(pointerType) * 2.1;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      breaks.push({ x, y, radius, start: performance.now(), duration: reduce ? 200 : 400 });
      if (dragging) playCrunch();
      crackFrameGlaze(canvas, x, y, radius, !dragging);
    };
    const down = (e: PointerEvent) => {
      const { x, y } = local(e);
      if (!isOnRing(x, y, size.w, size.h, frameInsets(size.w))) return;
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      const pressure = pressureScale(e);
      presses.set(e.pointerId, { x, y, start: performance.now(), radius: dentRadius(e.pointerType), pressure, sound: playSquelch(dentDepth(0, pressure)) });
      resetRef.current = null;
      crack(x, y, e.pointerType);
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
      if (Math.hypot(x - p.x, y - p.y) > 0 && isOnRing(x, y, size.w, size.h, frameInsets(size.w))) crack(x, y, e.pointerType, true);
      const dist = Math.hypot(x - p.x, y - p.y);
      const steps = Math.max(1, Math.ceil(dist / 3));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        stampDent(r, p.x + (x - p.x) * t, p.y + (y - p.y) * t, p.radius - 1, depth * 0.85, 1);
      }
      const extent = p.radius * 2.2;
      smoothDents(r, Math.min(p.x, x) - extent, Math.min(p.y, y) - extent, Math.max(p.x, x) + extent, Math.max(p.y, y) + extent);
      p.x = x;
      p.y = y;
      schedule();
    };
    const up = (e: PointerEvent) => {
      if (presses.delete(e.pointerId)) {
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
      r.dent.fill(0);
      r.glaze.fill(0);
      resetRef.current = null;
    } else {
      resetRef.current = { start: performance.now(), snap: r.dent.slice(), glaze: r.glaze.slice() };
    }
    kick.current();
  }, [resetKey]);

  return <canvas ref={canvasRef} className="sq-canvas" data-ready={ready || undefined} aria-hidden="true" />;
}
