from fastapi import APIRouter, Depends, HTTPException, status, Request
from jose import jwt, JWTError
from datetime import datetime, timezone
from typing import Optional

from dependencies import get_cursor, get_current_user, oauth2_scheme, has_role
import logging
from models import TokenResponse
from auth_utils import verify_password, create_access_token, hash_password
from settings import settings
import asyncio

router = APIRouter()
logger = logging.getLogger("auth")

async def check_majority(user: dict):
        # Block minors (age < 18)
    bd_raw = user.get("birthday")
    if bd_raw:
        try:
            try:
                bd = datetime.fromisoformat(str(bd_raw))
            except Exception:
                try:
                    bd = datetime.strptime(str(bd_raw), "%Y-%m-%d")
                except Exception:
                    bd = None
            if bd:
                age = int((datetime.now() - bd).days / 365.25)
                if age < 18:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vous devez être majeur pour vous connecter.")
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")


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

    await cursor.execute(
        """
        SELECT * FROM users
        WHERE username = %s OR email = %s OR telephone = %s
        LIMIT 1
        """,
        (identifier, identifier, identifier),
    )
    user = await cursor.fetchone()
    if not user:
        logging.error(f"[auth] Login failed for identifier: {identifier} (user not found)")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")

    if not verify_password(password, user.get("password", "")):
        logging.error(f"[auth] Login failed for identifier: {identifier} (invalid password)")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")

    # Block non-active users with a generic message
    is_active = user.get("isactive")
    try:
        is_active = int(is_active) if is_active is not None else 0
    except (TypeError, ValueError):
        is_active = 0
    if is_active != 1:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")

    # Block users with role 'norole' except the special username 'norole'
    username = user.get("username") or ""
    if await has_role(cursor, user["id"], "norole") and username.lower() != "norole":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")

    # Block minors as well
    await check_majority(user)
    
    # Require password change on first login
    is_first_login = user.get("isfirstlogin")
    try:
        is_first_login = int(is_first_login) if is_first_login is not None else 0
    except (TypeError, ValueError):
        is_first_login = 0
    if is_first_login == 1:
        # Specific code to allow frontend to trigger first-login password change flow
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FIRST_LOGIN_REQUIRED",
                "message": "Veuillez changer votre mot de passe avant de vous connecter"
            },
        )

    token = create_access_token({"sub": str(user["id"]), "username": user.get("username")})
    return TokenResponse(access_token=token)

@router.post("/change-password-first-login")
async def change_password_first_login(request: Request, cursor = Depends(get_cursor)):
    identifier: Optional[str] = None
    old_password: Optional[str] = None
    new_password: Optional[str] = None

    try:
        json_body = await request.json()
        if isinstance(json_body, dict):
            identifier = json_body.get("identifier")
            old_password = json_body.get("old_password")
            new_password = json_body.get("new_password")
    except Exception as e:
        logger.warning(f"[auth] Failed to parse JSON change-password-first-login payload: {e}")

    if not identifier or not old_password or not new_password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing fields")

    await cursor.execute(
        """
        SELECT * FROM users
        WHERE username = %s OR email = %s OR telephone = %s
        LIMIT 1
        """,
        (identifier, identifier, identifier),
    )
    user = await cursor.fetchone()
    # For security, do not reveal whether the user exists; use generic errors
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")

    # Only proceed if first login is required
    is_first_login = user.get("isfirstlogin")
    try:
        is_first_login = int(is_first_login) if is_first_login is not None else 0
    except (TypeError, ValueError):
        is_first_login = 0
    if is_first_login != 1:
        # If not first login, disallow this flow
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flow non autorisé")

    # Check active status as well
    is_active = user.get("isactive")
    try:
        is_active = int(is_active) if is_active is not None else 0
    except (TypeError, ValueError):
        is_active = 0
    if is_active != 1:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")

    # Block users with role 'norole' (do not allow password change flow)
    if await has_role(cursor, user["id"], "norole"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")

    # Block minors as well
    await check_majority(user)

    # Verify old (current) password
    if not verify_password(old_password, user.get("password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Informations de connexion incorrectes")

    # Update password and clear first-login flag
    new_hashed = hash_password(new_password)
    await cursor.execute(
        "UPDATE users SET password = %s, isfirstlogin = %s, updatedat = CURRENT_TIMESTAMP WHERE id = %s",
        (new_hashed, 0, user["id"]),
    )
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[auth] Commit failed during change_password_first_login")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")

    return {"status": "ok"}

@router.get("/verify")
async def verify_auth(current_user: dict = Depends(get_current_user)):
    user = dict(current_user) if isinstance(current_user, dict) else current_user
    user.pop("password", None)
    return {"ok": True, "user": user}

@router.post("/logout")
async def logout(request: Request, token: Optional[str] = Depends(oauth2_scheme), cursor = Depends(get_cursor)):
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        jti: Optional[str] = payload.get("jti")
        exp: Optional[int] = payload.get("exp")
        expires_dt = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else datetime.now(timezone.utc)

        # Ideally, schemas are created at startup or migration, not here.
        await cursor.execute(
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
        await cursor.execute(
            "INSERT INTO revoked_tokens (jti, token, expires) VALUES (%s, %s, %s)",
            (jti, token if not jti else None, expires_dt.replace(tzinfo=None)),
        )
        
        # Auto-commit dependent
        try:
            await cursor.commit()
        except Exception:
            logger.exception("[auth] Commit failed during logout")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
            
        return {"status": "ok"}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
