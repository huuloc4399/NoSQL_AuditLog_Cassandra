import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`relative inline-flex items-center justify-center p-2 rounded-lg border transition shadow-sm ${
        theme === 'dark'
          ? 'bg-slate-900 border-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-800'
          : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
      } ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 transition-transform hover:rotate-45" aria-hidden="true" />
      ) : (
        <Moon className="w-4 h-4 transition-transform hover:-rotate-12 text-indigo-600" aria-hidden="true" />
      )}
    </button>
  );
};
