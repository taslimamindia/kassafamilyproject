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
        id=3000,
        username="admin_admin_db",
        email="admin_admin_db@example.com",
        password=hash_password("password"),
        firstname="Admin",
        lastname="AdminDB",
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


def test_list_tables(client_with_admin: TestClient):
    # Verify route is registered
    spec = client_with_admin.get('/openapi.json')
    assert spec.status_code == 200
    paths = spec.json().get('paths', {})
    assert '/admin/db/tables' in paths
    # Call endpoint
    res = client_with_admin.get('/admin/db/tables')
    assert res.status_code == 200
    tables = res.json()
    assert isinstance(tables, list)
    assert any(t.get('name') == 'users' for t in tables)


def test_deletion_order(client_with_admin: TestClient):
    res = client_with_admin.get('/admin/db/deletion-order')
    assert res.status_code == 200
    payload = res.json()
    assert isinstance(payload, list)
    if payload:
        assert 'table' in payload[0] and 'dependsOn' in payload[0]


def test_get_rows_users(client_with_admin: TestClient, db: Session):
    # Create sample users
    for i in range(3):
        u = Users(
            id=3100 + i,
            username=f"user_admin_db_{i}",
            email=f"user_admin_db_{i}@example.com",
            password=hash_password("password"),
            firstname="User",
            lastname="AdminDB",
            isactive=1,
            isfirstlogin=0,
        )
        db.add(u)
    db.commit()

    res = client_with_admin.get('/admin/db/tables/users/rows?size=2&page=1')
    assert res.status_code == 200
    data = res.json()
    assert 'rows' in data and 'total' in data and 'pk' in data
    assert isinstance(data['rows'], list)
    assert data['pk'] in ['id', None]
    if data['rows']:
        assert 'id' in data['rows'][0]


def test_delete_rows_users(client_with_admin: TestClient, db: Session):
    # Ensure route exists in OpenAPI
    spec = client_with_admin.get('/openapi.json')
    assert spec.status_code == 200
    paths = spec.json().get('paths', {})
    assert '/admin/db/tables/{table}/rows' in paths
    assert 'delete' in paths['/admin/db/tables/{table}/rows']
    # Create deletable users without FKs
    ids = []
    for i in range(2):
        u = Users(
            id=3200 + i,
            username=f"deletable_admin_db_{i}",
            email=f"deletable_admin_db_{i}@example.com",
            password=hash_password("password"),
            firstname="Del",
            lastname="AdminDB",
            isactive=1,
            isfirstlogin=0,
        )
        db.add(u); db.commit(); db.refresh(u)
        ids.append(u.id)

    res = client_with_admin.request('DELETE', '/admin/db/tables/users/rows', json={"ids": ids})
    assert res.status_code == 200
    payload = res.json()
    assert payload.get('deleted') == len(ids)

    # Verify they are gone
    rem = db.query(Users).filter(Users.id.in_(ids)).all()
    assert len(rem) == 0
