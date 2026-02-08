import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, WandData, AppSettings, AppNotification, DragSource, MousePos } from '../types';

interface UseGlobalEventsProps {
  activeTab: Tab;
  activeTabId: string;
  tabs: Tab[];
  settings: AppSettings;
  spellDb: Record<string, any>;
  dragSource: DragSource | null;
  pickerConfig: any;
  notification: AppNotification | null;
  
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: (id: string) => void;
  setIsHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsWarehouseOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelection: (s: any) => void;
  setIsSelecting: (s: boolean) => void;
  setDragSource: (s: DragSource | null) => void;
  setMousePos: (p: MousePos) => void;
  setIsDraggingFile: (s: boolean) => void;
  setNotification: (n: AppNotification | null) => void;
  setTabMenu: (m: any) => void;

  selectionRef: React.MutableRefObject<any>;
  hoveredSlotRef: React.MutableRefObject<any>;
  
  importFromText: (text: string, forceTarget?: { slot: string, idx: number }) => Promise<boolean>;
  copyToClipboard: (isCut?: boolean) => Promise<void>;
  pasteFromClipboard: (forceTarget?: { slot: string, idx: number }) => Promise<boolean>;
  readMetadataFromPng: (file: File) => Promise<string | null>;
  insertEmptySlot: () => void;
  updateWand: (slot: string, updates: Partial<WandData>, actionName?: string, icons?: string[]) => void;
}

export const useGlobalEvents = ({
  activeTab,
  activeTabId,
  tabs,
  settings,
  spellDb,
  dragSource,
  pickerConfig,
  notification,
  setTabs,
  setActiveTabId,
  setIsHistoryOpen,
  setIsWarehouseOpen,
  setSelection,
  setIsSelecting,
  setDragSource,
  setMousePos,
  setIsDraggingFile,
  setNotification,
  setTabMenu,
  selectionRef,
  hoveredSlotRef,
  importFromText,
  copyToClipboard,
  pasteFromClipboard,
  readMetadataFromPng,
  insertEmptySlot,
  updateWand
}: UseGlobalEventsProps) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, setNotification]);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      setTabMenu(null);
      if (!(e.target as HTMLElement).closest('.glass-card')) {
        setSelection(null);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
      setTabMenu(null);
    };

    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [setSelection, setTabMenu]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragSource) {
        setMousePos({ x: e.clientX, y: e.clientY });
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [dragSource, setMousePos]);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsSelecting(false);
      if (dragSource) setDragSource(null);
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'h') {
          e.preventDefault();
          setIsHistoryOpen(prev => !prev);
        } else if (e.key === 'b') {
          e.preventDefault();
          setIsWarehouseOpen(prev => !prev);
        } else if (e.key === 'a') {
          const targetSlot = selectionRef.current?.wandSlot || Object.keys(activeTab.wands).find(slot => activeTab.expandedWands.has(slot));
          if (targetSlot) {
            e.preventDefault();
            const wand = activeTab.wands[targetSlot];
            if (wand) {
              const allIndices = Array.from({ length: wand.deck_capacity }, (_, i) => i + 1);
              setSelection({ wandSlot: targetSlot, indices: allIndices, startIdx: 1 });
            }
          }
        } else if (e.key === 'c') {
          e.preventDefault();
          copyToClipboard();
        } else if (e.key === 'x') {
          e.preventDefault();
          copyToClipboard(true);
        } else if (e.key === 'v') {
          e.preventDefault();
          pasteFromClipboard();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = selectionRef.current;
        const hovered = hoveredSlotRef.current;

        let targetSlot: string | null = null;
        let targetIndices: number[] = [];

        if (sel && hovered && hovered.wandSlot === sel.wandSlot && sel.indices.includes(hovered.idx)) {
          targetSlot = sel.wandSlot;
          targetIndices = sel.indices;
        } else if (hovered && hovered.wandSlot) {
          targetSlot = hovered.wandSlot;
          targetIndices = [hovered.idx];
        } else if (sel && sel.indices.length > 0) {
          targetSlot = sel.wandSlot;
          targetIndices = sel.indices;
        }

        if (targetSlot) {
          e.preventDefault();
          const wand = activeTab.wands[targetSlot];
          if (wand) {
            if (settings.deleteEmptySlots && e.key === 'Delete') {
              const indicesToRem = new Set(targetIndices.filter(i => i <= wand.deck_capacity));
              if (indicesToRem.size > 0) {
                const newSpells: Record<string, string> = {};
                const newSpellUses: Record<string, number> = {};
                let nextIdx = 1;
                for (let i = 1; i <= wand.deck_capacity; i++) {
                  if (indicesToRem.has(i)) continue;
                  if (wand.spells[i.toString()]) {
                    newSpells[nextIdx.toString()] = wand.spells[i.toString()];
                    if (wand.spell_uses?.[i.toString()] !== undefined) {
                      newSpellUses[nextIdx.toString()] = wand.spell_uses[i.toString()];
                    }
                  }
                  nextIdx++;
                }
                const newCap = Math.max(1, wand.deck_capacity - indicesToRem.size);
                updateWand(targetSlot, {
                  spells: newSpells,
                  spell_uses: newSpellUses,
                  deck_capacity: newCap
                }, t('app.notification.delete_wand_slot'));
                setSelection(null);
              }
            } else {
              const newSpells = { ...wand.spells };
              const newSpellUses = { ...(wand.spell_uses || {}) };
              targetIndices.forEach(idx => {
                delete newSpells[idx];
                delete newSpellUses[idx];
              });
              updateWand(targetSlot, { spells: newSpells, spell_uses: newSpellUses }, t('app.notification.delete_spell'));
            }
          }
        }
      } else if (e.key === ' ') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          insertEmptySlot();
        }
      }

      if (e.key === 'Escape') {
        setSelection(null);
      }
    };

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const items = Array.from(e.clipboardData?.items || []);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const metadata = await readMetadataFromPng(file);
            if (metadata && (metadata.includes('{{Wand2') || metadata.includes('{{Wand'))) {
              e.preventDefault();
              await importFromText(metadata);
              return;
            }
          }
        }
      }

      if (!isInput) {
        const text = e.clipboardData?.getData('text/plain').trim();
        if (text) {
          const success = await importFromText(text);
          if (success) e.preventDefault();
        }
      }
    };

    const handleGlobalDropEvent = async (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            const metadata = await readMetadataFromPng(file);
            if (metadata && (metadata.includes('{{Wand2') || metadata.includes('{{Wand'))) {
              await importFromText(metadata);
              setNotification({ msg: t('app.notification.imported_from_image'), type: "success" });
              continue;
            }
          }

          if (file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              try {
                const data = JSON.parse(ev.target?.result as string);
                const newTabId = Date.now().toString();
                const fileName = file.name.replace('.json', '');
                const isFullWorkflow = data && data.type === 'twwe_workflow' && data.wands;
                const wands = isFullWorkflow ? data.wands : data;

                setTabs(prev => [
                  ...prev,
                  {
                    id: newTabId,
                    name: isFullWorkflow ? (data.name || fileName) : fileName,
                    isRealtime: false,
                    wands: wands,
                    expandedWands: new Set(Object.keys(wands)),
                    past: isFullWorkflow ? (data.past || []) : [],
                    future: isFullWorkflow ? (data.future || []) : []
                  }
                ]);
                setActiveTabId(newTabId);
                setNotification({ msg: t('app.notification.imported_workflow_name', { name: fileName }), type: "success" });
              } catch (err) { console.error("Drop import failed:", err); }
            };
            reader.readAsText(file);
          }
        }
        return;
      }

      const items = Array.from(e.dataTransfer?.items || []);
      for (const item of items) {
        if (item.kind === 'string' && item.type === 'text/plain') {
          item.getAsString(async (text) => {
            const success = await importFromText(text);
            if (success) setNotification({ msg: t('app.notification.imported_from_text'), type: "success" });
          });
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDraggingFile(false);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handleGlobalPaste);
    window.addEventListener('drop', handleGlobalDropEvent);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handleGlobalPaste);
      window.removeEventListener('drop', handleGlobalDropEvent);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
    };
  }, [
    activeTab, activeTabId, settings, spellDb, dragSource, 
    setTabs, setActiveTabId, setIsHistoryOpen, setIsWarehouseOpen, setSelection, 
    setIsSelecting, setDragSource, setMousePos, setIsDraggingFile, setNotification,
    selectionRef, hoveredSlotRef, importFromText, copyToClipboard, 
    pasteFromClipboard, readMetadataFromPng, insertEmptySlot, updateWand, t
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let wandData = params.get('wand') || params.get('data');
    if (wandData) {
      if (!wandData.startsWith('{{') && !wandData.includes(',')) {
        try { wandData = atob(wandData); } catch (e) {}
      }
      setTimeout(() => {
        importFromText(wandData!);
      }, 100);
    }
  }, [importFromText]);

};
