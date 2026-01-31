import pytest
from sqlalchemy.orm import Session
from models.auth import RevokedToken
from datetime import datetime, timezone


def test_revoked_token_model(db: Session):
    token = RevokedToken(token="sample_token", expires=datetime.now(timezone.utc))
    db.add(token)
    db.commit()
    db.refresh(token)

    assert token.token == "sample_token"
    assert token.expires is not None