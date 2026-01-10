from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt, ExpiredSignatureError
from typing import Optional
import logging
from settings import settings
from database import get_db_connection

logger = logging.getLogger("auth")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_cursor():
    conn = get_db_connection()
    # Ensure the connection is alive; reconnect if needed
    try:
        conn.ping(reconnect=True, attempts=3, delay=1)
    except Exception as e:
        # If ping fails, force a fresh connection
        logger.warning(f"[auth] DB ping failed, getting fresh connection: {e}")
        conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        yield cursor
    finally:
        try:
            cursor.close()
        finally:
            try:
                conn.close()
            except Exception as e:
                logger.warning(f"[auth] Failed to close DB connection: {e}")


def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme), cursor = Depends(get_cursor)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Bypass for public paths
    if request.url.path in settings.public_paths and not token:
        return None

    if not token:
        logger.info(f"[auth] Missing token for path: {request.url.path}")
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id_raw = payload.get("sub")
        try:
            user_id: Optional[int] = int(user_id_raw) if user_id_raw is not None else None
        except (TypeError, ValueError):
            user_id = None
            
        jti: Optional[str] = payload.get("jti")
        
        if user_id is None:
            raise credentials_exception

        # Check token revocation
        # Note: We assume the table `revoked_tokens` exists. 
        # Ideally, use a caching layer (Redis) for revocation lists in high-scale prod.
        if jti:
            cursor.execute("SELECT id FROM revoked_tokens WHERE jti = %s", (jti,))
            if cursor.fetchone():
                logger.info(f"[auth] Token revoked (jti matched) for user_id={user_id}")
                raise credentials_exception
        
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except JWTError as e:
        logger.warning(f"[auth] JWT decode error: {e}")
        raise credentials_exception

    # Fetch user
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        raise credentials_exception
        
    return user


def get_user_roles(cursor, user_id: int):
    try:
        cursor.execute(
            """
            SELECT r.role
            FROM role_attribution ra
            JOIN roles r ON r.id = ra.roles_id
            WHERE ra.users_id = %s
            """,
            (user_id,),
        )
        rows = cursor.fetchall() or []
        return [str(r.get("role")).lower() for r in rows if r and r.get("role") is not None]
    except Exception:
        logger.exception("[auth] Failed to fetch user roles")
        return []


def has_role(cursor, user_id: int, role_name: str) -> bool:
    roles = get_user_roles(cursor, user_id)
    return role_name.lower() in roles

