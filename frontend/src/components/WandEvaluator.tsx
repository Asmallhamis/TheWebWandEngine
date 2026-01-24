import React, { useState, useMemo, useEffect } from 'react';
import { EvalNode, ShotState, SpellInfo, AppSettings } from '../types';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface Props {
  data: {
    tree: EvalNode;
    states: ShotState[];
    counts: Record<string, number>;
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

const WandEvaluator: React.FC<Props> = ({ data, spellDb, onHoverSlots, settings }) => {
  const [userExpandedCasts, setUserExpandedCasts] = useState<Record<number, boolean>>({});

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
  }, [data]);

  if (!data || !data.tree) return null;

  // 将计数数据转为数组并排序
  const sortedCounts = Object.entries(data.counts || {})
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="mt-6 p-4 bg-black/40 border border-white/10 rounded-lg overflow-hidden space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Spell Counts Section */}
      {sortedCounts.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black text-zinc-500 mb-4 flex items-center gap-2 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] rounded-full"></span>
            法术放出总量统计 (Spell Counts)
          </h3>
          <div className="flex flex-wrap gap-2">
            {sortedCounts.map(([id, count]) => {
              const spell = spellDb[id];
              return (
                <div key={id} className="flex items-center gap-2 bg-zinc-900/80 border border-white/5 pl-1 pr-3 py-1 rounded-md hover:border-amber-500/30 transition-all group/count">
                  {spell ? (
                    <img src={`/api/icon/${spell.icon}`} alt={id} className="w-6 h-6 image-pixelated" />
                  ) : (
                    <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-[8px] text-zinc-500 font-mono">?</div>
                  )}
                  <div className="flex flex-col -space-y-0.5">
                    <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-tighter truncate max-w-[80px]" title={id}>
                      {spell ? spell.name : id}
                    </span>
                    <span className="text-[10px] font-black text-amber-500 font-mono">
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
        <h3 className="text-[10px] font-black text-zinc-500 mb-4 flex items-center gap-2 tracking-widest uppercase">
          <span className="w-1.5 h-1.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] rounded-full"></span>
          射击状态详情 (Shot States)
        </h3>
        <div className="space-y-6 overflow-x-auto pb-4 custom-scrollbar">
          {Array.from(new Set(data.states.map(s => s.cast))).sort((a, b) => a - b).map(castNum => (
            <div key={castNum} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-tighter">
                  Cast #{castNum}
                </span>
                <div className="h-px flex-1 bg-white/5"></div>
              </div>
              <div className="flex gap-4">
                {data.states.filter(s => s.cast === castNum).map((state) => (
                  <div 
                    key={`${state.cast}-${state.id}`} 
                    className="flex-shrink-0 w-56 p-3 bg-zinc-900/50 border border-white/5 rounded-md hover:border-blue-500/30 transition-colors group/state"
                  >
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
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tree Flowchart Section */}
      <section>
        <h3 className="text-[10px] font-black text-zinc-500 mb-4 flex items-center gap-2 tracking-widest uppercase">
          <span className="w-1.5 h-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] rounded-full"></span>
          执行流 (递归树)
        </h3>
        <div className="space-y-4">
          {data.tree.children.map((castNode, idx) => {
            const castNum = idx + 1;
            const complexity = countNodes(castNode);
            const isAutoFolded = shouldDefaultFold && castNum > 1;
            const isExpanded = userExpandedCasts[castNum] ?? !isAutoFolded;

            return (
              <div key={idx} className="bg-zinc-950/30 rounded-lg border border-white/5 overflow-hidden">
                <div 
                  className="px-4 py-2 bg-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => setUserExpandedCasts(prev => ({ ...prev, [castNum]: !isExpanded }))}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-emerald-500 uppercase">Cast #{castNum}</span>
                    <span className="text-[8px] text-zinc-600 font-mono">节点数: {complexity}</span>
                    {isAutoFolded && !userExpandedCasts[castNum] && (
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">已自动折叠</span>
                    )}
                  </div>
                  <div className="text-zinc-500">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="p-6 overflow-x-auto custom-scrollbar overflow-y-hidden">
                    <div className="w-fit flex items-start">
                      <TreeNode node={castNode} spellDb={spellDb} isRoot={true} onHover={onHoverSlots} />
                    </div>
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
