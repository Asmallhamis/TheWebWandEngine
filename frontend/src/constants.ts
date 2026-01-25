import { WandData, SpellTypeConfig, SpellGroupConfig } from './types';

export const DEFAULT_WAND: WandData = {
  mana_max: 100000,
  mana_charge_speed: 100000,
  reload_time: 20,
  fire_rate_wait: 10,
  deck_capacity: 26,
  shuffle_deck_when_empty: false,
  spread_degrees: 0,
  speed_multiplier: 1.0,
  actions_per_round: 1,
  spells: {},
  spell_uses: {},
  always_cast: []
};

export const DEFAULT_SPELL_TYPES: SpellTypeConfig[] = [
  { id: 0, name: '投射物', color: '#4d2020' },
  { id: 1, name: '静态投射物', color: '#612c11' },
  { id: 2, name: '修正', color: '#2b3668' },
  { id: 3, name: '多重', color: '#18595e' },
  { id: 4, name: '材料', color: '#31633e' },
  { id: 5, name: '其他', color: '#6e4932' },
  { id: 6, name: '实用', color: '#692663' },
  { id: 7, name: '被动', color: '#202b24' },
];

export const DEFAULT_SPELL_GROUPS: SpellGroupConfig[] = [
  { name: '投射物', types: [0], color: 'from-blue-500/10 to-blue-600/20' },
  { name: '修正', types: [2], color: 'from-green-500/10 to-green-600/20' },
  { name: '实用+多重+其他', types: [6, 3, 5], color: 'from-purple-500/10 to-purple-600/20' },
  { name: '静态+材料+被动', types: [1, 4, 7], color: 'from-orange-500/10 to-orange-600/20' }
];

export const SPELL_GROUPS = DEFAULT_SPELL_GROUPS; // Keep for compatibility if needed elsewhere temporarily
