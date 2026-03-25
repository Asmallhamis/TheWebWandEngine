import { TextStyle } from 'pixi.js';

export const BASE_CELL_SIZE = 48;

export const VIEWPORT_BUFFER_ROWS = 2;
export const MIN_VISIBLE_POOL_ROWS = 4;
export const MAX_VISIBLE_POOL_CELLS = 800;

export const COLORS = {
  bg: 0x27272a,
  bgHover: 0x3f3f46,
  bgSelected: 0x6366f1,
  bgDrag: 0x6366f1,
  border: 0xffffff,
  borderHover: 0x6366f1,
  borderHoverSoft: 0x818cf8,
  borderUnknown: 0xf97316,
  bgUnknown: 0x431407,
  bgUnknownHover: 0x7c2d12,
  marked: 0xf59e0b,
  usesBg: 0x000000,
  usesText: 0xfbbf24,
  usesZero: 0xef4444,
  indexVisible: 0x22d3ee,
  unknownAccent: 0xf97316,
  unknownMod: 0x22d3ee,
  trigger: 0xef4444
};

export const TEXT_STYLES = {
  plus: new TextStyle({ fontFamily: 'sans-serif', fontSize: 20, fill: '#f59e0b', fontWeight: '300' }),
  unknownPrimary: new TextStyle({ fontFamily: 'sans-serif', fontSize: 12, fill: '#f97316', fontWeight: '700' }),
  unknownPrimaryMod: new TextStyle({ fontFamily: 'sans-serif', fontSize: 8, fill: '#22d3ee' }),
  unknownSecondary: new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: '#fb923c' }),
  deleteX: new TextStyle({ fontFamily: 'sans-serif', fontSize: 12, fill: '#ffffff', fontWeight: '700' }),
  usesLabel: new TextStyle({
    fontFamily: 'monospace', fontSize: 10, fill: '#fbbf24', fontWeight: '900',
    stroke: { color: '#000000', width: 1 }
  }),
  indexLabel: new TextStyle({
    fontFamily: 'sans-serif',
    fontSize: 12,
    fill: '#ffffff',
    fontWeight: '900',
    stroke: { color: '#000000', width: 2, join: 'round' }
  })
};

export type LayoutMetrics = {
  cols: number;
  rows: number;
  cellOuter: number;
  cellInner: number;
  gap: number;
  width: number;
  height: number;
  paddingLeft: number;
  paddingTop: number;
};

export type HitRect = { x: number; y: number; width: number; height: number };
