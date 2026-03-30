import { WandData } from '../../types';

function utf8ToBase64(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  } catch {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

function getOrderedSpellSequence(wand: WandData): string[] {
  return Array.from({ length: wand.deck_capacity }, (_, i) => wand.spells[(i + 1).toString()] || '');
}

function getWikiSpriteName(wand: WandData): string {
  const sprite = wand.appearance?.sprite || '';
  const match = sprite.match(/files\/guns\/([^/.]+)\.(png|xml)$/i);
  return match ? match[1] : '';
}

export function serializeWandToWand2Text(wand: WandData): string {
  const sequence = getOrderedSpellSequence(wand);
  const wikiPic = getWikiSpriteName(wand);
  const lines = ['{{Wand2'];

  lines.push('| wandCard     = Yes');
  if (wikiPic) lines.push(`| wandPic      = ${wikiPic}`);
  if (wand.shuffle_deck_when_empty) lines.push('| shuffle      = Yes');
  if (wand.actions_per_round !== 1) lines.push(`| spellsCast   = ${wand.actions_per_round}`);
  lines.push(`| castDelay    = ${(wand.fire_rate_wait / 60).toFixed(2)}`);
  lines.push(`| rechargeTime = ${(wand.reload_time / 60).toFixed(2)}`);
  lines.push(`| manaMax      = ${(wand.mana_max || 0).toFixed(2)}`);
  lines.push(`| manaCharge   = ${(wand.mana_charge_speed || 0).toFixed(2)}`);
  lines.push(`| capacity     = ${wand.deck_capacity || 0}`);
  lines.push(`| spread       = ${wand.spread_degrees || 0}`);
  lines.push(`| speed        = ${((wand.speed_multiplier ?? 1)).toFixed(2)}`);
  if (wand.always_cast && wand.always_cast.length > 0) {
    lines.push(`| alwaysCasts  = ${wand.always_cast.join(',')}`);
  }
  lines.push(`| spells       = ${sequence.join(',')}`);
  lines.push('}}');

  return lines.join('\n');
}

export function buildWandShareUrl(wand: WandData, currentUrl = window.location.href): string {
  const wandText = serializeWandToWand2Text(wand);
  const encoded = utf8ToBase64(wandText);
  const url = new URL(currentUrl);
  url.searchParams.set('wand', encoded);
  url.searchParams.delete('data');
  return url.toString();
}
