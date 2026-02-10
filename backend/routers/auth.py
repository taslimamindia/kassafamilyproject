from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt, JWTError
from datetime import datetime, timezone, date
from typing import Optional

from models_orm.dependencies import get_db, get_current_user, oauth2_scheme
from sqlalchemy.orm import Session
import logging
from models_orm.users import Users
from models_orm.auth import RevokedToken
from auth_utils import verify_password, create_access_token, hash_password
from settings import settings


router = APIRouter()
logger = logging.getLogger("auth")

def _is_minor(birthday: Optional[date]) -> bool:
    if not birthday:
        return False
    try:
        # Compute age safely
        today = date.today()
        age = today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))
        return age < 18
    except Exception:
        return False


@router.post("/login")
async def login(
    request: Request,
    db: Session = Depends(get_db),
):
    # Accept both application/json and form (OAuth2) payloads
    identifier: Optional[str] = None
    password: Optional[str] = None

    try:
        content_type = (request.headers.get("content-type") or "").lower()
    except Exception:
        content_type = ""

    if "application/json" in content_type:
        try:
            data = await request.json()
            if isinstance(data, dict):
                identifier = data.get("identifier") or data.get("username")
                password = data.get("password")
        except Exception:
            pass

    # Fallback to parsing form fields if JSON not provided
    if not identifier or not password:
        try:
            form = await request.form()
            identifier = identifier or form.get("username")
            password = password or form.get("password")
        except Exception:
            pass

    if not identifier or not password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing credentials")

    user: Optional[Users] = (
        db.query(Users)
        .filter(
            (Users.username == identifier)
            | (Users.email == identifier)
            | (Users.telephone == identifier)
        )
        .first()
    )

    if not user or not verify_password(password, user.password or ""):
        logger.error(f"[auth] Login failed for identifier: {identifier}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Inactive user -> 403 with 'deactivated' keyword
    try:
        is_active = int(user.isactive or 0)
    except (TypeError, ValueError):
        is_active = 0
    if is_active != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated",
        )

    # Block minors
    if _is_minor(user.birthday):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User must be of legal age",
        )

    # First-login password change flow is handled elsewhere; allow normal login here

    token = create_access_token({"sub": str(user.id), "username": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/change-password-first-login")
async def change_password_first_login(
    form_data: dict,
    db: Session = Depends(get_db),
):
    identifier: Optional[str] = None
    old_password: Optional[str] = None
    new_password: Optional[str] = None

    if isinstance(form_data, dict):
        identifier = form_data.get("identifier")
        old_password = form_data.get("old_password")
        new_password = form_data.get("new_password")

    if not identifier or not old_password or not new_password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Missing fields")

    user: Optional[Users] = (
        db.query(Users)
        .filter(
            (Users.username == identifier)
            | (Users.email == identifier)
            | (Users.telephone == identifier)
        )
        .first()
    )
    # For security, do not reveal whether the user exists; use generic errors
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    # Only proceed if first login is required
    try:
        is_first_login = int(user.isfirstlogin or 0)
    except (TypeError, ValueError):
        is_first_login = 0
    if is_first_login != 1:
        # If not first login, disallow this flow
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flow non autorisé")

    # Check active status as well
    try:
        is_active = int(user.isactive or 0)
    except (TypeError, ValueError):
        is_active = 0
    if is_active != 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

    # Block minors as well
    if _is_minor(user.birthday):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User must be of legal age")

    # Verify old (current) password
    if not verify_password(old_password, user.password or ""):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    # Update password and clear first-login flag
    new_hashed = hash_password(new_password)
    user.password = new_hashed
    user.isfirstlogin = 0
    db.add(user)
    db.commit()

    return {"status": "ok"}


@router.get("/verify")
async def verify_auth(current_user: Users = Depends(get_current_user)):
    # Return full user info (excluding password) with ok flag
    user = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "firstname": current_user.firstname,
        "lastname": current_user.lastname,
        "telephone": current_user.telephone,
        "birthday": current_user.birthday.isoformat() if current_user.birthday else None,
        "isactive": int(current_user.isactive or 0),
        "isfirstlogin": int(current_user.isfirstlogin or 0),
    }
    return user


@router.post("/logout")
async def logout(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        jti: Optional[str] = payload.get("jti")
        exp: Optional[int] = payload.get("exp")
        expires_dt = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else datetime.now(timezone.utc)

        revoked = RevokedToken(jti=jti, token=token, expires=expires_dt.replace(tzinfo=None))
        db.add(revoked)
        db.commit()
        return {"message": "Successfully logged out"}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
