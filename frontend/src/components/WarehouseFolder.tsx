import React, { useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Edit2,
  Trash2,
  GripVertical
} from 'lucide-react';
import { WarehouseFolder as FolderType, WarehouseWand } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WarehouseFolderProps {
  folder: FolderType;
  depth: number;
  groupedFolders: Record<string, FolderType[]>;
  selectedFolderId: string | null;
  draggedFolderId: string | null;
  dragOverFolderId: string | null | 'root';
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onCreateSubfolder: (parentId: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, type: 'wand' | 'folder', id: string) => void;
  onDragOver: (e: React.DragEvent, type: 'wand' | 'folder' | 'root', id: string | 'root') => void;
  onDrop: (e: React.DragEvent, type: 'wand' | 'folder' | 'root', id: string | 'root') => void;
  onContextMenu: (e: React.MouseEvent, folderId: string) => void;
}

export const WarehouseFolder: React.FC<WarehouseFolderProps> = React.memo((props) => {
  const {
    folder,
    depth,
    groupedFolders,
    selectedFolderId,
    draggedFolderId,
    dragOverFolderId,
    onSelect,
    onToggle,
    onCreateSubfolder,
    onRename,
    onDelete,
    onDragStart,
    onDragOver,
    onDrop,
    onContextMenu,
  } = props;

  const { t } = useTranslation();
  const isOpen = folder.isOpen;
  const childFolders = (groupedFolders[folder.id] || []);
  const isSelected = selectedFolderId === folder.id;

  return (
    <div className="select-none">
      <div
        data-testid="warehouse-folder-item"
        data-folder-name={folder.name}
        className={cn(
          "group/folder flex items-center gap-1 py-1 px-2 rounded-lg cursor-pointer transition-all border border-transparent",
          isSelected ? "bg-purple-600/20 text-purple-300 border-purple-500/20" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
          draggedFolderId === folder.id && "opacity-50",
          dragOverFolderId === folder.id && "bg-indigo-500/20 border-indigo-500/50 outline-dashed outline-1 outline-indigo-500/50"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        draggable
        onDragStart={(e) => onDragStart(e, 'folder', folder.id)}
        onClick={() => onSelect(folder.id)}
        onDragOver={(e) => onDragOver(e, 'folder', folder.id)}
        onDrop={(e) => onDrop(e, 'folder', folder.id)}
        onContextMenu={(e) => onContextMenu(e, folder.id)}
      >
        <div
          className="p-0.5 rounded hover:bg-white/10 transition-colors"
          onClick={(e) => { e.stopPropagation(); onToggle(folder.id); }}
        >
          {childFolders.length > 0 ? (
            isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : <div className="w-3" />}
        </div>

        {isOpen ? <FolderOpen size={14} className={cn(isSelected ? "text-purple-400" : "text-amber-500/80")} /> : <Folder size={14} className={cn(isSelected ? "text-purple-400" : "text-amber-500/80")} />}

        <span className="text-xs font-bold truncate flex-1">
          {folder.name}
        </span>

        <div className="opacity-0 group-hover/folder:opacity-100 flex items-center gap-0.5 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onCreateSubfolder(folder.id); }}
            className="p-1 hover:text-indigo-400 hover:bg-indigo-500/10 rounded"
            title={t('warehouse.new_subfolder')}
            data-testid="warehouse-new-subfolder-btn"
          >
            <FolderPlus size={10} />
          </button>
          {/* <button 
            onClick={(e) => { e.stopPropagation(); onRename(folder.id); }}
            className="p-1 hover:text-white hover:bg-white/10 rounded"
          >
            <Edit2 size={10} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }}
            className="p-1 hover:text-red-400 hover:bg-red-500/10 rounded"
          >
            <Trash2 size={10} />
          </button> */}
        </div>
      </div>

      {isOpen && childFolders.length > 0 && (
        <div className="mt-0.5">
          {childFolders.map(f => (
            <WarehouseFolder
              key={f.id}
              {...props}
              folder={f}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});
