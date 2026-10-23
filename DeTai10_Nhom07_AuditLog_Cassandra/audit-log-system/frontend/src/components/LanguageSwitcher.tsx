import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { changeLanguage } from '../i18n';

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'vi';

  const handleToggle = (lang: 'vi' | 'en') => {
    changeLanguage(lang);
  };

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-slate-800 dark:border-slate-800 border-slate-200 bg-slate-900/80 dark:bg-slate-900/80 bg-white p-0.5 text-xs shadow-sm ${className}`}
      role="group"
      aria-label="Switch language"
    >
      <div className="flex items-center pl-2 pr-1.5 text-slate-400 dark:text-slate-400">
        <Globe className="w-3.5 h-3.5" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={() => handleToggle('vi')}
        aria-label="Switch to Vietnamese"
        aria-pressed={currentLang === 'vi'}
        className={`px-2 py-1 rounded-md font-semibold text-xs transition ${
          currentLang === 'vi'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        VI
      </button>

      <button
        type="button"
        onClick={() => handleToggle('en')}
        aria-label="Switch to English"
        aria-pressed={currentLang === 'en'}
        className={`px-2 py-1 rounded-md font-semibold text-xs transition ${
          currentLang === 'en'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  );
};
