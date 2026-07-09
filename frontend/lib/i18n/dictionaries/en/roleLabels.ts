/**
 * Labels/descriptions for the built-in system roles and permissions.
 * Resolved centrally by the helpers in types/roles.ts (custom DB roles keep
 * their own display_name). Keys mirror SYSTEM_ROLES / SYSTEM_PERMISSIONS ids.
 */
export const roleLabels = {
  "role.label.admin": "Administrator",
  "role.label.researcher": "Researcher",
  "role.label.viewer": "Viewer",
  "role.desc.admin": "Full system access including user and role management",
  "role.desc.researcher": "Can upload, manage documents and create chats",
  "role.desc.viewer": "Can view documents and create chats (read-only access)",
  "perm.label.documents.upload": "Upload Documents",
  "perm.label.documents.view": "View Documents",
  "perm.label.documents.delete": "Delete Documents",
  "perm.label.chat.create": "Create Chats",
  "perm.label.chat.view": "View Chats",
  "perm.label.chat.delete": "Delete Chats",
  "perm.label.users.view": "View Users",
  "perm.label.users.manage": "Manage Users",
  "perm.label.roles.manage": "Manage Roles",
} as const;
