// Role management utilities for checking permissions and roles

import { createClient } from '@/utils/supabase/client';
import { createClient as createServerClient } from '@/utils/supabase/server';
import type { UserRole, Permission, UserProfile } from '@/types/roles';

/**
 * Get the current user's profile including role information
 * Client-side version
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

/**
 * Get the current user's profile including role information
 * Server-side version
 */
export async function getUserProfileServer(): Promise<UserProfile | null> {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

/**
 * Check if the current user has a specific permission
 * Client-side version
 */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const profile = await getUserProfile();
  if (!profile) return false;

  const supabase = createClient();

  // Get permission ID
  const { data: permissionData } = await supabase
    .from('permissions')
    .select('id')
    .eq('name', permission)
    .single();

  if (!permissionData) return false;

  // Check if role has this permission
  const { data: rolePermission } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role', profile.role)
    .eq('permission_id', permissionData.id)
    .single();

  return !!rolePermission;
}

/**
 * Check if the current user has a specific permission
 * Server-side version
 */
export async function hasPermissionServer(permission: Permission): Promise<boolean> {
  const profile = await getUserProfileServer();
  if (!profile) return false;

  const supabase = await createServerClient();

  // Get permission ID
  const { data: permissionData } = await supabase
    .from('permissions')
    .select('id')
    .eq('name', permission)
    .single();

  if (!permissionData) return false;

  // Check if role has this permission
  const { data: rolePermission } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role', profile.role)
    .eq('permission_id', permissionData.id)
    .single();

  return !!rolePermission;
}

/**
 * Check if the current user has a specific role
 * Client-side version
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const profile = await getUserProfile();
  return profile?.role === role;
}

/**
 * Check if the current user has a specific role
 * Server-side version
 */
export async function hasRoleServer(role: UserRole): Promise<boolean> {
  const profile = await getUserProfileServer();
  return profile?.role === role;
}

/**
 * Check if the current user is an admin
 * Client-side version
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole('admin');
}

/**
 * Check if the current user is an admin
 * Server-side version
 */
export async function isAdminServer(): Promise<boolean> {
  return hasRoleServer('admin');
}

/**
 * Get all users with their profiles (admin only)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data || [];
}

/**
 * Update a user's role (admin only)
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // Check if current user is admin
  const isUserAdmin = await isAdmin();
  if (!isUserAdmin) {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      role: newRole,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user role:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete a user (admin only)
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // Check if current user is admin
  const isUserAdmin = await isAdmin();
  if (!isUserAdmin) {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  // Get current user to prevent self-deletion
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === userId) {
    return { success: false, error: 'Cannot delete your own account' };
  }

  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error('Error deleting user:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get all available permissions
 */
export async function getAllPermissions() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching permissions:', error);
    return [];
  }

  return data || [];
}

/**
 * Get permissions for a specific role
 */
export async function getRolePermissions(role: UserRole) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('role_permissions')
    .select(`
      permission_id,
      permissions (
        id,
        name,
        description
      )
    `)
    .eq('role', role);

  if (error) {
    console.error('Error fetching role permissions:', error);
    return [];
  }

  return data || [];
}
