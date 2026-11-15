type CaptionTrack = { mode: TextTrackMode; kind: string; activeCues: ArrayLike<object> | null };

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