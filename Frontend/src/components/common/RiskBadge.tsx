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
        return 'px-2 py-0.5 text-2xs';
      case 'lg':
        return 'px-3.5 py-1.5 text-sm font-semibold';
      default:
        return 'px-2.5 py-1 text-xs';
    }
  };

  const getColorClasses = () => {
    // Risk Level mapping
    if (normalized === 'LOW' || normalized === 'LONG' || normalized.includes('BULLISH')) {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    }
    if (normalized === 'MODERATE' || normalized === 'SIDEWAYS' || normalized === 'HOLD') {
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
    }
    if (normalized === 'HIGH' || normalized === 'SHORT' || normalized.includes('BEARISH')) {
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
    }
    if (normalized === 'CRITICAL' || normalized.includes('PANIC')) {
      return 'bg-red-600/20 text-red-400 border border-red-500/50 animate-pulse';
    }
    if (normalized.includes('VOLATILITY')) {
      return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
    }
    if (normalized.includes('ACCUMULATION')) {
      return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30';
    }
    if (normalized.includes('DISTRIBUTION')) {
      return 'bg-orange-500/10 text-orange-400 border border-orange-500/30';
    }

    return 'bg-slate-800/80 text-slate-300 border border-slate-700/60';
  };

  return (
    <span
      className={`inline-flex items-center rounded-md font-mono tracking-wider uppercase ${getSizeClasses()} ${getColorClasses()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {label}
    </span>
  );
};
