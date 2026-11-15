/**
 * Raw WebGL renderer for the squishy frame. A CPU height map (Float32Array,
 * half resolution) stores permanent dents; it is uploaded as a texture each
 * frame and lit in the fragment shader.
 */
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
uniform sampler2D uDent; varying vec2 vUv;
float sdRR(vec2 p, vec2 c, vec2 hs, float r){ vec2 q=abs(p-c)-hs+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
float sdO(vec2 p){ return sdRR(p, uRes*.5, uRes*.5, uRo); }
float sdI(vec2 p){ vec2 a=uIns.xy; vec2 b=uRes-uIns.zw; return sdRR(p,(a+b)*.5,(b-a)*.5,uRi); }
float prof(vec2 p, out float amp){
  float a=max(-sdO(p),0.); float b=max(sdI(p),0.); float w=a+b+1e-3; float t=a/w;
  amp=min(w,64.)/64.; float x=clamp(4.*t*(1.-t),0.,1.); return pow(x,.55);
}
float dent0(vec2 p){ return texture2D(uDent, p/uRes).r; }
float dent(vec2 p){
  float s=dent0(p)*.25;
  s+=(dent0(p+vec2(3.,0.))+dent0(p-vec2(3.,0.))+dent0(p+vec2(0.,3.))+dent0(p-vec2(0.,3.)))*.125;
  s+=(dent0(p+vec2(2.5,2.5))+dent0(p-vec2(2.5,2.5))+dent0(p+vec2(2.5,-2.5))+dent0(p-vec2(2.5,-2.5)))*.0625;
  return s;
}
float H(vec2 p){ float amp; float pr=prof(p,amp); return 24.*amp*pr*(1.-0.8*dent(p)); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y); }
float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+17.; a*=.5; } return v; }
vec3 pick(float k){
  if(k<.5) return vec3(1.,.93,.62);      // yellow
  if(k<1.5) return vec3(1.,.74,.84);     // pink
  if(k<2.5) return vec3(.70,.95,.84);    // mint
  if(k<3.5) return vec3(.82,.76,1.);     // lilac
  if(k<4.5) return vec3(1.,.80,.66);     // peach
  return vec3(1.,.98,.97);               // white
}
vec3 marble(vec2 p){
  vec2 q=p/170.; vec2 w=vec2(fbm(q),fbm(q+5.2));
  float m=fbm(q+2.6*w+vec2(1.7,9.2));
  float x=mod(m*4.5+w.x*2.,6.); float k=floor(x); float t=fract(x);
  t=t*t*(3.-2.*t);
  vec3 c=mix(pick(k),pick(mod(k+1.,6.)),t);
  float cloud=fbm(q*1.7+w*1.3);
  c=mix(c,vec3(1.,.99,.98),smoothstep(.45,.8,cloud)*.45);
  c+=(hash(floor(p))-.5)*.018;
  return c;
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
  float d=dent(p);
  float amp; float pr=prof(p,amp);
  vec3 col=marble(p);
  // pressed material: darker and more saturated
  float lum=dot(col,vec3(.299,.587,.114));
  col=mix(vec3(lum),col,1.+.45*d)*(1.-.08*d);
  float diff=clamp(dot(N,L)*.5+.55,0.,1.);
  // soft shadow inside dents (rim toward the light occludes)
  float dl=dent(p+vec2(-.55,-.65)*9.);
  float sh=clamp((d-dl)*1.4,0.,1.)*.28 + d*.04;
  float inner=1.-smoothstep(0.,10.,si);
  sh=clamp(sh+inner*.22,0.,.6);
  vec3 Hh=normalize(L+V);
  float nh=max(dot(N,Hh),0.);
  float spec=pow(nh,70.)*.6+pow(nh,10.)*.22;
  float rim=clamp(dot(N.xy,vec2(.55,.65)),0.,1.);
  sh=clamp(sh+rim*.22,0.,.6);
  // translucent jelly glow: thinner areas let more light through
  float thin=1.-pr*amp;
  vec3 glow=col*vec3(1.05,1.,.95)*(.16*thin+.1*pow(1.-max(dot(N,V),0.),2.));
  vec3 c=col*diff*(1.-sh)+glow+vec3(1.)*spec;
  c+=col*.06;
  float alpha=a*(.9+.08*pr);
  gl_FragColor=vec4(c*alpha,alpha);
}`;

export interface FrameRenderer {
  resize(w: number, h: number, insets: { l: number; t: number; r: number; b: number }): void;
  render(): void;
  dent: Float32Array;
  dw: number;
  dh: number;
  destroy(): void;
}

export function createFrameRenderer(canvas: HTMLCanvasElement): FrameRenderer | null {
  const opts: WebGLContextAttributes = { premultipliedAlpha: true, antialias: false, alpha: true };
  const gl2 = canvas.getContext("webgl2", opts) as WebGL2RenderingContext | null;
  const gl = (gl2 ?? canvas.getContext("webgl", opts)) as WebGLRenderingContext | null;
  if (!gl) return null;

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  } catch {
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = u("uRes"), uIns = u("uIns"), uRo = u("uRo"), uRi = u("uRi");
  gl.uniform1i(u("uDent"), 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let bytes = new Uint8Array(0);
  const r: FrameRenderer = {
    dent: new Float32Array(0),
    dw: 0,
    dh: 0,
    resize(w, h, ins) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, w, h);
      gl.uniform4f(uIns, ins.l, ins.t, ins.r, ins.b);
      gl.uniform1f(uRo, FRAME.outerRadius);
      gl.uniform1f(uRi, FRAME.innerRadius);
      const nw = Math.max(1, Math.ceil(w / 2)), nh = Math.max(1, Math.ceil(h / 2));
      if (nw !== r.dw || nh !== r.dh) {
        const next = new Float32Array(nw * nh);
        if (r.dw && r.dh) {
          for (let y = 0; y < nh; y++) {
            const sy = Math.min(r.dh - 1, Math.floor((y * r.dh) / nh));
            for (let x = 0; x < nw; x++) next[y * nw + x] = r.dent[sy * r.dw + Math.min(r.dw - 1, Math.floor((x * r.dw) / nw))]!;
          }
        }
        r.dent = next;
        r.dw = nw;
        r.dh = nh;
        bytes = new Uint8Array(nw * nh);
      }
    },
    render() {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (gl2) {
        gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.R16F, r.dw, r.dh, 0, gl2.RED, gl2.FLOAT, r.dent);
      } else {
        for (let i = 0; i < r.dent.length; i++) bytes[i] = Math.round(r.dent[i]! * 255);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, r.dw, r.dh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteTexture(tex);
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

/** Press a soft gaussian dent into the height map. Dents only deepen, never spring back. */
export function stampDent(r: FrameRenderer, cssX: number, cssY: number, radiusCss: number, depth: number, rate: number) {
  const cx = cssX / 2, cy = cssY / 2, rad = radiusCss / 2;
  const ext = Math.ceil(rad * 2.2);
  const x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(r.dw - 1, Math.ceil(cx + ext));
  const y0 = Math.max(0, Math.floor(cy - ext)), y1 = Math.min(r.dh - 1, Math.ceil(cy + ext));
  const inv = 1 / (2 * rad * rad);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      const target = depth * Math.exp(-(dx * dx + dy * dy) * inv);
      const i = y * r.dw + x;
      const cur = r.dent[i]!;
      if (target > cur) r.dent[i] = cur + (target - cur) * rate;
    }
  }
}

/** Lightly blur a region of the height map so overlapping dents and grooves blend smoothly. */
export function smoothDents(r: FrameRenderer, cssX0: number, cssY0: number, cssX1: number, cssY1: number) {
  const x0 = Math.max(1, Math.floor(Math.min(cssX0, cssX1) / 2) - 2), x1 = Math.min(r.dw - 2, Math.ceil(Math.max(cssX0, cssX1) / 2) + 2);
  const y0 = Math.max(1, Math.floor(Math.min(cssY0, cssY1) / 2) - 2), y1 = Math.min(r.dh - 2, Math.ceil(Math.max(cssY0, cssY1) / 2) + 2);
  if (x1 <= x0 || y1 <= y0) return;
  const w = r.dw, src = r.dent;
  const tmp = new Float32Array((x1 - x0 + 1) * (y1 - y0 + 1));
  let k = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      tmp[k++] = src[i]! * 0.4 + (src[i - 1]! + src[i + 1]! + src[i - w]! + src[i + w]!) * 0.1 + (src[i - w - 1]! + src[i - w + 1]! + src[i + w - 1]! + src[i + w + 1]!) * 0.05;
    }
  k = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) src[y * w + x] = tmp[k++]!;
}
