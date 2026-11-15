import { expect, it } from "vitest";
import { overlayCaptionText } from "./captions";

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