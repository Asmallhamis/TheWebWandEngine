import {
  BitmapText,
  Container,
  Sprite,
  Text,
  Texture
} from 'pixi.js';
import { BASE_CELL_SIZE, TEXT_STYLES, type HitRect } from './pixiConstants';
import { makeLabel, type CellDecorTextures } from './pixiUtils';

export type Cell = {
  container: Container;
  bg: Sprite;
  border: Sprite;
  selectionRing: Sprite;
  markedRing: Sprite;
  hoverBorder: Sprite;
  hoverLine: Sprite;
  patternBarShadow: Sprite;
  patternBar: Sprite;
  patternStartCap: Sprite;
  patternEndCap: Sprite;
  icon: Sprite;
  plusText: Text;
  unknownPrimary: Text;
  unknownSecondary: Text;
  deleteBadge: Sprite;
  deleteX: Text;
  usesBg: Sprite;
  usesText: BitmapText | Text;
  indexText: BitmapText | Text;
  triggerTriangle: Sprite;
  size: number;
  usesHitRect: HitRect | null;
  deleteHitRect: HitRect | null;
  boundIndex: number | null;
  stateHash?: number;
};

export const createCell = (textures: CellDecorTextures): Cell => {
  const container = new Container();

  const bg = new Sprite(textures.roundedBg);
  container.addChild(bg);

  const border = new Sprite(textures.border);
  container.addChild(border);

  const icon = new Sprite(Texture.WHITE);
  icon.anchor.set(0.5);
  container.addChild(icon);

  const plusText = new Text('+', TEXT_STYLES.plus);
  plusText.anchor.set(0.5);
  plusText.alpha = 0.5;
  container.addChild(plusText);

  const unknownPrimary = new Text('', TEXT_STYLES.unknownPrimary);
  unknownPrimary.anchor.set(0.5);
  container.addChild(unknownPrimary);

  const unknownSecondary = new Text('', TEXT_STYLES.unknownSecondary);
  unknownSecondary.anchor.set(0.5);
  container.addChild(unknownSecondary);

  const usesBg = new Sprite(textures.usesBg);
  usesBg.visible = false;
  container.addChild(usesBg);

  const usesText = makeLabel(TEXT_STYLES.usesLabel);
  usesText.visible = false;
  container.addChild(usesText);

  const indexText = makeLabel(TEXT_STYLES.indexLabel);
  indexText.visible = false;
  container.addChild(indexText);

  const triggerTriangle = new Sprite(textures.triggerTriangle);
  triggerTriangle.visible = false;
  container.addChild(triggerTriangle);

  const selectionRing = new Sprite(textures.selectionRing);
  selectionRing.visible = false;
  container.addChild(selectionRing);

  const markedRing = new Sprite(textures.markedRing);
  markedRing.visible = false;
  container.addChild(markedRing);

  const hoverBorder = new Sprite(textures.hoverBorder);
  hoverBorder.visible = false;
  container.addChild(hoverBorder);

  const hoverLine = new Sprite(textures.hoverLine);
  hoverLine.visible = false;
  container.addChild(hoverLine);

  const patternBarShadow = new Sprite(Texture.WHITE);
  patternBarShadow.visible = false;
  container.addChild(patternBarShadow);

  const patternBar = new Sprite(Texture.WHITE);
  patternBar.visible = false;
  container.addChild(patternBar);

  const patternStartCap = new Sprite(textures.patternCap);
  patternStartCap.anchor.set(0.5);
  patternStartCap.visible = false;
  container.addChild(patternStartCap);

  const patternEndCap = new Sprite(textures.patternCap);
  patternEndCap.anchor.set(0.5);
  patternEndCap.visible = false;
  container.addChild(patternEndCap);

  const deleteBadge = new Sprite(textures.deleteBadge);
  deleteBadge.anchor.set(0.5);
  deleteBadge.visible = false;
  container.addChild(deleteBadge);

  const deleteX = new Text('×', TEXT_STYLES.deleteX);
  deleteX.anchor.set(0.5);
  deleteX.visible = false;
  container.addChild(deleteX);

  const textResolution = typeof window !== 'undefined' ? Math.max(2, window.devicePixelRatio || 1) : 2;
  [plusText, unknownPrimary, unknownSecondary, deleteX, usesText, indexText].forEach((label) => {
    if ('resolution' in label) {
      (label as any).resolution = textResolution;
    }
  });

  return {
    container,
    bg,
    border,
    selectionRing,
    markedRing,
    hoverBorder,
    hoverLine,
    patternBarShadow,
    patternBar,
    patternStartCap,
    patternEndCap,
    icon,
    plusText,
    unknownPrimary,
    unknownSecondary,
    deleteBadge,
    deleteX,
    usesBg,
    usesText,
    indexText,
    triggerTriangle,
    size: BASE_CELL_SIZE,
    usesHitRect: null,
    deleteHitRect: null,
    boundIndex: null
  };
};

export const bindCell = (cell: Cell, dataIndex: number) => {
  if (cell.boundIndex !== dataIndex) {
    cell.stateHash = undefined;
  }
  cell.boundIndex = dataIndex;
  cell.container.visible = true;
};

export const unbindCell = (cell: Cell) => {
  cell.boundIndex = null;
  cell.container.visible = false;
  cell.container.scale.set(1);
  cell.usesHitRect = null;
  cell.deleteHitRect = null;
  cell.stateHash = undefined;
};

export const layoutCell = (cell: Cell) => {
  const size = cell.size;

  cell.bg.position.set(0, 0);
  cell.bg.width = size;
  cell.bg.height = size;

  cell.border.position.set(0, 0);
  cell.border.width = size;
  cell.border.height = size;

  cell.selectionRing.position.set(-1, -1);
  cell.selectionRing.width = size + 2;
  cell.selectionRing.height = size + 2;

  cell.markedRing.position.set(-1, -1);
  cell.markedRing.width = size + 2;
  cell.markedRing.height = size + 2;

  cell.hoverBorder.position.set(0, 0);
  cell.hoverBorder.width = size;
  cell.hoverBorder.height = size;

  cell.hoverLine.position.set(0, 0);
  cell.hoverLine.width = 4;
  cell.hoverLine.height = size;

  cell.icon.position.set(size / 2, size / 2);
  cell.plusText.position.set(size / 2, size / 2);

  cell.unknownPrimary.position.set(size / 2, size / 2 - 4);
  cell.unknownSecondary.position.set(size / 2, size / 2 + 6);

  cell.patternBarShadow.position.set(0, Math.max(0, size - 4));
  cell.patternBarShadow.width = size;
  cell.patternBarShadow.height = 3;

  cell.patternBar.position.set(0, Math.max(0, size - 3));
  cell.patternBar.width = size;
  cell.patternBar.height = 3;

  const deleteSize = 16;
  cell.deleteBadge.width = deleteSize;
  cell.deleteBadge.height = deleteSize;
  cell.deleteBadge.position.set(size - deleteSize / 2 + 2, deleteSize / 2 - 2);
  cell.deleteX.position.set(size - deleteSize / 2 + 2, deleteSize / 2 - 2);

  cell.triggerTriangle.position.set(0, Math.max(0, size - 14));
  cell.triggerTriangle.width = 14;
  cell.triggerTriangle.height = 14;

  cell.usesText.position.set(4, size - 12);
  cell.indexText.position.set(size - cell.indexText.width - 2, size - cell.indexText.height - 2);
};

export const ensurePool = (
  pool: Cell[],
  container: Container | null,
  count: number,
  textures: CellDecorTextures
) => {
  if (!container) return;
  while (pool.length < count) {
    const cell = createCell(textures);
    pool.push(cell);
    container.addChild(cell.container);
  }
  while (pool.length > count) {
    const cell = pool.pop()!;
    try {
      container.removeChild(cell.container);
      cell.container.destroy({ children: true });
    } catch {
      // best-effort cleanup
    }
  }
};
