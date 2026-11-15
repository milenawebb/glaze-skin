import { playCrack } from "./sounds";
import { vibrateBreak, vibrateCrack } from "./haptics";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface CrackOptions {
  /** Total glass crack time in seconds; defaults to 0.8. */
  duration?: number;
  /** Press point in client coordinates; defaults to the crust's centre. */
  x?: number | undefined;
  y?: number | undefined;
  /** Number of spreading crack lines; defaults to 8. */
  pieces?: number;
  /** Called when the crust element should be removed (pieces have replaced it). */
  onRemove: () => void;
}

const SVG = "http://www.w3.org/2000/svg";

/**
 * Crack the clear coating: bright lines spread, then tiny glass shards fall.
 */
export function crackCrust(crust: HTMLElement | null, layer: HTMLElement | null, opts: CrackOptions) {
  if (crust?.dataset["cracking"]) return;
  const dur = (opts.duration ?? 0.8) * 1000;
  if (!crust || !layer) return opts.onRemove();
  crust.dataset["cracking"] = "1";
  vibrateCrack();

  if (prefersReducedMotion()) {
    crust.style.transition = "opacity 200ms linear";
    crust.style.opacity = "0";
    window.setTimeout(() => { vibrateBreak(); opts.onRemove(); }, 200);
    return;
  }

  const r0 = crust.getBoundingClientRect();
  const clamp = (v: number) => Math.max(8, Math.min(92, v));
  const px = opts.x !== undefined ? clamp(((opts.x - r0.left) / r0.width) * 100) : 50;
  const py = opts.y !== undefined ? clamp(((opts.y - r0.top) / r0.height) * 100) : 50;
  const n = opts.pieces ?? 8;
  const off = Math.random() * Math.PI * 2;
  const step = (Math.PI * 2) / n;
  const angles = Array.from({ length: n }, (_, i) => off + i * step + (Math.random() - 0.5) * step * 0.5);

  // a) fine crack lines spread outward from the press point
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "sq-cracks");
  const lines: SVGPolylineElement[] = [];
  for (const a of angles) {
    const pts: string[] = [`${px},${py}`];
    for (let k = 1; k <= 6; k++) {
      const rr = k * 26;
      const j = (Math.random() - 0.5) * 0.18;
      pts.push(`${px + Math.cos(a + j) * rr},${py + Math.sin(a + j) * rr}`);
    }
    const pl = document.createElementNS(SVG, "polyline");
    pl.setAttribute("points", pts.join(" "));
    pl.setAttribute("pathLength", "1");
    pl.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(pl);
    lines.push(pl);
  }
  crust.appendChild(svg);
  const tA = dur * 0.3;
  for (const pl of lines) {
    pl.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: tA, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" });
  }

  // Shatter only the clear coat, leaving the toy underneath unchanged.
  window.setTimeout(() => {
    vibrateBreak();
    const r = crust.getBoundingClientRect();
    const l = layer.getBoundingClientRect();
    glassShards(layer, r.left - l.left + r.width * px / 100, r.top - l.top + r.height * py / 100, Math.max(22, Math.min(65, r.width / 2)), 28, dur * 0.7);
    opts.onRemove();
  }, tA);
}

/** Tiny irregular translucent fragments, never clones of the opaque toy beneath. */
function glassShards(layer: HTMLElement, x: number, y: number, radius: number, count: number, duration: number) {
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "sq-flake";
    const size = 3 + Math.random() * 5;
    const angle = Math.random() * Math.PI * 2;
    Object.assign(piece.style, {
      width: `${size}px`, height: `${size * (0.6 + Math.random() * 0.6)}px`,
      left: `${x + Math.cos(angle) * Math.random() * radius}px`,
      top: `${y + Math.sin(angle) * Math.random() * radius}px`,
      clipPath: `polygon(0 12%, ${35 + Math.random() * 50}% 0, 100% 65%, 28% 100%)`,
    });
    layer.appendChild(piece);
    const anim = piece.animate([
      { transform: "translate(0,0) rotate(0deg)", opacity: 0.95 },
      { transform: `translate(${Math.cos(angle) * 18}px,${-12 - Math.random() * 14}px) rotate(50deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${Math.cos(angle) * 45}px,${45 + Math.random() * 45}px) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration, easing: "cubic-bezier(.3,.2,.7,1)", fill: "forwards" });
    anim.onfinish = () => piece.remove();
  }
  for (let i = 0; i < 4; i++) {
    const sparkle = document.createElement("span");
    sparkle.className = "sq-sparkle";
    sparkle.style.left = `${x + (Math.random() - 0.5) * radius}px`;
    sparkle.style.top = `${y + (Math.random() - 0.5) * radius}px`;
    layer.appendChild(sparkle);
    const anim = sparkle.animate([{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "scale(1)", offset: .3 }, { opacity: 0, transform: "scale(.2)" }], { duration: 180 + i * 20 });
    anim.onfinish = () => sparkle.remove();
  }
}

/** One local glass crack on the ring; coating removal is driven by its independent map. */
export function crackFrameGlaze(canvas: HTMLCanvasElement, x: number, y: number, radius: number, sound = true) {
  if (sound) playCrack();
  vibrateCrack();
  if (prefersReducedMotion()) return;
  const parent = canvas.parentElement;
  const layer = parent?.querySelector<HTMLElement>(".sq-flakes");
  if (!parent || !layer) return;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "sq-cracks sq-frame-cracks");
  svg.setAttribute("viewBox", `0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);
  // Clip to the same rounded ring so a crack never crosses the video or outer edge.
  const css = getComputedStyle(parent);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const l = parseFloat(css.paddingLeft), t = parseFloat(css.paddingTop);
  const iw = w - l - parseFloat(css.paddingRight), ih = h - t - parseFloat(css.paddingBottom);
  const id = `sq-glass-${Math.random().toString(36).slice(2)}`;
  const defs = document.createElementNS(SVG, "defs");
  const mask = document.createElementNS(SVG, "mask");
  mask.id = id;
  const outer = document.createElementNS(SVG, "rect");
  for (const [key, value] of Object.entries({ width: w, height: h, rx: 46, fill: "white" })) outer.setAttribute(key, String(value));
  const inner = document.createElementNS(SVG, "rect");
  for (const [key, value] of Object.entries({ x: l, y: t, width: iw, height: ih, rx: 16, fill: "black" })) inner.setAttribute(key, String(value));
  mask.append(outer, inner); defs.appendChild(mask); svg.appendChild(defs);
  const group = document.createElementNS(SVG, "g"); group.setAttribute("mask", `url(#${id})`); svg.appendChild(group);
  const count = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count + (Math.random() - .5) * .3;
    const line = document.createElementNS(SVG, "polyline");
    const points = [`${x},${y}`];
    for (let j = 1; j <= 4; j++) {
      const a = angle + (Math.random() - .5) * .24;
      points.push(`${x + Math.cos(a) * radius * j / 4},${y + Math.sin(a) * radius * j / 4}`);
    }
    line.setAttribute("points", points.join(" ")); line.setAttribute("pathLength", "1");
    group.appendChild(line);
    line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 280, fill: "forwards" });
  }
  layer.appendChild(svg);
  window.setTimeout(() => {
    vibrateBreak();
    glassShards(layer, x, y, radius * .35, 18, 280);
    const anim = svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" });
    anim.onfinish = () => svg.remove();
  }, 280);
}
