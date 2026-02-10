import pytest
from sqlalchemy.orm import Session
from sqlalchemy import text
from settings import settings


def test_db_connexion(db: Session):
    """Verify DB connection by checking current database name (no table access)."""
    current_db = db.execute(text("SELECT DATABASE()")).scalar()
    expected_db = settings.get_db_config().get("database") or settings.db_name

    assert current_db == expected_db
