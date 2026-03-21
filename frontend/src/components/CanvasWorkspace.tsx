import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { Tab, SpellDb, DragSource, WandData, AppSettings, EvalResponse } from '../types';
import { Activity, Frame, Navigation, Lock, Unlock, Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import WandEvaluator from './WandEvaluator';
import { SpellDock } from './SpellDock';
import { WandEditor } from './WandEditor';
import { CanvasTreeRenderer } from './CanvasTreeRenderer';

export const WAND_COLORS: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
  '1': { bg: 'bg-rose-500', border: 'border-rose-500/50', text: 'text-rose-500', shadow: 'shadow-[0_0_15px_rgba(243,62,118,0.8)]' },
  '2': { bg: 'bg-blue-500', border: 'border-blue-500/50', text: 'text-blue-500', shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.8)]' },
  '3': { bg: 'bg-emerald-500', border: 'border-emerald-500/50', text: 'text-emerald-500', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.8)]' },
  '4': { bg: 'bg-amber-500', border: 'border-amber-500/50', text: 'text-amber-500', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.8)]' },
  '5': { bg: 'bg-purple-500', border: 'border-purple-500/50', text: 'text-purple-500', shadow: 'shadow-[0_0_15px_rgba(168,85,247,0.8)]' },
};

export const getWandColor = (slot: string) => WAND_COLORS[slot] || { bg: 'bg-indigo-500', border: 'border-indigo-500/50', text: 'text-indigo-500', shadow: 'shadow-[0_0_15px_rgba(99,102,241,0.8)]' };

let globalZIndexCounter = 10;

interface CanvasWorkspaceProps {
  activeTab: Tab;
  isConnected: boolean;
  spellDb: SpellDb;
  selection: { wandSlot: string; indices: number[]; startIdx: number } | null;
  hoveredSlot: { wandSlot: string; idx: number; isRightHalf: boolean } | null;
  dragSource: DragSource | null;
  clipboard: { type: 'wand'; data: WandData } | null;
  updateWand: (slot: string, updates: Partial<WandData> | ((prev: WandData) => Partial<WandData>), actionName?: string, icons?: string[]) => void;
  requestEvaluation: (tabId: string, slot: string, wand: WandData, force?: boolean) => void;
  handleSlotMouseDown: (wandSlot: string, idx: number, isRightClick?: boolean) => void;
  handleSlotMouseUp: (wandSlot: string, idx: number) => void;
  handleSlotMouseEnter: (wandSlot: string, idx: number) => void;
  handleSlotMouseMove: (e: React.MouseEvent, wandSlot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (wandSlot: string, spellIdx: string, e: React.MouseEvent | { x: number, y: number, initialSearch?: string }) => void;
  setSelection: (s: any) => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  evalResults: Record<string, { data: EvalResponse; id: number; loading?: boolean }>;
  settings: AppSettings;
  saveToWarehouse: (data: WandData) => void;
  toggleExpand: (slot: string) => void;
  deleteWand: (slot: string) => void;
  copyWand: (slot: string) => void;
  copyLegacyWand: (slot: string) => void;
  pasteWand: (slot: string) => void;
}

interface DraggableNodeProps {
  id: string;
  defaultX: number;
  defaultY: number;
  title: string;
  subtitle?: string;
  slotIndex: string;
  colorDef: { bg: string; border: string; text: string; shadow: string };
  onRename?: (newName: string) => void;
  onPosChange?: (x: number, y: number) => void;
  headerActions?: React.ReactNode;
  updateWand?: (slot: string, updates: Partial<WandData> | ((prev: WandData) => Partial<WandData>), actionName?: string, icons?: string[]) => void;
  children: React.ReactNode;
}

const DraggableNode: React.FC<DraggableNodeProps> = ({ id, defaultX, defaultY, title, subtitle, slotIndex, colorDef, onRename, onPosChange, headerActions, children }) => {
  const controls = useControls() as any;
  const scale = controls.instance?.transformState?.scale || 1;
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [zIndex, setZIndex] = useState(() => ++globalZIndexCounter);
  const dragRef = useRef({ isDragging: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { isDragging: true, lastX: e.clientX, lastY: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = (e.clientX - dragRef.current.lastX) / scale;
    const dy = (e.clientY - dragRef.current.lastY) / scale;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setPos(p => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current.isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (onPosChange) {
      onPosChange(pos.x, pos.y);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRename) {
      setIsEditing(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      if (onRename && editValue.trim() !== title) {
        onRename(editValue.trim() || `Wand ${slotIndex}`);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(title);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onRename && editValue.trim() !== title) {
      onRename(editValue.trim() || `Wand ${slotIndex}`);
    }
  };

  const bringToFront = useCallback(() => {
    setZIndex(prev => prev === globalZIndexCounter ? prev : ++globalZIndexCounter);
  }, []);

  return (
    <div 
      id={id}
      data-wand-target={slotIndex}
      className={`absolute flex flex-col gap-4 glass-panel p-6 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] border ${colorDef.border}`}
      style={{ left: pos.x, top: pos.y, width: 'max-content', zIndex }}
      onPointerDownCapture={bringToFront}
    >
      <div 
        className="cancel-pan flex items-center gap-3 mb-2 cursor-grab active:cursor-grabbing p-2 -m-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className={`cancel-pan w-4 h-4 rounded-full ${colorDef.bg} ${colorDef.shadow}`}></div>
        {isEditing ? (
          <div className="flex items-center gap-2 mr-auto">
            <input
              autoFocus
              className={`cancel-pan bg-transparent border-none outline-none text-xl font-black ${colorDef.text} px-2 py-0 uppercase tracking-widest min-w-[150px]`}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onPointerDown={e => e.stopPropagation()}
            />
            {subtitle && (
              <span className={`text-xl font-black ${colorDef.text} opacity-50 uppercase tracking-widest pointer-events-none select-none`}>
                - {subtitle}
              </span>
            )}
          </div>
        ) : (
          <div 
            className={`cancel-pan flex items-center gap-2 text-xl font-black ${colorDef.text} px-2 py-1 uppercase tracking-widest border border-transparent hover:border-white/20 hover:bg-white/5 rounded transition-all cursor-text mr-auto`}
            onDoubleClick={handleDoubleClick}
          >
            <span>{title}</span>
            {subtitle && (
              <span className="opacity-50 pointer-events-none select-none">- {subtitle}</span>
            )}
          </div>
        )}
        {headerActions && (
          <div className="flex items-center gap-1 cancel-pan ml-2">
            {headerActions}
          </div>
        )}
      </div>
      <div className="relative">
        {children}
      </div>
      
      {/* Absolute Badge for Slot Indicator */}
      <div className={`absolute -bottom-3 -right-3 px-2 py-1 bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-wider ${colorDef.text} shadow-lg pointer-events-none opacity-50`}>
        #{slotIndex}
      </div>
    </div>
  );
};

const Navigator = ({ wands, activeTab }: { wands: string[], activeTab: Tab }) => {
  const { zoomToElement, centerView } = useControls();

  return (
    <div className="absolute top-4 left-4 z-50 glass-panel p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-zinc-400 mb-1 px-1">
        <Navigation size={14} className="text-emerald-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Navigator</span>
      </div>
      <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
        {wands.map(slot => {
          const colorDef = getWandColor(slot);
          const data = activeTab.wands[slot];
          const wandName = data?.appearance?.name || `Wand`;
          
          return (
            <button
              key={slot}
              onClick={() => {
                const el = document.getElementById(`canvas-stats-${slot}`);
                if (el) zoomToElement(el, 1, 500);
              }}
              className="flex items-center justify-between gap-4 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors border border-transparent hover:border-white/10 w-full"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colorDef.bg} ${colorDef.shadow} shrink-0`}></div>
                <span className="text-xs font-bold text-zinc-300 truncate max-w-[120px]">{wandName}</span>
              </div>
              <span className={`text-[9px] font-black opacity-50 ${colorDef.text}`}>#{slot}</span>
            </button>
          );
        })}
        {wands.length === 0 && (
          <div className="text-xs text-zinc-600 px-2 py-1">No wands</div>
        )}
      </div>
      <button
        onClick={() => {
          if (wands.length > 0) {
            const el = document.getElementById(`canvas-stats-${wands[0]}`);
            if (el) {
              zoomToElement(el, 1, 500);
              return;
            }
          }
          centerView(1, 500);
        }}
        className="mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors border border-indigo-500/20"
      >
        <Frame size={14} />
        <span className="text-[10px] font-bold uppercase">Reset View</span>
      </button>
    </div>
  );
};

const InitCamera = ({ wands, activeTabId }: { wands: string[], activeTabId: string }) => {
  const { zoomToElement } = useControls();
  const hasFocused = useRef<string | null>(null);

  useEffect(() => {
    if (wands.length > 0 && hasFocused.current !== activeTabId) {
      const firstWand = wands[0];
      // 给一点渲染时间
      setTimeout(() => {
        const el = document.getElementById(`canvas-stats-${firstWand}`);
        if (el) {
          zoomToElement(el, 1, 0); // 初始跳转不带动画，避免进入时闪烁
          hasFocused.current = activeTabId;
        }
      }, 50);
    }
  }, [wands, activeTabId, zoomToElement]);

  return null;
};

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  const { activeTab, evalResults, spellDb, settings } = props;
  const { t } = useTranslation();
  
  const wands = Object.keys(activeTab.wands || {}).sort();

  const requestedEvals = useRef<Set<string>>(new Set());

  // 自动为画布中未评估的法杖请求评估，确保树形图和统计在首次进入画布模式时自动出现
  useEffect(() => {
    wands.forEach(slot => {
      const evalKey = `${activeTab.id}-${slot}`;
      const data = activeTab.wands[slot];
      
      if (!evalResults[evalKey] && data && !requestedEvals.current.has(evalKey)) {
        requestedEvals.current.add(evalKey);
        props.requestEvaluation(activeTab.id, slot, data, false);
      }
    });
  }, [wands, activeTab.id, activeTab.wands, evalResults, props]);

  return (
    <div className="flex-1 relative overflow-hidden bg-[#050505] inset-0 absolute">
      {/* Infinite Canvas */}
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={2}
        limitToBounds={false}
        centerOnInit={true}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.1 }}
        panning={{ excluded: ['cancel-pan', 'panning-disabled'] }}
      >
        <Navigator wands={wands} activeTab={activeTab} />
        <InitCamera wands={wands} activeTabId={activeTab.id} />
        
        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
          <div className="relative w-[10000px] h-[10000px] pointer-events-none cyber-grid">
            {/* Render Nodes */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-auto">
              {wands.map((slot, index) => {
                const data = activeTab.wands[slot];
                const evalData = evalResults[`${activeTab.id}-${slot}`];
                const colorDef = getWandColor(slot);
                const wandName = data.appearance?.name || `Wand ${slot}`;
                
                const baseY = 5000 + (index * 1200) - (((wands.length - 1) * 1200) / 2); // Center the initial layout vertically

                const handlePosChange = (nodeKey: string, x: number, y: number) => {
                  props.updateWand(slot, {
                    canvas_positions: {
                      ...(data.canvas_positions || {}),
                      [nodeKey]: { x, y }
                    }
                  });
                };

                const handleRename = (newName: string) => {
                  props.updateWand(slot, {
                    appearance: {
                      ...data.appearance,
                      name: newName
                    }
                  });
                };

                return (
                  <React.Fragment key={slot}>
                    {/* Stats & States Node */}
                    <DraggableNode 
                      id={`canvas-stats-${slot}`}
                      title={wandName}
                      subtitle="Stats & Shot States"
                      slotIndex={slot}
                      colorDef={colorDef}
                      defaultX={data.canvas_positions?.stats?.x ?? 4800}
                      defaultY={data.canvas_positions?.stats?.y ?? baseY}
                      onRename={handleRename}
                      onPosChange={(x, y) => handlePosChange('stats', x, y)}
                    >
                      {evalData && evalData.loading && (
                        <div className="flex items-center gap-2 text-amber-500 animate-pulse">
                          <Activity size={16} />
                          <span className="text-sm font-black uppercase tracking-widest italic">{t('evaluator.analyzing')}</span>
                        </div>
                      )}
                      {evalData && evalData.data ? (
                        <WandEvaluator
                          data={evalData.data}
                          spellDb={spellDb}
                          settings={settings}
                          markedSlots={data.marked_slots}
                          wandSpells={data.spells}
                          deckCapacity={data.deck_capacity}
                          renderMode="stats"
                          isCanvas={true}
                        />
                      ) : (
                        <div className="text-zinc-600 italic px-4 py-8">No evaluation data. Modify wand or force analyze.</div>
                      )}
                    </DraggableNode>

                    {/* Recursive Tree Node */}
                    <DraggableNode 
                      id={`canvas-tree-${slot}`}
                      title={wandName}
                      subtitle="Recursive Tree"
                      slotIndex={slot}
                      colorDef={colorDef}
                      defaultX={data.canvas_positions?.tree?.x ?? 6100}
                      defaultY={data.canvas_positions?.tree?.y ?? baseY}
                      onRename={handleRename}
                      onPosChange={(x, y) => handlePosChange('tree', x, y)}
                    >
                      {evalData && evalData.loading && (
                        <div className="flex items-center gap-2 text-amber-500 animate-pulse mb-4">
                          <Activity size={16} />
                          <span className="text-sm font-black uppercase tracking-widest italic">{t('evaluator.analyzing')}</span>
                        </div>
                      )}
                      {evalData && evalData.data ? (
                        <div className="flex w-max h-max">
                          {(() => {
                            const absToOrdinal: Record<number, number> = {};
                            let ordinal = 1;
                            const deckCap = data.deck_capacity || 0;
                            for (let i = 1; i <= deckCap; i++) {
                              if (data.spells[i.toString()]) absToOrdinal[i] = ordinal++;
                            }

                            return (
                              <CanvasTreeRenderer
                                data={evalData.data.tree}
                                spellDb={spellDb}
                                settings={settings}
                                showIndices={settings.showIndices}
                                absoluteToOrdinal={absToOrdinal}
                                markedSlots={data.marked_slots}
                                onToggleMark={(indices) => {
                                  props.updateWand(slot, (curr: WandData) => {
                                    const marked = Array.isArray(curr.marked_slots) ? curr.marked_slots : [];
                                    const anyMarked = indices.some(idx => marked.includes(idx));
                                    let newMarked;
                                    if (anyMarked) {
                                      newMarked = marked.filter((m: number) => !indices.includes(m));
                                    } else {
                                      newMarked = [...marked, ...indices];
                                    }
                                    return { marked_slots: newMarked };
                                  });
                                }}
                              />
                            );
                          })()}
                        </div>
                      ) : (
                        !evalData?.loading && <div className="text-zinc-600 italic px-4 py-8">No evaluation data available.</div>
                      )}
                    </DraggableNode>

                    {/* Wand Attributes Node */}
                    <PinnedWandAttributes 
                      slot={slot}
                      data={data}
                      wandName={wandName}
                      colorDef={colorDef}
                      handleRename={handleRename}
                      props={props}
                      baseY={baseY}
                    />

                    {/* Spells Grid Editor Node */}
                    <PinnedWandEditor 
                      slot={slot}
                      data={data}
                      wandName={wandName}
                      colorDef={colorDef}
                      handleRename={handleRename}
                      props={props}
                      baseY={baseY}
                    />
                  </React.Fragment>
                );
              })}
              {wands.length === 0 && (
                <div className="absolute top-[5000px] left-[5000px] -translate-x-1/2 -translate-y-1/2 text-zinc-700 text-xl font-black uppercase tracking-widest glass-panel p-12 rounded-3xl flex items-center justify-center pointer-events-none">
                  Empty Workspace
                </div>
              )}
            </div>
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Bottom HUD Dock */}
      <SpellDock {...props} wands={wands} />
    </div>
  );
}

// 独立的组件来管理 Pinned Editor 本地的锁定状态
function PinnedWandEditor({ slot, data, wandName, colorDef, handleRename, props, baseY }: any) {
  const [isLockedLocal, setIsLockedLocal] = useState(true);
  const lockEnabled = props.settings.enableCanvasEditorLock;
  const isLocked = lockEnabled ? isLockedLocal : false;
  const [isEditingCells, setIsEditingCells] = useState(false);
  const cellsPerRow = data.canvas_cells_per_row ?? props.settings.defaultCanvasCellsPerRow ?? 26;
  const [cellsInput, setCellsInput] = useState(cellsPerRow.toString());
  
  return (
    <DraggableNode 
      id={`canvas-editor-${slot}`}
      title={wandName}
      subtitle="Editor"
      slotIndex={slot}
      colorDef={colorDef}
      defaultX={data.canvas_positions?.editor?.x ?? 3500}
      defaultY={data.canvas_positions?.editor?.y ?? baseY}
      onRename={handleRename}
      onPosChange={(x, y) => {
        props.updateWand(slot, {
          canvas_positions: {
            ...(data.canvas_positions || {}),
            'editor': { x, y }
          }
        });
      }}
      headerActions={
        <>
          <div 
            className="cancel-pan flex items-center bg-white/5 border border-white/10 rounded-lg px-2 h-8 text-xs font-bold text-zinc-300 hover:bg-white/10 transition-colors mx-2 cursor-text"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditingCells(true);
              setCellsInput((data.canvas_cells_per_row ?? 26).toString());
            }}
          >
            {isEditingCells ? (
              <input
                autoFocus
                type="number"
                min={1}
                max={props.settings.maxCanvasCellsPerRow ?? 100}
                className="bg-transparent border-none outline-none w-16 text-center text-indigo-300 pointer-events-auto"
                value={cellsInput}
                onChange={(e) => setCellsInput(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={() => {
                  setIsEditingCells(false);
                  let val = parseInt(cellsInput, 10);
                  if (!isNaN(val) && val > 0) {
                    val = Math.min(val, props.settings.maxCanvasCellsPerRow ?? 100);
                    props.updateWand(slot, { canvas_cells_per_row: val });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLElement).blur(); // Blur triggers save
                  } else if (e.key === 'Escape') {
                    setIsEditingCells(false);
                  }
                }}
              />
            ) : (
              <span className="select-none pointer-events-none whitespace-nowrap">每行格数: {cellsPerRow}</span>
            )}
          </div>
          {lockEnabled && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsLockedLocal(!isLockedLocal); }}
              className={`cancel-pan px-3 h-8 rounded-lg transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-widest border ${isLocked ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'} hover:bg-white/10`}
              title={isLocked ? "Unlock Editor Mode" : "Lock Editor to Drag Mode"}
            >
              {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
              {isLocked ? 'Locked' : 'Editing'}
            </button>
          )}
        </>
      }
    >
      <div className={`relative transition-opacity duration-300 w-max max-w-max min-w-[300px] ${isLocked ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        <div className="absolute inset-0 bg-transparent -m-4 pointer-events-none cancel-pan"></div>
        {/* We use an arbitrary wrapper large enough, and supply hideAttributes=true */}
        <div className={isLocked ? '' : 'cancel-pan'}>
           <WandEditor 
             {...props}
             requestEvaluation={(wand: any, force?: boolean) => props.requestEvaluation(props.activeTab.id, slot, wand, force)}
             slot={slot}
             data={data}
             hideAttributes={true}
             hideAlwaysCast={false}
             isCanvasMode={true}
          />
        </div>
      </div>
    </DraggableNode>
  );
}

function PinnedWandAttributes({ slot, data, wandName, colorDef, handleRename, props, baseY }: any) {
  return (
    <DraggableNode 
      id={`canvas-attrs-${slot}`}
      title={wandName}
      subtitle="Attributes"
      slotIndex={slot}
      colorDef={colorDef}
      defaultX={data.canvas_positions?.attrs?.x ?? 2200}
      defaultY={data.canvas_positions?.attrs?.y ?? baseY}
      onRename={handleRename}
      onPosChange={(x, y) => {
        props.updateWand(slot, {
          canvas_positions: {
            ...(data.canvas_positions || {}),
            'attrs': { x, y }
          }
        });
      }}
    >
      <div className="relative w-max max-w-max min-w-[300px] cancel-pan">
         <WandEditor 
            {...props}
            requestEvaluation={(wand: any, force?: boolean) => props.requestEvaluation(props.activeTab.id, slot, wand, force)}
            slot={slot}
           data={data}
           hideAttributes={false}
           hideSpells={true}
           hideAlwaysCast={true}
        />
      </div>
    </DraggableNode>
  );
}

