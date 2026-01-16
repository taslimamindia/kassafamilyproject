from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt, ExpiredSignatureError
from typing import Optional
import logging
import asyncio
from settings import settings
from database import get_db_connection

logger = logging.getLogger("auth")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


class AsyncCursor:
    """Async wrapper around mysql-connector cursor and connection using threadpool.
    Provides awaitable execute/fetch methods and commit/close helpers.
    """
    def __init__(self, conn):
        # dictionary=True for convenient dict rows across the app
        self._conn = conn
        self._cursor = conn.cursor(dictionary=True)

    async def execute(self, sql: str, params: Optional[tuple] = None):
        return await asyncio.to_thread(self._cursor.execute, sql, params)

    async def executemany(self, sql: str, seq_params: list):
        return await asyncio.to_thread(self._cursor.executemany, sql, seq_params)

    async def fetchone(self):
        return await asyncio.to_thread(self._cursor.fetchone)

    async def fetchall(self):
        return await asyncio.to_thread(self._cursor.fetchall)

    @property
    def rowcount(self) -> int:
        return getattr(self._cursor, "rowcount", 0)

    @property
    def lastrowid(self):
        return getattr(self._cursor, "lastrowid", None)

    async def commit(self):
        return await asyncio.to_thread(self._conn.commit)

    async def rollback(self):
        return await asyncio.to_thread(self._conn.rollback)

    async def close(self):
        # Close cursor then connection, both in threadpool
        try:
            await asyncio.to_thread(self._cursor.close)
        finally:
            try:
                await asyncio.to_thread(self._conn.close)
            except Exception as e:
                logger.warning(f"[auth] Failed to close DB connection: {e}")

async def get_cursor():
    """Async dependency returning an AsyncCursor. Ensures liveness and cleanup."""
    conn = get_db_connection()
    # Ensure the connection is alive; reconnect if needed
    try:
        conn.ping(reconnect=True, attempts=3, delay=1)
    except Exception as e:
        logger.warning(f"[auth] DB ping failed, getting fresh connection: {e}")
        conn = get_db_connection()
    async_cursor = AsyncCursor(conn)
    try:
        yield async_cursor
    finally:
        await async_cursor.close()


def ensure_revoked_tokens_table(cursor):
    try:
        cursor.execute(
            
            """
            CREATE TABLE IF NOT EXISTS revoked_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                jti VARCHAR(36),
                token TEXT,
                expires DATETIME,
                INDEX idx_jti (jti)
            ) ENGINE=InnoDB;
            """
        )
    except Exception:
        logger.exception("[auth] Failed to ensure revoked_tokens table exists")


async def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme), cursor = Depends(get_cursor)):
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
            # Ensure table exists to avoid 500 on first verify (sync helper)
            # Note: lifespan ensures it as well.
            # For async cursor, run the check using await.
            try:
                await cursor.execute("SELECT id FROM revoked_tokens WHERE jti = %s", (jti,))
                if await cursor.fetchone():
                    logger.info(f"[auth] Token revoked (jti matched) for user_id={user_id}")
                    raise credentials_exception
            except Exception as e:
                # If querying fails (e.g., table missing), treat as not revoked
                logger.warning(f"[auth] Revocation check skipped due to error: {e}")
        
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except JWTError as e:
        logger.warning(f"[auth] JWT decode error: {e}")
        raise credentials_exception

    # Fetch user
    await cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = await cursor.fetchone()
    
    if not user:
        raise credentials_exception
        
    return user


async def get_user_roles(cursor, user_id: int):
    try:
        await cursor.execute(
            """
            SELECT r.role
            FROM role_attribution ra
            JOIN roles r ON r.id = ra.roles_id
            WHERE ra.users_id = %s
            """,
            (user_id,),
        )
        rows = await cursor.fetchall() or []
        return [str(r.get("role")).lower() for r in rows if r and r.get("role") is not None]
    except Exception:
        logger.exception("[auth] Failed to fetch user roles")
        return []


async def has_role(cursor, user_id: int, role_name: str) -> bool:
    roles = await get_user_roles(cursor, user_id)
    return role_name.lower() in roles

