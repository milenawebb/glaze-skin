import { PREVIEW_FADE_IN_MS, PREVIEW_FADE_OUT_MS, type PreviewMode } from "./demo-preview";

/** One stable player, with size changes committed only while its area is hidden. */
export function createPreviewTransition(area: HTMLElement, apply: (mode: PreviewMode) => void, reduced: () => boolean) {
  let animation: Animation | undefined;
  let version = 0;
  return {
    async select(mode: PreviewMode) {
      const current = ++version;
      const opacity = getComputedStyle(area).opacity;
      animation?.cancel();
      if (!reduced()) {
        animation = area.animate([{ opacity }, { opacity: 0 }], { duration: PREVIEW_FADE_OUT_MS, fill: "forwards", easing: "ease-out" });
        try { await animation.finished; } catch { return; }
        if (current !== version) return;
      }
      // Layout and drawing-buffer rebuild finish synchronously before visibility returns.
      apply(mode);
      animation?.cancel();
      animation = undefined;
      if (!reduced()) {
        animation = area.animate([{ opacity: 0 }, { opacity: 1 }], { duration: PREVIEW_FADE_IN_MS, fill: "forwards", easing: "ease-in" });
        try { await animation.finished; } catch { return; }
        if (current === version) { animation.cancel(); animation = undefined; }
      }
    },
    cancel() { version++; animation?.cancel(); animation = undefined; },
  };
}