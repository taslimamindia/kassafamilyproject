import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from models_orm.users import Users
from models_orm.access_control import Roles, RoleAttribution
from auth_utils import hash_password
from models_orm.dependencies import get_current_user


def ensure_role(db: Session, id: int, name: str):
    r = db.query(Roles).filter(Roles.id == id).first()
    if not r:
        r = Roles(id=id, role=name)
        db.add(r)
        db.commit(); db.refresh(r)
    else:
        r.role = name
        db.commit(); db.refresh(r)
    return r

@pytest.fixture
def admin_user(db: Session):
    user = Users(
        id=1000,
        username="admin_system",
        email="admin_sys@example.com",
        password=hash_password("password"),
        firstname="Admin",
        lastname="System",
        isactive=1,
        isfirstlogin=0,
    )
    db.add(user); db.commit(); db.refresh(user)
    ensure_role(db, 1, 'admin')
    db.add(RoleAttribution(users_id=user.id, roles_id=1)); db.commit()
    return user

@pytest.fixture
def client_with_admin(client: TestClient, admin_user: Users, db: Session):
    client.app.dependency_overrides[get_current_user] = lambda: admin_user
    try:
        yield client
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_info_base(client_with_admin: TestClient):
    res = client_with_admin.get('/info-base')
    assert res.status_code == 200
    data = res.json()
    assert 'env' in data and 'db' in data and 'status' in data and 'db_type' in data
    assert data['status'] == 'Connected'


def test_setup_database_seeds_data(client_with_admin: TestClient, db: Session):
    res = client_with_admin.get('/setup-database')
    assert res.status_code == 200
    payload = res.json()
    assert payload['status'] == 'Success'

    # Verify key users exist
    u1 = db.query(Users).filter(Users.id == 1).first()
    u2 = db.query(Users).filter(Users.id == 2).first()
    assert u1 is not None and u2 is not None

    # Verify admin has expected roles
    admin_roles = (
        db.query(Roles.role)
        .join(RoleAttribution, Roles.id == RoleAttribution.roles_id)
        .filter(RoleAttribution.users_id == 2)
        .all()
    )
    names = {r.role for r in admin_roles}
    assert {'admin', 'user', 'guest'}.issubset(names)
