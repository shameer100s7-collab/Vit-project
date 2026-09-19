import React from 'react';
import { Activity } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subtext?: string;
  minHeight?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading your market data...',
  subtext = 'Updating live prices and portfolio information',
  minHeight = 'min-h-[260px]',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 bg-ghost-card/50 border border-ghost-border/60 rounded-2xl ${minHeight}`}>
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-full border-2 border-ghost-sand/20 border-t-ghost-sand animate-spin" />
        <Activity className="w-5 h-5 text-ghost-sand absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      </div>
      <p className="text-sm font-semibold text-ghost-textPrimary mb-1 tracking-normal">
        {message}
      </p>
      {subtext && <p className="text-xs text-ghost-textMuted">{subtext}</p>}
    </div>
  );
};
