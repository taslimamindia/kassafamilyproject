import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from models_orm.users import Users
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

def get_pm_by_name(client: TestClient, name: str):
    res = client.get('/payment-methods')
    if res.status_code != 200:
        return None
    for m in res.json():
        if m.get('name') == name:
            return m
    return None

@pytest.fixture
def admin_user(db: Session):
    user = Users(
        username="admin_tx",
        email="admin_tx@example.com",
        password=hash_password("password"),
        firstname="AdminTX",
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


def test_payment_methods_crud(client_with_admin: TestClient, admin_user: Users, db: Session):
    # Create allowed payment methods
    res = client_with_admin.post('/payment-methods', json={
        "name": "Orange money",
        "isactive": 1,
        "type_of_proof": "BOTH",
        "account_number": "OM-123456",
    })
    if res.status_code == 409:
        pm1 = get_pm_by_name(client_with_admin, 'Orange money')
        assert pm1 is not None
    else:
        assert res.status_code == 200
        pm1 = res.json()
    assert pm1['name'] == 'Orange money'

    res = client_with_admin.get('/payment-methods')
    assert res.status_code == 200
    methods = res.json()
    assert any(m['name'] == 'Orange money' for m in methods)

    # Update
    res = client_with_admin.patch(f"/payment-methods/{pm1['id']}", json={
        "account_number": "OM-654321",
    })
    assert res.status_code == 200
    assert res.json()['account_number'] == 'OM-654321'


def test_create_transaction_member_self(client: TestClient, db: Session):
    # Create a member user and set as current_user
    member = Users(username="member1", email="m1@example.com", password=hash_password("p"), firstname="M1", lastname="L", isactive=1)
    db.add(member)
    db.commit(); db.refresh(member)

    # Assign 'member' role
    ensure_role(db, 2, 'member')
    db.add(RoleAttribution(users_id=member.id, roles_id=2))
    db.commit()

    # Override current_user
    client.app.dependency_overrides[get_current_user] = lambda: member

    # Seed payment method
    admin = Users(username="seed_admin", email="sa@example.com", password=hash_password("p"), firstname="A", lastname="L", isactive=1)
    db.add(admin); db.commit(); db.refresh(admin)
    ensure_role(db, 1, 'admin'); db.add(RoleAttribution(users_id=admin.id, roles_id=1)); db.commit()
    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_pm = client.post('/payment-methods', json={"name": "Argent compte", "isactive": 1, "type_of_proof": "BOTH"})
    if res_pm.status_code == 409:
        pm = get_pm_by_name(client, 'Argent compte')
        assert pm is not None
        pm_id = pm['id']
    else:
        assert res_pm.status_code == 200
        pm_id = res_pm.json()['id']

    client.app.dependency_overrides[get_current_user] = lambda: member

    # Create transaction SAVED
    res = client.post('/transactions', json={
        "amount": 100.0,
        "proof_reference": "TX123",
        "users_id": member.id,
        "payment_methods_id": pm_id,
        "transaction_type": "CONTRIBUTION",
        "issubmitted": 0,
    })
    assert res.status_code == 200
    tx = res.json()
    assert tx['status'] == 'SAVED'
    assert tx['users_id'] == member.id

    # Cleanup override
    client.app.dependency_overrides.pop(get_current_user, None)


def test_create_transaction_treasury_auto_approve(client: TestClient, db: Session):
    # Treasury user
    treasurer = Users(username="treasury1", email="t1@example.com", password=hash_password("p"), firstname="T1", lastname="L", isactive=1)
    db.add(treasurer); db.commit(); db.refresh(treasurer)
    ensure_role(db, 3, 'treasury'); db.add(RoleAttribution(users_id=treasurer.id, roles_id=3)); db.commit()

    # Seed member target
    member = Users(username="member2", email="m2@example.com", password=hash_password("p"), firstname="M2", lastname="L", isactive=1)
    db.add(member); db.commit(); db.refresh(member)
    ensure_role(db, 2, 'member'); db.add(RoleAttribution(users_id=member.id, roles_id=2)); db.commit()

    # Seed payment method via admin
    admin = Users(username="admin2", email="a2@example.com", password=hash_password("p"), firstname="A2", lastname="L", isactive=1)
    db.add(admin); db.commit(); db.refresh(admin)
    ensure_role(db, 1, 'admin'); db.add(RoleAttribution(users_id=admin.id, roles_id=1)); db.commit()

    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_pm = client.post('/payment-methods', json={"name": "Virement bancaire", "isactive": 1, "type_of_proof": "BOTH", "account_number": "IBAN-XYZ"})
    if res_pm.status_code == 409:
        pm = get_pm_by_name(client, 'Virement bancaire')
        assert pm is not None
        pm_id = pm['id']
    else:
        assert res_pm.status_code == 200
        pm_id = res_pm.json()['id']

    # Create transaction submitted by treasury
    client.app.dependency_overrides[get_current_user] = lambda: treasurer
    res_tx = client.post('/transactions', json={
        "amount": 250.0,
        "proof_reference": "URL:http://example.com/proof",
        "users_id": member.id,
        "payment_methods_id": pm_id,
        "transaction_type": "CONTRIBUTION",
        "issubmitted": 1,
    })
    assert res_tx.status_code == 200
    tx = res_tx.json()
    assert tx['status'] == 'PARTIALLY_APPROVED'  # auto-approval by treasury on creation
    assert tx['payment_methods_id'] == pm_id

    client.app.dependency_overrides.pop(get_current_user, None)


def test_submit_transaction_and_approve_contribution(client: TestClient, db: Session):
    # Seed roles
    ensure_role(db, 1, 'admin')
    ensure_role(db, 2, 'member')
    ensure_role(db, 3, 'treasury')

    # Users
    creator = Users(username="creator", email="c@example.com", password=hash_password("p"), firstname="C", lastname="L", isactive=1)
    treas1 = Users(username="treas1", email="t1@example.com", password=hash_password("p"), firstname="T1", lastname="L", isactive=1)
    treas2 = Users(username="treas2", email="t2@example.com", password=hash_password("p"), firstname="T2", lastname="L", isactive=1)
    db.add_all([creator, treas1, treas2]); db.commit(); db.refresh(creator); db.refresh(treas1); db.refresh(treas2)
    db.add(RoleAttribution(users_id=creator.id, roles_id=2))
    db.add(RoleAttribution(users_id=treas1.id, roles_id=3))
    db.add(RoleAttribution(users_id=treas2.id, roles_id=3))
    db.commit()

    # Seed payment method via admin
    admin = Users(username="admin_tx3", email="a3@example.com", password=hash_password("p"), firstname="A3", lastname="L", isactive=1)
    db.add(admin); db.commit(); db.refresh(admin)
    db.add(RoleAttribution(users_id=admin.id, roles_id=1)); db.commit()
    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_pm = client.post('/payment-methods', json={"name": "Orange money", "isactive": 1, "type_of_proof": "BOTH", "account_number": "OM-000"})
    if res_pm.status_code == 409:
        pm = get_pm_by_name(client, 'Orange money')
        assert pm is not None
        pm_id = pm['id']
    else:
        assert res_pm.status_code == 200
        pm_id = res_pm.json()['id']

    # Create SAVED transaction by creator
    client.app.dependency_overrides[get_current_user] = lambda: creator
    res_tx = client.post('/transactions', json={
        "amount": 50.0,
        "proof_reference": "REF-50",
        "users_id": creator.id,
        "payment_methods_id": pm_id,
        "transaction_type": "CONTRIBUTION",
        "issubmitted": 0,
    })
    assert res_tx.status_code == 200
    tx_id = res_tx.json()['id']

    # Submit by creator -> PENDING
    res_sub = client.post(f'/transactions/{tx_id}/submit')
    assert res_sub.status_code == 200
    assert res_sub.json()['status'] in ['PENDING', 'PARTIALLY_APPROVED']

    # Approve by treasurer 1 -> PARTIALLY_APPROVED
    client.app.dependency_overrides[get_current_user] = lambda: treas1
    res_app1 = client.post(f'/transactions/{tx_id}/approvals', json={"note": "ok"})
    assert res_app1.status_code == 200
    assert res_app1.json()['transaction']['status'] == 'PARTIALLY_APPROVED'

    # Approve by treasurer 2 -> VALIDATED (2 approvals)
    client.app.dependency_overrides[get_current_user] = lambda: treas2
    res_app2 = client.post(f'/transactions/{tx_id}/approvals', json={"note": "ok2"})
    assert res_app2.status_code == 200
    assert res_app2.json()['transaction']['status'] == 'VALIDATED'

    client.app.dependency_overrides.pop(get_current_user, None)


def test_approve_expense_requires_all_board(client: TestClient, db: Session):
    # Roles
    ensure_role(db, 1, 'admin'); ensure_role(db, 4, 'board')

    # Users
    board1 = Users(username="board1", email="b1@example.com", password=hash_password("p"), firstname="B1", lastname="L", isactive=1)
    board2 = Users(username="board2", email="b2@example.com", password=hash_password("p"), firstname="B2", lastname="L", isactive=1)
    db.add_all([board1, board2]); db.commit(); db.refresh(board1); db.refresh(board2)
    # Ensure only our test users have board attributions
    from models_orm.access_control import Roles as RolesModel, RoleAttribution as RoleAttribModel
    board_roles = db.query(RolesModel.id).filter(RolesModel.role == 'board').all()
    role_ids = [int(r[0]) if isinstance(r, tuple) else int(getattr(r, 'id', r)) for r in board_roles]
    if role_ids:
        db.query(RoleAttribModel).filter(RoleAttribModel.roles_id.in_(role_ids)).delete(synchronize_session=False)
        db.commit()
    db.add(RoleAttribution(users_id=board1.id, roles_id=4)); db.add(RoleAttribution(users_id=board2.id, roles_id=4)); db.commit()

    # Seed payment method via admin
    admin = Users(username="admin_tx4", email="a4@example.com", password=hash_password("p"), firstname="A4", lastname="L", isactive=1)
    db.add(admin); db.commit(); db.refresh(admin)
    db.add(RoleAttribution(users_id=admin.id, roles_id=1)); db.commit()
    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_pm = client.post('/payment-methods', json={"name": "Virement bancaire", "isactive": 1, "type_of_proof": "BOTH", "account_number": "IBAN-000"})
    if res_pm.status_code == 409:
        pm = get_pm_by_name(client, 'Virement bancaire')
        assert pm is not None
        pm_id = pm['id']
    else:
        assert res_pm.status_code == 200
        pm_id = res_pm.json()['id']

    # Create EXPENSE by board1 for themselves
    client.app.dependency_overrides[get_current_user] = lambda: board1
    res_tx = client.post('/transactions', json={
        "amount": 300.0,
        "proof_reference": "EXP-300",
        "users_id": board1.id,
        "payment_methods_id": pm_id,
        "transaction_type": "EXPENSE",
        "issubmitted": 1,
    })
    assert res_tx.status_code == 200
    tx_id = res_tx.json()['id']

    # Approve by board1 -> PARTIALLY_APPROVED
    res_app1 = client.post(f'/transactions/{tx_id}/approvals', json={"note": "ok"})
    assert res_app1.status_code == 200
    assert res_app1.json()['transaction']['status'] == 'PARTIALLY_APPROVED'

    # Approve by board2 -> VALIDATED (all board)
    client.app.dependency_overrides[get_current_user] = lambda: board2
    res_app2 = client.post(f'/transactions/{tx_id}/approvals', json={"note": "ok2"})
    assert res_app2.status_code == 200
    assert res_app2.json()['transaction']['status'] == 'VALIDATED'

    client.app.dependency_overrides.pop(get_current_user, None)


def test_reject_transaction(client: TestClient, db: Session):
    # Roles
    ensure_role(db, 1, 'admin'); ensure_role(db, 3, 'treasury'); ensure_role(db, 2, 'member')

    admin = Users(username="admin_tx5", email="a5@example.com", password=hash_password("p"), firstname="A5", lastname="L", isactive=1)
    treas = Users(username="treasX", email="tx@example.com", password=hash_password("p"), firstname="TX", lastname="L", isactive=1)
    member = Users(username="memberX", email="mx@example.com", password=hash_password("p"), firstname="MX", lastname="L", isactive=1)
    db.add_all([admin, treas, member]); db.commit(); db.refresh(admin); db.refresh(treas); db.refresh(member)
    db.add(RoleAttribution(users_id=admin.id, roles_id=1)); db.add(RoleAttribution(users_id=treas.id, roles_id=3)); db.add(RoleAttribution(users_id=member.id, roles_id=2)); db.commit()

    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_pm = client.post('/payment-methods', json={"name": "Argent compte", "isactive": 1, "type_of_proof": "BOTH"})
    if res_pm.status_code == 409:
        pm = get_pm_by_name(client, 'Argent compte')
        assert pm is not None
        pm_id = pm['id']
    else:
        assert res_pm.status_code == 200
        pm_id = res_pm.json()['id']

    # Create by treasury for member
    client.app.dependency_overrides[get_current_user] = lambda: treas
    res_tx = client.post('/transactions', json={
        "amount": 120.0,
        "proof_reference": "C-120",
        "users_id": member.id,
        "payment_methods_id": pm_id,
        "transaction_type": "CONTRIBUTION",
        "issubmitted": 1,
    })
    assert res_tx.status_code == 200
    tx_id = res_tx.json()['id']

    # Reject by treasury -> REJECTED
    res_rej = client.post(f'/transactions/{tx_id}/reject', json={"reason": "bad ref"})
    assert res_rej.status_code == 200
    assert res_rej.json()['status'] == 'REJECTED'

    client.app.dependency_overrides.pop(get_current_user, None)


def test_set_proof_and_list_approvals(client: TestClient, db: Session):
    # Roles & users
    ensure_role(db, 1, 'admin'); ensure_role(db, 3, 'treasury'); ensure_role(db, 2, 'member')
    admin = Users(username="admin_tx6", email="a6@example.com", password=hash_password("p"), firstname="A6", lastname="L", isactive=1)
    treas = Users(username="treasY", email="ty@example.com", password=hash_password("p"), firstname="TY", lastname="L", isactive=1)
    member = Users(username="memberY", email="my@example.com", password=hash_password("p"), firstname="MY", lastname="L", isactive=1)
    db.add_all([admin, treas, member]); db.commit(); db.refresh(admin); db.refresh(treas); db.refresh(member)
    db.add(RoleAttribution(users_id=admin.id, roles_id=1)); db.add(RoleAttribution(users_id=treas.id, roles_id=3)); db.add(RoleAttribution(users_id=member.id, roles_id=2)); db.commit()

    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_pm = client.post('/payment-methods', json={"name": "Orange money", "isactive": 1, "type_of_proof": "BOTH"})
    if res_pm.status_code == 409:
        pm = get_pm_by_name(client, 'Orange money')
        assert pm is not None
        pm_id = pm['id']
    else:
        assert res_pm.status_code == 200
        pm_id = res_pm.json()['id']

    client.app.dependency_overrides[get_current_user] = lambda: treas
    res_tx = client.post('/transactions', json={
        "amount": 80.0,
        "proof_reference": "REF-80",
        "users_id": member.id,
        "payment_methods_id": pm_id,
        "transaction_type": "CONTRIBUTION",
        "issubmitted": 1,
    })
    assert res_tx.status_code == 200
    tx_id = res_tx.json()['id']

    # Set proof URL by admin
    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_set = client.patch(f'/transactions/{tx_id}/proof', json={"url": "https://example.com/img.png"})
    assert res_set.status_code == 200
    assert res_set.json()['proof_reference'] == 'https://example.com/img.png'

    # List approvals
    res_apps = client.get(f'/transactions/{tx_id}/approvals')
    assert res_apps.status_code == 200
    assert isinstance(res_apps.json(), list)

    client.app.dependency_overrides.pop(get_current_user, None)


def test_bulk_submit_and_approve(client: TestClient, db: Session):
    # Roles
    ensure_role(db, 1, 'admin'); ensure_role(db, 3, 'treasury'); ensure_role(db, 2, 'member')
    admin = Users(username="admin_tx7", email="a7@example.com", password=hash_password("p"), firstname="A7", lastname="L", isactive=1)
    treas = Users(username="treasZ", email="tz@example.com", password=hash_password("p"), firstname="TZ", lastname="L", isactive=1)
    member = Users(username="memberZ", email="mz@example.com", password=hash_password("p"), firstname="MZ", lastname="L", isactive=1)
    db.add_all([admin, treas, member]); db.commit(); db.refresh(admin); db.refresh(treas); db.refresh(member)
    db.add(RoleAttribution(users_id=admin.id, roles_id=1)); db.add(RoleAttribution(users_id=treas.id, roles_id=3)); db.add(RoleAttribution(users_id=member.id, roles_id=2)); db.commit()

    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_pm = client.post('/payment-methods', json={"name": "Argent compte", "isactive": 1, "type_of_proof": "BOTH"})
    if res_pm.status_code == 409:
        pm = get_pm_by_name(client, 'Argent compte')
        assert pm is not None
        pm_id = pm['id']
    else:
        assert res_pm.status_code == 200
        pm_id = res_pm.json()['id']

    # Create two SAVED transactions by member
    client.app.dependency_overrides[get_current_user] = lambda: member
    tx_ids = []
    for amt in [10.0, 15.5]:
        res_tx = client.post('/transactions', json={
            "amount": amt,
            "proof_reference": f"REF-{amt}",
            "users_id": member.id,
            "payment_methods_id": pm_id,
            "transaction_type": "CONTRIBUTION",
            "issubmitted": 0,
        })
        assert res_tx.status_code == 200
        tx_ids.append(res_tx.json()['id'])

    # Bulk submit
    res_bulk_sub = client.post('/transactions/bulk-submit', json={"transaction_ids": tx_ids})
    assert res_bulk_sub.status_code == 200
    assert res_bulk_sub.json()['count'] == 2

    # Bulk approve by treasury
    client.app.dependency_overrides[get_current_user] = lambda: treas
    res_bulk_app = client.post('/transactions/bulk-approve', json={"transaction_ids": tx_ids, "note": "bulk"})
    assert res_bulk_app.status_code == 200
    payload = res_bulk_app.json()
    assert payload['processed'] >= 2

    client.app.dependency_overrides.pop(get_current_user, None)


def test_delete_transaction(client: TestClient, db: Session):
    # Roles
    ensure_role(db, 1, 'admin'); ensure_role(db, 2, 'member')
    admin = Users(username="admin_tx8", email="a8@example.com", password=hash_password("p"), firstname="A8", lastname="L", isactive=1)
    member = Users(username="memberD", email="md@example.com", password=hash_password("p"), firstname="MD", lastname="L", isactive=1)
    db.add_all([admin, member]); db.commit(); db.refresh(admin); db.refresh(member)
    db.add(RoleAttribution(users_id=admin.id, roles_id=1)); db.add(RoleAttribution(users_id=member.id, roles_id=2)); db.commit()

    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_pm = client.post('/payment-methods', json={"name": "Orange money", "isactive": 1, "type_of_proof": "BOTH"})
    if res_pm.status_code == 409:
        pm = get_pm_by_name(client, 'Orange money')
        assert pm is not None
        pm_id = pm['id']
    else:
        assert res_pm.status_code == 200
        pm_id = res_pm.json()['id']

    client.app.dependency_overrides[get_current_user] = lambda: member
    res_tx = client.post('/transactions', json={
        "amount": 33.0,
        "proof_reference": "REF-33",
        "users_id": member.id,
        "payment_methods_id": pm_id,
        "transaction_type": "CONTRIBUTION",
        "issubmitted": 0,
    })
    assert res_tx.status_code == 200
    tx_id = res_tx.json()['id']

    # Delete by admin
    client.app.dependency_overrides[get_current_user] = lambda: admin
    res_del = client.delete(f'/transactions/{tx_id}')
    assert res_del.status_code == 200
    assert res_del.json()['status'] == 'deleted'

    client.app.dependency_overrides.pop(get_current_user, None)
