"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Check,
  X,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type {
  UserRole,
  Permission,
  PermissionData,
  RoleData,
} from "@/types/roles";
import {
  getRoleDisplayName,
  getRoleDescription,
  getPermissionLabel,
  isSystemRole,
} from "@/types/roles";

export function RolePermissionsManager() {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [rolePermissions, setRolePermissions] = useState<
    Map<UserRole, Set<string>>
  >(new Map());
  const [allPermissions, setAllPermissions] = useState<PermissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddPermission, setShowAddPermission] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newPermission, setNewPermission] = useState({
    name: "",
    description: "",
  });
  const [newRole, setNewRole] = useState({
    name: "",
    display_name: "",
    description: "",
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      // Load all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("*")
        .order("is_system_role", { ascending: false })
        .order("name");

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Load all permissions
      const { data: permissions, error: permError } = await supabase
        .from("permissions")
        .select("*")
        .order("name");

      if (permError) throw permError;
      setAllPermissions(permissions || []);

      // Load role-permission mappings
      const { data: rolePerm, error: rpError } = await supabase.from(
        "role_permissions"
      ).select(`
          role,
          permission_id,
          permissions (
            id,
            name
          )
        `);

      if (rpError) throw rpError;

      // Build role permission map
      const permMap = new Map<UserRole, Set<string>>();

      // Initialize map with all roles
      rolesData?.forEach((role) => {
        permMap.set(role.name, new Set());
      });

      // Populate permissions
      rolePerm?.forEach((rp: any) => {
        const role = rp.role;
        const permName = rp.permissions.name;

        if (!permMap.has(role)) {
          permMap.set(role, new Set());
        }
        permMap.get(role)?.add(permName);
      });

      setRolePermissions(permMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function togglePermission(
    role: UserRole,
    permissionName: string,
    permissionId: string
  ) {
    const currentPerms = rolePermissions.get(role);
    if (!currentPerms) return;

    const hasPermission = currentPerms.has(permissionName);

    try {
      if (hasPermission) {
        // Remove permission
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role", role)
          .eq("permission_id", permissionId);

        if (error) throw error;

        currentPerms.delete(permissionName);
      } else {
        // Add permission
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role, permission_id: permissionId });

        if (error) throw error;

        currentPerms.add(permissionName);
      }

      setRolePermissions(new Map(rolePermissions));
      setSuccess(
        `Permission ${
          hasPermission ? "removed from" : "added to"
        } ${getRoleDisplayName(role, roles)}`
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update permission"
      );
    }
  }

  async function createPermission() {
    if (!newPermission.name.trim()) {
      setError("Permission name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.from("permissions").insert({
        name: newPermission.name.trim(),
        description: newPermission.description.trim() || null,
      });

      if (error) throw error;

      setSuccess("Permission created successfully");
      setNewPermission({ name: "", description: "" });
      setShowAddPermission(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create permission"
      );
    } finally {
      setSaving(false);
    }
  }

  async function createRole() {
    if (!newRole.name.trim() || !newRole.display_name.trim()) {
      setError("Role name and display name are required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.from("roles").insert({
        name: newRole.name.trim().toLowerCase().replace(/\s+/g, "_"),
        display_name: newRole.display_name.trim(),
        description: newRole.description.trim() || null,
        is_system_role: false,
      });

      if (error) throw error;

      setSuccess("Role created successfully");
      setNewRole({ name: "", display_name: "", description: "" });
      setShowAddRole(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setSaving(false);
    }
  }

  async function deletePermission(
    permissionId: string,
    permissionName: string
  ) {
    if (
      !confirm(
        `Are you sure you want to delete the permission "${permissionName}"? This will remove it from all roles.`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("permissions")
        .delete()
        .eq("id", permissionId);

      if (error) throw error;

      setSuccess("Permission deleted successfully");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete permission"
      );
    }
  }

  async function deleteRole(roleId: string, roleName: string) {
    if (isSystemRole(roleName)) {
      setError("System roles cannot be deleted");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete the role "${roleName}"? Users with this role will need to be reassigned.`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.from("roles").delete().eq("id", roleId);

      if (error) throw error;

      setSuccess("Role deleted successfully");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    }
  }

  function getRoleBadgeColor(role: RoleData): string {
    // System roles get special colors
    if (role.name === "admin")
      return "bg-purple-100 text-purple-800 border-purple-200";
    if (role.name === "researcher")
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (role.name === "viewer")
      return "bg-gray-100 text-gray-800 border-gray-200";

    // Custom roles get a distinct color
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
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
          <h2 className="text-2xl font-semibold text-gray-900">
            Role & Permissions Manager
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Create custom roles and configure their permissions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddRole(!showAddRole)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Role
          </button>
          <button
            onClick={() => setShowAddPermission(!showAddPermission)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Permission
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 mt-0.5" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        </div>
      )}

      {showAddRole && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Add New Role
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Name (Internal) *
              </label>
              <input
                type="text"
                value={newRole.name}
                onChange={(e) =>
                  setNewRole({ ...newRole, name: e.target.value })
                }
                placeholder="e.g., analyst, manager, auditor"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lowercase, no spaces (will be converted to lowercase with
                underscores)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={newRole.display_name}
                onChange={(e) =>
                  setNewRole({ ...newRole, display_name: e.target.value })
                }
                placeholder="e.g., Data Analyst, Project Manager"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Human-readable name shown in the UI
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newRole.description}
                onChange={(e) =>
                  setNewRole({ ...newRole, description: e.target.value })
                }
                placeholder="Brief description of this role's purpose and capabilities"
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={createRole}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Role
              </button>
              <button
                onClick={() => {
                  setShowAddRole(false);
                  setNewRole({ name: "", display_name: "", description: "" });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPermission && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Add New Permission
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Permission Name *
              </label>
              <input
                type="text"
                value={newPermission.name}
                onChange={(e) =>
                  setNewPermission({ ...newPermission, name: e.target.value })
                }
                placeholder="e.g., reports.export, analytics.view"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use dot notation: feature.action (e.g., documents.upload)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newPermission.description}
                onChange={(e) =>
                  setNewPermission({
                    ...newPermission,
                    description: e.target.value,
                  })
                }
                placeholder="Brief description of what this permission allows"
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={createPermission}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Permission
              </button>
              <button
                onClick={() => {
                  setShowAddPermission(false);
                  setNewPermission({ name: "", description: "" });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
              >
                Cancel
              </button>
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
                  Permission
                </th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getRoleBadgeColor(
                          role
                        )}`}
                      >
                        <Shield className="h-3 w-3" />
                        {role.display_name}
                      </span>
                      {role.is_system_role && (
                        <span className="text-xs text-gray-400">(System)</span>
                      )}
                      {!role.is_system_role && (
                        <button
                          onClick={() => deleteRole(role.id, role.name)}
                          className="text-xs text-red-600 hover:text-red-700"
                          title="Delete role"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allPermissions.map((permission) => (
                <tr key={permission.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {getPermissionLabel(permission.name)}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {permission.name}
                      </span>
                      {permission.description && (
                        <span className="text-xs text-gray-500 mt-1">
                          {permission.description}
                        </span>
                      )}
                    </div>
                  </td>
                  {roles.map((role) => {
                    const hasPermission =
                      rolePermissions.get(role.name)?.has(permission.name) ||
                      false;
                    return (
                      <td key={role.id} className="px-6 py-4 text-center">
                        <button
                          onClick={() =>
                            togglePermission(
                              role.name,
                              permission.name,
                              permission.id
                            )
                          }
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-colors ${
                            hasPermission
                              ? "bg-green-50 border-green-500 text-green-600 hover:bg-green-100"
                              : "bg-gray-50 border-gray-300 text-gray-400 hover:bg-gray-100"
                          }`}
                          title={
                            hasPermission ? "Click to remove" : "Click to add"
                          }
                        >
                          {hasPermission ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <X className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() =>
                        deletePermission(permission.id, permission.name)
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                      title="Delete permission"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {allPermissions.length === 0 && (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No permissions found</p>
            <button
              onClick={() => setShowAddPermission(true)}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700"
            >
              Create your first permission
            </button>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          Current Roles
        </h3>
        <dl className="space-y-2">
          {roles.map((role) => (
            <div key={role.id} className="flex gap-2">
              <dt className="text-sm font-medium text-blue-800 min-w-[120px] flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    role.is_system_role ? "bg-blue-600" : "bg-emerald-600"
                  }`}
                />
                {role.display_name}:
              </dt>
              <dd className="text-sm text-blue-700">
                {role.description || "No description"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-yellow-700">
              <li>
                System roles (Admin, Researcher, Viewer) cannot be deleted
              </li>
              <li>
                Custom roles can be deleted if no users are assigned to them
              </li>
              <li>Changes take effect immediately for all users</li>
              <li>
                Users may need to refresh their browser to see permission
                changes
              </li>
              <li>Always test new roles in a development environment first</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
