/**
 * Squishy ASMR sounds. One function per sound so real recordings can be
 * swapped in later. Everything is synthesized with the Web Audio API.
 * Sounds are OFF by default.
 */
let enabled = false;
let ctx: AudioContext | null = null;

export function setSoundsEnabled(on: boolean) {
  enabled = on;
  if (on) getCtx()?.resume();
}
export function getSoundsEnabled() {
  return enabled;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function noiseBurst(opts: { dur: number; type: BiquadFilterType; freq: number; q: number; gain: number; sweepTo?: number; attack?: number }) {
  const c = getCtx();
  if (!enabled || !c) return;
  const len = Math.ceil(c.sampleRate * opts.dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = opts.type;
  f.Q.value = opts.q;
  const t = c.currentTime;
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + opts.dur + 0.02);
}

function sinePop(freq: number, to: number, dur: number, gain: number) {
  const c = getCtx();
  if (!enabled || !c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Soft wet squelch when pressing the frame or a control. */
export function playSquelch() {
  noiseBurst({ dur: 0.22, type: "bandpass", freq: 900, sweepTo: 260, q: 6, gain: 0.35, attack: 0.02 });
  sinePop(180, 90, 0.18, 0.08);
}

/** Soft pop on release. */
export function playPop() {
  sinePop(520, 900, 0.09, 0.14);
}

/** Crunch when baked crust breaks: a few small cracks, then the main crunch. `duration` in seconds. */
export function playCrunch(duration = 0.9) {
  const ms = duration * 1000;
  for (let i = 0; i < 3; i++) {
    setTimeout(() => noiseBurst({ dur: 0.025, type: "highpass", freq: 3500 + Math.random() * 2500, q: 1, gain: 0.12, attack: 0.002 }), (ms * 0.28 * i) / 3 + Math.random() * 20);
  }
  for (let i = 0; i < 5; i++) {
    setTimeout(() => noiseBurst({ dur: 0.05 + Math.random() * 0.05, type: "highpass", freq: 1800 + Math.random() * 2500, q: 0.8, gain: 0.3, attack: 0.002 }), ms * 0.3 + i * (ms * 0.3) / 5);
  }
}

/** Gentle squeeze for the stress ball. */
export function playSqueeze() {
  noiseBurst({ dur: 0.3, type: "lowpass", freq: 600, sweepTo: 1400, q: 3, gain: 0.25, attack: 0.06 });
}
