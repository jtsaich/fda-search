# Database Migrations

This directory contains SQL migration files for the FDA RAG Assistant.

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended for First Time)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **+ New query**
4. Copy the contents of the migration file you want to run
5. Paste into the SQL editor
6. Click **Run** or press `Cmd/Ctrl + Enter`

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
# Make sure you're in the project root
cd /path/to/fda-search

# Push all migrations to your Supabase project
supabase db push
```

## Available Migrations

### 001_role_management.sql

**Purpose**: Implements role-based access control system with simple RLS policies

**Creates**:
- User profiles table with role information
- Permissions and role-permissions tables
- Helper functions for permission checking (SECURITY DEFINER)
- Simple Row Level Security (RLS) policies (avoids infinite recursion)
- Automatic user profile creation on signup

**Roles**: Admin, Researcher, Viewer

**Security Approach**:
- Uses simple RLS policies that allow all authenticated users to read profiles
- Admin-only policies for modifications (insert/update/delete)
- Application-level security via permission checks in code
- SECURITY DEFINER functions bypass RLS to prevent recursion

**After running this migration**:

1. Verify the tables were created:
   ```sql
   SELECT tablename FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename IN ('user_profiles', 'permissions', 'role_permissions');
   ```

2. **Backfill existing users (if any)**:
   ```sql
   -- Create profiles for existing users with 'viewer' role
   INSERT INTO public.user_profiles (id, email, role, created_at)
   SELECT id, email, 'viewer'::user_role, created_at
   FROM auth.users
   WHERE id NOT IN (SELECT id FROM public.user_profiles)
   ON CONFLICT (id) DO NOTHING;
   ```

3. Create your first admin user:
   ```sql
   UPDATE public.user_profiles
   SET role = 'admin'
   WHERE email = 'your-email@example.com';
   ```

4. Verify the admin was created:
   ```sql
   SELECT email, role FROM public.user_profiles WHERE role = 'admin';
   ```

5. Test the setup:
   ```sql
   -- Check RLS policies are created
   SELECT tablename, policyname FROM pg_policies
   WHERE tablename = 'user_profiles'
   ORDER BY policyname;

   -- Test is_admin function (should return true if you're admin)
   SELECT public.is_admin(auth.uid());

   -- View all users and their roles
   SELECT email, role, created_at FROM public.user_profiles
   ORDER BY created_at;
   ```

## Migration Best Practices

1. **Always backup your database** before running migrations
2. **Test in development first** before applying to production
3. **Run migrations in order** (001, 002, 003, etc.)
4. **Never modify a migration file** after it has been run in production
5. **Keep migrations idempotent** when possible (use IF NOT EXISTS, etc.)

## Troubleshooting

### Migration Failed

If a migration fails:
1. Check the error message in the SQL editor
2. Verify you have the necessary permissions
3. Check if the migration was partially applied
4. Rollback if needed and fix the issue
5. Re-run the migration

### How to Rollback a Migration

Create a rollback SQL file with the inverse operations:

```sql
-- Example rollback for 001_role_management.sql
DROP FUNCTION IF EXISTS public.is_admin(UUID);
DROP FUNCTION IF EXISTS public.get_user_role(UUID);
DROP FUNCTION IF EXISTS public.user_has_permission(UUID, TEXT);
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.permissions;
DROP TABLE IF EXISTS public.user_profiles;
DROP TYPE IF EXISTS user_role;
```

### Checking Migration Status

```sql
-- See all tables in public schema
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- See all functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public';

-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';
```

## Documentation

For detailed information about the role management system, see:
- [ROLE_MANAGEMENT_SETUP.md](../../ROLE_MANAGEMENT_SETUP.md)
- [ROLE_MANAGEMENT_QUICKSTART.md](../../ROLE_MANAGEMENT_QUICKSTART.md)
- [ROLE_MANAGEMENT_SUMMARY.md](../../ROLE_MANAGEMENT_SUMMARY.md)
