import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Library,
  Search,
  Plus,
  Trash2,
  Edit2,
  ArrowRightLeft,
  Maximize2,
  Minimize2,
  X,
  ChevronRight,
  ChevronDown,
  Tag,
  Download,
  Upload,
  Copy,
  FolderOpen,
  Star,
  Clock,
  LayoutGrid,
  List as ListIcon,
  Filter,
  Check,
  MoreVertical,
  ArrowUpRight,
  Sparkles,
  Settings as SettingsIcon,
  ExternalLink,
  Folder,
  FolderPlus,
  GripVertical,
  SortAsc,
  Calendar
} from 'lucide-react';
import { checkPinyinFuzzy } from '../lib/searchUtils';
import { WandData, WarehouseWand, SpellInfo, SmartTag, WarehouseFolder as FolderType, AppSettings } from '../types';
import { WarehouseFolder } from './WarehouseFolder';
import { WandEditor } from './WandEditor';
import { WarehouseWandCard } from './WarehouseWandCard';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BONES_FOLDER_ID = 'bones_folder';

interface WandWarehouseProps {
  isOpen: boolean;
  onClose: () => void;
  onImportWand: (wand: WarehouseWand) => void;
  spellDb: Record<string, SpellInfo>;
  wands: WarehouseWand[];
  setWands: React.Dispatch<React.SetStateAction<WarehouseWand[]>>;
  folders: FolderType[];
  setFolders: React.Dispatch<React.SetStateAction<FolderType[]>>;
  smartTags: SmartTag[];
  setSmartTags: React.Dispatch<React.SetStateAction<SmartTag[]>>;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  isConnected: boolean;
  pullBones: () => Promise<void>;
  pushBones: () => Promise<void>;
  // WandEditor 交互 props
  selection: { wandSlot: string; indices: number[]; startIdx: number } | null;
  hoveredSlot: { wandSlot: string; idx: number; isRightHalf: boolean } | null;
  dragSource: { wandSlot: string; idx: number; sid: string } | null;
  handleSlotMouseDown: (slot: string, idx: number, isRightClick?: boolean) => void;
  handleSlotMouseUp: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent | { x: number, y: number, initialSearch?: string, rowTop?: number }) => void;
  setSelection: (s: any) => void;
}

export function WandWarehouse({
  isOpen,
  onClose,
  onImportWand,
  spellDb,
  wands,
  setWands,
  folders,
  setFolders,
  smartTags,
  setSmartTags,
  settings,
  setSettings,
  isConnected,
  pullBones,
  pushBones,
  selection,
  hoveredSlot,
  dragSource,
  handleSlotMouseDown,
  handleSlotMouseUp,
  handleSlotMouseEnter,
  handleSlotMouseMove,
  handleSlotMouseLeave,
  openPicker,
  setSelection
}: WandWarehouseProps) {
  const { t, i18n } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>('root');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  // Performance: Pagination / Infinite Scroll
  const [displayLimit, setDisplayLimit] = useState(50);

  // Tag Management
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSmartTagManagerOpen, setIsSmartTagManagerOpen] = useState(false);
  const [editingSmartTag, setEditingSmartTag] = useState<SmartTag | null>(null);
  const [spellSearchQuery, setSpellSearchQuery] = useState('');

  const [selectedWandIds, setSelectedWandIds] = useState<Set<string>>(new Set());

  // Paste Support for Smart Tag Editor
  useEffect(() => {
    if (!editingSmartTag) return;

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (!text) return;

      try {
        // Try JSON
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            setEditingSmartTag(prev => prev ? ({ ...prev, spells: json }) : null);
            return;
          } else if (json.spells && typeof json.spells === 'object') {
            const spells = Object.values(json.spells) as string[];
            setEditingSmartTag(prev => prev ? ({ ...prev, spells }) : null);
            return;
          }
        } catch { }

        // Comma separated or space separated IDs
        const ids = text.split(/[, \n]+/).map(s => s.trim()).filter(s => spellDb[s]);
        if (ids.length > 0) {
          setEditingSmartTag(prev => prev ? ({ ...prev, spells: ids }) : null);
        }
      } catch (e) { console.error('Paste failed', e); }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [editingSmartTag, spellDb]);

  // 来自全局 Picker 的法术选择回调
  useEffect(() => {
    if (!editingSmartTag) return;

    const handleSmartTagPick = (e: Event) => {
      const { wandSlot, spellIdx, spellId } = (e as CustomEvent).detail;
      const isExcluded = wandSlot.startsWith('smart-tag-exc-');

      setEditingSmartTag(prev => {
        if (!prev) return null;
        if (isExcluded) {
          const excludedSpells = [...(prev.excludedSpells || [])];
          const idx = parseInt(spellIdx) - 1;
          while (excludedSpells.length <= idx) excludedSpells.push('');
          if (spellId) excludedSpells[idx] = spellId;
          else excludedSpells[idx] = '';
          return { ...prev, excludedSpells };
        } else {
          const spells = [...prev.spells];
          const idx = parseInt(spellIdx) - 1;
          while (spells.length <= idx) spells.push('');
          if (spellId) spells[idx] = spellId;
          else spells[idx] = '';
          return { ...prev, spells };
        }
      });
    };

    window.addEventListener('twwe-smart-tag-pick', handleSmartTagPick);
    return () => window.removeEventListener('twwe-smart-tag-pick', handleSmartTagPick);
  }, [editingSmartTag]);

  // Drag & Drop
  const [draggedWandId, setDraggedWandId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null | 'root'>(null);
  const [dragOverWandId, setDragOverWandId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'top' | 'bottom' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, folderId: string | null | 'root' } | null>(null);

  // Reset display limit when folder or search changes
  useEffect(() => {
    setDisplayLimit(50);
    setSelectedWandIds(new Set());
  }, [selectedFolderId, searchQuery, selectedTags, sortBy]);

  // Handle scroll to load more
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Load more when scrolled to bottom (with 200px buffer)
    if (scrollHeight - scrollTop - clientHeight < 200) {
      setDisplayLimit(prev => prev + 50);
    }
  }, []);

  // --- Handlers ---
  const deleteWand = useCallback((id: string) => {
    const toDelete = selectedWandIds.has(id) ? Array.from(selectedWandIds) : [id];
    const message = toDelete.length > 1
      ? t('warehouse.delete_multiple_confirm', { count: toDelete.length })
      : t('warehouse.delete_wand_confirm');

    if (confirm(message)) {
      const deleteSet = new Set(toDelete);
      setWands(prev => prev.filter(w => !deleteSet.has(w.id)));
      setSelectedWandIds(prev => {
        const next = new Set(prev);
        toDelete.forEach(tid => next.delete(tid));
        return next;
      });
    }
  }, [setWands, t, selectedWandIds]);

  const updateWand = useCallback((id: string, updates: Partial<WarehouseWand>) => {
    setWands(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, [setWands]);

  const handleRenameWand = useCallback(async (wand: WarehouseWand) => {
    const newName = prompt(t('warehouse.rename_wand'), wand.name);
    if (newName) {
      let py = "", init = "";
      if (!i18n.language.startsWith('en')) {
        try {
          const res = await fetch('/api/pinyin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: newName })
          });
          const pyData = await res.json();
          if (pyData.success) {
            py = pyData.pinyin;
            init = pyData.initials;
          }
        } catch (e) { }
      }
      updateWand(wand.id, { name: newName, pinyin: py, pinyin_initials: init });
    }
  }, [updateWand, t, i18n.language]);

  const handleAddTag = useCallback((wand: WarehouseWand) => {
    const tag = prompt(t('warehouse.add_tag'));
    if (tag) updateWand(wand.id, { tags: [...wand.tags, tag] });
  }, [updateWand, t]);

  const toggleFolder = useCallback((id: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f));
  }, [setFolders]);

  const createFolder = useCallback((parentId: string | null = null) => {
    const name = prompt(t('warehouse.new_folder'));
    if (name) {
      const newFolder: FolderType = {
        id: Math.random().toString(36).substring(2, 11),
        name,
        order: folders.length,
        isOpen: true,
        parentId
      };
      setFolders(prev => [...prev, newFolder]);
      // If creating subfolder, make sure parent is open
      if (parentId) {
        setFolders(prev => prev.map(f => f.id === parentId ? { ...f, isOpen: true } : f));
      }
    }
  }, [folders.length, setFolders, t]);

  const handleWandClick = useCallback((e: React.MouseEvent, wandId: string) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedWandIds(prev => {
        const next = new Set(prev);
        if (next.has(wandId)) {
          next.delete(wandId);
        } else {
          next.add(wandId);
        }
        return next;
      });
    } else {
      setSelectedWandIds(new Set([wandId]));
    }
  }, []);

  const deleteFolder = useCallback((id: string) => {
    if (confirm(t('warehouse.delete_folder_confirm'))) {
      const getChildFolderIds = (currentFolders: FolderType[], folderId: string): string[] => {
        const children = currentFolders.filter(f => f.parentId === folderId);
        let ids = children.map(f => f.id);
        children.forEach(c => {
          ids = [...ids, ...getChildFolderIds(currentFolders, c.id)];
        });
        return ids;
      };

      const folderIdsToDelete = [id, ...getChildFolderIds(folders, id)];
      const folderIdsSet = new Set(folderIdsToDelete);

      setFolders(prev => prev.filter(f => !folderIdsSet.has(f.id)));
      setWands(prev => prev.filter(w => !w.folderId || !folderIdsSet.has(w.folderId)));
      if (selectedFolderId && folderIdsSet.has(selectedFolderId)) setSelectedFolderId('root');
    }
  }, [folders, setFolders, setWands, selectedFolderId, t]);

  const renameFolder = useCallback((id: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const newName = prompt(t('warehouse.rename_folder'), folder.name);
    if (newName) {
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    }
  }, [folders, setFolders, t]);

  const exportFolder = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const getChildFolderIds = (currentFolders: FolderType[], id: string): string[] => {
      const children = currentFolders.filter(f => f.parentId === id);
      return [id, ...children.flatMap(c => getChildFolderIds(currentFolders, c.id))];
    };

    const folderIds = getChildFolderIds(folders, folderId);
    const folderIdsSet = new Set(folderIds);

    const exportedFolders = folders.filter(f => folderIdsSet.has(f.id));
    const exportedWands = wands.filter(w => w.folderId && folderIdsSet.has(w.folderId));

    const dataStr = JSON.stringify({ wands: exportedWands, folders: exportedFolders }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wand_warehouse_folder_${folder.name}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [folders, wands]);

  // Drag & Drop Handlers
  const handleDragStart = useCallback((e: React.DragEvent, type: 'wand' | 'folder', id: string) => {
    if (type === 'wand') {
      const ids = selectedWandIds.has(id) ? Array.from(selectedWandIds) : [id];
      e.dataTransfer.setData('wandIds', JSON.stringify(ids));
      setDraggedWandId(id);
      setDraggedFolderId(null);
    } else {
      setDraggedFolderId(id);
      setDraggedWandId(null);
    }
    e.dataTransfer.setData('type', type);
    e.dataTransfer.setData('id', id);
    e.dataTransfer.effectAllowed = 'move';
  }, [selectedWandIds]);

  const handleDragOver = useCallback((e: React.DragEvent, targetType: 'wand' | 'folder' | 'root', targetId: string | null | 'root') => {
    e.preventDefault();
    e.stopPropagation();

    if (targetType === 'folder' || targetType === 'root') {
      setDragOverFolderId(targetId as any);
      setDragOverWandId(null);
      setDragOverPos(null);
    } else if (targetType === 'wand') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const isBottom = relativeY > rect.height / 2;

      setDragOverWandId(targetId);
      setDragOverPos(isBottom ? 'bottom' : 'top');

      // When dragging over a wand, we are implicitly dragging over its folder
      const targetWand = wands.find(w => w.id === targetId);
      // setDragOverFolderId(targetWand?.folderId || 'root'); // Optional: highlight background
    }
  }, [wands]);

  const handleDrop = useCallback((e: React.DragEvent, targetType: 'wand' | 'folder' | 'root', targetId: string | null | 'root') => {
    e.preventDefault();
    e.stopPropagation();

    const type = e.dataTransfer.getData('type') || (draggedWandId ? 'wand' : draggedFolderId ? 'folder' : '');
    const id = e.dataTransfer.getData('id') || draggedWandId || draggedFolderId;

    if (!id || !type) return;

    const wandIdsJson = e.dataTransfer.getData('wandIds');
    const wandIds = wandIdsJson ? JSON.parse(wandIdsJson) : [id];

    if (type === 'wand') {
      if (targetType === 'folder' || targetType === 'root') {
        const targetFolderId = targetType === 'root' ? null : targetId;
        setWands(prev => {
          const idSet = new Set(wandIds);
          const others = prev.filter(w => !idSet.has(w.id));
          const movingWands = prev.filter(w => idSet.has(w.id)).map(w => ({ ...w, folderId: targetFolderId as any }));
          return [...others, ...movingWands];
        });
        if (targetFolderId) {
          setFolders(prev => prev.map(f => f.id === targetFolderId ? { ...f, isOpen: true } : f));
        }
      } else if (targetType === 'wand') {
        if (id === targetId) return;

        setWands(prev => {
          const idSet = new Set(wandIds);
          const movingWands = prev.filter(w => idSet.has(w.id));
          if (movingWands.length === 0) return prev;

          const targetWand = prev.find(w => w.id === targetId);
          if (!targetWand) return prev;

          const others = prev.filter(w => !idSet.has(w.id));
          let targetIdx = others.findIndex(w => w.id === targetId);
          if (dragOverPos === 'bottom') targetIdx++;

          const newWands = [...others];
          const updatedMovingWands = movingWands.map(w => ({ ...w, folderId: targetWand.folderId }));
          newWands.splice(targetIdx, 0, ...updatedMovingWands);

          return newWands.map((w, i) => ({ ...w, order: i }));
        });
      }
    } else if (type === 'folder') {
      if (targetType === 'folder' || targetType === 'root') {
        if (id === targetId) return;
        const targetParentId = targetType === 'root' ? null : targetId;

        const isChildOf = (childId: string, parentId: string): boolean => {
          const child = folders.find(f => f.id === childId);
          if (!child || !child.parentId) return false;
          if (child.parentId === parentId) return true;
          return isChildOf(child.parentId, parentId);
        };

        if (targetParentId && (id === targetParentId || isChildOf(targetParentId, id))) {
          return;
        }

        setFolders(prev => {
          const draggedFolder = prev.find(f => f.id === id);
          if (!draggedFolder) return prev;

          const others = prev.filter(f => f.id !== id);
          return [...others, { ...draggedFolder, parentId: targetParentId as any }]
            .map((f, i) => ({ ...f, order: i }));
        });
        if (targetParentId) {
          setFolders(prev => prev.map(f => f.id === targetParentId ? { ...f, isOpen: true } : f));
        }
      }
    }

    setDraggedWandId(null);
    setDraggedFolderId(null);
    setDragOverFolderId(null);
    setDragOverWandId(null);
    setDragOverPos(null);
  }, [draggedWandId, draggedFolderId, folders, setFolders, setWands, dragOverPos]);

  // Bones Handlers
  const handlePullBones = useCallback(async () => {
    if (!confirm(t('warehouse.pull_bones_confirm'))) return;
    try {
      await pullBones();
      alert(t('warehouse.pull_bones_success'));
    } catch (e) { alert(t('warehouse.pull_bones_failed')); }
  }, [t, pullBones]);

  const handlePushBones = useCallback(async () => {
    if (!confirm(t('warehouse.push_bones_confirm'))) return;
    try {
      await pushBones();
      alert(t('warehouse.push_bones_success'));
    } catch (e) { alert(t('warehouse.push_bones_failed')); }
  }, [t, pushBones]);

  // --- Optimized Data Calculations ---
  const wandSmartTagsMap = useMemo(() => {
    const map: Record<string, SmartTag[]> = {};
    wands.forEach(wand => {
      const wandSpells: string[] = [];
      const maxIdx = Math.max(0, ...Object.keys(wand.spells).map(Number));
      for (let i = 1; i <= maxIdx; i++) {
        wandSpells.push(wand.spells[i.toString()] || "");
      }
      while (wandSpells.length > 0 && wandSpells[wandSpells.length - 1] === "") {
        wandSpells.pop();
      }

      map[wand.id] = smartTags.filter(st => {
        if (st.spells.length === 0 && (!st.excludedSpells || st.excludedSpells.length === 0)) return false;

        // 排除法术检查：如果魔杖包含任何排除法术，则不匹配
        if (st.excludedSpells && st.excludedSpells.length > 0) {
          if (st.excludedSpells.some(s => wandSpells.includes(s))) return false;
        }

        // 如果没有必须包含的法术，只靠排除法术就能匹配
        if (st.spells.length === 0) return true;

        if (st.mode === 'strict') {
          for (let i = 0; i <= wandSpells.length - st.spells.length; i++) {
            let match = true;
            for (let j = 0; j < st.spells.length; j++) {
              if (wandSpells[i + j] !== st.spells[j]) {
                match = false;
                break;
              }
            }
            if (match) return true;
          }
          return false;
        } else {
          return st.spells.every(s => wandSpells.includes(s));
        }
      });
    });
    return map;
  }, [wands, smartTags]);

  const getWandSmartTags = useCallback((wandId: string) => wandSmartTagsMap[wandId] || [], [wandSmartTagsMap]);

  const groupedFolders = useMemo(() => {
    const groups: Record<string, FolderType[]> = { root: [] };
    const sorted = [...folders].sort((a, b) => (a.order || 0) - (b.order || 0));
    sorted.forEach(f => {
      const parentId = f.parentId || 'root';
      if (!groups[parentId]) groups[parentId] = [];
      groups[parentId].push(f);
    });
    return groups;
  }, [folders]);

  // Filter wands based on search OR selected folder
  const displayWands = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const isEnglish = i18n.language.startsWith('en');

    // If searching, ignore folders and show all matching
    if (q) {
      return wands.filter(w => {
        const wSmartTags = getWandSmartTags(w.id);
        const wSmartTagNames = wSmartTags.map(st => st.name);
        const matchesSpellSearch = Object.values(w.spells).some(sid => {
          const s = spellDb[sid];
          if (!s) return false;
          const sName = isEnglish && s.en_name ? s.en_name : s.name;
          const matchesName = sName.toLowerCase().includes(q);
          if (matchesName) return true;
          if (!isEnglish) {
            if ((s.pinyin || "").toLowerCase().includes(q)) return true;
            if (checkPinyinFuzzy(q, (s.pinyin || "").toLowerCase(), (s.pinyin_initials || "").toLowerCase())) return true;
            if ((s.aliases || "").toLowerCase().includes(q)) return true;
            if (checkPinyinFuzzy(q, (s.alias_pinyin || "").toLowerCase(), (s.alias_initials || "").toLowerCase())) return true;
          }
          return false;
        });
        return w.name.toLowerCase().includes(q) ||
          (!isEnglish && (w.pinyin || "").toLowerCase().includes(q)) ||
          (!isEnglish && checkPinyinFuzzy(q, (w.pinyin || "").toLowerCase(), (w.pinyin_initials || "").toLowerCase())) ||
          w.tags.some(t => t.toLowerCase().includes(q)) ||
          wSmartTagNames.some(t => t.toLowerCase().includes(q)) ||
          matchesSpellSearch;
      }).sort((a, b) => b.createdAt - a.createdAt);
    }

    // Otherwise filter by selected folder
    const targetFolderId = selectedFolderId === 'root' ? null : selectedFolderId;
    let filtered = wands.filter(w => w.folderId === targetFolderId);

    if (selectedTags.length > 0) {
      filtered = filtered.filter(w => {
        const wSmartTags = getWandSmartTags(w.id);
        const wSmartTagNames = wSmartTags.map(st => st.name);
        return selectedTags.every(t => w.tags.includes(t) || wSmartTagNames.includes(t));
      });
    }

    // Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      // Default to manual order if available, else date
      if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
        return a.order - b.order;
      }
      return b.createdAt - a.createdAt;
    });
  }, [wands, searchQuery, selectedFolderId, selectedTags, sortBy, getWandSmartTags, spellDb, i18n.language]);

  // Keyboard Shortcuts for Warehouse
  useEffect(() => {
    if (!isOpen || editingSmartTag || isSmartTagManagerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Delete') {
        if (selectedWandIds.size > 0) {
          e.preventDefault();
          e.stopPropagation();
          deleteWand(Array.from(selectedWandIds)[0]);
        }
      }

      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedWandIds(new Set(displayWands.map(w => w.id)));
      }

      if (e.key === 'Escape') {
        if (selectedWandIds.size > 0) {
          setSelectedWandIds(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedWandIds, deleteWand, displayWands, editingSmartTag, isSmartTagManagerOpen]);

  const folderProps = {
    groupedFolders,
    selectedFolderId,
    draggedFolderId,
    dragOverFolderId,
    onSelect: setSelectedFolderId,
    onToggle: toggleFolder,
    onCreateSubfolder: createFolder,
    onRename: renameFolder,
    onDelete: deleteFolder,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onContextMenu: (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, folderId: id });
    },
  };

  const allManualTags = useMemo(() => {
    const tags = new Set<string>();
    wands.forEach(w => w.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [wands]);

  const allSmartTagNames = useMemo(() => {
    return smartTags.map(st => st.name).sort();
  }, [smartTags]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 bg-zinc-950/95 backdrop-blur-xl border-r border-white/10 shadow-2xl z-[400] flex flex-col transition-all duration-300",
        isMaximized ? "w-full" : "w-[900px] max-w-full"
      )}
      data-testid="warehouse-panel"
    >
      {/* Header */}
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-black/40 shrink-0">
        <div className="flex items-center gap-2">
          <Library size={18} className="text-purple-400" />
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-200">{t('warehouse.title')}</h2>
          <span className="bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
            {wands.length}
          </span>
        </div>

        {/* Top Toolbar - Search & Actions */}
        <div className="flex-1 flex items-center justify-center px-8 gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input
              type="text"
              placeholder={t('warehouse.search_placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-full pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => createFolder(selectedFolderId === 'root' ? null : selectedFolderId)}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 rounded-md text-[10px] font-bold transition-all"
              data-testid="warehouse-new-folder-top-btn"
            >
              <FolderPlus size={14} />
              {t('warehouse.new_folder')}
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={() => setSortBy('date')}
              className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", sortBy === 'date' ? "text-purple-400" : "text-zinc-500")}
              title={t('warehouse.sort_by_date')}
            >
              <Calendar size={14} />
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", sortBy === 'name' ? "text-purple-400" : "text-zinc-500")}
              title={t('warehouse.sort_by_name')}
            >
              <SortAsc size={14} />
            </button>
          </div>

          {/* Bones Folder Controls */}
          {selectedFolderId === BONES_FOLDER_ID && (
            <div className="flex items-center gap-1 bg-amber-500/10 p-1 rounded-lg border border-amber-500/20 animate-in fade-in slide-in-from-left-2 duration-300">
              <button
                onClick={handlePullBones}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded-md text-[10px] font-bold transition-all"
                title={t('warehouse.pull_bones')}
              >
                <Download size={14} />
                <span className="hidden sm:inline">{t('warehouse.pull_bones')}</span>
              </button>
              <div className="w-px h-3 bg-amber-500/20 mx-0.5" />
              <button
                onClick={handlePushBones}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded-md text-[10px] font-bold transition-all"
                title={t('warehouse.push_bones')}
              >
                <Upload size={14} />
                <span className="hidden sm:inline">{t('warehouse.push_bones')}</span>
              </button>
            </div>
          )}

        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors">
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar: Folder Tree */}
        <div className="w-60 border-r border-white/5 bg-black/20 flex flex-col">
          <div className="p-2 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider pl-2">{t('warehouse.folders')}</span>
          </div>

          <div
            className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar"
            onDragOver={(e) => handleDragOver(e, 'root', 'root')}
            onDrop={(e) => handleDrop(e, 'root', 'root')}
          >
            {/* Root Folder Item */}
            <div
              className={cn(
                "flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer transition-all mb-1",
                selectedFolderId === 'root' ? "bg-purple-600/20 text-purple-300 border border-purple-500/20" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent",
                dragOverFolderId === 'root' && "bg-indigo-500/20 border-indigo-500/50 outline-dashed outline-1 outline-indigo-500/50"
              )}
              onClick={() => setSelectedFolderId('root')}
              onDragOver={(e) => handleDragOver(e, 'root', 'root')}
              onDrop={(e) => handleDrop(e, 'root', 'root')}
            >
              <Library size={14} />
              <span className="text-xs font-bold">{t('warehouse.root_folder')}</span>
            </div>

            {groupedFolders.root?.map(folder => (
              <WarehouseFolder key={folder.id} {...folderProps} folder={folder} depth={0} />
            ))}

            <div
              className="mt-4 p-4 border border-dashed border-white/5 rounded-lg text-center text-[10px] text-zinc-600 hover:text-zinc-400 hover:border-white/10 cursor-pointer transition-colors"
              onClick={() => createFolder('root')}
              data-testid="warehouse-new-folder-sidebar-btn"
            >
              + {t('warehouse.new_folder')}
            </div>
          </div>

          {/* Smart Tag Manager Toggle in Sidebar Footer */}
          <div className="p-2 border-t border-white/5">
            <button
              onClick={() => setIsSmartTagManagerOpen(true)}
              className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-colors"
              data-testid="warehouse-manage-tags-btn"
            >
              <Sparkles size={14} /> {t('warehouse.manage_smart_tags')}
            </button>
          </div>
        </div>

        {/* Main Content: Wands Grid */}
        <div className="flex-1 flex flex-col bg-zinc-900/30">
          {/* Breadcrumb / Info Bar */}
          <div className="px-4 py-2 flex items-center gap-2 text-xs text-zinc-500 border-b border-white/5">
            <FolderOpen size={14} />
            <span className="font-bold">
              {selectedFolderId === 'root' ? t('warehouse.root_folder') : folders.find(f => f.id === selectedFolderId)?.name || '???'}
            </span>
            <span className="bg-zinc-800 px-1.5 rounded-full text-[10px]">{t('warehouse.all_wands', { count: displayWands.length })}</span>
            {selectedWandIds.size > 0 && (
              <span className="bg-purple-500/20 text-purple-400 px-1.5 rounded-full text-[10px] font-bold animate-in fade-in zoom-in-95 duration-200">
                {t('warehouse.selected_wands', { count: selectedWandIds.size })}
              </span>
            )}

            <div className="flex-1" />

            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn("p-1 rounded transition-colors", viewMode === 'grid' ? "bg-purple-500/20 text-purple-300" : "hover:bg-white/5")}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn("p-1 rounded transition-colors", viewMode === 'list' ? "bg-purple-500/20 text-purple-300" : "hover:bg-white/5")}
              >
                <ListIcon size={14} />
              </button>
            </div>
          </div>

          {/* Tags Filter Bar */}
          {(allManualTags.length > 0 || allSmartTagNames.length > 0) && (
            <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-1 items-center bg-black/10">
              <Filter size={12} className="text-zinc-600 mr-1" />
              {allSmartTagNames.map(name => (
                <button
                  key={`smart-${name}`}
                  onClick={() => setSelectedTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])}
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-bold transition-all border flex items-center gap-1",
                    selectedTags.includes(name)
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                      : "bg-zinc-800 border-white/5 text-zinc-500 hover:text-amber-400/70"
                  )}
                >
                  <Sparkles size={10} /> {name}
                </button>
              ))}
              {allManualTags.map(tag => (
                <button
                  key={`manual-${tag}`}
                  onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-bold transition-all border",
                    selectedTags.includes(tag)
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                      : "bg-zinc-800 border-white/5 text-zinc-500 hover:text-purple-400/70"
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Grid Area */}
          <div
            className="flex-1 overflow-y-auto p-4 custom-scrollbar"
            onScroll={handleScroll}
            onDragOver={(e) => handleDragOver(e, 'folder', selectedFolderId || 'root')}
            onDrop={(e) => handleDrop(e, 'folder', selectedFolderId || 'root')}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, folderId: selectedFolderId || 'root' });
            }}
            onClick={() => setSelectedWandIds(new Set())}
          >
            {displayWands.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4 opacity-50">
                <FolderOpen size={48} strokeWidth={1} />
                <p className="text-xs uppercase tracking-widest">{t('warehouse.empty_folder')}</p>
              </div>
            ) : (
              <div className={cn(
                viewMode === 'grid'
                  ? "grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]"
                  : "space-y-1"
              )}>
                {displayWands.slice(0, displayLimit).map(wand => (
                  <WarehouseWandCard
                    key={wand.id}
                    wand={wand}
                    viewMode={viewMode}
                    isMaximized={isMaximized}
                    spellDb={spellDb}
                    draggedWandId={draggedWandId}
                    dragOverWandId={dragOverWandId}
                    dragOverPos={dragOverPos}
                    wandSmartTags={getWandSmartTags(wand.id)}
                    onImport={onImportWand}
                    onRename={handleRenameWand}
                    onAddTag={handleAddTag}
                    onDelete={deleteWand}
                    onUpdateTags={(id, tags) => updateWand(id, { tags })}
                    onDragStart={(e, id) => handleDragStart(e, 'wand', id)}
                    onDragOver={(e, id) => handleDragOver(e, 'wand', id)}
                    onDragLeave={() => {
                      setDragOverWandId(null);
                      setDragOverPos(null);
                    }}
                    onDrop={(e, id) => handleDrop(e, 'wand', id)}
                    isConnected={isConnected}
                    isSelected={selectedWandIds.has(wand.id)}
                    onClick={(e) => handleWandClick(e, wand.id)} />
                ))}
              </div>
            )}
            {displayWands.length > displayLimit && (
              <div className="py-4 text-center text-[10px] text-zinc-600 italic">
                {t('warehouse.loading_more')} ({displayLimit} / {displayWands.length})
              </div>
            )}
          </div>

          {/* Footer / Actions */}
          <div className="p-3 border-t border-white/5 bg-black/20 flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (confirm(t('warehouse.import_yukimi_confirm'))) {
                    try {
                      const res = await fetch('/api/import/wand-editor');
                      const data = await res.json();
                      if (data.success) {
                        setWands(prev => [...prev, ...data.wands]);
                        setFolders(prev => [...prev, ...data.folders]);
                        alert(t('warehouse.import_success', { count: data.wands.length }));
                      } else {
                        alert('Import failed: ' + data.error);
                      }
                    } catch (e) { alert('Import error'); }
                  }
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              >
                <Download size={12} /> {t('warehouse.import_wand_editor')}
              </button>
              <button
                onClick={async () => {
                  if (confirm(t('warehouse.import_spell_lab_confirm'))) {
                    try {
                      const res = await fetch('/api/import/spell-lab');
                      const data = await res.json();
                      if (data.success) {
                        setWands(prev => [...prev, ...data.wands]);
                        setFolders(prev => [...prev, ...data.folders]);
                        alert(t('warehouse.import_success', { count: data.wands.length }));
                      } else {
                        alert('Import failed: ' + data.error);
                      }
                    } catch (e) { alert('Import error'); }
                  }
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
              >
                <Download size={12} /> {t('warehouse.import_spell_lab')}
              </button>
            </div>

            <div className="flex gap-2">
              <label className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-2">
                <Upload size={12} />
                {t('warehouse.restore')}
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const json = JSON.parse(ev.target?.result as string);
                        if (json.wands) {
                          if (confirm(t('warehouse.backup_detected', { wandCount: json.wands.length, folderCount: json.folders?.length || 0 }))) {
                            setWands(prev => [...prev, ...json.wands]);
                            if (json.folders) setFolders(prev => [...prev, ...json.folders]);
                            if (json.smartTags) setSmartTags(prev => [...prev, ...json.smartTags]);
                          } else {
                            setWands(json.wands);
                            if (json.folders) setFolders(json.folders);
                            if (json.smartTags) setSmartTags(json.smartTags);
                          }
                          alert('Import success!');
                        } else {
                          alert('Invalid backup file format');
                        }
                      } catch (err) {
                        alert('File parsing failed');
                        console.error(err);
                      }
                    };
                    reader.readAsText(file);
                    // Clear value so same file can be selected again
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                onClick={() => {
                  const dataStr = JSON.stringify({ wands, folders, smartTags }, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `wand_warehouse_backup_${new Date().toISOString().split('T')[0]}.json`;
                  link.click();
                }}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <Download size={12} />
                {t('warehouse.backup')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[1000] bg-zinc-900 border border-white/10 rounded-lg shadow-2xl py-1 w-40 overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <button
            onClick={() => createFolder(contextMenu.folderId === 'root' ? null : contextMenu.folderId)}
            className="w-full px-4 py-2 text-left text-[11px] font-bold text-zinc-300 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors"
          >
            <FolderPlus size={14} /> {t('warehouse.new_subfolder')}
          </button>
          {contextMenu.folderId !== 'root' && (
            <>
              <button
                onClick={() => exportFolder(contextMenu.folderId as string)}
                className="w-full px-4 py-2 text-left text-[11px] font-bold text-zinc-300 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Download size={14} /> {t('warehouse.export_folder')}
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button
                onClick={() => renameFolder(contextMenu.folderId as string)}
                className="w-full px-4 py-2 text-left text-[11px] font-bold text-zinc-300 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Edit2 size={14} /> {t('warehouse.rename_folder')}
              </button>
              <button
                onClick={() => deleteFolder(contextMenu.folderId as string)}
                className="w-full px-4 py-2 text-left text-[11px] font-bold text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Trash2 size={14} /> {t('warehouse.delete')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Click outside to close context menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-[900]" onClick={() => setContextMenu(null)} />
      )}

      {/* Smart Tag Manager Overlay */}
      {isSmartTagManagerOpen && (
        <div
          className="absolute inset-0 z-[500] bg-zinc-950 flex flex-col animate-in slide-in-from-bottom duration-300"
          data-testid="smart-tag-manager"
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-400" />
              <h2 className="text-sm font-black uppercase tracking-widest">{t('warehouse.smart_tags_title')}</h2>
            </div>
            <button
              onClick={() => setIsSmartTagManagerOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <button
              onClick={() => setEditingSmartTag({ id: Math.random().toString(36).substring(2, 11), name: t('warehouse.new_smart_tag'), spells: [], excludedSpells: [], mode: 'strict' })}
              className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-all"
              data-testid="smart-tag-new-btn"
            >
              <Plus size={16} /> {t('warehouse.new_smart_tag')}
            </button>

            <div className="space-y-2">
              {smartTags.length === 0 ? (
                <div className="text-center py-10 text-zinc-600 text-xs italic">
                  {t('warehouse.no_smart_tags')}
                </div>
              ) : (
                smartTags.map(st => (
                  <div key={st.id} className="bg-zinc-900 border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-200">{st.name}</span>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                          st.mode === 'strict' ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"
                        )}>
                          {st.mode === 'strict' ? t('warehouse.strict_order') : t('warehouse.contains')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const dataStr = JSON.stringify([st], null, 2);
                            const blob = new Blob([dataStr], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `smart_tag_${st.name}.json`;
                            link.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-2 hover:bg-white/5 rounded text-zinc-500 hover:text-amber-400 transition-colors"
                          title={t('warehouse.export_tag')}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => setEditingSmartTag({ ...st })}
                          className="p-2 hover:bg-white/5 rounded text-zinc-500 hover:text-white transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('warehouse.delete_smart_tag_confirm'))) {
                              setSmartTags(prev => prev.filter(t => t.id !== st.id));
                            }
                          }}
                          className="p-2 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {st.spells.map((sid, i) => {
                        const spell = spellDb[sid];
                        return (
                          <div key={i} className="w-8 h-8 bg-black/40 border border-emerald-500/20 rounded flex items-center justify-center overflow-hidden" title={spell?.name}>
                            {spell && <img src={getIconUrl(spell.icon, isConnected)} className="w-6 h-6 image-pixelated" alt="" />}
                          </div>
                        );
                      })}
                      {st.excludedSpells && st.excludedSpells.length > 0 && (
                        <>
                          <div className="w-px h-8 bg-white/10 mx-1" />
                          {st.excludedSpells.map((sid, i) => {
                            const spell = spellDb[sid];
                            return (
                              <div key={`exc-${i}`} className="w-8 h-8 bg-red-950/40 border border-red-500/30 rounded flex items-center justify-center overflow-hidden relative" title={spell?.name ? `✗ ${spell.name}` : ''}>
                                {spell && <img src={getIconUrl(spell.icon, isConnected)} className="w-6 h-6 image-pixelated opacity-60" alt="" />}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-6 h-[2px] bg-red-500/60 rotate-45" />
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-black/40 border-t border-white/10 flex gap-2">
            <label className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer">
              <Upload size={14} /> {t('warehouse.import_plans')}
              <input
                type="file"
                className="hidden"
                accept=".json"
                multiple
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;

                  const allNewTags: SmartTag[] = [];
                  for (let i = 0; i < files.length; i++) {
                    try {
                      const content = await files[i].text();
                      const data = JSON.parse(content);
                      const tags = Array.isArray(data) ? data : [data];
                      allNewTags.push(...tags);
                    } catch (err) {
                      console.error('Failed to parse file', files[i].name);
                    }
                  }

                  if (allNewTags.length > 0) {
                    setSmartTags(prev => {
                      const existingIds = new Set(prev.map(t => t.id));
                      const toAdd: SmartTag[] = [];
                      allNewTags.forEach(t => {
                        if (t.id && t.name && !existingIds.has(t.id)) {
                          toAdd.push(t);
                          existingIds.add(t.id);
                        }
                      });

                      if (toAdd.length > 0) {
                        alert(t('warehouse.import_tags_success', { count: toAdd.length }));
                        return [...prev, ...toAdd];
                      }
                      alert(t('warehouse.import_tags_none'));
                      return prev;
                    });
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <button
              onClick={() => {
                const dataStr = JSON.stringify(smartTags, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `smart_tags_backup.json`;
                link.click();
              }}
              className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white flex items-center justify-center gap-2 transition-all"
            >
              <Download size={14} /> {t('warehouse.export_plans')}
            </button>
          </div>
        </div>
      )}

      {/* Smart Tag Editor Overlay - 使用 WandEditor 复用法术编辑器的交互体验 */}
      {editingSmartTag && (() => {
        // 将智能标签的 spells 适配为 WandData 格式
        const requiredWandData: WandData = {
          mana_max: 0, mana_charge_speed: 0, reload_time: 0, fire_rate_wait: 0,
          deck_capacity: 26, shuffle_deck_when_empty: false, spread_degrees: 0,
          speed_multiplier: 1, actions_per_round: 1, always_cast: [],
          spells: editingSmartTag.spells.reduce((acc, sid, i) => {
            if (sid) acc[(i + 1).toString()] = sid;
            return acc;
          }, {} as Record<string, string>),
          spell_uses: {}
        };

        const excludedWandData: WandData = {
          mana_max: 0, mana_charge_speed: 0, reload_time: 0, fire_rate_wait: 0,
          deck_capacity: 26, shuffle_deck_when_empty: false, spread_degrees: 0,
          speed_multiplier: 1, actions_per_round: 1, always_cast: [],
          spells: (editingSmartTag.excludedSpells || []).reduce((acc, sid, i) => {
            if (sid) acc[(i + 1).toString()] = sid;
            return acc;
          }, {} as Record<string, string>),
          spell_uses: {}
        };

        // 将 WandData 更新转换回 SmartTag spells 数组
        const handleUpdateRequired = (_slot: string, updates: Partial<WandData> | ((curr: WandData) => Partial<WandData>)) => {
          const resolved = typeof updates === 'function' ? updates(requiredWandData) : updates;
          if (resolved.spells) {
            const maxIdx = Math.max(0, ...Object.keys(resolved.spells).map(Number));
            const spells: string[] = [];
            for (let i = 1; i <= maxIdx; i++) {
              spells.push(resolved.spells[i.toString()] || '');
            }
            setEditingSmartTag(prev => prev ? { ...prev, spells } : null);
          }
        };

        const handleUpdateExcluded = (_slot: string, updates: Partial<WandData> | ((curr: WandData) => Partial<WandData>)) => {
          const resolved = typeof updates === 'function' ? updates(excludedWandData) : updates;
          if (resolved.spells) {
            const maxIdx = Math.max(0, ...Object.keys(resolved.spells).map(Number));
            const excludedSpells: string[] = [];
            for (let i = 1; i <= maxIdx; i++) {
              excludedSpells.push(resolved.spells[i.toString()] || '');
            }
            setEditingSmartTag(prev => prev ? { ...prev, excludedSpells } : null);
          }
        };

        const noopEval = () => { };

        return (
          <div className="absolute inset-0 z-[600] bg-zinc-950 flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <h2 className="text-sm font-black uppercase tracking-widest">{t('warehouse.edit_smart_tag')}</h2>
              <button
                onClick={() => setEditingSmartTag(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* 标签名输入 */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('warehouse.tag_name')}</label>
                <input
                  type="text"
                  value={editingSmartTag.name}
                  onChange={e => setEditingSmartTag({ ...editingSmartTag, name: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all"
                  placeholder={t('warehouse.combination_placeholder')}
                  data-testid="smart-tag-name-input"
                />
              </div>

              {/* 匹配模式 */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('warehouse.match_mode')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditingSmartTag({ ...editingSmartTag, mode: 'strict' })}
                    className={cn(
                      "py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                      editingSmartTag.mode === 'strict'
                        ? "bg-red-500/10 border-red-500/50 text-red-400"
                        : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                    )}
                  >
                    {t('warehouse.strict_order')}
                  </button>
                  <button
                    onClick={() => setEditingSmartTag({ ...editingSmartTag, mode: 'contains' })}
                    className={cn(
                      "py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                      editingSmartTag.mode === 'contains'
                        ? "bg-blue-500/10 border-blue-500/50 text-blue-400"
                        : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                    )}
                  >
                    {t('warehouse.contains')}
                  </button>
                </div>
              </div>

              {/* 必须包含 - 使用 WandEditor */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">
                    ✓ {t('warehouse.required_spells') || '必须包含'}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-emerald-500/30 to-transparent" />
                </div>
                <div className="border border-emerald-500/10 rounded-xl overflow-hidden">
                  <WandEditor
                    slot={`smart-tag-req-${editingSmartTag.id}`}
                    data={requiredWandData}
                    spellDb={spellDb}
                    selection={selection}
                    hoveredSlot={hoveredSlot}
                    dragSource={dragSource}
                    updateWand={handleUpdateRequired}
                    handleSlotMouseDown={handleSlotMouseDown}
                    handleSlotMouseUp={handleSlotMouseUp}
                    handleSlotMouseEnter={handleSlotMouseEnter}
                    handleSlotMouseMove={handleSlotMouseMove}
                    handleSlotMouseLeave={handleSlotMouseLeave}
                    openPicker={openPicker}
                    setSelection={setSelection}
                    setSettings={setSettings}
                    requestEvaluation={noopEval}
                    settings={settings}
                    isConnected={isConnected}
                    hideAttributes
                    hideAlwaysCast
                  />
                </div>
              </div>

              {/* 不能包含 - 使用 WandEditor */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-red-500/30 to-transparent" />
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-[0.3em]">
                    ✗ {t('warehouse.excluded_spells') || '不能包含'}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-red-500/30 to-transparent" />
                </div>
                <div className="border border-red-500/10 rounded-xl overflow-hidden">
                  <WandEditor
                    slot={`smart-tag-exc-${editingSmartTag.id}`}
                    data={excludedWandData}
                    spellDb={spellDb}
                    selection={selection}
                    hoveredSlot={hoveredSlot}
                    dragSource={dragSource}
                    updateWand={handleUpdateExcluded}
                    handleSlotMouseDown={handleSlotMouseDown}
                    handleSlotMouseUp={handleSlotMouseUp}
                    handleSlotMouseEnter={handleSlotMouseEnter}
                    handleSlotMouseMove={handleSlotMouseMove}
                    handleSlotMouseLeave={handleSlotMouseLeave}
                    openPicker={openPicker}
                    setSelection={setSelection}
                    setSettings={setSettings}
                    requestEvaluation={noopEval}
                    settings={settings}
                    isConnected={isConnected}
                    hideAttributes
                    hideAlwaysCast
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-black/40 border-t border-white/10 flex gap-3">
              <button
                onClick={() => setEditingSmartTag(null)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                {t('warehouse.cancel')}
              </button>
              <button
                onClick={() => {
                  if (!editingSmartTag) return;
                  setSmartTags(prev => {
                    // Filter out empty slots when saving
                    const cleanedTag = {
                      ...editingSmartTag,
                      spells: editingSmartTag.spells.filter(s => s && s.trim() !== ""),
                      excludedSpells: (editingSmartTag.excludedSpells || []).filter(s => s && s.trim() !== "")
                    };

                    const idx = prev.findIndex(t => t.id === cleanedTag.id);
                    if (idx >= 0) {
                      const next = [...prev];
                      next[idx] = cleanedTag;
                      return next;
                    }
                    return [...prev, cleanedTag];
                  });
                  setEditingSmartTag(null);
                }}
                className="flex-[2] py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-900/20"
                data-testid="smart-tag-save-btn"
              >
                {t('warehouse.save_smart_tag')}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
