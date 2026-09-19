import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          className={`w-screen ${width} bg-ghost-card border-l border-ghost-border flex flex-col shadow-2xl transform transition-transform duration-200 ease-out`}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-6 border-b border-ghost-border">
            <div>
              <h2 className="text-base font-bold text-ghost-textPrimary tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-ghost-textMuted mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-ghost-border text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-bg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
