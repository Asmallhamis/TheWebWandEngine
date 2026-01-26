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
import { WandData, WarehouseWand, SpellInfo, SmartTag, WarehouseFolder as FolderType, AppSettings } from '../types';
import { WarehouseFolder } from './WarehouseFolder';
import { WarehouseWandCard } from './WarehouseWandCard';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  settings
}: WandWarehouseProps) {
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
            } catch {}

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
    if (confirm('确定要删除这个魔杖存档吗？')) {
      setWands(prev => prev.filter(w => w.id !== id));
    }
  }, [setWands]);

  const updateWand = useCallback((id: string, updates: Partial<WarehouseWand>) => {
    setWands(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, [setWands]);

  const handleRenameWand = useCallback(async (wand: WarehouseWand) => {
    const newName = prompt('重命名魔杖', wand.name);
    if (newName) {
      let py = "", init = "";
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
      } catch (e) {}
      updateWand(wand.id, { name: newName, pinyin: py, pinyin_initials: init });
    }
  }, [updateWand]);

  const handleAddTag = useCallback((wand: WarehouseWand) => {
    const tag = prompt('添加标签');
    if (tag) updateWand(wand.id, { tags: [...wand.tags, tag] });
  }, [updateWand]);

  const toggleFolder = useCallback((id: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f));
  }, [setFolders]);

  const createFolder = useCallback((parentId: string | null = null) => {
    const name = prompt('输入新文件夹名称');
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
  }, [folders.length, setFolders]);

  const deleteFolder = useCallback((id: string) => {
    if (confirm('确定要删除文件夹吗？ (其中的魔杖将移至根目录)')) {
      setFolders(prev => prev.filter(f => f.id !== id));
      setWands(prev => prev.map(w => w.folderId === id ? { ...w, folderId: null } : w));
      if (selectedFolderId === id) setSelectedFolderId('root');
    }
  }, [setFolders, setWands, selectedFolderId]);

  const renameFolder = useCallback((id: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const newName = prompt('重命名文件夹', folder.name);
    if (newName) {
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    }
  }, [folders, setFolders]);

  // Drag & Drop Handlers
  const handleDragStart = useCallback((e: React.DragEvent, type: 'wand' | 'folder', id: string) => {
    if (type === 'wand') {
      setDraggedWandId(id);
      setDraggedFolderId(null);
    } else {
      setDraggedFolderId(id);
      setDraggedWandId(null);
    }
    e.dataTransfer.setData('type', type);
    e.dataTransfer.setData('id', id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

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

    if (type === 'wand') {
      if (targetType === 'folder' || targetType === 'root') {
        const targetFolderId = targetType === 'root' ? null : targetId;
        setWands(prev => {
          const others = prev.filter(w => w.id !== id);
          const movingWand = prev.find(w => w.id === id);
          if (!movingWand) return prev;
          
          return [...others, { ...movingWand, folderId: targetFolderId as any }];
        });
        if (targetFolderId) {
             setFolders(prev => prev.map(f => f.id === targetFolderId ? { ...f, isOpen: true } : f));
        }
      } else if (targetType === 'wand') {
        if (id === targetId) return;
        
        setWands(prev => {
          const movingWand = prev.find(w => w.id === id);
          if (!movingWand) return prev;
          
          const targetWand = prev.find(w => w.id === targetId);
          if (!targetWand) return prev;

          const others = prev.filter(w => w.id !== id);
          let targetIdx = others.findIndex(w => w.id === targetId);
          if (dragOverPos === 'bottom') targetIdx++;
          
          const newWands = [...others];
          newWands.splice(targetIdx, 0, { ...movingWand, folderId: targetWand.folderId });
          
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
        if (st.spells.length === 0) return false;
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
    
    // If searching, ignore folders and show all matching
    if (q) {
        return wands.filter(w => {
            const wSmartTags = getWandSmartTags(w.id);
            const wSmartTagNames = wSmartTags.map(st => st.name);
            const matchesSpellSearch = Object.values(w.spells).some(sid => {
                const s = spellDb[sid];
                if (!s) return false;
                return s.name.toLowerCase().includes(q) || 
                       (s.en_name || "").toLowerCase().includes(q);
            });
            return w.name.toLowerCase().includes(q) || 
                   (w.pinyin || "").toLowerCase().includes(q) ||
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
  }, [wands, searchQuery, selectedFolderId, selectedTags, sortBy, getWandSmartTags, spellDb]);

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
    >
      {/* Header */}
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-black/40 shrink-0">
        <div className="flex items-center gap-2">
          <Library size={18} className="text-purple-400" />
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-200">魔杖仓库</h2>
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
                    placeholder="搜索魔杖..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-full pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-purple-500/50 transition-colors"
                />
             </div>
             
             <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                <button 
                  onClick={() => createFolder(selectedFolderId === 'root' ? null : selectedFolderId)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 rounded-md text-[10px] font-bold transition-all"
                >
                  <FolderPlus size={14} />
                  新建文件夹
                </button>
                <div className="w-px h-4 bg-white/10 mx-1"/>
                <button 
                  onClick={() => setSortBy('date')}
                  className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", sortBy === 'date' ? "text-purple-400" : "text-zinc-500")}
                  title="按时间排序"
                >
                    <Calendar size={14} />
                </button>
                <button 
                  onClick={() => setSortBy('name')}
                  className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", sortBy === 'name' ? "text-purple-400" : "text-zinc-500")}
                  title="按名称排序"
                >
                    <SortAsc size={14} />
                </button>
             </div>
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
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider pl-2">文件夹</span>
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
                 <span className="text-xs font-bold">所有存档 (根目录)</span>
              </div>

              {groupedFolders.root?.map(folder => (
                <WarehouseFolder key={folder.id} {...folderProps} folder={folder} depth={0} />
              ))}
              
              <div 
                 className="mt-4 p-4 border border-dashed border-white/5 rounded-lg text-center text-[10px] text-zinc-600 hover:text-zinc-400 hover:border-white/10 cursor-pointer transition-colors"
                 onClick={() => createFolder('root')}
              >
                 + 新建文件夹
              </div>
           </div>
           
           {/* Smart Tag Manager Toggle in Sidebar Footer */}
           <div className="p-2 border-t border-white/5">
              <button 
                  onClick={() => setIsSmartTagManagerOpen(true)}
                  className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-colors"
              >
                  <Sparkles size={14} /> 管理智能标签
              </button>
           </div>
        </div>

        {/* Main Content: Wands Grid */}
        <div className="flex-1 flex flex-col bg-zinc-900/30">
            {/* Breadcrumb / Info Bar */}
            <div className="px-4 py-2 flex items-center gap-2 text-xs text-zinc-500 border-b border-white/5">
                <FolderOpen size={14} />
                <span className="font-bold">
                    {selectedFolderId === 'root' ? '根目录' : folders.find(f => f.id === selectedFolderId)?.name || '未知文件夹'}
                </span>
                <span className="bg-zinc-800 px-1.5 rounded-full text-[10px]">{displayWands.length} 个魔杖</span>
                
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
            >
               {displayWands.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4 opacity-50">
                    <FolderOpen size={48} strokeWidth={1} />
                    <p className="text-xs uppercase tracking-widest">此文件夹为空</p>
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
                       />
                    ))}
                 </div>
               )}
               {displayWands.length > displayLimit && (
                  <div className="py-4 text-center text-[10px] text-zinc-600 italic">
                     正在加载更多... ({displayLimit} / {displayWands.length})
                  </div>
               )}
            </div>
            
            {/* Footer / Actions */}
            <div className="p-3 border-t border-white/5 bg-black/20 flex items-center justify-between gap-4">
               <div className="flex gap-2">
                 <button 
                    onClick={async () => {
                      if (confirm('将尝试从 Wand Editor (Yukimi) 导入所有存档，是否继续？')) {
                        try {
                          const res = await fetch('/api/import/wand-editor');
                          const data = await res.json();
                          if (data.success) {
                            setWands(prev => [...prev, ...data.wands]);
                            setFolders(prev => [...prev, ...data.folders]);
                            alert(`成功导入 ${data.wands.length} 个法杖`);
                          } else {
                            alert('导入失败: ' + data.error);
                          }
                        } catch (e) { alert('导入出错'); }
                      }
                    }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                 >
                    <Download size={12} /> 导入 Wand Editor
                 </button>
                 <button 
                    onClick={async () => {
                        // Spell Lab import logic...
                         if (confirm('将尝试从 Spell Lab 导入所有存档，是否继续？')) {
                            try {
                              const res = await fetch('/api/import/spell-lab');
                              const data = await res.json();
                              if (data.success) {
                                setWands(prev => [...prev, ...data.wands]);
                                setFolders(prev => [...prev, ...data.folders]);
                                alert(`成功导入 ${data.wands.length} 个法杖`);
                              } else {
                                alert('导入失败: ' + data.error);
                              }
                            } catch (e) { alert('导入出错'); }
                          }
                    }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                 >
                    <Download size={12} /> 导入 Spell Lab
                 </button>
               </div>
               
               <div className="flex gap-2">
                 <label className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-2">
                    <Upload size={12} />
                    恢复
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
                                        if (confirm(`检测到备份文件。\n包含 ${json.wands.length} 个魔杖，${json.folders?.length || 0} 个文件夹。\n\n是否合并到当前仓库？(点击“取消”则完全覆盖当前仓库)`)) {
                                            setWands(prev => [...prev, ...json.wands]);
                                            if (json.folders) setFolders(prev => [...prev, ...json.folders]);
                                            if (json.smartTags) setSmartTags(prev => [...prev, ...json.smartTags]);
                                        } else {
                                            setWands(json.wands);
                                            if (json.folders) setFolders(json.folders);
                                            if (json.smartTags) setSmartTags(json.smartTags);
                                        }
                                        alert('导入成功！');
                                    } else {
                                        alert('无效的备份文件格式');
                                    }
                                } catch (err) {
                                    alert('文件解析失败');
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
                    备份
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
            <FolderPlus size={14} /> 新建子文件夹
          </button>
          {contextMenu.folderId !== 'root' && (
            <>
              <button 
                onClick={() => renameFolder(contextMenu.folderId as string)}
                className="w-full px-4 py-2 text-left text-[11px] font-bold text-zinc-300 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Edit2 size={14} /> 重命名
              </button>
              <button 
                onClick={() => deleteFolder(contextMenu.folderId as string)}
                className="w-full px-4 py-2 text-left text-[11px] font-bold text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Trash2 size={14} /> 删除
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
        <div className="absolute inset-0 z-[500] bg-zinc-950 flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-400" />
              <h2 className="text-sm font-black uppercase tracking-widest">智能标签管理</h2>
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
              onClick={() => setEditingSmartTag({ id: Math.random().toString(36).substring(2, 11), name: '新智能标签', spells: [], mode: 'strict' })}
              className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-all"
            >
              <Plus size={16} /> 新建智能标签
            </button>

            <div className="space-y-2">
              {smartTags.length === 0 ? (
                <div className="text-center py-10 text-zinc-600 text-xs italic">
                  暂无智能标签，点击上方按钮创建
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
                          {st.mode === 'strict' ? '严格连续' : '仅包含'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setEditingSmartTag({ ...st })}
                          className="p-2 hover:bg-white/5 rounded text-zinc-500 hover:text-white transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm('确定要删除这个智能标签吗？')) {
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
                          <div key={i} className="w-8 h-8 bg-black/40 border border-white/5 rounded flex items-center justify-center overflow-hidden">
                            {spell && <img src={`/api/icon/${spell.icon}`} className="w-6 h-6 image-pixelated" alt="" title={spell.name} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-black/40 border-t border-white/10 flex gap-2">
            <label className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer">
              <Upload size={14} /> 导入方案
              <input 
                type="file" 
                className="hidden" 
                accept=".json"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target?.result as string);
                      if (Array.isArray(data)) {
                        setSmartTags(prev => {
                          const existingIds = new Set(prev.map(t => t.id));
                          const filtered = data.filter(t => t.id && t.name && !existingIds.has(t.id));
                          alert(`成功导入 ${filtered.length} 个新标签`);
                          return [...prev, ...filtered];
                        });
                      } else {
                         alert('格式错误：文件内容不是智能标签数组');
                      }
                    } catch (err) { alert('导入失败: 格式不正确'); }
                  };
                  reader.readAsText(file);
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
              <Download size={14} /> 导出方案
            </button>
          </div>
        </div>
      )}

      {/* Smart Tag Editor Overlay */}
      {editingSmartTag && (
        <div className="absolute inset-0 z-[600] bg-zinc-950 flex flex-col animate-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
            <h2 className="text-sm font-black uppercase tracking-widest">编辑智能标签</h2>
            <button 
              onClick={() => setEditingSmartTag(null)}
              className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">标签名称</label>
              <input 
                type="text"
                value={editingSmartTag.name}
                onChange={e => setEditingSmartTag({ ...editingSmartTag, name: e.target.value })}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all"
                placeholder="例如: 10 10 4 2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">匹配模式</label>
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
                  严格连续 (Strict Order)
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
                  仅包含 (Contains)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                   <span>法术组合 (像编辑法杖一样编辑)</span>
                   <span className="text-zinc-700 font-normal">| 右键清除, 支持 Ctrl+V 粘贴</span>
                </label>
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-white/10 overflow-x-auto custom-scrollbar">
                 <div className="flex gap-1 min-w-max">
                    {Array.from({ length: 26 }).map((_, i) => {
                        const sid = editingSmartTag.spells[i];
                        const spell = sid ? spellDb[sid] : null;
                        return (
                            <button
                                key={i}
                                onClick={() => {
                                    // Left click currently does nothing (could implement selection)
                                    // User requested "remove confirm" to be gone or behave like wand
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    const newSpells = [...editingSmartTag.spells];
                                    while(newSpells.length <= i) newSpells.push("");
                                    newSpells[i] = "";
                                    setEditingSmartTag({ ...editingSmartTag, spells: newSpells });
                                }}
                                className={cn(
                                    "w-10 h-10 rounded border flex items-center justify-center relative group transition-all shrink-0",
                                    spell 
                                        ? "bg-zinc-800 border-zinc-600 hover:border-amber-500" 
                                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                                )}
                                title={spell?.name || "空槽位 (点击下方列表添加，右键清除)"}
                            >
                                {spell && <img src={`/api/icon/${spell.icon}`} className="w-8 h-8 image-pixelated" alt="" />}
                                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-zinc-700/50" />
                            </button>
                        );
                    })}
                 </div>
              </div>
            </div>

            {/* Simple Spell Picker inside Editor */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
                <input 
                  type="text"
                  placeholder="搜索并点击添加法术..."
                  value={spellSearchQuery}
                  className="w-full bg-zinc-900 border border-white/5 rounded-lg pl-9 pr-4 py-2 text-[10px] focus:outline-none focus:border-white/20"
                  onChange={(e) => setSpellSearchQuery(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
                {Object.values(spellDb)
                  .filter(s => {
                    const q = spellSearchQuery.toLowerCase();
                    return s.name.toLowerCase().includes(q) || 
                           (s.en_name || "").toLowerCase().includes(q);
                  })
                  .slice(0, 200)
                  .map(s => (
                  <button 
                    key={s.id}
                    onClick={() => {
                      // Find first empty slot or append
                      const currentSpells = [...editingSmartTag.spells];
                      let inserted = false;
                      for(let i=0; i<26; i++) {
                          if (!currentSpells[i]) {
                              currentSpells[i] = s.id;
                              inserted = true;
                              break;
                          }
                      }
                      if (!inserted && currentSpells.length < 26) {
                          currentSpells.push(s.id);
                      }
                      setEditingSmartTag({ ...editingSmartTag, spells: currentSpells });
                    }}
                    className="aspect-square bg-black/40 border border-white/5 rounded hover:border-amber-500/50 transition-all flex items-center justify-center group"
                    title={s.name}
                  >
                    <img src={`/api/icon/${s.icon}`} className="w-7 h-7 image-pixelated group-hover:scale-110 transition-transform" alt="" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 bg-black/40 border-t border-white/10 flex gap-3">
            <button 
              onClick={() => setEditingSmartTag(null)}
              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              取消
            </button>
            <button 
              onClick={() => {
                if (!editingSmartTag) return;
                setSmartTags(prev => {
                  // Filter out empty slots when saving
                  const cleanedTag = {
                      ...editingSmartTag,
                      spells: editingSmartTag.spells.filter(s => s && s.trim() !== "")
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
            >
              保存智能标签
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
