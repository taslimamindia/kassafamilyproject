from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt, ExpiredSignatureError
import logging
from datetime import datetime
from settings import settings
from models.database import get_db
from models.users import Users
from models.auth import RevokedToken  # This model handles the technical blacklist table
from models.access_control import Roles, RoleAttribution

logger = logging.getLogger("auth")


# Standard OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
):
    """
    Decodes the JWT token, checks for revocation in the database,
    and fetches the current user using SQLAlchemy ORM.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    try:
        # 1. Decode JWT using application settings
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except JWTError as e:
        logger.warning(f"[auth] JWT validation failed: {e}")
        raise credentials_exception

    # 2. Check if token is revoked (Blacklist check)
    # This replaces the old manual SQL check for revoked_tokens
    is_revoked = db.query(RevokedToken).filter(RevokedToken.token == token).first()
    if is_revoked:
        logger.warning(f"[auth] Revoked token used for user_id: {user_id}")
        raise credentials_exception

    # 3. Fetch user via ORM
    user = db.query(Users).filter(Users.id == user_id).first()

    if not user:
        raise credentials_exception

    return user


async def get_user_roles(db: Session, user_id: int):
    """
    Fetches user roles by joining roles and role_attribution tables.
    """

    try:
        # SQLAlchemy join logic replaces raw SQL string
        roles = (
            db.query(Roles.role)
            .join(RoleAttribution, Roles.id == RoleAttribution.roles_id)
            .filter(RoleAttribution.users_id == user_id)
            .all()
        )
        return [str(r.role).lower() for r in roles if r.role]
    except Exception as e:
        logger.exception(f"[auth] Failed to fetch user roles: {e}")
        return []


def check_role(required_roles: list):
    """
    FastAPI dependency factory for Role-Based Access Control (RBAC).
    Usage: Depends(check_role(["admin"]))
    """

    async def role_checker(
        db: Session = Depends(get_db), current_user: Users = Depends(get_current_user)
    ):
        user_roles = await get_user_roles(db, current_user.id)
        if not any(role in user_roles for role in required_roles):
            logger.warning(
                f"[auth] Access denied for user {current_user.id}. Required: {required_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
            )
        return True

    return role_checker
