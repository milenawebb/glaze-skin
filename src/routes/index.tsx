import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { useSquish } from "@/squishy/squish";
import { setSoundsEnabled } from "@/squishy/sounds";

const SquishyPlayer = lazy(() => import("@/squishy").then((m) => ({ default: m.SquishyPlayer })));

const PLAYBACK_ID = "AAprZsIykh7T29gtsNk02YhBrQRHXTj14ZxbWdc498wA";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Squishy — a squishy-toy skin for Video.js" },
      { name: "description", content: "Squishy: a soft, pressable, pastel squishy-toy skin for the Video.js v10 player." },
      { property: "og:title", content: "Squishy — a squishy-toy skin for Video.js" },
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
  const [resetKey, setResetKey] = useState(0);
  const [sounds, setSounds] = useState(false);
  const resetRef = useRef<HTMLButtonElement>(null);
  const soundRef = useRef<HTMLButtonElement>(null);
  useSquish(resetRef);
  useSquish(soundRef);
  return (
    <main className="demo">
      <h1 className="demo-title">Squishy</h1>
      <ClientOnly fallback={<Placeholder />}>
        <Suspense fallback={<Placeholder />}>
          <SquishyPlayer playbackId={PLAYBACK_ID} resetKey={resetKey} title="Squishy demo video" />
        </Suspense>
      </ClientOnly>
      <div className="demo-actions">
        <button ref={resetRef} type="button" className="demo-btn sq-squish sq-squish-body" onClick={() => setResetKey((k) => k + 1)}>
          Reset
        </button>
        <button
          ref={soundRef}
          type="button"
          className="demo-btn sq-squish sq-squish-body"
          aria-pressed={sounds}
          onClick={() => {
            setSoundsEnabled(!sounds);
            setSounds(!sounds);
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="demo-icon">
            <path d="M3 8h3l4-3v10l-4-3H3z" />
            {sounds ? <path d="M13 7.5a3.5 3.5 0 0 1 0 5M15 5a7 7 0 0 1 0 10" /> : <path d="M13 8l4 4M17 8l-4 4" />}
          </svg>
          Sounds {sounds ? "on" : "off"}
        </button>
      </div>
    </main>
  );
}
