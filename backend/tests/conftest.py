import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_orm.database import Base, engine
from settings import settings
from fastapi.testclient import TestClient
import os
import sys

from api import app 
from models_orm.database import engine, get_db


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
    

@pytest.fixture
def client(db):
    """
    Creates a TestClient that uses the isolated test database session.
    This fixture is required for testing API endpoints (routers).
    """
    # Override the 'get_db' dependency to use our test session
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Create the client
    with TestClient(app) as c:
        yield c
    
    # Clean up the override after the test
    del app.dependency_overrides[get_db]