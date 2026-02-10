import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models_orm.users import Users
from models_orm.access_control import Roles, RoleAttribution
from models_orm.dependencies import get_current_user


def _create_user(db: Session, username: str, firstname: str = "F", lastname: str = "L") -> Users:
    u = Users(username=username, password="pwd", firstname=firstname, lastname=lastname)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_send_member_list_read_flow(client: TestClient, db: Session):
    sender = _create_user(db, "admin_sender", "Admin", "User")
    receiver = _create_user(db, "member_receiver", "Member", "User")

    client.app.dependency_overrides[get_current_user] = lambda: sender
    resp = client.post(
        "/messages",
        json={
            "recipient_type": "member",
            "recipient_id": receiver.id,
            "message": "Hello member!",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["count"] == 1

    # Receiver lists messages
    client.app.dependency_overrides[get_current_user] = lambda: receiver
    resp = client.get("/messages")
    assert resp.status_code == 200
    msgs = resp.json()
    assert len(msgs) >= 1
    # Find our message
    my_msg = next((m for m in msgs if m["message"] == "Hello member!"), None)
    assert my_msg is not None
    assert my_msg["isread"] == 0

    # Mark it read
    mid = my_msg["id"]
    resp = client.put(f"/messages/{mid}/read")
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

    # Verify read state
    resp = client.get("/messages")
    assert resp.status_code == 200
    msgs2 = resp.json()
    my_msg2 = next((m for m in msgs2 if m["id"] == mid), None)
    assert my_msg2 is not None
    assert my_msg2["isread"] == 1


def test_mark_all_messages_read(client: TestClient, db: Session):
    sender = _create_user(db, "admin_sender2", "Admin", "Two")
    receiver = _create_user(db, "member_receiver2", "Member", "Two")

    # Send two messages
    client.app.dependency_overrides[get_current_user] = lambda: sender
    for i in range(2):
        resp = client.post(
            "/messages",
            json={
                "recipient_type": "member",
                "recipient_id": receiver.id,
                "message": f"M{i}",
            },
        )
        assert resp.status_code == 200

    # Receiver marks all as read
    client.app.dependency_overrides[get_current_user] = lambda: receiver
    resp = client.put("/messages/read-all")
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

    resp = client.get("/messages")
    msgs = resp.json()
    # All messages for this receiver should be read
    for m in msgs:
        assert m["isread"] == 1


def test_user_message_info(client: TestClient, db: Session):
    sender = _create_user(db, "admin_sender3", "Admin", "Three")
    receiver = _create_user(db, "member_receiver3", "Member", "Three")

    # Send one message
    client.app.dependency_overrides[get_current_user] = lambda: sender
    resp = client.post(
        "/messages",
        json={
            "recipient_type": "member",
            "recipient_id": receiver.id,
            "message": "Info please",
        },
    )
    assert resp.status_code == 200

    # Receiver gets list to find message id
    client.app.dependency_overrides[get_current_user] = lambda: receiver
    resp = client.get("/messages")
    msgs = resp.json()
    mid = next((m["id"] for m in msgs if m["message"] == "Info please"), None)
    assert mid is not None

    # Fetch user info
    resp = client.get(f"/messages/{mid}/user-info")
    assert resp.status_code == 200
    info = resp.json()
    assert info["message_id"] == mid
    assert info["receiver_id"] == receiver.id
    assert info["sender"]["id"] == sender.id
    assert info["sender"]["firstname"] == "Admin"


def test_send_role_support_targets_admins(client: TestClient, db: Session):
    # Create two admin users and attribute 'admin' role
    admin1 = _create_user(db, "admin_user1", "Admin", "One")
    admin2 = _create_user(db, "admin_user2", "Admin", "Two")
    sender = admin1

    # Create admin role
    role = Roles(role="admin")
    db.add(role)
    db.commit()
    db.refresh(role)

    # Attribute role to both admins
    db.add_all([
        RoleAttribution(users_id=admin1.id, roles_id=role.id),
        RoleAttribution(users_id=admin2.id, roles_id=role.id),
    ])
    db.commit()

    # Send a 'support' message (maps to role 'admin')
    client.app.dependency_overrides[get_current_user] = lambda: sender
    resp = client.post(
        "/messages",
        json={
            "recipient_type": "support",
            "message": "Hello admins",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["count"] >= 2

    # One of the admins should see the message
    client.app.dependency_overrides[get_current_user] = lambda: admin2
    resp = client.get("/messages")
    assert resp.status_code == 200
    msgs = resp.json()
    assert any(m["message"] == "Hello admins" for m in msgs)

    # Cleanup override
    client.app.dependency_overrides.pop(get_current_user, None)
