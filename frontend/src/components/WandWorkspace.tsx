import React from 'react';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WandCard } from './WandCard';
import { Tab, SpellDb, SpellArea, SpellDragSource, SpellAreaSelection, HoveredSpellSlot, WandData, AppSettings, EvalResponse } from '../types';

interface WandWorkspaceProps {
  activeTab: Tab;
  isConnected: boolean;
  spellDb: SpellDb;
  selection: SpellAreaSelection | null;
  onMoveSelection: (wandSlot: string, direction: 'next' | 'prev' | 'up' | 'down' | 'right' | 'left') => void;
  hoveredSlot: HoveredSpellSlot | null;
  dragSource: SpellDragSource | null;
  clipboard: { type: 'wand'; data: WandData } | null;
  toggleExpand: (slot: string) => void;
  deleteWand: (slot: string) => void;
  copyWand: (slot: string) => void;
  copyLegacyWand: (slot: string) => void;
  pasteWand: (slot: string) => void;
  updateWand: (slot: string, updates: Partial<WandData> | ((prev: WandData) => Partial<WandData>), actionName?: string, icons?: string[]) => void;
  requestEvaluation: (tabId: string, slot: string, wand: WandData, force?: boolean) => void;
  handleSlotMouseDown: (wandSlot: string, idx: number, isRightClick?: boolean, point?: { x: number; y: number }, area?: SpellArea) => void;
  handleSlotMouseUp: (wandSlot: string, idx: number, area?: SpellArea) => void;
  handleSlotMouseEnter: (wandSlot: string, idx: number, area?: SpellArea) => void;
  handleSlotMouseMove: (e: React.MouseEvent, wandSlot: string, idx: number, area?: SpellArea) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (wandSlot: string, spellIdx: string, e: React.MouseEvent | { x: number, y: number, initialSearch?: string }) => void;
  setSelection: (s: any) => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  evalResults: Record<string, { data: EvalResponse; id: number; loading?: boolean }>;
  settings: AppSettings;
  saveToWarehouse: (data: WandData) => void;
}

export function WandWorkspace({
  activeTab,
  isConnected,
  spellDb,
  selection,
  onMoveSelection,
  hoveredSlot,
  dragSource,
  clipboard,
  toggleExpand,
  deleteWand,
  copyWand,
  copyLegacyWand,
  pasteWand,
  updateWand,
  requestEvaluation,
  handleSlotMouseDown,
  handleSlotMouseUp,
  handleSlotMouseEnter,
  handleSlotMouseMove,
  handleSlotMouseLeave,
  openPicker,
  setSelection,
  setSettings,
  evalResults,
  settings,
  saveToWarehouse,
}: WandWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-black/40">
      {activeTab.wands && Object.entries(activeTab.wands).map(([slot, data]) => (
        <WandCard
          key={slot}
          slot={slot}
          data={data}
          activeTab={activeTab}
          isConnected={isConnected}
          spellDb={spellDb}
          selection={selection}
          onMoveSelection={(direction) => onMoveSelection(slot, direction)}
          hoveredSlot={hoveredSlot}
          dragSource={dragSource}
          clipboard={clipboard}
          toggleExpand={toggleExpand}
          deleteWand={deleteWand}
          copyWand={copyWand}
          copyLegacyWand={copyLegacyWand}
          pasteWand={pasteWand}
          updateWand={updateWand}
          requestEvaluation={requestEvaluation}
          handleSlotMouseDown={handleSlotMouseDown}
          handleSlotMouseUp={handleSlotMouseUp}
          handleSlotMouseEnter={handleSlotMouseEnter}
          handleSlotMouseMove={handleSlotMouseMove}
          handleSlotMouseLeave={handleSlotMouseLeave}
          openPicker={openPicker}
          setSelection={setSelection}
          setSettings={setSettings}
          evalData={evalResults[`${activeTab.id}-${slot}`]}
          settings={settings}
          onSaveToWarehouse={saveToWarehouse}
        />
      ))}

      {(!activeTab.wands || Object.keys(activeTab.wands).length === 0) && (
        <div className="h-64 flex flex-col items-center justify-center text-zinc-700 gap-4">
          <Activity size={32} className="opacity-20 animate-pulse" />
          <p className="font-black text-[10px] uppercase tracking-widest">{t('tabs.waiting_data')}</p>
        </div>
      )}
    </div>
  );
}
