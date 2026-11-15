import { useEffect, useRef, useState } from "react";
import { FRAME, createFrameRenderer, isOnRing, stampDent, type FrameRenderer } from "./frame-gl";
import { playPop, playSquelch } from "./sounds";

const INSETS = { l: FRAME.side, t: FRAME.top, r: FRAME.side, b: FRAME.bottom };
const RESET_MS = 1500;

interface Press { x: number; y: number; start: number }

/** WebGL squishy frame. Dents stay until `resetKey` changes. */
export function SquishyFrame({ resetKey, onFallback }: { resetKey: number; onFallback: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FrameRenderer | null>(null);
  const kick = useRef<() => void>(() => {});
  const resetRef = useRef<{ start: number; snap: Float32Array } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
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

    const loop = (now: number) => {
      raf = 0;
      for (const p of presses.values()) {
        const held = (now - p.start) / 1000;
        stampDent(r, p.x, p.y, 13 + Math.min(held, 2) * 3, Math.min(1, 0.32 + held * 0.45), 0.18);
      }
      const rs = resetRef.current;
      if (rs) {
        const t = Math.min(1, (now - rs.start) / RESET_MS);
        const k = 1 - (1 - Math.pow(1 - t, 3));
        for (let i = 0; i < r.dent.length; i++) r.dent[i] = rs.snap[i]! * k;
        if (t >= 1) resetRef.current = null;
      }
      r.render();
      if (presses.size || resetRef.current) raf = requestAnimationFrame(loop);
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
      rr.resize(s.w, s.h, INSETS);
      return true;
    };
    ro.observe(canvas);

    const local = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const down = (e: PointerEvent) => {
      const { x, y } = local(e);
      if (!isOnRing(x, y, size.w, size.h, INSETS)) return;
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      presses.set(e.pointerId, { x, y, start: performance.now() });
      resetRef.current = null;
      playSquelch();
      schedule();
    };
    const move = (e: PointerEvent) => {
      const p = presses.get(e.pointerId);
      if (!p) return;
      const { x, y } = local(e);
      const held = (performance.now() - p.start) / 1000;
      const depth = Math.min(1, 0.32 + held * 0.45);
      const dist = Math.hypot(x - p.x, y - p.y);
      const steps = Math.max(1, Math.ceil(dist / 3));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        stampDent(r, p.x + (x - p.x) * t, p.y + (y - p.y) * t, 12, depth * 0.85, 0.35);
      }
      p.x = x;
      p.y = y;
      schedule();
    };
    const up = (e: PointerEvent) => {
      if (presses.delete(e.pointerId)) playPop();
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
      resetRef.current = null;
    } else {
      resetRef.current = { start: performance.now(), snap: r.dent.slice() };
    }
    kick.current();
  }, [resetKey]);

  return <canvas ref={canvasRef} className="sq-canvas" data-ready={ready || undefined} aria-hidden="true" />;
}
