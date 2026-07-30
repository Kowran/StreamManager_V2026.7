import React, { useId } from 'react';

export type TierName = 'Iniciante' | 'Bronze' | 'Prata' | 'Ouro' | 'Diamante';

interface LevelIconProps {
  className?: string;
  style?: React.CSSProperties;
}

function SilverStarIcon({ className, style }: LevelIconProps) {
  const id = useId();
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#e8e8e8" />
          <stop offset="65%" stopColor="#b8b8b8" />
          <stop offset="100%" stopColor="#8a8a8a" />
        </linearGradient>
        <linearGradient id={`${id}-hl`} x1="6" y1="3" x2="10" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.2 L14.7 8.9 L21.8 9.4 L16.4 13.9 L18.1 20.8 L12 17.1 L5.9 20.8 L7.6 13.9 L2.2 9.4 L9.3 8.9 Z"
        fill={`url(#${id}-g)`}
        stroke="#6f6f6f"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 2.2 L14.7 8.9 L21.8 9.4 L16.4 13.9 L18.1 20.8 L12 17.1 Z"
        fill={`url(#${id}-hl)`}
      />
    </svg>
  );
}

function BronzeStarIcon({ className, style }: LevelIconProps) {
  const id = useId();
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0c79a" />
          <stop offset="40%" stopColor="#cd7f32" />
          <stop offset="75%" stopColor="#a05a1c" />
          <stop offset="100%" stopColor="#7a3f12" />
        </linearGradient>
        <linearGradient id={`${id}-hl`} x1="6" y1="3" x2="10" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe2c2" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffe2c2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.2 L14.7 8.9 L21.8 9.4 L16.4 13.9 L18.1 20.8 L12 17.1 L5.9 20.8 L7.6 13.9 L2.2 9.4 L9.3 8.9 Z"
        fill={`url(#${id}-g)`}
        stroke="#5e2f10"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 2.2 L14.7 8.9 L21.8 9.4 L16.4 13.9 L18.1 20.8 L12 17.1 Z"
        fill={`url(#${id}-hl)`}
      />
    </svg>
  );
}

function SilverShieldIcon({ className, style }: LevelIconProps) {
  const id = useId();
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#e6e6e6" />
          <stop offset="65%" stopColor="#b0b0b0" />
          <stop offset="100%" stopColor="#7e7e7e" />
        </linearGradient>
        <linearGradient id={`${id}-hl`} x1="6" y1="3" x2="11" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 2 L20 5 L20 11.2 C20 16.2 16.6 20.6 12 22.2 C7.4 20.6 4 16.2 4 11.2 L4 5 Z"
        fill={`url(#${id}-g)`}
        stroke="#6a6a6a"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 2 L20 5 L20 11.2 C20 13 19.6 14.7 18.9 16.2 L12 2 Z"
        fill={`url(#${id}-hl)`}
      />
    </svg>
  );
}

function GoldShieldIcon({ className, style }: LevelIconProps) {
  const id = useId();
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="35%" stopColor="#ffd24a" />
          <stop offset="70%" stopColor="#e0a012" />
          <stop offset="100%" stopColor="#b07808" />
        </linearGradient>
        <linearGradient id={`${id}-hl`} x1="6" y1="3" x2="11" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fffbe6" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fffbe6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 2 L20 5 L20 11.2 C20 16.2 16.6 20.6 12 22.2 C7.4 20.6 4 16.2 4 11.2 L4 5 Z"
        fill={`url(#${id}-g)`}
        stroke="#8a5e06"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 2 L20 5 L20 11.2 C20 13 19.6 14.7 18.9 16.2 L12 2 Z"
        fill={`url(#${id}-hl)`}
      />
    </svg>
  );
}

function DiamondShieldIcon({ className, style }: LevelIconProps) {
  const id = useId();
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#eaf6ff" />
          <stop offset="30%" stopColor="#9fdcff" />
          <stop offset="60%" stopColor="#4aa8ff" />
          <stop offset="100%" stopColor="#1f6fd6" />
        </linearGradient>
        <linearGradient id={`${id}-hl`} x1="6" y1="3" x2="11" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M12 2 L20 5 L20 11.2 C20 16.2 16.6 20.6 12 22.2 C7.4 20.6 4 16.2 4 11.2 L4 5 Z"
        fill={`url(#${id}-g)`}
        stroke="#15539c"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 2 L20 5 L20 11.2 C20 13 19.6 14.7 18.9 16.2 L12 2 Z"
        fill={`url(#${id}-hl)`}
      />
    </svg>
  );
}

const iconMap: Record<TierName, React.FC<LevelIconProps>> = {
  Iniciante: SilverStarIcon,
  Bronze: BronzeStarIcon,
  Prata: SilverShieldIcon,
  Ouro: GoldShieldIcon,
  Diamante: DiamondShieldIcon,
};

export function LevelIcon({ tier, className, style }: { tier: TierName; className?: string; style?: React.CSSProperties }) {
  const Cmp = iconMap[tier];
  return <Cmp className={className} style={style} />;
}

export const tierIcons = iconMap;
