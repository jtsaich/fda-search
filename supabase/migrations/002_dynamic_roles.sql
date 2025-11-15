-- Dynamic Role Management System
-- Allows creating custom roles without modifying the enum

-- Drop the old enum-based role constraint
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Change role column from enum to text
ALTER TABLE public.user_profiles ALTER COLUMN role TYPE TEXT;

-- Drop the old enum type (may fail if still in use, that's ok)
DO $$ BEGIN
  DROP TYPE IF EXISTS user_role CASCADE;
EXCEPTION
  WHEN others THEN null;
END $$;

-- Create roles table for dynamic role management
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

-- Insert existing system roles
INSERT INTO public.roles (name, display_name, description, is_system_role) VALUES
  ('admin', 'Administrator', 'Full system access including user and role management', true),
  ('researcher', 'Researcher', 'Can upload, manage documents and create chats', true),
  ('viewer', 'Viewer', 'Can view documents and create chats (read-only access)', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_system_role = EXCLUDED.is_system_role;

-- Update user_profiles to reference roles table
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_fkey
  FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update role_permissions to use text instead of enum
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_pkey;
ALTER TABLE public.role_permissions ALTER COLUMN role TYPE TEXT;
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_fkey
  FOREIGN KEY (role) REFERENCES public.roles(name) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public.role_permissions ADD PRIMARY KEY (role, permission_id);

-- Create trigger to update updated_at on roles
DROP TRIGGER IF EXISTS update_roles_updated_at ON public.roles;
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on roles table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles table
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.roles;
CREATE POLICY "Authenticated users can view roles"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can create roles" ON public.roles;
CREATE POLICY "Admins can create roles"
  ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update roles" ON public.roles;
CREATE POLICY "Admins can update roles"
  ON public.roles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete custom roles" ON public.roles;
CREATE POLICY "Admins can delete custom roles"
  ON public.roles
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) AND NOT is_system_role);

-- Update functions to work with text-based roles
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

-- Grant permissions
GRANT ALL ON public.roles TO authenticated;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON public.roles(is_system_role);

-- Add comments
COMMENT ON TABLE public.roles IS 'Dynamically managed roles in the system';
COMMENT ON COLUMN public.roles.is_system_role IS 'System roles cannot be deleted (admin, researcher, viewer)';
COMMENT ON COLUMN public.roles.name IS 'Internal role identifier (lowercase, underscores only)';
COMMENT ON COLUMN public.roles.display_name IS 'Human-readable role name';

-- Verify migration
SELECT
  'Migration completed' as status,
  COUNT(*) as role_count
FROM public.roles;
