import React, { useMemo } from 'react';
import { 
  GripVertical, 
  ArrowUpRight, 
  Edit2, 
  Tag, 
  Trash2, 
  X,
  Sparkles,
  Zap
} from 'lucide-react';
import { WarehouseWand, SpellInfo, SmartTag } from '../types';
import { getIconUrl, getWandSpriteUrl } from '../lib/evaluatorAdapter';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WarehouseWandCardProps {
  wand: WarehouseWand;
  viewMode: 'grid' | 'list';
  isMaximized: boolean;
  spellDb: Record<string, SpellInfo>;
  draggedWandId: string | null;
  dragOverWandId: string | null;
  dragOverPos: 'top' | 'bottom' | null;
  wandSmartTags: SmartTag[];
  onImport: (wand: WarehouseWand) => void;
  onRename: (wand: WarehouseWand) => void;
  onAddTag: (wand: WarehouseWand) => void;
  onDelete: (id: string) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  isConnected: boolean;
}

export const WarehouseWandCard = React.memo(({
  wand,
  viewMode,
  isMaximized,
  spellDb,
  draggedWandId,
  dragOverWandId,
  dragOverPos,
  wandSmartTags,
  onImport,
  onRename,
  onAddTag,
  onDelete,
  onUpdateTags,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isConnected
}: WarehouseWandCardProps) => {
  const { t, i18n } = useTranslation();
  
  const spellsList = useMemo(() => {
    const list: (SpellInfo | null)[] = [];
    const maxSlot = Math.max(wand.deck_capacity, ...Object.keys(wand.spells).map(Number));
    // Limit displayed spells for performance
    const limit = viewMode === 'list' ? 14 : 45; // Grid mode: increased from 20 to 45 to fill space
    
    for (let i = 0; i < Math.min(maxSlot, limit); i++) {
      const sid = wand.spells[(i + 1).toString()];
      list.push(sid ? spellDb[sid] : null);
    }
    return list;
  }, [wand.spells, wand.deck_capacity, spellDb, viewMode]);

  return (
    <div 
      className={cn(
        "group relative bg-zinc-900 border border-white/5 hover:border-purple-500/50 rounded-lg transition-all hover:bg-zinc-800 shadow-md overflow-visible select-none",
        viewMode === 'list' ? "flex items-center gap-3 p-2 h-16" : "flex flex-col p-2 gap-2 h-40", // Fixed height for Grid
        draggedWandId === wand.id && "opacity-30 grayscale",
        dragOverWandId === wand.id && "ring-2 ring-purple-500 z-10 scale-[1.02]"
      )}
      draggable
      onDragStart={(e) => onDragStart(e, wand.id)}
      onDragOver={(e) => onDragOver(e, wand.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, wand.id)}
    >
      {/* Visual Indicators for Drag Drop */}
      {dragOverWandId === wand.id && dragOverPos === 'top' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,1)] z-20" />
      )}
      {dragOverWandId === wand.id && dragOverPos === 'bottom' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,1)] z-20" />
      )}

      {/* Wand Spells Preview - Expanded */}
      <div className={cn(
        "bg-black/40 rounded border border-white/5 overflow-hidden relative transition-all",
        viewMode === 'list' ? "w-64 h-full shrink-0" : "w-full flex-1 min-h-[80px]" // Increased height for grid
      )}>
        {/* Simple Wand Graphic Placeholder or Spells */}
        {(() => {
          const spriteUrl = getWandSpriteUrl(wand.appearance, isConnected);
          return spriteUrl ? (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-20 transition-opacity duration-200 pointer-events-none">
            <img src={spriteUrl} className="w-full h-full object-contain image-pixelated p-2" alt="" />
          </div>
        ) : null;
        })()}
        <div className="absolute inset-0 flex flex-wrap content-start p-1 gap-0.5 overflow-hidden">
          {spellsList.map((spell, i) => (
            <div key={i} className="w-5 h-5 shrink-0 flex items-center justify-center relative">
               {spell ? (
                 <img src={getIconUrl(spell.icon, isConnected)} className="w-full h-full object-contain image-pixelated" alt="" />
               ) : (
                 <div className="w-full h-full bg-white/5 rounded-sm" />
               )}
            </div>
          ))}
          {wand.deck_capacity > spellsList.length && (
             <span className="text-[9px] text-zinc-600 pl-1">+{wand.deck_capacity - spellsList.length}</span>
          )}
        </div>
        
        {/* Always Cast (if any) - Small indicator */}
        {wand.always_cast && wand.always_cast.length > 0 && (
          <div className="absolute top-0 right-0 bg-blue-500/20 text-blue-300 text-[8px] px-1 rounded-bl">
             AC
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="flex-none flex flex-col justify-between gap-1 w-full">
        <div className="flex items-start justify-between gap-2 relative">
          <div className="min-w-0 w-full">
            <h3 className="text-xs font-bold text-zinc-300 truncate leading-tight group-hover:text-purple-300">
              {wand.name || t('app.notification.my_wand')}
            </h3>
            
            {/* Stats Compact - Only show on hover via CSS tooltip style overlay */}
            <div className="hidden group-hover:flex absolute top-full left-0 right-0 mt-1 bg-zinc-900/95 border border-white/10 rounded-lg p-2 flex-col gap-1 z-50 shadow-xl backdrop-blur-md pointer-events-none animate-in fade-in slide-in-from-top-1 duration-200">
               <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 border-b border-white/5 pb-1 mb-1">
                  <span>{t('settings.categories.wand')}</span>
               </div>
               <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
                  <div className="flex justify-between"><span className="text-zinc-500">{t('wand_stats.mana_max')}</span> <span className="text-cyan-400">{wand.mana_max}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">{t('wand_stats.mana_charge_speed')}</span> <span className="text-cyan-400">{wand.mana_charge_speed}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">{t('wand_stats.fire_rate_wait')}</span> <span className="text-amber-400">{wand.fire_rate_wait}s</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">{t('wand_stats.reload_time')}</span> <span className="text-green-400">{wand.reload_time}s</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">{t('wand_stats.deck_capacity')}</span> <span className="text-zinc-300">{wand.deck_capacity}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">{t('wand_stats.spread_degrees')}</span> <span className="text-zinc-300">{wand.spread_degrees}°</span></div>
               </div>
               {wand.always_cast && wand.always_cast.length > 0 && (
                  <div className="mt-1 pt-1 border-t border-white/5">
                     <span className="text-[9px] text-blue-400 block mb-0.5">{t('wand_stats.always_casts')}</span>
                     <div className="flex gap-0.5">
                        {wand.always_cast.map((sid, i) => {
                           const s = spellDb[sid];
                           const sDisplayName = s ? (i18n.language.startsWith('en') && s.en_name ? s.en_name : s.name) : sid;
                           return s ? <img key={i} src={getIconUrl(s.icon, isConnected)} className="w-4 h-4" title={sDisplayName} /> : null;
                        })}
                     </div>
                  </div>
               )}
            </div>
          </div>
        </div>

        {/* Tags - Compact Row */}
        {(wand.tags.length > 0 || wandSmartTags.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-1 h-4 overflow-hidden">
             {wandSmartTags.slice(0, 3).map(st => (
                <span key={st.id} className="text-[8px] px-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 truncate max-w-[60px]">
                  {st.name}
                </span>
             ))}
             {wand.tags.slice(0, 3).map(t => (
                <span key={t} className="text-[8px] px-1 rounded bg-zinc-800 text-zinc-400 border border-white/5 truncate max-w-[60px]">
                  #{t}
                </span>
             ))}
          </div>
        )}
      </div>
      
      {/* Actions (Hover only) */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/90 rounded-lg border border-white/10 p-0.5 backdrop-blur-sm z-20">
        <button onClick={() => onImport(wand)} className="p-1.5 hover:bg-purple-500 hover:text-white text-zinc-400 rounded transition-colors" title={t('nav.import')}>
          <ArrowUpRight size={12} />
        </button>
        <button onClick={() => onRename(wand)} className="p-1.5 hover:bg-white/20 hover:text-white text-zinc-400 rounded transition-colors" title={t('tabs.rename')}>
          <ArrowUpRight size={12} />
        </button>
        <button onClick={() => onDelete(wand.id)} className="p-1.5 hover:bg-red-500 hover:text-white text-zinc-400 rounded transition-colors" title={t('warehouse.delete')}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
});
