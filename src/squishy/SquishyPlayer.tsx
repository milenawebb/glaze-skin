import { Container, Hotkey, TimeSlider, createPlayer } from "@videojs/react";
import { videoFeatures } from "@videojs/react/video";
import { MuxVideo } from "@videojs/react/media/mux-video";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from "react";
import { SquishyFrame } from "./SquishyFrame";
import { crackCrust } from "./crust";
import { useSquishAll } from "./squish";
import { playPop, playSquelch } from "./sounds";
import { nextPlaybackRate } from "./controls";
import "./squishy.css";

export const squishy = createPlayer({ features: videoFeatures });
const { Player, usePlayer } = squishy;

const IDLE_MS = 2000;

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

  const visible = paused || active;
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
      style={{ ["--sq-ar" as string]: String(ar) }}
      aria-label={`${label} — Squishy player`}
      onPointerMove={poke}
      onPointerDown={poke}
      onKeyDown={poke}
      onFocus={poke}
    >
      {!fallback && <SquishyFrame resetKey={resetKey} onFallback={() => setFallback(true)} />}
      <div className="sq-stage" onClickCapture={(e) => {
        if (compact && !(e.target as Element).closest(".sq-controls button, .sq-seek")) {
          poke();
          e.stopPropagation();
        }
      }}>
        {children}
        <div className="sq-controls" data-visible={visible || undefined}>
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
          <div className="sq-row">
            <BunPlay
              crusted={crust.play}
              onCrack={(el, pt) =>
                crackCrust(el, flakeRef.current, { ...pt, onRemove: () => setCrust((c) => ({ ...c, play: false })) })
              }
            />
            <TimePill />
            <span className="sq-spacer" />
            <VolumeButton />
            <CaptionsPill />
            <SpeedButton />
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
      <Hotkey keys="c" action="toggleSubtitles" />
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
        playSquelch();
      },
      onPointerUp: () => {
        setPressed(false);
        playPop();
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
          <span ref={crustRef} className="sq-crust-wrap">
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
        playSquelch();
        crack({ x: e.clientX, y: e.clientY });
      }}
      onPointerUpCapture={() => {
        if (down.current) playPop();
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
    <span className="sq-pill sq-time sq-squish sq-squish-body">
      <span className="sq-sr">Current time </span>
      {fmt(t.c)}
      <span aria-hidden="true"> / </span>
      <span className="sq-sr"> of </span>
      {fmt(t.d)}
    </span>
  );
}

function VolumeButton() {
  const store = usePlayer();
  const v = usePlayer((s) => ({ volume: s.volume, muted: s.muted }));
  const { handlers } = usePress();
  return (
    <div className="sq-volume">
      <button type="button" className="sq-pill sq-btn sq-icon sq-squish sq-squish-body"
        aria-label={v.muted ? "Unmute" : "Mute"} aria-pressed={v.muted}
        aria-keyshortcuts="m ArrowUp ArrowDown" {...handlers}
        onClick={() => store.setMuted(!store.muted)}>
        <span className="sq-phone-face"><svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 8h3l4-3v10l-4-3H3z" />
          {v.muted ? <path d="m13 8 4 4m0-4-4 4" /> : <path d="M13 7a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10" />}
        </svg></span>
      </button>
      <div className="sq-volume-slider">
        <input type="range" min="0" max="1" step="0.01" value={v.muted ? 0 : v.volume}
          aria-label="Volume" onChange={(e) => {
            const volume = Number(e.target.value);
            store.setVolume(volume);
            store.setMuted(volume === 0);
          }} onKeyDown={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

function CaptionsPill() {
  const store = usePlayer();
  const on = usePlayer((s) => s.subtitlesShowing);
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
      onClick={() => store.toggleSubtitles()}
    >
      <span className="sq-phone-face">CC</span>
    </button>
  );
}

function SpeedButton() {
  const store = usePlayer();
  const rate = usePlayer((s) => s.playbackRate);
  const { handlers } = usePress();
  return (
    <div className="sq-speed">
      <button type="button" className="sq-pill sq-btn sq-squish sq-squish-body"
        aria-label={`Playback speed, ${rate}x`} {...handlers}
        onClick={() => store.setPlaybackRate(nextPlaybackRate(rate))}>
        <span className="sq-phone-face">{rate}×</span>
      </button>
    </div>
  );
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
