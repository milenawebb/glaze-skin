import { expect, it } from "vitest";
import { overlayCaptionText, CAPTIONS_DEFAULT_ON, loadHiddenCaptionTrack, observeCaptionCues } from "./captions";

it("starts captions ON by default", () => { expect(CAPTIONS_DEFAULT_ON).toBe(true); });
it("selects the Mux subtitle loader while keeping the native track hidden", () => {
  const track = { mode: "disabled", language: "en", label: "English" } as TextTrack;
  const engine = { subtitleTrack: -1, subtitleTracks: [{ lang: "en", name: "English" }] };
  loadHiddenCaptionTrack(track, engine);
  expect(engine.subtitleTrack).toBe(0);
  expect(track.mode).toBe("hidden");
});
it("joins multiple simultaneous caption cues with a line break", () => {
  const own = { mode: "hidden" as TextTrackMode, kind: "captions", activeCues: [{ text: "First line" }, { text: "Second line" }] };
  expect(overlayCaptionText([own], true, own)).toBe("First line\nSecond line");
});
it("updates on cuechange and timeupdate, then removes listeners on detach", () => {
  const video = document.createElement("video");
  const track = Object.assign(new EventTarget(), { kind: "captions", mode: "hidden", label: "English", language: "en", activeCues: [{ text: "First" }] });
  const tracks = Object.assign(new EventTarget(), { 0: track, length: 1 });
  Object.defineProperty(video, "textTracks", { value: tracks });
  let text = "";
  const detach = observeCaptionCues(video, () => undefined, true, (value) => { text = value; });
  track.activeCues = [{ text: "Cue event" }]; track.dispatchEvent(new Event("cuechange")); expect(text).toBe("Cue event");
  track.activeCues = [{ text: "Time event" }]; video.dispatchEvent(new Event("timeupdate")); expect(text).toBe("Time event");
  detach(); track.activeCues = [{ text: "Detached" }]; track.dispatchEvent(new Event("cuechange")); expect(text).toBe("Time event");
});
it("disables a late generated stream track and only ever shows our own captions", () => {
  const video = document.createElement("video");
  const tracks = Object.assign(new EventTarget(), { 0: undefined as EventTarget | undefined, length: 0 });
  Object.defineProperty(video, "textTracks", { value: tracks });
  let text = "";
  const detach = observeCaptionCues(video, () => undefined, true, (value) => { text = value; });
  const generated = Object.assign(new EventTarget(), { kind: "subtitles", mode: "disabled", label: "English (Generated)", language: "en", activeCues: [{ text: "Robot caption" }] });
  tracks[0] = generated; tracks.length = 1; tracks.dispatchEvent(new Event("addtrack"));
  expect(generated.mode).toBe("disabled"); expect(text).toBe("");
  const own = Object.assign(new EventTarget(), { kind: "captions", mode: "disabled", label: "English", language: "en", activeCues: [{ text: "Real caption" }] });
  tracks[1] = own; tracks.length = 2; tracks.dispatchEvent(new Event("addtrack"));
  expect(own.mode).toBe("hidden"); expect(generated.mode).toBe("disabled"); expect(text).toBe("Real caption");
  own.activeCues = [{ text: "New cue" }]; own.dispatchEvent(new Event("cuechange")); expect(text).toBe("New cue");
  generated.activeCues = [{ text: "Robot again" }]; generated.dispatchEvent(new Event("cuechange")); expect(text).toBe("New cue");
  detach();
});
it("replaces listeners when the source changes", () => {
  const video = document.createElement("video");
  const first = Object.assign(new EventTarget(), { kind: "captions", mode: "hidden", label: "English", language: "en", activeCues: [{ text: "Old source" }] });
  const tracks = Object.assign(new EventTarget(), { 0: first as EventTarget | undefined, length: 1 });
  Object.defineProperty(video, "textTracks", { value: tracks });
  let text = "";
  const detach = observeCaptionCues(video, () => undefined, true, (value) => { text = value; });
  expect(text).toBe("Old source");
  const next = Object.assign(new EventTarget(), { kind: "captions", mode: "disabled", label: "English", language: "en", activeCues: [{ text: "New source" }] });
  tracks[0] = next; video.dispatchEvent(new Event("loadstart"));
  expect(text).toBe("New source");
  next.activeCues = [{ text: "New cue" }]; next.dispatchEvent(new Event("cuechange")); expect(text).toBe("New cue");
  first.activeCues = [{ text: "Stale" }]; first.dispatchEvent(new Event("cuechange")); expect(text).toBe("New cue");
  detach();
});
it("updates cues when a sideloaded caption track finishes loading", () => {
  const video = document.createElement("video");
  const element = document.createElement("track"); element.kind = "captions"; element.srclang = "en"; element.src = "/captions.vtt"; element.default = true; video.append(element);
  const track = Object.assign(new EventTarget(), { kind: "captions", mode: "disabled", label: "English", language: "en", activeCues: [] as { text: string }[] });
  Object.defineProperty(video, "textTracks", { value: Object.assign(new EventTarget(), { 0: track, length: 1 }) });
  let text = "";
  const detach = observeCaptionCues(video, () => undefined, true, (value) => { text = value; });
  track.activeCues = [{ text: "Loaded caption" }]; element.dispatchEvent(new Event("load")); expect(text).toBe("Loaded caption"); expect(track.mode).toBe("hidden");
  detach();
});

it("keeps our own track hidden and disables every other captions or subtitles track", () => {
  const own = { mode: "showing" as TextTrackMode, kind: "captions", activeCues: [{ text: "Hello" }] };
  const generated = { mode: "showing" as TextTrackMode, kind: "subtitles", activeCues: [{ text: "Robot" }] };
  overlayCaptionText([own, generated], true, own);
  expect(own.mode).toBe("hidden");
  expect(generated.mode).toBe("disabled");
});
it("renders only our own track, never a generated one", () => {
  const own = { mode: "hidden" as TextTrackMode, kind: "captions", activeCues: [{ text: "<b>Hello</b>" }] };
  const generated = { mode: "hidden" as TextTrackMode, kind: "subtitles", activeCues: [{ text: "Robot" }] };
  expect(overlayCaptionText([generated, own], true, own)).toBe("Hello");
});
it("never falls back to a generated track when our own track has no cues yet", () => {
  const own = { mode: "hidden" as TextTrackMode, kind: "captions", activeCues: [] };
  const generated = { mode: "hidden" as TextTrackMode, kind: "subtitles", activeCues: [{ text: "Generated" }] };
  expect(overlayCaptionText([generated, own], true, own)).toBe("");
});
it("CC off hides the overlay while our track stays hidden", () => {
  const own = { mode: "showing" as TextTrackMode, kind: "captions", activeCues: [{ text: "Hello" }] };
  expect(overlayCaptionText([own], false, own)).toBe("");
  expect(own.mode).toBe("hidden");
});
it("does not produce an empty caption box or show metadata", () => {
  expect(overlayCaptionText([{ mode: "hidden", kind: "metadata", activeCues: [{ text: "data" }] }], true)).toBe("");
  const own = { mode: "hidden" as TextTrackMode, kind: "captions", activeCues: [{ text: "  " }] };
  expect(overlayCaptionText([own], true, own)).toBe("");
});
