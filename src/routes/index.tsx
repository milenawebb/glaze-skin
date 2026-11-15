import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import type { GlazeStyle } from "@/squishy/glaze-style";

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
  const [glazeStyle, setGlazeStyle] = useState<GlazeStyle>("candy");
  return (
    <main className="demo">
      <h1 className="demo-title">Squishy</h1>
      <ClientOnly fallback={<Placeholder />}>
        <Suspense fallback={<Placeholder />}>
          <SquishyPlayer playbackId={PLAYBACK_ID} title="Squishy demo video" glazeStyle={glazeStyle} />
        </Suspense>
      </ClientOnly>
      <div className="demo-actions" role="group" aria-label="Glaze style">
        {(["candy", "mono"] as const).map((style) => <button key={style} type="button" className="demo-btn" aria-pressed={glazeStyle === style} onClick={() => setGlazeStyle(style)}>{style === "candy" ? "Candy" : "Mono"}</button>)}
      </div>
    </main>
  );
}
