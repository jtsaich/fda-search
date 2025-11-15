"use client";

import { ReactNode } from 'react';
import { usePermission, useRole, useIsAdmin } from '@/hooks/useRole';
import type { UserRole, Permission } from '@/types/roles';

interface ProtectedComponentProps {
  children: ReactNode;
  permission?: Permission;
  role?: UserRole;
  requireAdmin?: boolean;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
}

/**
 * Component wrapper that only renders children if user has required permission/role
 */
export function ProtectedComponent({
  children,
  permission,
  role,
  requireAdmin = false,
  fallback = null,
  loadingFallback = null,
}: ProtectedComponentProps) {
  const permissionCheck = usePermission(permission!);
  const roleCheck = useRole(role!);
  const adminCheck = useIsAdmin();

  // Determine which check to use
  const loading = permission
    ? permissionCheck.loading
    : role
    ? roleCheck.loading
    : requireAdmin
    ? adminCheck.loading
    : false;

  const hasAccess = permission
    ? permissionCheck.hasPermission
    : role
    ? roleCheck.hasRole
    : requireAdmin
    ? adminCheck.isAdmin
    : false;

  if (loading) {
    return <>{loadingFallback}</>;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
