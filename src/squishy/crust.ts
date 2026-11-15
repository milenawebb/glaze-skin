import { playCrunch } from "./sounds";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface CrackOptions {
  /** Total crack time in seconds (about 0.9 for buttons, 0.5 for tube segments). */
  duration?: number;
  /** Press point in client coordinates; defaults to the crust's centre. */
  x?: number | undefined;
  y?: number | undefined;
  /** Number of broken pieces; defaults to 6–12. */
  pieces?: number;
  /** Called when the crust element should be removed (pieces have replaced it). */
  onRemove: () => void;
}

const SVG = "http://www.w3.org/2000/svg";

/**
 * Crack a crust in three phases: crack lines spread from the press point,
 * the crust breaks into lifting pieces, then the pieces peel off and fall.
 */
export function crackCrust(crust: HTMLElement | null, layer: HTMLElement | null, opts: CrackOptions) {
  if (crust?.dataset["cracking"]) return;
  const dur = (opts.duration ?? 0.9) * 1000;
  playCrunch(dur / 1000);
  if (!crust || !layer) return opts.onRemove();
  crust.dataset["cracking"] = "1";

  if (prefersReducedMotion()) {
    crust.style.transition = "opacity 200ms linear";
    crust.style.opacity = "0";
    window.setTimeout(opts.onRemove, 200);
    return;
  }

  const r0 = crust.getBoundingClientRect();
  const clamp = (v: number) => Math.max(8, Math.min(92, v));
  const px = opts.x !== undefined ? clamp(((opts.x - r0.left) / r0.width) * 100) : 50;
  const py = opts.y !== undefined ? clamp(((opts.y - r0.top) / r0.height) * 100) : 50;
  const n = opts.pieces ?? 6 + Math.floor(Math.random() * 7);
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

  // b) + c) swap the crust for pieces that lift, then peel away and fall
  window.setTimeout(() => {
    const r = crust.getBoundingClientRect();
    const l = layer.getBoundingClientRect();
    const radius = getComputedStyle(crust).borderRadius;
    const rest = dur * 0.7;
    for (let i = 0; i < n; i++) {
      const a0 = angles[i]!, a1 = angles[(i + 1) % n]! + (i === n - 1 ? Math.PI * 2 : 0);
      const am = (a0 + a1) / 2;
      const P = (a: number) => `${px + Math.cos(a) * 170}% ${py + Math.sin(a) * 170}%`;
      const piece = document.createElement("div");
      piece.className = "sq-piece";
      Object.assign(piece.style, {
        left: `${r.left - l.left}px`,
        top: `${r.top - l.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        borderRadius: radius,
        clipPath: `polygon(${px}% ${py}%, ${P(a0)}, ${P(am)}, ${P(a1)})`,
      });
      const clone = crust.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("polyline").forEach((p) => p.setAttribute("stroke-dashoffset", "0"));
      piece.appendChild(clone);
      layer.appendChild(piece);
      const dx = Math.cos(am), dy = Math.sin(am);
      const rot = (Math.random() - 0.5) * 300;
      const anim = piece.animate(
        [
          { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1, easing: "cubic-bezier(.3,.6,.4,1)" },
          { transform: `translate(${dx * 3}px,${dy * 3 - 2}px) rotate(${rot * 0.04}deg) scale(1.05)`, opacity: 1, offset: 0.43, easing: "cubic-bezier(.45,0,.8,.6)" },
          { transform: `translate(${dx * 45 + (Math.random() - 0.5) * 30}px,${70 + Math.random() * 60}px) rotate(${rot}deg) scale(.85)`, opacity: 0 },
        ],
        { duration: rest, fill: "forwards" },
      );
      anim.onfinish = () => piece.remove();
    }
    opts.onRemove();
    window.setTimeout(() => crumbs(r, l, layer, Math.max(4, n)), dur * 0.3);
  }, tA);
}

function crumbs(c: DOMRect, l: DOMRect, layer: HTMLElement, count: number) {
  for (let i = 0; i < count; i++) {
    const f = document.createElement("span");
    f.className = "sq-flake";
    const s = 3 + Math.random() * 4;
    Object.assign(f.style, {
      width: `${s}px`,
      height: `${s * 0.8}px`,
      left: `${c.left - l.left + Math.random() * c.width}px`,
      top: `${c.top - l.top + Math.random() * c.height}px`,
    });
    layer.appendChild(f);
    const dx = (Math.random() - 0.5) * 70;
    const anim = f.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px,${60 + Math.random() * 60}px) rotate(${(Math.random() - 0.5) * 540}deg)`, opacity: 0 },
      ],
      { duration: 500 + Math.random() * 300, easing: "cubic-bezier(.4,0,.8,.6)", fill: "forwards" },
    );
    anim.onfinish = () => f.remove();
  }
}
