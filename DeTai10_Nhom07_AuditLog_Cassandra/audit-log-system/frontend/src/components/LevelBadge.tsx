import React from 'react';
import { AuditLevel } from '../types';
import { Info, AlertTriangle, AlertOctagon } from 'lucide-react';

interface LevelBadgeProps {
  level: AuditLevel | string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const LevelBadge: React.FC<LevelBadgeProps> = ({ level, showIcon = true, size = 'md' }) => {
  const lvl = (level || 'INFO').toUpperCase();

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  }[size];

  if (lvl === 'ERROR') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 tracking-wider font-semibold ${sizeClasses}`}>
        {showIcon && <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />}
        <span>ERROR</span>
      </span>
    );
  }

  if (lvl === 'WARN') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 tracking-wider font-semibold ${sizeClasses}`}>
        {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />}
        <span>WARN</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 tracking-wider font-semibold ${sizeClasses}`}>
      {showIcon && <Info className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 shrink-0" />}
      <span>INFO</span>
    </span>
  );
};
