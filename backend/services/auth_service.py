import os
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_ANON_KEY")
        self.supabase: Optional[Client] = None

        if self.supabase_url and self.supabase_key:
            try:
                self.supabase = create_client(self.supabase_url, self.supabase_key)
                logger.info("Supabase client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self.supabase = None
        else:
            logger.warning("Supabase credentials not found in environment variables")

    async def get_user_from_token(self, authorization: str) -> Dict[str, Any]:
        """Extract and verify user from JWT token"""
        if not self.supabase:
            raise HTTPException(
                status_code=500,
                detail="Authentication service not configured"
            )

        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid authorization header"
            )

        token = authorization.replace("Bearer ", "")

        try:
            # Verify the JWT token with Supabase
            user_response = self.supabase.auth.get_user(token)

            if not user_response or not user_response.user:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid or expired token"
                )

            return {
                "id": user_response.user.id,
                "email": user_response.user.email,
                "user_metadata": user_response.user.user_metadata or {},
            }
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            raise HTTPException(
                status_code=401,
                detail="Authentication failed"
            )

    async def check_permission(
        self,
        user_id: str,
        permission: str
    ) -> bool:
        """Check if user has a specific permission"""
        if not self.supabase:
            logger.warning("Supabase not configured, skipping permission check")
            return True  # Allow in development if Supabase not configured

        try:
            # Get user's role from user_roles table
            role_response = self.supabase.table("user_roles")\
                .select("role_id, roles(permissions)")\
                .eq("user_id", user_id)\
                .execute()

            if not role_response.data:
                logger.warning(f"No role found for user {user_id}")
                return False

            # Check if any of the user's roles has the required permission
            for user_role in role_response.data:
                role_permissions = user_role.get("roles", {}).get("permissions", [])
                if permission in role_permissions:
                    logger.info(f"User {user_id} has permission: {permission}")
                    return True

            logger.warning(f"User {user_id} does not have permission: {permission}")
            return False

        except Exception as e:
            logger.error(f"Permission check failed: {e}")
            return False


# Create singleton instance
auth_service = AuthService()


# FastAPI dependency for getting current user
async def get_current_user(
    authorization: str = Header(None)
) -> Dict[str, Any]:
    """FastAPI dependency to get current authenticated user"""
    return await auth_service.get_user_from_token(authorization)


# FastAPI dependency for checking permissions
def require_permission(permission: str):
    """Factory function to create permission-checking dependency"""
    async def permission_checker(
        current_user: Dict[str, Any] = Depends(get_current_user)
    ) -> Dict[str, Any]:
        """Check if user has required permission"""
        user_id = current_user.get("id")

        has_permission = await auth_service.check_permission(user_id, permission)

        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required: {permission}"
            )

        return current_user

    return permission_checker
