import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
# Adjust imports based on your project structure
from models_orm.users import Users
from models_orm.auth import RevokedToken
from auth_utils import hash_password, create_access_token, verify_password


# -----------------------------------------------------------------------------
# FIXTURES FOR DATA SETUP
# -----------------------------------------------------------------------------

@pytest.fixture
def test_user(db: Session):
    """
    Creates a standard active adult user for testing.
    """
    password_hash = hash_password("securepassword")
    user = Users(
        username="john_doe",
        email="john@example.com",
        password=password_hash,
        firstname="John",
        lastname="Doe",
        isactive=1,
        # Set birthday to 20 years ago (Major)
        birthday=date.today() - timedelta(days=365 * 20) 
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def token_header(test_user):
    """
    Generates a valid Bearer token for the test user.
    """
    access_token = create_access_token(data={"sub": str(test_user.id), "username": test_user.username})
    return {"Authorization": f"Bearer {access_token}", "token": access_token}

# -----------------------------------------------------------------------------
# LOGIN TESTS
# -----------------------------------------------------------------------------

def test_login_success(client: TestClient, test_user):
    """
    Test that a valid user can log in and receive a JWT token.
    """
    response = client.post(
        "/auth/login",
        data={"username": "john_doe", "password": "securepassword"} # OAuth2 form data
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_invalid_credentials(client: TestClient, test_user):
    """
    Test login with incorrect password.
    """
    response = client.post(
        "/auth/login",
        data={"username": "john_doe", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"

def test_login_inactive_user(client: TestClient, db: Session):
    """
    Test that an inactive user cannot log in.
    """
    user = Users(
        username="inactive_user",
        email="inactive@example.com",
        password=hash_password("password"),
        firstname="Inactive",
        lastname="User",
        isactive=0, # Inactive account
        birthday=date.today() - timedelta(days=365 * 25)
    )
    db.add(user)
    db.commit()

    response = client.post(
        "/auth/login",
        data={"username": "inactive_user", "password": "password"}
    )
    assert response.status_code == 403
    assert "deactivated" in response.json()["detail"]

def test_login_minor_user(client: TestClient, db: Session):
    """
    Test that a minor (under 18) cannot log in.
    """
    minor_birthday = date.today() - timedelta(days=365 * 15) # 15 years old
    user = Users(
        username="kid_user",
        email="kid@example.com",
        password=hash_password("password"),
        firstname="Kid",
        lastname="User",
        isactive=1,
        birthday=minor_birthday
    )
    db.add(user)
    db.commit()

    response = client.post(
        "/auth/login",
        data={"username": "kid_user", "password": "password"}
    )
    assert response.status_code == 401
    assert "major" in response.json()["detail"] or "legal age" in response.json()["detail"]

# -----------------------------------------------------------------------------
# /ME ENDPOINT TESTS
# -----------------------------------------------------------------------------

def test_verify_user(client: TestClient, test_user, token_header):
    """
    Test the /verify endpoint with a valid token.
    """
    headers = {"Authorization": token_header["Authorization"]}

    response = client.get("/auth/verify", headers=headers)

    assert response.status_code == 200
    user = response.json() or {}
    assert user["username"] == test_user.username
    assert user["email"] == test_user.email
    assert user["id"] == test_user.id

def test_verify_user_no_token(client: TestClient):
    """
    Test /verify without a token (should fail).
    """
    response = client.get("/auth/verify")
    assert response.status_code == 401

# -----------------------------------------------------------------------------
# LOGOUT TESTS
# -----------------------------------------------------------------------------

def test_logout(client: TestClient, db: Session, token_header):
    """
    Test logout: verifies success response and that token is added to DB blacklist.
    """
    headers = {"Authorization": token_header["Authorization"]}
    token_str = token_header["token"]

    response = client.post("/auth/logout", headers=headers)
    
    # 1. Check API response
    assert response.status_code == 200
    assert response.json()["message"] == "Successfully logged out"

    # 2. Check Database Side Effect (Token Revocation)
    revoked = db.query(RevokedToken).filter(RevokedToken.token == token_str).first()
    assert revoked is not None
    assert revoked.token == token_str

def test_logout_invalid_token(client: TestClient):
    """
    Test logout with a garbage token.
    """
    headers = {"Authorization": "Bearer invalidtoken123"}
    response = client.post("/auth/logout", headers=headers)
    
    # Depending on how jose handles garbage, it usually raises JWTError -> 401
    assert response.status_code == 401

# -----------------------------------------------------------------------------
# CHANGE-PASSWORD-FIRST-LOGIN TESTS
# -----------------------------------------------------------------------------

def test_change_password_first_login_success(client: TestClient, db: Session):
    adult_birthday = date.today() - timedelta(days=365 * 25)
    user = Users(
        username="firstlogin_user",
        email="fl@example.com",
        password=hash_password("oldpass"),
        firstname="FL",
        lastname="User",
        isactive=1,
        isfirstlogin=1,
        birthday=adult_birthday,
    )
    db.add(user)
    db.commit()

    resp = client.post(
        "/auth/change-password-first-login",
        json={
            "identifier": "firstlogin_user",
            "old_password": "oldpass",
            "new_password": "newpass123",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    updated = db.query(Users).filter(Users.username == "firstlogin_user").first()
    assert updated is not None
    assert int(updated.isfirstlogin or 0) == 0
    assert verify_password("newpass123", updated.password)


def test_change_password_first_login_missing_fields(client: TestClient, db: Session):
    adult_birthday = date.today() - timedelta(days=365 * 25)
    user = Users(
        username="missing_fields_user",
        email="mf@example.com",
        password=hash_password("oldpass"),
        firstname="MF",
        lastname="User",
        isactive=1,
        isfirstlogin=1,
        birthday=adult_birthday,
    )
    db.add(user)
    db.commit()

    resp = client.post(
        "/auth/change-password-first-login",
        json={
            "identifier": "missing_fields_user",
            # Missing old_password/new_password
        },
    )
    assert resp.status_code == 422


def test_change_password_first_login_not_first_login(client: TestClient, db: Session):
    adult_birthday = date.today() - timedelta(days=365 * 25)
    user = Users(
        username="not_first_user",
        email="nf@example.com",
        password=hash_password("oldpass"),
        firstname="NF",
        lastname="User",
        isactive=1,
        isfirstlogin=0,
        birthday=adult_birthday,
    )
    db.add(user)
    db.commit()

    resp = client.post(
        "/auth/change-password-first-login",
        json={
            "identifier": "not_first_user",
            "old_password": "oldpass",
            "new_password": "newpass",
        },
    )
    assert resp.status_code == 400


def test_change_password_first_login_inactive_user(client: TestClient, db: Session):
    adult_birthday = date.today() - timedelta(days=365 * 25)
    user = Users(
        username="inactive_fl_user",
        email="ifl@example.com",
        password=hash_password("oldpass"),
        firstname="IFL",
        lastname="User",
        isactive=0,
        isfirstlogin=1,
        birthday=adult_birthday,
    )
    db.add(user)
    db.commit()

    resp = client.post(
        "/auth/change-password-first-login",
        json={
            "identifier": "inactive_fl_user",
            "old_password": "oldpass",
            "new_password": "newpass",
        },
    )
    assert resp.status_code == 403
    assert "deactivated" in resp.json()["detail"]


def test_change_password_first_login_minor_user(client: TestClient, db: Session):
    minor_birthday = date.today() - timedelta(days=365 * 15)
    user = Users(
        username="minor_fl_user",
        email="mfl@example.com",
        password=hash_password("oldpass"),
        firstname="MFL",
        lastname="User",
        isactive=1,
        isfirstlogin=1,
        birthday=minor_birthday,
    )
    db.add(user)
    db.commit()

    resp = client.post(
        "/auth/change-password-first-login",
        json={
            "identifier": "minor_fl_user",
            "old_password": "oldpass",
            "new_password": "newpass",
        },
    )
    assert resp.status_code == 401
    assert "major" in resp.json()["detail"] or "legal age" in resp.json()["detail"]


def test_change_password_first_login_wrong_old_password(client: TestClient, db: Session):
    adult_birthday = date.today() - timedelta(days=365 * 25)
    user = Users(
        username="wrong_old_user",
        email="wo@example.com",
        password=hash_password("oldpass"),
        firstname="WO",
        lastname="User",
        isactive=1,
        isfirstlogin=1,
        birthday=adult_birthday,
    )
    db.add(user)
    db.commit()

    resp = client.post(
        "/auth/change-password-first-login",
        json={
            "identifier": "wrong_old_user",
            "old_password": "incorrect",
            "new_password": "newpass",
        },
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Incorrect username or password"