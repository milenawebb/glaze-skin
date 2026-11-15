import type { ShellBreak, ShellPoint } from "./shell";

/** Split even long segments at material boundaries, including holes between endpoints. */
export function clipCrackPaths(paths: ShellPoint[][], intact: (x: number, y: number) => boolean) {
  const result: ShellPoint[][]=[];
  for(const path of paths){
    let run: ShellPoint[]=[];
    const flush=()=>{if(run.length>1)result.push(run);run=[];};
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i];if(!a||!b)continue;
      const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.5));
      for(let j=0;j<=steps;j++){
        const t=j/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
        if(intact(p.x,p.y))run.push(p);else flush();
      }
    }
    flush();
  }
  return result;
}

/** Geometry is retained in unit-frame space; raster masks are disposable. */
export function mapShell(shape: ShellBreak, w: number, h: number): ShellBreak {
  const path = (points: ShellBreak["boundary"]) => points.map(p => ({ x: p.x * w, y: p.y * h }));
  return { boundary: path(shape.boundary), plates: shape.plates.map(path), cracks: shape.cracks.map(path), arcs: shape.arcs.map(path), removed: shape.removed };
}

/** Sample normalized height data into a fresh device-resolution map. */
export function rasterHeight(values: Float32Array, sw: number, sh: number, w: number, h: number) {
  const out = new Float32Array(w * h);
  const at = (xx: number, yy: number) => values[Math.min(sh - 1, yy) * sw + Math.min(sw - 1, xx)] ?? 0;
  for (let y = 0; y < h; y++) {
    const sy = y / Math.max(1, h - 1) * (sh - 1), y0 = Math.floor(sy), fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = x / Math.max(1, w - 1) * (sw - 1), x0 = Math.floor(sx), fx = sx - x0;
      out[y * w + x] = (at(x0,y0)*(1-fx)+at(x0+1,y0)*fx)*(1-fy)+(at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx)*fy;
    }
  }
  return out;
}