-- Combined Role Management Migration
-- This migration handles both initial setup AND migration to dynamic roles
-- Safe to run even if some tables already exist

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Create user_profiles table if it doesn't exist (with TEXT role)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(email)
);

-- Step 2: If role column exists as ENUM, convert it to TEXT
DO $$
BEGIN
  -- Check if role is an enum type and convert to text
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'role'
    AND udt_name = 'user_role'
  ) THEN
    -- Drop enum constraint if exists
    ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

    -- Convert to TEXT
    ALTER TABLE public.user_profiles ALTER COLUMN role TYPE TEXT;

    -- Drop enum type
    DROP TYPE IF EXISTS user_role CASCADE;
  END IF;
END $$;

-- Step 3: Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create role_permissions table (with TEXT role)
-- Drop and recreate to ensure correct structure
DROP TABLE IF EXISTS public.role_permissions CASCADE;
CREATE TABLE public.role_permissions (
  role TEXT NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

-- Step 5: Create roles table for dynamic role management
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT valid_role_name CHECK (name ~ '^[a-z][a-z0-9_]*$')
);

-- Step 6: Insert system roles
INSERT INTO public.roles (name, display_name, description, is_system_role) VALUES
  ('admin', 'Administrator', 'Full system access including user and role management', true),
  ('researcher', 'Researcher', 'Can upload, manage documents and create chats', true),
  ('viewer', 'Viewer', 'Can view documents and create chats (read-only access)', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_system_role = EXCLUDED.is_system_role;

-- Step 7: Add foreign key constraints
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_fkey;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_fkey
  FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_fkey;
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_fkey
  FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Insert default permissions
INSERT INTO public.permissions (name, description) VALUES
  ('documents.upload', 'Upload and process documents'),
  ('documents.view', 'View uploaded documents'),
  ('documents.delete', 'Delete documents'),
  ('chat.create', 'Create new chat sessions'),
  ('chat.view', 'View chat history'),
  ('chat.delete', 'Delete chat sessions'),
  ('users.view', 'View user list'),
  ('users.manage', 'Create, update, and delete users'),
  ('roles.manage', 'Manage user roles and permissions')
ON CONFLICT (name) DO NOTHING;

-- Step 9: Assign permissions to roles
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'researcher', id FROM public.permissions
WHERE name IN (
  'documents.upload',
  'documents.view',
  'documents.delete',
  'chat.create',
  'chat.view',
  'chat.delete'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'viewer', id FROM public.permissions
WHERE name IN (
  'documents.view',
  'chat.create',
  'chat.view'
)
ON CONFLICT DO NOTHING;

-- Step 10: Create helper functions

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON public.roles;
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if user is admin
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

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id;

  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user's role
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id;

  -- Check if role has the permission
  RETURN EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE rp.role = user_role AND p.name = permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Step 12: Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;
DROP POLICY IF EXISTS "Authenticated users can view role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can create roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can delete custom roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.permissions;
DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;

-- Step 13: Create RLS Policies

-- user_profiles policies
CREATE POLICY "Authenticated users can read profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

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

-- permissions policies
CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage permissions"
  ON public.permissions
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- role_permissions policies
CREATE POLICY "Authenticated users can view role permissions"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- roles policies
CREATE POLICY "Authenticated users can view roles"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can create roles"
  ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.roles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete custom roles"
  ON public.roles
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) AND NOT is_system_role);

-- Step 14: Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.permissions TO authenticated;
GRANT ALL ON public.role_permissions TO authenticated;
GRANT ALL ON public.roles TO authenticated;

-- Step 15: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON public.roles(is_system_role);

-- Step 16: Add comments
COMMENT ON TABLE public.user_profiles IS 'Extended user profiles with role information';
COMMENT ON TABLE public.permissions IS 'Available permissions in the system';
COMMENT ON TABLE public.role_permissions IS 'Maps roles to their permissions';
COMMENT ON TABLE public.roles IS 'Dynamically managed roles in the system';
COMMENT ON COLUMN public.roles.is_system_role IS 'System roles cannot be deleted (admin, researcher, viewer)';
COMMENT ON COLUMN public.roles.name IS 'Internal role identifier (lowercase, underscores only)';
COMMENT ON COLUMN public.roles.display_name IS 'Human-readable role name';

-- Verification
SELECT
  'Migration completed successfully' as status,
  (SELECT COUNT(*) FROM public.roles) as role_count,
  (SELECT COUNT(*) FROM public.permissions) as permission_count,
  (SELECT COUNT(*) FROM public.role_permissions) as role_permission_count;
