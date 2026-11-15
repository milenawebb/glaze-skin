import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

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
  return (
    <main className="demo">
      <h1 className="demo-title">Squishy</h1>
      <ClientOnly fallback={<Placeholder />}>
        <Suspense fallback={<Placeholder />}>
          <SquishyPlayer playbackId={PLAYBACK_ID} title="Squishy demo video" sounds={true} />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
