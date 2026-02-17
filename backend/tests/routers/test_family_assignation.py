import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from models_orm.users import Users, FamilyAssignation
from models_orm.access_control import Roles, RoleAttribution
from auth_utils import hash_password
from models_orm.dependencies import get_current_user

# Helpers

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
        username="admin_fa",
        email="admin_fa@example.com",
        password=hash_password("password"),
        firstname="AdminFA",
        lastname="User",
        isactive=1,
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


def test_bulk_assign_and_list(client_with_admin: TestClient, admin_user: Users, db: Session):
    # Create responsable and members
    responsable = Users(username="resp1", email="r1@example.com", password=hash_password("p"), firstname="R1", lastname="L", isactive=1)
    m1 = Users(username="m1", email="m1@example.com", password=hash_password("p"), firstname="M1", lastname="L", isactive=1)
    m2 = Users(username="m2", email="m2@example.com", password=hash_password("p"), firstname="M2", lastname="L", isactive=1)
    db.add_all([responsable, m1, m2])
    db.commit()
    db.refresh(responsable); db.refresh(m1); db.refresh(m2)

    # Bulk assign
    res = client_with_admin.post('/family-assignations/bulk', json={
        "users_ids": [m1.id, m2.id],
        "responsable_id": responsable.id,
    })
    assert res.status_code == 200
    assert res.json()['count'] == 2

    # List assignations
    res = client_with_admin.get('/family-assignations')
    assert res.status_code == 200
    data = res.json()
    assert any(row['users_assigned_id'] == m1.id and row['users_responsable_id'] == responsable.id for row in data)


def test_list_members_by_responsable(client_with_admin: TestClient, admin_user: Users, db: Session):
    # Seed responsable and one assigned member
    responsable = Users(username="resp2", email="r2@example.com", password=hash_password("p"), firstname="R2", lastname="L", isactive=1)
    member = Users(username="m3", email="m3@example.com", password=hash_password("p"), firstname="M3", lastname="L", isactive=1)
    db.add_all([responsable, member])
    db.commit(); db.refresh(responsable); db.refresh(member)
    db.add(FamilyAssignation(users_assigned_id=member.id, users_responsable_id=responsable.id))
    db.commit()

    res = client_with_admin.get(f'/family-assignations/responsable/{responsable.id}/members')
    assert res.status_code == 200
    members = res.json()
    assert any(u['id'] == member.id for u in members)


def test_copy_assignations(client_with_admin: TestClient, admin_user: Users, db: Session):
    r_from = Users(username="rf", email="rf@example.com", password=hash_password("p"), firstname="RF", lastname="L", isactive=1)
    r_to = Users(username="rt", email="rt@example.com", password=hash_password("p"), firstname="RT", lastname="L", isactive=1)
    m1 = Users(username="m4", email="m4@example.com", password=hash_password("p"), firstname="M4", lastname="L", isactive=1)
    m2 = Users(username="m5", email="m5@example.com", password=hash_password("p"), firstname="M5", lastname="L", isactive=1)
    db.add_all([r_from, r_to, m1, m2])
    db.commit(); db.refresh(r_from); db.refresh(r_to); db.refresh(m1); db.refresh(m2)

    db.add(FamilyAssignation(users_assigned_id=m1.id, users_responsable_id=r_from.id))
    db.add(FamilyAssignation(users_assigned_id=m2.id, users_responsable_id=r_from.id))
    db.commit()

    res = client_with_admin.post('/family-assignations/copy', json={
        "from_responsable_id": r_from.id,
        "to_responsable_id": r_to.id,
    })
    assert res.status_code == 200
    payload = res.json()
    assert payload['count'] == 2

    # Ensure assignments exist for target
    rows = db.query(FamilyAssignation).filter(FamilyAssignation.users_responsable_id == r_to.id).all()
    assert len(rows) == 2


def test_transfer_assignations(client_with_admin: TestClient, admin_user: Users, db: Session):
    r_from = Users(username="rf2", email="rf2@example.com", password=hash_password("p"), firstname="RF2", lastname="L", isactive=1)
    r_to = Users(username="rt2", email="rt2@example.com", password=hash_password("p"), firstname="RT2", lastname="L", isactive=1)
    m1 = Users(username="m6", email="m6@example.com", password=hash_password("p"), firstname="M6", lastname="L", isactive=1)
    db.add_all([r_from, r_to, m1])
    db.commit(); db.refresh(r_from); db.refresh(r_to); db.refresh(m1)

    db.add(FamilyAssignation(users_assigned_id=m1.id, users_responsable_id=r_from.id))
    db.commit()

    res = client_with_admin.post('/family-assignations/transfer', json={
        "from_responsable_id": r_from.id,
        "to_responsable_id": r_to.id,
    })
    assert res.status_code == 200
    assert res.json()['count'] == 1

    # Ensure moved
    rows_from = db.query(FamilyAssignation).filter(FamilyAssignation.users_responsable_id == r_from.id).all()
    rows_to = db.query(FamilyAssignation).filter(FamilyAssignation.users_responsable_id == r_to.id).all()
    assert len(rows_from) == 0 and len(rows_to) == 1


def test_bulk_delete(client_with_admin: TestClient, admin_user: Users, db: Session):
    responsable = Users(username="resp3", email="r3@example.com", password=hash_password("p"), firstname="R3", lastname="L", isactive=1)
    m1 = Users(username="m7", email="m7@example.com", password=hash_password("p"), firstname="M7", lastname="L", isactive=1)
    m2 = Users(username="m8", email="m8@example.com", password=hash_password("p"), firstname="M8", lastname="L", isactive=1)
    db.add_all([responsable, m1, m2])
    db.commit(); db.refresh(responsable); db.refresh(m1); db.refresh(m2)

    db.add(FamilyAssignation(users_assigned_id=m1.id, users_responsable_id=responsable.id))
    db.add(FamilyAssignation(users_assigned_id=m2.id, users_responsable_id=responsable.id))
    db.commit()

    res = client_with_admin.post('/family-assignations/bulk-delete', json={
        "users_ids": [m1.id, m2.id],
        "responsable_id": responsable.id,
    })
    assert res.status_code == 200
    assert res.json()['status'] == 'deleted'

    rows = db.query(FamilyAssignation).filter(FamilyAssignation.users_responsable_id == responsable.id).all()
    assert len(rows) == 0
