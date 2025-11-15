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

// Default role labels (for system roles, can be overridden by database)
export const DEFAULT_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  researcher: 'Researcher',
  viewer: 'Viewer',
};

// Default role descriptions (for system roles, can be overridden by database)
export const DEFAULT_ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full system access including user and role management',
  researcher: 'Can upload, manage documents and create chats',
  viewer: 'Can view documents and create chats (read-only access)',
};

// Default permission labels (can be extended)
export const DEFAULT_PERMISSION_LABELS: Record<string, string> = {
  'documents.upload': 'Upload Documents',
  'documents.view': 'View Documents',
  'documents.delete': 'Delete Documents',
  'chat.create': 'Create Chats',
  'chat.view': 'View Chats',
  'chat.delete': 'Delete Chats',
  'users.view': 'View Users',
  'users.manage': 'Manage Users',
  'roles.manage': 'Manage Roles',
};

// Backwards compatibility exports
export const ROLE_LABELS = DEFAULT_ROLE_LABELS;
export const ROLE_DESCRIPTIONS = DEFAULT_ROLE_DESCRIPTIONS;
export const PERMISSION_LABELS = DEFAULT_PERMISSION_LABELS;

// Helper to get role display name (with fallback)
export function getRoleDisplayName(role: string, roleData?: RoleData[]): string {
  const foundRole = roleData?.find(r => r.name === role);
  return foundRole?.display_name || DEFAULT_ROLE_LABELS[role] || role;
}

// Helper to get role description (with fallback)
export function getRoleDescription(role: string, roleData?: RoleData[]): string {
  const foundRole = roleData?.find(r => r.name === role);
  return foundRole?.description || DEFAULT_ROLE_DESCRIPTIONS[role] || '';
}

// Helper to get permission label (with fallback)
export function getPermissionLabel(permission: string): string {
  return DEFAULT_PERMISSION_LABELS[permission] || permission;
}

// Helper to check if role is a system role
export function isSystemRole(roleName: string): boolean {
  return Object.values(SYSTEM_ROLES).includes(roleName as SystemRole);
}
