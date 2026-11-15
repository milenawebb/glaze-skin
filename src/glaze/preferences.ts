import type { GlazeStyle } from "./glaze-style";
export const COLORS = ["Rainbow", "Strawberry", "Lilac", "Matcha"] as const;
export type GlazeColor = typeof COLORS[number];
export const OPTIONS: Record<GlazeColor, { label: string; glazeStyle: GlazeStyle }> = {
  Rainbow: { label: "Rainbow candy", glazeStyle: "candy" },
  Strawberry: { label: "Strawberry candy", glazeStyle: "candy" },
  Lilac: { label: "Lilac", glazeStyle: "mono" },
  Matcha: { label: "Matcha", glazeStyle: "mono" },
};
export const COLOR_FADE_MS = 400;
export function readPreferences(storage: Pick<Storage, "getItem">, startSounds = false) {
  try {
    // Read the former key too so the rename preserves existing viewer choices.
    const value = JSON.parse(storage.getItem("glaze-preferences") ?? storage.getItem("squishy-preferences") ?? "{}");
    return { color: COLORS.includes(value?.color) ? value.color as GlazeColor : "Rainbow" as GlazeColor, sounds: typeof value?.sounds === "boolean" ? value.sounds : startSounds };
  } catch { return { color: "Rainbow" as GlazeColor, sounds: startSounds }; }
}
export function savePreferences(storage: Pick<Storage, "setItem">, color: GlazeColor, sounds: boolean) {
  try { storage.setItem("glaze-preferences", JSON.stringify({ color, sounds })); } catch { /* Private storage must not break controls. */ }
}