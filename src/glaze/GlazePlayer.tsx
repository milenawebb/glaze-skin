import { Container, Hotkey, TimeSlider, createPlayer } from "@videojs/react";
import { videoFeatures } from "@videojs/react/video";
import { MuxVideo } from "@videojs/react/media/mux-video";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from "react";
import { GlazeFrame } from "./GlazeFrame";
import { crackCrust } from "./crust";
import { attachSquish, useSquish, useSquishAll } from "./squish";
import { vibratePress } from "./haptics";
import { attachFrameAction, CHOICE_GUARD_MS } from "./frame-control";
import { POPUP_SPEEDS, VOLUME_CLOSE_MS, CONTROLS_IDLE_MS, controlsVisible, videoTapActivity, isolateVolumeKey } from "./controls";
import { CAPTIONS_DEFAULT_ON, observeCaptionCues, isCaptionEngine } from "./captions";
import { COLORS, OPTIONS, readPreferences, savePreferences, type GlazeColor } from "./preferences";
import { playCrack, getSoundsBlocked, onSoundsBlockedChange, setSoundsEnabled, unlockSounds } from "./sounds";
import "./glaze.css";

export const glaze = createPlayer({ features: videoFeatures });
const { Player, usePlayer, useMedia } = glaze;

const IDLE_MS = CONTROLS_IDLE_MS;

export interface GlazePlayerProps {
  playbackId: string;
  /** Changing this number puffs the frame back to smooth and re-bakes the crust. */
  resetKey?: number;
  title?: string;
  /** Start with squish sounds on; a remembered viewer choice takes priority. */
  sounds?: boolean;
}

export function GlazePlayer({ playbackId, resetKey = 0, title = "Video", sounds = false }: GlazePlayerProps) {
  return (
    <Player>
      <GlazeSkin resetKey={resetKey} label={title} sounds={sounds}>
        <MuxVideo
          source={{ playbackId }}
          poster={`https://image.mux.com/${playbackId}/thumbnail.webp?time=1&width=1280`}
          playsInline
          crossOrigin="anonymous"
        >
          <track kind="captions" label="English" srcLang="en" src="/captions/glaze-asmr-demo.vtt" default />
        </MuxVideo>
      </GlazeSkin>
    </Player>
  );
}

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
};

export function GlazeSkin({ children, resetKey, label, sounds: startSounds = false }: { children: ReactNode; resetKey: number; label: string; sounds?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const flakeRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const [compact, setCompact] = useState(false);
  const [ar, setAr] = useState(16 / 9);
  const [active, setActive] = useState(true);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(CAPTIONS_DEFAULT_ON);
  const paused = usePlayer((s) => s.paused);
  const [crust, setCrust] = useState({ play: true, tube: true });
  const [localReset, setLocalReset] = useState(0);
  const [color, setColor] = useState<GlazeColor>("Rainbow");
  const glazeStyle = OPTIONS[color].glazeStyle;
  const [sounds, setSounds] = useState(startSounds);
  const [soundHint, setSoundHint] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  useEffect(() => { setSoundBlocked(getSoundsBlocked()); return onSoundsBlockedChange(setSoundBlocked); }, []);
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const colorOpenedAt = useRef(-Infinity);
  const choiceBlocked = () => performance.now() - colorOpenedAt.current < CHOICE_GUARD_MS;
  useEffect(() => {
    if (!colorOpen) return;
    colorRef.current?.querySelector<HTMLButtonElement>('.sq-color-choices button')?.focus();
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !colorRef.current?.contains(e.target)) {
        setColorOpen(false);
        if (compact) { e.stopPropagation(); if(e.cancelable)e.preventDefault(); }
      }
    };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setColorOpen(false); colorRef.current?.querySelector<HTMLButtonElement>(".sq-color-toggle")?.focus(); } };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", escape); };
  }, [colorOpen, compact]);
  useEffect(() => {
    let on = startSounds;
    try { const prefs = readPreferences(window.localStorage, startSounds); setColor(prefs.color); on = prefs.sounds; } catch { /* Storage is optional. */ }
    setSounds(on); setSoundsEnabled(on, false);
    try {
      if (!on && !window.localStorage.getItem("glaze-sound-hint-seen") && !window.localStorage.getItem("squishy-sound-hint-seen")) { setSoundHint(true); window.localStorage.setItem("glaze-sound-hint-seen", "true"); }
    } catch { if (!on) setSoundHint(true); }
    const firstGesture = (e: Event) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) {
        unlockSounds();
        window.removeEventListener("pointerdown", firstGesture, true);
        window.removeEventListener("keydown", firstGesture, true);
      }
    };
    // Window capture precedes control capture listeners and frame target handlers.
    window.addEventListener("pointerdown", firstGesture, true);
    window.addEventListener("keydown", firstGesture, true);
    return () => { window.removeEventListener("pointerdown", firstGesture, true); window.removeEventListener("keydown", firstGesture, true); };
  }, []);
  const persist = (nextColor: GlazeColor, nextSounds: boolean) => {
    try { savePreferences(window.localStorage, nextColor, nextSounds); } catch { /* Storage is optional. */ }
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const resize = new ResizeObserver(() => {
      const nextCompact = root.clientWidth < 480;
      setCompact(nextCompact);
      if (!nextCompact) setColorOpen(false);
    });
    resize.observe(root);
    // Opt-in presentation handshake; ordinary resizing and embeds keep their existing path.
    const resizeNow = () => {
      flushSync(() => setCompact(root.clientWidth < 480));
      root.dispatchEvent(new Event("glaze:frame-resize-now"));
    };
    root.addEventListener("glaze:resize-now", resizeNow);
    return () => { resize.disconnect(); root.removeEventListener("glaze:resize-now", resizeNow); };
  }, []);

  useEffect(() => {
    setCrust({ play: true, tube: true });
  }, [resetKey, localReset]);

  // Keep the frame shaped around the video's real aspect ratio.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let video: HTMLVideoElement | null = null;
    const onMeta = () => {
      if (video && video.videoWidth && video.videoHeight) setAr(video.videoWidth / video.videoHeight);
    };
    const attach = () => {
      const v = root.querySelector("video");
      if (v && v !== video) {
        video?.removeEventListener("loadedmetadata", onMeta);
        video = v;
        v.addEventListener("loadedmetadata", onMeta);
        onMeta();
      }
    };
    attach();
    const mo = new MutationObserver(attach);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      video?.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  // Controls hide after 2s of no movement while playing.
  const timer = useRef<number | undefined>(undefined);
  const videoPress = useRef<{ id: number; x: number; y: number } | null>(null);
  const poke = useCallback(() => {
    setActive(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(false), IDLE_MS);
  }, []);
  useEffect(() => {
    poke();
    return () => window.clearTimeout(timer.current);
  }, [poke]);

  const { waiting, ended } = useMediaFlags(rootRef);
  const endedRef = useRef(ended); endedRef.current = ended;
  const replay = useCallback(() => {
    const video = rootRef.current?.querySelector("video");
    if (!video) return;
    video.currentTime = 0; void video.play().catch(() => {});
  }, []);
  // Space/K at the end replays (Video.js plays from 0); add the crack press feel.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!endedRef.current || (e.key !== " " && e.key.toLowerCase() !== "k") || e.repeat) return;
      if (!rootRef.current?.contains(document.activeElement) || (document.activeElement as Element).closest("input, textarea, [contenteditable], .sq-squish")) return;
      playCrack(); vibratePress();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  const visible = ended || controlsVisible(paused, active, (!compact && volumeOpen) || speedOpen, keyboardFocus);
  useSquishAll(rootRef);

  // While a popup is open, lift the captions above its top edge: measure the
  // popup against the root and expose the clearance as a CSS variable.
  const popupOpen = (volumeOpen && !compact) || speedOpen;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!popupOpen) { root.style.removeProperty("--sq-popup-clear"); return; }
    const popup = root.querySelector<HTMLElement>(".sq-speed-menu, .sq-volume-slider");
    const stage = root.querySelector<HTMLElement>(".sq-stage");
    if (!popup || !stage) return;
    const clearance = stage.getBoundingClientRect().bottom - popup.getBoundingClientRect().top + 8;
    root.style.setProperty("--sq-popup-clear", `${Math.max(0, Math.round(clearance))}px`);
  }, [popupOpen]);

  // Focus rings are for keyboard navigation only: any pointer use marks <html>
  // so the skin's :focus-visible rules stay off until a navigation key is pressed.
  useEffect(() => {
    const nav = (k: string) =>
      k === "Tab" || k === "Enter" || k === "Escape" || k === "Home" || k === "End" ||
      k === "PageUp" || k === "PageDown" || k.startsWith("Arrow");
    const onKey = (e: KeyboardEvent) => {
      if (nav(e.key)) document.documentElement.removeAttribute("data-sq-pointer");
    };
    const onPointer = () => document.documentElement.setAttribute("data-sq-pointer", "");
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);


  return (
    <Container
      ref={rootRef}
      className="sq-root"
      data-fallback={fallback || undefined}
      data-compact={compact || undefined}
      data-row-visible={visible || undefined}
      data-popup-open={popupOpen || undefined}
      data-color={color}
      data-glaze-style={glazeStyle}
      style={{ ["--sq-ar" as string]: String(ar) }}
      aria-label={`${label}, Glaze player`}
      onPointerLeave={(e) => {
        // Touch ends with an implicit pointer leave, not a departure from the player.
        if (e.pointerType === "touch" || e.pointerType === "pen") return;
        window.clearTimeout(timer.current); setActive(false);
      }}
      onKeyDown={(e) => {
        if (e.key.toLowerCase() === "c" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.repeat) {
          e.preventDefault(); setCaptionsOn((on) => !on);
        }
      }}
    >
      {!fallback && <GlazeFrame resetKey={resetKey + localReset} color={color} glazeStyle={glazeStyle} onFallback={() => setFallback(true)} onReset={() => setLocalReset((n) => n + 1)} />}
      <div className="sq-frame-tools">
      <div ref={colorRef} className="sq-frame-colors" role="group" aria-label="Glaze colors">
        <FrameButton className="sq-candy sq-squish sq-color-toggle" data-swatch={color} aria-label={`Choose color: ${OPTIONS[color].label}`} title={`Choose color: ${OPTIONS[color].label}`} aria-expanded={colorOpen} action={() => setColorOpen((open) => { if (!open) colorOpenedAt.current = performance.now(); return !open; })}><span className="sq-candy-face sq-squish-body" /></FrameButton>
        <div className="sq-color-choices" data-open={colorOpen || undefined}>
          {COLORS.filter(choice => !compact || choice !== color).map((choice) => <FrameButton key={choice} className="sq-candy sq-squish" data-swatch={choice} aria-label={OPTIONS[choice].label} title={OPTIONS[choice].label} aria-pressed={color === choice} blocked={choiceBlocked} action={() => { if (choice === color) { setColorOpen(false); return; } setColor(choice); persist(choice, sounds); setColorOpen(false); if (compact) colorRef.current?.querySelector<HTMLButtonElement>(".sq-color-toggle")?.focus(); }}><span className="sq-candy-face sq-squish-body" /></FrameButton>)}
        </div>
      </div>
      <div className="sq-frame-actions">
        {soundHint && !sounds && <span className="sq-sound-hint">Turn on squish sounds</span>}
        {sounds && soundBlocked && <span className="sq-sound-hint" role="status">Tap to enable sound</span>}
        <FrameButton className="sq-candy sq-squish" aria-label="Reset Glaze" title="Reset Glaze" action={() => setLocalReset((n) => n + 1)}><span className="sq-candy-face sq-squish-body"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6a7 7 0 1 1-1 7M4 2v5h5" /></svg></span></FrameButton>
        <FrameButton className="sq-candy sq-squish" aria-label={`Squish sounds ${sounds ? (soundBlocked ? "blocked, tap to enable" : "on") : "off"}`} title={sounds && soundBlocked ? "Tap to enable sound" : `Squish sounds ${sounds ? "on" : "off"}`} aria-pressed={sounds} action={() => { if(sounds && soundBlocked){unlockSounds();return;} const next = !sounds; setSoundsEnabled(next); setSounds(next); persist(color, next); }}><span className="sq-candy-face sq-squish-body"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 3 1.8 4.2L13 9l-4.2 1.8L7 15l-1.8-4.2L1 9l4.2-1.8ZM14 6a5 5 0 0 1 0 8m3-10a8 8 0 0 1 0 12" />{!sounds && <path d="m2 18 16-16" />}</svg></span></FrameButton>
      </div>
      </div>
      <div className="sq-stage"
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") poke();
          const press = videoPress.current;
          if (press?.id === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) videoPress.current = null;
        }}
        onPointerDown={(e) => {
          setKeyboardFocus(false);
          if (compact && (e.pointerType === "touch" || e.pointerType === "pen") && !(e.target as Element).closest(".sq-controls, .sq-replay")) {
            videoPress.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          } else poke();
        }}
        onPointerUp={(e) => {
          const press = videoPress.current;
          videoPress.current = null;
          if (!press || press.id !== e.pointerId || (e.target as Element).closest(".sq-controls, .sq-replay")) return;
          const next = videoTapActivity(compact, e.pointerType, paused, visible);
          if (next === undefined) return;
          setKeyboardFocus(false); setSpeedOpen(false); setVolumeOpen(false);
          if (next) poke();
          else { window.clearTimeout(timer.current); setActive(false); }
        }}
        onPointerCancel={() => { videoPress.current = null; }}
        onFocus={() => { if (!document.documentElement.hasAttribute("data-sq-pointer")) { setKeyboardFocus(true); poke(); } }}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocus(false); }}
        onKeyDown={() => { setKeyboardFocus(true); poke(); }}
        onClickCapture={(e) => {
        if (compact && !(e.target as Element).closest(".sq-controls, .sq-replay")) {
          e.stopPropagation();
        }
      }}>
        {children}
        <RowCaptions rootRef={rootRef} enabled={captionsOn} />
        {waiting && !ended && <div className="sq-center sq-loading" role="status" aria-live="polite" aria-label="Loading"><span className="sq-center-bubble sq-wobble"><Sprinkles /></span></div>}
        {ended && <ReplayBubble replay={replay} />}
        <div className="sq-controls" data-visible={visible || undefined}>
          <div className="sq-row">
            <BunPlay
              waiting={waiting}
              ended={ended}
              replay={replay}
              crusted={crust.play}
              onCrack={(el, pt) =>
                crackCrust(el, flakeRef.current, { duration: 0.8, ...pt, onRemove: () => setCrust((c) => ({ ...c, play: false })) })
              }
            />
            <TimePill />
            <JellySeek
            crust={crust.tube}
            onCrack={(el, pt) =>
              crackCrust(el, flakeRef.current, {
                duration: 0.8,
                ...pt,
                onRemove: () => setCrust((c) => ({ ...c, tube: false })),
              })
            }
          />
            <VolumeButton compact={compact} open={volumeOpen && !compact} setOpen={setVolumeOpen} />
            <CaptionsPill on={captionsOn} toggle={() => setCaptionsOn((on) => !on)} />
            <SpeedButton open={speedOpen} setOpen={setSpeedOpen} />
            <FullscreenPill />
          </div>
        </div>
      </div>
      <div ref={flakeRef} className="sq-flakes" aria-hidden="true" />
      <Hotkey keys="Space" action="togglePaused" />
      <Hotkey keys="k" action="togglePaused" />
      <Hotkey keys="ArrowLeft" action="seekStep" value={-5} />
      <Hotkey keys="ArrowRight" action="seekStep" value={5} />
      <Hotkey keys="ArrowUp" action="volumeStep" value={0.1} />
      <Hotkey keys="ArrowDown" action="volumeStep" value={-0.1} />
      <Hotkey keys="f" action="toggleFullscreen" />
      <Hotkey keys="m" action="toggleMuted" />
    </Container>
  );
}

/** Bottom-band actions own release handling and feedback, including newly opened choices. */
function FrameButton({ action, blocked, ...props }: Omit<React.ComponentPropsWithoutRef<"button">, "onClick"> & { action: () => void; blocked?: () => boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const latest = useRef(action); latest.current = action;
  const isBlocked = useRef(blocked); isBlocked.current = blocked;
  useEffect(() => {
    const el=ref.current;if(!el)return;
    const detachAction=attachFrameAction(el,()=>latest.current(),()=>isBlocked.current?.()??false);
    const detachSquish=attachSquish(el);
    return ()=>{detachAction();detachSquish();};
  }, []);
  return <button {...props} ref={ref} type="button" data-glaze-control="" />;
}

/** Press feedback shared by the squishy controls. */
type Point = { x?: number | undefined; y?: number | undefined };
type CrackFn = (el: HTMLElement | null, pt: Point) => void;
const crustOf = (wrap: HTMLElement | null) => (wrap?.querySelector(".sq-crust") as HTMLElement | null) ?? null;

function usePress() {
  const [pressed, setPressed] = useState(false);
  return {
    pressed,
    handlers: {
      onPointerDown: () => {
        setPressed(true);
      },
      onPointerUp: () => {
        setPressed(false);
      },
      onPointerCancel: () => setPressed(false),
      onPointerLeave: () => setPressed(false),
    },
  };
}

function Crust({ className = "" }: { className?: string }) {
  return <span className={`sq-crust ${className}`} aria-hidden="true" />;
}

const REPLAY_ICON = <path d="M12 5a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 12 7v3L7.5 6 12 2z" />;

/** Waiting (after 300ms) and ended flags from the media element; media events are caught in capture. */
function useMediaFlags(rootRef: React.RefObject<HTMLElement | null>) {
  const [waiting, setWaiting] = useState(false);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let timer = 0;
    const stop = () => { window.clearTimeout(timer); timer = 0; setWaiting(false); };
    const arm = (e: Event) => {
      const v = e.target as HTMLVideoElement;
      if (!(v instanceof HTMLMediaElement) || v.paused || v.readyState >= 3 || timer) return;
      timer = window.setTimeout(() => { timer = 0; if (!v.paused && v.readyState < 3) setWaiting(true); }, 300);
    };
    const onEvent = (e: Event) => {
      if (!(e.target instanceof HTMLMediaElement)) return;
      switch (e.type) {
        case "waiting": case "stalled": case "play": case "seeking": arm(e); break;
        case "playing": case "canplay": case "pause": stop(); break;
        case "ended": stop(); setEnded(true); break;
      }
      if (e.type === "play" || e.type === "seeking") setEnded(false);
    };
    const types = ["waiting", "stalled", "play", "seeking", "playing", "canplay", "pause", "ended"];
    types.forEach(t => root.addEventListener(t, onEvent, true));
    return () => { window.clearTimeout(timer); types.forEach(t => root.removeEventListener(t, onEvent, true)); };
  }, [rootRef]);
  return { waiting, ended };
}

function Sprinkles() {
  return <span className="sq-orbit" aria-hidden="true"><i /><i /><i /></span>;
}

function ReplayBubble({ replay }: { replay: () => void }) {
  const { pressed, handlers } = usePress();
  const ref = useRef<HTMLButtonElement>(null);
  useSquish(ref); // squish press feel plus the control crack clip
  const go = () => replay();
  return (
    <div className="sq-center sq-replay-wrap">
      <button ref={ref} type="button" className="sq-replay sq-squish" data-pressed={pressed || undefined} aria-label="Replay" {...handlers}
        onClick={go}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (!e.repeat) go(); } }}
        onKeyUp={(e) => { if (e.key === " ") e.preventDefault(); }}>
        <span className="sq-center-bubble sq-squish-body"><svg className="sq-play-icon" viewBox="0 0 24 24" aria-hidden="true">{REPLAY_ICON}</svg></span>
      </button>
    </div>
  );
}

function BunPlay({ crusted, onCrack, waiting, ended, replay }: { crusted: boolean; onCrack: CrackFn; waiting: boolean; ended: boolean; replay: () => void }) {
  const store = usePlayer();
  const paused = usePlayer((s) => s.paused);
  const { pressed, handlers } = usePress();
  const crustRef = useRef<HTMLSpanElement>(null);
  return (
    <button
      type="button"
      className="sq-bun sq-squish"
      data-pressed={pressed || undefined}
      aria-label={ended ? "Replay" : paused ? "Play" : "Pause"}
      data-loading={(waiting && !ended) || undefined}
      aria-keyshortcuts="Space k"
      {...handlers}
      onPointerDown={(e) => {
        handlers.onPointerDown();
        if (crusted) onCrack(crustOf(crustRef.current), { x: e.clientX, y: e.clientY });
      }}
      onClick={() => {
        if (crusted) onCrack(crustOf(crustRef.current), {});
        if (ended) replay();
        else if (store.paused) store.play();
        else store.pause();
      }}
    >
      <span className="sq-bun-body sq-squish-body">
        <svg className="sq-play-icon" viewBox="0 0 24 24" aria-hidden="true">
          {ended ? REPLAY_ICON : paused ? <path d="M8 4 21 12 8 20Z" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" />}
        </svg>
        {waiting && !ended && <Sprinkles />}
        {crusted && (
          <span key={String(crusted)} ref={crustRef} className="sq-crust-wrap">
            <Crust />
          </span>
        )}
      </span>
    </button>
  );
}

function JellySeek({ crust, onCrack }: { crust: boolean; onCrack: CrackFn }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const down = useRef(false);
  const crack = (pt: Point) => {
    if (crust) onCrack(crustOf(wrapRef.current), pt);
  };
  return (
    <div
      ref={wrapRef}
      className="sq-seek sq-squish"
      onPointerDownCapture={(e) => {
        down.current = true;
        crack({ x: e.clientX, y: e.clientY });
      }}
      onPointerUpCapture={() => {
        down.current = false;
      }}
      onPointerCancelCapture={() => (down.current = false)}
      onKeyDownCapture={(e: RKeyboardEvent) => {
        if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") crack({});
      }}
    >
      <TimeSlider.Root className="sq-tube" label="Seek">
        <TimeSlider.Track className="sq-tube-track sq-squish-body">
          <TimeSlider.Fill className="sq-tube-fill" />
          {crust && <span className="sq-tube-crust" aria-hidden="true"><Crust /></span>}
        </TimeSlider.Track>
        <TimeSlider.Thumb className="sq-bead" />
      </TimeSlider.Root>
    </div>
  );
}

function TimePill() {
  const t = usePlayer((s) => ({ c: s.currentTime, d: s.duration }));
  return (
    <span className="sq-pill sq-time sq-squish sq-squish-body" style={{ ["--sq-time-chars" as string]: fmt(t.d).length * 2 + 3 }}>
      <span className="sq-sr">Current time </span>
      {fmt(t.c)}
      <span aria-hidden="true"> / </span>
      <span className="sq-sr"> of </span>
      {fmt(t.d)}
    </span>
  );
}

function VolumeButton({ compact, open, setOpen }: { compact: boolean; open: boolean; setOpen: (open: boolean) => void }) {
  const store = usePlayer();
  const v = usePlayer((s) => ({ volume: s.volume, muted: s.muted }));
  const { handlers } = usePress();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const escaped = useRef(false);
  const show = () => { clearTimeout(closeTimer.current); if (!compact) setOpen(true); };
  const close = () => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), VOLUME_CLOSE_MS); };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  return (
    <div className="sq-volume" onPointerEnter={(e) => { if (e.pointerType !== "touch") show(); }} onPointerLeave={close}
      onFocus={() => { if (escaped.current) { escaped.current = false; return; } if (!document.documentElement.hasAttribute("data-sq-pointer")) show(); }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(); }}
      onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); clearTimeout(closeTimer.current); setOpen(false); escaped.current = true; e.currentTarget.querySelector<HTMLButtonElement>(".sq-btn")?.focus(); escaped.current = false; } }}>
      <button type="button" className="sq-pill sq-btn sq-icon sq-squish sq-squish-body"
        aria-label={v.muted ? "Unmute" : "Mute"} aria-pressed={v.muted}
        aria-keyshortcuts="m ArrowUp ArrowDown" {...handlers}
        onClick={() => store.setMuted(!store.muted)}>
        <span className="sq-phone-face"><svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 8h3l4-3v10l-4-3H3z" />
          {v.muted ? <path d="m13 8 4 4m0-4-4 4" /> : <path d="M13 7a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10" />}
        </svg></span>
      </button>
      {open && <div className="sq-volume-slider sq-glass-panel" onPointerEnter={show}>
        <input type="range" min="0" max="1" step="0.01" value={v.muted ? 0 : v.volume}
          style={{ ["--sq-volume-fill" as string]: `${(v.muted ? 0 : v.volume) * 100}%` }}
          aria-label="Volume" onChange={(e) => {
            const volume = Number(e.target.value);
            store.setVolume(volume);
            store.setMuted(volume === 0);
          }} onKeyDownCapture={isolateVolumeKey} />
      </div>}
    </div>
  );
}

function CaptionsPill({ on, toggle }: { on: boolean; toggle: () => void }) {
  const { pressed, handlers } = usePress();
  return (
    <button
      type="button"
      className="sq-pill sq-btn sq-squish sq-squish-body"
      data-pressed={pressed || undefined}
      aria-label="Captions"
      aria-pressed={on}
      aria-keyshortcuts="c"
      {...handlers}
      onClick={toggle}
    >
      <span className="sq-phone-face">CC</span>
    </button>
  );
}

function SpeedButton({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const store = usePlayer();
  const rate = usePlayer((s) => s.playbackRate);
  const { handlers } = usePress();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); ref.current?.querySelector<HTMLButtonElement>(".sq-btn")?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open, setOpen]);
  return (
    <div ref={ref} className="sq-speed">
      <button type="button" className="sq-pill sq-btn sq-squish sq-squish-body"
        aria-expanded={open} aria-haspopup="menu"
        aria-label={`Playback speed, ${rate}x`} {...handlers}
        onClick={() => setOpen(!open)}>
        <span className="sq-phone-face">{rate}×</span>
      </button>
      {open && <div className="sq-speed-menu sq-glass-panel" role="menu" aria-label="Playback speed" onKeyDown={(e) => {
        if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
        const index = items.findIndex((item) => item === document.activeElement);
        const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (index + (e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
        items[next]?.focus();
      }}>
        {POPUP_SPEEDS.map((speed) => <button key={speed} type="button" role="menuitemradio" aria-checked={rate === speed}
          onClick={() => { store.setPlaybackRate(speed); setOpen(false); ref.current?.querySelector<HTMLButtonElement>(".sq-btn")?.focus(); }}>{speed}×</button>)}
      </div>}
    </div>
  );
}

/** Hidden native tracks supply the skin's single caption overlay on every size. */
function RowCaptions({ rootRef, enabled }: { rootRef: { current: HTMLDivElement | null }; enabled: boolean }) {
  const [cues, setCues] = useState("");
  const media = useMedia();
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let video: HTMLVideoElement | null = null;
    let detach: (() => void) | undefined;
    const attach = () => {
      const next = root.querySelector("video");
      if (next === video) return;
      detach?.(); detach = undefined; video = next; setCues("");
      if (video) detach = observeCaptionCues(video, () => {
        const engine = media && "engine" in media ? media.engine : undefined;
        return isCaptionEngine(engine) ? engine : undefined;
      }, enabled, setCues);
    };
    const observer = new MutationObserver(attach);
    observer.observe(root, { childList: true, subtree: true });
    attach();
    return () => { observer.disconnect(); detach?.(); };
  }, [rootRef, enabled, media]);
  return enabled && cues ? <div className="sq-row-captions" aria-live="off"><span>{cues}</span></div> : null;
}

function FullscreenPill() {
  const store = usePlayer();
  const fs = usePlayer((s) => s.isFullscreen);
  const { pressed, handlers } = usePress();
  return (
    <button
      type="button"
      className="sq-pill sq-btn sq-icon sq-squish sq-squish-body"
      data-pressed={pressed || undefined}
      aria-label={fs ? "Exit fullscreen" : "Fullscreen"}
      aria-keyshortcuts="f"
      {...handlers}
      onClick={() => (fs ? store.exitFullscreen() : store.requestFullscreen())}
    >
      <span className="sq-phone-face"><svg viewBox="0 0 20 20" aria-hidden="true">
        {fs ? (
          <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />
        ) : (
          <path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" />
        )}
      </svg></span>
    </button>
  );
}
