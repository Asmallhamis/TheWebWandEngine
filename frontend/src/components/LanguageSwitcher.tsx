import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('zh') ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
        <Globe size={12} className="text-indigo-400" />
        {t('settings.language')}
      </label>
      <div className="flex gap-2">
        <button
          onClick={() => i18n.changeLanguage('zh')}
          className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all border ${
            i18n.language.startsWith('zh')
              ? 'bg-indigo-500/20 border-indigo-500/40 text-white'
              : 'bg-black/40 border-white/5 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          简体中文
        </button>
        <button
          onClick={() => i18n.changeLanguage('en')}
          className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all border ${
            i18n.language.startsWith('en')
              ? 'bg-indigo-500/20 border-indigo-500/40 text-white'
              : 'bg-black/40 border-white/5 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          English
        </button>
      </div>
    </div>
  );
};
