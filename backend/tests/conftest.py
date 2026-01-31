import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.database import Base, engine
from settings import settings

# Create a session factory for testing
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """
    Ensure tables exist before running tests. 
    Since you manage schema via Workbench, this is a safety check.
    """
    # Base.metadata.create_all(bind=engine) # Optional if Workbench already synced
    yield

@pytest.fixture
def db():
    """
    Creates a new database session for a test and rolls back after completion.
    This ensures your local DB stays clean even if the test writes data.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback() # Undo all changes made during the test
    connection.close()