import React, { useState, useMemo, useEffect } from 'react';
import { EvalNode, ShotState, SpellInfo, AppSettings } from '../types';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface Props {
  data: {
    tree: EvalNode;
    states: ShotState[];
    counts: Record<string, number>;
    cast_counts: Record<string, Record<string, number>>;
  };
  spellDb: Record<string, SpellInfo>;
  onHoverSlots?: (indices: number[] | null) => void;
  settings: AppSettings;
}

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

const WandEvaluator: React.FC<Props> = ({ data, spellDb, onHoverSlots, settings }) => {
  const [userExpandedCasts, setUserExpandedCasts] = useState<Record<number, boolean>>({});
  const [userShowAllCasts, setUserShowAllCasts] = useState<Record<number, boolean>>({}); // 控制是否展开合并的每一轮

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
        const isStateMatch = areStatesEqual(lastGroup.states, currentStates);
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

  return (
    <div className="mt-6 p-4 bg-black/40 border border-white/10 rounded-lg overflow-hidden space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Overall Spell Counts Section */}
      {sortedOverallCounts.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black text-zinc-500 mb-4 flex items-center gap-2 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] rounded-full"></span>
            法术放出总量统计 (Overall)
          </h3>
          <div className="flex flex-wrap gap-2 opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-300">
            {sortedOverallCounts.map(([id, count]) => {
              const spell = spellDb[id];
              return (
                <div key={id} className="flex items-center gap-2 bg-zinc-900/40 border border-white/5 pl-1 pr-3 py-0.5 rounded-md transition-all group/count">
                  {spell ? (
                    <img src={`/api/icon/${spell.icon}`} alt={id} className="w-5 h-5 image-pixelated" />
                  ) : (
                    <div className="w-5 h-5 bg-zinc-800 rounded flex items-center justify-center text-[8px] text-zinc-500 font-mono">?</div>
                  )}
                  <div className="flex flex-col -space-y-1">
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter truncate max-w-[60px]" title={id}>
                      {spell ? spell.name : id}
                    </span>
                    <span className="text-[9px] font-black text-amber-500/80 font-mono">
                      {count.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Shot States Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black text-zinc-500 flex items-center gap-2 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] rounded-full"></span>
            射击状态详情 (Shot States)
          </h3>
        </div>
        
        <div className="space-y-6">
          {castGroups.map(group => {
            const isRange = group.start !== group.end;
            const isVisible = userExpandedCasts[group.start] ?? true; // 状态详情默认可见
            const isShowingAll = userShowAllCasts[group.start] ?? false;

            return (
              <div key={group.start} className="space-y-4">
                <div 
                  className="flex items-center gap-2 cursor-pointer group/h"
                  onClick={() => setUserExpandedCasts(prev => ({ ...prev, [group.start]: !isVisible }))}
                >
                  <div className={`flex items-center gap-2 px-2 py-0.5 rounded border uppercase tracking-tighter transition-colors ${isRange ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                    <span className="text-[9px] font-black">
                      {isRange ? `Cast #${group.start} - #${group.end}` : `Cast #${group.start}`}
                    </span>
                    {isRange && (
                      <span className="text-[7px] font-bold bg-amber-500/20 px-1 rounded">重复已合并</span>
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
                      {isShowingAll ? '收起为预览模式' : `展开全部 ${group.end - group.start + 1} 轮详情`}
                    </button>
                  )}

                  <div className="h-px flex-1 bg-white/5"></div>
                  <div className="text-zinc-600 group-hover/h:text-zinc-400 transition-colors">
                    {isVisible ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </div>
                </div>

                {isVisible && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
                    {(!isRange || !isShowingAll) ? (
                      // 预览模式或单轮：只显示一个代表
                      <div className="flex items-start gap-8">
                        <CastStatsPanel group={group} spellDb={spellDb} />
                        <div className="flex-1 flex gap-4 overflow-x-auto pb-2 custom-scrollbar-mini">
                          {group.states.map((state) => (
                            <ShotStateCard key={`${state.cast}-${state.id}`} state={state} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      // 展开模式：显示范围内每一轮
                      Array.from({ length: group.end - group.start + 1 }).map((_, i) => {
                        const cNum = group.start + i;
                        const cStates = data.states.filter(s => s.cast === cNum);
                        const cCounts = data.cast_counts?.[cNum.toString()] || {};
                        return (
                          <div key={cNum} className="flex items-start gap-8 opacity-90 hover:opacity-100 transition-opacity">
                            <div className="shrink-0 w-12 pt-4">
                              <span className="text-[8px] font-black text-zinc-600 uppercase"># {cNum}</span>
                            </div>
                            <CastStatsPanel group={{ counts: cCounts } as any} spellDb={spellDb} />
                            <div className="flex-1 flex gap-4 overflow-x-auto pb-2 custom-scrollbar-mini">
                              {cStates.map((state) => (
                                <ShotStateCard key={`${state.cast}-${state.id}`} state={state} />
                              ))}
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

      {/* Tree Flowchart Section */}
      <section>
        <h3 className="text-[10px] font-black text-zinc-500 mb-4 flex items-center gap-2 tracking-widest uppercase">
          <span className="w-1.5 h-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] rounded-full"></span>
          执行流 (递归树)
        </h3>
        <div className="space-y-4">
          {castGroups.map((group) => {
            const complexity = countNodes(group.node);
            const isRange = group.start !== group.end;
            // 递归树默认根据复杂度折叠，但在合并模式下，首项默认展开以供预览
            const isAutoFolded = shouldDefaultFold && group.start > 1;
            const isVisible = userExpandedCasts[group.start] ?? !isAutoFolded;
            const isShowingAll = userShowAllCasts[group.start] ?? false;

            return (
              <div key={group.start} className="bg-zinc-950/30 rounded-lg border border-white/5 overflow-hidden">
                <div 
                  className="px-4 py-2 bg-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors group/treeh"
                  onClick={() => setUserExpandedCasts(prev => ({ ...prev, [group.start]: !isVisible }))}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase ${isRange ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {isRange ? `Cast #${group.start} - #${group.end}` : `Cast #${group.start}`}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-mono">节点数: {complexity}</span>
                    
                    {isRange && isVisible && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserShowAllCasts(prev => ({ ...prev, [group.start]: !isShowingAll }));
                        }}
                        className="text-[8px] font-black text-zinc-500 hover:text-white bg-white/5 px-2 py-0.5 rounded border border-white/5 transition-all uppercase"
                      >
                        {isShowingAll ? '收起为预览模式' : `展开全部 ${group.end - group.start + 1} 个树形图`}
                      </button>
                    )}

                    {isAutoFolded && !isVisible && (
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">已自动折叠</span>
                    )}
                  </div>
                  <div className="text-zinc-500 group-hover/treeh:text-zinc-300">
                    {isVisible ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </div>
                
                {isVisible && (
                  <div className="p-6 space-y-12 animate-in fade-in slide-in-from-top-1 duration-200">
                    {(!isRange || !isShowingAll) ? (
                      // 预览模式或单轮：显示统计 + 树
                      <div className="flex items-start gap-8">
                        <CastStatsPanel group={group} spellDb={spellDb} />
                        <div className="flex-1 overflow-x-auto custom-scrollbar pb-4">
                          <div className="w-fit">
                            <TreeNode node={group.node} spellDb={spellDb} isRoot={true} onHover={onHoverSlots} />
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
                          <div key={cNum} className="flex items-start gap-8 opacity-90 hover:opacity-100 transition-opacity">
                            <div className="shrink-0 w-12 pt-4">
                              <span className="text-[8px] font-black text-zinc-600 uppercase"># {cNum}</span>
                            </div>
                            <CastStatsPanel group={{ counts: cCounts } as any} spellDb={spellDb} />
                            <div className="flex-1 overflow-x-auto custom-scrollbar pb-4">
                              <div className="w-fit">
                                <TreeNode node={cNode} spellDb={spellDb} isRoot={true} onHover={onHoverSlots} />
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
    </div>
  );
};

// 抽离出的子组件，保持主组件整洁
const CastStatsPanel: React.FC<{ group: any, spellDb: Record<string, SpellInfo> }> = ({ group, spellDb }) => {
  const sortedCastCounts = Object.entries(group.counts || {}).sort(([, a], [, b]) => (b as number) - (a as number));
  if (sortedCastCounts.length === 0) return null;
  return (
    <div className="flex-shrink-0 w-48 space-y-2">
      <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
        <div className="w-1 h-1 bg-amber-500/50 rounded-full"></div>
        本轮放出统计
      </div>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto custom-scrollbar-mini pr-2">
        {sortedCastCounts.map(([id, count]) => {
          const spell = spellDb[id];
          return (
            <div key={id} className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 pl-1 pr-2 py-1 rounded transition-all">
              {spell ? (
                <img src={`/api/icon/${spell.icon}`} alt={id} className="w-6 h-6 image-pixelated" />
              ) : (
                <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-[8px] text-zinc-500 font-mono">?</div>
              )}
              <div className="flex-1 flex justify-between items-baseline min-w-0">
                <span className="text-[9px] font-bold text-zinc-400 truncate uppercase tracking-tighter mr-2" title={id}>
                  {spell ? spell.name : id}
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
  );
};

const ShotStateCard: React.FC<{ state: ShotState }> = ({ state }) => (
  <div className="flex-shrink-0 w-56 p-3 bg-zinc-900/50 border border-white/5 rounded-md hover:border-blue-500/30 transition-colors group/state">
    <div className="text-[10px] font-mono font-bold text-blue-400 mb-3 border-b border-white/5 pb-1.5 flex justify-between items-center uppercase tracking-tighter">
      <span>第 {state.id} 阶</span>
      <span className="opacity-0 group-hover/state:opacity-100 text-[8px] text-zinc-600 transition-opacity">PROJ STATE</span>
    </div>
    <div className="space-y-1.5">
      {Object.entries(state.stats).map(([key, value]) => (
        <div key={key} className="flex justify-between text-[10px] font-mono leading-none">
          <span className="text-zinc-500 uppercase text-[9px]">{key.replace(/_/g, ' ')}</span>
          <span className="text-zinc-300">{value}</span>
        </div>
      ))}
    </div>
  </div>
);

const TreeNode: React.FC<{ 
  node: EvalNode; 
  spellDb: Record<string, SpellInfo>; 
  isRoot?: boolean;
  onHover?: (indices: number[] | null) => void;
}> = ({ node, spellDb, isRoot, onHover }) => {
  const isCast = node.name.startsWith('Cast #') || node.name === 'Wand';
  const spell = spellDb[node.name];
  
  const iconUrl = spell ? `/api/icon/${spell.icon}` : null;

  return (
    <div className={`flex items-center shrink-0`}>
      <div className="relative flex items-center">
        {/* 左侧连接线 */}
        {!isRoot && (
          <div className="w-6 h-px bg-zinc-800 shrink-0"></div>
        )}

        <div 
          onMouseEnter={() => node.index && onHover?.(node.index)}
          onMouseLeave={() => onHover?.(null)}
          className={`
            group relative p-2 rounded border transition-all cursor-help shrink-0
            ${isCast ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-zinc-900 border-white/10 shadow-xl'}
            hover:scale-110 hover:z-20 hover:border-indigo-400 hover:bg-indigo-400/20
          `}
        >
          <div className="flex items-center gap-2 min-w-[24px] justify-center">
            {iconUrl ? (
              <img src={iconUrl} alt={node.name} className="w-7 h-7 image-pixelated drop-shadow-md" title={node.name} />
            ) : (
              <span className="text-[10px] font-black font-mono text-zinc-400 px-1 whitespace-nowrap uppercase italic tracking-tighter">
                {node.name}
              </span>
            )}
            
            {node.count > 1 && (
              <span className="text-[10px] font-black bg-indigo-500 text-white px-1 rounded shadow-sm">
                x{node.count}
              </span>
            )}
          </div>

          {/* 浮动标签（Extra Info） */}
          {node.extra && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-zinc-800 text-[9px] font-bold px-2 py-1 rounded border border-white/10 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-2xl uppercase tracking-tighter">
              {node.extra}
            </div>
          )}
        </div>

        {/* 子节点渲染：如果是最后一级，不需要右侧间距 */}
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col gap-3 relative">
            {/* 这里的连接线容器确保了深度嵌套时不会坍缩 */}
            <div className="flex flex-col gap-3 ml-0 shrink-0">
              {node.children.map((child, i) => (
                <div key={i} className="flex items-center">
                  <TreeNode node={child} spellDb={spellDb} onHover={onHover} />
                </div>
              ))}
            </div>
            {/* 垂直分支线 */}
            {node.children.length > 1 && (
              <div className="absolute left-6 top-5 bottom-5 w-px bg-zinc-800"></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WandEvaluator;
