"use client";

import { Shield } from 'lucide-react';
import type { UserRole } from '@/types/roles';
import { ROLE_LABELS } from '@/types/roles';

interface RoleBadgeProps {
  role: UserRole;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RoleBadge({ role, showIcon = true, size = 'md' }: RoleBadgeProps) {
  const colors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    researcher: 'bg-blue-100 text-blue-800 border-blue-200',
    viewer: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${colors[role]} ${sizes[size]}`}
    >
      {showIcon && <Shield className={iconSizes[size]} />}
      {ROLE_LABELS[role]}
    </span>
  );
}
