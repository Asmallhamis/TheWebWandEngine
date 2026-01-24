import React from 'react';

export function CompactStat({ icon, value, label }: { icon: React.ReactNode, value: number, label: string }) {
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

export function PropInput({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div className="bg-zinc-900 px-3 py-1.5 rounded border border-white/5 hover:border-indigo-500/30 transition-colors shrink-0">
      <label className="text-[8px] font-black text-zinc-500 block mb-0.5 uppercase tracking-tighter">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="bg-transparent text-indigo-400 font-mono text-sm w-16 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}
