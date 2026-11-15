import { Container, Hotkey, TimeSlider, createPlayer } from "@videojs/react";
import { videoFeatures } from "@videojs/react/video";
import { MuxVideo } from "@videojs/react/media/mux-video";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from "react";
import { SquishyFrame } from "./SquishyFrame";
import { crackCrust } from "./crust";
import { useSquishAll } from "./squish";
import { nextPlaybackRate, POPUP_SPEEDS, VOLUME_CLOSE_MS, CONTROLS_IDLE_MS, controlsVisible } from "./controls";
import { CAPTIONS_DEFAULT_ON, observeCaptionCues, isCaptionEngine } from "./captions";
import "./squishy.css";

export const squishy = createPlayer({ features: videoFeatures });
const { Player, usePlayer, useMedia } = squishy;

const IDLE_MS = CONTROLS_IDLE_MS;

export interface SquishyPlayerProps {
  playbackId: string;
  /** Changing this number puffs the frame back to smooth and re-bakes the crust. */
  resetKey?: number;
  title?: string;
}

export function SquishyPlayer({ playbackId, resetKey = 0, title = "Video" }: SquishyPlayerProps) {
  return (
    <Player>
      <SquishySkin resetKey={resetKey} label={title}>
        <MuxVideo
          source={{ playbackId }}
          poster={`https://image.mux.com/${playbackId}/thumbnail.webp?time=1`}
          playsInline
          crossOrigin="anonymous"
        />
      </SquishySkin>
    </Player>
  );
}

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
};

export function SquishySkin({ children, resetKey, label }: { children: ReactNode; resetKey: number; label: string }) {
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const resize = new ResizeObserver(() => setCompact(root.getBoundingClientRect().width < 480));
    resize.observe(root);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    setCrust({ play: true, tube: true });
  }, [resetKey]);

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
  const poke = useCallback(() => {
    setActive(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(false), IDLE_MS);
  }, []);
  useEffect(() => {
    poke();
    return () => window.clearTimeout(timer.current);
  }, [poke]);

  const visible = compact ? paused || active : controlsVisible(paused, active, volumeOpen || speedOpen, keyboardFocus);
  useSquishAll(rootRef);

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
      style={{ ["--sq-ar" as string]: String(ar) }}
      aria-label={`${label} — Squishy player`}
      onPointerMove={poke}
      onPointerDown={() => { setKeyboardFocus(false); poke(); }}
      onKeyDown={(e) => {
        setKeyboardFocus(true); poke();
        if (e.key.toLowerCase() === "c" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.repeat) {
          e.preventDefault(); setCaptionsOn((on) => !on);
        }
      }}
      onFocus={() => { setKeyboardFocus(!document.documentElement.hasAttribute("data-sq-pointer")); poke(); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocus(false); }}
    >
      {!fallback && <SquishyFrame resetKey={resetKey} onFallback={() => setFallback(true)} />}
      <div className="sq-stage" onClickCapture={(e) => {
        if (compact && !(e.target as Element).closest(".sq-controls button, .sq-seek")) {
          poke();
          e.stopPropagation();
        }
      }}>
        {children}
        <RowCaptions rootRef={rootRef} enabled={captionsOn} />
        <div className="sq-controls" data-visible={visible || undefined}>
          <div className="sq-row">
            <BunPlay
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
            <SpeedButton compact={compact} open={speedOpen && !compact} setOpen={setSpeedOpen} />
            <FullscreenPill />
          </div>
        </div>
      </div>
      <div ref={flakeRef} className="sq-flakes" aria-hidden="true" />
      <Hotkey keys="Space" action="togglePaused" />
      <Hotkey keys="k" action="togglePaused" />
      <Hotkey keys="ArrowLeft" action="seekStep" value={-5} />
      <Hotkey keys="ArrowRight" action="seekStep" value={5} />
      <Hotkey keys="ArrowUp" action="volumeStep" value={0.2} />
      <Hotkey keys="ArrowDown" action="volumeStep" value={-0.2} />
      <Hotkey keys="f" action="toggleFullscreen" />
      <Hotkey keys="m" action="toggleMuted" />
    </Container>
  );
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

function BunPlay({ crusted, onCrack }: { crusted: boolean; onCrack: CrackFn }) {
  const store = usePlayer();
  const paused = usePlayer((s) => s.paused);
  const { pressed, handlers } = usePress();
  const crustRef = useRef<HTMLSpanElement>(null);
  return (
    <button
      type="button"
      className="sq-bun sq-squish"
      data-pressed={pressed || undefined}
      aria-label={paused ? "Play" : "Pause"}
      aria-keyshortcuts="Space k"
      {...handlers}
      onPointerDown={(e) => {
        handlers.onPointerDown();
        if (crusted) onCrack(crustOf(crustRef.current), { x: e.clientX, y: e.clientY });
      }}
      onClick={() => {
        if (crusted) onCrack(crustOf(crustRef.current), {});
        if (store.paused) store.play();
        else store.pause();
      }}
    >
      <span className="sq-bun-body sq-squish-body">
        <svg className="sq-play-icon" viewBox="0 0 24 24" aria-hidden="true">
          {paused ? <path d="M8 4 21 12 8 20Z" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" />}
        </svg>
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
  const show = () => { clearTimeout(closeTimer.current); if (!compact) setOpen(true); };
  const close = () => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), VOLUME_CLOSE_MS); };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  return (
    <div className="sq-volume" onPointerEnter={(e) => { if (e.pointerType !== "touch") show(); }} onPointerLeave={close}
      onFocus={() => { if (!document.documentElement.hasAttribute("data-sq-pointer")) show(); }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(); }}>
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
          }} onKeyDown={(e) => e.stopPropagation()} />
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

function SpeedButton({ compact, open, setOpen }: { compact: boolean; open: boolean; setOpen: (open: boolean) => void }) {
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
        aria-expanded={!compact && open} aria-haspopup={compact ? undefined : "menu"}
        aria-label={`Playback speed, ${rate}x`} {...handlers}
        onClick={() => { if (compact) store.setPlaybackRate(nextPlaybackRate(rate)); else setOpen(!open); }}>
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
    const video = rootRef.current?.querySelector("video");
    if (!video) return;
    return observeCaptionCues(video, () => {
      const engine = media && "engine" in media ? media.engine : undefined;
      return isCaptionEngine(engine) ? engine : undefined;
    }, enabled, setCues);
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
