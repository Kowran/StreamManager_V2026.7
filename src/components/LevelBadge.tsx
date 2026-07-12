import React from 'react';
import { Zap, Star, Crown, Shield, Award, Flame } from 'lucide-react';

export type LevelType = 'user' | 'seller';

interface LevelBadgeProps {
  level: number;
  type?: LevelType;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function getLevelTier(level: number): { name: string; icon: typeof Star; color: string; bgColor: string; textColor: string } {
  if (level >= 900) return { name: 'Lendário', icon: Crown, color: '#f59e0b', bgColor: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-700 dark:text-amber-400' };
  if (level >= 700) return { name: 'Mestre', icon: Flame, color: '#ef4444', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400' };
  if (level >= 500) return { name: 'Elite', icon: Shield, color: '#8b5cf6', bgColor: 'bg-violet-100 dark:bg-violet-900/30', textColor: 'text-violet-700 dark:text-violet-400' };
  if (level >= 300) return { name: 'Veterano', icon: Award, color: '#3b82f6', bgColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-400' };
  if (level >= 100) return { name: 'Avançado', icon: Zap, color: '#10b981', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-400' };
  if (level >= 50) return { name: 'Intermediário', icon: Star, color: '#06b6d4', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', textColor: 'text-cyan-700 dark:text-cyan-400' };
  return { name: 'Iniciante', icon: Star, color: '#6b7280', bgColor: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-600 dark:text-gray-400' };
}

export function getLevelProgress(level: number, xp: number): { current: number; needed: number; percent: number } {
  const currentLevelXp = Math.floor(100 * Math.pow(Math.max(level - 1, 0), 1.8));
  const nextLevelXp = level >= 1000 ? currentLevelXp : Math.floor(100 * Math.pow(level, 1.8));
  const needed = nextLevelXp - currentLevelXp;
  const current = xp - currentLevelXp;
  const percent = needed > 0 ? Math.min(100, (current / needed) * 100) : 100;
  return { current, needed, percent };
}

const sizeMap = {
  xs: { badge: 'text-[10px] px-1.5 py-0.5 gap-0.5', icon: 'h-2.5 w-2.5', text: 'text-[10px]' },
  sm: { badge: 'text-xs px-2 py-0.5 gap-1', icon: 'h-3 w-3', text: 'text-xs' },
  md: { badge: 'text-sm px-2.5 py-1 gap-1', icon: 'h-4 w-4', text: 'text-sm' },
  lg: { badge: 'text-base px-3 py-1.5 gap-1.5', icon: 'h-5 w-5', text: 'text-base' },
};

export function LevelBadge({ level, type = 'user', size = 'sm', showLabel = false }: LevelBadgeProps) {
  const tier = getLevelTier(level);
  const Icon = tier.icon;
  const s = sizeMap[size];

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${s.badge} ${tier.bgColor} ${tier.textColor}`} style={{ border: `1px solid ${tier.color}40` }}>
      <Icon className={s.icon} style={{ color: tier.color }} />
      <span>Nv {level}</span>
      {showLabel && <span className="opacity-70">· {tier.name}</span>}
    </span>
  );
}

interface LevelProgressBarProps {
  level: number;
  xp: number;
  type?: LevelType;
}

export function LevelProgressBar({ level, xp, type = 'user' }: LevelProgressBarProps) {
  const tier = getLevelTier(level);
  const Icon = tier.icon;
  const progress = getLevelProgress(level, xp);
  const isMax = level >= 1000;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: `${tier.color}20` }}>
            <Icon className="h-4 w-4" style={{ color: tier.color }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-900 dark:text-white">Nível {level}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${tier.color}20`, color: tier.color }}>
                {tier.name}
              </span>
            </div>
            {!isMax ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {progress.current.toLocaleString()} / {progress.needed.toLocaleString()} XP
              </p>
            ) : (
              <p className="text-xs font-medium" style={{ color: tier.color }}>Nível máximo alcançado!</p>
            )}
          </div>
        </div>
        {!isMax && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Nv {level + 1}
          </span>
        )}
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress.percent}%`, backgroundColor: tier.color }}
        />
      </div>
    </div>
  );
}
