import pytest
from sqlalchemy.orm import Session
from models.users import Users, FamilyAssignation


def test_users_model(db: Session):
    # Utilisation des colonnes exactes du SQL (password, firstname, lastname)
    user = Users(
        username="testuser", 
        email="testuser@example.com", 
        password="hashedpassword",
        firstname="Test",
        lastname="User"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    assert user.id is not None
    assert user.username == "testuser"


def test_family_assignments_model(db: Session):
    # Création d'un responsable et d'un assigné
    u1 = Users(username="boss", password="123", firstname="A", lastname="B")
    u2 = Users(username="member", password="123", firstname="C", lastname="D")
    db.add_all([u1, u2])
    db.commit()

    family_assignment = FamilyAssignation(users_assigned_id=u2.id, users_responsable_id=u1.id)
    db.add(family_assignment)
    db.commit()
    db.refresh(family_assignment)

    assert family_assignment.id is not None
    assert family_assignment.responsible_user.username == "boss"