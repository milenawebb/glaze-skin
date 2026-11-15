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
  expect(overlayCaptionText([{ mode: "hidden", kind: "captions", activeCues: [{ text: "First line" }, { text: "Second line" }] }], true)).toBe("First line\nSecond line");
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

it("sets every text track hidden so native captions never draw", () => {
  const tracks = ["showing", "disabled"].map((mode) => ({ mode: mode as TextTrackMode, kind: "captions", activeCues: [{ text: "Hello" }] }));
  overlayCaptionText(tracks, true);
  expect(tracks.map((track) => track.mode)).toEqual(["hidden", "hidden"]);
});
it("renders only one caption language from active cues", () => {
  expect(overlayCaptionText([
    { mode: "hidden", kind: "subtitles", activeCues: [{ text: "<b>Hello</b>" }] },
    { mode: "hidden", kind: "subtitles", activeCues: [{ text: "Bonjour" }] },
  ], true)).toBe("Hello");
});
it("CC off hides the overlay while native tracks remain hidden", () => {
  const track = { mode: "showing" as TextTrackMode, kind: "captions", activeCues: [{ text: "Hello" }] };
  expect(overlayCaptionText([track], false)).toBe("");
  expect(track.mode).toBe("hidden");
});
it("does not produce an empty caption box or show metadata", () => {
  expect(overlayCaptionText([{ mode: "hidden", kind: "metadata", activeCues: [{ text: "data" }] }], true)).toBe("");
  expect(overlayCaptionText([{ mode: "hidden", kind: "captions", activeCues: [{ text: "  " }] }], true)).toBe("");
});