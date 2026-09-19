import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  badge,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border/50 ${className}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-ghost-textMuted leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5">
          {actions}
        </div>
      )}
    </div>
  );
};
