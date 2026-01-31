import pytest
from sqlalchemy.orm import Session
from models.messaging import Messages, MessageRecipients
from models.users import Users
from datetime import datetime


def test_messages_model(db: Session):
    # Create a message record matching the DB schema
    message = Messages(message="Hello, World!", received_at=datetime.utcnow())
    db.add(message)
    db.commit()
    db.refresh(message)

    assert message.id is not None
    assert message.message == "Hello, World!"


def test_message_recipients_model(db: Session):
    # Create sender and receiver users
    sender = Users(username="sender", password="pwd", firstname="S", lastname="One")
    receiver = Users(username="receiver", password="pwd", firstname="R", lastname="Two")
    db.add_all([sender, receiver])
    db.commit()

    # Create a message
    message = Messages(message="Test Message", received_at=datetime.utcnow())
    db.add(message)
    db.commit()
    db.refresh(message)

    # Link message to recipients using the messages_recipients table fields
    recipient = MessageRecipients(messages_id=message.id, sender_id=sender.id, receiver_id=receiver.id, isreaded=0)
    db.add(recipient)
    db.commit()
    db.refresh(recipient)

    assert recipient.id is not None
    assert recipient.messages_id == message.id
    assert recipient.sender_id == sender.id
    assert recipient.receiver_id == receiver.id