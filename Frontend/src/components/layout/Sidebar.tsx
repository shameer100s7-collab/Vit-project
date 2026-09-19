import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  ShieldAlert,
  PieChart,
  Compass,
  Activity,
  Sliders,
  History,
  Maximize2,
  Terminal,
} from 'lucide-react';

const MAIN_NAV = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/market', label: 'Markets', icon: TrendingUp },
  { path: '/signals', label: 'Signals', icon: Zap },
  { path: '/risk', label: 'Risk', icon: ShieldAlert },
  { path: '/portfolio-risk', label: 'Portfolio', icon: PieChart },
];

const ANALYSIS_NAV = [
  { path: '/market-state', label: 'Market Outlook', icon: Compass },
  { path: '/behavior', label: 'Market Activity', icon: Activity },
  { path: '/features', label: 'Market Analysis', icon: Sliders },
  { path: '/risk-history', label: 'Risk History', icon: History },
  { path: '/optimization', label: 'Optimization', icon: Maximize2 },
];

const DEV_NAV = [
  { path: '/console', label: 'API Console', icon: Terminal },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-60 flex-shrink-0 bg-ghost-darkest border-r border-ghost-border flex flex-col justify-between py-5 text-sm select-none">
      <div className="space-y-6 px-3">
        {/* Main Navigation */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-xs font-semibold text-ghost-textDim tracking-wider uppercase">
            Platform
          </div>
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-medium ${
                    isActive
                      ? 'bg-ghost-card text-ghost-cyan font-semibold border border-ghost-border/60 shadow-sm'
                      : 'text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-card/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Intelligence & Research */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-xs font-semibold text-ghost-textDim tracking-wider uppercase">
            Research & Analysis
          </div>
          {ANALYSIS_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-ghost-card text-ghost-cyan font-semibold border border-ghost-border/60 shadow-sm'
                      : 'text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-card/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Developer */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-xs font-semibold text-ghost-textDim tracking-wider uppercase">
            Developer
          </div>
          {DEV_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-ghost-card text-ghost-cyan font-semibold border border-ghost-border/60 shadow-sm'
                      : 'text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-card/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Clean Bottom Status Footer */}
      <div className="px-4 py-3 border-t border-ghost-border/60 text-xs text-ghost-textMuted flex items-center justify-between">
        <span className="font-medium text-ghost-textDim">System</span>
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Online</span>
        </div>
      </div>
    </aside>
  );
};
