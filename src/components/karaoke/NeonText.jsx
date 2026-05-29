import React from 'react';
import { cn } from '@/lib/utils';

export default function NeonText({ children, color = 'purple', className, as }) {
  const colorClass = {
    purple: 'neon-purple text-primary',
    blue: 'neon-blue text-accent',
    pink: 'neon-pink text-destructive',
  }[color] || 'neon-purple text-primary';

  const Tag = as || 'span';

  return (
    <Tag className={cn(colorClass, className)}>
      {children}
    </Tag>
  );
}