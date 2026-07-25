import React, { useState } from 'react';
import { Zap, Star, Crown, Shield, Award, Flame, ShoppingBag, X, Info, TrendingUp } from 'lucide-react';

export type LevelType = 'user' | 'seller';

interface LevelBadgeProps {
  level: number;
  type?: LevelType;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  clickable?: boolean;
  language?: string;
}

export function getLevelTier(level: number): { name: string; icon: typeof Star; color: string; bgColor: string; textColor: string } {
  if (level >= 100) return { name: 'Diamante', icon: Crown, color: '#3b82f6', bgColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-400' };
  if (level >= 50) return { name: 'Ouro', icon: Award, color: '#f59e0b', bgColor: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-700 dark:text-amber-400' };
  if (level >= 25) return { name: 'Prata', icon: Shield, color: '#94a3b8', bgColor: 'bg-slate-100 dark:bg-slate-900/30', textColor: 'text-slate-700 dark:text-slate-400' };
  if (level >= 10) return { name: 'Bronze', icon: Zap, color: '#cd7f32', bgColor: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-400' };
  return { name: 'Iniciante', icon: Star, color: '#10b981', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-400' };
}

export function getLevelProgress(level: number, xp: number): { current: number; needed: number; percent: number } {
  const currentLevelXp = Math.floor(50 * Math.pow(Math.max(level - 1, 0), 1.5));
  const nextLevelXp = level >= 100 ? currentLevelXp : Math.floor(50 * Math.pow(level, 1.5));
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

const typeLabels: Record<LevelType, { pt: string; en: string; es: string }> = {
  user: { pt: 'Comprador', en: 'Buyer', es: 'Comprador' },
  seller: { pt: 'Vendedor', en: 'Seller', es: 'Vendedor' },
};

const ALL_TIERS = [
  { name: 'Iniciante', icon: Star, color: '#10b981', min: 1 },
  { name: 'Bronze', icon: Zap, color: '#cd7f32', min: 10 },
  { name: 'Prata', icon: Shield, color: '#94a3b8', min: 25 },
  { name: 'Ouro', icon: Award, color: '#f59e0b', min: 50 },
  { name: 'Diamante', icon: Crown, color: '#3b82f6', min: 100 },
];

function LevelInfoModal({
  isOpen, onClose, level, type, language = 'pt',
}: { isOpen: boolean; onClose: () => void; level: number; type: LevelType; language?: string }) {
  const tier = getLevelTier(level);
  const lbl = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;
  const typeLabel = typeLabels[type][language as 'pt' | 'en' | 'es'] || typeLabels[type].pt;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="relative p-5 border-b border-gray-200 dark:border-gray-700" style={{ background: `linear-gradient(135deg, ${tier.color}22, ${tier.color}08)` }}>
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white/40 dark:hover:bg-gray-700/40 transition-colors">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${tier.color}25` }}>
              {type === 'seller'
                ? <ShoppingBag className="h-6 w-6" style={{ color: tier.color }} />
                : <tier.icon className="h-6 w-6" style={{ color: tier.color }} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {lbl('Sistema de Níveis', 'Level System', 'Sistema de Niveles')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {typeLabel} · {lbl('Nível', 'Level', 'Nivel')} {level} · {tier.name}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* How it works */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-gray-400" />
              {lbl('Como funciona', 'How it works', 'Cómo funciona')}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {type === 'seller'
                ? lbl(
                  'Vendedores ganham XP a cada venda concluída. Quanto mais vendas, mais XP e níveis mais altos desbloqueiam benefícios como menor comissão, destaque na loja e selo de reputação.',
                  'Sellers earn XP for each completed sale. More sales mean more XP, and higher levels unlock benefits like lower commission, store prominence, and a reputation seal.',
                  'Los vendedores gannan XP por cada venta completada. Más ventas, más XP, y los niveles más altos desbloquean beneficios como menor comisión, destacado en la tienda y un sello de reputación.'
                )
                : lbl(
                  'Compradores ganham XP a cada compra. Subir de nível desbloqueia benefícios como cashback maior, descontos exclusivos e selos de prestígio.',
                  'Buyers earn XP for each purchase. Leveling up unlocks benefits like higher cashback, exclusive discounts, and prestige badges.',
                  'Los compradores gannan XP por cada compra. Subir de nivel desbloquea beneficios como mayor cashback, descuentos exclusivos y sellos de prestigio.'
                )}
            </p>
          </div>

          {/* All tiers */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              {lbl('Faixas de nível', 'Level tiers', 'Rangos de nivel')}
            </h4>
            <div className="space-y-2">
              {ALL_TIERS.map((t) => {
                const isCurrent = tier.name === t.name;
                const isReached = level >= t.min;
                return (
                  <div
                    key={t.name}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                      isCurrent
                        ? 'border-2 bg-gray-50 dark:bg-gray-700/50'
                        : 'border-gray-100 dark:border-gray-700'
                    }`}
                    style={isCurrent ? { borderColor: `${t.color}80` } : {}}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isReached ? `${t.color}22` : 'transparent', opacity: isReached ? 1 : 0.4 }}>
                      <t.icon className="h-4 w-4" style={{ color: t.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isReached ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{t.name}</p>
                      <p className="text-xs text-gray-400">
                        {lbl(`A partir do nível ${t.min}`, `From level ${t.min}`, `Desde el nivel ${t.min}`)}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color }}>
                        {lbl('VOCÊ', 'YOU', 'TÚ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LevelBadge({ level, type = 'user', size = 'sm', showLabel = false, clickable = false, language = 'pt' }: LevelBadgeProps) {
  const [showInfo, setShowInfo] = useState(false);
  const tier = getLevelTier(level);
  const Icon = tier.icon;
  const s = sizeMap[size];

  const content = (
    <>
      {type === 'seller' ? <ShoppingBag className={s.icon} style={{ color: tier.color }} /> : <Icon className={s.icon} style={{ color: tier.color }} />}
      <span>Nv {level}</span>
      {showLabel && <span className="opacity-70">· {tier.name}</span>}
    </>
  );

  if (clickable) {
    const tooltip = language === 'pt' ? `Clique para ver como funciona o sistema de níveis` : language === 'en' ? `Click to see how the level system works` : `Haz clic para ver cómo funciona el sistema de niveles`;
    return (
      <>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          title={tooltip}
          className={`inline-flex items-center rounded-full font-semibold ${s.badge} ${tier.bgColor} ${tier.textColor} cursor-pointer hover:brightness-110 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current`}
          style={{ border: `1px solid ${tier.color}40` }}
        >
          {content}
        </button>
        <LevelInfoModal
          isOpen={showInfo}
          onClose={() => setShowInfo(false)}
          level={level}
          type={type}
          language={language}
        />
      </>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${s.badge} ${tier.bgColor} ${tier.textColor}`} style={{ border: `1px solid ${tier.color}40` }}>
      {content}
    </span>
  );
}

interface LevelProgressBarProps {
  level: number;
  xp: number;
  type?: LevelType;
  language?: string;
}

export function LevelProgressBar({ level, xp, type = 'user', language = 'pt' }: LevelProgressBarProps) {
  const tier = getLevelTier(level);
  const Icon = tier.icon;
  const progress = getLevelProgress(level, xp);
  const isMax = level >= 100;
  const typeLabel = language === 'pt' ? typeLabels[type].pt : typeLabels[type].en;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: `${tier.color}20` }}>
            {type === 'seller'
              ? <ShoppingBag className="h-4 w-4" style={{ color: tier.color }} />
              : <Icon className="h-4 w-4" style={{ color: tier.color }} />
            }
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{typeLabel}</span>
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
          style={{ width: `${progress.percent}%`, backgroundColor: '#39ff14', boxShadow: '0 0 6px #39ff14, 0 0 12px #39ff1480' }}
        />
      </div>
    </div>
  );
}
