import React from 'react';
import { ChevronRight } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  change?: number;
  unit?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: 'default' | 'cyan' | 'sand' | 'burgundy' | 'green' | 'red' | 'amber' | 'purple';
  tooltip?: string;
  onViewDetails?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  change,
  unit,
  icon,
  badge,
  variant = 'default',
  tooltip,
  onViewDetails,
}) => {
  const getAccentBorder = () => {
    switch (variant) {
      case 'sand':
      case 'cyan':
        return 'border-ghost-sand/30 hover:border-ghost-sand/60';
      case 'burgundy':
        return 'border-ghost-burgundyLight/40 hover:border-ghost-burgundySoft';
      case 'green':
        return 'border-emerald-500/30 hover:border-emerald-500/60';
      case 'red':
        return 'border-rose-500/30 hover:border-rose-500/60';
      case 'amber':
        return 'border-amber-500/30 hover:border-amber-500/60';
      default:
        return 'border-ghost-border hover:border-ghost-borderLight';
    }
  };

  return (
    <div
      title={tooltip}
      className={`relative bg-ghost-card border ${getAccentBorder()} rounded-2xl p-5 transition-all duration-200 shadow-sm hover:bg-ghost-cardHover group flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-ghost-textMuted tracking-wide">
            {label}
          </span>
          <div className="flex items-center gap-2">
            {badge}
            {icon && <div className="text-ghost-textDim group-hover:text-ghost-sand transition-colors">{icon}</div>}
          </div>
        </div>

        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            {value}
          </span>
          {unit && <span className="text-xs text-ghost-textMuted font-medium">{unit}</span>}
        </div>
      </div>

      {(subValue || change !== undefined || onViewDetails) && (
        <div className="mt-3 pt-2.5 border-t border-ghost-border/40 flex items-center justify-between text-xs font-sans">
          <div className="flex items-center gap-2">
            {change !== undefined && (
              <span className={`inline-flex items-center font-semibold ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {change >= 0 ? '+' : ''}
                {change.toFixed(2)}%
              </span>
            )}
            {subValue && <span className="text-ghost-textMuted truncate max-w-[180px]">{subValue}</span>}
          </div>

          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="inline-flex items-center gap-1 text-xs font-medium text-ghost-sand hover:underline transition-all"
            >
              <span>Details</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
