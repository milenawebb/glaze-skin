/** Small CPU polygons only at break time; the frame and pores remain GPU-rendered. */
export interface ShellPoint { x: number; y: number }
export interface ShellBreak { boundary: ShellPoint[]; plates: ShellPoint[][] }
export const SHELL_BREAK_MS = 600;
export function framePressStage(glazed: boolean, cracked: boolean) {
  return !glazed ? "foam" : cracked ? "shatter" : "crack";
}

function clip(poly: ShellPoint[], nx: number, ny: number, limit: number) {
  const out: ShellPoint[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (!a || !b) continue;
    const da = a.x * nx + a.y * ny - limit, db = b.x * nx + b.y * ny - limit;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function createShellBreak(x: number, y: number, radius: number, random = Math.random): ShellBreak {
  const count = 3 + Math.min(3, Math.floor(random() * 4));
  const offset = random() * Math.PI * 2;
  // A mildly irregular convex boundary leaves a substantial jagged cut edge.
  const boundary = Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI * 2 / 8;
    const r = radius * (0.63 + random() * 0.35);
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
  });
  const seeds = Array.from({ length: count }, (_, i) => {
    const a = offset + i * Math.PI * 2 / count;
    const r = radius * (0.25 + random() * 0.3);
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
  });
  const plates = seeds.map((a, i) => seeds.reduce((poly, b, j) => i === j ? poly : clip(poly, b.x - a.x, b.y - a.y, (b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y) / 2), boundary));
  return { boundary, plates };
}

export function insideShellPolygon(x: number, y: number, poly: ShellPoint[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a && b && (a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Textured canvas quads carry the actual shell color and attached sprinkles away. */
export function peelShell(layer: HTMLElement, image: HTMLCanvasElement, shape: ShellBreak, x: number, y: number, radius: number) {
  for (const [i, poly] of shape.plates.entries()) {
    const piece = document.createElement("canvas");
    piece.className = "sq-shell-plate";
    piece.width = image.width; piece.height = image.height;
    piece.style.width = `${radius * 2}px`; piece.style.height = `${radius * 2}px`;
    piece.style.left = `${x - radius}px`; piece.style.top = `${y - radius}px`;
    const ctx = piece.getContext("2d");
    if (!ctx || !poly.length) continue;
    const scale = image.width / (radius * 2);
    ctx.scale(scale, scale);
    ctx.beginPath();
    for (const [j, p] of poly.entries()) {
      if (j === 0) ctx.moveTo(p.x - x + radius, p.y - y + radius);
      else ctx.lineTo(p.x - x + radius, p.y - y + radius);
    }
    ctx.closePath(); ctx.clip();
    ctx.drawImage(image, 0, 0, radius * 2, radius * 2);
    layer.appendChild(piece);
    const direction = (i - (shape.plates.length - 1) / 2) * 9;
    const anim = piece.animate([
      { transform: "translate(0,0) rotateX(0deg) rotate(0deg)", opacity: 1 },
      { transform: `translate(${direction * .25}px,-7px) rotateX(24deg) rotate(${direction * .3}deg)`, opacity: 1, offset: .35 },
      { transform: `translate(${direction}px,64px) rotateX(55deg) rotate(${direction * 2}deg)`, opacity: 0 },
    ], { duration: SHELL_BREAK_MS, easing: "cubic-bezier(.3,.15,.65,1)", fill: "forwards" });
    anim.onfinish = () => piece.remove();
  }
}
/** Full screen-resolution antialiased coating mask: red holes, green fissures. */
export function paintCoating(canvas: HTMLCanvasElement, width: number, shape: ShellBreak, hole: boolean, progress = 1) {
  const ctx=canvas.getContext("2d"); if (!ctx) return;
  const scale=canvas.width/width;
  ctx.save(); ctx.scale(scale,scale);
  if(hole){
    ctx.globalCompositeOperation="lighter";
    ctx.fillStyle=`rgba(255,0,0,${progress})`;
    ctx.beginPath(); shape.boundary.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle="rgb(0,255,0)"; ctx.lineWidth=.85; ctx.lineJoin="round"; ctx.lineCap="round";
    for(const poly of shape.plates){
      ctx.beginPath();
      poly.forEach((p,i)=>{
        const next=poly[(i+1)%poly.length]; if(!next)return;
        const mid={x:(p.x+next.x)/2+Math.sin(p.x*3)*1.1,y:(p.y+next.y)/2+Math.cos(p.y*2)*1.1};
        const end={x:p.x+(next.x-p.x)*progress,y:p.y+(next.y-p.y)*progress};
        ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+(mid.x-p.x)*Math.min(1,progress*2),p.y+(mid.y-p.y)*Math.min(1,progress*2));ctx.lineTo(end.x,end.y);
        if(i%2===0){ctx.moveTo(mid.x,mid.y);ctx.lineTo(mid.x+Math.sin(i+mid.y)*4*progress,mid.y+Math.cos(i+mid.x)*6*progress);}
      });ctx.stroke();
    }
  }
  ctx.restore();
}
