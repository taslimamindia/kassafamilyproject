import pytest
from sqlalchemy.orm import Session
from models_orm.finance import PaymentMethods, Transactions, TransactionApprovals
from models_orm.users import Users
from datetime import datetime, timezone


def test_payment_methods_model(db: Session):
    payment_method = PaymentMethods(name="Credit Card")
    db.add(payment_method)
    db.commit()
    db.refresh(payment_method)

    assert payment_method.id is not None
    assert payment_method.name == "Credit Card"


def test_transactions_model(db: Session):
    payment_method = PaymentMethods(name="PayPal")
    db.add(payment_method)
    # create a user required by Transactions foreign keys
    user = Users(firstname="Test", lastname="User", username="testuser", password="pass")
    db.add(user)
    db.commit()
    db.refresh(payment_method)
    db.refresh(user)

    transaction = Transactions(
        amount=100.0,
        payment_methods_id=payment_method.id,
        recorded_by_id=user.id,
        users_id=user.id,
        updated_by=user.id,
        transaction_type="CONTRIBUTION",
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    assert transaction.id is not None
    assert transaction.amount == 100.0
    assert transaction.payment_methods_id == payment_method.id


def test_transaction_approvals_model(db: Session):
    # create required user and payment method and transaction
    user = Users(firstname="Approve", lastname="User", username="approver", password="pass")
    payment_method = PaymentMethods(name="Bank Transfer")
    db.add_all([user, payment_method])
    db.commit()
    db.refresh(user)
    db.refresh(payment_method)

    transaction = Transactions(
        amount=50.0,
        payment_methods_id=payment_method.id,
        recorded_by_id=user.id,
        users_id=user.id,
        updated_by=user.id,
        transaction_type="DONATIONS",
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    approval = TransactionApprovals(
        transactions_id=transaction.id,
        users_id=user.id,
        approved_at=datetime.now(timezone.utc),
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)

    assert approval.id is not None
    assert approval.transactions_id == transaction.id
    assert approval.users_id == user.id
    assert approval.approved_at is not None