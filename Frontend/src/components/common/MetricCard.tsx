import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  change?: number;
  unit?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: 'default' | 'cyan' | 'green' | 'red' | 'amber' | 'purple';
  tooltip?: string;
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
}) => {
  const getBorderColor = () => {
    switch (variant) {
      case 'cyan':
        return 'border-ghost-cyan/40 hover:border-ghost-cyan';
      case 'green':
        return 'border-ghost-green/40 hover:border-ghost-green';
      case 'red':
        return 'border-ghost-red/40 hover:border-ghost-red';
      case 'amber':
        return 'border-ghost-amber/40 hover:border-ghost-amber';
      case 'purple':
        return 'border-ghost-purple/40 hover:border-ghost-purple';
      default:
        return 'border-ghost-border hover:border-ghost-borderLight';
    }
  };

  return (
    <div
      title={tooltip}
      className={`relative bg-ghost-card border ${getBorderColor()} rounded-xl p-5 transition-all duration-200 shadow-lg hover:shadow-xl hover:bg-ghost-cardHover group`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-ghost-textMuted font-mono">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {badge}
          {icon && <div className="text-ghost-textMuted group-hover:text-ghost-cyan transition-colors">{icon}</div>}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono text-ghost-textPrimary tracking-tight">
          {value}
        </span>
        {unit && <span className="text-xs font-mono text-ghost-textMuted">{unit}</span>}
      </div>

      {(subValue || change !== undefined) && (
        <div className="mt-2 flex items-center gap-2 text-xs font-mono">
          {change !== undefined && (
            <span className={`inline-flex items-center font-semibold ${change >= 0 ? 'text-ghost-green' : 'text-ghost-red'}`}>
              {change >= 0 ? '▲ +' : '▼ '}
              {change.toFixed(2)}%
            </span>
          )}
          {subValue && <span className="text-ghost-textMuted truncate">{subValue}</span>}
        </div>
      )}
    </div>
  );
};
