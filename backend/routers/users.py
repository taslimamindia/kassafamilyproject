from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
import logging
import re
from datetime import datetime

from dependencies import get_cursor, get_current_user, has_role
from models import UserCreate, UserAdminUpdate, UserUpdate
from utils import parse_create_request, parse_update_request, generate_username_logic
from auth_utils import hash_password
from settings import settings
from aws_file import AwsFile

router = APIRouter()
logger = logging.getLogger("users")

@router.get("/users/{user_id}")
def get_user_by_id(user_id: int, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Authorization: admin can view any; admingroup can view only within same father/mother group; others forbidden
    if not has_role(cursor, current_user["id"], "admin"):
        if has_role(cursor, current_user["id"], "admingroup"):
            fid = current_user.get("id_father")
            mid = current_user.get("id_mother")
            same_group = False
            if fid is not None and (user.get("id_father") == fid or user.get("id") == fid):
                same_group = True
            if mid is not None and (user.get("id_mother") == mid or user.get("id") == mid):
                same_group = True
            if not same_group and user.get("id") != current_user.get("id"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        else:
            # Regular users cannot view other users by id
            if user.get("id") != current_user.get("id"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    user.pop("password", None)
    return user

@router.get("/users")
def get_members(cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    # Admin sees all; group admin sees only users sharing same father or same mother; include the parents themselves as well
    is_admin = has_role(cursor, current_user["id"], "admin")
    is_group_admin = has_role(cursor, current_user["id"], "admingroup")
    if is_admin:
        cursor.execute(
            """
            SELECT u.*, r.id AS role_id, r.role AS role_name
            FROM users u
            LEFT JOIN role_attribution ra ON ra.users_id = u.id
            LEFT JOIN roles r ON r.id = ra.roles_id
            ORDER BY u.id, r.id
            """
        )
    elif is_group_admin:
        fid = current_user.get("id_father")
        mid = current_user.get("id_mother")
        cursor.execute(
            """
            SELECT u.*, r.id AS role_id, r.role AS role_name
            FROM users u
            LEFT JOIN role_attribution ra ON ra.users_id = u.id
            LEFT JOIN roles r ON r.id = ra.roles_id
            WHERE (
                (%s IS NOT NULL AND (u.id_father = %s OR u.id = %s))
                OR (%s IS NOT NULL AND (u.id_mother = %s OR u.id = %s))
                OR u.id = %s
            )
            ORDER BY u.id, r.id
            """,
            (fid, fid, fid, mid, mid, mid, current_user.get("id")),
        )
    else:
        # Regular users see only themselves
        cursor.execute(
            """
            SELECT u.*, r.id AS role_id, r.role AS role_name
            FROM users u
            LEFT JOIN role_attribution ra ON ra.users_id = u.id
            LEFT JOIN roles r ON r.id = ra.roles_id
            WHERE u.id = %s
            ORDER BY u.id, r.id
            """,
            (current_user.get("id"),),
        )
    rows = cursor.fetchall()
    users_by_id = {}
    for row in rows:
        # Exclude super admin technically, but let's just mimic original logic
        uid = row["id"]
        if uid not in users_by_id:
            user_data = {k: v for k, v in row.items() if k != "password"}
            user_data["roles"] = []
            users_by_id[uid] = user_data

        if row.get("role_id") is not None:
            if not any(r["id"] == row["role_id"] for r in users_by_id[uid]["roles"]):
                users_by_id[uid]["roles"].append({"id": row["role_id"], "role": row["role_name"]})

    return list(users_by_id.values())

@router.post("/users")
async def create_user(request: Request, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    data, upload = await parse_create_request(request)
    if upload is not None:
        logger.info("[users] Image reçue (création): filename=%s, content_type=%s", getattr(upload, "filename", None), getattr(upload, "content_type", None))
    else:
        logger.info("[users] Aucune image reçue (création)")
    body = UserCreate(**data)
    
    try:
        body.username = generate_username_logic(body.firstname, body.lastname, body.birthday, cursor)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    if upload is not None:
        try:
            service = AwsFile(settings)
            up_res = service.add_image(upload_file=upload, folder="users", filename=body.username)
            body.image_url = up_res["url"]
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Echec d'upload image: {e}")

    # Validate parents
    if body.id_father:
        cursor.execute("SELECT id FROM users WHERE id = %s", (body.id_father,))
        if not cursor.fetchone():
            body.id_father = None
    if body.id_mother:
        cursor.execute("SELECT id FROM users WHERE id = %s", (body.id_mother,))
        if not cursor.fetchone():
            body.id_mother = None

    if body.id_father and body.id_mother and body.id_father == body.id_mother:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Le père et la mère doivent être différents")

    default_hashed = hash_password(settings.user_password_default)
    # Authorization for creation: admin anytime; group admin only within their group; others forbidden
    if not has_role(cursor, current_user["id"], "admin"):
        if has_role(cursor, current_user["id"], "admingroup"):
            fid = current_user.get("id_father")
            mid = current_user.get("id_mother")
            if not ((fid is not None and body.id_father == fid) or (mid is not None and body.id_mother == mid)):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create user outside your group")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
    cursor.execute("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM users")
    row_next = cursor.fetchone()
    next_user_id = row_next["next_id"] if isinstance(row_next, dict) else row_next[0]

    fields = [
        "id", "firstname", "lastname", "username", "password", "email", 
        "telephone", "birthday", "image_url", "id_father", "id_mother",
        "isactive", "isfirstlogin", "createdby","updatedby", "createdat", "updatedat"
    ]
    
    clean_tel = re.sub(r"[\s-]", "", body.telephone) if body.telephone else None

    values = [
        next_user_id,
        body.firstname,
        body.lastname,
        body.username,
        default_hashed,
        body.email,
        clean_tel,
        body.birthday,
        body.image_url,
        body.id_father,
        body.id_mother,
        body.isactive if body.isactive is not None else 0,
        body.isfirstlogin if body.isfirstlogin is not None else 1,
        current_user["id"],
        current_user["id"],
        datetime.now(),
        datetime.now()
    ]
    
    placeholders = ", ".join(["%s"] * len(values))
    sql = f"INSERT INTO users ({', '.join(fields)}) VALUES ({placeholders})"
    
    cursor.execute(sql, tuple(values))
    try:
        getattr(cursor, "_connection").commit()
    except Exception as e:
        logger.exception("[users] Commit failed during create_user")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
    
    new_id = cursor.lastrowid or next_user_id
    cursor.execute("SELECT * FROM users WHERE id = %s", (new_id,))
    user = cursor.fetchone()
    if user:
        user.pop("password", None)
    return user

@router.patch("/users/{user_id}")
async def update_user_by_id(user_id: int, request: Request, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    data, upload = await parse_update_request(request)
    if upload is not None:
        logger.info("[users] Image reçue (mise à jour id=%s): filename=%s, content_type=%s", user_id, getattr(upload, "filename", None), getattr(upload, "content_type", None))
    else:
        logger.info("[users] Aucune image reçue (mise à jour id=%s)", user_id)
    body = UserAdminUpdate(**data)
    
    fields = []
    values: List[object] = []
    
    if body.firstname is not None: fields.append("firstname = %s"); values.append(body.firstname)
    if body.lastname is not None: fields.append("lastname = %s"); values.append(body.lastname)
    if body.username is not None: fields.append("username = %s"); values.append(body.username)
    if body.email is not None: fields.append("email = %s"); values.append(body.email)
    if body.telephone is not None: fields.append("telephone = %s"); values.append(body.telephone)
    if body.birthday is not None: fields.append("birthday = %s"); values.append(body.birthday)
    if body.image_url is not None: fields.append("image_url = %s"); values.append(body.image_url)
    
    # Parent logic validation same as original...
    cursor.execute("SELECT id_father, id_mother, username FROM users WHERE id = %s", (user_id,))
    row_curr = cursor.fetchone()
    if not row_curr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Authorization: admin ok; group admin only if target is in same group; others forbidden
    if not has_role(cursor, current_user["id"], "admin"):
        if has_role(cursor, current_user["id"], "admingroup"):
            fid = current_user.get("id_father")
            mid = current_user.get("id_mother")
            same_group = False
            if fid is not None and (row_curr.get("id_father") == fid or row_curr.get("id") == fid):
                same_group = True
            if mid is not None and (row_curr.get("id_mother") == mid or row_curr.get("id") == mid):
                same_group = True
            if not same_group and row_curr.get("id") != current_user.get("id"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        else:
            # Regular users can only update themselves via /user
            if row_curr.get("id") != current_user.get("id"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        
    curr_father = row_curr.get("id_father")
    curr_mother = row_curr.get("id_mother")
    
    if body.id_father is not None:
        cursor.execute("SELECT id FROM users WHERE id = %s", (body.id_father,))
        if cursor.fetchone():
            curr_father = body.id_father
            fields.append("id_father = %s"); values.append(curr_father)
            
    if body.id_mother is not None:
        cursor.execute("SELECT id FROM users WHERE id = %s", (body.id_mother,))
        if cursor.fetchone():
            curr_mother = body.id_mother
            fields.append("id_mother = %s"); values.append(curr_mother)
            
    if curr_father and curr_mother and curr_father == curr_mother:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Le père et la mère doivent être différents")
        
    if body.isactive is not None: fields.append("isactive = %s"); values.append(body.isactive)
    if body.isfirstlogin is not None: fields.append("isfirstlogin = %s"); values.append(body.isfirstlogin)
    
    fields.append("updatedby = %s"); values.append(current_user["id"])
    fields.append("updatedat = CURRENT_TIMESTAMP")
    
    if upload is not None:
        desired_username = body.username or row_curr.get("username")
        if not desired_username:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="username requis")
        try:
            service = AwsFile(settings)
            old_url = row_curr.get("image_url")
            up_res = service.update_image(old_url=old_url, upload_file=upload, folder="users", filename=desired_username)
            fields.append("image_url = %s"); values.append(up_res["url"])
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
            
    if not fields:
        return row_curr # Actually should return full user.. but simple fallback

    sql = f"UPDATE users SET {', '.join(fields)} WHERE id = %s"
    values.append(user_id)
    cursor.execute(sql, tuple(values))
    try:
        getattr(cursor, "_connection").commit()
    except Exception:
        logger.exception("[users] Commit failed during update_user_by_id")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
        
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    u = cursor.fetchone()
    if u: u.pop("password", None)
    return u

@router.delete("/users/{user_id}")
def delete_user_by_id(user_id: int, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    # Authorization: admin ok; group admin only if target in same group; others forbidden
    cursor.execute("SELECT id, id_father, id_mother FROM users WHERE id = %s", (user_id,))
    target = cursor.fetchone()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not has_role(cursor, current_user["id"], "admin"):
        if has_role(cursor, current_user["id"], "admingroup"):
            fid = current_user.get("id_father")
            mid = current_user.get("id_mother")
            same_group = False
            if fid is not None and (target.get("id_father") == fid or target.get("id") == fid):
                same_group = True
            if mid is not None and (target.get("id_mother") == mid or target.get("id") == mid):
                same_group = True
            if not same_group and target.get("id") != current_user.get("id"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    cursor.execute(
        "UPDATE users SET isactive = %s, updatedby = %s, updatedat = CURRENT_TIMESTAMP WHERE id = %s",
        (0, current_user["id"], user_id),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    try:
        getattr(cursor, "_connection").commit()
    except Exception:
        logger.exception("[users] Commit failed during delete_user_by_id")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")
    return {"status": "deactivated", "id": user_id}

@router.get("/user")
def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    u = dict(current_user)
    u.pop("password", None)
    return u

@router.patch("/user")
def update_current_user_profile(body: UserUpdate, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    fields = []
    values = []
    if body.firstname is not None: fields.append("firstname = %s"); values.append(body.firstname)
    if body.lastname is not None: fields.append("lastname = %s"); values.append(body.lastname)
    if body.email is not None: fields.append("email = %s"); values.append(body.email)
    if body.telephone is not None: fields.append("telephone = %s"); values.append(body.telephone)
    if body.birthday is not None: fields.append("birthday = %s"); values.append(body.birthday)
    if body.image_url is not None: fields.append("image_url = %s"); values.append(body.image_url)

    if not fields:
        u = dict(current_user)
        u.pop("password", None)
        return u

    sql = f"UPDATE users SET {', '.join(fields)} WHERE id = %s"
    values.append(current_user["id"])
    cursor.execute(sql, tuple(values))
    try:
        getattr(cursor, "_connection").commit()
    except Exception:
        logger.exception("[users] Commit failed during update_current_user_profile")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database commit failed")

    cursor.execute("SELECT * FROM users WHERE id = %s", (current_user["id"],))
    updated = cursor.fetchone()
    updated.pop("password", None)
    return updated
