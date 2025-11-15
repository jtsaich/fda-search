# Role Management Troubleshooting Guide

## Error: Infinite Recursion in RLS Policy

### Problem
```
Error fetching user profile: {
  code: '42P17',
  message: 'infinite recursion detected in policy for relation "user_profiles"'
}
```

### Why This Happens
The RLS policies on `user_profiles` try to check if a user is an admin by reading from `user_profiles`, which triggers the same policy again, creating infinite recursion.

### Solution: Apply the Fix

Run **ONE** of these fixes in your Supabase SQL Editor:

---

## Fix Option 1: Simple Policy Fix (Recommended)

**File**: `supabase/migrations/001_role_management_simple_rls.sql`

This is the simplest and most reliable fix:

```sql
-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;

-- Disable then re-enable RLS
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Simple policy: All authenticated users can read user_profiles
CREATE POLICY "Authenticated users can read profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Recreate is_admin as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM public.user_profiles
    WHERE id = user_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Admins can modify
CREATE POLICY "Admins can insert profiles"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update profiles"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
```

**Why this works**:
- All authenticated users can read profiles (no recursion)
- Only admins can modify (uses SECURITY DEFINER function)
- Your app code still controls who sees what via permissions

---

## Fix Option 2: LIMIT 1 Approach

**File**: `supabase/migrations/001_role_management_fix_policies.sql`

This fixes recursion by limiting the subquery:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all (note the LIMIT 1)
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

-- Admins can update
CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles
  FOR UPDATE
  USING (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

-- Admins can delete
CREATE POLICY "Admins can delete profiles"
  ON public.user_profiles
  FOR DELETE
  USING (
    (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );
```

---

## Fix Option 3: Disable RLS (Development Only)

**Only use this for development/testing!**

```sql
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
```

This removes all RLS protection. Your application code must handle all security.

**To re-enable later**, use Fix Option 1 above.

---

## Verification

After applying any fix, verify it works:

```sql
-- Check policies
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- Test reading profiles (should work)
SELECT id, email, role FROM public.user_profiles LIMIT 5;

-- Test is_admin function
SELECT public.is_admin(auth.uid());
```

---

## Common Issues After Fix

### Issue: Still getting recursion error

**Solution**: Make sure you dropped ALL old policies before creating new ones.

```sql
-- Drop ALL policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'user_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
  END LOOP;
END $$;

-- Then apply Fix Option 1 above
```

### Issue: "permission denied for table user_profiles"

**Solution**: Grant necessary permissions:

```sql
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
```

### Issue: Frontend still shows error

**Solution**:
1. Clear browser cache and cookies
2. Sign out and sign back in
3. Check browser console for the actual error
4. Verify the Supabase client is using the correct URL/key

---

## Testing Your Fix

### Test 1: Can read own profile

```typescript
// In browser console or component
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', user.id)
  .single();

console.log('My profile:', profile);
```

Should return your profile without errors.

### Test 2: Can read all profiles (if admin)

```typescript
const { data: profiles } = await supabase
  .from('user_profiles')
  .select('*');

console.log('All profiles:', profiles);
```

Should work if you're an admin.

### Test 3: Role hooks work

```typescript
import { useUserProfile } from '@/hooks/useRole';

function TestComponent() {
  const { profile, loading, error } = useUserProfile();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Role: {profile?.role}</div>;
}
```

Should show your role without errors.

---

## Prevention

To avoid this issue in the future:

1. **Always use SECURITY DEFINER** for functions that need to bypass RLS
2. **Keep policies simple** - complex policies = more recursion risk
3. **Test policies** in SQL editor before deploying
4. **Use application-level security** in addition to RLS

---

## Understanding the Fix

### What Caused the Problem

```sql
-- BAD (causes recursion):
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles  -- ⚠️ Reading from same table!
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

When Postgres evaluates this policy:
1. User tries to read from `user_profiles`
2. Policy checks if user is admin by reading `user_profiles`
3. That read triggers the same policy again
4. Loop continues forever = infinite recursion

### Why the Fix Works

**Fix Option 1** (Simple - All authenticated can read):
```sql
CREATE POLICY "Authenticated users can read profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);  -- ✅ No subquery, no recursion
```

No recursion because there's no subquery reading from the same table.

**Fix Option 2** (LIMIT 1):
```sql
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    (SELECT role FROM public.user_profiles
     WHERE id = auth.uid()
     LIMIT 1) = 'admin'  -- ✅ LIMIT 1 stops recursion
  );
```

The `LIMIT 1` tells Postgres to stop after finding one row, preventing infinite loops.

**SECURITY DEFINER Function**:
```sql
CREATE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- ✅ Bypasses RLS
STABLE
AS $$
BEGIN
  RETURN (SELECT role = 'admin' FROM public.user_profiles WHERE id = user_id);
END;
$$;
```

`SECURITY DEFINER` makes the function run with the permissions of the function owner, bypassing RLS.

---

## Recommended Approach

For production, use **Fix Option 1** (Simple RLS):

**Pros**:
- No recursion risk
- Simpler to understand
- Better performance
- Still secure (app code validates permissions)

**Cons**:
- All authenticated users can read all profiles (but can't modify)
- Need application-level filtering

**Security Note**: This is actually fine because:
1. Users can't modify other profiles (RLS prevents this)
2. Your application code checks permissions before showing data
3. API endpoints validate roles server-side
4. Sensitive operations still require admin role

---

## Need More Help?

1. Check Supabase logs in Dashboard → Logs → Postgres Logs
2. Test queries directly in SQL Editor
3. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_profiles';`
4. Check policies: `SELECT * FROM pg_policies WHERE tablename = 'user_profiles';`

---

## Quick Commands Reference

```sql
-- See all policies
\dp public.user_profiles

-- See RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Drop all policies on a table
DROP POLICY IF EXISTS policy_name ON public.user_profiles;

-- Disable RLS temporarily
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
```
