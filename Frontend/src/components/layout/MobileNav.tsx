import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  PieChart,
  Scale,
} from 'lucide-react';

const MOBILE_NAV = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/market', label: 'Markets', icon: TrendingUp },
  { path: '/signals', label: 'Signals', icon: Zap },
  { path: '/portfolio-risk', label: 'Portfolio', icon: PieChart },
  { path: '/courtroom', label: 'Courtroom', icon: Scale },
];

export const MobileNav: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-ghost-darkest/95 backdrop-blur-md border-t border-ghost-border px-2 py-1.5 flex items-center justify-around select-none">
      {MOBILE_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[56px] min-h-[44px] rounded-xl transition-all duration-200 text-[10px] font-medium ${
                isActive
                  ? 'text-ghost-sand font-semibold'
                  : 'text-ghost-textMuted hover:text-ghost-textPrimary'
              }`
            }
          >
            <Icon className="w-5 h-5 mb-1" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
