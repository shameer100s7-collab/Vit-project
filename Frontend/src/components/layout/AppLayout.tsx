import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { CommandPalette } from '../common/CommandPalette';

export const AppLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ghost_sidebar_collapsed') === 'true';
  });
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ghost_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-ghost-bg text-ghost-textPrimary font-sans">
      <Navbar onOpenSearch={() => setIsSearchOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>

      <MobileNav />

      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
};
