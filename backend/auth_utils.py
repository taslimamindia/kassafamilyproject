from passlib.context import CryptContext
from typing import Optional
from datetime import datetime, timedelta, timezone
from jose import jwt
import uuid
import logging
from settings import settings
import logging

logger = logging.getLogger("auth")

# Password hashing
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    default="pbkdf2_sha256",
    deprecated="auto",
)

def hash_password(plain_password: Optional[str]) -> str:
    if not plain_password:
        plain_password = settings.user_password_default
    if len(plain_password) > 72:
        raise ValueError("Password exceeds maximum length of 72 characters")
    return pwd_context.hash(plain_password)

def verify_password(plain_password: Optional[str], hashed_password: Optional[str]) -> bool:
    try:
        return pwd_context.verify(plain_password or "", hashed_password or "")
    except Exception as e:
        # Fallback for legacy plaintext passwords (should be removed in strict production)
        logger.warning(f"[auth] Password verify failed, using legacy fallback: {e}")
        return (plain_password or "") == (hashed_password or "")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_exp_minutes))
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
