import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  minHeight?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nothing here yet',
  message = 'Select an asset or add a market to start tracking it.',
  action,
  minHeight = 'min-h-[200px]',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-6 bg-ghost-card/40 border border-ghost-border/50 rounded-2xl ${minHeight} text-center`}>
      <div className="w-10 h-10 rounded-full bg-ghost-burgundy/30 border border-ghost-burgundyLight/40 flex items-center justify-center text-ghost-sand mb-3">
        <Database className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-bold text-ghost-textPrimary tracking-tight mb-1">
        {title}
      </h4>
      <p className="text-xs text-ghost-textMuted max-w-sm mb-4 leading-relaxed">
        {message}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
