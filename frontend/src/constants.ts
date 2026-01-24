import { WandData } from './types';

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

export const SPELL_GROUPS = [
  { name: '投射物', types: [0], color: 'from-blue-500/10 to-blue-600/20' },
  { name: '修正', types: [2], color: 'from-green-500/10 to-green-600/20' },
  { name: '实用+多重+其他', types: [6, 3, 5], color: 'from-purple-500/10 to-purple-600/20' },
  { name: '静态+材料+被动', types: [1, 4, 7], color: 'from-orange-500/10 to-orange-600/20' }
];
