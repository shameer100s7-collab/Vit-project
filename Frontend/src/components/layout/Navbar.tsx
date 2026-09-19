import React from 'react';
import { Link } from 'react-router-dom';
import { ApiStatusBadge } from '../common/ApiStatusBadge';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-ghost-darkest/95 backdrop-blur border-b border-ghost-border flex items-center justify-between px-4 lg:px-6">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-ghost-card border border-ghost-border flex items-center justify-center p-1 group-hover:border-ghost-cyan transition-colors">
            <img src="/ghost-icon.svg" alt="GHOST" className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-sm font-bold tracking-widest text-ghost-textPrimary group-hover:text-ghost-cyan transition-colors">
              GHOST
            </span>
            <span className="font-mono text-2xs text-ghost-textMuted tracking-tight -mt-1 hidden sm:inline">
              QUANTITATIVE INTELLIGENCE
            </span>
          </div>
        </Link>
      </div>

      {/* Center Status Indicators */}
      <div className="flex items-center gap-3">
        <ApiStatusBadge />
      </div>

      {/* User Actions */}
      <div className="flex items-center gap-3 font-mono text-xs">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-ghost-card border border-ghost-border rounded-lg text-2xs text-ghost-textPrimary">
              <UserIcon className="w-3.5 h-3.5 text-ghost-cyan" />
              <span>{user.email}</span>
              <span className="px-1 py-0.5 rounded bg-ghost-border text-2xs text-ghost-textMuted">
                {user.role}
              </span>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 rounded-lg border border-ghost-border bg-ghost-card hover:bg-rose-500/10 hover:border-rose-500/30 text-ghost-textMuted hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg border border-ghost-border hover:border-ghost-cyan text-ghost-textPrimary hover:text-ghost-cyan transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-3 py-1.5 rounded-lg bg-ghost-cyan text-ghost-darkest font-semibold hover:bg-ghost-cyan/90 transition-colors"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
