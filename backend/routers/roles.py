from fastapi import APIRouter, Depends, HTTPException, status
import logging
import mysql.connector

from dependencies import get_cursor, get_current_user
from models import Role, RoleAttributionCreate

router = APIRouter()
logger = logging.getLogger("roles")

@router.get("/roles")
def list_roles(cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute("SELECT * FROM roles ORDER BY id")
    return cursor.fetchall()

@router.get("/roles/{role_id}")
def get_role(role_id: int, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute("SELECT * FROM roles WHERE id = %s", (role_id,))
    role = cursor.fetchone()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role

@router.post("/roles")
def create_role(body: Role, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    if body.id is None:
        cursor.execute("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM roles")
        next_id = cursor.fetchone()["next_id"]
        body.id = int(next_id)
    cursor.execute("INSERT INTO roles (id, role) VALUES (%s, %s)", (body.id, body.role))
    try:
        getattr(cursor, "_connection").commit()
    except Exception:
        logger.exception("[roles] Commit failed during create_role")
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
    cursor.execute("SELECT * FROM roles WHERE id = %s", (body.id,))
    return cursor.fetchone()

@router.patch("/roles/{role_id}")
def update_role(role_id: int, body: Role, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute("UPDATE roles SET role = %s WHERE id = %s", (body.role, role_id))
    try:
        getattr(cursor, "_connection").commit()
    except Exception:
        logger.exception("[roles] Commit failed during update_role")
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
    cursor.execute("SELECT * FROM roles WHERE id = %s", (role_id,))
    role = cursor.fetchone()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role

@router.delete("/roles/{role_id}")
def delete_role(role_id: int, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute("DELETE FROM role_attribution WHERE roles_id = %s", (role_id,))
    cursor.execute("DELETE FROM roles WHERE id = %s", (role_id,))
    try:
        getattr(cursor, "_connection").commit()
    except Exception:
        logger.exception("[roles] Commit failed during delete_role")
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
    return {"status": "deleted", "id": role_id}

@router.get("/role-attributions")
def list_role_attributions(cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute(
        """
        SELECT ra.id, ra.users_id, ra.roles_id,
            u.username, u.firstname, u.lastname, u.image_url,
            r.role
        FROM role_attribution ra
        JOIN users u ON u.id = ra.users_id
        JOIN roles r ON r.id = ra.roles_id
        ORDER BY ra.id
        """
    )
    return cursor.fetchall()

@router.get("/users/{user_id}/roles")
def list_roles_for_user(user_id: int, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute(
        """
        SELECT r.id, r.role
        FROM role_attribution ra
        JOIN roles r ON r.id = ra.roles_id
        WHERE ra.users_id = %s
        ORDER BY r.id
        """,
        (user_id,)
    )
    return cursor.fetchall()

@router.post("/role-attributions")
def assign_role(body: RoleAttributionCreate, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute("SELECT id FROM users WHERE id = %s", (body.users_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    cursor.execute("SELECT id FROM roles WHERE id = %s", (body.roles_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    cursor.execute(
        "SELECT id FROM role_attribution WHERE users_id = %s AND roles_id = %s",
        (body.users_id, body.roles_id)
    )
    if cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role already assigned to user")
    
    try:
        cursor.execute(
            "INSERT INTO role_attribution (users_id, roles_id) VALUES (%s, %s)",
            (body.users_id, body.roles_id)
        )
        getattr(cursor, "_connection").commit()
    except mysql.connector.Error as e:
        # Handle duplicate key error from DB-level unique constraint
        if getattr(e, "errno", None) == 1062:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role already assigned to user")
        logger.exception("[roles] DB error during assign_role")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")
    except Exception:
        logger.exception("[roles] Commit failed during assign_role")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
    new_id = cursor.lastrowid
    cursor.execute("SELECT * FROM role_attribution WHERE id = %s", (new_id,))
    return cursor.fetchone()

@router.delete("/role-attributions/{attrib_id}")
def remove_role_attribution(attrib_id: int, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute("DELETE FROM role_attribution WHERE id = %s", (attrib_id,))
    try:
        getattr(cursor, "_connection").commit()
    except Exception:
        logger.exception("[roles] Commit failed during remove_role_attribution")
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
    return {"status": "deleted", "id": attrib_id}

@router.delete("/users/{user_id}/roles/{role_id}")
def remove_role_from_user(user_id: int, role_id: int, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute("DELETE FROM role_attribution WHERE users_id = %s AND roles_id = %s", (user_id, role_id))
    try:
        getattr(cursor, "_connection").commit()
    except Exception:
        logger.exception("[roles] Commit failed during remove_role_from_user")
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
    return {"status": "deleted", "user_id": user_id, "role_id": role_id}
