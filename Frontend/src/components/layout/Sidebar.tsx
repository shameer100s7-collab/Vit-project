import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Scale,
  Zap,
  PieChart,
  BookOpen,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const MAIN_NAV = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/market', label: 'Markets', icon: TrendingUp },
  { path: '/signals', label: 'Signals', icon: Zap },
  { path: '/strategies', label: 'Strategies', icon: ShieldCheck },
  { path: '/portfolio-risk', label: 'Portfolio', icon: PieChart },
  { path: '/research', label: 'Research', icon: BookOpen },
  { path: '/courtroom', label: 'Courtroom', icon: Scale },
];

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  return (
    <aside
      className={`hidden md:flex flex-col justify-between py-5 bg-ghost-bg border-r border-ghost-border/70 select-none transition-[width] duration-200 ease-in-out ${
        isCollapsed ? 'w-[72px]' : 'w-60'
      }`}
    >
      <div className="space-y-6 px-3 flex-1 flex flex-col">
        {/* Navigation Items */}
        <div className="space-y-1.5 flex-1">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center ${
                    isCollapsed ? 'justify-center px-0' : 'px-3.5'
                  } py-2.5 rounded-xl transition-all duration-200 font-medium text-xs tracking-wide ${
                    isActive
                      ? 'bg-ghost-burgundy/30 text-ghost-sand border border-ghost-burgundyLight/50 font-semibold shadow-xs'
                      : 'text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-card/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span className="ml-3 truncate">{item.label}</span>}

                {/* Collapsed Tooltip Hint */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1 bg-ghost-darkest border border-ghost-border rounded-lg text-[11px] text-ghost-textPrimary font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Collapse / Expand Toggle Button */}
        <div className="pt-2 border-t border-ghost-border/40 flex justify-end">
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full flex items-center justify-center p-2 rounded-xl text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-card/60 border border-transparent hover:border-ghost-border transition-colors text-xs"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center justify-between w-full px-2">
                <span className="text-[11px] font-medium text-ghost-textMuted">Collapse</span>
                <ChevronLeft className="w-4 h-4" />
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
