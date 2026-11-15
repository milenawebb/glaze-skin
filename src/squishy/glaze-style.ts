export type GlazeStyle = "candy" | "mono";
export const DEFAULT_GLAZE_STYLE: GlazeStyle = "candy";
export function monoStyleAmount(style: GlazeStyle = DEFAULT_GLAZE_STYLE) { return style === "mono" ? 1 : 0; }