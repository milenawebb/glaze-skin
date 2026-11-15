import type { GlazeStyle } from "./glaze-style";
export const COLORS = ["Rainbow", "Strawberry", "Lilac", "Matcha"] as const;
export type SquishyColor = typeof COLORS[number];
export const OPTIONS: Record<SquishyColor, { label: string; glazeStyle: GlazeStyle }> = {
  Rainbow: { label: "Rainbow candy", glazeStyle: "candy" },
  Strawberry: { label: "Strawberry candy", glazeStyle: "candy" },
  Lilac: { label: "Lilac", glazeStyle: "mono" },
  Matcha: { label: "Matcha", glazeStyle: "mono" },
};
export const COLOR_FADE_MS = 400;
export function readPreferences(storage: Pick<Storage, "getItem">) {
  try {
    const value = JSON.parse(storage.getItem("squishy-preferences") ?? "{}");
    return { color: COLORS.includes(value?.color) ? value.color as SquishyColor : "Rainbow" as SquishyColor, sounds: value?.sounds === true };
  } catch { return { color: "Rainbow" as SquishyColor, sounds: false }; }
}
export function savePreferences(storage: Pick<Storage, "setItem">, color: SquishyColor, sounds: boolean) {
  try { storage.setItem("squishy-preferences", JSON.stringify({ color, sounds })); } catch { /* Private storage must not break controls. */ }
}