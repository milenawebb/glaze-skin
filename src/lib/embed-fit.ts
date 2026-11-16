export function embedLayout(layout: string, finePointer: boolean, availableWidth: number) {
  const desktop = layout === "desktop" && finePointer;
  return { desktop, width: desktop ? 960 : Math.min(900, availableWidth) };
}

export function embedFit(width: number, height: number, contentWidth: number, contentHeight: number) {
  const scale = Math.max(0, Math.min(1, width / Math.max(1, contentWidth), height / Math.max(1, contentHeight)));
  return { scale, width: contentWidth * scale, height: contentHeight * scale };
}