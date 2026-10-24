export type CanvasPreviewFocusOptionDetail = {
  componentId: string;
  optionIndex: number;
};

export function getCanvasPreviewFocusOptionEventName(componentType: string) {
  return `pagebuilder:focus-ext-option:${componentType}`;
}

export function dispatchCanvasPreviewFocusOption(componentType: string, detail: CanvasPreviewFocusOptionDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CanvasPreviewFocusOptionDetail>(getCanvasPreviewFocusOptionEventName(componentType), { detail }));
}
