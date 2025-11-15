"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { UserRole, Permission, UserProfile } from '@/types/roles';

/**
 * Hook to get the current user's profile with role information
 */
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (fetchError) throw fetchError;

        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return { profile, loading, error };
}

/**
 * Hook to check if the current user has a specific permission
 * Queries the database for dynamic permission checking
 */
export function usePermission(permission: Permission) {
  const { profile, loading: profileLoading } = useUserProfile();
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      if (profileLoading) {
        setLoading(true);
        return;
      }

      if (!profile) {
        setHasPermission(false);
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // Get permission ID
        const { data: permissionData } = await supabase
          .from('permissions')
          .select('id')
          .eq('name', permission)
          .single();

        if (!permissionData) {
          setHasPermission(false);
          setLoading(false);
          return;
        }

        // Check if role has this permission
        const { data: rolePermission } = await supabase
          .from('role_permissions')
          .select('permission_id')
          .eq('role', profile.role)
          .eq('permission_id', permissionData.id)
          .single();

        setHasPermission(!!rolePermission);
      } catch (err) {
        console.error('Error checking permission:', err);
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [profile, profileLoading, permission]);

  return { hasPermission, loading };
}

/**
 * Hook to check if the current user has a specific role
 */
export function useRole(role: UserRole) {
  const { profile, loading } = useUserProfile();
  const hasRole = profile?.role === role;

  return { hasRole, loading };
}

/**
 * Hook to check if the current user is an admin
 */
export function useIsAdmin() {
  const { profile, loading } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  return { isAdmin, loading };
}

/**
 * Hook to check multiple permissions at once
 * Queries the database for dynamic permission checking
 */
export function usePermissions(permissionNames: Permission[]) {
  const { profile, loading: profileLoading } = useUserProfile();
  const [permissionMap, setPermissionMap] = useState<Record<Permission, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      if (profileLoading) {
        setLoading(true);
        return;
      }

      if (!profile) {
        const emptyMap = permissionNames.reduce((acc, permission) => {
          acc[permission] = false;
          return acc;
        }, {} as Record<Permission, boolean>);
        setPermissionMap(emptyMap);
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // Get all permissions with their IDs
        const { data: allPermissions } = await supabase
          .from('permissions')
          .select('id, name')
          .in('name', permissionNames);

        if (!allPermissions || allPermissions.length === 0) {
          const emptyMap = permissionNames.reduce((acc, permission) => {
            acc[permission] = false;
            return acc;
          }, {} as Record<Permission, boolean>);
          setPermissionMap(emptyMap);
          setLoading(false);
          return;
        }

        // Get role permissions
        const permissionIds = allPermissions.map(p => p.id);
        const { data: rolePermissions } = await supabase
          .from('role_permissions')
          .select('permission_id')
          .eq('role', profile.role)
          .in('permission_id', permissionIds);

        // Create permission map
        const hasPermissionIds = new Set(rolePermissions?.map(rp => rp.permission_id) || []);
        const newPermissionMap = permissionNames.reduce((acc, permissionName) => {
          const permission = allPermissions.find(p => p.name === permissionName);
          acc[permissionName] = permission ? hasPermissionIds.has(permission.id) : false;
          return acc;
        }, {} as Record<Permission, boolean>);

        setPermissionMap(newPermissionMap);
      } catch (err) {
        console.error('Error checking permissions:', err);
        const emptyMap = permissionNames.reduce((acc, permission) => {
          acc[permission] = false;
          return acc;
        }, {} as Record<Permission, boolean>);
        setPermissionMap(emptyMap);
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, [profile, profileLoading, permissionNames]);

  return { permissions: permissionMap, loading };
}
