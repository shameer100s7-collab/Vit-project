import React from 'react';
import { Link } from 'react-router-dom';
import { ApiStatusBadge } from '../common/ApiStatusBadge';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-ghost-darkest/90 backdrop-blur-md border-b border-ghost-border flex items-center justify-between px-4 lg:px-6">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-ghost-card border border-ghost-border flex items-center justify-center p-1.5 group-hover:border-ghost-cyan transition-colors">
            <img src="/ghost-icon.svg" alt="GHOST" className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-ghost-textPrimary group-hover:text-ghost-cyan transition-colors">
              GHOST
            </span>
            <span className="text-xs text-ghost-textDim font-normal -mt-1 hidden sm:inline">
              Investment Intelligence
            </span>
          </div>
        </Link>
      </div>

      {/* Status & User Actions */}
      <div className="flex items-center gap-4 text-xs">
        <ApiStatusBadge />

        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-ghost-card border border-ghost-border rounded-lg text-xs text-ghost-textMuted">
              <UserIcon className="w-3.5 h-3.5 text-ghost-cyan" />
              <span className="text-ghost-textPrimary font-medium">{user.email}</span>
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
              className="px-3 py-1.5 rounded-lg border border-ghost-border hover:border-ghost-cyan text-ghost-textPrimary hover:text-ghost-cyan transition-colors font-medium"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-3 py-1.5 rounded-lg bg-ghost-cyan text-slate-950 font-semibold hover:bg-cyan-400 transition-colors"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
