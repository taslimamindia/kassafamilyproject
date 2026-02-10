from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from settings import settings
import logging

logger = logging.getLogger("db")

# Construct the SQLAlchemy URL using the existing settings object
db_config = settings.get_db_config()

# Using pymysql driver for better SQLAlchemy compatibility
SQLALCHEMY_DATABASE_URL = (
    f"mysql+pymysql://{db_config['user']}:{db_config['password']}"
    f"@{db_config['host']}:{db_config['port']}/{db_config['database']}"
)

# Engine configuration with connection pooling
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,   # Verifies connection liveness before use
    pool_recycle=3600,    # Recycles connections every hour
    pool_size=settings.db_pool_size,
    max_overflow=10
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all ORM models
Base = declarative_base()

def get_db():
    """FastAPI dependency to provide a database session per request"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()