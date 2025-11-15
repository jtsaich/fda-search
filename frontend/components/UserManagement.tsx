"use client";

import { useState, useEffect } from 'react';
import { Shield, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { getAllUsers, updateUserRole, deleteUser } from '@/lib/roles';
import { useUserProfile } from '@/hooks/useRole';
import type { UserProfile, UserRole } from '@/types/roles';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/types/roles';

export function UserManagement() {
  const { profile: currentUserProfile } = useUserProfile();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdatingUserId(userId);
    setError(null);

    const result = await updateUserRole(userId, newRole);

    if (result.success) {
      await loadUsers();
    } else {
      setError(result.error || 'Failed to update role');
    }

    setUpdatingUserId(null);
  }

  async function handleDeleteUser(userId: string, userEmail: string) {
    if (!confirm(`Are you sure you want to delete user ${userEmail}?`)) {
      return;
    }

    setUpdatingUserId(userId);
    setError(null);

    const result = await deleteUser(userId);

    if (result.success) {
      await loadUsers();
    } else {
      setError(result.error || 'Failed to delete user');
    }

    setUpdatingUserId(null);
  }

  function getRoleBadgeColor(role: UserRole): string {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'researcher':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage user roles and permissions
          </p>
        </div>
        <button
          onClick={loadUsers}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">
                        {user.email}
                      </div>
                      {user.id === currentUserProfile?.id && (
                        <span className="text-xs text-gray-500">(You)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-2">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value as UserRole)
                        }
                        disabled={
                          updatingUserId === user.id ||
                          user.id === currentUserProfile?.id
                        }
                        className={`text-sm rounded-lg border px-3 py-1.5 font-medium ${getRoleBadgeColor(
                          user.role
                        )} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <option value="admin">{ROLE_LABELS.admin}</option>
                        <option value="researcher">{ROLE_LABELS.researcher}</option>
                        <option value="viewer">{ROLE_LABELS.viewer}</option>
                      </select>
                      <p className="text-xs text-gray-500">
                        {ROLE_DESCRIPTIONS[user.role]}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {user.id !== currentUserProfile?.id && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={updatingUserId === user.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updatingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No users found</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Role Definitions</h3>
        <dl className="space-y-2">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
            <div key={role} className="flex gap-2">
              <dt className="text-sm font-medium text-blue-800 min-w-[100px]">
                {ROLE_LABELS[role as UserRole]}:
              </dt>
              <dd className="text-sm text-blue-700">{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
