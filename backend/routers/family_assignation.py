from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import logging

from dependencies import get_cursor, get_current_user, has_role
from models import FamilyAssignationBulkCreate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/family-assignations/bulk")
async def assign_family_bulk(
    body: FamilyAssignationBulkCreate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    if not body.users_ids:
        return {"count": 0}

    # Verify responsable exists
    await cursor.execute("SELECT id FROM users WHERE id = %s", (body.responsable_id,))
    responsable = await cursor.fetchone()
    if not responsable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Responsable not found"
        )

    # Permission check: allow admins and group admins (no kinship checks)
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Filter existing assignments to avoid duplicates
    format_strings = ",".join(["%s"] * len(body.users_ids))
    await cursor.execute(
        f"SELECT users_assigned_id FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id IN ({format_strings})",
        tuple([body.responsable_id] + body.users_ids),
    )
    existing = await cursor.fetchall() or []
    existing_ids = {row["users_assigned_id"] for row in existing}
    to_insert = [uid for uid in body.users_ids if uid not in existing_ids]
    if not to_insert:
        return {"count": 0}

    # Compute next ids since table id is not AUTO_INCREMENT in schema
    await cursor.execute(
        "SELECT COALESCE(MAX(id), 0) AS max_id FROM family_assignation"
    )
    row_max = await cursor.fetchone() or {"max_id": 0}
    next_id = int(row_max.get("max_id") or 0) + 1

    insert_sql = "INSERT INTO family_assignation (id, users_assigned_id, users_responsable_id) VALUES (%s, %s, %s)"
    data = []
    for uid in to_insert:
        data.append((next_id, uid, body.responsable_id))
        next_id += 1

    try:
        await cursor.executemany(insert_sql, data)
        await cursor.commit()
    except Exception:
        # Likely constraint issues
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    return {"count": len(to_insert)}


@router.post("/family-assignations/bulk-delete")
async def remove_family_bulk(
    body: FamilyAssignationBulkCreate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    if not body.users_ids:
        return {"count": 0}

    # Verify responsable exists
    await cursor.execute("SELECT id FROM users WHERE id = %s", (body.responsable_id,))
    responsable = await cursor.fetchone()
    if not responsable:
        return {"count": 0}

    # Permission check: allow admins and group admins (no kinship checks)
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Delete assignments
    format_strings = ",".join(["%s"] * len(body.users_ids))
    delete_sql = f"DELETE FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id IN ({format_strings})"
    params = [body.responsable_id] + body.users_ids
    try:
        await cursor.execute(delete_sql, tuple(params))
        await cursor.commit()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"count": cursor.rowcount}


@router.get("/family-assignations")
async def list_family_assignations(cursor=Depends(get_cursor)):
    """
    Return all family assignation rows so frontend can map assigned users to their responsables.
    Response: [{ users_assigned_id: int, users_responsable_id: int }, ...]
    """
    await cursor.execute(
        "SELECT users_assigned_id, users_responsable_id FROM family_assignation"
    )
    rows = await cursor.fetchall() or []
    out = []
    for r in rows:
        if isinstance(r, dict):
            a = r.get("users_assigned_id")
            b = r.get("users_responsable_id")
        else:
            # tuple/list fallback
            try:
                a = r[0]
                b = r[1]
            except Exception:
                continue
        try:
            a = int(a)
            b = int(b)
        except Exception:
            continue
        out.append({"users_assigned_id": a, "users_responsable_id": b})
    return out


@router.get("/family-assignations/responsable/{responsable_id}/members")
async def list_members_by_responsable(
    responsable_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """
    Return basic user info for all members assigned to the given responsable.
    Authorization: admin or admingroup.
    """
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Validate responsable exists
    await cursor.execute("SELECT id FROM users WHERE id = %s", (responsable_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Responsable not found"
        )

    sql = """
        SELECT u.id, u.firstname, u.lastname, u.username, u.email, u.image_url
        FROM users u
        INNER JOIN family_assignation fa ON fa.users_assigned_id = u.id
        WHERE fa.users_responsable_id = %s
        ORDER BY u.firstname, u.lastname
    """
    await cursor.execute(sql, (responsable_id,))
    rows = await cursor.fetchall() or []
    return rows


@router.post("/family-assignations/copy")
async def copy_family_assignations(
    body: dict,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """
    Copy all assigned members from one responsable to another (creates assignments on target for those not already assigned).
    Body: { from_responsable_id: int, to_responsable_id: int }
    """

    from_id = body.get("from_responsable_id")
    to_id = body.get("to_responsable_id")
    if not from_id or not to_id or from_id == to_id:
        return {"count": 0}

    # permission: admin or admingroup
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # verify responsables exist
    await cursor.execute("SELECT id FROM users WHERE id = %s", (from_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source responsable not found"
        )
    await cursor.execute("SELECT id FROM users WHERE id = %s", (to_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Target responsable not found"
        )

    async def get_assigned_ids(responsable_id: int) -> List[int]:
        await cursor.execute(
            "SELECT users_assigned_id FROM family_assignation WHERE users_responsable_id = %s",
            (responsable_id,),
        )
        rows = await cursor.fetchall() or []
        assigned = []
        for r in rows:
            val = r.get("users_assigned_id") if isinstance(r, dict) else r[0]
            try:
                vid = int(val)
            except Exception:
                continue
            assigned.append(vid)
        assigned = list(dict.fromkeys(assigned))
        return assigned

    assigned_source = await get_assigned_ids(from_id)
    assigned_target = await get_assigned_ids(to_id)

    logger.info(f"{from_id} target assigned IDs before copy: {assigned_target}")
    logger.info(f"{to_id} source assigned IDs to copy: {assigned_source}")

    # filter assigned_source to those not already in assigned_target
    to_insert = [uid for uid in assigned_source if uid not in assigned_target]
    logger.info(
        f"[family-assignations/copy] Assigned source count: {len(assigned_source)}, target count: {len(assigned_target)}, to insert: {len(to_insert)}"
    )
    logger.info(f"[family-assignations/copy] To insert IDs: {to_insert}")
    if not to_insert:
        return {
            "count": 0,
            "assigned_count": len(assigned_source),
            "already_assigned": len(assigned_target),
        }

    logger.info(
        f"[family-assignations/copy] Copying {len(to_insert)} assignments from responsable {from_id} to {to_id}"
    )
    # insert missing assignments
    insert_sql = "INSERT INTO family_assignation (users_assigned_id, users_responsable_id) VALUES (%s, %s)"
    data = [(uid, to_id) for uid in to_insert]

    try:
        await cursor.executemany(insert_sql, data)
        await cursor.commit()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    return {
        "count": len(to_insert),
        "assigned_count": len(assigned_source),
        "inserted": len(data),
    }


@router.post("/family-assignations/transfer")
async def transfer_family_assignations(
    body: dict,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """
    Transfer all members from one responsable to another (copy then delete from source).
    Body: { from_responsable_id: int, to_responsable_id: int }
    """
    from_id = body.get("from_responsable_id")
    to_id = body.get("to_responsable_id")
    if not from_id or not to_id or from_id == to_id:
        return {"count": 0}

    # permission: admin or admingroup
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # verify responsables exist
    await cursor.execute("SELECT id FROM users WHERE id = %s", (from_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source responsable not found"
        )
    await cursor.execute("SELECT id FROM users WHERE id = %s", (to_id,))
    if not await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Target responsable not found"
        )

    # get all assigned to from_id
    await cursor.execute(
        "SELECT users_assigned_id FROM family_assignation WHERE users_responsable_id = %s",
        (from_id,),
    )
    rows = await cursor.fetchall() or []
    assigned = []
    for r in rows:
        if isinstance(r, dict):
            assigned.append(r.get("users_assigned_id"))
        else:
            assigned.append(r[0])
    if not assigned:
        return {"count": 0}

    # insert those not already present for to_id
    format_strings = ",".join(["%s"] * len(assigned))
    await cursor.execute(
        f"SELECT users_assigned_id FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id IN ({format_strings})",
        tuple([to_id] + assigned),
    )
    existing = await cursor.fetchall() or []
    existing_ids = set()
    for r in existing:
        if isinstance(r, dict):
            existing_ids.add(r.get("users_assigned_id"))
        else:
            existing_ids.add(r[0])
    to_insert = [uid for uid in assigned if uid not in existing_ids]

    try:
        if to_insert:
            await cursor.execute(
                "SELECT COALESCE(MAX(id), 0) AS max_id FROM family_assignation"
            )
            row_max = await cursor.fetchone() or {"max_id": 0}
            next_id = int(row_max.get("max_id") or 0) + 1
            insert_sql = "INSERT INTO family_assignation (id, users_assigned_id, users_responsable_id) VALUES (%s, %s, %s)"
            data = []
            for uid in to_insert:
                data.append((next_id, uid, to_id))
                next_id += 1
            await cursor.executemany(insert_sql, data)

        # delete all assignments from source for these users (or delete all for from_id)
        delete_sql = f"DELETE FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id IN ({format_strings})"
        params = [from_id] + assigned
        await cursor.execute(delete_sql, tuple(params))
        await cursor.commit()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    # Return how many were transferred (those originally assigned to from_id)
    return {"count": len(assigned)}
