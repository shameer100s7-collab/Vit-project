import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-ghost-card border border-ghost-border/70 shadow-sm',
    elevated: 'bg-ghost-cardHover border border-ghost-border shadow-md',
    subtle: 'bg-ghost-bg/60 border border-ghost-border/40',
    interactive:
      'bg-ghost-card border border-ghost-border/70 hover:border-ghost-sand/40 hover:bg-ghost-cardHover transition-all duration-200 cursor-pointer shadow-sm',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-3.5',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={`rounded-2xl ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
