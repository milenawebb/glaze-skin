import { expect, it } from "vitest";
import { EMBED_FRAME_POLICY, isEmbedPage } from "./embed-policy";

it("permits the embed on milenawebb.com and its www host, without arbitrary sites", () => {
  expect(EMBED_FRAME_POLICY).toBe("frame-ancestors 'self' https://milenawebb.com https://www.milenawebb.com");
});

it("applies the iframe policy only to the embed page", () => {
  expect(isEmbedPage("/embed")).toBe(true);
  expect(isEmbedPage("/embed/")).toBe(true);
  expect(isEmbedPage("/")).toBe(false);
  expect(isEmbedPage("/embed-other")).toBe(false);
});