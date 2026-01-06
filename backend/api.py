import mysql.connector
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from typing import Optional
from datetime import datetime, timedelta, timezone
import uuid

from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer
from settings import settings
import logging

app = FastAPI()

# CORS: Allow all origins (update for prod security later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable for connection reuse (Warm Start)
_db_connection = None

def get_db_connection():
    global _db_connection
    # Select config based on environment via Settings
    config = settings.get_db_config()

    try:
        # Reuse existing connection if valid
        if _db_connection and _db_connection.is_connected():
            _db_connection.ping(reconnect=True, attempts=3, delay=1)
        else:
            _db_connection = mysql.connector.connect(**config)
    except mysql.connector.Error:
        # Force fresh connection on error
        _db_connection = mysql.connector.connect(**config)

    return _db_connection

# Dependency: Yields a cursor but keeps connection open
def get_cursor():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        yield cursor
    finally:
        cursor.close()

# --- AUTH SETUP ---

# Password hashing: prefer pbkdf2 to avoid bcrypt backend issues
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    default="pbkdf2_sha256",
    deprecated="auto",
)

def hash_password(plain_password: Optional[str]) -> str:
    # bcrypt has a 72-character input limit; ensure compatibility
    if not plain_password:
        plain_password = settings.user_password_default
    if len(plain_password) > 72:
        raise ValueError("Password exceeds maximum length of 72 characters")
    return pwd_context.hash(plain_password)

def verify_password(plain_password: Optional[str], hashed_password: Optional[str]) -> bool:
    try:
        return pwd_context.verify(plain_password or "", hashed_password or "")
    except Exception:
        # If existing records are plaintext, allow direct compare as fallback
        return (plain_password or "") == (hashed_password or "")

# JWT configuration
JWT_SECRET = settings.jwt_secret
JWT_ALGORITHM = settings.jwt_algorithm
JWT_EXP_MINUTES = settings.jwt_exp_minutes

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

# Public paths that bypass authentication when no token is provided
# Overridable via env: PUBLIC_PATHS=/auth/login,/info-base
PUBLIC_PATHS = settings.public_paths

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    identifier: str  # username OR email OR telephone
    password: str

class UserUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    birthday: Optional[str] = None  # ISO date string

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=JWT_EXP_MINUTES))
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme), cursor = Depends(get_cursor)):
    logger = logging.getLogger("auth")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # Temporary bypass: if path is public and no token provided
    if request.url.path in PUBLIC_PATHS and not token:
        logger.info(f"[auth] Public path without token: {request.url.path}")
        return None

    if not token:
        logger.info(f"[auth] Missing token for path: {request.url.path}")
        raise credentials_exception

    try:
        # Log token header algorithm vs expected
        try:
            hdr = jwt.get_unverified_header(token)
            logger.info(f"[auth] Token header alg={hdr.get('alg')} expected={JWT_ALGORITHM}")
        except Exception:
            pass
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id_raw = payload.get("sub")
        try:
            user_id: Optional[int] = int(user_id_raw) if user_id_raw is not None else None
        except (TypeError, ValueError):
            user_id = None
        jti: Optional[str] = payload.get("jti")
        if user_id is None:
            logger.warning(f"[auth] JWT decoded but no 'sub' claim for path: {request.url.path}")
            raise credentials_exception
        # Check token revocation
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
        if jti:
            cursor.execute("SELECT id FROM revoked_tokens WHERE jti = %s", (jti,))
            if cursor.fetchone():
                logger.info(f"[auth] Token revoked (jti matched) for user_id={user_id}")
                raise credentials_exception
        else:
            # Fallback for tokens without jti (older tokens)
            cursor.execute("SELECT id FROM revoked_tokens WHERE token = %s", (token,))
            if cursor.fetchone():
                logger.info(f"[auth] Token revoked (raw token matched) for user_id={user_id}")
                raise credentials_exception
    except JWTError as e:
        logger.warning(f"[auth] JWT decode error on path {request.url.path}: {e}")
        raise credentials_exception

    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    if not user:
        logger.info(f"[auth] No user found for id={user_id}")
        raise credentials_exception
    return user

# --- ROUTES ---

@app.post("/auth/login", response_model=TokenResponse)
async def login(request: Request, cursor = Depends(get_cursor)):
    """Authenticate via username/email/telephone + password and return JWT.

    Accepts either JSON body {identifier, password} or form fields
    (identifier|username|email|telephone, password).
    """
    identifier: Optional[str] = None
    password: Optional[str] = None

    # Try JSON first
    try:
        json_body = await request.json()
        if isinstance(json_body, dict):
            identifier = json_body.get("identifier")
            password = json_body.get("password")
    except Exception:
        pass

    # Fallback to form
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
        except Exception:
            pass

    if not identifier or not password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing identifier or password")

    # Find user by any of the three identifiers
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

@app.get("/info-base")
def check_db(current_user: Optional[dict] = Depends(get_current_user)):
    """Check database connection status"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DATABASE();")
    db_name = cursor.fetchone()[0]
    cursor.close()
    return {"env": settings.env, "db": db_name, "status": "Connected"}

@app.get("/auth/verify")
def verify_auth(current_user: dict = Depends(get_current_user)):
    """Return 200 if the provided JWT is valid and not revoked."""
    user = dict(current_user) if isinstance(current_user, dict) else current_user
    user.pop("password", None)
    return {"ok": True, "user": user}

@app.get("/users")
def get_members(cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()
    for user in users:
        user.pop("password", None)  # Remove sensitive fields
    users = [user for user in users if user["username"] not in ["admin"]]
    return users

@app.get("/user")
def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Return only the authenticated user's profile (without password)."""
    user = dict(current_user) if isinstance(current_user, dict) else current_user
    # Remove sensitive fields
    user.pop("password", None)
    return user

@app.patch("/user")
def update_current_user_profile(body: UserUpdate, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    """Update the authenticated user's profile. Only provided fields are updated."""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    fields = []
    values = []
    if body.firstname is not None:
        fields.append("firstname = %s"); values.append(body.firstname)
    if body.lastname is not None:
        fields.append("lastname = %s"); values.append(body.lastname)
    if body.email is not None:
        fields.append("email = %s"); values.append(body.email)
    if body.telephone is not None:
        fields.append("telephone = %s"); values.append(body.telephone)
    if body.birthday is not None:
        fields.append("birthday = %s"); values.append(body.birthday)

    if not fields:
        # Nothing to update, just return current profile
        user = dict(current_user)
        user.pop("password", None)
        return user

    sql = f"UPDATE users SET {', '.join(fields)} WHERE id = %s"
    values.append(current_user["id"])
    cursor.execute(sql, tuple(values))
    conn = get_db_connection()
    conn.commit()

    # Return updated profile
    cursor.execute("SELECT * FROM users WHERE id = %s", (current_user["id"],))
    updated = cursor.fetchone()
    updated.pop("password", None)
    return updated

@app.post("/auth/logout")
def logout(request: Request, token: Optional[str] = Depends(oauth2_scheme), cursor = Depends(get_cursor)):
    """Record the provided token as revoked until its expiry."""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        jti: Optional[str] = payload.get("jti")
        exp: Optional[int] = payload.get("exp")
        expires_dt = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else datetime.now(timezone.utc)

        # Ensure table exists
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
        conn = get_db_connection()
        conn.commit()
        return {"status": "ok"}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

@app.get("/setup-database")
def setup_database(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. DROP TABLE (Disable FK checks to allow dropping self-referencing table)
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        cursor.execute("DROP TABLE IF EXISTS users")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

        # 2. CREATE TABLE
        # Use the environment-defined default password, hashed, for DB default
        default_password_hashed = hash_password(settings.user_password_default)
        create_table_sql = f"""
        CREATE TABLE users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE,
            password VARCHAR(255) NOT NULL DEFAULT '{default_password_hashed}',
            firstname VARCHAR(100) NOT NULL,
            lastname VARCHAR(100) NOT NULL,
            birthday DATE,
            telephone VARCHAR(20),
            email VARCHAR(255) UNIQUE,
            created DATETIME DEFAULT CURRENT_TIMESTAMP,
            id_father INT,
            id_mother INT,
            CONSTRAINT fk_father FOREIGN KEY (id_father) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT fk_mother FOREIGN KEY (id_mother) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB;
        """
        cursor.execute(create_table_sql)

        # 3. INSERT DATA (No need to check existence, table is empty)
        
        # Father (ID 1) with hashed default password
        sql_father = "INSERT INTO users (id, firstname, lastname, username, password) VALUES (1, %s, %s, %s, %s)"
        cursor.execute(sql_father, ("Kassa", "Famille", "kassa", hash_password(settings.user_password_default)))
        
        # Creation of admin user (ID 2)
        sql_admin = "INSERT INTO users (id, firstname, lastname, username, password) VALUES (2, %s, %s, %s, %s)"
        
        # Override admin info from environment variables
        admin_username = settings.admin_username
        admin_password = hash_password(settings.admin_password)
        admin_email = settings.admin_email
        admin_telephone = settings.admin_telephone
        admin_birthday = settings.admin_birthday

        cursor.execute(
            sql_admin,
            ("admin", "admin", admin_username, admin_password),
        )

        if admin_email is not None:
            cursor.execute("UPDATE users SET email = %s WHERE id = 2", (admin_email,))
        if admin_telephone is not None:
            cursor.execute("UPDATE users SET telephone = %s WHERE id = 2", (admin_telephone,))
        if admin_birthday is not None:
            cursor.execute("UPDATE users SET birthday = %s WHERE id = 2", (admin_birthday,))

        # Children
        children = [
            ("Thierno Mahamoudou", "Barry", "thierno", hash_password(settings.user_password_default)),
            ("Mamadou Kindy", "Barry", "mamadou", hash_password(settings.user_password_default))
        ]

        sql_child = "INSERT INTO users (firstname, lastname, username, password, id_father) VALUES (%s, %s, %s, %s, 1)"
        cursor.executemany(sql_child, children)

        conn.commit()
        return {"status": "Success", "message": "Table dropped and recreated with initial data"}

    except Exception as e:
        conn.rollback()
        return {"status": "Error", "details": str(e)}
    
    finally:
        cursor.close()


# AWS Lambda Handler
handler = Mangum(app)