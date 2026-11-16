import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { embedFit, embedLayout } from "@/lib/embed-fit";

const PLAYBACK_ID = "IL8LEwPXBY4C2HldJqjKKjtO6y5aGkQXqVPWx5cuo01g";
const RELOAD_FLAG = "glaze-embed-reloaded";
const POSTER = `https://image.mux.com/${PLAYBACK_ID}/thumbnail.webp?time=1&width=1280`;

function RefreshPlayer() {
  return <div className="sq-load-error" role="alert">
    <p>The glaze needs a refresh</p>
    <Button onClick={() => {
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* Storage is optional. */ }
      window.location.reload();
    }}>Refresh</Button>
  </div>;
}

const EmbedPlayer = lazy(async () => {
  const load = () => import("@/glaze").then(m => ({ default: m.GlazePlayer }));
  try {
    const player = await load().catch(() => new Promise<Awaited<ReturnType<typeof load>>>((resolve, reject) => {
      setTimeout(() => load().then(resolve, reject), 500);
    }));
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* Storage is optional. */ }
    return player;
  } catch {
    let reloaded = true;
    try {
      reloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
      if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch { /* Show the fallback if storage is unavailable. */ }
    if (!reloaded) { window.location.reload(); return new Promise<never>(() => {}); }
    return { default: RefreshPlayer };
  }
});

export const Route = createFileRoute("/embed")({
  validateSearch: (search: Record<string, unknown>) => ({ layout: typeof search['layout'] === "string" ? search['layout'] : "" }),
  head: () => ({ meta: [
    { title: "Glaze player embed" },
    { name: "description", content: "The Glaze ASMR video player with crackable glaze, a squishy frame and English captions." },
    { property: "og:title", content: "Glaze player embed" },
    { property: "og:description", content: "The Glaze ASMR video player with crackable glaze, a squishy frame and English captions." },
    { property: "og:type", content: "website" },
    { property: "og:image", content: POSTER },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: POSTER },
  ] }),
  component: Embed,
});

function LoadingPlayer() {
  return <div className="embed-placeholder" role="status" aria-label="Loading" />;
}

function Embed() {
  const { layout } = Route.useSearch();
  const viewport = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const fitted = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const outer = viewport.current, inner = content.current, box = fitted.current;
    if (!outer || !inner || !box) return;
    const pointer = window.matchMedia("(pointer: fine)");
    const fit = () => {
      const { desktop, width } = embedLayout(layout, pointer.matches, outer.clientWidth);
      if (desktop) outer.dataset['layout'] = "desktop";
      else delete outer.dataset['layout'];
      inner.style.width = `${width}px`;
      const result = embedFit(outer.clientWidth, outer.clientHeight, width, inner.offsetHeight);
      inner.style.transform = `scale(${result.scale})`;
      box.style.width = `${result.width}px`;
      box.style.height = `${result.height}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(outer); observer.observe(inner);
    pointer.addEventListener("change", fit);
    fit();
    return () => { observer.disconnect(); pointer.removeEventListener("change", fit); };
  }, [layout]);
  return <main ref={viewport} className="glaze-embed" aria-label="Glaze video player">
    <div ref={fitted} className="embed-fitted"><div ref={content} className="embed-content">
    <ClientOnly fallback={<LoadingPlayer />}>
      <Suspense fallback={<LoadingPlayer />}>
        <EmbedPlayer playbackId={PLAYBACK_ID} title="Glaze demo video" sounds={false} />
      </Suspense>
    </ClientOnly>
    </div></div>
  </main>;
}