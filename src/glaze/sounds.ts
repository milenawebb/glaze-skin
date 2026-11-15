import squish1 from "./assets/sounds/squish-1.mp3.asset.json";
import squish2 from "./assets/sounds/squish-2.mp3.asset.json";
import squish3 from "./assets/sounds/squish-3.mp3.asset.json";
import crack1 from "./assets/sounds/crack-1.mp3.asset.json";
import crack2 from "./assets/sounds/crack-2.mp3.asset.json";
import shatter1 from "./assets/sounds/shatter-1.mp3.asset.json";
import shatter2 from "./assets/sounds/shatter-2.mp3.asset.json";
import crunch1 from "./assets/sounds/crunch-1.mp3.asset.json";
import crunch2 from "./assets/sounds/crunch-2.mp3.asset.json";
import crunch3 from "./assets/sounds/crunch-3.mp3.asset.json";

/** All recording playback lives here. */
const groups = {
  squish: [squish1.url, squish2.url, squish3.url],
  crack: [crack1.url, crack2.url],
  shatter: [shatter1.url, shatter2.url],
  crunch: [crunch1.url, crunch2.url, crunch3.url],
};
type Group = keyof typeof groups;
let enabled = false;
let ctx: AudioContext | null = null;
let master: BiquadFilterNode | null = null;
let loading: Promise<void> | null = null;
const buffers = new Map<string, AudioBuffer>();
const previous = new Map<Group, number>();
const active = new Set<AudioBufferSourceNode>();
const crunches = new Set<AudioBufferSourceNode>();
let lastCrunch = -Infinity;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createBiquadFilter();
      master.type = "highpass";
      master.frequency.value = 150;
      master.connect(ctx.destination);
    } catch { ctx = null; master = null; return null; }
  }
  return ctx;
}

export function unlockSounds() {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  void c.resume().catch(() => {});
  const unlock = c.createBufferSource();
  unlock.buffer = c.createBuffer(1, 1, c.sampleRate);
  if (!master) return;
  unlock.connect(master);
  unlock.onended = () => unlock.disconnect();
  unlock.start();
}

/** Preload on mount without requiring or consuming a user gesture. */
export function setSoundsEnabled(on: boolean, unlock = true) {
  enabled = on;
  if (!on) {
    for (const source of active) { try { source.stop(); } catch { /* Already ended. */ } }
    active.clear();
    crunches.clear();
    lastCrunch = -Infinity;
    return;
  }
  const c = getCtx();
  if (!c) return;
  if (unlock) unlockSounds();
  if (!loading) {
    loading = Promise.all(Object.values(groups).flat().map(async (url) => {
      if (buffers.has(url)) return;
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        buffers.set(url, await c.decodeAudioData(await response.arrayBuffer()));
      } catch { /* An unavailable recording must not interrupt the player. */ }
    })).then(() => { loading = null; });
  }
}

export function getSoundsEnabled() { return enabled; }

function recording(group: Group, depth = 0, volumeScale = 1) {
  // A source scheduled during resume starts as soon as Safari's context runs.
  if (!enabled || !ctx || !master || ctx.state === "closed") return;
  const c = ctx;
  const choices = groups[group].map((url, index) => ({ buffer: buffers.get(url), index }))
    .filter((item) => item.buffer && item.index !== previous.get(group));
  const choice = choices[Math.floor(Math.random() * choices.length)];
  if (!choice?.buffer) return;
  previous.set(group, choice.index);
  const source = c.createBufferSource();
  const gain = c.createGain();
  const rate = (group === "squish" ? 0.96 : 0.95) + Math.random() * (group === "squish" ? 0.09 : 0.1);
  const volume = 0.65 * volumeScale * (0.9 + Math.random() * 0.2);
  source.buffer = choice.buffer;
  source.connect(gain).connect(master);
  const update = (amount: number) => {
    const d = Math.max(0, Math.min(1, amount));
    source.playbackRate.setTargetAtTime(rate, c.currentTime, 0.04);
    gain.gain.setTargetAtTime(volume * (1 + d * (group === "squish" ? 0.06 : 0.2)), c.currentTime, 0.04);
  };
  update(depth);
  active.add(source);
  source.onended = () => {
    active.delete(source);
    crunches.delete(source);
    source.disconnect();
    gain.disconnect();
  };
  source.start();
  return { source, update };
}

/** Starts once at press-down; update the same voice as pressure/hold deepens. */
export function playSquelch(depth = 0) { return recording("squish", depth)?.update; }
/** Compatibility entry for a squeeze uses the same press recordings. */
export function playSqueeze(depth = 0) { return playSquelch(depth); }
/** A fresh stationary spot of frame glaze cracking. */
export function playCrack() { recording("crack"); }
/** The whole play-button or seek-bar glaze shattering. */
export function playShatter() { recording("shatter"); }
/** Controls use a single clip; ordinary cracks are quieter than shattering. */
export function playControlPress(glazed: boolean) {
  if (glazed) playShatter();
  else recording("crack", 0, 0.75);
}
/** Fresh frame-gloss drag only; shared limit also covers simultaneous fingers. */
export function playCrunch() {
  if (!enabled || !ctx || ctx.currentTime - lastCrunch < 0.15) return;
  if (crunches.size >= 2) {
    const oldest = crunches.values().next().value;
    if (oldest) { oldest.stop(); crunches.delete(oldest); }
  }
  const voice = recording("crunch");
  if (voice) {
    crunches.add(voice.source);
    lastCrunch = ctx.currentTime;
  }
}

/** Sound-only press tracking for controls; visuals remain owned by squish.ts. */
export function attachPressSounds(el: HTMLElement) {
  let held = false;
  const belongs = (target: EventTarget | null) => target instanceof Node && el.contains(target);
  const press = () => {
    const glaze = el.querySelector<HTMLElement>(".sq-crust");
    playControlPress(Boolean(glaze && !glaze.dataset["cracking"]));
  };
  const end = () => {
    if (!held) return;
    held = false;
    window.removeEventListener("pointerup", end, true);
    window.removeEventListener("pointercancel", end, true);
  };
  const down = (e: PointerEvent) => {
    if (!belongs(e.target) || e.button > 0 || held) return;
    held = true;
    press();
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
  };
  const keyDown = (e: KeyboardEvent) => {
    if (belongs(e.target) && !held && !e.repeat && (e.key === " " || e.key === "Enter" || (el.matches(".sq-seek") && (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End")))) {
      held = true;
      press();
    }
  };
  // Inspect glaze before React's handlers mark it cracking or remove it.
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("keydown", keyDown, true);
  el.addEventListener("keyup", end);
  return () => {
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("keydown", keyDown, true);
    el.removeEventListener("keyup", end);
    window.removeEventListener("pointerup", end, true);
    window.removeEventListener("pointercancel", end, true);
  };
}