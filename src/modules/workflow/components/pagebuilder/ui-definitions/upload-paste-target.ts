let activeUploadPasteTargetId: string | null = null;
let hoverUploadPasteTargetId: string | null = null;

export function markUploadPasteTargetActive(targetId: string) {
  activeUploadPasteTargetId = targetId;
}

export function clearUploadPasteTargetActive(targetId: string) {
  if (activeUploadPasteTargetId === targetId) {
    activeUploadPasteTargetId = null;
  }
}

export function markUploadPasteTargetHover(targetId: string) {
  hoverUploadPasteTargetId = targetId;
}

export function clearUploadPasteTargetHover(targetId: string) {
  if (hoverUploadPasteTargetId === targetId) {
    hoverUploadPasteTargetId = null;
  }
}

export function shouldHandleUploadPaste(targetId: string) {
  if (activeUploadPasteTargetId) {
    return activeUploadPasteTargetId === targetId;
  }
  return hoverUploadPasteTargetId === targetId;
}
