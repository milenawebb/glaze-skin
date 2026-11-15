import { playCrunch } from "./sounds";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Break a crust element into flakes that fly out and fall inside `layer`. */
export function crackCrust(crust: Element | null, layer: HTMLElement | null, count = 14) {
  playCrunch();
  if (!crust || !layer || prefersReducedMotion()) return;
  const c = crust.getBoundingClientRect();
  const l = layer.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const f = document.createElement("span");
    f.className = "sq-flake";
    const s = 4 + Math.random() * 7;
    f.style.width = `${s}px`;
    f.style.height = `${s * (0.6 + Math.random() * 0.6)}px`;
    f.style.left = `${c.left - l.left + Math.random() * c.width}px`;
    f.style.top = `${c.top - l.top + Math.random() * c.height}px`;
    layer.appendChild(f);
    const dx = (Math.random() - 0.5) * 120;
    const up = 20 + Math.random() * 50;
    const fall = 70 + Math.random() * 90;
    const rot = (Math.random() - 0.5) * 720;
    const anim = f.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx * 0.5}px,${-up}px) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx}px,${fall}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.6,.6,1)", fill: "forwards" },
    );
    anim.onfinish = () => f.remove();
  }
}
