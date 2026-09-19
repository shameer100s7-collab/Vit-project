import React from 'react';

interface BadgeProps {
  label: string;
  variant?: 'risk' | 'state' | 'signal' | 'default';
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<BadgeProps> = ({ label, size = 'md' }) => {
  const normalized = label?.toUpperCase() || 'UNKNOWN';

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-0.5 text-[11px] font-medium';
      case 'lg':
        return 'px-3.5 py-1.5 text-sm font-semibold';
      default:
        return 'px-2.5 py-1 text-xs font-medium';
    }
  };

  const getColorClasses = () => {
    if (normalized === 'LOW' || normalized === 'LONG' || normalized.includes('BULLISH')) {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
    if (normalized === 'MODERATE' || normalized === 'SIDEWAYS' || normalized === 'NEUTRAL' || normalized === 'HOLD') {
      return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
    }
    if (normalized === 'HIGH' || normalized === 'SHORT' || normalized.includes('BEARISH')) {
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    }
    if (normalized === 'CRITICAL' || normalized.includes('PANIC')) {
      return 'bg-rose-600/20 text-rose-300 border border-rose-500/40';
    }
    if (normalized.includes('ACCUMULATION') || normalized.includes('EXPANDING')) {
      return 'bg-ghost-burgundy/40 text-ghost-sand border border-ghost-burgundyLight';
    }
    if (normalized.includes('DISTRIBUTION')) {
      return 'bg-orange-500/10 text-orange-300 border border-orange-500/20';
    }

    return 'bg-ghost-card text-ghost-textMuted border border-ghost-border';
  };

  const humanized = 
    normalized === 'BULLISH_TREND' ? 'Positive' :
    normalized === 'BEARISH_TREND' ? 'Negative' :
    normalized === 'SIDEWAYS' ? 'Neutral' :
    label.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center rounded-lg font-sans transition-colors ${getSizeClasses()} ${getColorClasses()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {humanized}
    </span>
  );
};
