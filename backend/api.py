from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager

from routers import auth, users, roles, system
from database import get_db_connection
from dependencies import ensure_revoked_tokens_table

@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_revoked_tokens_table(cursor)
        try:
            conn.commit()
        except Exception:
            logging.exception("[lifespan] Commit failed after ensuring revoked_tokens table")
        yield
    finally:
        try:
            cursor.close()
        finally:
            try:
                conn.close()
            except Exception:
                logging.exception("[lifespan] Failed to close DB connection")

app = FastAPI(lifespan=lifespan)

# Basic logging configuration
logging.basicConfig(level=logging.INFO)

# CORS: Allow all origins (update for prod security later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(users.router, tags=["Users"]) 
app.include_router(roles.router, tags=["Roles"]) 
app.include_router(system.router, tags=["System"])