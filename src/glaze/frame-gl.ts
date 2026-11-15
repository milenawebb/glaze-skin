import { canvasDpr, coarsePointer, coatingScale, mapSize } from "./touch";
/**
 * Raw WebGL renderer for the squishy frame. A CPU height map (Float32Array,
 * in unit-frame coordinates) stores permanent dents; it is uploaded as a texture each
 * frame and lit in the fragment shader.
 */
import { COLOR_FADE_MS } from "./preferences";
import { region, union, tailWeight, type Region } from "./regions";
export const FRAME = { side: 30, top: 30, bottom: 96, outerRadius: 46, innerRadius: 16 };

const VS = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform vec4 uIns; uniform float uRo; uniform float uRi;
uniform sampler2D uDent; uniform sampler2D uRise; uniform float uRiseK; uniform sampler2D uGlaze; uniform float uFace; uniform float uReset;
uniform vec3 uWaxBlue; uniform vec3 uWaxMilk; uniform vec3 uWaxYellow;
uniform vec3 uFoam; uniform vec3 uPore; uniform vec3 uSprinklePink;
uniform vec3 uSprinkleRed; uniform vec3 uSprinkleGreen;
uniform vec3 uSprinkleBlue; uniform vec3 uSprinkleYellow;
uniform vec3 uMonoColor; uniform float uMono;
uniform float uSprinkles;
varying vec2 vUv;
float sdRR(vec2 p, vec2 c, vec2 hs, float r){ vec2 q=abs(p-c)-hs+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
float sdO(vec2 p){ return sdRR(p, uRes*.5, uRes*.5, uRo); }
float sdI(vec2 p){ vec2 a=uIns.xy; vec2 b=uRes-uIns.zw; return sdRR(p,(a+b)*.5,(b-a)*.5,uRi); }
float prof(vec2 p, out float amp){
  float a=max(-sdO(p),0.); float b=max(sdI(p),0.); float w=a+b+1e-3; float t=a/w;
  amp=min(w,64.)/64.; float x=clamp(4.*t*(1.-t),0.,1.); return pow(x,.55);
}
// Rise-back runs here: uRise holds what still has to rise, uRiseK eases 0 to -1.
float dent0(vec2 p){ vec2 q=p/uRes; return ((texture2D(uDent,q).r*4.-.5)+(texture2D(uRise,q).r*4.-.5)*uRiseK)*uReset; }
float dent(vec2 p){
  float s=dent0(p)*.25;
  s+=(dent0(p+vec2(3.,0.))+dent0(p-vec2(3.,0.))+dent0(p+vec2(0.,3.))+dent0(p-vec2(0.,3.)))*.125;
  s+=(dent0(p+vec2(2.5,2.5))+dent0(p-vec2(2.5,2.5))+dent0(p+vec2(2.5,-2.5))+dent0(p-vec2(2.5,-2.5)))*.0625;
  return s;
}
float broken(vec2 p){ return texture2D(uGlaze,p/uRes).r*uReset; }
float H(vec2 p){ float amp; float pr=prof(p,amp); return 24.*amp*pr*(1.-0.8*dent(p))-3.5*broken(p); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y); }
// Broad clouds blend without turbulent marble streaks.
vec3 wax(vec2 p){
  float blue=smoothstep(.18,.85,noise(p/155.+vec2(3.,7.)));
  float yellow=smoothstep(.3,.85,noise(p/190.+vec2(11.,2.)));
  return mix(mix(uWaxMilk,uWaxBlue,blue*.78),uWaxYellow,yellow*.68);
}
float pores(vec2 p){
  vec2 cell=floor(p), f=fract(p); float nearest=2.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 g=vec2(float(x),float(y));
    vec2 seed=vec2(hash(cell+g),hash(cell+g+19.3));
    nearest=min(nearest,length(g+seed-f));
  }
  return 1.-smoothstep(.07,.28,nearest);
}
vec3 sprinkleColor(float k){
  if(k<1.) return uSprinklePink;
  if(k<2.) return uSprinkleYellow;
  if(k<3.) return uSprinkleBlue;
  if(k<4.) return uSprinkleRed;
  return uSprinkleGreen;
}
vec3 sprinkles(vec2 p,vec3 col,float coat){
  vec2 cell=floor(p/24.); float seed=hash(cell);
  vec2 center=(cell+.25+.5*vec2(hash(cell+8.2),hash(cell+21.7)))*24.;
  vec2 q=p-center; float angle=seed*6.283;
  vec2 axis=vec2(cos(angle),sin(angle));
  float rod=length(q-axis*clamp(dot(q,axis),-3.,3.));
  vec2 shadowQ=q-vec2(1.1,1.5);
  float shadow=length(shadowQ-axis*clamp(dot(shadowQ,axis),-3.,3.));
  float show=step(.35,seed)*coat;
  vec2 faceCenter=vec2(uRes.x*.5,uRes.y-uIns.w*.5);
  show*=smoothstep(32.,43.,length((p-faceCenter)/vec2(1.,.55)));
  col*=1.-(1.-smoothstep(1.,3.,shadow))*.18*show;
  float coverage=(1.-smoothstep(1.1,1.7,rod))*show;
  vec3 color=sprinkleColor(floor(hash(cell+2.1)*5.));
  color=mix(color,uWaxMilk,.24*(1.-smoothstep(0.,1.5,rod)));
  return mix(col,color,coverage);
}
float segment(vec2 p, vec2 a, vec2 b){
  vec2 v=b-a; return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));
}
vec3 face(vec2 p, vec3 col, float hole){
  vec2 center=vec2(uRes.x*.5,uRes.y-uIns.w*.5);
  vec2 q=p-center;
  // Paint adheres to the same surface: the dent's slope stretches and bends it.
  vec2 slope=vec2(dent(p+vec2(2.,0.))-dent(p-vec2(2.,0.)),dent(p+vec2(0.,2.))-dent(p-vec2(0.,2.)));
  q+=slope*75.;
  q.y/=1.-dent(p)*.22;
  vec2 eye=vec2(abs(q.x)-18.,q.y+5.);
  float softness=hole*.5;
  float open=1.-smoothstep(2.-softness,3.+softness,length(eye/vec2(1.,1.25)));
  float closed=1.-smoothstep(1.1-softness,2.1+softness,min(segment(eye,vec2(-4.,2.),vec2(0.,-2.)),segment(eye,vec2(0.,-2.),vec2(4.,2.))));
  float eyes=mix(open,closed,uFace);
  float smile=(1.-smoothstep(.9,1.8,abs(length(q-vec2(0.,5.))-6.)))*smoothstep(5.,6.,q.y);
  vec2 cheek=vec2((abs(q.x)-29.)/8.,(q.y-4.)/4.);
  float blush=(1.-smoothstep(.4,1.,length(cheek)))*mix(.5,.85,uFace);
  col=mix(col,vec3(1.,.45,.65)*(.82+.18*dot(col,vec3(.333))),blush);
  return mix(col,vec3(.29,.137,.22),max(eyes,smile)*mix(.94,.84,hole));
}
void main(){
  vec2 p=vec2(vUv.x,1.-vUv.y)*uRes;
  float so=sdO(p), si=sdI(p);
  float a=clamp(.5-so,0.,1.)*clamp(si+.5,0.,1.);
  if(a<=0.) discard;
  float e=2.;
  float hx=H(p+vec2(e,0.))-H(p-vec2(e,0.));
  float hy=H(p+vec2(0.,e))-H(p-vec2(0.,e));
  vec3 N=normalize(vec3(-hx/(2.*e),-hy/(2.*e),1.));
  vec3 L=normalize(vec3(-.55,-.65,.75));
  vec3 V=vec3(0.,0.,1.);
  float signedDent=dent(p);float d=max(0.,signedDent);float bulge=max(0.,-signedDent);
  float amp; float pr=prof(p,amp);
  float hole=broken(p); float coat=1.-hole;
  float neighboring=(broken(p+vec2(4.,0.))+broken(p-vec2(4.,0.))+broken(p+vec2(0.,4.))+broken(p-vec2(0.,4.)))*.25;
  float cut=coat*smoothstep(.02,.32,neighboring);
  float under=hole*smoothstep(.02,.5,1.-neighboring);
  float pore=pores(p/2.2);
  float fiber=noise(p*vec2(1.8,.5));
  vec3 foam=mix(uFoam,uPore,pore*.18)+(fiber-.5)*.012;
  vec3 shell=wax(p);
  // Pale 3–4px cut edges glow softly and cast a shadow on exposed foam.
  shell=mix(shell,uWaxMilk,cut*.28);
  vec3 col=mix(shell,foam,hole);
  float lum=dot(col,vec3(.299,.587,.114));
  col=mix(vec3(lum),col,1.+.3*d)*(1.-.07*d);
  float diff=clamp(dot(N,L)*.38+.67,0.,1.);
  float dl=dent(p+vec2(-.55,-.65)*9.);
  float sh=clamp((d-dl)*1.4,0.,1.)*.24+d*.04;
  sh+=(1.-smoothstep(0.,10.,si))*.2+under*.2;
  float nh=max(dot(N,normalize(L+V)),0.);
  // Broad satin reflection under a restrained clear-coat sheen, never foam shine.
  float wall=max(0.,dent(p+vec2(-.55,-.65)*5.)-signedDent);
  float spec=coat*(pow(nh,8.)*.12+pow(nh,95.)*.06)+hole*(pow(nh,3.)*.045+wall*.08+bulge*.12);
  float rim=clamp(dot(N.xy,vec2(.55,.65)),0.,1.);
  sh=clamp(sh+rim*.18,0.,.6);
  float thin=1.-pr*amp;
  vec3 glow=mix(shell,uWaxYellow,.15)*coat*(.11*thin+.065*cut);
  vec3 c=col*diff*(1.-sh)+glow+uWaxMilk*spec+col*.065;
  {
    float monoLum=dot(uMonoColor,vec3(.299,.587,.114));
    vec3 velvet=mix(mix(vec3(monoLum),uMonoColor,.92),vec3(1.),.07)+(noise(p*2.)-.5)*.006;
    vec3 base=mix(uMonoColor,velvet,hole);
    float monoDiffuse=clamp(dot(N,L)*.48+.57,0.,1.);
    float streak=pow(nh,150.);
    float clearcoat=coat*(pow(nh,14.)*.16+streak*.2);
    float lip=coat*smoothstep(.03,.3,(broken(p+vec2(1.5,0.))+broken(p-vec2(1.5,0.))+broken(p+vec2(0.,1.5))+broken(p-vec2(0.,1.5)))*.25);
    vec3 monoColor=base*(monoDiffuse*(1.-sh*.8)+.12)+vec3(1.)*(clearcoat+lip*.24+hole*(wall*.05+bulge*.08));
    c=mix(c,monoColor,uMono);
  }
  if(uSprinkles>0.) c=mix(c,sprinkles(p,c,coat),uSprinkles);
  // Soft-toy light: follows the rounded outline and is sampled through the dent normal, so it bends into dents.
  {
    vec2 q=p+N.xy*10.;
    float de=-sdO(q);
    vec2 gn=normalize(vec2(sdO(p+vec2(1.,0.))-sdO(p-vec2(1.,0.)),sdO(p+vec2(0.,1.))-sdO(p-vec2(0.,1.)))+1e-4);
    float soft=mix(1.,.7,uMono);
    float up=smoothstep(-.15,.85,-gn.y);
    float topLight=exp(-pow((de-6.)/5.,2.))*.26+exp(-pow((de-10.)/14.,2.))*.09;
    float cornerY=uIns.y*.55+3.;
    float spot=exp(-pow(length((q-vec2(uRo*.62,cornerY))/vec2(9.,3.6)),2.)*2.2)*.55
      +exp(-pow(length((q-vec2(uRo*.62+17.,cornerY-1.))/vec2(4.,1.8)),2.)*2.2)*.4
      +exp(-pow(length((q-vec2(uRes.x-uRo*.62,cornerY))/vec2(5.,2.2)),2.)*2.2)*.35;
    float bounce=exp(-pow((de-9.)/7.,2.))*smoothstep(.3,.95,gn.y)*.07;
    float falloff=clamp(gn.y*.9+abs(gn.x)*.6,0.,1.)*(1.-smoothstep(0.,24.,-so));
    float cushion=(1.-smoothstep(0.,8.,si))*mix(.06,.13,smoothstep(0.,1.,(uIns.y+12.-p.y)/24.+.5));
    c*=1.-(.1*falloff+cushion);
    vec3 lightCol=mix(vec3(1.),uWaxMilk,.25);
    c+=lightCol*coat*soft*(topLight*up+spot*mix(1.,.6,uMono)+bounce)*(1.-.6*clamp(d,0.,1.));
    c=min(c,vec3(1.));
  }
  c=face(p,c,hole);
  float crack=texture2D(uGlaze,p/uRes).g*coat*uReset;
  float crackShadow=texture2D(uGlaze,(p-vec2(.8,.9))/uRes).g*coat*uReset;
  vec3 glazeTint=mix(shell,uMonoColor,uMono);
  c=mix(c,glazeTint*.72,crack*.6);
  c=mix(c,mix(glazeTint,uWaxMilk,.32),max(0.,crackShadow-crack)*.45);
  // Fissures cross the printed glaze face; the softer inside face remains below.
  float alpha=a*(.9+.08*pr);
  gl_FragColor=vec4(c*alpha,alpha);
}`;

export interface FrameRenderer {
  resize(w: number, h: number, insets: { l: number; t: number; r: number; b: number }): void;
  render(): void;
  dirtyHeight(bounds: Region): void;
  /** Pending rise-back contribution, shader-eased by riseK (0 to -1). */
  dirtyRise(bounds: Region): void;
  rise: Float32Array;
  riseK: number;
  onRestore?: () => void;
  dirtyCoating(x0:number,y0:number,x1:number,y1:number): void;
  resetAmount: number;
  updatePalette(): void;
  paletteAnimating(): boolean;
  snapshot(x: number, y: number, radius: number): HTMLCanvasElement;
  dent: Float32Array;
  glaze: Float32Array;
  coating: HTMLCanvasElement;
  dw: number;
  dh: number;
  width: number;
  height: number;
  face: number;
  mono: number;
  destroy(): void;
}

export function createFrameRenderer(canvas: HTMLCanvasElement): FrameRenderer | null {
  const opts: WebGLContextAttributes = { premultipliedAlpha: true, antialias: false, alpha: true };
  const gl2 = canvas.getContext("webgl2", opts) as WebGL2RenderingContext | null;
  const gl = (gl2 ?? canvas.getContext("webgl", opts)) as WebGLRenderingContext | null;
  if (!gl) return null;

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) throw new Error("Could not create frame shader");
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  let prog!: WebGLProgram, buf: WebGLBuffer|null=null, tex: WebGLTexture|null=null, glazeTex: WebGLTexture|null=null, riseTex: WebGLTexture|null=null;
  const uniforms=new Map<string,WebGLUniformLocation|null>();
  const u = (n: string) => {if(!uniforms.has(n))uniforms.set(n,gl.getUniformLocation(prog,n));return uniforms.get(n)??null;};
  const linear=()=>{
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  /** Builds every GL resource; runs again after a lost context is restored. */
  const setup = () => {
    try {
      const program = gl.createProgram();
      if (!program) return false;
      prog = program;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    } catch {
      return false;
    }
    uniforms.clear();
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(u("uDent"), 0);
    gl.uniform1i(u("uGlaze"), 1);
    gl.uniform1i(u("uRise"), 2);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    gl.activeTexture(gl.TEXTURE2); riseTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, riseTex); linear();
    gl.activeTexture(gl.TEXTURE1); glazeTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glazeTex); linear();
    gl.activeTexture(gl.TEXTURE0); tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); linear();
    return true;
  };
  if (!setup()) return null;
  let lost = false;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    if (!setup()) return;
    r.resize(r.width, r.height, lastInsets);
    r.onRestore?.();
  });
  let lastInsets = { l: 0, t: 0, r: 0, b: 0 };
  const palette = [
    ["uWaxBlue", "--sq-wax-blue"], ["uWaxMilk", "--sq-wax-milk"], ["uWaxYellow", "--sq-wax-yellow"],
    ["uFoam", "--sq-foam"], ["uPore", "--sq-foam-pore"], ["uSprinklePink", "--sq-sprinkle-pink"],
    ["uSprinkleRed", "--sq-sprinkle-red"], ["uSprinkleGreen", "--sq-sprinkle-green"],
    ["uSprinkleBlue", "--sq-sprinkle-blue"], ["uSprinkleYellow", "--sq-sprinkle-yellow"],
    ["uMonoColor", "--sq-mono-color"],
  ];
  let paletteStart = -Infinity;
  let currentColors: number[][] = [];
  let fromColors: number[][] = [];
  let targetColors: number[][] = [];
  let currentMono = 0, fromMono = 0, targetMono = 0;
  const coating = document.createElement("canvas");
  // Reused upload buffers: no per-frame allocations, and no 2D readbacks.
  const size=mapSize(coarsePointer());
  const heightScratch=gl2?new Float32Array(size*size):new Uint8Array(size*size);
  const coatScratch=document.createElement("canvas");
  const snapshots=Array.from({length:8},()=>document.createElement("canvas"));let snapshotIndex=0;
  let heightDirty:Region|null=null, coatDirty:Region|null=null, riseDirty:Region|null=null;
  let fullUpload=true;

  const material=document.createElement("canvas");let materialJob=0;
  const r: FrameRenderer = {
    resetAmount:1,
    dirtyHeight(bounds){heightDirty=union(heightDirty,bounds);},
    dirtyRise(bounds){riseDirty=union(riseDirty,bounds);},
    riseK:0,
    dirtyCoating(x0,y0,x1,y1){const scale=coating.width/r.width;coatDirty=union(coatDirty,region(coating.width,coating.height,x0*scale-2,y0*scale-2,x1*scale+2,y1*scale+2));},
    dent: new Float32Array(size*size),
    rise: new Float32Array(size*size),
    glaze: new Float32Array(size*size),
    coating,
    dw: size,
    dh: size,
    width: 1,
    height: 1,
    face: 0,
    mono: 0,
    updatePalette() {
      const css = getComputedStyle(canvas);
      const next = palette.map((pair) => {
        const value = css.getPropertyValue(pair[1] ?? "").trim().replace("#", "");
        const color = Number.parseInt(value, 16);
        return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
      });
      if (JSON.stringify(next) === JSON.stringify(targetColors) && r.mono === targetMono) return;
      fromMono = currentMono;
      targetMono = r.mono;
      fromColors = currentColors.length ? currentColors.map((color) => [...color]) : next;
      targetColors = next;
      if (!currentColors.length) currentColors = next;
      paletteStart = performance.now();
    },
    paletteAnimating() { return performance.now() - paletteStart < COLOR_FADE_MS; },
    resize(w, h, ins) {
      r.updatePalette();
      r.width=w; r.height=h; lastInsets=ins;
      const dpr = canvasDpr(window.devicePixelRatio || 1, coarsePointer());
      const bw=Math.max(1,Math.round(w*dpr)),bh=Math.max(1,Math.round(h*dpr));
      if(canvas.width!==bw)canvas.width=bw;
      if(canvas.height!==bh)canvas.height=bh;
      const cs=coatingScale(coarsePointer()),cw=Math.max(1,Math.round(canvas.width*cs)),ch=Math.max(1,Math.round(canvas.height*cs));
      if (coating.width !== cw || coating.height !== ch) {
        coating.width=cw; coating.height=ch;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u("uRes"), w, h);
      gl.uniform4f(u("uIns"), ins.l, ins.t, ins.r, ins.b);
      gl.uniform1f(u("uRo"), FRAME.outerRadius);
      gl.uniform1f(u("uRi"), w < 480 ? FRAME.innerRadius + 4 : FRAME.innerRadius);
      fullUpload=true;
    },
    render() {
      if (lost || gl.isContextLost()) return;
      const t = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : Math.min(1, (performance.now() - paletteStart) / COLOR_FADE_MS);
      currentMono = fromMono + (targetMono - fromMono) * t;
      gl.uniform1f(u("uMono"), currentMono);
      gl.uniform1f(u("uSprinkles"), 1 - currentMono);
      currentColors = targetColors.map((color, i) => color.map((value, j) => (fromColors[i]?.[j] ?? value) + (value - (fromColors[i]?.[j] ?? value)) * t));
      palette.forEach((pair, i) => { const color = currentColors[i]; if (pair[0] && color) gl.uniform3f(u(pair[0]), color[0] ?? 0, color[1] ?? 0, color[2] ?? 0); });
      gl.uniform1f(u("uFace"), r.face);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1f(u("uReset"),r.resetAmount);
      // Height data already lives in normalized coordinates: retain its texture.
      // Linear texture sampling gives the same bilinear surface at every DPR.
      gl.uniform1f(u("uRiseK"),r.riseK);
      const upload=(data:Float32Array,dirty:Region|null)=>{
        if(fullUpload){
          if(gl2)gl2.texImage2D(gl2.TEXTURE_2D,0,gl2.R16F,r.dw,r.dh,0,gl2.RED,gl2.FLOAT,null);
          else gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,r.dw,r.dh,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,null);
          dirty=region(r.dw,r.dh,0,0,r.dw-1,r.dh-1);
        }
        if(!dirty)return;
        // Only the changed rectangle is converted and uploaded.
        const b=dirty,w=b.x1-b.x0+1,h=b.y1-b.y0+1;
        const values=heightScratch;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const value=((data[(y+b.y0)*r.dw+x+b.x0]??0)+.5)/4;values[y*w+x]=gl2?value:Math.round(value*255);}
        gl.texSubImage2D(gl.TEXTURE_2D,0,b.x0,b.y0,w,h,gl2?gl2.RED:gl.LUMINANCE,gl2?gl.FLOAT:gl.UNSIGNED_BYTE,values);
      };
      upload(r.dent,heightDirty);heightDirty=null;
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,riseTex);
      upload(r.rise,riseDirty);riseDirty=null;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,glazeTex);
      if(fullUpload){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,coating.width,coating.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);coatDirty=region(coating.width,coating.height,0,0,coating.width-1,coating.height-1);}
      if(coatDirty){
        const b=coatDirty,w=b.x1-b.x0+1,h=b.y1-b.y0+1;
        if(gl2){
          // WebGL2 uploads the dirty sub-rectangle straight from the canvas.
          gl2.pixelStorei(gl2.UNPACK_SKIP_PIXELS,b.x0);gl2.pixelStorei(gl2.UNPACK_SKIP_ROWS,b.y0);
          gl2.texSubImage2D(gl2.TEXTURE_2D,0,b.x0,b.y0,w,h,gl2.RGBA,gl2.UNSIGNED_BYTE,coating);
          gl2.pixelStorei(gl2.UNPACK_SKIP_PIXELS,0);gl2.pixelStorei(gl2.UNPACK_SKIP_ROWS,0);
        }else{
          if(coatScratch.width!==w)coatScratch.width=w;if(coatScratch.height!==h)coatScratch.height=h;
          const sc=coatScratch.getContext("2d");
          if(sc){sc.clearRect(0,0,w,h);sc.drawImage(coating,b.x0,b.y0,w,h,0,0,w,h);gl.texSubImage2D(gl.TEXTURE_2D,0,b.x0,b.y0,gl.RGBA,gl.UNSIGNED_BYTE,coatScratch);}
        }
        coatDirty=null;
      }
      const capture=fullUpload;fullUpload=false;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if(capture||t<1){clearTimeout(materialJob);materialJob=window.setTimeout(()=>{const copy=()=>{if(material.width!==canvas.width||material.height!==canvas.height){material.width=canvas.width;material.height=canvas.height;}const m=material.getContext("2d");m?.clearRect(0,0,material.width,material.height);m?.drawImage(canvas,0,0);};const idle=(window as Window&{requestIdleCallback?:(cb:()=>void,o?:{timeout:number})=>number}).requestIdleCallback;if(idle)idle(copy,{timeout:500});else copy();},150);}

    },
    snapshot(x, y, radius) {
      const image = snapshots[snapshotIndex++%snapshots.length] ?? document.createElement("canvas");
      // Local fragments are tiny textured quads; avoid full-frame canvas clones.
      const side = Math.ceil(radius * 4); if (image.width !== side) { image.width = side; image.height = side; }
      const context = image.getContext("2d");context?.clearRect(0,0,image.width,image.height);
      const scale = canvas.width / (r.width || 1);
      context?.drawImage(material, (x - radius) * scale, (y - radius) * scale, radius * 2 * scale, radius * 2 * scale, 0, 0, image.width, image.height);
      return image;
    },
    destroy() {
      clearTimeout(materialJob);gl.deleteTexture(tex);gl.deleteTexture(riseTex);
      gl.deleteTexture(glazeTex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    },
  };
  return r;
}

/** Signed distance to a rounded rect (CSS px). */
function sdRR(px: number, py: number, cx: number, cy: number, hx: number, hy: number, rad: number) {
  const qx = Math.abs(px - cx) - hx + rad, qy = Math.abs(py - cy) - hy + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}

/** True when a point (CSS px) lies on the frame ring. */
export function isOnRing(x: number, y: number, w: number, h: number, ins: { l: number; t: number; r: number; b: number }) {
  const o = sdRR(x, y, w / 2, h / 2, w / 2, h / 2, FRAME.outerRadius);
  const ax = ins.l, ay = ins.t, bx = w - ins.r, by = h - ins.b;
  const i = sdRR(x, y, (ax + bx) / 2, (ay + by) / 2, (bx - ax) / 2, (by - ay) / 2, FRAME.innerRadius);
  return o < 0 && i > 0;
}

/** Gaussian tails span the map, without a radius cutoff or disc edge. */
export function stampDent(r: FrameRenderer, cssX: number, cssY: number, radiusCss: number, depth: number, rate: number) {
  const inv = 1 / (2 * radiusCss * radiusCss);
  const bounds=region(r.dw,r.dh,(cssX-radiusCss*6)*r.dw/r.width,(cssY-radiusCss*6)*r.dh/r.height,(cssX+radiusCss*6)*r.dw/r.width,(cssY+radiusCss*6)*r.dh/r.height);
  r.dirtyHeight?.(bounds);
  for (let y = bounds.y0; y <= bounds.y1; y++) {
    for (let x = bounds.x0; x <= bounds.x1; x++) {
      const dx=x*r.width/r.dw-cssX,dy=y*r.height/r.dh-cssY;
      const weight=Math.exp(-(dx*dx+dy*dy)*inv)*tailWeight(Math.hypot(dx,dy)/radiusCss);
      const target = depth * weight;
      const i = y * r.dw + x;
      const cur = r.dent[i] ?? 0;
      const delta=target-cur,softness=.002*weight;
      r.dent[i]=cur+.5*(delta+Math.sqrt(delta*delta+softness*softness))*rate;
    }
  }
}

let smoothScratch=new Float32Array(512*512);
/** Lightly blur a region of the height map so overlapping dents and grooves blend smoothly. */
export function smoothDents(r: FrameRenderer, cssX0: number, cssY0: number, cssX1: number, cssY1: number) {
  const bounds=region(r.dw,r.dh,(cssX0-12)*r.dw/r.width,(cssY0-12)*r.dh/r.height,(cssX1+12)*r.dw/r.width,(cssY1+12)*r.dh/r.height);
  const {x0,x1,y0,y1}=bounds;r.dirtyHeight?.(bounds);
  if (x1 <= x0 || y1 <= y0) return;
  const w = r.dw, src = r.dent;
  const ox=Math.max(1,Math.round(2.5*r.dw/r.width)),oy=Math.max(1,Math.round(2.5*r.dh/r.height));
  const sample=(x:number,y:number)=>src[Math.max(0,Math.min(r.dh-1,y))*w+Math.max(0,Math.min(w-1,x))]??0;
  const need=(x1 - x0 + 1) * (y1 - y0 + 1);
  if(smoothScratch.length<need)smoothScratch=new Float32Array(need);
  const tmp = smoothScratch;
  let k = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx=x*r.width/r.dw-(cssX0+cssX1)*.5,dy=y*r.height/r.dh-(cssY0+cssY1)*.5;
      const rx=Math.abs(cssX1-cssX0)*.5+2.5,ry=Math.abs(cssY1-cssY0)*.5+2.5;
      const weight=Math.exp(-.5*(dx*dx/(rx*rx)+dy*dy/(ry*ry)));
      const blurred=sample(x,y)*.25+(sample(x-ox,y)+sample(x+ox,y)+sample(x,y-oy)+sample(x,y+oy))*.125+(sample(x-ox,y-oy)+sample(x+ox,y-oy)+sample(x-ox,y+oy)+sample(x+ox,y+oy))*.0625;
      const edge=Math.min(x-x0,x1-x,y-y0,y1-y);const blend=Math.min(1,edge/Math.max(ox,oy,1));
      tmp[k++]=sample(x,y)+(blurred-sample(x,y))*weight*blend*blend*(3-2*blend);
    }
  k = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) src[y * w + x] = tmp[k++] ?? 0;
}
