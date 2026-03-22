import React, { useState } from 'react';
import { WandEditor } from './WandEditor';
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Trash2, Library, Clipboard, Scissors, Pin } from 'lucide-react';
import { getWandSpriteUrl } from '../lib/evaluatorAdapter';
import { getWandColor } from './CanvasWorkspace';
import { useTranslation } from 'react-i18next';

export function SpellDock(props: any) {
  const { activeTab, wands, isConnected, deleteWand, copyWand, copyLegacyWand, pasteWand, clipboard, saveToWarehouse } = props;
  const { t } = useTranslation();
  const [isDockMinimized, setIsDockMinimized] = useState(false);
  const [collapsedAttributes, setCollapsedAttributes] = useState<Record<string, boolean>>({});
  const [activeDockWand, setActiveDockWand] = useState<string>(wands[0] || '');

  React.useEffect(() => {
    if (!wands.includes(activeDockWand) && wands.length > 0) {
      setActiveDockWand(wands[0]);
    } else if (wands.length === 0) {
      setActiveDockWand('');
    }
  }, [wands, activeDockWand]);

  const toggleAttribute = (slot: string) => {
    setCollapsedAttributes(prev => ({ ...prev, [slot]: !prev[slot] }));
  };

  if (wands.length === 0) return null;

  const data = activeDockWand ? activeTab.wands[activeDockWand] : null;
  const isAttrsCollapsed = collapsedAttributes[activeDockWand] ?? true;

  return (
    <div className={`absolute bottom-0 left-0 right-0 z-50 flex flex-col items-center transition-transform duration-500 ${isDockMinimized ? 'translate-y-[calc(100%-48px)]' : 'translate-y-0'}`}>
      
      {/* Dock Handle / Toggle and Tabs */}
      <div className="flex items-end w-[96%] max-w-[1920px] overflow-x-auto custom-scrollbar-mini">
        <div className="flex items-center bg-black/40 backdrop-blur-md rounded-t-xl border-t border-l border-r border-white/10 px-2 pt-2 gap-1 mr-auto shrink-0">
          {wands.map((slot: string) => {
            const colorDef = getWandColor(slot);
            const wandData = activeTab.wands[slot];
            const wandName = wandData?.appearance?.name || `Wand`;
            
            return (
              <button
                key={slot}
                onClick={() => setActiveDockWand(slot)}
                className={`px-4 py-1.5 rounded-t-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-2 ${
                  activeDockWand === slot 
                  ? `bg-zinc-800 border-t border-l border-r ${colorDef.border} ${colorDef.text}` 
                  : 'bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${colorDef.bg} ${activeDockWand === slot ? colorDef.shadow : 'opacity-40'} shrink-0`}></div>
                <span className="truncate max-w-[120px]">{wandName}</span>
                <span className={`text-[8px] opacity-60 ${activeDockWand === slot ? colorDef.text : ''}`}>#{slot}</span>
              </button>
            );
          })}
        </div>

        {/* Global Toolbar for the Active Wand */}
        {activeDockWand && data && (
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-t-xl border-t border-l border-r border-white/10 px-4 py-1.5 mr-4 shrink-0">
            <button onClick={() => toggleAttribute(activeDockWand)} className="px-3 py-1 hover:bg-white/10 text-zinc-400 hover:text-white rounded flex items-center gap-2 text-[10px] uppercase font-bold transition-colors">
               {isAttrsCollapsed ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
               {isAttrsCollapsed ? t('dock.show_attributes') : t('dock.hide_attributes')}
            </button>
            <div className="w-px h-3 bg-white/10 mx-2"></div>
            <button onClick={() => copyWand(activeDockWand)} className="p-1.5 hover:bg-white/10 text-zinc-500 hover:text-indigo-400 rounded transition-colors" title={t('wand_card.copy')}><Scissors size={14} /></button>
            <button onClick={() => pasteWand(activeDockWand)} disabled={!clipboard} className={`p-1.5 rounded transition-colors ${clipboard ? 'hover:bg-white/10 text-zinc-500 hover:text-emerald-400' : 'text-zinc-800 cursor-not-allowed'}`} title={t('wand_card.paste_overwrite')}><Clipboard size={14} /></button>
            <button onClick={() => saveToWarehouse(data)} className="p-1.5 hover:bg-white/10 text-zinc-500 hover:text-purple-400 rounded transition-colors" title={t('wand_card.save_to_warehouse')}><Library size={14} /></button>
            <button onClick={() => deleteWand(activeDockWand)} className="p-1.5 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded transition-colors ml-1"><Trash2 size={14} /></button>
          </div>
        )}

        <button 
          onClick={() => setIsDockMinimized(!isDockMinimized)}
          className="glass-card hover:bg-zinc-800 border-b-0 px-6 py-2 rounded-t-xl rounded-b-none flex items-center gap-2 text-zinc-400 hover:text-white transition-all shrink-0"
        >
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isDockMinimized ? t('dock.expand') : t('dock.collapse')}
          </span>
          {isDockMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Dock Content */}
      <div 
        data-wand-target={activeDockWand || ''} 
        className={`w-[96%] max-w-[1920px] glass-panel rounded-t-3xl rounded-b-none flex flex-col max-h-[50vh] overflow-y-auto custom-scrollbar transition-colors ${activeDockWand ? `border-t-2 border-l-2 border-r-2 ${getWandColor(activeDockWand).border}` : 'border-white/10'} shadow-[0_-5px_30px_rgba(0,0,0,0.5)] border-b-0`}
      >
        {activeDockWand && data && !isDockMinimized && (
          <div className="flex flex-col relative w-full pt-2">
             <WandEditor 
               {...props}
               slot={activeDockWand}
               data={data}
               hideAttributes={isAttrsCollapsed}
               hideAlwaysCast={false}
             />
          </div>
        )}
      </div>
    </div>
  );
}
