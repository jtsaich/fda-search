# Role Management System Setup Guide

This guide explains how to set up and use the role-based access control (RBAC) system in the FDA RAG Assistant.

## Overview

The role management system provides fine-grained access control with three predefined roles:

- **Admin**: Full system access including user and role management
- **Researcher**: Can upload, manage documents and create chats
- **Viewer**: Can view documents and create chats (read-only access)

## Database Setup

### 1. Run the Migration

Execute the migration SQL file in your Supabase SQL Editor:

```bash
# The migration file is located at:
supabase/migrations/001_role_management.sql
```

**To apply the migration:**

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/001_role_management.sql`
4. Paste and run the SQL

Alternatively, if using Supabase CLI:

```bash
supabase db push
```

### 2. What the Migration Creates

The migration creates:

- **Tables**:
  - `user_profiles`: Extended user information with role data
  - `permissions`: Available system permissions
  - `role_permissions`: Maps roles to permissions

- **Functions**:
  - `handle_new_user()`: Auto-creates profile when user signs up
  - `user_has_permission()`: Check if user has a permission
  - `get_user_role()`: Get a user's role
  - `is_admin()`: Check if user is admin

- **Row Level Security (RLS)**: Ensures users can only access authorized data

### 3. Default Permissions

The following permissions are automatically created:

| Permission | Description |
|------------|-------------|
| `documents.upload` | Upload and process documents |
| `documents.view` | View uploaded documents |
| `documents.delete` | Delete documents |
| `chat.create` | Create new chat sessions |
| `chat.view` | View chat history |
| `chat.delete` | Delete chat sessions |
| `users.view` | View user list |
| `users.manage` | Create, update, and delete users |
| `roles.manage` | Manage user roles and permissions |

### 4. Create Your First Admin User

After signing up through the application, you'll need to manually promote your first admin user:

```sql
-- Run this in Supabase SQL Editor
-- Replace 'your-email@example.com' with your actual email

UPDATE public.user_profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## Frontend Usage

### Using Role Hooks

```typescript
import { useUserProfile, usePermission, useIsAdmin } from '@/hooks/useRole';

function MyComponent() {
  // Get current user profile with role
  const { profile, loading } = useUserProfile();

  // Check specific permission
  const { hasPermission } = usePermission('documents.upload');

  // Check if admin
  const { isAdmin } = useIsAdmin();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Role: {profile?.role}</p>
      {hasPermission && <button>Upload Document</button>}
      {isAdmin && <button>Manage Users</button>}
    </div>
  );
}
```

### Using Protected Components

```typescript
import { ProtectedComponent } from '@/components/ProtectedComponent';

function MyPage() {
  return (
    <div>
      {/* Show only to users with document upload permission */}
      <ProtectedComponent permission="documents.upload">
        <button>Upload Document</button>
      </ProtectedComponent>

      {/* Show only to admins */}
      <ProtectedComponent requireAdmin>
        <AdminPanel />
      </ProtectedComponent>

      {/* Show only to researchers */}
      <ProtectedComponent role="researcher">
        <ResearcherTools />
      </ProtectedComponent>
    </div>
  );
}
```

### Server-Side Role Checking

```typescript
import { hasPermissionServer, isAdminServer } from '@/lib/roles';

export default async function ServerComponent() {
  const canUpload = await hasPermissionServer('documents.upload');
  const isAdmin = await isAdminServer();

  if (!canUpload) {
    redirect('/unauthorized');
  }

  return <div>Protected content</div>;
}
```

## User Management Interface

### Accessing User Management

Admins can access the user management interface at:

```
/admin/users
```

This page allows admins to:
- View all users
- Change user roles
- Delete users (except themselves)

### Role Badge Component

Display a user's role with a visual badge:

```typescript
import { RoleBadge } from '@/components/RoleBadge';

<RoleBadge role={user.role} size="md" showIcon />
```

## API Functions

### Client-Side Functions

```typescript
import {
  getUserProfile,
  hasPermission,
  hasRole,
  isAdmin,
  getAllUsers,
  updateUserRole,
  deleteUser,
} from '@/lib/roles';

// Get current user's profile
const profile = await getUserProfile();

// Check permission
const canDelete = await hasPermission('documents.delete');

// Check role
const isResearcher = await hasRole('researcher');

// Get all users (admin only)
const users = await getAllUsers();

// Update user role (admin only)
const result = await updateUserRole(userId, 'researcher');

// Delete user (admin only)
const result = await deleteUser(userId);
```

### Server-Side Functions

Same functions with `Server` suffix:

```typescript
import {
  getUserProfileServer,
  hasPermissionServer,
  hasRoleServer,
  isAdminServer,
} from '@/lib/roles';
```

## TypeScript Types

```typescript
import type { UserRole, Permission, UserProfile } from '@/types/roles';

// Available roles
type UserRole = 'admin' | 'researcher' | 'viewer';

// Available permissions
type Permission =
  | 'documents.upload'
  | 'documents.view'
  | 'documents.delete'
  | 'chat.create'
  | 'chat.view'
  | 'chat.delete'
  | 'users.view'
  | 'users.manage'
  | 'roles.manage';

// User profile with role
interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  created_by?: string;
}
```

## Security Considerations

1. **Row Level Security (RLS)**: All tables have RLS policies to ensure data security
2. **Server-side validation**: Always validate permissions on the server side
3. **Self-deletion prevention**: Users cannot delete their own accounts
4. **Admin verification**: Role changes require admin privileges

## Common Use Cases

### Protect a Route

```typescript
// app/admin/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { isAdminServer } from '@/lib/roles';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  const admin = await isAdminServer();
  if (!admin) redirect('/');

  return <div>Admin content</div>;
}
```

### Conditional UI Rendering

```typescript
function DocumentActions({ documentId }: { documentId: string }) {
  const { hasPermission: canDelete } = usePermission('documents.delete');

  return (
    <div>
      <button>View</button>
      {canDelete && (
        <button onClick={() => deleteDocument(documentId)}>
          Delete
        </button>
      )}
    </div>
  );
}
```

### Role-based Navigation

```typescript
function Navigation() {
  const { isAdmin } = useIsAdmin();
  const { hasPermission: canUpload } = usePermission('documents.upload');

  return (
    <nav>
      <Link href="/">Home</Link>
      {canUpload && <Link href="/upload">Upload</Link>}
      {isAdmin && <Link href="/admin/users">Users</Link>}
    </nav>
  );
}
```

## Extending the System

### Adding New Roles

1. Update the enum in migration:

```sql
ALTER TYPE user_role ADD VALUE 'new_role';
```

2. Add permissions for the new role:

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'new_role', id FROM public.permissions
WHERE name IN ('permission1', 'permission2');
```

3. Update TypeScript types in [types/roles.ts](frontend/types/roles.ts)

### Adding New Permissions

1. Insert new permission:

```sql
INSERT INTO public.permissions (name, description)
VALUES ('feature.action', 'Description of permission');
```

2. Assign to roles:

```sql
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
WHERE name = 'feature.action';
```

3. Update TypeScript types in [types/roles.ts](frontend/types/roles.ts)

## Troubleshooting

### Users Not Getting Default Role

Check that the trigger is working:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

### Permission Check Failing

Verify the user has a profile:

```sql
SELECT * FROM public.user_profiles WHERE email = 'user@example.com';
```

### RLS Policies Not Working

Check if RLS is enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('user_profiles', 'permissions', 'role_permissions');
```

## Testing

### Test Permission Checking

```typescript
// In a test file
import { hasPermission } from '@/lib/roles';

test('admin has all permissions', async () => {
  const canManageUsers = await hasPermission('users.manage');
  expect(canManageUsers).toBe(true);
});
```

### Test Role Assignment

```sql
-- Verify role permissions
SELECT r.role, p.name
FROM public.role_permissions r
JOIN public.permissions p ON r.permission_id = p.id
ORDER BY r.role, p.name;
```

## Next Steps

1. Run the database migration
2. Create your first admin user
3. Test the user management interface at `/admin/users`
4. Implement role checks in your protected routes
5. Add `<ProtectedComponent>` wrappers to sensitive UI elements

For questions or issues, refer to the main [CLAUDE.md](CLAUDE.md) documentation.
