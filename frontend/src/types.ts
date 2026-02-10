export interface SpellInfo {
  id: string;
  icon: string;
  name: string;
  en_name?: string;
  pinyin?: string;
  pinyin_initials?: string;
  aliases?: string;
  alias_pinyin?: string;
  alias_initials?: string;
  type: number;
  max_uses?: number;
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
  exportHistory: boolean;
  embedMetadataInImage: boolean;
  pureSpellsExport: boolean;
  showDragModeToggle: boolean;
  editorDragMode: 'cursor' | 'hand';
  useNoitaSwapLogic: boolean;
  dragModeTogglePos?: { x: number, y: number };
  spellTypes: SpellTypeConfig[];
  spellGroups: SpellGroupConfig[];
  warehouseFolderHeight: number;
  wikiLanguage: 'en' | 'zh';
  stopAtRecharge: boolean;
}

export interface EvalNode {
  name: string;
  count: number;
  extra: string;
  index: number[];
  shot_id?: number;
  children: EvalNode[];
}

export interface ShotState {
  id: number;
  cast: number;
  stats: Record<string, number | string>;
}

export interface EvalResponse {
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
  mode: 'strict' | 'contains';
}

export interface PickerConfig {
  wandSlot: string;
  spellIdx: string;
  x: number;
  y: number;
  isAlwaysCast?: boolean;
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
