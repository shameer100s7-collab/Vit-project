import React, { useEffect, useState } from 'react';
import { healthApi } from '../../api/health';
import { HealthResponse } from '../../types';

export const ApiStatusBadge: React.FC<{ refreshIntervalMs?: number }> = ({
  refreshIntervalMs = 30000,
}) => {
  const [status, setStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const checkHealth = async () => {
    const start = performance.now();
    try {
      const res = await healthApi.getApiHealth();
      const elapsed = Math.round(performance.now() - start);
      setHealth(res.data);
      setLatency(elapsed);
      setStatus(res.data.status === 'healthy' ? 'online' : 'offline');
    } catch {
      setStatus('offline');
      setLatency(null);
      setHealth(null);
    }
  };

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refreshIntervalMs]);

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-ghost-darkest border border-ghost-border/80 text-xs font-mono shadow-inner cursor-pointer hover:border-ghost-borderLight transition-colors"
      onClick={checkHealth}
      title="Click to probe GHOST Backend Health"
    >
      <span className="relative flex h-2 w-2">
        {status === 'online' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            status === 'online'
              ? 'bg-emerald-500'
              : status === 'checking'
              ? 'bg-amber-500 animate-pulse'
              : 'bg-rose-500'
          }`}
        />
      </span>

      <span className="font-semibold text-ghost-textPrimary uppercase tracking-wider text-2xs">
        {status === 'online' ? 'API ONLINE' : status === 'checking' ? 'PROBING...' : 'API OFFLINE'}
      </span>

      {latency !== null && (
        <span className="text-2xs text-ghost-textMuted border-l border-ghost-border pl-1.5 font-mono">
          {latency}ms
        </span>
      )}

      {health?.database && (
        <span className="text-2xs text-ghost-cyan/80 border-l border-ghost-border pl-1.5 font-mono">
          DB {health.database}
        </span>
      )}
    </div>
  );
};
