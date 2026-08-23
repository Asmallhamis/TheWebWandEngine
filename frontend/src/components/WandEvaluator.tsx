import React, { useState, useMemo, useEffect } from 'react';
import {
  EvalNode,
  ShotState,
  SpellInfo,
  AppSettings,
  EvalResponse,
  EvalTimeline,
  EvalTimelineProcessItem,
  TimelineJumpRequest,
} from '../types';
import { ChevronRight, ChevronDown, Pause, Play, Search, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { useTranslation } from 'react-i18next';
import { EvalTimelinePage, loadTimelinePage } from '../lib/timeline';
import { TiltContainer } from './TiltContainer';

interface Props {
  data: {
    tree: EvalNode;
    states: ShotState[];
    counts: Record<string, number>;
    cast_counts: Record<string, Record<string, number>>;
  } & Pick<EvalResponse, 'timeline' | 'timeline_disabled'>;
  spellDb: Record<string, SpellInfo>;
  onHoverSlots?: (indices: number[] | null) => void;
  onHoverShotId?: (id: number | null) => void;
  markedSlots?: number[];
  wandSpells?: Record<string, string>;
  deckCapacity?: number;
  renderMode?: 'all' | 'stats' | 'tree';
  isCanvas?: boolean;
  externalTimelineJumpRequest?: TimelineJumpRequest | null;
  settings: AppSettings;
  onCalculateTimeline?: () => void;
}

interface ShotNode {
  state: ShotState;
  children: ShotNode[];
}

const buildShotTree = (evalNode: EvalNode, states: ShotState[]): ShotNode[] => {
  const shotMap = new Map<number, ShotNode>();
  states.forEach(s => shotMap.set(s.id, { state: s, children: [] }));

  const roots: ShotNode[] = [];
  const seenIds = new Set<number>();

  const traverse = (node: EvalNode, parentId: number | null) => {
    let currentId = parentId;
    if (node.shot_id) {
      if (parentId !== null && parentId !== node.shot_id) {
        const p = shotMap.get(parentId);
        const c = shotMap.get(node.shot_id);
        if (p && c && !p.children.includes(c)) {
          p.children.push(c);
        }
      } else if (parentId === null) {
        const root = shotMap.get(node.shot_id);
        if (root && !roots.includes(root)) roots.push(root);
      }
      currentId = node.shot_id;
      seenIds.add(node.shot_id);
    }
    node.children?.forEach(child => traverse(child, currentId));
  };

  traverse(evalNode, null);

  states.forEach(s => {
    if (!seenIds.has(s.id)) {
      const orphan = shotMap.get(s.id);
      if (orphan && !roots.includes(orphan)) roots.push(orphan);
    }
  });

  return roots;
};

const countNodes = (node: EvalNode): number => {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    node.children.forEach(child => count += countNodes(child));
  }
  return count;
};

// 深度对比两个节点是否完全一致
const areNodesEqual = (a: EvalNode, b: EvalNode): boolean => {
  // 处理施法根节点的特殊命名 (Cast #1, Cast #2...)
  const nameA = a.name.startsWith('Cast #') ? 'Cast' : a.name;
  const nameB = b.name.startsWith('Cast #') ? 'Cast' : b.name;

  if (nameA !== nameB || a.count !== b.count || a.extra !== b.extra) return false;
  if ((a.children?.length || 0) !== (b.children?.length || 0)) return false;
  if (a.children) {
    for (let i = 0; i < a.children.length; i++) {
      if (!areNodesEqual(a.children[i], b.children[i])) return false;
    }
  }
  return true;
};

// 对比射击状态是否一致（忽略 cast 和 id）
const areStatesEqual = (a: Record<string, any>[], b: Record<string, any>[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const keysA = Object.keys(a[i].stats);
    const keysB = Object.keys(b[i].stats);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (a[i].stats[key] !== b[i].stats[key]) return false;
    }
  }
  return true;
};

// 递归渲染射击树
const ShotTree: React.FC<{
  nodes: ShotNode[],
  hoveredShotId: { cast: number, id: number } | null,
  currentCast: number,
  spellDb: Record<string, SpellInfo>,
  isRoot?: boolean,
  settings: AppSettings
}> = ({ nodes, hoveredShotId, currentCast, spellDb, isRoot, settings }) => {
  return (
    <div className="flex flex-col gap-5">
      {nodes.map((node) => (
        <div key={node.state.id} className="flex items-start shrink-0">
          <div className="relative flex items-start">
            {/* 左侧连接线 + 卡片头部对齐容器 */}
            <div className="flex items-center h-[56px] shrink-0">
              {!isRoot && (
                <div className="w-10 h-[2px] eval-tree-line shrink-0"></div>
              )}
            </div>

            <ShotStateCard
              state={node.state}
              spellDb={spellDb}
              isHighlighted={hoveredShotId?.cast === currentCast && hoveredShotId?.id === node.state.id}
              settings={settings}
            />

            {/* 子节点渲染 */}
            {node.children.length > 0 && (
              <div className="flex flex-col gap-5 relative">
                <div className="flex flex-col gap-5 ml-0 shrink-0">
                  <ShotTree
                    nodes={node.children}
                    hoveredShotId={hoveredShotId}
                    currentCast={currentCast}
                    spellDb={spellDb}
                    isRoot={false}
                    settings={settings}
                  />
                </div>
                {/* 垂直分支线 */}
                {node.children.length > 1 && (
                  <div className="absolute left-0 top-[28px] bottom-[28px] w-[2px] eval-tree-line"></div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const WandEvaluator: React.FC<Props> = ({ data, spellDb, onHoverSlots, settings, markedSlots = [], wandSpells, deckCapacity, renderMode = 'all', isCanvas = false, externalTimelineJumpRequest, onCalculateTimeline }) => {
  const { t, i18n } = useTranslation();
  const [userExpandedCasts, setUserExpandedCasts] = useState<Record<number, boolean>>({});
  const [userShowAllCasts, setUserShowAllCasts] = useState<Record<number, boolean>>({}); // 控制是否展开合并的每一轮
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [hoveredShotId, setHoveredShotId] = useState<{ cast: number, id: number } | null>(null);
  const [timelineJumpRequest, setTimelineJumpRequest] = useState<TimelineJumpRequest | null>(null);

  const jumpTimelineToNode = (node: EvalNode) => {
    const timelineId = getFirstTimelineId(node);
    if (timelineId === undefined) return;
    setTimelineJumpRequest({ timelineId, nonce: Date.now() });
  };

  const absoluteToOrdinal = useMemo(() => {
    if (!wandSpells || deckCapacity === undefined) return null;
    const map: Record<number, number> = {};
    let ordinal = 1;
    for (let i = 1; i <= deckCapacity; i++) {
      if (wandSpells[i.toString()]) {
        map[i] = ordinal++;
      }
    }
    return map;
  }, [wandSpells, deckCapacity]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', () => setIsAltPressed(false));
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 检查是否应该默认折叠
  const shouldDefaultFold = useMemo(() => {
    if (!data?.tree?.children || data.tree.children.length <= 1) return false;
    // 如果第一个 Cast 的复杂度超过阈值，则后续默认折叠
    const firstCastComplexity = countNodes(data.tree.children[0]);
    return firstCastComplexity > (settings.autoHideThreshold || 20);
  }, [data?.tree, settings.autoHideThreshold]);

  // 当评估数据改变时，重置用户手动展开状态
  useEffect(() => {
    setUserExpandedCasts({});
    setUserShowAllCasts({});
  }, [data]);

  if (!data || !data.tree) return null;

  // 将总计数数据转为数组并排序
  const sortedOverallCounts = Object.entries(data.counts || {})
    .sort(([, a], [, b]) => b - a);

  // 计算分组逻辑
  const castGroups = useMemo(() => {
    const children = data.tree.children;
    if (!children || children.length === 0) return [];

    const groups: {
      start: number;
      end: number;
      node: EvalNode;
      states: ShotState[];
      counts: Record<string, number>;
    }[] = [];

    if (!settings.groupIdenticalCasts) {
      // 如果禁用了合并，每一轮都是独立一组
      children.forEach((node, i) => {
        const castNum = i + 1;
        groups.push({
          start: castNum,
          end: castNum,
          node,
          states: data.states.filter(s => s.cast === castNum),
          counts: data.cast_counts?.[castNum.toString()] || {}
        });
      });
      return groups;
    }

    // 合并逻辑
    for (let i = 0; i < children.length; i++) {
      const castNum = i + 1;
      const currentNode = children[i];
      const currentStates = data.states.filter(s => s.cast === castNum);
      const currentCounts = data.cast_counts?.[castNum.toString()] || {};

      if (groups.length > 0) {
        const lastGroup = groups[groups.length - 1];
        // 检查当前轮是否与上一组完全一致
        const isNodeMatch = areNodesEqual(lastGroup.node, currentNode);
        // Note: comparison should be against RAW states, but for grouping it usually works either way
        // since if raw states are equal, computed deltas will also be equal.
        const isStateMatch = areStatesEqual(data.states.filter(s => s.cast === lastGroup.start), currentStates);
        const isCountMatch = JSON.stringify(lastGroup.counts) === JSON.stringify(currentCounts);

        if (isNodeMatch && isStateMatch && isCountMatch) {
          lastGroup.end = castNum;
          continue;
        }
      }

      groups.push({
        start: castNum,
        end: castNum,
        node: currentNode,
        states: currentStates,
        counts: currentCounts
      });
    }
    return groups;
  }, [data, settings.groupIdenticalCasts]);

  const evaluatorSectionOrder = normalizeEvaluatorSectionOrder(settings.evaluatorSectionOrder);
  const evaluatorSectionOrderMap = evaluatorSectionOrder.reduce<Record<EvaluatorSectionId, number>>((acc, id, index) => {
    acc[id] = index;
    return acc;
  }, { timeline: 0, shot_states: 1, tree: 2 });
  const canRenderTimeline = (settings.showCastTimeline ?? true)
    && (renderMode === 'all' || renderMode === 'stats')
    && !!data.timeline
    && data.timeline.events.length > 0;
  const canCalculateTimeline = (settings.showCastTimeline ?? true)
    && (renderMode === 'all' || renderMode === 'stats')
    && data.timeline_disabled === true
    && !!onCalculateTimeline;
  const timelineNodeClick = canRenderTimeline ? jumpTimelineToNode : undefined;

  return (
    <div className={isCanvas
      ? `relative flex flex-col gap-6 eval-orionfire-region ${canCalculateTimeline ? 'pt-8' : ''}`
      : "relative mt-6 p-4 bg-black/40 border border-white/10 rounded-lg flex flex-col gap-12 animate-in fade-in slide-in-from-top-4 duration-500 eval-orionfire-region"}>
      {/* Overall Spell Counts Section */}
      {(renderMode === 'all' || renderMode === 'stats') && sortedOverallCounts.length > 0 && (
        <section data-testid="eval-overall-counts" style={{ order: -1 }}>
          {!isCanvas && (
            <h3 className="sticky top-0 z-40 py-2 bg-zinc-950/80 backdrop-blur-sm text-[10px] font-black text-zinc-500 mb-4 flex items-center gap-2 tracking-widest uppercase">
              <span className="w-1.5 h-1.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] rounded-full"></span>
              {t('evaluator.overall_counts')}
            </h3>
          )}
          <div className="flex flex-wrap gap-2 opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-300">
            {sortedOverallCounts.map(([id, count]) => {
              const spell = spellDb[id];
              const displayName = spell ? (i18n.language.startsWith('en') && spell.en_name ? spell.en_name : spell.name) : id;
              return (
                <div key={id} data-testid={`eval-overall-count-item-${id}`} className="flex items-center gap-2 bg-zinc-900/40 border border-white/5 pl-1 pr-3 py-0 rounded-md transition-all group/count min-h-[28px]">
                  {spell ? (
                    <img src={getIconUrl(spell.icon, false)} alt={id} className="spell-icon-surface w-5 h-5 image-pixelated" />
                  ) : (
                    <div className="w-5 h-5 bg-zinc-800 rounded flex items-center justify-center text-[8px] text-zinc-500 font-mono">?</div>
                  )}
                  <div className="flex flex-col justify-center leading-none py-0">
                    <span className="text-[8px] leading-none font-bold text-zinc-500 uppercase tracking-tighter truncate max-w-[60px]" title={id}>
                      {displayName}
                    </span>
                    <span className="text-[9px] leading-none font-black text-amber-500/80 font-mono mt-0.5">
                      {count.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {canRenderTimeline && data.timeline && (
        <div style={{ order: evaluatorSectionOrderMap.timeline }}>
          <WandTimelinePlayer timeline={data.timeline} spellDb={spellDb} absoluteToOrdinal={absoluteToOrdinal} settings={settings} jumpRequest={externalTimelineJumpRequest || timelineJumpRequest} />
        </div>
      )}

      {canCalculateTimeline && (
        <button
          type="button"
          onClick={onCalculateTimeline}
          title={t('evaluator.timeline_manual_desc')}
          className={`wand-timeline-manual absolute z-50 flex h-7 items-center gap-1.5 rounded border border-cyan-400/30 bg-zinc-950/90 px-2 text-[9px] font-black uppercase tracking-wider text-cyan-200 shadow-lg backdrop-blur-sm transition-colors hover:bg-cyan-500/15 ${isCanvas ? 'right-0 top-0' : 'right-4 top-4'}`}
        >
          <Play size={11} />
          {t('evaluator.timeline_calculate')}
        </button>
      )}

      {/* Shot States Section */}
      {(renderMode === 'all' || renderMode === 'stats') && (
        <section style={{ order: evaluatorSectionOrderMap.shot_states }}>
          {!isCanvas && (
            <div className="sticky top-0 z-40 py-2 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-zinc-500 flex items-center gap-2 tracking-widest uppercase">
                <span className="w-1.5 h-1.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] rounded-full"></span>
                {t('evaluator.shot_states')}
              </h3>
            </div>
          )}

          <div className="space-y-6">
          {castGroups.map(group => {
            const isRange = group.start !== group.end;
            const isVisible = isCanvas ? true : (userExpandedCasts[group.start] ?? true); // 状态详情默认可见
            const isShowingAll = userShowAllCasts[group.start] ?? false;

            return (
              <div key={group.start} className="space-y-4">
                <div
                  className={`flex items-center gap-2 ${isCanvas ? '' : 'cursor-pointer'} group/h`}
                  onClick={() => !isCanvas && setUserExpandedCasts(prev => ({ ...prev, [group.start]: !isVisible }))}
                >
                  <div className={`flex items-center gap-2 px-2 py-0.5 rounded border uppercase tracking-tighter transition-colors ${isRange ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                    <span className="text-[9px] font-black">
                      {isRange ? `Cast #${group.start} - #${group.end}` : `Cast #${group.start}`}
                    </span>
                    {isRange && (
                      <span className="text-[7px] font-bold bg-amber-500/20 px-1 rounded">{t('evaluator.repeat_merged')}</span>
                    )}
                  </div>

                  {isRange && isVisible && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserShowAllCasts(prev => ({ ...prev, [group.start]: !isShowingAll }));
                      }}
                      className="text-[8px] font-black text-zinc-500 hover:text-white bg-white/5 px-2 py-0.5 rounded border border-white/5 transition-all uppercase"
                    >
                      {isShowingAll ? t('evaluator.collapse_preview') : t('evaluator.expand_all_details', { count: group.end - group.start + 1 })}
                    </button>
                  )}

                  <div className="h-px flex-1 bg-white/5"></div>
                  {!isCanvas && (
                    <div className="text-zinc-600 group-hover/h:text-zinc-400 transition-colors">
                      {isVisible ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </div>
                  )}
                </div>

                {isVisible && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
                    {(!isRange || !isShowingAll) ? (
                      // 预览模式或单轮：展示射击树
                      <div className="flex items-start gap-8">
                        <CastStatsPanel group={group} spellDb={spellDb} settings={settings} />
                        <div className="flex-1 overflow-x-auto p-12 custom-scrollbar-mini">
                          <ShotTree
                            nodes={buildShotTree(group.node, group.states)}
                            hoveredShotId={hoveredShotId}
                            currentCast={group.start}
                            spellDb={spellDb}
                            isRoot={true}
                            settings={settings}
                          />
                        </div>
                      </div>
                    ) : (
                      // 展开模式：显示范围内每一轮的射击树
                      Array.from({ length: group.end - group.start + 1 }).map((_, i) => {
                        const cNum = group.start + i;
                        const cNode = data.tree.children?.[cNum - 1];
                        const cStates = data.states.filter(s => s.cast === cNum);
                        const cCounts = data.cast_counts?.[cNum.toString()] || {};

                        if (!cNode) return null;

                        return (
                          <div key={cNum} className="flex items-start gap-8 opacity-90 hover:opacity-100 transition-opacity">
                            <div className="shrink-0 w-12 pt-4">
                              <span className="text-[8px] font-black text-zinc-600 uppercase"># {cNum}</span>
                            </div>
                            <CastStatsPanel group={{ counts: cCounts, states: cStates, node: cNode } as any} spellDb={spellDb} settings={settings} />
                            <div className="flex-1 overflow-x-auto p-12 custom-scrollbar-mini">
                              <ShotTree
                                nodes={buildShotTree(cNode, cStates)}
                                hoveredShotId={hoveredShotId}
                                currentCast={cNum}
                                spellDb={spellDb}
                                isRoot={true}
                                settings={settings}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </section>
      )}

      {/* Tree Flowchart Section */}
      {(renderMode === 'all' || renderMode === 'tree') && (
        <section className="wand-eval-tree" style={{ order: evaluatorSectionOrderMap.tree }}>
          {!isCanvas && (
            <h3 className="wand-eval-tree-heading sticky top-0 z-40 py-2 bg-zinc-950/80 backdrop-blur-sm text-[10px] font-black text-zinc-500 mb-4 flex items-center gap-2 tracking-widest uppercase">
              <span className="w-1.5 h-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] rounded-full"></span>
              {t('evaluator.execution_flow')}
            </h3>
          )}
          <div className="space-y-4">
            {castGroups.map((group) => {
              const complexity = countNodes(group.node);
              const isRange = group.start !== group.end;
              // 递归树默认根据复杂度折叠，但在合并模式下，首项默认展开以供预览
              const isAutoFolded = shouldDefaultFold && group.start > 1;
              const isVisible = isCanvas ? true : (userExpandedCasts[group.start] ?? !isAutoFolded);
              const isShowingAll = userShowAllCasts[group.start] ?? false;

              return (
                <div key={group.start} className="wand-eval-tree-group bg-zinc-950/30 rounded-lg border border-white/5 overflow-hidden">
                  <div
                    className={`wand-eval-tree-header px-4 py-2 bg-white/5 flex items-center justify-between transition-colors group/treeh ${isCanvas ? '' : 'cursor-pointer hover:bg-white/10'}`}
                    onClick={() => !isCanvas && setUserExpandedCasts(prev => ({ ...prev, [group.start]: !isVisible }))}
                  >
                    <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase ${isRange ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {isRange ? `Cast #${group.start} - #${group.end}` : `Cast #${group.start}`}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-mono">{t('evaluator.nodes_count')}: {complexity}</span>

                    {isRange && isVisible && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserShowAllCasts(prev => ({ ...prev, [group.start]: !isShowingAll }));
                        }}
                        className="text-[8px] font-black text-zinc-500 hover:text-white bg-white/5 px-2 py-0.5 rounded border border-white/5 transition-all uppercase"
                      >
                        {isShowingAll ? t('evaluator.collapse_preview') : t('evaluator.expand_all_trees', { count: group.end - group.start + 1 })}
                      </button>
                    )}

                    {isAutoFolded && !isVisible && (
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">{t('evaluator.auto_folded')}</span>
                    )}
                  </div>
                  <div className="text-zinc-500 group-hover/treeh:text-zinc-300">
                    {isVisible ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </div>

                {isVisible && (
                  <div className="wand-eval-tree-body p-6 space-y-12 animate-in fade-in slide-in-from-top-1 duration-200">
                    {(!isRange || !isShowingAll) ? (
                      // 预览模式或单轮：显示树
                      <div>
                        <div className="flex-1 overflow-x-auto px-8 pt-4 pb-8 custom-scrollbar">
                          <div className="w-fit">
                            <TreeNode
                              node={group.node}
                              spellDb={spellDb}
                              isRoot={true}
                              onHover={onHoverSlots}
                              onHoverShotId={(sid) => setHoveredShotId(sid ? { cast: group.start, id: sid } : null)}
                              onTimelineNodeClick={timelineNodeClick}
                              markedSlots={markedSlots}
                              showIndices={isAltPressed || settings.showIndices}
                              absoluteToOrdinal={absoluteToOrdinal}
                              settings={settings}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 展开模式：显示范围内每一轮的树
                      Array.from({ length: group.end - group.start + 1 }).map((_, i) => {
                        const cNum = group.start + i;
                        const cNode = data.tree.children?.[cNum - 1];
                        const cCounts = data.cast_counts?.[cNum.toString()] || {};

                        if (!cNode) return null;

                        return (
                          <div key={cNum} className="opacity-90 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[8px] font-black text-zinc-600 uppercase"># {cNum}</span>
                            </div>
                            <div className="flex-1 overflow-x-auto px-8 pt-4 pb-8 custom-scrollbar">
                              <div className="w-fit">
                                <TreeNode
                                  node={cNode}
                                  spellDb={spellDb}
                                  isRoot={true}
                                  onHover={onHoverSlots}
                                  onHoverShotId={(sid) => setHoveredShotId(sid ? { cast: cNum, id: sid } : null)}
                                  onTimelineNodeClick={timelineNodeClick}
                                  markedSlots={markedSlots}
                                  showIndices={isAltPressed || settings.showIndices}
                                  absoluteToOrdinal={absoluteToOrdinal}
                                  settings={settings}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      )}
    </div>
  );
};

type TimelinePileName = 'discarded' | 'hand' | 'deck';
type TimelinePileSet = Record<TimelinePileName, number[]>;
type TimelineProcessItem = EvalTimelineProcessItem;
type TimelineCardPosition = { x: number; y: number; visible: boolean };
type TimelineFrame = {
  event: EvalTimeline['events'][number];
  rawIndex: number;
  process: TimelineProcessItem[];
  key: string;
};

type EvaluatorSectionId = 'timeline' | 'shot_states' | 'tree';
const EVALUATOR_SECTION_IDS: EvaluatorSectionId[] = ['timeline', 'shot_states', 'tree'];
const TIMELINE_PILE_LABELS: TimelinePileName[] = ['discarded', 'hand', 'deck'];
const MAX_STAGE_CARDS_PER_PILE = 96;
const TIMELINE_SPEED_STORAGE_KEY = 'twwe.timeline.speed';
const TIMELINE_SPEED_EVENT = 'twwe:timeline-speed';
const MIN_TIMELINE_SPEED = 0.1;
const MAX_TIMELINE_SPEED = 8;

const makePileKey = (piles: TimelinePileSet) =>
  TIMELINE_PILE_LABELS.map(name => `${name}:${(piles[name] || []).join('.')}`).join('|');

const isDivideAction = (id?: string) => /^DIVIDE_\d+$/.test(id || '');

const formatProgressText = (step: number, total?: number) =>
  total === undefined ? String(step) : `${step}/${total}`;

const getFirstTimelineId = (node: EvalNode) => {
  if (typeof node.timeline_id === 'number') return node.timeline_id;
  return node.timeline_ids?.find(id => typeof id === 'number');
};

const normalizeEvaluatorSectionOrder = (order?: AppSettings['evaluatorSectionOrder']) => {
  const seen = new Set<string>();
  const normalized = (order || []).filter((id): id is EvaluatorSectionId => {
    if (!EVALUATOR_SECTION_IDS.includes(id as EvaluatorSectionId) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  EVALUATOR_SECTION_IDS.forEach(id => {
    if (!seen.has(id)) normalized.push(id);
  });
  return normalized;
};

const clampTimelineSpeed = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.round(Math.max(MIN_TIMELINE_SPEED, Math.min(MAX_TIMELINE_SPEED, value)) * 100) / 100;
};

const formatTimelineSpeed = (value: number) =>
  clampTimelineSpeed(value).toFixed(2).replace(/\.?0+$/, '');

const readTimelineSpeed = () => {
  if (typeof window === 'undefined') return 1;
  return clampTimelineSpeed(Number(window.localStorage.getItem(TIMELINE_SPEED_STORAGE_KEY) || 1));
};

const useGlobalTimelineSpeed = () => {
  const [speed, setSpeedState] = useState(readTimelineSpeed);

  useEffect(() => {
    const handleSpeedChange = (event: Event) => {
      const next = (event as CustomEvent<number>).detail;
      setSpeedState(clampTimelineSpeed(next));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TIMELINE_SPEED_STORAGE_KEY) {
        setSpeedState(clampTimelineSpeed(Number(event.newValue || 1)));
      }
    };

    window.addEventListener(TIMELINE_SPEED_EVENT, handleSpeedChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(TIMELINE_SPEED_EVENT, handleSpeedChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setSpeed = (value: number) => {
    const next = clampTimelineSpeed(value);
    setSpeedState(next);
    window.localStorage.setItem(TIMELINE_SPEED_STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent(TIMELINE_SPEED_EVENT, { detail: next }));
  };

  return [speed, setSpeed] as const;
};

const makeFrameKey = (event: EvalTimeline['events'][number], process: TimelineProcessItem[]) =>
  `${makePileKey(event.piles)}|process:${process.map(item => `${item.uid ?? item.id}:${item.drawStep ?? ''}/${item.drawTotal ?? ''}:${item.copyStep ?? ''}`).join('>')}`;

const buildTimelineFrames = (
  events: EvalTimeline['events'],
  initialProcess: TimelineProcessItem[] = [],
): TimelineFrame[] => {
  const frames: TimelineFrame[] = [];
  const process: TimelineProcessItem[] = initialProcess.map(item => ({ ...item }));
  let lastKey = '';

  const pushFrame = (event: EvalTimeline['events'][number], rawIndex: number) => {
    const key = makeFrameKey(event, process);
    const shouldKeep = frames.length === 0 || rawIndex === events.length - 1 || key !== lastKey || event.type === 'cast_end';
    if (!shouldKeep) return;
    frames.push({ event, rawIndex, process: process.map(item => ({ ...item })), key });
    lastKey = key;
  };

  events.forEach((event, rawIndex) => {
    if (event.type === 'draw_many_start' && typeof event.info?.how_many === 'number') {
      const topIndex = process.length - 1;
      if (topIndex >= 0) {
        process[topIndex] = {
          ...process[topIndex],
          drawStep: 0,
          drawTotal: event.info.how_many,
        };
      }
      pushFrame(event, rawIndex);
      return;
    }

    if (event.type === 'action_start' && typeof event.info?.id === 'string') {
      const drawStep = typeof event.info.draw_step === 'number' ? event.info.draw_step : undefined;
      const drawTotal = typeof event.info.draw_total === 'number' ? event.info.draw_total : undefined;
      const topIndex = process.length - 1;
      if (topIndex >= 0 && isDivideAction(process[topIndex].id)) {
        process[topIndex] = {
          ...process[topIndex],
          copyStep: (process[topIndex].copyStep ?? 0) + 1,
        };
      }
      if (drawTotal !== undefined && topIndex >= 0) {
        process[topIndex] = {
          ...process[topIndex],
          drawStep: drawStep ?? 0,
          drawTotal,
        };
      }
      process.push({
        id: event.info.id,
        uid: typeof event.info.uid === 'number' ? event.info.uid : undefined,
        slot: typeof event.info.slot === 'number' ? event.info.slot : undefined,
        drawStep: topIndex < 0 ? drawStep : undefined,
        drawTotal: topIndex < 0 ? drawTotal : undefined,
      });
      pushFrame(event, rawIndex);
      return;
    }

    if (event.type === 'action_end' && typeof event.info?.id === 'string') {
      const uid = typeof event.info.uid === 'number' ? event.info.uid : undefined;
      let idx = -1;
      for (let i = process.length - 1; i >= 0; i -= 1) {
        if ((uid !== undefined && process[i].uid === uid) || (uid === undefined && process[i].id === event.info.id)) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) process.splice(idx, 1);
      pushFrame(event, rawIndex);
      return;
    }

    pushFrame(event, rawIndex);
  });

  return frames;
};

const WandTimelinePlayer: React.FC<{
  timeline: EvalTimeline;
  spellDb: Record<string, SpellInfo>;
  absoluteToOrdinal: Record<number, number> | null;
  settings: AppSettings;
  jumpRequest?: TimelineJumpRequest | null;
}> = ({ timeline, spellDb, absoluteToOrdinal, settings, jumpRequest }) => {
  const { t, i18n } = useTranslation();
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const lastFrameRef = React.useRef<TimelineFrame | null>(null);
  const [timelinePage, setTimelinePage] = useState<EvalTimelinePage>(() => ({
    pageIndex: 0,
    events: timeline.events || [],
    initialProcess: [],
  }));
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [stageWidth, setStageWidth] = useState(900);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useGlobalTimelineSpeed();
  const [speedText, setSpeedText] = useState(() => formatTimelineSpeed(speed));
  const [query, setQuery] = useState('');
  const [fromFrame, setFromFrame] = useState<TimelineFrame | null>(null);
  const [motion, setMotion] = useState(1);
  const [hoverFrameIndex, setHoverFrameIndex] = useState<number | null>(null);

  const actionLayout = settings.timelineActionLayout === 'wrap' ? 'wrap' : 'scroll';
  const timelineIconSize = Math.max(24, Math.min(44, Number(settings.timelineIconSize) || 36));
  const timelineImageSize = Math.max(16, timelineIconSize - 4);
  const timelineStep = timelineIconSize + 7;
  const processCardMinWidth = Math.max(44, timelineIconSize + 8);
  const processCardRenderHeight = timelineIconSize + Math.max(22, Math.round(timelineIconSize * 0.55)) + 4;
  const processHeight = actionLayout === 'wrap'
    ? Math.max(142, processCardRenderHeight * 2 + 44)
    : Math.max(96, processCardRenderHeight + 40);
  const pileRows = actionLayout === 'wrap' ? 6 : 4;
  const pileTop = processHeight + 30;
  const pileHeight = 22 + pileRows * timelineStep;
  const stageHeight = pileTop + pileHeight + 8;
  const processViewportClass = actionLayout === 'wrap'
    ? 'absolute left-3 right-3 top-6 bottom-2 overflow-y-auto overflow-x-hidden custom-scrollbar'
    : 'absolute left-3 right-3 top-6 bottom-1 overflow-x-auto overflow-y-hidden custom-scrollbar';
  const processListClass = actionLayout === 'wrap'
    ? 'flex flex-wrap items-start gap-2.5 pr-1 pb-1'
    : 'flex w-max items-start gap-2.5 pb-2';

  const storageChunks = useMemo(() => timeline.storage?.chunks || [], [timeline.storage]);
  const pageCount = Math.max(1, storageChunks.length);
  const pageIndex = Math.min(timelinePage.pageIndex, pageCount - 1);
  const events = timelinePage.events;
  const frames = useMemo(
    () => buildTimelineFrames(events, timelinePage.initialProcess),
    [events, timelinePage.initialProcess],
  );
  const currentFrame = frames[currentIndex] || frames[0];
  const currentEvent = currentFrame?.event;
  const cardsByUid = useMemo(() => {
    const map = new Map<number, typeof timeline.cards[number]>();
    timeline.cards.forEach(card => map.set(card.uid, card));
    return map;
  }, [timeline.cards]);

  const actionFrameIndices = useMemo(
    () => frames.map((frame, index) => frame.event.type === 'action_start' ? index : -1).filter(index => index >= 0),
    [frames]
  );

  const timelineIdToFrameIndex = useMemo(() => {
    const map = new Map<number, number>();
    frames.forEach((frame, index) => {
      if (frame.event.type !== 'action_start') return;
      const timelineId = frame.event.info?.timeline_id;
      if (typeof timelineId === 'number' && !map.has(timelineId)) {
        map.set(timelineId, index);
      }
    });
    return map;
  }, [frames]);

  const openTimelinePage = async (
    requestedIndex: number,
    target: 'start' | 'end' | 'firstAction' | 'lastAction' = 'start',
    targetTimelineId?: number,
  ): Promise<boolean> => {
    const nextPageIndex = Math.max(0, Math.min(pageCount - 1, requestedIndex));
    setPageLoading(true);
    setPageError('');
    try {
      const loaded = nextPageIndex === 0
        ? { pageIndex: 0, events: timeline.events || [], initialProcess: [] }
        : await loadTimelinePage(timeline, nextPageIndex);
      const nextFrames = buildTimelineFrames(loaded.events, loaded.initialProcess);
      let nextIndex = 0;
      if (target === 'end') nextIndex = Math.max(0, nextFrames.length - 1);
      if (target === 'firstAction') {
        nextIndex = nextFrames.findIndex(frame => frame.event.type === 'action_start');
        if (nextIndex < 0) nextIndex = 0;
      }
      if (target === 'lastAction') {
        nextIndex = nextFrames.map((frame, index) => frame.event.type === 'action_start' ? index : -1)
          .filter(index => index >= 0)
          .pop() ?? Math.max(0, nextFrames.length - 1);
      }
      if (targetTimelineId !== undefined) {
        const found = nextFrames.findIndex(frame =>
          frame.event.type === 'action_start'
          && frame.event.info?.timeline_id === targetTimelineId
        );
        if (found >= 0) nextIndex = found;
      }
      setTimelinePage(loaded);
      setCurrentIndex(nextIndex);
      setIsPlaying(false);
      lastFrameRef.current = null;
      setFromFrame(null);
      setMotion(1);
      return true;
    } catch (error: any) {
      setPageError(error?.message || String(error));
      return false;
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    setSpeedText(formatTimelineSpeed(speed));
  }, [speed]);

  const matchingFrameIndices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return frames.map((frame, index) => {
      const event = frame.event;
      if (event.type !== 'action_start') return -1;
      const id = typeof event.info?.id === 'string' ? event.info.id : event.action;
      if (!id) return -1;
      const spell = spellDb[id];
      const terms = [
        id,
        spell?.name,
        spell?.en_name,
      ].filter((term): term is string => typeof term === 'string' && term.length > 0);
      return terms.some(term => term.toLowerCase().includes(q)) ? index : -1;
    }).filter(index => index >= 0);
  }, [frames, query, spellDb]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) setStageWidth(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setTimelinePage({ pageIndex: 0, events: timeline.events || [], initialProcess: [] });
    setPageLoading(false);
    setPageError('');
    setCurrentIndex(0);
    setIsPlaying(false);
    lastFrameRef.current = null;
    setFromFrame(null);
    setMotion(1);
  }, [timeline]);

  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;
    const timer = window.setTimeout(() => {
      if (currentIndex < frames.length - 1) {
        setCurrentIndex(currentIndex + 1);
        return;
      }
      if (pageIndex < pageCount - 1) {
        void openTimelinePage(pageIndex + 1, 'start').then(loaded => {
          if (loaded) setIsPlaying(true);
        });
        return;
      }
      setIsPlaying(false);
    }, Math.max(100, 700 / speed));
    return () => window.clearTimeout(timer);
  }, [currentIndex, frames.length, isPlaying, pageCount, pageIndex, speed]);

  useEffect(() => {
    if (!currentFrame) return;
    const previous = lastFrameRef.current || currentFrame;
    lastFrameRef.current = currentFrame;
    setFromFrame(previous);
    setMotion(previous === currentFrame ? 1 : 0);

    if (previous === currentFrame) return;
    const start = performance.now();
    const duration = Math.max(140, 360 / Math.sqrt(speed));
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setMotion(eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentFrame, speed]);

  const jumpTo = (index: number, pause = true) => {
    setCurrentIndex(Math.max(0, Math.min(frames.length - 1, index)));
    if (pause) setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (frames.length <= 1) return;
    if (currentIndex >= frames.length - 1) {
      jumpTo(0, false);
    }
    setIsPlaying(true);
  };

  const updateHoverFrame = (event: React.PointerEvent<HTMLInputElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const index = Math.round(Math.max(0, Math.min(1, ratio)) * Math.max(0, frames.length - 1));
    setHoverFrameIndex(index);
  };

  const commitSpeedText = () => {
    const trimmed = speedText.trim();
    if (!trimmed) {
      setSpeedText(formatTimelineSpeed(speed));
      return;
    }
    const next = Number(trimmed);
    if (Number.isFinite(next)) {
      setSpeed(next);
    } else {
      setSpeedText(formatTimelineSpeed(speed));
    }
  };

  const jumpAction = (direction: -1 | 1) => {
    const target = direction > 0
      ? actionFrameIndices.find(index => index > currentIndex)
      : [...actionFrameIndices].reverse().find(index => index < currentIndex);
    if (target !== undefined) {
      jumpTo(target);
      return;
    }
    if (direction > 0 && pageIndex < pageCount - 1) {
      void openTimelinePage(pageIndex + 1, 'firstAction');
    } else if (direction < 0 && pageIndex > 0) {
      void openTimelinePage(pageIndex - 1, 'lastAction');
    }
  };

  const jumpMatch = (direction: -1 | 1) => {
    if (matchingFrameIndices.length === 0) return;
    const target = direction > 0
      ? matchingFrameIndices.find(index => index > currentIndex) ?? matchingFrameIndices[0]
      : [...matchingFrameIndices].reverse().find(index => index < currentIndex) ?? matchingFrameIndices[matchingFrameIndices.length - 1];
    jumpTo(target);
  };

  useEffect(() => {
    if (!jumpRequest) return;
    const target = timelineIdToFrameIndex.get(jumpRequest.timelineId);
    if (target !== undefined) {
      jumpTo(target);
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    const targetPage = storageChunks.findIndex(chunk => {
      if (chunk.first_timeline_id === undefined || chunk.last_timeline_id === undefined) return false;
      return jumpRequest.timelineId >= chunk.first_timeline_id
        && jumpRequest.timelineId <= chunk.last_timeline_id;
    });
    if (targetPage >= 0) {
      void openTimelinePage(targetPage, 'start', jumpRequest.timelineId).then(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }, [jumpRequest, timelineIdToFrameIndex, storageChunks]);

  const getSpellDisplay = (id?: string) => {
    const spell = id ? spellDb[id] : null;
    return spell ? (i18n.language.startsWith('en') && spell.en_name ? spell.en_name : spell.name) : id || '?';
  };

  const getIcon = (id?: string) => {
    const spell = id ? spellDb[id] : null;
    return spell ? getIconUrl(spell.icon, false) : null;
  };

  const getSlotLabel = (slot?: number) => {
    if (slot === undefined || slot === -999) return null;
    return absoluteToOrdinal?.[slot] ?? slot;
  };

  const getPileOrigins = () => {
    const width = Math.max(stageWidth, 360);
    const colW = width / 3;
    return {
      discarded: { x: 12, y: pileTop + 20, maxPerRow: Math.max(2, Math.floor((colW - 24) / timelineStep)) },
      hand: { x: colW + 12, y: pileTop + 20, maxPerRow: Math.max(2, Math.floor((colW - 24) / timelineStep)) },
      deck: { x: colW * 2 + 12, y: pileTop + 20, maxPerRow: Math.max(2, Math.floor((colW - 24) / timelineStep)) },
    } satisfies Record<TimelinePileName, { x: number; y: number; maxPerRow: number }>;
  };

  const getPileVisibleLimit = (maxPerRow: number) =>
    Math.min(MAX_STAGE_CARDS_PER_PILE, maxPerRow * pileRows);

  const getPileOnlyPositions = (frame: TimelineFrame | null) => {
    const map = new Map<number, TimelineCardPosition>();
    if (!frame) return map;
    const origins = getPileOrigins();

    TIMELINE_PILE_LABELS.forEach(pileName => {
      const origin = origins[pileName];
      (frame.event.piles[pileName] || []).slice(0, getPileVisibleLimit(origin.maxPerRow)).forEach((uid, index) => {
        map.set(uid, {
          x: origin.x + (index % origin.maxPerRow) * timelineStep,
          y: origin.y + Math.floor(index / origin.maxPerRow) * timelineStep,
          visible: true,
        });
      });
    });

    return map;
  };

  const renderAnimatedCards = () => {
    const fromPositions = getPileOnlyPositions(fromFrame || currentFrame);
    const toPositions = getPileOnlyPositions(currentFrame);
    const uids = new Set<number>([...fromPositions.keys(), ...toPositions.keys()]);

    return [...uids].map(uid => {
      const card = cardsByUid.get(uid);
      const from = fromPositions.get(uid) || toPositions.get(uid);
      const to = toPositions.get(uid) || fromPositions.get(uid);
      if (!card || !from || !to) return null;

      const x = from.x + (to.x - from.x) * motion;
      const y = from.y + (to.y - from.y) * motion;
      const opacity = toPositions.has(uid) ? 1 : Math.max(0, 1 - motion);
      const icon = getIcon(card.id);

      return (
        <div
          key={uid}
          className="wand-timeline-card absolute rounded border border-white/10 bg-zinc-950/90 z-10 shadow-lg flex items-center justify-center"
          style={{ transform: `translate(${x}px, ${y}px)`, opacity, width: timelineIconSize, height: timelineIconSize }}
          title={`${getSpellDisplay(card.id)}${card.slot !== undefined ? ` #${card.slot}` : ''}`}
        >
          {icon ? (
            <img src={icon} alt={card.id} className="spell-icon-surface image-pixelated" style={{ width: timelineImageSize, height: timelineImageSize }} />
          ) : (
            <span className="font-mono text-zinc-500" style={{ fontSize: Math.max(9, Math.round(timelineIconSize * 0.31)) }}>?</span>
          )}
          {card.permanent && (
            <span
              className="absolute -top-1 -right-1 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]"
              style={{ width: Math.max(8, Math.round(timelineIconSize * 0.28)), height: Math.max(8, Math.round(timelineIconSize * 0.28)) }}
            />
          )}
        </div>
      );
    });
  };

  const renderProcessCard = (item: TimelineProcessItem, index: number) => {
    const icon = getIcon(item.id);
    const progress = item.copyStep !== undefined
      ? { label: t('evaluator.timeline_copy'), text: formatProgressText(item.copyStep), color: 'text-fuchsia-300/90' }
      : item.drawTotal !== undefined
        ? { label: t('evaluator.timeline_draw'), text: formatProgressText(item.drawStep ?? 0, item.drawTotal), color: 'text-amber-300/80' }
        : null;
    const slotLabel = getSlotLabel(item.slot);
    const slotBadgeSize = Math.max(14, Math.round(timelineIconSize * 0.45));
    const progressLabelSize = Math.max(8, Math.round(timelineIconSize * 0.22));
    const progressTextSize = Math.max(10, Math.round(timelineIconSize * 0.28));
    return (
      <div
        key={`${item.uid ?? item.id}-${index}`}
        className="flex flex-col items-center gap-1"
        style={{ minWidth: processCardMinWidth }}
        title={getSpellDisplay(item.id)}
      >
        <div
          className="wand-timeline-process-card relative rounded border border-amber-400/30 bg-amber-500/10 shadow-lg flex items-center justify-center"
          style={{ width: timelineIconSize, height: timelineIconSize }}
        >
          {icon ? (
            <img src={icon} alt={item.id} className="spell-icon-surface image-pixelated" style={{ width: timelineImageSize, height: timelineImageSize }} />
          ) : (
            <span className="font-mono text-amber-300" style={{ fontSize: Math.max(9, Math.round(timelineIconSize * 0.31)) }}>?</span>
          )}
          {slotLabel !== null && (
            <span
              className="absolute -bottom-1 -right-1 px-0.5 rounded-sm bg-zinc-950 border border-cyan-400/50 font-black text-cyan-300 text-center shadow-md"
              style={{
                minWidth: slotBadgeSize,
                height: slotBadgeSize,
                fontSize: Math.max(8, Math.round(slotBadgeSize * 0.56)),
                lineHeight: `${slotBadgeSize - 2}px`,
              }}
            >
              {slotLabel}
            </span>
          )}
        </div>
        {progress && (
          <div className="text-center font-mono leading-none">
            <div className={`font-black uppercase ${progress.color}`} style={{ fontSize: progressLabelSize }}>{progress.label}</div>
            <div className="font-black text-zinc-300" style={{ fontSize: progressTextSize }}>{progress.text}</div>
          </div>
        )}
      </div>
    );
  };

  if (!currentFrame || !currentEvent) return null;

  return (
    <section ref={sectionRef} className="wand-timeline space-y-3">
      <div className="wand-timeline-heading sticky top-0 z-40 py-2 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-black text-zinc-500 flex items-center gap-2 tracking-widest uppercase">
          <span className="w-1.5 h-1.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)] rounded-full"></span>
          {t('evaluator.timeline')}
        </h3>
        <div className="text-[9px] font-mono text-zinc-500">
          {currentIndex + 1}/{frames.length}
          <span className="text-zinc-700">
            {' · '}raw {currentEvent.i.toLocaleString(i18n.language)}/{(timeline.total_events || events.length).toLocaleString(i18n.language)}
          </span>
          {pageCount > 1 && (
            <span className="text-zinc-700"> · {pageIndex + 1}/{pageCount}</span>
          )}
        </div>
      </div>

      {timeline.complete && timeline.storage && pageCount > 1 && (
        <div className="rounded border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[10px] font-mono text-emerald-200">
          {t('evaluator.timeline_stored', {
            total: (timeline.total_events || events.length).toLocaleString(i18n.language),
            page: pageIndex + 1,
            pages: pageCount,
          })}
        </div>
      )}

      {timeline.truncated && (
        <div className="rounded border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[10px] font-mono text-amber-200">
          {t('evaluator.timeline_truncated', {
            shown: events.length.toLocaleString(i18n.language),
            total: (timeline.total_events || events.length).toLocaleString(i18n.language),
          })}
        </div>
      )}

      {pageError && (
        <div className="rounded border border-red-400/25 bg-red-500/10 px-3 py-2 text-[10px] font-mono text-red-200">
          {t('evaluator.timeline_page_error', { error: pageError })}
        </div>
      )}

      <div className="wand-timeline-panel relative border border-white/10 bg-zinc-950/45 rounded-lg overflow-visible">
        <div className="wand-timeline-toolbar flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.03]">
          <button className="wand-timeline-control w-8 h-8 rounded border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 disabled:opacity-40" disabled={pageLoading} onClick={() => void openTimelinePage(0, 'start')} title={t('evaluator.timeline_first')}>
            <SkipBack size={14} />
          </button>
          <button className="wand-timeline-control w-8 h-8 rounded border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300" onClick={() => jumpAction(-1)} title={t('evaluator.timeline_prev_action')}>
            <StepBack size={14} />
          </button>
          <button className="wand-timeline-play w-9 h-8 rounded border border-cyan-400/30 bg-cyan-500/10 hover:bg-cyan-500/20 flex items-center justify-center text-cyan-300" onClick={togglePlayback} title={isPlaying ? t('evaluator.timeline_pause') : t('evaluator.timeline_play')}>
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button className="wand-timeline-control w-8 h-8 rounded border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300" onClick={() => jumpAction(1)} title={t('evaluator.timeline_next_action')}>
            <StepForward size={14} />
          </button>
          <button className="wand-timeline-control w-8 h-8 rounded border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 disabled:opacity-40" disabled={pageLoading} onClick={() => void openTimelinePage(pageCount - 1, 'end')} title={t('evaluator.timeline_last')}>
            <SkipForward size={14} />
          </button>

          {pageCount > 1 && (
            <div className="h-8 flex items-center rounded border border-white/10 bg-zinc-950 overflow-hidden">
              <button
                className="h-full px-2 text-[10px] font-mono text-zinc-300 hover:bg-white/10 disabled:opacity-30"
                disabled={pageLoading || pageIndex <= 0}
                onClick={() => void openTimelinePage(pageIndex - 1, 'end')}
              >
                {t('evaluator.timeline_prev_page')}
              </button>
              <span className="px-2 text-[10px] font-mono text-cyan-300 border-x border-white/10">
                {pageLoading ? t('evaluator.timeline_loading') : `${pageIndex + 1}/${pageCount}`}
              </span>
              <button
                className="h-full px-2 text-[10px] font-mono text-zinc-300 hover:bg-white/10 disabled:opacity-30"
                disabled={pageLoading || pageIndex >= pageCount - 1}
                onClick={() => void openTimelinePage(pageIndex + 1, 'start')}
              >
                {t('evaluator.timeline_next_page')}
              </button>
            </div>
          )}

          <div className="wand-timeline-field h-8 min-w-[210px] flex items-center gap-2 rounded border border-white/10 bg-zinc-950 px-2" title={t('evaluator.timeline_speed')}>
            <span className="w-8 text-right text-[10px] font-black text-cyan-300">{formatTimelineSpeed(speed)}x</span>
            <input
              type="range"
              min={0.25}
              max={4}
              step={0.05}
              value={Math.max(0.25, Math.min(4, speed))}
              onChange={event => setSpeed(Number(event.target.value))}
              className="w-24 accent-cyan-400"
            />
            <input
              type="number"
              min={MIN_TIMELINE_SPEED}
              max={MAX_TIMELINE_SPEED}
              step={0.05}
              value={speedText}
              onChange={event => setSpeedText(event.target.value)}
              onBlur={commitSpeedText}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  commitSpeedText();
                  event.currentTarget.blur();
                }
              }}
              className="h-6 w-14 rounded border border-white/10 bg-black/30 px-1 text-center text-[10px] font-black text-zinc-200 outline-none focus:border-cyan-400/50"
            />
            <span className="text-[10px] font-black text-zinc-500">x</span>
          </div>

          <div className="relative flex-1 min-w-[180px]">
            {hoverFrameIndex !== null && frames.length > 1 && (
              <div
                className="wand-timeline-tooltip pointer-events-none absolute -top-7 z-50 rounded bg-zinc-950/95 px-2 py-1 text-[10px] font-black text-white shadow-lg border border-white/10"
                style={{ left: `${(hoverFrameIndex / Math.max(1, frames.length - 1)) * 100}%`, transform: 'translateX(-50%)' }}
              >
                {hoverFrameIndex + 1}/{frames.length}
              </div>
            )}
            <input
              value={currentIndex}
              min={0}
              max={Math.max(0, frames.length - 1)}
              step={1}
              type="range"
              onChange={event => jumpTo(Number(event.target.value))}
              onPointerMove={updateHoverFrame}
              onPointerEnter={updateHoverFrame}
              onPointerLeave={() => setHoverFrameIndex(null)}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="relative w-56 max-w-full">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') jumpMatch(event.shiftKey ? -1 : 1);
              }}
              placeholder={t('evaluator.timeline_search')}
              className="w-full h-8 pl-7 pr-16 bg-zinc-950 border border-white/10 rounded text-[10px] font-bold text-zinc-300 outline-none focus:border-cyan-400/40"
            />
            <button
              onClick={() => jumpMatch(1)}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[9px] font-black text-zinc-400"
            >
              {matchingFrameIndices.length}
            </button>
          </div>
        </div>

        <div className="wand-timeline-meta px-3 py-2 border-b border-white/10 flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-black uppercase">{currentEvent.type.replace(/_/g, ' ')}</span>
          {currentEvent.cast !== undefined && <span className="text-zinc-500">cast {currentEvent.cast}</span>}
          {currentEvent.shot !== undefined && <span className="text-zinc-500">shot {currentEvent.shot}</span>}
          {currentEvent.action && <span className="text-amber-300">{currentEvent.action}</span>}
          {typeof currentEvent.info?.id === 'string' && <span className="text-zinc-400">{currentEvent.info.id}</span>}
        </div>

        <div ref={stageRef} className="wand-timeline-stage relative overflow-hidden bg-black/20" style={{ height: stageHeight }}>
          <div
            className="wand-timeline-process absolute left-3 top-3 right-3 rounded border border-amber-400/20 bg-amber-500/[0.04] overflow-hidden"
            style={{ height: processHeight }}
          >
            <div className="absolute left-2 top-1 text-[9px] font-black uppercase tracking-widest text-amber-300/70">{t('evaluator.timeline_processing')}</div>
            <div className={processViewportClass}>
              <div className={processListClass}>
                {currentFrame.process.length > 0 ? currentFrame.process.map(renderProcessCard) : (
                  <span className="text-[10px] font-mono text-zinc-700">{t('evaluator.timeline_idle')}</span>
                )}
              </div>
            </div>
          </div>

          {TIMELINE_PILE_LABELS.map((pileName, index) => {
            const colW = Math.max(stageWidth, 360) / 3;
            const origin = getPileOrigins()[pileName];
            const pileCount = currentEvent.piles[pileName]?.length || 0;
            const visibleLimit = getPileVisibleLimit(origin.maxPerRow);
            return (
              <div
                key={pileName}
                className="wand-timeline-pile absolute rounded border border-white/10 bg-white/[0.025]"
                style={{ left: index * colW + 8, top: pileTop, width: Math.max(88, colW - 16), height: pileHeight }}
              >
                <div className="absolute left-2 top-1 flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{t(`evaluator.timeline_${pileName}`)}</span>
                  <span className="text-[9px] font-mono text-zinc-600">{pileCount}</span>
                  {pileCount > visibleLimit && (
                    <span className="text-[8px] font-black text-amber-500">+{pileCount - visibleLimit}</span>
                  )}
                </div>
              </div>
            );
          })}

          {renderAnimatedCards()}
        </div>
      </div>
    </section>
  );
};

// 抽离出的子组件，保持主组件整洁
const CastStatsPanel: React.FC<{ group: any, spellDb: Record<string, SpellInfo>, settings: AppSettings }> = React.memo(({ group, spellDb, settings }) => {
  const { t, i18n } = useTranslation();
  const sortedCastCounts = Object.entries(group.counts || {}).sort(([, a], [, b]) => (b as number) - (a as number));

  // 获取本轮施法的最终数据（直接解析工具计算好的 extra 字符串，这是最准确的）
  const extra = group.node?.extra || "";
  // 使用更健壮的正则，支持不同空格和大小写
  const cdMatch = extra.match(/CastDelay:\s*(-?[\d\.]+)/i);
  const rtMatch = extra.match(/Recharge:\s*(-?[\d\.]+)/i);
  const manaMatch = extra.match(/ΔMana:\s*(-?[\d\.]+)/i);
  const recoilMatch = extra.match(/Recoil:\s*(-?[\d\.]+)/i);

  const castDelay = cdMatch ? cdMatch[1] : null;
  const recharge = rtMatch ? rtMatch[1] : null;
  const manaDrain = manaMatch ? manaMatch[1] : null;
  const recoil = recoilMatch ? recoilMatch[1] : null;

  if (sortedCastCounts.length === 0) return null;
  return (
    <div className="flex-shrink-0 w-48 space-y-4">
      <div className="space-y-2">
        <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
          <div className="w-1 h-1 bg-amber-500/50 rounded-full"></div>
          {t('evaluator.cast_stats')}
        </div>
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto custom-scrollbar-mini pr-2">
          {sortedCastCounts.filter(([id]) => {
            if (settings.triggerVisualizationMode === 'wanddbg') {
              return !(id.includes('TRIGGER') || id.includes('TIMER'));
            }
            return true;
          }).map(([id, count]) => {
            const spell = spellDb[id];
            const displayName = spell ? (i18n.language.startsWith('en') && spell.en_name ? spell.en_name : spell.name) : id;
            return (
              <div key={id} className="flex items-center gap-2 glass pl-1 pr-2 py-1 rounded transition-all hover:bg-white/10">
                {spell ? (
                  <img src={getIconUrl(spell.icon, false)} alt={id} className="spell-icon-surface w-6 h-6 image-pixelated" />
                ) : (
                  <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-[8px] text-zinc-500 font-mono">?</div>
                )}
                <div className="flex-1 flex justify-between items-baseline min-w-0">
                  <span className="text-[9px] font-bold text-zinc-400 truncate uppercase tracking-tighter mr-2" title={id}>
                    {displayName}
                  </span>
                  <span className="text-[10px] font-black text-amber-500 font-mono">
                    x{(count as number).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 最终结算结果：直接搬运自工具的 extra 字段 */}
      {(castDelay || recharge || manaDrain || recoil) && (
        <div className="pt-3 border-t border-white/5 space-y-2">
          <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
            <div className="w-1 h-1 bg-blue-500/50 rounded-full"></div>
            {t('evaluator.cast_final_settlement')}
          </div>
          <div className="grid grid-cols-1 gap-1">
            {castDelay && (
              <div className="flex justify-between items-center bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">{t('evaluator.cast_delay')}</span>
                <span className="text-[10px] font-mono font-black text-blue-400">
                  {castDelay}f
                </span>
              </div>
            )}
            {recharge && Number(recharge) > 0 && (
              <div className="flex justify-between items-center bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">{t('evaluator.recharge_time')}</span>
                <span className="text-[10px] font-mono font-black text-amber-500">
                  {recharge}f
                </span>
              </div>
            )}
            {manaDrain && (
              <div className="flex justify-between items-center bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 mt-1">
                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">{t('evaluator.mana_drain')}</span>
                <span className="text-[10px] font-mono font-black text-purple-400">
                  {manaDrain}
                </span>
              </div>
            )}
            {recoil && (
              <div className="flex justify-between items-center bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10">
                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">{t('evaluator.recoil')}</span>
                <span className={`text-[10px] font-mono font-black ${Number(recoil) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {recoil}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

const TRIGGER_TYPE_STYLES: Record<string, { color: string; bg: string; border: string; label: string }> = {
  trigger: { color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', label: 'T' },
  timer: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Tm' },
  death: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', label: 'D' },
};

const ShotStateCard: React.FC<{ state: ShotState, spellDb?: Record<string, SpellInfo>, isHighlighted?: boolean, settings: AppSettings }> = React.memo(({ state, spellDb, isHighlighted, settings }) => {
  const { t } = useTranslation();
  const sourceSpellId = state.source_spell;
  const sourceSpell = sourceSpellId && spellDb ? spellDb[sourceSpellId] : null;
  const triggerStyle = state.trigger_type ? TRIGGER_TYPE_STYLES[state.trigger_type] : null;
  const projectiles = state.projectiles; // engine-level projectile entities

  // WandDBG Mode Logic:
  // If we are in 'wanddbg' mode and the source spell is a trigger (ADD_TRIGGER, etc.),
  // WandDBG actually shows the *modified* spell (the one that was discarded and copied) as the caster,
  // overlaid with the trigger badge.
  // In our engine, the projectiles[0] is often that modified spell.
  
  let mainIconSpellId = sourceSpellId;
  let mainIcon = sourceSpell?.icon;
  
  if (settings.triggerVisualizationMode === 'wanddbg' && triggerStyle && projectiles && projectiles.length > 0) {
    // If the source is an add_trigger, and we have projectiles, the first projectile is the "payload"
    // We use its icon to represent the "triggered spell"
    const payloadSpell = spellDb?.[projectiles[0]];
    if (payloadSpell) {
      mainIconSpellId = projectiles[0];
      mainIcon = payloadSpell.icon;
    }
  }

  return (
    <TiltContainer className="relative" maxAngle={10} scale={1.05} glareClassName="bg-white/10 rounded-xl">
      {/* A类: Source spell icon — OUTSIDE the card (Centered on top-left vertex) */}
      {mainIcon && (
        <div
          className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center"
          title={mainIconSpellId}
        >
          <div className={`relative w-10 h-10 rounded-md bg-zinc-900 border ${triggerStyle ? triggerStyle.border + ' ' + triggerStyle.bg : 'border-zinc-700'} shadow-2xl flex items-center justify-center p-1`}>
            <img src={getIconUrl(mainIcon, false)} alt={mainIconSpellId || ''} className="spell-icon-surface w-7 h-7 image-pixelated" />
            
            {/* Filter: If we are showin the payload icon, the trigger badge goes on top */}
            {settings.triggerVisualizationMode === 'wanddbg' && triggerStyle && (
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-sm border ${triggerStyle.border} ${triggerStyle.bg} flex items-center justify-center shadow-md animate-in fade-in zoom-in duration-300`}>
                <span className={`text-[8px] font-black ${triggerStyle.color}`}>
                  {triggerStyle.label}
                </span>
              </div>
            )}
          </div>
          
          {/* Explicit mode: Show the trigger label next to the icon */}
          {settings.triggerVisualizationMode === 'standard' && triggerStyle && (
            <div className={`ml-1.5 px-1.5 py-0.5 rounded border text-[9px] font-black shadow-lg ${triggerStyle.color} ${triggerStyle.bg} ${triggerStyle.border} bg-zinc-900 animate-in slide-in-from-left-1 duration-300`}>
              {triggerStyle.label}
            </div>
          )}
        </div>
      )}
      <div className={`flex-shrink-0 w-72 px-4 pt-1.5 pb-4 glass-card transition-all duration-300 group/state ${isHighlighted ? 'glow-border-active scale-105 z-10' : 'hover:glow-border'}`}>
        <div className={`text-[13px] font-mono font-bold mb-2 border-b border-white/5 pb-1 flex justify-between items-center uppercase tracking-tight ${isHighlighted ? 'text-white' : 'text-blue-400'}`}>
          <div className="flex items-center gap-2.5">
            {/* B类: Projectiles in this shot — INSIDE the card header (Moved to extreme left) */}
            {projectiles && projectiles.length > 0 && spellDb && (
              <div className="flex items-center gap-1 flex-wrap min-h-[28px]">
                {(settings.triggerVisualizationMode === 'wanddbg' && triggerStyle && projectiles.length > 0
                  ? projectiles.slice(1) // Hide the payload as it's now the "Caster" icon
                  : projectiles
                ).map((spellId, i) => {
                  const spell = spellDb[spellId];
                  return spell ? (
                    <img
                      key={`${spellId}-${i}`}
                      src={getIconUrl(spell.icon, false)}
                      alt={spellId}
                      title={spellId}
                      className="spell-icon-surface w-7 h-7 image-pixelated"
                    />
                  ) : (
                    <div key={`${spellId}-${i}`} className="w-7 h-7 bg-zinc-800 rounded flex items-center justify-center text-[9px] text-zinc-500 font-mono" title={spellId}>?</div>
                  );
                })}
              </div>
            )}
            
            {/* state.id (Moved away from top-left) */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border transition-colors ${isHighlighted ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-zinc-800 border-white/10 text-zinc-400'}`}>
              {state.id}
            </div>
          </div>
          <span className={`${isHighlighted ? 'opacity-100' : 'opacity-0'} group-hover/state:opacity-100 text-[10px] text-zinc-600 transition-opacity`}>{t('evaluator.shot_state_label')}</span>
        </div>
        <div className="space-y-2">
          {Object.entries(state.stats)
            .filter(([key]) => !['reload_time', 'fire_rate_wait'].includes(key))
            .map(([key, value]) => {
              let color = "text-zinc-300";
              if (typeof value === 'number') {
                if (['spread_degrees', 'recoil', 'delay'].includes(key)) {
                  color = value > 0 ? "text-red-400" : value < 0 ? "text-emerald-400" : "text-zinc-300";
                } else if (key.includes('damage') || key === 'speed_multiplier') {
                  color = value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-zinc-300";
                }
              }
              return (
                <div key={key} className="flex justify-between items-center text-[12px] font-mono leading-none gap-4">
                  <span className="text-zinc-500 uppercase text-[11px]">{key.replace(/_/g, ' ')}</span>
                  <span className={color}>
                    {value}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </TiltContainer>
  );
});

const TreeNode: React.FC<{
  node: EvalNode;
  spellDb: Record<string, SpellInfo>;
  isRoot?: boolean;
  onHover?: (indices: number[] | null) => void;
  onHoverShotId?: (id: number | null) => void;
  onTimelineNodeClick?: (node: EvalNode) => void;
  markedSlots: number[];
  showIndices: boolean;
  absoluteToOrdinal: Record<number, number> | null;
  settings: AppSettings;
}> = React.memo(({ node, spellDb, isRoot, onHover, onHoverShotId, onTimelineNodeClick, markedSlots, showIndices, absoluteToOrdinal, settings }) => {
  const { i18n } = useTranslation();
  const isCast = node.name.startsWith('Cast #') || node.name === 'Wand';
  const spell = spellDb[node.name];
  const displayName = settings.showSpellId ? node.name : (spell ? (i18n.language.startsWith('en') && spell.en_name ? spell.en_name : spell.name) : node.name);

  const iconUrl = spell ? getIconUrl(spell.icon, false) : null;
  const isMarked = node.index && node.index.some(idx => markedSlots.includes(idx));
  const canJumpToTimeline = getFirstTimelineId(node) !== undefined && !!onTimelineNodeClick;

  return (
    <div className={`flex items-start shrink-0`}>
      <div className="relative flex items-start">
        {/* 左侧连接线 + 节点卡片 包装器 */}
        <div className="flex items-center h-[46px] shrink-0">
          {!isRoot && (
            <div className="w-6 h-[2px] eval-tree-line shrink-0"></div>
          )}

          <TiltContainer
            maxAngle={20}
            scale={1.2}
            glareClassName="bg-white/20 rounded"
            onMouseEnter={() => {
              node.index && onHover?.(node.index);
              node.shot_id && onHoverShotId?.(node.shot_id);
            }}
            onMouseLeave={() => {
              onHover?.(null);
              onHoverShotId?.(null);
            }}
            onClick={(event) => {
              if (!canJumpToTimeline) return;
              event.stopPropagation();
              onTimelineNodeClick?.(node);
            }}
            className={`
              eval-tree-node group relative p-2 rounded border transition-all ${canJumpToTimeline ? 'cursor-pointer' : 'cursor-help'} shrink-0
              ${isCast ? 'eval-tree-cast-node bg-indigo-500/10 border-indigo-500/30' : 'eval-tree-spell-node bg-zinc-900 border-white/10 shadow-xl'}
              ${isMarked ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-black scale-105 z-10 !border-amber-500/50' : ''}
              hover:scale-110 hover:z-20 hover:border-indigo-400 hover:bg-indigo-400/20
            `}
          >
            <div className="flex items-center gap-2 justify-center">
              {/* WandDBG visual magic: if this is a trigger and in wanddbg mode, show payload icon */}
              {(() => {
                let currentIconUrl = iconUrl;
                let currentDisplayName = displayName;
                let currentSpellId = node.name;
                let badge = null;

                if (settings.triggerVisualizationMode === 'wanddbg' && node.children && node.children.length > 0) {
                   const spellMeta = spellDb[node.name];
                   // How do we know it's a trigger? We can check its ID or metadata if available.
                   // For now, checking if it has children and is a known trigger ID pattern
                   if (node.name.includes('TRIGGER') || node.name.includes('TIMER')) {
                      // It's a trigger modifier. Find the first spell child.
                      const payloadNode = node.children.find(c => spellDb[c.name]);
                      if (payloadNode) {
                         const payloadSpell = spellDb[payloadNode.name];
                         currentIconUrl = getIconUrl(payloadSpell.icon, false);
                         currentDisplayName = (i18n.language.startsWith('en') && payloadSpell.en_name ? payloadSpell.en_name : payloadSpell.name);
                         currentSpellId = payloadNode.name;
                         
                         // Determine badge
                         let badgeText = 'T';
                         if (node.name.includes('TIMER')) badgeText = 'Tm';
                         if (node.name.includes('DEATH')) badgeText = 'D';
                         
                         badge = (
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-sm border border-blue-400/50 bg-blue-600 flex items-center justify-center shadow-md z-10">
                              <span className="text-[6px] font-black text-white">{badgeText}</span>
                            </div>
                         );
                      }
                   }
                }

                const showText = settings.showSpellId || !currentIconUrl;

                return (
                  <div className="relative flex items-center gap-1">
                    {currentIconUrl && (
                      <img src={currentIconUrl} alt={currentSpellId} className="spell-icon-surface w-7 h-7 image-pixelated" title={currentDisplayName} />
                    )}
                    {showText && (
                      <span className="text-[10px] font-black font-mono text-zinc-400 px-1 whitespace-nowrap tracking-tighter">
                        {currentDisplayName}
                      </span>
                    )}
                    {badge}
                  </div>
                );
              })()}

              {node.count > 1 && (
                <span className="text-[10px] font-black bg-indigo-500 text-white px-1 rounded shadow-sm">
                  x{node.count}
                </span>
              )}

              {node.shot_id && (
                <div className="absolute -top-1.5 -right-1.5 px-1 bg-blue-600 text-white text-[7px] font-black rounded-sm border border-blue-400/50 shadow-lg z-30">
                  @{node.shot_id}
                </div>
              )}

              {node.iteration !== undefined && settings.recursionIterationDisplay !== 'none' && (
                <div
                  className="absolute -top-1.5 font-black z-30"
                  style={{
                    right: node.shot_id ? '18px' : '-2px',
                    color: '#a78bfa',
                    fontSize: '10px',
                    textShadow: '0 0 4px rgba(0,0,0,0.9)',
                  }}
                  title={`Iteration: ${node.iteration}`}
                >
                  {settings.recursionIterationDisplay === 'labeled' ? `i${node.iteration}` : node.iteration}
                </div>
              )}

              {node.recursion !== undefined && settings.recursionIterationDisplay !== 'none' && (
                <div
                  className="absolute -top-1.5 font-black z-30"
                  style={{
                    left: '-2px',
                    color: '#34d399',
                    fontSize: '10px',
                    textShadow: '0 0 4px rgba(0,0,0,0.9)',
                  }}
                  title={`Recursion: ${node.recursion}`}
                >
                  {settings.recursionIterationDisplay === 'labeled' ? `r${node.recursion}` : node.recursion}
                </div>
              )}

              {showIndices && node.index && node.index.length > 0 && (
                <div className="absolute -bottom-1.5 -right-1 text-cyan-400 text-[10px] font-black z-20 scale-110 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]">
                  {node.index.map(idx => absoluteToOrdinal?.[idx] || idx).join(',')}
                </div>
              )}
            </div>

            {/* 浮动标签（Extra Info） */}
            {node.extra && (
              <div className="absolute -top-12 left-0 w-max max-w-[200px] whitespace-normal break-words bg-zinc-950/95 text-[9px] font-bold px-2 py-1.5 rounded border border-white/20 text-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-[0_10px_30px_rgba(0,0,0,0.5)] uppercase tracking-tighter leading-tight">
                {node.extra}
              </div>
            )}
          </TiltContainer>
        </div>

        {/* 子节点渲染：如果是最后一级，不需要右侧间距 */}
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col gap-3 relative">
            {/* 这里的连接线容器确保了深度嵌套时不会坍缩 */}
            <div className="flex flex-col gap-3 ml-0 shrink-0">
              {node.children.map((child, i) => (
                <div key={i} className="flex items-start">
                  <TreeNode
                    node={child}
                    spellDb={spellDb}
                    onHover={onHover}
                    onHoverShotId={onHoverShotId}
                    onTimelineNodeClick={onTimelineNodeClick}
                    markedSlots={markedSlots}
                    showIndices={showIndices}
                    absoluteToOrdinal={absoluteToOrdinal}
                    settings={settings}
                  />
                </div>
              ))}
            </div>
            {/* 垂直分支线 */}
            {node.children.length > 1 && (
              <div className="absolute left-0 top-[23px] bottom-[23px] w-[2px] eval-tree-line"></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default WandEvaluator;
