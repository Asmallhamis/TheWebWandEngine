export interface SpellInfo {
  id: string;
  icon: string;
  name: string;
  en_name?: string;
  pinyin?: string;
  pinyin_initials?: string;
  pinyin_variants?: string[];
  pinyin_initials_variants?: string[];
  aliases?: string;
  alias_pinyin?: string;
  alias_initials?: string;
  alias_pinyin_variants?: string[];
  alias_initials_variants?: string[];
  type: number;
  max_uses?: number;
  icon_base64?: string;
  mod_id?: string;
}

export interface WandData {
  mana_max: number;
  mana_charge_speed: number;
  reload_time: number;
  fire_rate_wait: number;
  deck_capacity: number;
  shuffle_deck_when_empty: boolean;
  spread_degrees: number;
  speed_multiplier: number;
  actions_per_round: number;
  spells: Record<string, string>;
  spell_uses: Record<string, number>;
  marked_slots?: number[];
  always_cast: string[];
  appearance?: {
    sprite?: string;
    name?: string;
    item_sprite?: string;
  };
  canvas_positions?: Record<string, { x: number, y: number }>;
  canvas_cells_per_row?: number;
  evaluation_seed?: string;
}

export interface HistoryItem {
  id: string;
  wands: Record<string, WandData>;
  name: string;
  icons?: string[];
  timestamp: number;
}

export interface Tab {
  id: string;
  name: string;
  isRealtime: boolean;
  wands: Record<string, WandData>;
  expandedWands: Set<string>;
  past: HistoryItem[];
  future: HistoryItem[];
}

export interface SpellTypeConfig {
  id: number;
  name: string;
  color: string;
}

export interface SpellGroupConfig {
  name: string;
  types: number[];
  color?: string;
}

/** 模式中的单个槽位匹配器 */
export interface PatternSlot {
  /** 候选法术 ID，任一匹配即可。支持前缀通配: 'DIVIDE_*' */
  alternatives: string[];
}

export interface SpellMarkingRule {
  id: string;
  name: string;
  /** 模式槽位序列 */
  pattern: PatternSlot[];
  matchMode: 'exact' | 'repeat' | 'contains';
  /** repeat 模式下最少重复次数 */
  minRepeat: number;
  /** 是否跳过空格子 */
  ignoreEmpty: boolean;
  /** 标记颜色 (CSS 色值) */
  color: string;
  /** 可选标签文字 */
  label?: string;
  enabled: boolean;
  /** 内置规则不可删除，可编辑、可禁用 */
  isBuiltIn?: boolean;
}

export interface AppSettings {
  commonLimit: number;
  categoryLimit: number;
  allowCompactEdit: boolean;
  pickerRowHeight: number;
  themeColors: string[];
  wrapLimit: number;
  hideLabels: boolean;
  conflictStrategy: 'ask' | 'override_game' | 'new_workflow';
  autoExpandOnPaste: boolean;
  defaultWandStats: Partial<WandData>;
  numCasts: number;
  autoHideThreshold: number;
  showSpellCharges: boolean;
  unlimitedSpells: boolean;
  initialIfHalf: boolean;
  evaluationSeed?: number | string;
  simulateLowHp: boolean;
  simulateManyEnemies: boolean;
  simulateManyProjectiles: boolean;
  groupIdenticalCasts: boolean;
  foldNodes: boolean;
  showIndices: boolean;
  editorSpellGap: number;
  showStatsInFrames: boolean;
  showLegacyWandButton: boolean;
  deleteEmptySlots: boolean;
  ctrlClickDelete: boolean;
  exportHistory: boolean;
  embedMetadataInImage: boolean;
  pureSpellsExport: boolean;
  showDragModeToggle: boolean;
  editorDragMode: 'cursor' | 'hand';
  dragSpellMode: 'legacy' | 'noita_swap' | '20260222';
  dragModeTogglePos?: { x: number, y: number };
  spellTypes: SpellTypeConfig[];
  spellGroups: SpellGroupConfig[];
  warehouseFolderHeight: number;
  wikiLanguage: 'en' | 'zh';
  stopAtRecharge: boolean;
  perks: Record<string, number>;
  recursionIterationDisplay: 'none' | 'simple' | 'labeled';
  mobilePickerMode: boolean;
  disablePickerAutoFocus: boolean;
  uiScale: number;
  wandAttributesScale: number;
  hideSyncButton: boolean;
  compactAttributes: boolean;
  triggerVisualizationMode: 'standard' | 'wanddbg';
  userMarkingRules?: SpellMarkingRule[];
  isCanvasMode?: boolean;
  showSpellId: boolean;
  defaultCanvasCellsPerRow: number;
  maxCanvasCellsPerRow: number;
  enableCanvasEditorLock: boolean;
  pickerFirstSpaceBehavior: 'ignore' | 'insert_at_current_hover' | 'insert_at_open_anchor';
  moveExistingWandToTopOnDuplicatePaste: boolean;
  coolUIMode: boolean;
  coolUITheme: string;
  coolUIBackground: string;
}

export interface EvalNode {
  name: string;
  count: number;
  extra: string;
  index: number[];
  shot_id?: number;
  iteration?: number;
  source?: 'action' | 'draw';
  recursion?: number;
  children: EvalNode[];
}

export interface ShotState {
  id: number;
  cast: number;
  stats: Record<string, number | string>;
  source_spell?: string;
  trigger_type?: 'trigger' | 'timer' | 'death';
  projectiles?: string[];
}

export interface EvalResponse {
  seed?: number;
  tree: EvalNode;
  states: ShotState[];
  counts: Record<string, number>;
  cast_counts: Record<string, Record<string, number>>;
}

export interface WarehouseWand extends WandData {
  id: string;
  name: string;
  pinyin?: string;
  pinyin_initials?: string;
  tags: string[];
  description?: string;
  createdAt: number;
  folderId?: string | null;
  order?: number;
}

export interface WarehouseFolder {
  id: string;
  name: string;
  order: number;
  isOpen?: boolean;
  parentId?: string | null;
}

export interface SmartTag {
  id: string;
  name: string;
  spells: string[];
  excludedSpells?: string[];
  mode: 'strict' | 'contains';
}

export interface WandSelection {
  wandSlot: string;
  indices: number[];
  startIdx: number;
}

export interface PickerInsertAnchor {
  wandSlot: string;
  idx: number;
  isRightHalf: boolean;
}

export interface SpellPickerOpenOptions {
  x: number;
  y: number;
  initialSearch?: string;
  rowTop?: number;
  insertAnchor?: PickerInsertAnchor | null;
}

export type SpellPickerTrigger = React.MouseEvent | SpellPickerOpenOptions;

export interface PickerConfig {
  wandSlot: string;
  spellIdx: string;
  x: number;
  y: number;
  initialSearch?: string;
  rowTop?: number;
  insertAnchor?: PickerInsertAnchor | null;
}


export interface Conflict {
  tabId: string;
  gameWands: Record<string, WandData>;
}

export interface AppNotification {
  msg: string;
  type: 'info' | 'success' | 'error';
}

export interface DragSource {
  wandSlot: string;
  idx: number;
  sid: string;
}

export interface MousePos {
  x: number;
  y: number;
}

export type SpellDb = Record<string, SpellInfo>;

export interface SpellStats {
  overall: SpellInfo[];
  categories: SpellInfo[][];
}
