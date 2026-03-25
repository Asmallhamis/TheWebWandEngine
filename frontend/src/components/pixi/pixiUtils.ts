import { BitmapText, SCALE_MODES, Text, TextStyle, Texture } from 'pixi.js';
import { BASE_CELL_SIZE, COLORS, TEXT_STYLES, type LayoutMetrics } from './pixiConstants';

export const supportsBitmapText = false;

export type CellDecorTextures = {
  roundedBg: Texture;
  border: Texture;
  hoverBorder: Texture;
  selectionRing: Texture;
  markedRing: Texture;
  deleteBadge: Texture;
  usesBg: Texture;
  triggerTriangle: Texture;
  hoverLine: Texture;
  patternCap: Texture;
};

const createCanvas = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D, scale: number) => void) => {
  const scale = typeof window !== 'undefined' ? Math.max(2, window.devicePixelRatio || 1) : 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);
  draw(ctx, scale);
  return canvas;
};

const roundedRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

export const truncateForLines = (value: string, maxCharsPerLine: number, maxLines: number) => {
  if (!value) return value;
  const chars = Array.from(value);
  const lines: string[] = [];
  let current = '';
  let consumed = 0;

  for (const ch of chars) {
    if (current.length >= maxCharsPerLine) {
      lines.push(current);
      current = '';
      if (lines.length >= maxLines) break;
    }
    current += ch;
    consumed++;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  const truncated = consumed < chars.length;
  if (truncated && lines.length) {
    const lastIdx = Math.min(lines.length - 1, maxLines - 1);
    const last = lines[lastIdx];
    lines[lastIdx] = last.length > 1 ? `${last.slice(0, -1)}…` : '…';
  }

  return lines.slice(0, maxLines).join('\n');
};

export const ensureBitmapFonts = () => {
  // Intentionally no-op.
  // For this grid we prefer crisp standard Text over BitmapText to avoid blur/artifact issues.
};

export const makeLabel = (style?: TextStyle) => {
  return new Text('', style ?? TEXT_STYLES.usesLabel);
};

export const setLabelText = (label: BitmapText | Text, text: string) => {
  (label as any).text = text;
};

export const setLabelTint = (label: BitmapText | Text, color: number) => {
  if ('tint' in label) {
    (label as any).tint = color;
  } else {
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    (label as Text).style.fill = hex;
  }
};

export const colorFromCss = (value?: string) => {
  if (!value) return 0xffffff;
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.replace('#', '');
    return parseInt(hex, 16);
  }
  return 0xffffff;
};

export const createDecorTextures = (): CellDecorTextures => {
  const configureTexture = (texture: Texture) => {
    if ((texture as any).baseTexture) {
      (texture as any).baseTexture.scaleMode = SCALE_MODES.NEAREST;
    }
    return texture;
  };

  const roundedBg = configureTexture(Texture.from(createCanvas(BASE_CELL_SIZE, BASE_CELL_SIZE, (ctx) => {
    roundedRectPath(ctx, 0, 0, BASE_CELL_SIZE, BASE_CELL_SIZE, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  })));

  const border = configureTexture(Texture.from(createCanvas(BASE_CELL_SIZE, BASE_CELL_SIZE, (ctx) => {
    roundedRectPath(ctx, 0.5, 0.5, BASE_CELL_SIZE - 1, BASE_CELL_SIZE - 1, 8);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  })));

  const hoverBorder = configureTexture(Texture.from(createCanvas(BASE_CELL_SIZE, BASE_CELL_SIZE, (ctx) => {
    roundedRectPath(ctx, 1, 1, BASE_CELL_SIZE - 2, BASE_CELL_SIZE - 2, 8);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  })));

  const selectionRing = configureTexture(Texture.from(createCanvas(BASE_CELL_SIZE + 2, BASE_CELL_SIZE + 2, (ctx) => {
    roundedRectPath(ctx, 0.5, 0.5, BASE_CELL_SIZE + 1, BASE_CELL_SIZE + 1, 10);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 4;
    ctx.stroke();

    roundedRectPath(ctx, 1.5, 1.5, BASE_CELL_SIZE - 1, BASE_CELL_SIZE - 1, 8);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.stroke();

    roundedRectPath(ctx, 3.5, 3.5, BASE_CELL_SIZE - 5, BASE_CELL_SIZE - 5, 7);
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  })));

  const markedRing = configureTexture(Texture.from(createCanvas(BASE_CELL_SIZE + 2, BASE_CELL_SIZE + 2, (ctx) => {
    roundedRectPath(ctx, 0.5, 0.5, BASE_CELL_SIZE + 1, BASE_CELL_SIZE + 1, 10);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.lineWidth = 3;
    ctx.stroke();

    roundedRectPath(ctx, 1.5, 1.5, BASE_CELL_SIZE - 1, BASE_CELL_SIZE - 1, 8);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();
  })));

  const deleteBadge = configureTexture(Texture.from(createCanvas(16, 16, (ctx) => {
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
  })));

  const usesBg = configureTexture(Texture.from(createCanvas(24, 14, (ctx) => {
    roundedRectPath(ctx, 0, 0, 24, 14, 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
  })));

  const triggerTriangle = configureTexture(Texture.from(createCanvas(14, 14, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(14, 14);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
  })));

  const hoverLine = configureTexture(Texture.from(createCanvas(4, BASE_CELL_SIZE, (ctx) => {
    roundedRectPath(ctx, 0, 0, 4, BASE_CELL_SIZE, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  })));

  const patternCap = configureTexture(Texture.from(createCanvas(4, 4, (ctx) => {
    ctx.beginPath();
    ctx.arc(2, 2, 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  })));

  return {
    roundedBg,
    border,
    hoverBorder,
    selectionRing,
    markedRing,
    deleteBadge,
    usesBg,
    triggerTriangle,
    hoverLine,
    patternCap
  };
};

export const destroyDecorTextures = (textures: CellDecorTextures | null | undefined) => {
  if (!textures) return;
  for (const texture of Object.values(textures)) {
    try {
      texture.destroy(true);
    } catch {
      // Best-effort cleanup.
    }
  }
};

export const computeLayout = (options: {
  contentWidth: number;
  totalSlots: number;
  gap: number;
  paddingLeft: number;
  paddingTop: number;
  cellOuterOverride?: number;
  colsOverride?: number;
  colsMaxOnly?: boolean;
}): LayoutMetrics => {
  const {
    contentWidth,
    totalSlots,
    gap,
    paddingLeft,
    paddingTop,
    cellOuterOverride,
    colsOverride,
    colsMaxOnly
  } = options;

  const minCellOuter = BASE_CELL_SIZE + gap;
  const availableWidth = Math.max(1, contentWidth || minCellOuter);
  const computedCols = Math.floor(availableWidth / minCellOuter) || 1;
  const requestedCols = colsOverride ?? computedCols;
  const cols = Math.max(1, colsMaxOnly ? Math.min(requestedCols, totalSlots) : requestedCols);
  const cellOuter = cellOuterOverride ?? (availableWidth / cols);
  const cellInner = Math.max(1, cellOuter - gap);
  const rows = Math.max(1, Math.ceil(totalSlots / cols));
  const width = cols * cellOuter;
  const height = rows * cellOuter;

  return {
    cols,
    rows,
    cellOuter,
    cellInner,
    gap,
    width,
    height,
    paddingLeft,
    paddingTop
  };
};
