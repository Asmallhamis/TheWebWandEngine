import React from 'react';

export function CompactStat({ icon, value, label }: { icon: React.ReactNode, value: string | number, label: string }) {
  return (
    <div className="flex flex-col min-w-[40px]">
      <div className="flex items-center gap-1 text-zinc-500">
        {icon}
        <span className="text-[8px] font-black uppercase leading-none">{label}</span>
      </div>
      <span className="text-[11px] font-mono font-bold leading-tight">{value}</span>
    </div>
  );
}

export function PropInput({ label, value, onChange, colorClass, secondaryValue }: { label: string, value: number | string, onChange: (v: number) => void, colorClass?: string, secondaryValue?: string }) {
  return (
    <div className="flex flex-col group/prop">
      <label className="text-[10px] font-black text-zinc-500 mb-1 uppercase tracking-wider transition-colors group-hover/prop:text-zinc-400">{label}</label>
      <div className="flex items-baseline gap-2">
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`bg-transparent font-mono text-xl font-bold w-24 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${colorClass || 'text-white'}`}
        />
        {secondaryValue && (
          <span className="text-xs font-mono text-zinc-600 italic whitespace-nowrap">{secondaryValue}</span>
        )}
      </div>
      <div className="h-0.5 w-full bg-white/5 group-hover/prop:bg-indigo-500/30 transition-colors mt-1" />
    </div>
  );
}
