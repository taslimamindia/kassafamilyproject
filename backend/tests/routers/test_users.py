import pytest
from datetime import datetime
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
        db.commit()
        db.refresh(r)
    else:
        if (r.role or "") != name:
            r.role = name
            db.add(r)
            db.commit()
            db.refresh(r)
    return r

@pytest.fixture
def admin_user(db: Session):
    user = Users(
        username="admin_user_users",
        email="admin_users@example.com",
        password=hash_password("password"),
        firstname="Admin",
        lastname="Users",
        isactive=1,
        isfirstlogin=1,
        createdat=datetime.now(),
        updatedat=datetime.now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    ensure_role(db, 1, 'admin')
    db.add(RoleAttribution(users_id=user.id, roles_id=1))
    db.commit()

    return user

@pytest.fixture
def client_with_admin(client: TestClient, admin_user: Users, db: Session):
    client.app.dependency_overrides[get_current_user] = lambda: admin_user
    try:
        yield client
    finally:
        client.app.dependency_overrides.pop(get_current_user, None)


def test_create_and_get_user(client_with_admin: TestClient, db: Session):
    payload = {
        "firstname": "John",
        "lastname": "Doe",
        "username": "jdoe",
        "email": "john.doe@example.com",
        "telephone": "123456",
        "isactive": 1,
        "isfirstlogin": 1
    }
    res = client_with_admin.post('/users', json=payload)
    assert res.status_code == 200
    user = res.json()
    assert user.get('id') is not None
    assert user.get('password') is None
    uid = user['id']

    # Get by id
    res = client_with_admin.get(f'/users/{uid}')
    assert res.status_code == 200
    fetched = res.json()
    assert fetched['username'] == 'jdoe'
    assert 'password' not in fetched


def test_list_users(client_with_admin: TestClient, db: Session):
    # Ensure at least one user exists
    res = client_with_admin.get('/users?status=all')
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_update_user_by_id(client_with_admin: TestClient, db: Session):
    # Create a user
    res = client_with_admin.post('/users', json={
        "firstname": "Alice",
        "lastname": "Smith",
        "username": "asmith",
        "email": "a@a.com",
        "isactive": 1
    })
    assert res.status_code == 200
    uid = res.json()['id']

    # Update email and telephone
    res = client_with_admin.patch(f'/users/{uid}', json={
        "email": "alice.smith@example.com",
        "telephone": "555-000"
    })
    assert res.status_code == 200
    updated = res.json()
    assert updated['email'] == 'alice.smith@example.com'
    assert updated['telephone'] == '555-000'


def test_soft_and_hard_delete_user(client_with_admin: TestClient, db: Session):
    # Create a user to delete
    res = client_with_admin.post('/users', json={
        "firstname": "Bob",
        "lastname": "Marley",
        "username": "bmarley",
        "email": "b@b.com",
        "isactive": 1
    })
    assert res.status_code == 200
    uid = res.json()['id']

    # Soft delete
    res = client_with_admin.delete(f'/users/{uid}')
    assert res.status_code == 200
    assert res.json()['status'] == 'deactivated'

    # Hard delete
    res = client_with_admin.delete(f'/users/{uid}?hard=true')
    assert res.status_code == 200
    assert res.json()['status'] == 'deleted'


def test_current_user_profile_and_update(client_with_admin: TestClient, admin_user: Users, db: Session):
    # Get profile
    res = client_with_admin.get('/user')
    assert res.status_code == 200
    prof = res.json()
    assert 'roles' in prof and any(r['role'] == 'admin' for r in prof['roles'])

    # Update current user profile
    res = client_with_admin.patch('/user', json={
        "email": "new_admin_mail@example.com",
        "telephone": "987654"
    })
    assert res.status_code == 200
    updated = res.json()
    assert updated['email'] == 'new_admin_mail@example.com'
    assert updated['telephone'] == '987654'


def test_parents_endpoint(client_with_admin: TestClient, db: Session):
    # Create father, mother, child
    r1 = client_with_admin.post('/users', json={
        "firstname": "Father",
        "lastname": "One",
        "username": "father1",
        "isactive": 1
    })
    r2 = client_with_admin.post('/users', json={
        "firstname": "Mother",
        "lastname": "One",
        "username": "mother1",
        "isactive": 1
    })
    r3 = client_with_admin.post('/users', json={
        "firstname": "Child",
        "lastname": "One",
        "username": "child1",
        "isactive": 1
    })
    assert r1.status_code == 200 and r2.status_code == 200 and r3.status_code == 200
    fid = r1.json()['id']
    mid = r2.json()['id']
    cid = r3.json()['id']

    # Update child to set parents
    res = client_with_admin.patch(f'/users/{cid}', json={"id_father": fid, "id_mother": mid})
    assert res.status_code == 200

    # Get parents
    res = client_with_admin.get(f'/users/{cid}/parents')
    assert res.status_code == 200
    parents = res.json()
    assert parents['father'] is not None and parents['mother'] is not None


def test_receivers_member_list(client_with_admin: TestClient, db: Session):
    # Ensure 'member' role exists
    member = ensure_role(db, 2, 'member')
    # Create two member users and one non-member
    u1 = Users(username="mem1", email="m1@example.com", password=hash_password("p"), firstname="Mem", lastname="One", isactive=1, isfirstlogin=1, createdat=datetime.now(), updatedat=datetime.now())
    u2 = Users(username="mem2", email="m2@example.com", password=hash_password("p"), firstname="Mem", lastname="Two", isactive=1, isfirstlogin=1, createdat=datetime.now(), updatedat=datetime.now())
    u3 = Users(username="nomem", email="x@example.com", password=hash_password("p"), firstname="No", lastname="Mem", isactive=1, isfirstlogin=1, createdat=datetime.now(), updatedat=datetime.now())
    db.add_all([u1, u2, u3])
    db.commit(); db.refresh(u1); db.refresh(u2); db.refresh(u3)
    # Assign member role to u1, u2
    db.add_all([
        RoleAttribution(users_id=u1.id, roles_id=member.id),
        RoleAttribution(users_id=u2.id, roles_id=member.id),
    ])
    db.commit()

    res = client_with_admin.get('/users/receivers')
    assert res.status_code == 200
    data = res.json()
    # Should include at least mem1 or mem2
    assert any(x['username'] in {"mem1", "mem2"} for x in data)
