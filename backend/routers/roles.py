from fastapi import APIRouter, Depends, HTTPException, status, Request
import logging
import mysql.connector

from dependencies import get_cursor, get_current_user, has_role
from models import Role, RoleAttributionCreate, RoleAttributionBulkCreate

router = APIRouter()
logger = logging.getLogger("roles")


@router.get("/roles")
async def list_roles(
    cursor=Depends(get_cursor), current_user: dict = Depends(get_current_user)
):
    await cursor.execute("SELECT * FROM roles ORDER BY id")
    return await cursor.fetchall()


@router.get("/roles/{role_id}")
async def get_role(
    role_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    await cursor.execute("SELECT * FROM roles WHERE id = %s", (role_id,))
    role = await cursor.fetchone()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    return role


@router.post("/roles")
async def create_role(
    body: Role,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    if not await has_role(cursor, current_user["id"], "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can create roles"
        )
    if body.id is None:
        await cursor.execute("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM roles")
        next_id = (await cursor.fetchone())["next_id"]
        body.id = int(next_id)
    await cursor.execute(
        "INSERT INTO roles (id, role) VALUES (%s, %s)", (body.id, body.role)
    )
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[roles] Commit failed during create_role")
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    await cursor.execute("SELECT * FROM roles WHERE id = %s", (body.id,))
    return await cursor.fetchone()


@router.patch("/roles/{role_id}")
async def update_role(
    role_id: int,
    body: Role,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    if not await has_role(cursor, current_user["id"], "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can update roles"
        )
    await cursor.execute(
        "UPDATE roles SET role = %s WHERE id = %s", (body.role, role_id)
    )
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[roles] Commit failed during update_role")
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    await cursor.execute("SELECT * FROM roles WHERE id = %s", (role_id,))
    role = await cursor.fetchone()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    return role


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    if not await has_role(cursor, current_user["id"], "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can delete roles"
        )
    await cursor.execute("DELETE FROM role_attribution WHERE roles_id = %s", (role_id,))
    await cursor.execute("DELETE FROM roles WHERE id = %s", (role_id,))
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[roles] Commit failed during delete_role")
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"status": "deleted", "id": role_id}


@router.get("/role-attributions")
async def list_role_attributions(
    request: Request,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    # Optional filter: status (active/inactive/all) — defaults to active
    qp = request.query_params
    status = (qp.get("status") or "active").lower()
    where = ""
    vals: list = []
    if status in {"active", "inactive"}:
        where = "WHERE u.isactive = %s"
        vals.append(1 if status == "active" else 0)
    await cursor.execute(
        f"""
        SELECT ra.id, ra.users_id, ra.roles_id,
            u.username, u.firstname, u.lastname, u.image_url,
            r.role
        FROM role_attribution ra
        JOIN users u ON u.id = ra.users_id
        JOIN roles r ON r.id = ra.roles_id
        {where}
        ORDER BY ra.id
        """,
        tuple(vals),
    )
    return await cursor.fetchall()


@router.get("/users/{user_id}/roles")
async def list_roles_for_user(
    user_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    await cursor.execute(
        """
        SELECT r.id, r.role
        FROM role_attribution ra
        JOIN roles r ON r.id = ra.roles_id
        WHERE ra.users_id = %s
        ORDER BY r.id
        """,
        (user_id,),
    )
    return await cursor.fetchall()


@router.post("/role-attributions")
async def assign_role(
    body: RoleAttributionCreate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")
    await cursor.execute("SELECT id FROM users WHERE id = %s", (body.users_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    await cursor.execute("SELECT id, role FROM roles WHERE id = %s", (body.roles_id,))
    role_row = await cursor.fetchone()
    if not role_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    role_name = str(role_row.get("role")).lower()

    if not is_admin:
        if is_group_admin:
            # Group admin can only assign specific roles within their group
            if role_name not in {"admingroup", "user", "member", "norole"}:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Role not allowed for group admin",
                )
            # Check target user is in same group
            await cursor.execute(
                "SELECT id, id_father, id_mother FROM users WHERE id = %s",
                (body.users_id,),
            )
            target = await cursor.fetchone()
            fid = current_user.get("id_father")
            mid = current_user.get("id_mother")
            same_group = False
            if target:
                if fid is not None and (
                    target.get("id_father") == fid or target.get("id") == fid
                ):
                    same_group = True
                if mid is not None and (
                    target.get("id_mother") == mid or target.get("id") == mid
                ):
                    same_group = True
            if not same_group and (target or {}).get("id") != current_user.get("id"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Target user not in your group",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    await cursor.execute(
        "SELECT id FROM role_attribution WHERE users_id = %s AND roles_id = %s",
        (body.users_id, body.roles_id),
    )
    if await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Role already assigned to user"
        )

    try:
        await cursor.execute(
            "INSERT INTO role_attribution (users_id, roles_id) VALUES (%s, %s)",
            (body.users_id, body.roles_id),
        )
        await cursor.commit()
    except mysql.connector.Error as e:
        # Handle duplicate key error from DB-level unique constraint
        if getattr(e, "errno", None) == 1062:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Role already assigned to user",
            )
        logger.exception("[roles] DB error during assign_role")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error"
        )
    except Exception:
        logger.exception("[roles] Commit failed during assign_role")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    new_id = cursor.lastrowid
    await cursor.execute("SELECT * FROM role_attribution WHERE id = %s", (new_id,))
    return await cursor.fetchone()


@router.post("/role-attributions/bulk")
async def assign_role_bulk(
    body: RoleAttributionBulkCreate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")

    if not body.users_ids:
        return {"count": 0}

    # Verify role
    await cursor.execute("SELECT id, role FROM roles WHERE id = %s", (body.roles_id,))
    role_row = await cursor.fetchone()
    if not role_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    role_name = str(role_row.get("role")).lower()

    # Permission check logic
    if not is_admin:
        if is_group_admin:
            if role_name not in {"admingroup", "user", "member", "norole"}:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Role not allowed for group admin",
                )

            # Verify all users are in group
            format_strings = ",".join(["%s"] * len(body.users_ids))
            await cursor.execute(
                f"SELECT id, id_father, id_mother FROM users WHERE id IN ({format_strings})",
                tuple(body.users_ids),
            )
            targets = await cursor.fetchall()

            fid = current_user.get("id_father")
            mid = current_user.get("id_mother")

            for target in targets:
                same_group = False
                if fid is not None and (
                    target.get("id_father") == fid or target.get("id") == fid
                ):
                    same_group = True
                if mid is not None and (
                    target.get("id_mother") == mid or target.get("id") == mid
                ):
                    same_group = True
                if not same_group and target.get("id") != current_user.get("id"):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"User {target.get('id')} not in your group",
                    )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    # Filter existing
    format_strings = ",".join(["%s"] * len(body.users_ids))
    query = f"SELECT users_id FROM role_attribution WHERE roles_id = %s AND users_id IN ({format_strings})"
    params = [body.roles_id] + body.users_ids
    await cursor.execute(query, tuple(params))
    existing = await cursor.fetchall()
    existing_ids = {row["users_id"] for row in existing}

    to_insert = [uid for uid in body.users_ids if uid not in existing_ids]

    if not to_insert:
        return {"count": 0}

    # Bulk Insert
    insert_query = "INSERT INTO role_attribution (users_id, roles_id) VALUES (%s, %s)"
    insert_data = [(uid, body.roles_id) for uid in to_insert]

    try:
        await cursor.executemany(insert_query, insert_data)
        await cursor.commit()
    except Exception:
        logger.exception("[roles] Commit failed during assign_role_bulk")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    return {"count": len(to_insert)}


@router.post("/role-attributions/bulk-delete")
async def remove_role_bulk(
    body: RoleAttributionBulkCreate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")

    if not body.users_ids:
        return {"count": 0}

    # Verify role
    await cursor.execute("SELECT id, role FROM roles WHERE id = %s", (body.roles_id,))
    role_row = await cursor.fetchone()
    if not role_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    role_name = str(role_row.get("role")).lower()

    # Permission check logic: same as adding roles
    if not is_admin:
        if is_group_admin:
            if role_name not in {"admingroup", "user"}:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Role modification forbidden for group admin",
                )

            # Verify all users are in group
            format_strings = ",".join(["%s"] * len(body.users_ids))
            await cursor.execute(
                f"SELECT id, id_father, id_mother FROM users WHERE id IN ({format_strings})",
                tuple(body.users_ids),
            )
            targets = await cursor.fetchall()

            fid = current_user.get("id_father")
            mid = current_user.get("id_mother")

            for target in targets:
                same_group = False
                if fid is not None and (
                    target.get("id_father") == fid or target.get("id") == fid
                ):
                    same_group = True
                if mid is not None and (
                    target.get("id_mother") == mid or target.get("id") == mid
                ):
                    same_group = True
                if not same_group and target.get("id") != current_user.get("id"):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"User {target.get('id')} not in your group",
                    )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    # Bulk Delete
    format_strings = ",".join(["%s"] * len(body.users_ids))
    delete_query = f"DELETE FROM role_attribution WHERE roles_id = %s AND users_id IN ({format_strings})"
    params = [body.roles_id] + body.users_ids

    try:
        await cursor.execute(delete_query, tuple(params))
        await cursor.commit()
    except Exception:
        logger.exception("[roles] Commit failed during remove_role_bulk")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    return {"count": cursor.rowcount}


@router.delete("/role-attributions/{attrib_id}")
async def remove_role_attribution(
    attrib_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    # If not admin, ensure attribution is for allowed roles and within group
    if not await has_role(cursor, current_user["id"], "admin"):
        # Fetch attribution details
        await cursor.execute(
            """
            SELECT ra.id, ra.users_id, ra.roles_id, r.role, u.id_father, u.id_mother, u.id
            FROM role_attribution ra
            JOIN roles r ON r.id = ra.roles_id
            JOIN users u ON u.id = ra.users_id
            WHERE ra.id = %s
            """,
            (attrib_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return {"status": "deleted", "id": attrib_id}
        role_name = str(row.get("role")).lower()
        if role_name not in {"admingroup", "user"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
        fid = current_user.get("id_father")
        mid = current_user.get("id_mother")
        same_group = False
        if fid is not None and (row.get("id_father") == fid or row.get("id") == fid):
            same_group = True
        if mid is not None and (row.get("id_mother") == mid or row.get("id") == mid):
            same_group = True
        if not same_group and row.get("id") != current_user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
    await cursor.execute("DELETE FROM role_attribution WHERE id = %s", (attrib_id,))
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[roles] Commit failed during remove_role_attribution")
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"status": "deleted", "id": attrib_id}


@router.delete("/users/{user_id}/roles/{role_id}")
async def remove_role_from_user(
    user_id: int,
    role_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    if not await has_role(cursor, current_user["id"], "admin"):
        await cursor.execute("SELECT role FROM roles WHERE id = %s", (role_id,))
        r = await cursor.fetchone()
        if not r:
            return {"status": "deleted", "user_id": user_id, "role_id": role_id}
        role_name = str(r.get("role")).lower()
        if role_name not in {"admingroup", "user"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
        await cursor.execute(
            "SELECT id, id_father, id_mother FROM users WHERE id = %s", (user_id,)
        )
        u = await cursor.fetchone()
        if not u:
            return {"status": "deleted", "user_id": user_id, "role_id": role_id}
        fid = current_user.get("id_father")
        mid = current_user.get("id_mother")
        same_group = False
        if fid is not None and (u.get("id_father") == fid or u.get("id") == fid):
            same_group = True
        if mid is not None and (u.get("id_mother") == mid or u.get("id") == mid):
            same_group = True
        if not same_group and u.get("id") != current_user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
    await cursor.execute(
        "DELETE FROM role_attribution WHERE users_id = %s AND roles_id = %s",
        (user_id, role_id),
    )
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[roles] Commit failed during remove_role_from_user")
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"status": "deleted", "user_id": user_id, "role_id": role_id}
