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
  const [inputValue, setInputValue] = React.useState((value ?? "").toString());
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    const stringVal = (value ?? "").toString();
    if (stringVal !== inputValue && !isFocused) {
      setInputValue(stringVal);
    }
  }, [value, isFocused, inputValue]); // Added inputValue to dependencies for accurate comparison

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    val = val.replace(/[^0-9.-]/g, '');
    if (val.indexOf('-') > 0) val = val.replace('-', '');
    const minusCount = (val.match(/-/g) || []).length;
    if (minusCount > 1) val = '-' + val.replace(/-/g, '');

    setInputValue(val);

    if (val === "" || val === "-" || val === "." || val === "-.") {
      return;
    }

    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  return (
    <div className="flex flex-col group/prop">
      <label className="text-[10px] font-black text-zinc-500 mb-1 uppercase tracking-wider transition-colors group-hover/prop:text-zinc-400">{label}</label>
      <div className="flex items-baseline gap-2 relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            setInputValue((value ?? "").toString());
          }}
          className={`bg-transparent font-mono text-xl font-bold w-24 focus:outline-none transition-opacity ${colorClass || 'text-white'} ${isFocused ? 'opacity-100' : 'opacity-0'}`}
        />
        {!isFocused && (
          <div className={`absolute inset-0 flex items-baseline gap-2 pointer-events-none font-mono text-xl font-bold ${colorClass || 'text-white'}`}>
            {value}
          </div>
        )}
        {secondaryValue && (
          <span className="text-xs font-mono text-zinc-600 italic whitespace-nowrap">{secondaryValue}</span>
        )}
      </div>
      <div className="h-0.5 w-full bg-white/5 group-hover/prop:bg-indigo-500/30 transition-colors mt-1" />
    </div>
  );
}
