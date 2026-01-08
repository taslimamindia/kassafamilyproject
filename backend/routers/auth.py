from fastapi import APIRouter, Depends, HTTPException, status, Request
from jose import jwt, JWTError
from datetime import datetime, timezone
from typing import Optional

from dependencies import get_cursor, get_current_user, oauth2_scheme
import logging
from models import TokenResponse
from auth_utils import verify_password, create_access_token
from settings import settings

router = APIRouter()
logger = logging.getLogger("auth")

@router.post("/login", response_model=TokenResponse)
async def login(request: Request, cursor = Depends(get_cursor)):
    identifier: Optional[str] = None
    password: Optional[str] = None

    try:
        json_body = await request.json()
        if isinstance(json_body, dict):
            identifier = json_body.get("identifier")
            password = json_body.get("password")
    except Exception as e:
        logger.warning(f"[auth] Failed to parse JSON login payload: {e}")

    if not identifier or not password:
        try:
            form = await request.form()
            identifier = (
                form.get("identifier")
                or form.get("username")
                or form.get("email")
                or form.get("telephone")
            )
            password = form.get("password")
        except Exception as e:
            logger.warning(f"[auth] Failed to parse FORM login payload: {e}")

    if not identifier or not password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing identifier or password")

    cursor.execute(
        """
        SELECT * FROM users
        WHERE username = %s OR email = %s OR telephone = %s
        LIMIT 1
        """,
        (identifier, identifier, identifier),
    )
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(password, user.get("password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": str(user["id"]), "username": user.get("username")})
    return TokenResponse(access_token=token)

@router.get("/verify")
def verify_auth(current_user: dict = Depends(get_current_user)):
    user = dict(current_user) if isinstance(current_user, dict) else current_user
    user.pop("password", None)
    return {"ok": True, "user": user}

@router.post("/logout")
def logout(request: Request, token: Optional[str] = Depends(oauth2_scheme), cursor = Depends(get_cursor)):
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        jti: Optional[str] = payload.get("jti")
        exp: Optional[int] = payload.get("exp")
        expires_dt = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else datetime.now(timezone.utc)

        # Ideally, schemas are created at startup or migration, not here.
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
        cursor.execute(
            "INSERT INTO revoked_tokens (jti, token, expires) VALUES (%s, %s, %s)",
            (jti, token if not jti else None, expires_dt.replace(tzinfo=None)),
        )
        
        # Auto-commit dependent
        try:
            getattr(cursor, "_connection").commit()
        except Exception:
            logger.exception("[auth] Commit failed during logout")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
            
        return {"status": "ok"}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
