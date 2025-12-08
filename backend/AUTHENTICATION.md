# Authentication & Authorization

This document describes the authentication and authorization system implemented in the FDA RAG API.

## Overview

The backend uses Supabase for authentication and role-based access control (RBAC). Users must be authenticated and have the appropriate permissions to access protected endpoints.

## Setup

### Environment Variables

Add the following to your `.env` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Schema

The permission system expects the following tables in Supabase:

1. **`roles`** table:
   ```sql
   CREATE TABLE roles (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     name TEXT NOT NULL UNIQUE,
     permissions TEXT[] NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **`user_roles`** table:
   ```sql
   CREATE TABLE user_roles (
     user_id UUID REFERENCES auth.users(id),
     role_id UUID REFERENCES roles(id),
     PRIMARY KEY (user_id, role_id),
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

## Permissions

### Document Permissions

- **`documents.delete`** - Allows deletion of documents from the vector database

## Protected Endpoints

### DELETE /documents/{document_id}

Deletes a document and all its vectors from the Pinecone database.

**Required Permission:** `documents.delete`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Document {id} deleted successfully",
  "deleted_by": "user@example.com"
}
```

**Error Responses:**

- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have `documents.delete` permission
- `500 Internal Server Error` - Failed to delete document

## Usage Example

### From Frontend (with Supabase client)

```typescript
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(`${backendUrl}/documents/${documentId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${session?.access_token}`
  }
});

if (response.status === 403) {
  alert('You do not have permission to delete documents');
} else if (response.ok) {
  const data = await response.json();
  console.log(data.message);
}
```

### From cURL

```bash
curl -X DELETE http://localhost:8000/documents/{document_id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Development Mode

If Supabase credentials are not configured, the auth service will log a warning but won't block requests (for development purposes).

**Production:** Ensure Supabase credentials are properly configured to enforce authentication and authorization.

## Adding New Protected Endpoints

To protect an endpoint with permission checking:

```python
from fastapi import Depends
from typing import Dict, Any
from services.auth_service import require_permission

@router.post("/some-endpoint")
async def protected_endpoint(
    current_user: Dict[str, Any] = Depends(require_permission("some.permission"))
):
    # current_user contains: id, email, user_metadata
    user_email = current_user.get("email")
    # Your endpoint logic here
    return {"message": "Success"}
```

## Architecture

### AuthService (`services/auth_service.py`)

- **`get_user_from_token()`** - Verifies JWT token and returns user data
- **`check_permission()`** - Checks if user has a specific permission
- **`get_current_user()`** - FastAPI dependency to get authenticated user
- **`require_permission()`** - Factory function to create permission-checking dependencies

### Flow

1. Client sends request with `Authorization: Bearer <token>` header
2. FastAPI dependency calls `get_current_user()`
3. Token is verified with Supabase
4. User's permissions are checked against required permission
5. Request proceeds if authorized, otherwise returns 401/403

## Testing

To test the permission system:

```bash
# Without token
curl -X DELETE http://localhost:8000/documents/test-id
# Returns: 401 Unauthorized

# With valid token but no permission
curl -X DELETE http://localhost:8000/documents/test-id \
  -H "Authorization: Bearer VALID_TOKEN"
# Returns: 403 Forbidden

# With valid token and permission
curl -X DELETE http://localhost:8000/documents/test-id \
  -H "Authorization: Bearer VALID_TOKEN_WITH_PERMISSION"
# Returns: 200 OK
```
