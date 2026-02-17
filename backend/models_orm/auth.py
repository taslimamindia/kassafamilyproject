from sqlalchemy import Column, String, DateTime, Integer, Text
from models_orm.database import Base
from datetime import datetime


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jti = Column(String(36), index=True, nullable=True)
    token = Column(Text, nullable=True)
    expires = Column(DateTime, nullable=True)