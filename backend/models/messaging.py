from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    SmallInteger,
)
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SQLEnum
from models.database import Base
from datetime import datetime


# Messages model
class Messages(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    message = Column(String(225), nullable=True)
    message_type = Column(
        SQLEnum("APPROVAL", "MESSAGE", "EXTERNE", name="message_type_enum"),
        nullable=True,
    )
    received_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    link = Column(String(150), nullable=True)

    # Relationships
    recipients = relationship("MessageRecipients", back_populates="message")


# Message Recipients model
class MessageRecipients(Base):
    __tablename__ = "messages_recipients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    isreaded = Column(SmallInteger, nullable=False, default=0)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    messages_id = Column(Integer, ForeignKey("messages.id"), nullable=False)

    # Relationships
    message = relationship("Messages", back_populates="recipients", foreign_keys=[messages_id])
    sender = relationship("Users", foreign_keys=[sender_id])
    receiver = relationship("Users", foreign_keys=[receiver_id])