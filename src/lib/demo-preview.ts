export const PREVIEW_MODES = ["Desktop", "Tablet", "Mobile"] as const;
export type PreviewMode = typeof PREVIEW_MODES[number];
export const PREVIEW_WIDTHS: Record<PreviewMode, number> = { Desktop: 960, Tablet: 768, Mobile: 390 };
export const PREVIEW_TRANSITION_MS = 300;
export function nextPreview(mode: PreviewMode, key: string): PreviewMode {
  const index = PREVIEW_MODES.indexOf(mode);
  if (key === "Home") return "Desktop";
  if (key === "End") return "Mobile";
  return PREVIEW_MODES[(index + (key === "ArrowLeft" ? -1 : 1) + PREVIEW_MODES.length) % PREVIEW_MODES.length] ?? "Desktop";
}