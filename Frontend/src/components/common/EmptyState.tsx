import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  minHeight?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Data Telemetry Available',
  message = 'No records match the requested asset parameters or historical window.',
  action,
  minHeight = 'min-h-[200px]',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-6 bg-ghost-card/40 border border-ghost-border/40 rounded-xl ${minHeight} text-center`}>
      <div className="w-10 h-10 rounded-full bg-ghost-border/30 flex items-center justify-center text-ghost-textMuted mb-3">
        <Database className="w-5 h-5" />
      </div>
      <h4 className="text-xs font-semibold font-mono text-ghost-textPrimary uppercase tracking-wider mb-1">
        {title}
      </h4>
      <p className="text-xs font-mono text-ghost-textMuted max-w-sm mb-4">
        {message}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};
