/**
 * 法术模式检测与标记系统 (Spell Pattern Detection & Marking)
 *
 * 用于自动检测法术编辑区中的特定组合模式（如一分链）并提供可视化标记信息。
 * 支持用户自定义序列规则与通配匹配。
 */

import { PatternSlot, SpellMarkingRule } from '../types';

/** 检测结果：命中区间 + 具体命中槽位索引 */
export interface PatternMatch {
  ruleId: string;
  /** 1-based 起始索引 (对应 spells key) */
  startIdx: number;
  /** 1-based 结束索引 (inclusive) */
  endIdx: number;
  /** 实际命中的槽位索引 */
  indices: number[];
  color: string;
  label?: string;
}

/** 内置规则 */
export const BUILTIN_RULES: SpellMarkingRule[] = [
  {
    id: 'divide_chain',
    name: '一分链检测',
    pattern: [{ alternatives: ['DIVIDE_*'] }],
    matchMode: 'repeat',
    minRepeat: 2,
    ignoreEmpty: false,
    color: '#f59e0b', // amber-500
    label: '一分链',
    enabled: true,
    isBuiltIn: true,
  }
];

export const normalizeSpellId = (sid: string) => (sid || '').trim().toUpperCase();

export function matchSlot(slot: PatternSlot, spellId: string): boolean {
  const sid = normalizeSpellId(spellId);
  if (!sid) return false;
  for (const alt of slot.alternatives) {
    const a = normalizeSpellId(alt);
    if (!a) continue;
    if (a.endsWith('*')) {
      const prefix = a.slice(0, -1);
      if (sid.startsWith(prefix)) return true;
    } else if (sid === a) {
      return true;
    }
  }
  return false;
}

export function serializePattern(pattern: PatternSlot[]): string {
  return pattern
    .map(slot => slot.alternatives.join(' | '))
    .join(' + ');
}

export function parsePatternText(text: string): { pattern: PatternSlot[]; error?: string } {
  const trimmed = (text || '').trim();
  if (!trimmed) return { pattern: [], error: 'empty' };
  const slotTexts = trimmed.split('+').map(s => s.trim()).filter(Boolean);
  if (!slotTexts.length) return { pattern: [], error: 'empty' };
  const pattern: PatternSlot[] = [];
  for (const slotText of slotTexts) {
    const alternatives = slotText.split('|').map(s => s.trim()).filter(Boolean);
    if (!alternatives.length) return { pattern: [], error: 'invalid' };
    pattern.push({ alternatives });
  }
  return { pattern };
}

export function getMergedRules(userRules?: SpellMarkingRule[]): SpellMarkingRule[] {
  const user = Array.isArray(userRules) ? userRules : [];
  const merged = BUILTIN_RULES.map(r => ({ ...r }));
  for (const u of user) {
    const idx = merged.findIndex(r => r.id === u.id);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...u, isBuiltIn: true };
    } else {
      merged.push({ ...u, isBuiltIn: !!u.isBuiltIn });
    }
  }
  return merged;
}

type SeqItem = { idx: number; sid: string };

const buildSequence = (
  spells: Record<string, string>,
  deckCapacity: number,
  ignoreEmpty: boolean
): SeqItem[] => {
  const seq: SeqItem[] = [];
  for (let i = 1; i <= deckCapacity; i++) {
    const sid = spells[i.toString()] || '';
    if (ignoreEmpty) {
      if (sid) seq.push({ idx: i, sid });
    } else {
      seq.push({ idx: i, sid });
    }
  }
  return seq;
};

const overlaps = (a: PatternMatch, b: PatternMatch) =>
  !(a.endIdx < b.startIdx || a.startIdx > b.endIdx);

/**
 * 对法术序列执行模式检测，返回所有命中区间。
 *
 * @param spells - WandData.spells (Record<string, string>), key 为 "1", "2", ...
 * @param deckCapacity - 法杖容量，用于确定遍历范围
 * @param rules - 本次使用的规则列表
 * @returns PatternMatch 数组（不重叠，先命中先占位）
 */
export function detectPatterns(
  spells: Record<string, string>,
  deckCapacity: number,
  rules: SpellMarkingRule[]
): PatternMatch[] {
  if (!rules.length || !spells) return [];

  const matches: PatternMatch[] = [];

  for (const rule of rules) {
    const pattern = rule.pattern || [];
    if (!pattern.length) continue;
    const minRepeat = Math.max(2, rule.minRepeat || 2);
    const seq = buildSequence(spells, deckCapacity, !!rule.ignoreEmpty);
    if (!seq.length) continue;

    const addMatch = (startPos: number, endPos: number) => {
      const indices = seq.slice(startPos, endPos + 1).map(s => s.idx);
      const match: PatternMatch = {
        ruleId: rule.id,
        startIdx: indices[0],
        endIdx: indices[indices.length - 1],
        indices,
        color: rule.color,
        label: rule.label,
      };
      if (!matches.some(m => overlaps(m, match))) {
        matches.push(match);
      }
    };

    const patternLen = pattern.length;

    if (rule.matchMode === 'exact') {
      if (seq.length !== patternLen) continue;
      let ok = true;
      for (let i = 0; i < patternLen; i++) {
        if (!matchSlot(pattern[i], seq[i].sid)) { ok = false; break; }
      }
      if (ok) addMatch(0, patternLen - 1);
      continue;
    }

    if (rule.matchMode === 'repeat') {
      let i = 0;
      while (i + patternLen <= seq.length) {
        let repeatCount = 0;
        while (i + (repeatCount + 1) * patternLen <= seq.length) {
          let ok = true;
          for (let j = 0; j < patternLen; j++) {
            if (!matchSlot(pattern[j], seq[i + repeatCount * patternLen + j].sid)) { ok = false; break; }
          }
          if (!ok) break;
          repeatCount++;
        }
        if (repeatCount >= minRepeat) {
          const endPos = i + repeatCount * patternLen - 1;
          addMatch(i, endPos);
          i = endPos + 1;
        } else {
          i += 1;
        }
      }
      continue;
    }

    // contains: 滑窗匹配
    for (let i = 0; i + patternLen <= seq.length; i++) {
      let ok = true;
      for (let j = 0; j < patternLen; j++) {
        if (!matchSlot(pattern[j], seq[i + j].sid)) { ok = false; break; }
      }
      if (ok) addMatch(i, i + patternLen - 1);
    }
  }

  return matches;
}

export function findMatchAtIndex(matches: PatternMatch[], idx: number): PatternMatch | null {
  for (const m of matches) {
    if (m.indices.includes(idx)) return m;
  }
  return null;
}
