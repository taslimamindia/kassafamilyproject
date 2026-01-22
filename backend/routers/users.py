from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional
from pydantic import BaseModel
import logging
import re
from datetime import datetime
import asyncio

from dependencies import get_cursor, get_current_user, has_role
from models import UserCreate, UserAdminUpdate, UserUpdate, UserBulkTierUpdate
from utils import (
    parse_create_request,
    parse_update_request,
    generate_username_logic,
    ensure_unique_username,
    update_users_graph,
    get_family_ids,
    get_family_rows,
    send_notification,
)
from auth_utils import hash_password
from settings import settings
from aws_file import AwsFile


router = APIRouter()
logger = logging.getLogger("users")


@router.get("/users/receivers", response_model=List[dict])
async def get_receivers(
    cursor=Depends(get_cursor), current_user: dict = Depends(get_current_user)
):
    """
    Get list of users eligible to receive messages from the current user (member to member).
    Logic: isactive=1, role='member', exclude current user.
    """
    query = """
        SELECT DISTINCT u.id, u.firstname, u.lastname, u.username, u.image_url 
        FROM users u
        JOIN role_attribution ra ON u.id = ra.users_id
        JOIN roles r ON ra.roles_id = r.id
        WHERE u.isactive = 1
            AND r.role = 'member'
            AND u.id != %s
        ORDER BY u.firstname, u.lastname
    """
    await cursor.execute(query, (current_user["id"],))
    users = await cursor.fetchall()
    return users


@router.get("/users/{user_id}")
async def get_user_by_id(
    user_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    await cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = await cursor.fetchone()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    # Authorization: admin and treasury can view any; admingroup can view only assigned members via family_assignation (or self); others forbidden
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_treasury = await has_role(cursor, current_user["id"], "treasury")
    if not (is_admin or is_treasury):
        if await has_role(cursor, current_user["id"], "admingroup"):
            # Allow if target is current user
            if int(user.get("id")) != int(current_user.get("id")):
                # Check assignment in family_assignation
                await cursor.execute(
                    """
                    SELECT 1 FROM family_assignation
                    WHERE users_responsable_id = %s AND users_assigned_id = %s
                    """,
                    (current_user["id"], user_id),
                )
                if not await cursor.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                    )
        else:
            # Regular users cannot view other users by id
            if user.get("id") != current_user.get("id"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                )
    user.pop("password", None)
    return user


@router.get("/users")
async def get_members(
    request: Request,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    # Admin and treasury see all; group admin sees only assigned users via family_assignation (plus themselves)
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_treasury = await has_role(cursor, current_user["id"], "treasury")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")

    # Query filters: status (active/inactive/all), first_login (yes/no/all), q (search)
    qp = request.query_params
    status = (qp.get("status") or "active").lower()
    first_login = (qp.get("first_login") or "all").lower()
    role_filter = qp.get("role") or "all"
    q = qp.get("q") or None

    extra_where = []
    extra_vals = []
    if status in {"active", "inactive"}:
        extra_where.append("u.isactive = %s")
        extra_vals.append(1 if status == "active" else 0)

    # first_login filter
    if first_login in {"yes", "no"}:
        extra_where.append("u.isfirstlogin = %s")
        extra_vals.append(1 if first_login == "yes" else 0)

    # role filter
    if role_filter != "all":
        roles_list = [r.strip() for r in role_filter.split(",")]
        if len(roles_list) == 1:
            extra_where.append(
                "u.id IN (SELECT ra2.users_id FROM role_attribution ra2 JOIN roles r2 ON r2.id = ra2.roles_id WHERE r2.role = %s)"
            )
            extra_vals.append(roles_list[0])
        else:
            in_placeholders = ", ".join(["%s"] * len(roles_list))
            extra_where.append(
                f"u.id IN (SELECT ra2.users_id FROM role_attribution ra2 JOIN roles r2 ON r2.id = ra2.roles_id WHERE r2.role IN ({in_placeholders}))"
            )
            extra_vals.extend(roles_list)

    # search filter across common fields
    if q:
        like = f"%{q}%"
        extra_where.append(
            "(CAST(u.id AS CHAR) LIKE %s OR u.firstname LIKE %s OR u.lastname LIKE %s OR u.username LIKE %s OR u.email LIKE %s OR u.telephone LIKE %s OR u.birthday LIKE %s)"
        )
        extra_vals.extend([like, like, like, like, like, like, like])

    # Generic filters
    # Allow filtering by specific columns if passed in query params
    allowed_columns = {
        "id",
        "firstname",
        "lastname",
        "username",
        "email",
        "telephone",
        "birthday",
        "gender",
        "contribution_tier",
        "id_father",
        "id_mother",
        "createdby",
        "updatedby",
    }

    for key, val in qp.items():
        if key in allowed_columns:
            if "," in val:
                vals = [v.strip() for v in val.split(",")]
                placeholders = ", ".join(["%s"] * len(vals))
                extra_where.append(f"u.{key} IN ({placeholders})")
                extra_vals.extend(vals)
            else:
                extra_where.append(f"u.{key} = %s")
                extra_vals.append(val)

    if is_admin or is_treasury:
        base_sql = """
            SELECT u.*, r.id AS role_id, r.role AS role_name
            FROM users u
            LEFT JOIN role_attribution ra ON ra.users_id = u.id
            LEFT JOIN roles r ON r.id = ra.roles_id
            {where}
            ORDER BY u.id, r.id
            """
        where_clause = ("WHERE " + " AND ".join(extra_where)) if extra_where else ""
        await cursor.execute(base_sql.format(where=where_clause), tuple(extra_vals))
    elif is_group_admin:
        # Group admin: only users assigned to them via family_assignation, plus themselves
        base_sql = """
            SELECT u.*, r.id AS role_id, r.role AS role_name
            FROM users u
            LEFT JOIN role_attribution ra ON ra.users_id = u.id
            LEFT JOIN roles r ON r.id = ra.roles_id
            LEFT JOIN family_assignation fa ON fa.users_assigned_id = u.id
            WHERE (fa.users_responsable_id = %s OR u.id = %s)
            {and_extra}
            ORDER BY u.id, r.id
            """
        and_extra = (" AND " + " AND ".join(extra_where)) if extra_where else ""
        vals = [current_user.get("id"), current_user.get("id")] + extra_vals
        await cursor.execute(base_sql.format(and_extra=and_extra), tuple(vals))
    else:
        # Regular users see only themselves
        base_sql = """
            SELECT u.*, r.id AS role_id, r.role AS role_name
            FROM users u
            LEFT JOIN role_attribution ra ON ra.users_id = u.id
            LEFT JOIN roles r ON r.id = ra.roles_id
            WHERE u.id = %s
            {and_extra}
            """
        and_extra = (" AND " + " AND ".join(extra_where)) if extra_where else ""
        vals = [current_user.get("id")] + extra_vals
        await cursor.execute(base_sql.format(and_extra=and_extra), tuple(vals))

    rows = await cursor.fetchall()

    # Note: lineage/graph union removed for admingroup; scope now defined solely by family_assignation
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
                users_by_id[uid]["roles"].append(
                    {"id": row["role_id"], "role": row["role_name"]}
                )

    return list(users_by_id.values())


@router.post("/users")
async def create_user(
    request: Request,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    data, upload = await parse_create_request(request)
    if upload is not None:
        logger.info(
            "[users] Image reçue (création): filename=%s, content_type=%s",
            getattr(upload, "filename", None),
            getattr(upload, "content_type", None),
        )
    else:
        logger.info("[users] Aucune image reçue (création)")
    body = UserCreate(**data)

    if not body.username or not body.username.strip():
        try:
            # generate_username_logic is sync; run it in a thread using the raw cursor
            body.username = await asyncio.to_thread(
                generate_username_logic,
                body.firstname,
                body.lastname,
                body.birthday,
                cursor._cursor,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    else:
        try:
            body.username = await asyncio.to_thread(
                ensure_unique_username, body.username, cursor._cursor
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    if upload is not None:
        try:
            service = AwsFile(settings)
            up_res = await asyncio.to_thread(
                service.add_image, upload, "users", body.username
            )
            body.image_url = up_res["url"]
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Echec d'upload image: {e}",
            )

    # Validate parents
    if body.id_father:
        await cursor.execute("SELECT id FROM users WHERE id = %s", (body.id_father,))
        if not await cursor.fetchone():
            body.id_father = None
    if body.id_mother:
        await cursor.execute("SELECT id FROM users WHERE id = %s", (body.id_mother,))
        if not await cursor.fetchone():
            body.id_mother = None

    if body.id_father and body.id_mother and body.id_father == body.id_mother:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le père et la mère doivent être différents",
        )

    # If birthday provided and user is minor, force account inactive
    if body.birthday:
        try:
            bd = datetime.fromisoformat(str(body.birthday))
        except Exception:
            try:
                bd = datetime.strptime(str(body.birthday), "%Y-%m-%d")
            except Exception:
                bd = None
        if bd:
            age = int((datetime.now() - bd).days / 365.25)
            if age < 18:
                body.isactive = 0

    default_hashed = hash_password(settings.user_password_default)
    # Authorization for creation: admin anytime; group admin only within their group; others forbidden
    if not await has_role(cursor, current_user["id"], "admin"):
        if await has_role(cursor, current_user["id"], "admingroup"):
            fid = current_user.get("id_father")
            mid = current_user.get("id_mother")
            if not (
                (fid is not None and body.id_father == fid)
                or (mid is not None and body.id_mother == mid)
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot create user outside your group",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    await cursor.execute("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM users")
    row_next = await cursor.fetchone()
    next_user_id = row_next["next_id"] if isinstance(row_next, dict) else row_next[0]

    fields = [
        "id",
        "firstname",
        "lastname",
        "username",
        "password",
        "email",
        "telephone",
        "birthday",
        "image_url",
        "gender",
        "contribution_tier",
        "id_father",
        "id_mother",
        "isactive",
        "isfirstlogin",
        "createdby",
        "updatedby",
        "createdat",
        "updatedat",
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
        body.gender,
        body.contribution_tier,
        body.id_father,
        body.id_mother,
        body.isactive if body.isactive is not None else 0,
        body.isfirstlogin if body.isfirstlogin is not None else 1,
        current_user["id"],
        current_user["id"],
        datetime.now(),
        datetime.now(),
    ]

    placeholders = ", ".join(["%s"] * len(values))
    sql = f"INSERT INTO users ({', '.join(fields)}) VALUES ({placeholders})"

    await cursor.execute(sql, tuple(values))
    try:
        await cursor.commit()
        # Refresh users graph after DB change
        try:
            await update_users_graph(request.app, cursor)
        except Exception:
            logger.exception("[users] Failed to refresh users graph after create")
    except Exception as e:
        logger.exception("[users] Commit failed during create_user")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    new_id = cursor.lastrowid or next_user_id
    # Auto-assignments when created by a group admin
    try:
        if await has_role(cursor, current_user["id"], "admingroup"):
            assignments_to_insert = []

            # Check if assignment to current admingroup already exists
            await cursor.execute(
                "SELECT 1 FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id = %s",
                (current_user["id"], new_id),
            )
            exists_self = await cursor.fetchone()

            # Determine next id for family_assignation (schema may not auto-increment)
            await cursor.execute("SELECT COALESCE(MAX(id), 0) AS max_id FROM family_assignation")
            row_max = await cursor.fetchone() or {"max_id": 0}
            next_fa_id = int(row_max.get("max_id") or 0) + 1

            if not exists_self:
                assignments_to_insert.append((next_fa_id, new_id, int(current_user["id"])))
                next_fa_id += 1

            # Find co-responsables (role admingroup) who share at least one assigned user with current admingroup
            await cursor.execute(
                """
                SELECT DISTINCT fa2.users_responsable_id AS rid
                FROM family_assignation fa1
                JOIN family_assignation fa2 ON fa1.users_assigned_id = fa2.users_assigned_id
                JOIN role_attribution ra ON ra.users_id = fa2.users_responsable_id
                JOIN roles r ON r.id = ra.roles_id
                WHERE fa1.users_responsable_id = %s
                AND fa2.users_responsable_id <> %s
                AND r.role = 'admingroup'
                """,
                (current_user["id"], current_user["id"]),
            )
            co_rows = await cursor.fetchall() or []
            co_ids = []
            for r in co_rows:
                try:
                    rid = int(r.get("rid") if isinstance(r, dict) else r[0])
                except Exception:
                    continue
                if rid != int(current_user["id"]):
                    co_ids.append(rid)

            for rid in co_ids:
                await cursor.execute(
                    "SELECT 1 FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id = %s",
                    (rid, new_id),
                )
                if not await cursor.fetchone():
                    assignments_to_insert.append((next_fa_id, new_id, rid))
                    next_fa_id += 1

            if assignments_to_insert:
                try:
                    await cursor.executemany(
                        "INSERT INTO family_assignation (id, users_assigned_id, users_responsable_id) VALUES (%s, %s, %s)",
                        assignments_to_insert,
                    )
                    await cursor.commit()
                except Exception:
                    logger.exception(
                        "[users] Failed to auto-assign family_assignation for new user %s",
                        new_id,
                    )
    except Exception:
        logger.exception(
            "[users] Unexpected error during admingroup auto-assign for new user %s",
            new_id,
        )
    await cursor.execute("SELECT * FROM users WHERE id = %s", (new_id,))
    user = await cursor.fetchone()

    # Notify admins about new user
    try:
        await cursor.execute(
            """
            SELECT ra.users_id 
            FROM role_attribution ra
            JOIN roles r ON r.id = ra.roles_id
            WHERE r.role = 'admin'
            """
        )
        admin_rows = await cursor.fetchall()
        admin_ids = [r["users_id"] if isinstance(r, dict) else r[0] for r in admin_rows]
        
        user_name = f"{body.firstname} {body.lastname}".strip()
        msg = f"Un nouvel utilisateur {user_name} a été créé."
        await send_notification(cursor, admin_ids, msg, sender_id=current_user["id"], link=f"/users/{new_id}")
    except Exception as e:
        logger.warning(f"[users] Failed to notify admins about new user: {e}")

    if user:
        user.pop("password", None)
    return user


@router.patch("/users/bulk-tier")
async def bulk_update_user_tier(
    request: Request,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    try:
        data = await request.json()
        body = UserBulkTierUpdate(**data)
    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=422, detail=str(e))

    # Only admin can do bulk update for now
    if not await has_role(cursor, current_user["id"], "admin") and not await has_role(
        cursor, current_user["id"], "admingroup"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if not body.user_ids:
        return {"message": "No users updated"}

    placeholders = ", ".join(["%s"] * len(body.user_ids))
    sql = f"UPDATE users SET contribution_tier = %s WHERE id IN ({placeholders})"

    vals = [body.contribution_tier] + body.user_ids

    await cursor.execute(sql, tuple(vals))
    try:
        await cursor.commit()
        try:
            await update_users_graph(request.app, cursor)
        except Exception:
            logger.exception("[users] Failed to refresh users graph after bulk tier update")
    except Exception as e:
        logger.error(f"Error updating bulk tiers: {e}")
        raise HTTPException(status_code=500, detail="Database error")

    return {"message": "Updated successfully"}


@router.patch("/users/{user_id}")
async def update_user_by_id(
    user_id: int,
    request: Request,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    data, upload = await parse_update_request(request)
    if upload is not None:
        logger.info(
            "[users] Image reçue (mise à jour id=%s): filename=%s, content_type=%s",
            user_id,
            getattr(upload, "filename", None),
            getattr(upload, "content_type", None),
        )
    else:
        logger.info("[users] Aucune image reçue (mise à jour id=%s)", user_id)
    raw_remove = data.pop("remove_image", False)
    if isinstance(raw_remove, str):
        remove_image_flag = raw_remove.strip().lower() in {"1", "true", "yes", "on"}
    else:
        remove_image_flag = bool(raw_remove)

    body = UserAdminUpdate(**data)

    await cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    row_curr = await cursor.fetchone()
    if not row_curr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if upload is not None:
        remove_image_flag = False

    fields = []
    values: List[object] = []

    if body.firstname is not None:
        fields.append("firstname = %s")
        values.append(body.firstname)
    if body.lastname is not None:
        fields.append("lastname = %s")
        values.append(body.lastname)
    if body.username is not None:
        from utils import ensure_unique_username

        try:
            unique_uname = await asyncio.to_thread(
                ensure_unique_username,
                body.username,
                cursor._cursor,
                exclude_user_id=user_id,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        fields.append("username = %s")
        values.append(unique_uname)
    if body.email is not None:
        fields.append("email = %s")
        values.append(body.email)
    if body.telephone is not None:
        fields.append("telephone = %s")
        values.append(body.telephone)
    if body.birthday is not None:
        fields.append("birthday = %s")
        values.append(body.birthday)
    if body.gender is not None:
        fields.append("gender = %s")
        values.append(body.gender)

    # Allow clearing contribution_tier if explicitly passed (as null or empty string)
    if "contribution_tier" in data:
        fields.append("contribution_tier = %s")
        values.append(body.contribution_tier)

    # Authorization: admin ok; group admin only if target is assigned via family_assignation (or self); others forbidden
    if not await has_role(cursor, current_user["id"], "admin"):
        if await has_role(cursor, current_user["id"], "admingroup"):
            target_id = int(row_curr.get("id"))
            if target_id != int(current_user.get("id")):
                await cursor.execute(
                    "SELECT 1 FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id = %s",
                    (current_user["id"], target_id),
                )
                if not await cursor.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                    )
        else:
            # Regular users can only update themselves via /user
            if row_curr.get("id") != current_user.get("id"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                )

    curr_father = row_curr.get("id_father")
    curr_mother = row_curr.get("id_mother")

    if body.id_father is not None:
        await cursor.execute("SELECT id FROM users WHERE id = %s", (body.id_father,))
        if await cursor.fetchone():
            curr_father = body.id_father
            fields.append("id_father = %s")
            values.append(curr_father)

    if body.id_mother is not None:
        await cursor.execute("SELECT id FROM users WHERE id = %s", (body.id_mother,))
        if await cursor.fetchone():
            curr_mother = body.id_mother
            fields.append("id_mother = %s")
            values.append(curr_mother)

    if curr_father and curr_mother and curr_father == curr_mother:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le père et la mère doivent être différents",
        )

    # Ensure that if resulting birthday makes the user a minor, the account cannot be active
    final_birthday = None
    if body.birthday is not None:
        final_birthday = body.birthday
    else:
        final_birthday = row_curr.get("birthday")

    if final_birthday:
        try:
            bd = datetime.fromisoformat(str(final_birthday))
        except Exception:
            try:
                bd = datetime.strptime(str(final_birthday), "%Y-%m-%d")
            except Exception:
                bd = None
        if bd:
            age = int((datetime.now() - bd).days / 365.25)
            if age < 18:
                # force inactive
                body.isactive = 0

    if remove_image_flag:
        old_url = row_curr.get("image_url")
        if old_url:
            try:
                service = AwsFile(settings)
                await asyncio.to_thread(service.delete_image, old_url)
            except Exception as exc:
                logger.warning(
                    "[users] Impossible de supprimer l'image existante (id=%s): %s",
                    user_id,
                    exc,
                )
        fields.append("image_url = %s")
        values.append(None)
        
    elif body.image_url is not None and upload is None:
        fields.append("image_url = %s")
        values.append(body.image_url)

    if body.isactive is not None:
        fields.append("isactive = %s")
        values.append(body.isactive)

    if body.isfirstlogin is not None:
        fields.append("isfirstlogin = %s")
        values.append(body.isfirstlogin)
        # Reset password to default if isfirstlogin set to 1
        if body.isfirstlogin == 1:
            from auth_utils import hash_password
            new_pass_hash = hash_password(settings.user_password_default)
            fields.append("password = %s")
            values.append(new_pass_hash)

    fields.append("updatedby = %s")
    values.append(current_user["id"])
    fields.append("updatedat = CURRENT_TIMESTAMP")

    if upload is not None:
        desired_username = (
            values[fields.index("username = %s")]
            if "username = %s" in fields
            else (body.username or row_curr.get("username"))
        )
        if not desired_username:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="username requis",
            )
        try:
            service = AwsFile(settings)
            old_url = row_curr.get("image_url")
            up_res = await asyncio.to_thread(
                service.update_image, old_url, upload, "users", desired_username
            )
            fields.append("image_url = %s")
            values.append(up_res["url"])
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
            )

    if not fields:
        return row_curr  # Actually should return full user.. but simple fallback

    sql = f"UPDATE users SET {', '.join(fields)} WHERE id = %s"
    values.append(user_id)
    await cursor.execute(sql, tuple(values))
    try:
        await cursor.commit()
        try:
            await update_users_graph(request.app, cursor)
        except Exception:
            logger.exception("[users] Failed to refresh users graph after update")
    except Exception:
        logger.exception("[users] Commit failed during update_user_by_id")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    await cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    u = await cursor.fetchone()
    if u:
        u.pop("password", None)
    return u


@router.delete("/users/{user_id}")
async def delete_user_by_id(
    user_id: int,
    hard: bool = False,
    request: Request = None,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    # Authorization: admin ok; group admin only if target assigned via family_assignation (or self); others forbidden
    await cursor.execute(
        "SELECT id, id_father, id_mother FROM users WHERE id = %s", (user_id,)
    )
    target = await cursor.fetchone()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    is_admin = await has_role(cursor, current_user["id"], "admin")

    if not is_admin:
        if hard:
            # Only admins can hard delete
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can perform hard delete",
            )

        if await has_role(cursor, current_user["id"], "admingroup"):
            target_id = int(target.get("id"))
            if target_id != int(current_user.get("id")):
                await cursor.execute(
                    "SELECT 1 FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id = %s",
                    (current_user["id"], target_id),
                )
                if not await cursor.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                    )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    if hard:
        # Check for dependencies (like being a parent to other users)?
        # For now, let SQL errors handle constraints or cascade if configured.
        # Assuming simple DELETE for now.
        try:
            # First remove role attributions to avoid constraint errors if not cascaded
            await cursor.execute(
                "DELETE FROM role_attribution WHERE users_id = %s", (user_id,)
            )
            await cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
            await cursor.commit()
            if request is not None:
                try:
                    await update_users_graph(request.app, cursor)
                except Exception:
                    logger.exception("[users] Failed to refresh users graph after hard delete")
            return {"status": "deleted", "id": user_id}
        except Exception as e:
            logger.exception("[users] Hard delete failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Impossible de supprimer l'utilisateur (contraintes DB?)",
            )

    await cursor.execute(
        "UPDATE users SET isactive = %s, updatedby = %s, updatedat = CURRENT_TIMESTAMP WHERE id = %s",
        (0, current_user["id"], user_id),
    )
    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    try:
        await cursor.commit()
        if request is not None:
            try:
                await update_users_graph(request.app, cursor)
            except Exception:
                logger.exception("[users] Failed to refresh users graph after soft delete")
    except Exception:
        logger.exception("[users] Commit failed during delete_user_by_id")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"status": "deactivated", "id": user_id}


@router.get("/user")
async def get_current_user_profile(
    cursor=Depends(get_cursor), current_user: dict = Depends(get_current_user)
):
    await cursor.execute(
        """
        SELECT r.role
        FROM role_attribution ra
        JOIN roles r ON ra.roles_id = r.id
        WHERE ra.users_id = %s
        """,
        (current_user["id"],),
    )
    rows = await cursor.fetchall() or []
    roles = []
    for r in rows:
        try:
            if isinstance(r, dict):
                roles.append({"role": r.get("role")})
            else:
                roles.append({"role": r[0]})
        except Exception:
            continue

    u = dict(current_user)
    u.pop("password", None)
    u["roles"] = roles
    return u


class UserSchema(BaseModel):
    id: int
    firstname: str
    lastname: str
    role: Optional[str] = None
    image_url: Optional[str] = None
    birthday: Optional[str] = None
    id_father: Optional[int] = None
    id_mother: Optional[int] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None


@router.get("/tree", response_model=List[UserSchema])
async def get_tree(cursor=Depends(get_cursor)):
    # Fetch users and gender to compute role from relationships (not from DB roles table)
    sql = """
        SELECT u.id, u.firstname, u.lastname, u.image_url, u.birthday, u.id_father, u.id_mother, u.gender
        FROM users u
        ORDER BY u.id
        """
    await cursor.execute(sql)
    rows = await cursor.fetchall()

    users_map = {}
    # collect raw users and build children mapping
    children_map = {}
    for row in rows:
        uid = row["id"]
        users_map[uid] = {
            "id": uid,
            "firstname": row.get("firstname"),
            "lastname": row.get("lastname"),
            "image_url": row.get("image_url"),
            "birthday": (
                str(row.get("birthday")) if row.get("birthday") is not None else None
            ),
            "id_father": row.get("id_father"),
            "id_mother": row.get("id_mother"),
            "gender": (row.get("gender") or "").strip().lower(),
            "_fullname": f"{row.get('firstname') or ''} {row.get('lastname') or ''}".strip(),
        }
        # initialize children list
        children_map.setdefault(uid, [])

    # populate children map
    for uid, u in users_map.items():
        fid = u.get("id_father")
        mid = u.get("id_mother")
        if fid:
            children_map.setdefault(fid, []).append(uid)
        if mid:
            children_map.setdefault(mid, []).append(uid)

    def compute_role(u):
        gid = u["id"]
        gender = u.get("gender", "")
        has_children = bool(children_map.get(gid))

        # Only assign parent roles. Do not mark children as "Fils"/"Fille".
        if has_children:
            if gender.startswith("m") or gender in {"male", "h", "homme"}:
                return "Père"
            if gender.startswith("f") or gender in {"female", "femme"}:
                return "Mère"
            return "Parent"

        return None

    result = []
    for uid, u in users_map.items():
        fid = u.get("id_father")
        mid = u.get("id_mother")
        father_name = users_map[fid]["_fullname"] if fid and fid in users_map else None
        mother_name = users_map[mid]["_fullname"] if mid and mid in users_map else None

        # Exclude users that have neither parents nor children
        if fid or mid or children_map.get(uid):
            item = {
                "id": u["id"],
                "firstname": u["firstname"],
                "lastname": u["lastname"],
                "role": compute_role(u),
                "image_url": u.get("image_url"),
                "birthday": u.get("birthday"),
                "id_father": fid,
                "id_mother": mid,
                "father_name": father_name,
                "mother_name": mother_name,
            }
            result.append(item)

    result.sort(key=lambda x: x["id"])
    return result


@router.patch("/user")
async def update_current_user_profile(
    body: UserUpdate,
    request: Request,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    fields = []
    values = []
    if body.firstname is not None:
        fields.append("firstname = %s")
        values.append(body.firstname)
    if body.lastname is not None:
        fields.append("lastname = %s")
        values.append(body.lastname)
    if body.email is not None:
        fields.append("email = %s")
        values.append(body.email)
    if body.telephone is not None:
        fields.append("telephone = %s")
        values.append(body.telephone)
    if body.birthday is not None:
        fields.append("birthday = %s")
        values.append(body.birthday)
    if body.image_url is not None:
        fields.append("image_url = %s")
        values.append(body.image_url)
    if body.gender is not None:
        fields.append("gender = %s")
        values.append(body.gender)

    if not fields:
        u = dict(current_user)
        u.pop("password", None)
        return u

    sql = f"UPDATE users SET {', '.join(fields)} WHERE id = %s"
    values.append(current_user["id"])
    await cursor.execute(sql, tuple(values))
    try:
        await cursor.commit()
        try:
            await update_users_graph(request.app, cursor)
        except Exception:
            logger.exception("[users] Failed to refresh users graph after current user profile update")
    except Exception:
        logger.exception("[users] Commit failed during update_current_user_profile")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    await cursor.execute("SELECT * FROM users WHERE id = %s", (current_user["id"],))
    updated = await cursor.fetchone()
    updated.pop("password", None)
    return updated


@router.get("/users/{user_id}/lineage-test")
async def get_user_lineage_test(
    user_id: int,
    request: Request,
    cursor=Depends(get_cursor),
):
    """
    Temporary test endpoint to inspect computed family lineage from the in-memory graph.
    Returns only first and last names (no IDs).
    """

    # Ensure the graph exists; build/refresh if missing
    app = request.app
    graph = getattr(app.state, "users_graph", None)
    if graph is None:
        try:
            await update_users_graph(app, cursor)
            graph = getattr(app.state, "users_graph", None)
        except Exception:
            logger.exception("[users] Unable to build users_graph for lineage test")
    if graph is None:
        raise HTTPException(status_code=500, detail="Graph not available")

    version = getattr(app.state, "users_graph_version", None)
    rows = await get_family_rows(cursor, graph, user_id)
    names = [
        {"firstname": r.get("firstname"), "lastname": r.get("lastname")} for r in rows
    ]
    return {"version": version, "count": len(names), "names": names}


@router.get("/users/{user_id}/parents")
async def get_parents_by_user_id(
    user_id: int,
    cursor=Depends(get_cursor),
):
    """
    Public endpoint: returns father and mother for a given user id in a single call.
    Response: { father: User | null, mother: User | null }
    """
    await cursor.execute("SELECT id_father, id_mother FROM users WHERE id = %s", (user_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    fid = row.get("id_father") if isinstance(row, dict) else row[0]
    mid = row.get("id_mother") if isinstance(row, dict) else row[1]

    father = None
    mother = None

    if fid is not None:
        await cursor.execute("SELECT * FROM users WHERE id = %s", (fid,))
        f = await cursor.fetchone()
        if f:
            f.pop("password", None)
            father = f
    if mid is not None:
        await cursor.execute("SELECT * FROM users WHERE id = %s", (mid,))
        m = await cursor.fetchone()
        if m:
            m.pop("password", None)
            mother = m

    return {"father": father, "mother": mother}
