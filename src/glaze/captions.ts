type CaptionTrack = { mode: TextTrackMode; kind: string; activeCues: ArrayLike<object> | null };
export const CAPTIONS_DEFAULT_ON = true;

export interface CaptionEngine {
  subtitleTrack: number;
  subtitleTracks: { lang?: string; name?: string }[];
}
export function isCaptionEngine(value: unknown): value is CaptionEngine {
  return typeof value === "object" && value !== null && "subtitleTrack" in value && "subtitleTracks" in value && Array.isArray(value.subtitleTracks);
}

/** The Video.js HLS bridge loads only showing tracks; select the engine directly instead. */
export function loadHiddenCaptionTrack(track: TextTrack | undefined, engine: CaptionEngine | undefined) {
  if (!track) return;
  track.mode = "hidden";
  if (!engine) return;
  const index = engine.subtitleTracks.findIndex((entry) => entry.lang === track.language && entry.name === track.label);
  if (index >= 0 && engine.subtitleTrack !== index) engine.subtitleTrack = index;
}

export function observeCaptionCues(video: HTMLVideoElement, engine: () => CaptionEngine | undefined, enabled: boolean, render: (text: string) => void) {
  const listeners = new Map<EventTarget, () => void>();
  let signature = "";
  const update = () => {
    const tracks = Array.from(video.textTracks);
    const active = tracks.find((track) => track.kind === "captions" || track.kind === "subtitles");
    loadHiddenCaptionTrack(active, engine());
    render(overlayCaptionText(video.textTracks, enabled));
    const next = JSON.stringify(tracks.map((track) => ({ kind: track.kind, label: track.label, language: track.language, mode: track.mode })));
    if (next !== signature) { signature = next; console.info("[Glaze captions] Tracks found:", JSON.parse(next)); }
  };
  const bind = () => {
    const targets: EventTarget[] = [...Array.from(video.textTracks), ...Array.from(video.querySelectorAll("track"))];
    for (const [target, clean] of listeners) if (!targets.includes(target)) { clean(); listeners.delete(target); }
    for (const target of targets) if (!listeners.has(target)) {
      const event = target instanceof HTMLTrackElement ? "load" : "cuechange";
      target.addEventListener(event, update);
      listeners.set(target, () => target.removeEventListener(event, update));
    }
    update();
  };
  video.textTracks.addEventListener("addtrack", bind);
  video.textTracks.addEventListener("removetrack", bind);
  video.textTracks.addEventListener("change", update);
  video.addEventListener("timeupdate", update);
  video.addEventListener("loadstart", bind);
  video.addEventListener("loadedmetadata", bind);
  const observer = new MutationObserver(bind);
  observer.observe(video, { childList: true });
  const retry = window.setInterval(bind, 500);
  bind();
  return () => {
    observer.disconnect(); window.clearInterval(retry);
    for (const clean of listeners.values()) clean();
    video.textTracks.removeEventListener("addtrack", bind);
    video.textTracks.removeEventListener("removetrack", bind);
    video.textTracks.removeEventListener("change", update);
    video.removeEventListener("timeupdate", update);
    video.removeEventListener("loadstart", bind);
    video.removeEventListener("loadedmetadata", bind);
  };
}

/** Keep native rendering off; only one caption language contributes active cues. */
export function overlayCaptionText(tracks: ArrayLike<CaptionTrack>, enabled: boolean): string {
  const list = Array.from(tracks);
  for (const track of list) if (track.mode !== "hidden") track.mode = "hidden";
  if (!enabled) return "";
  for (const track of list) {
    if (track.kind !== "captions" && track.kind !== "subtitles") continue;
    const text = Array.from(track.activeCues ?? []).map((cue) =>
      ("text" in cue ? String(cue.text) : "").replace(/<[^>]*>/g, "").trim()).filter(Boolean).join("\n");
    if (text) return text;
  }
  return "";
}