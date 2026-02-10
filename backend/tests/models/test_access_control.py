import pytest
from sqlalchemy.orm import Session
from models_orm.access_control import Roles, RoleAttribution


def test_roles_model(db: Session):
    role = Roles(role="admin")
    db.add(role)
    db.commit()
    db.refresh(role)

    assert role.id is not None
    assert role.role == "admin"


def test_role_attribution_model(db: Session):
    role = Roles(role="user")
    db.add(role)
    db.commit()
    db.refresh(role)

    role_attribution = RoleAttribution(users_id=1, roles_id=role.id)
    db.add(role_attribution)
    db.commit()
    db.refresh(role_attribution)

    assert role_attribution.id is not None
    assert role_attribution.users_id == 1
    assert role_attribution.roles_id == role.id
    assert role_attribution.role_obj.role == "user"