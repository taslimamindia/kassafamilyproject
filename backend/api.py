from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from models_orm.database import engine, Base
# We must import models so SQLAlchemy "knows" about them before creating tables
import models_orm.auth
# import models.users
# import models.finance
# import models.access_control
# import models.messaging

# 2. Router Imports
from routers import auth, roles, users, messages, transactions, family_assignation, system, admin_db
# Uncomment these as you migrate them to ORM:
# from routers import users, roles, system, messages, transactions
# from routers import admin_db
# from routers import family_assignation as family_assignation_router

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifecycle Manager.
    Replaces the old raw SQL connection logic.
    """
    try:
        # A. Create Tables
        # This replaces 'ensure_revoked_tokens_table'.
        # It checks all imported models and creates tables if they don't exist.
        logger.info("[lifespan] Checking database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("[lifespan] Database tables verified/created.")

        yield # Application is running

    except Exception as e:
        logger.exception("[lifespan] Critical startup error")
        raise e
    finally:
        # SQLAlchemy handles connection pooling automatically, 
        # so we don't need to manually close a cursor here.
        pass

app = FastAPI(lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(roles.router, tags=["Roles"])
app.include_router(users.router, tags=["Users"]) 
app.include_router(messages.router, tags=["Messages"])
app.include_router(transactions.router, tags=["Transactions"])
app.include_router(family_assignation.router, tags=["Family Assignation"]) 
app.include_router(system.router, tags=["System"]) 
app.include_router(admin_db.router, tags=["Admin DB"])