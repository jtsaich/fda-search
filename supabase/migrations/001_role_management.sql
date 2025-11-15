-- Role Management System for FDA RAG Assistant
-- This migration creates tables and policies for role-based access control
-- Uses simple RLS policies to avoid infinite recursion

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for role types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'researcher', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_profiles table to extend auth.users with role information
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(email)
);

-- Create permissions table for granular access control
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role user_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

-- Insert default permissions
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

-- Assign permissions to roles
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

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'viewer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;
DROP POLICY IF EXISTS "Authenticated users can view role permissions" ON public.role_permissions;

-- SIMPLE RLS POLICIES (Avoids infinite recursion)

-- All authenticated users can read user_profiles
-- This allows role checks to work without recursion
-- Security is enforced at the application level
CREATE POLICY "Authenticated users can read profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create helper function to check if user is admin
-- SECURITY DEFINER allows it to bypass RLS when checking roles
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

-- Only admins can modify user_profiles
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

-- RLS Policies for permissions (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for role_permissions (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view role permissions"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Create helper function to check if user has permission
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role user_role;
BEGIN
  -- Get user's role (bypasses RLS because function is SECURITY DEFINER)
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

-- Create helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role AS $$
DECLARE
  user_role user_role;
BEGIN
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id;

  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);

-- Add comment documentation
COMMENT ON TABLE public.user_profiles IS 'Extended user profiles with role information';
COMMENT ON TABLE public.permissions IS 'Available permissions in the system';
COMMENT ON TABLE public.role_permissions IS 'Maps roles to their permissions';
COMMENT ON FUNCTION public.user_has_permission IS 'Check if a user has a specific permission';
COMMENT ON FUNCTION public.get_user_role IS 'Get the role of a user';
COMMENT ON FUNCTION public.is_admin IS 'Check if a user is an admin';

-- Verify setup
SELECT
  'Tables created' as status,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_profiles', 'permissions', 'role_permissions');
