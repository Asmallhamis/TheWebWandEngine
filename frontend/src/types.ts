export interface SpellInfo {
  id: string;
  icon: string;
  name: string;
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
  always_cast: string[];
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
}

export interface EvalNode {
  name: string;
  count: number;
  extra: string;
  index: number[];
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
}
