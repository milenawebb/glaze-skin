import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import React, { lazy, Suspense, useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { DemoSections } from "@/components/DemoSections";
import { Button } from "@/components/ui/button";
import { PREVIEW_MODES, PREVIEW_WIDTHS, nextPreview, type PreviewMode } from "@/lib/demo-preview";
import { createPreviewTransition } from "@/lib/preview-transition";

const RELOAD_FLAG = "glaze-reloaded";

function GlazeLoadError() {
  return (
    <div className="sq-load-error" role="alert">
      <p>The glaze needs a refresh</p>
      <Button onClick={() => { sessionStorage.removeItem(RELOAD_FLAG); window.location.reload(); }}>Refresh</Button>
    </div>
  );
}

// Stale copies after a publish can fail to load: retry once, reload once, then show a friendly message.
const GlazePlayer = lazy(async () => {
  const load = () => import("@/glaze").then((m) => ({ default: m.GlazePlayer as React.ComponentType<React.ComponentProps<typeof m.GlazePlayer>> }));
  try {
    const mod = await load().catch(() => new Promise<Awaited<ReturnType<typeof load>>>((resolve, reject) => setTimeout(() => load().then(resolve, reject), 500)));
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* storage blocked */ }
    return mod;
  } catch {
    let reloaded = true;
    try { reloaded = sessionStorage.getItem(RELOAD_FLAG) === "1"; if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, "1"); } catch { /* storage blocked */ }
    if (!reloaded) { window.location.reload(); return new Promise<never>(() => {}); }
    return { default: GlazeLoadError as never };
  }
});

const PLAYBACK_ID = "IL8LEwPXBY4C2HldJqjKKjtO6y5aGkQXqVPWx5cuo01g";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glaze, an ASMR squishy skin for Video.js" },
      { name: "description", content: "A soft, squishy Video.js skin with crackable glaze and satisfying ASMR sounds." },
      { property: "og:title", content: "Glaze, an ASMR squishy skin for Video.js" },
      { property: "og:description", content: "A soft, squishy Video.js skin with crackable glaze and satisfying ASMR sounds." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://glazevideo.com/glaze-mascot.svg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Glaze, an ASMR squishy skin for Video.js" },
      { name: "twitter:description", content: "A soft, squishy Video.js skin with crackable glaze and satisfying ASMR sounds." },
      { name: "twitter:image", content: "https://glazevideo.com/glaze-mascot.svg" },
    ],
  }),
  component: Index,
});

function Placeholder() {
  return <div className="demo-placeholder" aria-hidden="true" />;
}

function Index() {
  const [preview, setPreview] = useState<PreviewMode>("Desktop");
  const [size, setSize] = useState<PreviewMode>("Desktop");
  const area = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const transition = useRef<ReturnType<typeof createPreviewTransition> | null>(null);
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = area.current;
    if (!node) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    transition.current = createPreviewTransition(node, mode => {
      flushSync(() => setSize(mode));
      node.querySelector(".sq-root")?.dispatchEvent(new Event("glaze:resize-now"));
    }, () => motion.matches);
    return () => { transition.current?.cancel(); transition.current = null; };
  }, []);
  const select = (mode: PreviewMode) => {
    if (mode === preview) return;
    // Keep the following page content stationary while the player changes arrangement.
    if (slot.current && area.current) slot.current.style.minHeight = `${Math.max(slot.current.clientHeight, area.current.offsetHeight)}px`;
    setPreview(mode);
    void transition.current?.select(mode);
  };
  return (
    <main className="demo">
      <h1 className="demo-title"><img className="demo-logo" src="/glaze-logo-on-dark.svg" alt="Glaze" width="944" height="240" /></h1>
      <p className="demo-subtitle">An ASMR squishy skin for Video.js</p>
      <p className="demo-tagline">Crack the glaze. Squish the frame.</p>
      <p className="demo-intro">There's a reason squishies and ASMR are so popular. Press play and find out.</p>
      <div ref={tabs} className="demo-preview-tabs" role="tablist" aria-label="Player preview size">
        {PREVIEW_MODES.map(mode => <Button key={mode} variant="ghost" role="tab" id={`preview-tab-${mode}`} aria-controls="player-preview" aria-selected={preview === mode} tabIndex={preview === mode ? 0 : -1} className="demo-preview-tab" onClick={e => { e.currentTarget.focus(); select(mode); }} onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault(); const next = nextPreview(mode, e.key); select(next); tabs.current?.querySelector<HTMLButtonElement>(`#preview-tab-${next}`)?.focus();
        }}>{mode}</Button>)}
      </div>
      <div ref={slot} className="demo-preview-slot">
      <div ref={area} id="player-preview" role="tabpanel" aria-labelledby={`preview-tab-${preview}`} className="demo-preview" data-preview={size} style={{ maxWidth: PREVIEW_WIDTHS[size] }}>
      <ClientOnly fallback={<Placeholder />}>
        <Suspense fallback={<Placeholder />}>
          <GlazePlayer playbackId={PLAYBACK_ID} title="Glaze demo video" sounds={true} />
        </Suspense>
      </ClientOnly>
      </div>
      </div>
      <p className="demo-credit">The demo video, ASMR whispers and all sounds were all custom made for Glaze.</p>
      <DemoSections />
    </main>
  );
}
