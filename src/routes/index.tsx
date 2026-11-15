import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

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
  return (
    <main className="demo">
      <h1 className="demo-title">Glaze</h1>
      <p className="demo-subtitle">An ASMR squishy skin for Video.js</p>
      <ClientOnly fallback={<Placeholder />}>
        <Suspense fallback={<Placeholder />}>
          <GlazePlayer playbackId={PLAYBACK_ID} title="Glaze demo video" sounds={true} />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
