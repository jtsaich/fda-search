# Role Management Quick Start

## 🚀 Quick Setup (5 minutes)

### Step 1: Run Database Migration

Copy and execute the SQL from [supabase/migrations/001_role_management.sql](supabase/migrations/001_role_management.sql) in your Supabase SQL Editor.

### Step 2: Create First Admin

After signing up, run this in Supabase SQL Editor:

```sql
UPDATE public.user_profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### Step 3: Access User Management

Navigate to `/admin/users` to manage users and roles.

---

## 📚 Roles & Permissions

| Role | Permissions |
|------|------------|
| **Admin** | Full access including user management |
| **Researcher** | Upload/delete documents, manage chats |
| **Viewer** | View documents, create chats (read-only) |

---

## 💡 Common Usage Examples

### Protect a Component

```tsx
import { ProtectedComponent } from '@/components/ProtectedComponent';

<ProtectedComponent permission="documents.upload">
  <UploadButton />
</ProtectedComponent>
```

### Check Permission in Code

```tsx
import { usePermission } from '@/hooks/useRole';

function MyComponent() {
  const { hasPermission } = usePermission('documents.delete');

  if (hasPermission) {
    return <DeleteButton />;
  }
}
```

### Server-Side Protection

```tsx
import { isAdminServer } from '@/lib/roles';

export default async function AdminPage() {
  const admin = await isAdminServer();
  if (!admin) redirect('/');

  return <AdminContent />;
}
```

### Show Role Badge

```tsx
import { RoleBadge } from '@/components/RoleBadge';

<RoleBadge role={user.role} />
```

---

## 🔧 Files Created

**Database:**
- [supabase/migrations/001_role_management.sql](supabase/migrations/001_role_management.sql)

**Types:**
- [frontend/types/roles.ts](frontend/types/roles.ts)

**Utilities:**
- [frontend/lib/roles.ts](frontend/lib/roles.ts)
- [frontend/hooks/useRole.ts](frontend/hooks/useRole.ts)

**Components:**
- [frontend/components/ProtectedComponent.tsx](frontend/components/ProtectedComponent.tsx)
- [frontend/components/RoleBadge.tsx](frontend/components/RoleBadge.tsx)
- [frontend/components/UserManagement.tsx](frontend/components/UserManagement.tsx)

**Pages:**
- [frontend/app/admin/users/page.tsx](frontend/app/admin/users/page.tsx)

**Documentation:**
- [ROLE_MANAGEMENT_SETUP.md](ROLE_MANAGEMENT_SETUP.md) - Comprehensive guide

---

## 🎯 Next Steps

1. ✅ Run the migration
2. ✅ Create your first admin user
3. ✅ Visit `/admin/users` to test
4. Add `<ProtectedComponent>` to sensitive features
5. Implement role checks in API routes

For detailed documentation, see [ROLE_MANAGEMENT_SETUP.md](ROLE_MANAGEMENT_SETUP.md).
