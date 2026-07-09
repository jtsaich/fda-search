import { dictionaries } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

// Role management types for FDA RAG Assistant
// Updated to support dynamic roles

// Note: UserRole is now a string to support custom roles
// The system roles are still available as constants
export type UserRole = string;

// System roles (cannot be deleted)
export const SYSTEM_ROLES = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher',
  VIEWER: 'viewer',
} as const;

export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

// Permission type - can be extended dynamically
export type Permission = string;

// Common system permissions
export const SYSTEM_PERMISSIONS = {
  DOCUMENTS_UPLOAD: 'documents.upload',
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_DELETE: 'documents.delete',
  CHAT_CREATE: 'chat.create',
  CHAT_VIEW: 'chat.view',
  CHAT_DELETE: 'chat.delete',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
} as const;

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface RoleData {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface PermissionData {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface RolePermission {
  role: UserRole;
  permission_id: string;
}

// Resolve a built-in role/permission label from the active locale's dictionary,
// falling back to the default locale when a key is missing.
function translateLabel(key: string, locale: Locale): string | undefined {
  const dict = dictionaries[locale] as Record<string, string>;
  const fallback = dictionaries[DEFAULT_LOCALE] as Record<string, string>;
  return dict[key] ?? fallback[key];
}

// Helper to get role display name. Custom DB roles keep their own display_name;
// system roles resolve from the localized dictionary.
export function getRoleDisplayName(
  role: string,
  locale: Locale,
  roleData?: RoleData[]
): string {
  const foundRole = roleData?.find((r) => r.name === role);
  return (
    foundRole?.display_name || translateLabel(`role.label.${role}`, locale) || role
  );
}

// Helper to get role description (with locale-aware system fallback).
export function getRoleDescription(
  role: string,
  locale: Locale,
  roleData?: RoleData[]
): string {
  const foundRole = roleData?.find((r) => r.name === role);
  return (
    foundRole?.description || translateLabel(`role.desc.${role}`, locale) || ""
  );
}

// Helper to get permission label (with locale-aware system fallback).
export function getPermissionLabel(permission: string, locale: Locale): string {
  return translateLabel(`perm.label.${permission}`, locale) || permission;
}

// Helper to check if role is a system role
export function isSystemRole(roleName: string): boolean {
  return Object.values(SYSTEM_ROLES).includes(roleName as SystemRole);
}
