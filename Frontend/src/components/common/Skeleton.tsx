import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      className={`animate-pulse rounded-lg bg-ghost-border/40 ${className}`}
    />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="p-5 rounded-2xl bg-ghost-card border border-ghost-border space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-8 w-40" />
      <div className="space-y-2 pt-2 border-t border-ghost-border/40">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
};

export const SkeletonCard = CardSkeleton;

