import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Scale,
  Zap,
  PieChart,
  BookOpen,
  Settings,
} from 'lucide-react';

const MAIN_NAV = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/market', label: 'Markets', icon: TrendingUp },
  { path: '/courtroom', label: 'Courtroom', icon: Scale },
  { path: '/signals', label: 'Signals', icon: Zap },
  { path: '/portfolio-risk', label: 'Portfolio', icon: PieChart },
  { path: '/research', label: 'Research', icon: BookOpen },
];

const SECONDARY_NAV = [
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-60 flex-shrink-0 bg-ghost-bg border-r border-ghost-border flex flex-col justify-between py-6 text-sm select-none">
      <div className="space-y-6 px-3 flex-1">
        {/* Main Navigation */}
        <div className="space-y-1">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${
                    isActive
                      ? 'bg-ghost-card text-ghost-cyan shadow-sm border border-ghost-border/40'
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

        {/* Divider */}
        <div className="px-3">
          <hr className="border-ghost-border/60" />
        </div>

        {/* Settings */}
        <div className="space-y-1">
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${
                    isActive
                      ? 'bg-ghost-card text-ghost-cyan shadow-sm border border-ghost-border/40'
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
    </aside>
  );
};
