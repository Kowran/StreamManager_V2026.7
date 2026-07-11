import React from 'react';
import { isOnline, getOnlineLabel } from '../hooks/useOnlineStatus';

interface OnlineBadgeProps {
  lastSeenAt: string | null | undefined;
  language?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function OnlineBadge({ lastSeenAt, language = 'pt', showLabel = true, size = 'sm' }: OnlineBadgeProps) {
  const online = isOnline(lastSeenAt);
  const label = getOnlineLabel(lastSeenAt, language);
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <span className="flex items-center gap-1.5">
      <span className={`${dotSize} rounded-full shrink-0 ${online ? 'bg-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.3)]' : 'bg-gray-300 dark:bg-gray-600'}`} />
      {showLabel && (
        <span className={`text-xs ${online ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
          {label}
        </span>
      )}
    </span>
  );
}
