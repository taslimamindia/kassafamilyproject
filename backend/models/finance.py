from sqlalchemy import (
    Column, 
    Integer, 
    String,
    ForeignKey, 
    Float, 
    DateTime, 
    Boolean
)
from sqlalchemy.orm import relationship
from models.database import Base
from datetime import datetime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Text


# Payment Methods model
class PaymentMethods(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(45), nullable=False, unique=True)
    isactive = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, unique=True, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, unique=True, default=datetime.utcnow)
    type_of_proof = Column(
        SQLEnum("TRANSACTIONNUMBER", "LINK", "BOTH", name="type_of_proof_enum"),
        nullable=False,
        default="BOTH",
    )
    account_number = Column(String(45), nullable=False, default="")


# Transactions model
class Transactions(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    amount = Column(Float, nullable=False)
    status = Column(
        SQLEnum("SAVED", "PENDING", "PARTIALLY_APPROVED", "VALIDATED", "REJECTED", name="transaction_status_enum"),
        nullable=False,
        default="SAVED",
    )
    proof_reference = Column(String(255), nullable=False, default="")
    validated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    issubmitted = Column(Boolean, nullable=False, default=False)

    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    users_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    payment_methods_id = Column(Integer, ForeignKey("payment_methods.id"), nullable=False)

    transaction_type = Column(
        SQLEnum("CONTRIBUTION", "DONATIONS", "EXPENSE", name="transaction_type_enum"),
        nullable=False,
    )

    # Relationships
    recorded_by = relationship("Users", foreign_keys=[recorded_by_id])
    user = relationship("Users", foreign_keys=[users_id])
    updated_by_user = relationship("Users", foreign_keys=[updated_by])
    payment_method = relationship("PaymentMethods")


# Transaction Approvals model
class TransactionApprovals(Base):
    __tablename__ = "transaction_approvals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    role_at_approval = Column(String(45), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    note = Column(Text, nullable=True)
    transactions_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    users_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    transaction = relationship("Transactions", foreign_keys=[transactions_id])
    user = relationship("Users", foreign_keys=[users_id])
