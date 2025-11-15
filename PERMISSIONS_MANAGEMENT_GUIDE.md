# Permissions Management Guide

## Overview

The Permissions Management system allows administrators to create, edit, and assign permissions to roles dynamically through a web interface.

## Accessing Permissions Management

**URL**: `/admin/permissions`

**Requirements**:
- Must be logged in
- Must have `admin` role

**Navigation**:
- Admins will see a "Permissions" button in the top navigation bar
- Click to access the permissions management interface

## Features

### 1. View Role Permissions Matrix

The main interface displays a matrix showing:
- All available permissions (rows)
- All roles (columns: Admin, Researcher, Viewer)
- Checkmarks indicating which roles have which permissions

### 2. Toggle Permissions

**To add/remove a permission from a role**:
1. Find the permission in the list
2. Click the checkbox in the role's column
3. ✅ Green checkmark = permission granted
4. ❌ Gray X = permission not granted
5. Changes apply immediately

### 3. Create New Permissions

**To create a new permission**:

1. Click "Add Permission" button
2. Fill in the form:
   - **Permission Name** (required): Use dot notation (e.g., `reports.export`)
   - **Description** (optional): Brief explanation of what the permission allows
3. Click "Create Permission"

**Naming Convention**:
```
feature.action

Examples:
- documents.upload
- documents.view
- documents.delete
- chat.create
- reports.export
- analytics.view
```

### 4. Delete Permissions

**To delete a permission**:

1. Click the trash icon next to the permission
2. Confirm the deletion
3. Permission is removed from all roles

**Warning**: Deleting a permission removes it from all roles immediately and may break functionality that depends on it.

## Permission Matrix Example

| Permission | Admin | Researcher | Viewer |
|------------|-------|------------|--------|
| documents.upload | ✅ | ✅ | ❌ |
| documents.view | ✅ | ✅ | ✅ |
| documents.delete | ✅ | ✅ | ❌ |
| chat.create | ✅ | ✅ | ✅ |
| chat.view | ✅ | ✅ | ✅ |
| chat.delete | ✅ | ✅ | ❌ |
| users.view | ✅ | ❌ | ❌ |
| users.manage | ✅ | ❌ | ❌ |
| roles.manage | ✅ | ❌ | ❌ |

## How It Works

### Database Structure

```sql
-- Permissions table
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE,
  description TEXT
);

-- Role-Permission mappings
CREATE TABLE role_permissions (
  role user_role,
  permission_id UUID REFERENCES permissions(id),
  PRIMARY KEY (role, permission_id)
);
```

### Permission Check Flow

1. User attempts an action
2. Frontend checks: `usePermission('documents.upload')`
3. System queries user's role
4. Checks if role has that permission in `role_permissions`
5. Grants or denies access

## Use Cases

### Use Case 1: Add Custom Permission

**Scenario**: You want to add a new "reports" feature

**Steps**:
1. Create permission: `reports.view`
2. Create permission: `reports.export`
3. Assign `reports.view` to: Admin, Researcher, Viewer
4. Assign `reports.export` to: Admin, Researcher only

### Use Case 2: Restrict Document Deletion

**Scenario**: You want only admins to delete documents

**Steps**:
1. Find `documents.delete` permission
2. Uncheck it for "Researcher" role
3. Keep it checked for "Admin" only

### Use Case 3: Create Department-Specific Permission

**Scenario**: Add a "compliance" section only for certain users

**Steps**:
1. Create permission: `compliance.view`
2. Create permission: `compliance.edit`
3. Assign to appropriate roles
4. Use in your components:
   ```tsx
   <ProtectedComponent permission="compliance.view">
     <ComplianceSection />
   </ProtectedComponent>
   ```

## Integration with Code

### Frontend Usage

**Check permission in component**:
```tsx
import { usePermission } from '@/hooks/useRole';

function MyComponent() {
  const { hasPermission } = usePermission('reports.export');

  if (!hasPermission) {
    return <div>You don't have access to export reports</div>;
  }

  return <button onClick={exportReport}>Export</button>;
}
```

**Protect entire component**:
```tsx
import { ProtectedComponent } from '@/components/ProtectedComponent';

<ProtectedComponent permission="reports.export">
  <ExportButton />
</ProtectedComponent>
```

**Server-side check**:
```tsx
import { hasPermissionServer } from '@/lib/roles';

export default async function ReportsPage() {
  const canView = await hasPermissionServer('reports.view');
  if (!canView) redirect('/unauthorized');

  return <ReportsContent />;
}
```

### Backend Usage (Python)

```python
# In your FastAPI routes
from supabase import create_client

async def check_permission(user_id: str, permission: str) -> bool:
    result = supabase.rpc('user_has_permission', {
        'user_id': user_id,
        'permission_name': permission
    }).execute()
    return result.data

@app.post("/export-report")
async def export_report(user_id: str):
    if not await check_permission(user_id, "reports.export"):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Export logic here
```

## Best Practices

### 1. Permission Naming

✅ **Good**:
- `documents.upload`
- `chat.delete`
- `analytics.view`
- `reports.export`

❌ **Bad**:
- `upload` (too vague)
- `canDeleteChats` (not dot notation)
- `DOCUMENTS_UPLOAD` (not lowercase)

### 2. Permission Granularity

**Too Granular** (❌):
- `documents.upload.pdf`
- `documents.upload.txt`
- `documents.upload.docx`

**Good Granularity** (✅):
- `documents.upload` (covers all types)
- `documents.upload.sensitive` (if needed for classification)

### 3. Permission Assignment Strategy

**Principle of Least Privilege**:
1. Start with minimum permissions for each role
2. Add permissions as needed
3. Review regularly

**Common Pattern**:
- **Viewer**: Read-only access
- **Researcher**: Read + Create + Own items management
- **Admin**: Full access including user/role management

### 4. Testing Permission Changes

Before deploying to production:

1. **Create test accounts** for each role
2. **Test each permission** to verify it works
3. **Check edge cases** (e.g., user with no role)
4. **Monitor logs** for permission denied errors

## Security Considerations

### 1. Changes Take Effect Immediately

⚠️ When you modify permissions:
- Changes apply to all users instantly
- No restart or deployment needed
- Users may need to refresh browser to see UI updates

### 2. Critical Permissions

**Never remove these from admin role**:
- `users.manage` (or you can't add admins)
- `roles.manage` (or you can't modify permissions)

### 3. Application-Level Security

Remember: Frontend permission checks are for UX only!

**Always validate on backend**:
```typescript
// ✅ Good - Check on server
export async function POST(request: Request) {
  const hasPermission = await hasPermissionServer('documents.upload');
  if (!hasPermission) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Process upload
}
```

```typescript
// ❌ Bad - Only check on client
function UploadButton() {
  const { hasPermission } = usePermission('documents.upload');
  if (!hasPermission) return null;
  // Upload directly (not secure!)
}
```

### 4. Audit Trail

Consider logging permission changes:
- Who changed what permission
- When it was changed
- From what to what

## Troubleshooting

### Permission not working after assignment

**Problem**: Assigned permission but user still can't access

**Solutions**:
1. User needs to refresh browser
2. Check if user has correct role:
   ```sql
   SELECT email, role FROM user_profiles WHERE email = 'user@example.com';
   ```
3. Verify permission is assigned:
   ```sql
   SELECT rp.role, p.name
   FROM role_permissions rp
   JOIN permissions p ON rp.permission_id = p.id
   WHERE p.name = 'your.permission';
   ```

### Can't delete permission

**Problem**: Delete button doesn't work

**Possible Causes**:
1. Database constraint (permission in use)
2. Not admin user
3. RLS policy blocking deletion

**Solution**:
```sql
-- Check if permission is being used
SELECT COUNT(*) FROM role_permissions WHERE permission_id = 'permission-uuid';

-- Force delete (use carefully!)
DELETE FROM role_permissions WHERE permission_id = 'permission-uuid';
DELETE FROM permissions WHERE id = 'permission-uuid';
```

### Changes not syncing

**Problem**: Changes in admin panel don't reflect in app

**Solutions**:
1. Clear browser cache
2. Sign out and sign back in
3. Check browser console for errors
4. Verify Supabase connection

## API Reference

### Queries

**Get all permissions**:
```typescript
const { data } = await supabase
  .from('permissions')
  .select('*')
  .order('name');
```

**Get role permissions**:
```typescript
const { data } = await supabase
  .from('role_permissions')
  .select(`
    role,
    permissions (
      id,
      name,
      description
    )
  `)
  .eq('role', 'researcher');
```

**Check if role has permission**:
```typescript
const { data } = await supabase
  .from('role_permissions')
  .select('permission_id')
  .eq('role', 'viewer')
  .eq('permission_id', permissionId)
  .single();

const hasPermission = !!data;
```

### Mutations

**Create permission**:
```typescript
const { error } = await supabase
  .from('permissions')
  .insert({
    name: 'reports.export',
    description: 'Export reports to various formats'
  });
```

**Assign permission to role**:
```typescript
const { error } = await supabase
  .from('role_permissions')
  .insert({
    role: 'researcher',
    permission_id: permissionId
  });
```

**Remove permission from role**:
```typescript
const { error } = await supabase
  .from('role_permissions')
  .delete()
  .eq('role', 'viewer')
  .eq('permission_id', permissionId);
```

**Delete permission**:
```typescript
const { error } = await supabase
  .from('permissions')
  .delete()
  .eq('id', permissionId);
```

## Migration Guide

### Adding Custom Permissions via SQL

If you prefer to add permissions via migration:

```sql
-- Add new permission
INSERT INTO public.permissions (name, description)
VALUES ('reports.export', 'Export reports to various formats')
ON CONFLICT (name) DO NOTHING;

-- Assign to roles
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions WHERE name = 'reports.export'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'researcher', id FROM public.permissions WHERE name = 'reports.export'
ON CONFLICT DO NOTHING;
```

## Related Documentation

- [ROLE_MANAGEMENT_SETUP.md](ROLE_MANAGEMENT_SETUP.md) - Role management setup
- [ROLE_INTEGRATION_EXAMPLES.md](ROLE_INTEGRATION_EXAMPLES.md) - Code examples
- [ROLE_MANAGEMENT_SUMMARY.md](ROLE_MANAGEMENT_SUMMARY.md) - System overview

## Quick Reference

**Access**: `/admin/permissions` (admin only)

**Common Tasks**:
- ✅ View all permissions: Open page
- ✅ Add permission to role: Click checkbox
- ✅ Create permission: Click "Add Permission"
- ✅ Delete permission: Click trash icon

**Remember**:
- Changes are immediate
- Always test in development first
- Keep admin permissions intact
- Use dot notation for naming
- Validate on backend
