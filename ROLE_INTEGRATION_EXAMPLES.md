# Role Management Integration Examples

This document shows how to integrate role-based access control into existing components.

## Example 1: Protecting Document Upload

### Before (No Role Check)

```tsx
// components/DocumentUpload.tsx
export function DocumentUpload() {
  return (
    <div>
      <input type="file" />
      <button>Upload</button>
    </div>
  );
}
```

### After (With Role Check)

```tsx
// components/DocumentUpload.tsx
import { ProtectedComponent } from '@/components/ProtectedComponent';
import { usePermission } from '@/hooks/useRole';

export function DocumentUpload() {
  const { hasPermission, loading } = usePermission('documents.upload');

  if (loading) return <LoadingSpinner />;

  if (!hasPermission) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          You don't have permission to upload documents.
          Contact your administrator for access.
        </p>
      </div>
    );
  }

  return (
    <div>
      <input type="file" />
      <button>Upload</button>
    </div>
  );
}
```

### Alternative (Using ProtectedComponent)

```tsx
// In parent component
import { ProtectedComponent } from '@/components/ProtectedComponent';
import { DocumentUpload } from '@/components/DocumentUpload';

function DocumentsPage() {
  return (
    <ProtectedComponent
      permission="documents.upload"
      fallback={
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            You don't have permission to upload documents.
          </p>
        </div>
      }
    >
      <DocumentUpload />
    </ProtectedComponent>
  );
}
```

## Example 2: Protecting Document Deletion

```tsx
// components/DocumentList.tsx
import { usePermission } from '@/hooks/useRole';
import { Trash2 } from 'lucide-react';

export function DocumentList({ documents }: { documents: Document[] }) {
  const { hasPermission: canDelete } = usePermission('documents.delete');

  async function handleDelete(docId: string) {
    if (!canDelete) {
      alert('You do not have permission to delete documents');
      return;
    }

    // Delete logic here
  }

  return (
    <div>
      {documents.map(doc => (
        <div key={doc.id} className="flex items-center justify-between">
          <span>{doc.name}</span>
          {canDelete && (
            <button onClick={() => handleDelete(doc.id)}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Example 3: Protecting API Routes (Server-Side)

### Chat API Route

```tsx
// app/api/chat/route.ts
import { createClient } from '@/utils/supabase/server';
import { hasPermissionServer } from '@/lib/roles';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check permission
  const canCreateChat = await hasPermissionServer('chat.create');
  if (!canCreateChat) {
    return NextResponse.json(
      { error: 'Forbidden: You do not have permission to create chats' },
      { status: 403 }
    );
  }

  // Handle chat creation
  // ...
}
```

### Document Upload API Route

```tsx
// app/api/documents/upload/route.ts
import { hasPermissionServer } from '@/lib/roles';

export async function POST(request: Request) {
  // Check permission first
  const canUpload = await hasPermissionServer('documents.upload');
  if (!canUpload) {
    return NextResponse.json(
      { error: 'Forbidden: You do not have permission to upload documents' },
      { status: 403 }
    );
  }

  // Handle upload
  // ...
}
```

## Example 4: Conditional Navigation

```tsx
// components/Navigation.tsx
import Link from 'next/link';
import { usePermissions, useIsAdmin } from '@/hooks/useRole';

export function Navigation() {
  const { permissions } = usePermissions([
    'documents.upload',
    'documents.view',
    'chat.create',
  ]);
  const { isAdmin } = useIsAdmin();

  return (
    <nav className="space-y-2">
      <Link href="/">Home</Link>

      {permissions['chat.create'] && (
        <Link href="/chat/new">New Chat</Link>
      )}

      {permissions['documents.view'] && (
        <Link href="/documents">Documents</Link>
      )}

      {permissions['documents.upload'] && (
        <Link href="/documents/upload">Upload</Link>
      )}

      {isAdmin && (
        <>
          <Link href="/admin/users">User Management</Link>
          <Link href="/admin/settings">Settings</Link>
        </>
      )}
    </nav>
  );
}
```

## Example 5: Role-Based Page Access

```tsx
// app/documents/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionServer } from '@/lib/roles';

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const canView = await hasPermissionServer('documents.view');
  if (!canView) {
    redirect('/?error=forbidden');
  }

  return <DocumentsList />;
}
```

## Example 6: Multiple Permission Checks

```tsx
// components/DocumentActions.tsx
import { usePermissions } from '@/hooks/useRole';

export function DocumentActions({ documentId }: { documentId: string }) {
  const { permissions, loading } = usePermissions([
    'documents.view',
    'documents.delete',
    'documents.upload',
  ]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex gap-2">
      {permissions['documents.view'] && (
        <button onClick={() => viewDocument(documentId)}>
          View
        </button>
      )}

      {permissions['documents.upload'] && (
        <button onClick={() => updateDocument(documentId)}>
          Update
        </button>
      )}

      {permissions['documents.delete'] && (
        <button onClick={() => deleteDocument(documentId)}>
          Delete
        </button>
      )}
    </div>
  );
}
```

## Example 7: Show Different UI Based on Role

```tsx
// components/Dashboard.tsx
import { useUserProfile } from '@/hooks/useRole';

export function Dashboard() {
  const { profile, loading } = useUserProfile();

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1>Welcome, {profile?.email}</h1>

      {profile?.role === 'admin' && (
        <AdminDashboard />
      )}

      {profile?.role === 'researcher' && (
        <ResearcherDashboard />
      )}

      {profile?.role === 'viewer' && (
        <ViewerDashboard />
      )}
    </div>
  );
}
```

## Example 8: Backend Python API Protection

```python
# backend/main.py
from fastapi import FastAPI, HTTPException, Header
from supabase import create_client
import os

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(supabase_url, supabase_key)

async def check_permission(token: str, permission: str) -> bool:
    """Check if user has a specific permission"""
    # Verify JWT token
    user = supabase.auth.get_user(token)
    if not user:
        return False

    # Get user profile with role
    profile = supabase.table('user_profiles')\
        .select('role')\
        .eq('id', user.id)\
        .single()\
        .execute()

    if not profile.data:
        return False

    # Check if role has permission
    has_perm = supabase.rpc('user_has_permission', {
        'user_id': user.id,
        'permission_name': permission
    }).execute()

    return has_perm.data

@app.post("/upload")
async def upload_document(
    file: UploadFile,
    authorization: str = Header(None)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.replace("Bearer ", "")

    # Check permission
    has_permission = await check_permission(token, "documents.upload")
    if not has_permission:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permission to upload documents"
        )

    # Handle upload
    # ...
```

## Example 9: Protecting Chat Features

```tsx
// components/ChatInterface.tsx
import { usePermissions } from '@/hooks/useRole';

export function ChatInterface({ chatId }: { chatId: string }) {
  const { permissions } = usePermissions([
    'chat.create',
    'chat.view',
    'chat.delete',
  ]);

  return (
    <div>
      {permissions['chat.view'] ? (
        <ChatMessages chatId={chatId} />
      ) : (
        <div>You don't have permission to view chats</div>
      )}

      {permissions['chat.create'] && (
        <ChatInput chatId={chatId} />
      )}

      {permissions['chat.delete'] && (
        <button onClick={() => deleteChat(chatId)}>
          Delete Chat
        </button>
      )}
    </div>
  );
}
```

## Example 10: Form Validation with Roles

```tsx
// components/SettingsForm.tsx
import { useIsAdmin } from '@/hooks/useRole';

export function SettingsForm() {
  const { isAdmin } = useIsAdmin();

  async function handleSubmit(data: FormData) {
    // Client-side check
    if (!isAdmin) {
      alert('Only admins can change settings');
      return;
    }

    // Submit to server (which also validates)
    const response = await fetch('/api/settings', {
      method: 'POST',
      body: data,
    });

    if (response.status === 403) {
      alert('Permission denied');
    }
  }

  // Don't even show the form to non-admins
  if (!isAdmin) {
    return <div>Only administrators can access settings</div>;
  }

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## Best Practices

1. **Always validate on server-side**: Client-side checks are for UX, not security
2. **Use ProtectedComponent for simple cases**: Wraps components cleanly
3. **Use hooks for complex logic**: When you need the permission value in your code
4. **Check permissions early**: Validate before expensive operations
5. **Provide clear feedback**: Tell users why they can't access something
6. **Use loading states**: Show spinners while checking permissions
7. **Cache permission checks**: The hooks cache results automatically
8. **Don't expose sensitive data**: Even if UI is hidden, don't send restricted data

## Testing Role-Based Features

```tsx
// Test with different roles
describe('DocumentUpload', () => {
  it('should show upload for researchers', async () => {
    // Mock user as researcher
    mockUseUserProfile.mockReturnValue({
      profile: { role: 'researcher' },
      loading: false,
    });

    render(<DocumentUpload />);
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('should hide upload for viewers', async () => {
    // Mock user as viewer
    mockUseUserProfile.mockReturnValue({
      profile: { role: 'viewer' },
      loading: false,
    });

    render(<DocumentUpload />);
    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
  });
});
```

---

For more information, see [ROLE_MANAGEMENT_SETUP.md](ROLE_MANAGEMENT_SETUP.md).
