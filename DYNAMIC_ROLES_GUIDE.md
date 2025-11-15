# Dynamic Roles System Guide

## Overview

The system has been upgraded to support **custom roles** beyond the three system roles (admin, researcher, viewer). You can now create any number of custom roles with their own permissions.

## What Changed

### 1. Database Changes (Migration 002)

**File**: `supabase/migrations/002_dynamic_roles.sql`

**Changes**:
- Converted `user_role` from ENUM to TEXT
- Created new `roles` table for dynamic role management
- System roles (admin, researcher, viewer) are protected and cannot be deleted
- Custom roles can be created, modified, and deleted

**Run the migration**:
```sql
-- Copy contents of 002_dynamic_roles.sql and run in Supabase SQL Editor
```

### 2. TypeScript Types Updated

**File**: `frontend/types/roles.ts`

**Changes**:
- `UserRole` is now `string` instead of literal union
- New `RoleData` interface for role metadata
- Helper functions for dynamic role display
- Backwards compatible with existing code

### 3. UI Component Updated

**File**: `frontend/components/RolePermissionsManager.tsx`

**New Features**:
- **"Add Role" button**: Create custom roles
- **Dynamic role columns**: Table adjusts to show all roles
- **Delete custom roles**: Trash icon appears for non-system roles
- **Color coding**: Custom roles get emerald color, system roles keep original colors

## How to Use

### Create a Custom Role

1. Go to `/admin/permissions`
2. Click "Add Role" button (purple)
3. Fill in:
   - **Role Name**: Internal identifier (e.g., `analyst`, `manager`)
   - **Display Name**: What users see (e.g., "Data Analyst")
   - **Description**: Purpose of the role
4. Click "Create Role"

**Example Custom Roles**:
- **auditor**: Internal audit access
- **analyst**: Data analysis permissions
- **manager**: Team management capabilities
- **support**: Customer support access
- **contractor**: Limited external access

### Assign Permissions to Custom Role

After creating a role:
1. The role appears as a new column in the permissions matrix
2. Click checkboxes to assign/remove permissions
3. Changes save immediately

### Delete a Custom Role

1. Find the role column
2. Click the trash icon under the role name
3. Confirm deletion
4. ⚠️ Users with this role will need reassignment

## Features

### System Roles (Protected)

These roles **cannot be deleted**:
- **admin**: Full system access
- **researcher**: Document and chat management
- **viewer**: Read-only access

### Custom Roles (Can be deleted)

- Appear in emerald color
- Can be deleted if no users assigned
- Same permission system as system roles
- Fully customizable

### Visual Indicators

```
┌─────────────────┬─────────┬────────────┬─────────┬──────────┐
│  Permission     │  Admin  │ Researcher │ Viewer  │ Analyst  │
│                 │(System) │  (System)  │(System) │ (Custom) │
│                 │ Purple  │    Blue    │  Gray   │ Emerald  │
├─────────────────┼─────────┼────────────┼─────────┼──────────┤
│documents.upload │    ✅    │     ✅      │    ❌    │    ✅     │
│documents.view   │    ✅    │     ✅      │    ✅    │    ✅     │
│reports.export   │    ✅    │     ❌      │    ❌    │    ✅     │
└─────────────────┴─────────┴────────────┴─────────┴──────────┘
```

## Database Schema

### roles Table

```sql
CREATE TABLE public.roles (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,           -- e.g., 'analyst', 'manager'
  display_name TEXT NOT NULL,          -- e.g., 'Data Analyst'
  description TEXT,                    -- Role purpose
  is_system_role BOOLEAN DEFAULT false, -- true = cannot delete
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by UUID
);
```

### Constraints

- **name**: Must be lowercase, alphanumeric + underscores only
- **is_system_role**: System roles cannot be deleted
- **Foreign keys**: user_profiles.role references roles.name

## Migration Steps

### Step 1: Run Migration 002

```bash
# In Supabase SQL Editor
# Copy and run: supabase/migrations/002_dynamic_roles.sql
```

### Step 2: Verify Migration

```sql
-- Check roles table exists
SELECT * FROM public.roles;

-- Should show 3 system roles:
-- admin, researcher, viewer

-- Check user_profiles updated
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'role';

-- Should show: role | text
```

### Step 3: Test Creating a Role

1. Navigate to `/admin/permissions`
2. Click "Add Role"
3. Create test role:
   - Name: `tester`
   - Display: `Tester`
   - Description: `Testing role`
4. Verify it appears in the table

### Step 4: Assign Permissions

1. Click checkboxes under "Tester" column
2. Verify permissions save
3. Check database:
   ```sql
   SELECT r.role, p.name
   FROM role_permissions r
   JOIN permissions p ON r.permission_id = p.id
   WHERE r.role = 'tester';
   ```

## Use Cases

### Use Case 1: Departmental Roles

**Scenario**: Different departments need different access

**Solution**:
```
analyst        -> reports.view, analytics.view, documents.view
finance        -> finance.view, finance.edit, reports.export
hr             -> users.view, hr_records.view, hr_records.edit
legal          -> documents.view, legal_docs.edit, compliance.view
```

### Use Case 2: Temporary Access

**Scenario**: Contractors need limited access

**Solution**:
- Create `contractor` role
- Assign minimal permissions
- Delete role when contract ends

### Use Case 3: Hierarchical Access

**Scenario**: Managers need team member permissions + more

**Solution**:
- Create `team_member` role (base permissions)
- Create `team_lead` role (base + lead permissions)
- Create `manager` role (base + lead + management permissions)

## Code Examples

### Check Permission (Works with Custom Roles)

```typescript
import { usePermission } from '@/hooks/useRole';

function MyComponent() {
  // Works for any role - no code changes needed!
  const { hasPermission } = usePermission('reports.export');

  return hasPermission ? <ExportButton /> : null;
}
```

### Display Role Badge (Dynamic)

```typescript
import { RoleBadge } from '@/components/RoleBadge';

// Automatically shows correct display name and color
<RoleBadge role={user.role} />

// Works for:
// - admin (purple)
// - researcher (blue)
// - viewer (gray)
// - analyst (emerald) <- custom role
// - any other custom role (emerald)
```

### Load All Roles

```typescript
import { createClient } from '@/utils/supabase/client';

async function loadRoles() {
  const supabase = createClient();

  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .order('is_system_role', { ascending: false })
    .order('name');

  return roles; // Array of all roles
}
```

## Best Practices

### 1. Role Naming

✅ **Good**:
- `analyst` (short, clear)
- `team_lead` (descriptive)
- `external_auditor` (specific)

❌ **Bad**:
- `TheAnalystRole` (not lowercase)
- `analyst role` (has space)
- `a` (too vague)

### 2. Role Granularity

**Too Many Roles** (❌):
- `analyst_finance`
- `analyst_sales`
- `analyst_marketing`

**Better** (✅):
- `analyst` (with appropriate permissions)
- Use permissions to differentiate access

### 3. Before Deleting a Role

```sql
-- Check if users have this role
SELECT COUNT(*) FROM user_profiles WHERE role = 'contractor';

-- If count > 0, reassign users first:
UPDATE user_profiles
SET role = 'viewer'
WHERE role = 'contractor';

-- Then delete the role
DELETE FROM roles WHERE name = 'contractor';
```

### 4. Testing New Roles

1. Create test user account
2. Assign custom role
3. Test all features
4. Verify permissions work
5. Deploy to production

## Troubleshooting

### Can't create role

**Error**: `duplicate key value violates unique constraint`

**Solution**: Role name already exists. Choose different name.

### Can't delete role

**Error**: `update or delete on table "roles" violates foreign key constraint`

**Solution**: Users are assigned to this role. Reassign users first.

### Role doesn't appear in dropdown

**Issue**: UserManagement component shows hardcoded roles

**Solution**: The UserManagement component needs updating to load roles dynamically. This is a known limitation that will be addressed.

**Workaround**: Use SQL to assign custom roles:
```sql
UPDATE user_profiles
SET role = 'analyst'
WHERE email = 'user@example.com';
```

### Permission check fails for custom role

**Issue**: `ROLE_PERMISSIONS` object doesn't include custom role

**Solution**: The system now checks database, not hardcoded object. The permission check should work. If not, verify:

1. Role exists in `roles` table
2. Permissions assigned in `role_permissions` table
3. User's `user_profiles.role` matches role name exactly

## API Reference

### Create Role

```typescript
const { error } = await supabase
  .from('roles')
  .insert({
    name: 'analyst',
    display_name: 'Data Analyst',
    description: 'Analyzes data and generates reports',
    is_system_role: false
  });
```

### Get All Roles

```typescript
const { data: roles } = await supabase
  .from('roles')
  .select('*')
  .order('name');
```

### Update Role

```typescript
const { error } = await supabase
  .from('roles')
  .update({
    display_name: 'Senior Analyst',
    description: 'Updated description'
  })
  .eq('name', 'analyst');
```

### Delete Role

```typescript
const { error } = await supabase
  .from('roles')
  .delete()
  .eq('name', 'analyst')
  .eq('is_system_role', false); // Safety check
```

### Assign User to Custom Role

```typescript
const { error } = await supabase
  .from('user_profiles')
  .update({ role: 'analyst' })
  .eq('id', userId);
```

## Migration Checklist

- [ ] Run migration 002_dynamic_roles.sql
- [ ] Verify 3 system roles exist in `roles` table
- [ ] Verify `user_profiles.role` is TEXT type
- [ ] Test creating a custom role
- [ ] Test assigning permissions to custom role
- [ ] Test deleting custom role
- [ ] Update UserManagement component (if needed)
- [ ] Test with real user accounts
- [ ] Document custom roles for your organization

## Next Steps

1. **Run the migration** (002_dynamic_roles.sql)
2. **Test the interface** at `/admin/permissions`
3. **Create custom roles** for your organization
4. **Assign permissions** to each role
5. **Assign users** to appropriate roles
6. **Monitor and adjust** as needed

## Support

For issues or questions:
- Check [PERMISSIONS_MANAGEMENT_GUIDE.md](PERMISSIONS_MANAGEMENT_GUIDE.md)
- Check [ROLE_MANAGEMENT_TROUBLESHOOTING.md](ROLE_MANAGEMENT_TROUBLESHOOTING.md)
- Review migration logs in Supabase dashboard

## Summary

✅ **What You Can Do Now**:
- Create unlimited custom roles
- Delete custom roles
- Assign any permissions to any role
- Dynamic role display in UI
- Full backwards compatibility

🔒 **Protected**:
- System roles cannot be deleted
- Database constraints prevent orphaned users
- Row-level security still enforced

The role system is now fully dynamic and production-ready! 🎉
