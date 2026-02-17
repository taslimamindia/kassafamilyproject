import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from models_orm.access_control import Roles, RoleAttribution
from models_orm.users import Users
from auth_utils import hash_password
from models_orm.dependencies import get_current_user

# -----------------------------------------------------------------------------
# SETUP HELPERS
# -----------------------------------------------------------------------------

def ensure_role(db: Session, id: int, name: str):
    r = db.query(Roles).filter(Roles.id == id).first()
    if not r:
        r = Roles(id=id, role=name)
        db.add(r)
        db.commit()
        db.refresh(r)
    else:
        # Ensure the role name matches the requested seed (tests expect this)
        if (r.role or "") != name:
            r.role = name
            db.add(r)
            db.commit()
            db.refresh(r)
    return r

@pytest.fixture
def admin_user(db: Session):
    user = Users(
        username="admin_user",
        email="admin@example.com",
        password=hash_password("password"),
        firstname="Admin",
        lastname="User",
        isactive=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Ensure 'admin' role exists and assign to user
    ensure_role(db, 1, 'admin')
    db.add(RoleAttribution(users_id=user.id, roles_id=1))
    db.commit()

    return user

@pytest.fixture
def client_with_admin(client: TestClient, admin_user: Users, db: Session):
    # Override get_current_user to always return our admin_user for this client
    client.app.dependency_overrides[get_current_user] = lambda: admin_user
    try:
        yield client
    finally:
        # Clean up override after use
        client.app.dependency_overrides.pop(get_current_user, None)

# -----------------------------------------------------------------------------
# ROLES CRUD TESTS (require admin)
# -----------------------------------------------------------------------------

def test_list_roles_empty(client_with_admin: TestClient, db: Session):
    # Seed a couple of roles
    ensure_role(db, 2, 'member')
    ensure_role(db, 3, 'admingroup')

    res = client_with_admin.get('/roles')
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert any(r['role'] == 'member' for r in data)


def test_create_update_delete_role(client_with_admin: TestClient, admin_user: Users, db: Session):
    # Create
    res = client_with_admin.post('/roles', json={"id": 10, "role": "treasury"})
    assert res.status_code == 200
    role = res.json()
    assert role['id'] == 10 and role['role'] == 'treasury'

    # Update
    res = client_with_admin.patch('/roles/10', json={"role": "treasury_updated"})
    assert res.status_code == 200
    role = res.json()
    assert role['role'] == 'treasury_updated'

    # Delete
    res = client_with_admin.delete('/roles/10')
    assert res.status_code == 200
    assert res.json()['status'] == 'deleted'

# -----------------------------------------------------------------------------
# ROLE ATTRIBUTIONS TESTS
# -----------------------------------------------------------------------------

def test_assign_and_list_roles_for_user(client_with_admin: TestClient, admin_user: Users, db: Session):
    # Prepare roles and a target user
    member_role = ensure_role(db, 2, 'member')
    target = Users(
        username="target_user",
        email="t@example.com",
        password=hash_password("password"),
        firstname="Target",
        lastname="User",
        isactive=1,
    )
    db.add(target)
    db.commit()
    db.refresh(target)

    # Assign role
    res = client_with_admin.post('/role-attributions', json={"users_id": target.id, "roles_id": member_role.id})
    assert res.status_code == 200
    attrib = res.json()
    assert attrib['users_id'] == target.id and attrib['roles_id'] == member_role.id

    # List roles for user
    res = client_with_admin.get(f'/users/{target.id}/roles')
    assert res.status_code == 200
    roles = res.json()
    assert any(r['role'] == 'member' for r in roles)


def test_list_role_attributions(client_with_admin: TestClient, db: Session):
    res = client_with_admin.get('/role-attributions?status=all')
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_bulk_assign_and_delete(client_with_admin: TestClient, admin_user: Users, db: Session):
    member_role = ensure_role(db, 2, 'member')
    u1 = Users(username="u1", email="u1@example.com", password=hash_password("p"), firstname="U1", lastname="L", isactive=1)
    u2 = Users(username="u2", email="u2@example.com", password=hash_password("p"), firstname="U2", lastname="L", isactive=1)
    db.add_all([u1, u2])
    db.commit()
    db.refresh(u1); db.refresh(u2)

    # Bulk assign
    res = client_with_admin.post('/role-attributions/bulk', json={"users_ids": [u1.id, u2.id], "roles_id": member_role.id})
    assert res.status_code == 200
    assert res.json()['count'] == 2

    # Bulk delete
    res = client_with_admin.post('/role-attributions/bulk-delete', json={"users_ids": [u1.id, u2.id], "roles_id": member_role.id})
    assert res.status_code == 200
    assert res.json()['count'] == 2


def test_remove_role_attribution(client_with_admin: TestClient, admin_user: Users, db: Session):
    member_role = ensure_role(db, 2, 'member')
    u = Users(username="u3", email="u3@example.com", password=hash_password("p"), firstname="U3", lastname="L", isactive=1)
    db.add(u); db.commit(); db.refresh(u)
    attrib = RoleAttribution(users_id=u.id, roles_id=member_role.id)
    db.add(attrib); db.commit(); db.refresh(attrib)

    res = client_with_admin.delete(f'/role-attributions/{attrib.id}')
    assert res.status_code == 200
    assert res.json()['status'] == 'deleted'


def test_remove_role_from_user(client_with_admin: TestClient, admin_user: Users, db: Session):
    member_role = ensure_role(db, 2, 'member')
    u = Users(username="u4", email="u4@example.com", password=hash_password("p"), firstname="U4", lastname="L", isactive=1)
    db.add(u); db.commit(); db.refresh(u)
    attrib = RoleAttribution(users_id=u.id, roles_id=member_role.id)
    db.add(attrib); db.commit()

    res = client_with_admin.delete(f'/users/{u.id}/roles/{member_role.id}')
    assert res.status_code == 200
    assert res.json()['status'] == 'deleted'
