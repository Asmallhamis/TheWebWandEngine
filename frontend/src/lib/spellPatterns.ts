/**
 * 法术模式检测与标记系统 (Spell Pattern Detection & Marking)
 *
 * 用于自动检测法术编辑区中的特定组合模式（如一分链）并提供可视化标记信息。
 * 未来支持用户自定义规则/方案。
 */

// --- Types ---

/** 单条匹配规则 */
export interface SpellMarkingRule {
  id: string;
  name: string;
  /** 匹配单个法术 ID 的正则表达式字符串 */
  pattern: string;
  /** 最少连续几个法术才算命中，默认 2 */
  minLength: number;
  /** 标记颜色 (CSS 色值) */
  color: string;
  /** 可选标签文字 */
  label?: string;
}

/** 方案 = 一组规则 */
export interface SpellMarkingScheme {
  id: string;
  name: string;
  rules: SpellMarkingRule[];
  isBuiltIn?: boolean;
}

/** 检测结果：一段连续命中的法术区间 */
export interface PatternMatch {
  ruleId: string;
  /** 1-based 起始索引 (对应 spells key) */
  startIdx: number;
  /** 1-based 结束索引 (inclusive) */
  endIdx: number;
  color: string;
  label?: string;
}

// --- Built-in Schemes ---

/** 内置示例方案: 一分链检测 */
export const BUILTIN_SCHEME: SpellMarkingScheme = {
  id: 'builtin_default',
  name: '示例方案',
  isBuiltIn: true,
  rules: [
    {
      id: 'divide_chain',
      name: '一分链检测',
      pattern: '^DIVIDE_\\d+$',
      minLength: 2,
      color: '#f59e0b', // amber-500
      label: '一分链',
    },
  ],
};

// --- Detection ---

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
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern);
    } catch {
      continue; // 无效正则，跳过
    }

    const minLen = rule.minLength || 2;
    let runStart = -1;
    let runLen = 0;

    const flush = () => {
      if (runLen >= minLen) {
        matches.push({
          ruleId: rule.id,
          startIdx: runStart,
          endIdx: runStart + runLen - 1,
          color: rule.color,
          label: rule.label,
        });
      }
      runStart = -1;
      runLen = 0;
    };

    for (let i = 1; i <= deckCapacity; i++) {
      const sid = spells[i.toString()];
      if (sid && regex.test(sid)) {
        if (runStart === -1) runStart = i;
        runLen++;
      } else {
        flush();
      }
    }
    flush();
  }

  return matches;
}

/**
 * 根据 1-based 槽位索引查找它所属的第一个 PatternMatch。
 * 用于双击自动选中整条链。
 */
export function findMatchAtIndex(
  matches: PatternMatch[],
  idx: number
): PatternMatch | null {
  for (const m of matches) {
    if (idx >= m.startIdx && idx <= m.endIdx) return m;
  }
  return null;
}
