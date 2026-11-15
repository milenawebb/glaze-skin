import { Container, Hotkey, TimeSlider, createPlayer } from "@videojs/react";
import { videoFeatures } from "@videojs/react/video";
import { MuxVideo } from "@videojs/react/media/mux-video";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from "react";
import { SquishyFrame } from "./SquishyFrame";
import { crackCrust } from "./crust";
import { useSquishAll } from "./squish";
import { playPop, playSqueeze, playSquelch } from "./sounds";
import "./squishy.css";

export const squishy = createPlayer({ features: videoFeatures });
const { Player, usePlayer } = squishy;

const SEGMENTS = 8;
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
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
  const [ar, setAr] = useState(16 / 9);
  const [active, setActive] = useState(true);
  const paused = usePlayer((s) => s.paused);
  const [crust, setCrust] = useState({ play: true, ball: true, tube: Array(SEGMENTS).fill(true) as boolean[] });

  useEffect(() => {
    setCrust({ play: true, ball: true, tube: Array(SEGMENTS).fill(true) });
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
      style={{ ["--sq-ar" as string]: String(ar) }}
      aria-label={`${label} — Squishy player`}
      onPointerMove={poke}
      onPointerDown={poke}
      onKeyDown={poke}
      onFocus={poke}
    >
      {!fallback && <SquishyFrame resetKey={resetKey} onFallback={() => setFallback(true)} />}
      <div className="sq-stage">
        {children}
        <div className="sq-controls" data-visible={visible || undefined}>
          <JellySeek
            crust={crust.tube}
            onCrack={(i, el, pt) =>
              crackCrust(el, flakeRef.current, {
                duration: 0.5,
                pieces: 3 + Math.floor(Math.random() * 2),
                ...pt,
                onRemove: () => setCrust((c) => ({ ...c, tube: c.tube.map((v, j) => (j === i ? false : v)) })),
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
            <StressBall
              crusted={crust.ball}
              onCrack={(el, pt) =>
                crackCrust(el, flakeRef.current, { ...pt, onRemove: () => setCrust((c) => ({ ...c, ball: false })) })
              }
            />
            <CaptionsPill />
            <SpeedMenu />
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
        <span className="sq-face" aria-hidden="true">
          <span className="sq-eye" />
          <span className="sq-eye" />
          <span className="sq-cheek sq-cheek-l" />
          <span className="sq-cheek sq-cheek-r" />
          <span className="sq-smile" />
        </span>
        {crusted && (
          <span ref={crustRef} className="sq-crust-wrap">
            <Crust />
          </span>
        )}
      </span>
      <span className="sq-badge" aria-hidden="true">
        {paused ? (
          <svg viewBox="0 0 10 10"><path d="M3 2 L8 5 L3 8 Z" /></svg>
        ) : (
          <svg viewBox="0 0 10 10"><rect x="2.5" y="2" width="1.8" height="6" rx=".6" /><rect x="5.7" y="2" width="1.8" height="6" rx=".6" /></svg>
        )}
      </span>
    </button>
  );
}

function JellySeek({ crust, onCrack }: { crust: boolean[]; onCrack: (i: number, el: HTMLElement | null, pt: Point) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const down = useRef(false);
  const time = usePlayer((s) => ({ t: s.currentTime, d: s.duration }));
  const crackAt = (frac: number, x?: number) => {
    const i = Math.min(SEGMENTS - 1, Math.max(0, Math.floor(frac * SEGMENTS)));
    if (!crust[i]) return;
    onCrack(i, wrapRef.current?.querySelector<HTMLElement>(`[data-seg="${i}"] .sq-crust`) ?? null, { x });
  };
  const fracFrom = (clientX: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return (clientX - r.left) / r.width;
  };
  return (
    <div
      ref={wrapRef}
      className="sq-seek sq-squish"
      onPointerDownCapture={(e) => {
        down.current = true;
        playSquelch();
        crackAt(fracFrom(e.clientX), e.clientX);
      }}
      onPointerMoveCapture={(e) => {
        if (down.current) crackAt(fracFrom(e.clientX), e.clientX);
      }}
      onPointerUpCapture={() => {
        if (down.current) playPop();
        down.current = false;
      }}
      onPointerCancelCapture={() => (down.current = false)}
      onKeyDownCapture={(e: RKeyboardEvent) => {
        if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") crackAt(time.d ? time.t / time.d : 0);
      }}
    >
      <TimeSlider.Root className="sq-tube" label="Seek">
        <TimeSlider.Track className="sq-tube-track sq-squish-body">
          <TimeSlider.Buffer className="sq-tube-buffer" />
          <TimeSlider.Fill className="sq-tube-fill" />
          <span className="sq-tube-crust" aria-hidden="true">
            {crust.map((on, i) => (
              <span key={i} data-seg={i} className="sq-seg" data-on={on || undefined}>
                {on && <Crust />}
              </span>
            ))}
          </span>
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

function StressBall({ crusted, onCrack }: { crusted: boolean; onCrack: CrackFn }) {
  const store = usePlayer();
  const v = usePlayer((s) => ({ volume: s.volume, muted: s.muted }));
  const level = Math.max(1, Math.min(5, Math.round(v.volume * 5)));
  const [squeeze, setSqueeze] = useState(0);
  const crustRef = useRef<HTMLSpanElement>(null);
  const hold = useRef<{ t?: number; i?: number; stepped: boolean; crack: boolean } | null>(null);

  const end = (tap: boolean) => {
    const h = hold.current;
    if (!h) return;
    window.clearTimeout(h.t);
    window.clearInterval(h.i);
    hold.current = null;
    setSqueeze(0);
    playPop();
    if (tap && !h.stepped && !h.crack) store.setMuted(!store.muted);
  };

  return (
    <button
      type="button"
      className="sq-ball sq-squish"
      data-squeeze={squeeze}
      data-muted={v.muted || undefined}
      aria-label={`Volume ${level} of 5${v.muted ? ", muted" : ""}. Tap to ${v.muted ? "unmute" : "mute"}, hold to turn up`}
      aria-keyshortcuts="m ArrowUp ArrowDown"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        playSquelch();
        if (crusted) {
          onCrack(crustOf(crustRef.current), { x: e.clientX, y: e.clientY });
          hold.current = { stepped: false, crack: true };
          setSqueeze(1);
          return;
        }
        const h: NonNullable<typeof hold.current> = { stepped: false, crack: false };
        hold.current = h;
        setSqueeze(1);
        h.t = window.setTimeout(() => {
          let lv = 1;
          const apply = () => {
            h.stepped = true;
            store.setMuted(false);
            store.setVolume(lv / 5);
            setSqueeze(lv);
            playSqueeze();
          };
          apply();
          h.i = window.setInterval(() => {
            if (lv >= 5) return window.clearInterval(h.i);
            lv++;
            apply();
          }, 450);
        }, 300);
      }}
      onPointerUp={() => end(true)}
      onPointerCancel={() => end(false)}
      onClick={(e) => {
        // Keyboard activation (Enter / Space) toggles mute.
        if (e.detail !== 0) return;
        if (crusted) onCrack(crustOf(crustRef.current), {});
        else store.setMuted(!store.muted);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          const next = Math.max(0, Math.min(5, level + (e.key === "ArrowUp" ? 1 : -1)));
          store.setMuted(next === 0);
          if (next) store.setVolume(next / 5);
        }
      }}
    >
      <span className="sq-ball-body sq-squish-body">
        <span className="sq-ball-num" aria-hidden="true">{v.muted ? "×" : level}</span>
        {crusted && (
          <span ref={crustRef} className="sq-crust-wrap">
            <Crust />
          </span>
        )}
      </span>
    </button>
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
      CC
    </button>
  );
}

function SpeedMenu() {
  const store = usePlayer();
  const rate = usePlayer((s) => s.playbackRate);
  const [open, setOpen] = useState(false);
  const { pressed, handlers } = usePress();
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = wrap.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]");
    const cur = Array.from(items ?? []).find((b) => b.getAttribute("aria-checked") === "true");
    (cur ?? items?.[0])?.focus();
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const onMenuKey = (e: RKeyboardEvent) => {
    const items = Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const n = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[n]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " " || e.key === "k" || e.key === "f" || e.key === "m" || e.key === "c") {
      e.stopPropagation();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="sq-speed" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="sq-pill sq-btn sq-squish sq-squish-body"
        data-pressed={pressed || undefined}
        aria-label={`Playback speed, ${rate}x`}
        aria-haspopup="menu"
        aria-expanded={open}
        {...handlers}
        onClick={() => setOpen((o) => !o)}
      >
        {rate}×
      </button>
      {open && (
        <div className="sq-menu" role="menu" aria-label="Playback speed" onKeyDown={onMenuKey}>
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              role="menuitemradio"
              aria-checked={r === rate}
              className="sq-menu-item"
              tabIndex={-1}
              onClick={() => {
                store.setPlaybackRate(r);
                setOpen(false);
                btn.current?.focus();
              }}
            >
              {r}×
            </button>
          ))}
        </div>
      )}
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
      <svg viewBox="0 0 20 20" aria-hidden="true">
        {fs ? (
          <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />
        ) : (
          <path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" />
        )}
      </svg>
    </button>
  );
}
