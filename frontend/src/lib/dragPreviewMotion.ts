type DragPreviewPoint = { x: number; y: number };

let previewEl: HTMLElement | null = null;
let latestPoint: DragPreviewPoint = { x: 0, y: 0 };
let frameId: number | null = null;

const PREVIEW_OFFSET = 5;

const applyPreviewTransform = () => {
  frameId = null;
  if (!previewEl) return;
  const x = latestPoint.x + PREVIEW_OFFSET;
  const y = latestPoint.y + PREVIEW_OFFSET;
  previewEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
};

export const registerDragPreviewElement = (el: HTMLElement | null) => {
  previewEl = el;
  applyPreviewTransform();
  return () => {
    if (previewEl === el) previewEl = null;
  };
};

export const moveDragPreview = (point: DragPreviewPoint) => {
  latestPoint = point;
  if (frameId !== null) return;
  frameId = window.requestAnimationFrame(applyPreviewTransform);
};

