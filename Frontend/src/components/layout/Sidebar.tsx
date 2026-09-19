import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Sliders,
  ShieldAlert,
  PieChart,
  History,
  Terminal,
  Compass,
  Zap,
  Activity,
  Maximize2,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/market', label: 'Market Data', icon: TrendingUp },
  { path: '/features', label: 'Feature Engine', icon: Sliders },
  { path: '/market-state', label: 'Market Regime', icon: Compass },
  { path: '/signals', label: 'Signals Engine', icon: Zap },
  { path: '/behavior', label: 'Behavior Model', icon: Activity },
  { path: '/risk', label: 'Quantitative Risk', icon: ShieldAlert },
  { path: '/portfolio-risk', label: 'Portfolio Risk', icon: PieChart },
  { path: '/risk-history', label: 'Risk History', icon: History },
  { path: '/optimization', label: 'Optimization', icon: Maximize2 },
  { path: '/console', label: 'API Console', icon: Terminal },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-56 flex-shrink-0 bg-ghost-darkest border-r border-ghost-border flex flex-col justify-between py-4 font-mono text-xs select-none">
      <div className="space-y-1 px-3">
        <div className="px-3 pb-2 text-2xs font-semibold text-ghost-textMuted uppercase tracking-wider">
          Intelligence Layers
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-ghost-card text-ghost-cyan font-semibold border border-ghost-borderLight shadow-sm'
                    : 'text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-card/50'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-ghost-border/40 text-2xs text-ghost-textMuted space-y-1">
        <div className="flex justify-between">
          <span>FRAMEWORK:</span>
          <span className="text-ghost-textPrimary">FASTAPI 0.115</span>
        </div>
        <div className="flex justify-between">
          <span>PRECISION:</span>
          <span className="text-ghost-cyan">ZERO-LOOKAHEAD</span>
        </div>
        <div className="flex justify-between">
          <span>CONFIDENCE:</span>
          <span className="text-ghost-textPrimary">[0.05, 0.95]</span>
        </div>
      </div>
    </aside>
  );
};
