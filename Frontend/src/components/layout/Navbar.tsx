import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-ghost-darkest/95 backdrop-blur-md border-b border-ghost-border flex items-center justify-between px-4 lg:px-6">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-ghost-card border border-ghost-border flex items-center justify-center p-1.5 group-hover:border-ghost-sand/60 transition-colors">
            <img src="/ghost-icon.svg" alt="GHOST" className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-ghost-textPrimary group-hover:text-ghost-sand transition-colors">
              GHOST
            </span>
            <span className="text-[11px] text-ghost-textMuted font-normal -mt-0.5 hidden sm:inline">
              Investment Intelligence
            </span>
          </div>
        </Link>
      </div>

      {/* User Actions */}
      <div className="flex items-center gap-4 text-xs">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-ghost-card border border-ghost-border rounded-lg text-xs text-ghost-textMuted">
              <UserIcon className="w-3.5 h-3.5 text-ghost-sand" />
              <span className="text-ghost-textPrimary font-medium">{user.email}</span>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 rounded-lg border border-ghost-border bg-ghost-card hover:bg-ghost-burgundy/40 hover:border-ghost-burgundy text-ghost-textMuted hover:text-ghost-sand transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-lg border border-ghost-border hover:border-ghost-sand text-ghost-textPrimary hover:text-ghost-sand transition-colors font-medium"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-3.5 py-1.5 rounded-lg bg-ghost-burgundy text-ghost-sand font-semibold hover:bg-ghost-burgundyLight transition-colors shadow"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
