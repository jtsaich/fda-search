# Role Management System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     FDA RAG Assistant                            │
│                  Role Management System                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│    Admin     │      │  Researcher  │      │    Viewer    │
│              │      │              │      │              │
│ Full Access  │      │ Doc + Chat   │      │  Read Only   │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       └─────────────────────┴─────────────────────┘
                            │
                ┌───────────▼────────────┐
                │   Supabase Auth        │
                │   (Authentication)     │
                └───────────┬────────────┘
                            │
                ┌───────────▼────────────┐
                │  user_profiles Table   │
                │  (Role Assignment)     │
                └───────────┬────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    ┌───────▼────┐  ┌──────▼──────┐  ┌────▼─────┐
    │permissions │  │role_        │  │   RLS    │
    │   table    │  │permissions  │  │ Policies │
    └────────────┘  └─────────────┘  └──────────┘
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                      Database Tables                             │
└─────────────────────────────────────────────────────────────────┘

auth.users                     public.user_profiles
┌─────────────┐               ┌──────────────────┐
│ id (PK)     │◄──────────────┤ id (PK, FK)      │
│ email       │               │ email            │
│ created_at  │               │ role             │
└─────────────┘               │ created_at       │
                              │ updated_at       │
                              │ created_by       │
                              └──────────────────┘

public.permissions            public.role_permissions
┌─────────────┐               ┌──────────────────┐
│ id (PK)     │◄──────────────┤ role             │
│ name        │               │ permission_id(FK)│
│ description │               └──────────────────┘
└─────────────┘
```

## Permission Flow

```
User Action
    │
    ▼
┌────────────────────────────┐
│  1. Client-Side Check      │
│  (UX Only - Show/Hide UI)  │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│  2. API Request            │
│  (With Auth Token)         │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│  3. Server-Side Check      │
│  (Security - Validate)     │
└────────┬───────────────────┘
         │
         ├─── hasPermission? ────┐
         │                       │
         ▼                       ▼
    ┌────────┐            ┌───────────┐
    │ ALLOW  │            │  DENY     │
    │ Action │            │  403/401  │
    └────────┘            └───────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Application                            │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────┐
│  Page Component    │
│  (Server)          │
│                    │
│  await             │
│  isAdminServer()   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐       ┌──────────────────┐
│  Client Component  │──────▶│  Role Hooks      │
│                    │       │                  │
│  usePermission()   │       │  useUserProfile  │
│  useIsAdmin()      │       │  useRole         │
│  useRole()         │       │  usePermissions  │
└────────┬───────────┘       └──────────────────┘
         │
         ▼
┌────────────────────┐
│ ProtectedComponent │
│                    │
│ Conditional Render │
└────────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       User Signup                                │
└─────────────────────────────────────────────────────────────────┘

User Signs Up
     │
     ▼
Supabase Auth
creates user
     │
     ▼
Trigger fires:
handle_new_user()
     │
     ▼
user_profiles row
created with
role = 'viewer'
     │
     ▼
User can now login
and use the app

┌─────────────────────────────────────────────────────────────────┐
│                    Permission Check                              │
└─────────────────────────────────────────────────────────────────┘

Client calls
hasPermission('documents.upload')
     │
     ▼
Get user_profiles
for current user
     │
     ▼
Get user's role
(e.g., 'researcher')
     │
     ▼
Check role_permissions
for that role
     │
     ▼
Return true/false
```

## File Organization

```
fda-search/
│
├── supabase/
│   └── migrations/
│       ├── README.md
│       └── 001_role_management.sql ←── Database schema
│
├── frontend/
│   ├── types/
│   │   └── roles.ts ←────────────────── TypeScript types
│   │
│   ├── lib/
│   │   └── roles.ts ←────────────────── Client/Server utilities
│   │
│   ├── hooks/
│   │   └── useRole.ts ←──────────────── React hooks
│   │
│   ├── components/
│   │   ├── ProtectedComponent.tsx ←──── Wrapper component
│   │   ├── RoleBadge.tsx ←───────────── Display badge
│   │   └── UserManagement.tsx ←──────── Admin UI
│   │
│   └── app/
│       └── admin/
│           └── users/
│               └── page.tsx ←─────────── Admin page
│
└── Documentation/
    ├── ROLE_MANAGEMENT_SUMMARY.md ←───── Overview
    ├── ROLE_MANAGEMENT_QUICKSTART.md ←── Quick start
    ├── ROLE_MANAGEMENT_SETUP.md ←─────── Setup guide
    └── ROLE_INTEGRATION_EXAMPLES.md ←─── Code examples
```

## Role Hierarchy

```
                    ┌──────────┐
                    │  ADMIN   │
                    │          │
                    │  Can do  │
                    │everything│
                    └─────┬────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼─────┐   ┌────▼─────┐   ┌────▼─────┐
    │  Manage   │   │  Full    │   │  Full    │
    │  Users    │   │Researcher│   │  Viewer  │
    │  & Roles  │   │  Access  │   │  Access  │
    └───────────┘   └──────────┘   └──────────┘

                    ┌──────────────┐
                    │  RESEARCHER  │
                    │              │
                    │Upload/Manage │
                    │  Documents   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼──┐   ┌────▼────┐  ┌───▼────┐
        │ Upload │   │ Delete  │  │ Manage │
        │  Docs  │   │  Docs   │  │  Chats │
        └────────┘   └─────────┘  └────────┘

                    ┌──────────────┐
                    │   VIEWER     │
                    │              │
                    │  Read Only   │
                    │    Access    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼──┐   ┌────▼────┐  ┌───▼────┐
        │  View  │   │  View   │  │ Create │
        │  Docs  │   │  Chats  │  │  Chats │
        └────────┘   └─────────┘  └────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     Security Layers                              │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Authentication
┌────────────────────────┐
│  Is user logged in?    │  ←── Supabase Auth
│  Valid JWT token?      │
└────────┬───────────────┘
         │ YES
         ▼
Layer 2: Row Level Security (RLS)
┌────────────────────────┐
│  Database policies     │  ←── Supabase RLS
│  User can only access  │
│  authorized data       │
└────────┬───────────────┘
         │ YES
         ▼
Layer 3: Role Check
┌────────────────────────┐
│  Does user have role?  │  ←── user_profiles
│  (admin/researcher/    │
│   viewer)              │
└────────┬───────────────┘
         │ YES
         ▼
Layer 4: Permission Check
┌────────────────────────┐
│  Does role have        │  ←── role_permissions
│  required permission?  │
└────────┬───────────────┘
         │ YES
         ▼
    ┌────────┐
    │ GRANT  │
    │ ACCESS │
    └────────┘
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│              Where Roles Are Checked                             │
└─────────────────────────────────────────────────────────────────┘

UI Components               Server Actions
┌──────────────┐           ┌──────────────┐
│  Upload Btn  │──Check──▶ │  /api/upload │
└──────────────┘           └──────────────┘
       │                          │
       │ usePermission()          │ hasPermissionServer()
       │                          │
       ▼                          ▼
  Show/Hide                  Allow/Deny
     Button                   Request


Pages                       API Routes
┌──────────────┐           ┌──────────────┐
│ /admin/users │──Check──▶ │GET /api/users│
└──────────────┘           └──────────────┘
       │                          │
       │ isAdminServer()          │ isAdminServer()
       │                          │
       ▼                          ▼
 Allow Access               Return Data
  or Redirect               or 403 Error
```

## User Journey

```
1. New User Signs Up
   ↓
2. Automatically assigned 'viewer' role
   ↓
3. Can view documents and create chats
   ↓
4. Admin promotes user to 'researcher'
   ↓
5. Can now upload and manage documents
   ↓
6. Admin promotes user to 'admin'
   ↓
7. Can now manage users and roles
```

## Best Practices

```
✅ DO:
- Always check permissions server-side
- Use ProtectedComponent for UI elements
- Show loading states during permission checks
- Provide clear error messages
- Log permission denials for audit

❌ DON'T:
- Rely only on client-side checks for security
- Send sensitive data to unauthorized users
- Expose admin functionality in the UI without checks
- Skip permission validation in API routes
- Allow users to modify their own roles
```

## Testing Strategy

```
Unit Tests
    ↓
Test permission checking functions
    ↓
Integration Tests
    ↓
Test role assignment and updates
    ↓
E2E Tests
    ↓
Test user workflows for each role
    ↓
Security Tests
    ↓
Attempt unauthorized access
    ↓
All tests should pass ✓
```

---

For implementation details, see [ROLE_MANAGEMENT_SUMMARY.md](ROLE_MANAGEMENT_SUMMARY.md).
