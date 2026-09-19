import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon, Search } from 'lucide-react';

export interface NavbarProps {
  onOpenSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSearch }) => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-ghost-darkest/95 backdrop-blur-md border-b border-ghost-border/70 flex items-center justify-between px-4 lg:px-6">
      {/* Brand & Mark */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-xl bg-ghost-card border border-ghost-border flex items-center justify-center p-1.5 group-hover:border-ghost-sand/60 transition-colors shadow-xs">
            <img src="/ghost-icon.svg" alt="GHOST" className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-ghost-textPrimary group-hover:text-ghost-sand transition-colors">
              GHOST
            </span>
            <span className="text-[10px] text-ghost-textMuted font-normal -mt-0.5 hidden sm:inline">
              Investment Intelligence
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Global Search Trigger */}
      <div className="flex-1 max-w-xs mx-4 hidden sm:block">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-ghost-card/60 border border-ghost-border/60 hover:border-ghost-sand/40 text-ghost-textMuted hover:text-ghost-textPrimary transition-all text-xs"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-ghost-textMuted" />
            <span>Search GHOST...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded bg-ghost-bg border border-ghost-border/80 text-[10px] font-mono text-ghost-textMuted">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Account & Search Mobile Button */}
      <div className="flex items-center gap-3 text-xs">
        <button
          onClick={onOpenSearch}
          title="Search"
          className="sm:hidden p-2 rounded-xl border border-ghost-border bg-ghost-card text-ghost-textMuted hover:text-ghost-textPrimary"
        >
          <Search className="w-4 h-4" />
        </button>

        {isAuthenticated && user ? (
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-xl text-xs text-ghost-textMuted">
              <UserIcon className="w-3.5 h-3.5 text-ghost-sand" />
              <span className="text-ghost-textPrimary font-medium">
                {user.email?.split('@')[0]}
              </span>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-2 rounded-xl border border-ghost-border bg-ghost-card hover:bg-ghost-burgundy/30 hover:border-ghost-burgundyLight text-ghost-textMuted hover:text-ghost-sand transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-xl border border-ghost-border hover:border-ghost-sand text-ghost-textPrimary hover:text-ghost-sand transition-colors font-medium text-xs"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-3.5 py-1.5 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold hover:bg-ghost-burgundyLight transition-colors shadow text-xs"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
