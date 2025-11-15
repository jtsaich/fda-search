import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { isAdminServer } from '@/lib/roles';
import { RolePermissionsManager } from '@/components/RolePermissionsManager';

export default async function AdminPermissionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is admin
  const admin = await isAdminServer();
  if (!admin) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RolePermissionsManager />
      </div>
    </div>
  );
}
