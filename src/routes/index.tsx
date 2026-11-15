import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { PREVIEW_MODES, PREVIEW_WIDTHS, PREVIEW_TRANSITION_MS, nextPreview, type PreviewMode } from "@/lib/demo-preview";

const GlazePlayer = lazy(() => import("@/glaze").then((m) => ({ default: m.GlazePlayer })));

const PLAYBACK_ID = "AAprZsIykh7T29gtsNk02YhBrQRHXTj14ZxbWdc498wA";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glaze — a squishy-toy skin for Video.js" },
      { name: "description", content: "Glaze: a soft, pressable, pastel squishy-toy skin for the Video.js v10 player." },
      { property: "og:title", content: "Glaze — a squishy-toy skin for Video.js" },
      { property: "og:description", content: "A soft, pressable, pastel squishy-toy skin for the Video.js v10 player." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
      <h1 className="demo-title">Glaze</h1>
      <p className="demo-subtitle">An ASMR squishy skin for Video.js</p>
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
    </main>
  );
}
