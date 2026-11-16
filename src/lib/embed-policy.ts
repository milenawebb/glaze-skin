/** Limit cross-site framing to the portfolio, while retaining same-site previews. */
export const EMBED_FRAME_POLICY = "frame-ancestors 'self' https://milenawebb.com https://www.milenawebb.com";

export function isEmbedPage(pathname: string) {
  return pathname === "/embed" || pathname === "/embed/";
}