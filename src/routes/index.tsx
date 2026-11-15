import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import React, { lazy, Suspense, useState, useRef } from "react";
import { DemoSections } from "@/components/DemoSections";
import { Button } from "@/components/ui/button";
import { PREVIEW_MODES, PREVIEW_WIDTHS, PREVIEW_TRANSITION_MS, nextPreview, type PreviewMode } from "@/lib/demo-preview";

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

const PLAYBACK_ID = "zuuzaVu00g4SSj42ob01J02woymbZKSOURx6G12L00SYVl4";

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
  const tabs = useRef<HTMLDivElement>(null);
  return (
    <main className="demo">
      <h1 className="demo-title"><img className="demo-logo" src="/glaze-logo-on-dark.svg" alt="Glaze" width="944" height="240" /></h1>
      <p className="demo-subtitle">An ASMR squishy skin for Video.js</p>
      <p className="demo-tagline">Crack the glaze. Squish the frame.</p>
      <p className="demo-intro">There's a reason squishies and ASMR are so popular. Press play and find out.</p>
      <div ref={tabs} className="demo-preview-tabs" role="tablist" aria-label="Player preview size">
        {PREVIEW_MODES.map(mode => <Button key={mode} variant="ghost" role="tab" id={`preview-tab-${mode}`} aria-controls="player-preview" aria-selected={preview === mode} tabIndex={preview === mode ? 0 : -1} className="demo-preview-tab" onClick={() => setPreview(mode)} onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault(); const next = nextPreview(mode, e.key); setPreview(next); tabs.current?.querySelector<HTMLButtonElement>(`#preview-tab-${next}`)?.focus();
        }}>{mode}</Button>)}
      </div>
      <div id="player-preview" role="tabpanel" aria-labelledby={`preview-tab-${preview}`} className="demo-preview" data-preview={preview} style={{ maxWidth: PREVIEW_WIDTHS[preview], transitionDuration: `${PREVIEW_TRANSITION_MS}ms` }}>
      <ClientOnly fallback={<Placeholder />}>
        <Suspense fallback={<Placeholder />}>
          <GlazePlayer playbackId={PLAYBACK_ID} title="Glaze demo video" sounds={true} />
        </Suspense>
      </ClientOnly>
      </div>
      <p className="demo-credit">The demo video, whispers and squish sounds were all custom made for Glaze.</p>
      <DemoSections />
    </main>
  );
}
