from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import logging

from sqlalchemy.orm import Session
from models_orm.dependencies import get_db, get_current_user, get_user_roles
from models import FamilyAssignationBulkCreate
from models_orm.users import Users, FamilyAssignation

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/family-assignations/bulk")
async def assign_family_bulk(
    body: FamilyAssignationBulkCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    if not body.users_ids:
        return {"count": 0}

    # Verify responsable exists
    responsable = db.query(Users).filter(Users.id == body.responsable_id).first()
    if not responsable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Responsable not found"
        )

    # Permission check: allow admins and group admins (no kinship checks)
    roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in roles
    is_group_admin = "admingroup" in roles
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Filter existing assignments to avoid duplicates
    existing = (
        db.query(FamilyAssignation.users_assigned_id)
        .filter(FamilyAssignation.users_responsable_id == body.responsable_id)
        .filter(FamilyAssignation.users_assigned_id.in_(body.users_ids))
        .all()
    )
    existing_ids = {row[0] for row in existing}
    to_insert = [uid for uid in body.users_ids if uid not in existing_ids]
    if not to_insert:
        return {"count": 0}

    try:
        for uid in to_insert:
            db.add(
                FamilyAssignation(
                    users_assigned_id=int(uid),
                    users_responsable_id=body.responsable_id,
                )
            )
        db.commit()
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
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    if not body.users_ids:
        return {"count": 0}

    # Verify responsable exists
    responsable = db.query(Users).filter(Users.id == body.responsable_id).first()
    if not responsable:
        return {"count": 0}

    # Permission check: allow admins and group admins (no kinship checks)
    roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in roles
    is_group_admin = "admingroup" in roles
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Delete assignments
    try:
        (
            db.query(FamilyAssignation)
            .filter(FamilyAssignation.users_responsable_id == body.responsable_id)
            .filter(FamilyAssignation.users_assigned_id.in_(body.users_ids))
            .delete(synchronize_session=False)
        )
        db.commit()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"status": "deleted"}


@router.get("/family-assignations")
async def list_family_assignations(db: Session = Depends(get_db)):
    """
    Return all family assignation rows so frontend can map assigned users to their responsables.
    Response: [{ users_assigned_id: int, users_responsable_id: int }, ...]
    """
    rows = db.query(FamilyAssignation).all()
    return [
        {
            "users_assigned_id": int(r.users_assigned_id),
            "users_responsable_id": int(r.users_responsable_id),
        }
        for r in rows
    ]


@router.get("/family-assignations/responsable/{responsable_id}/members")
async def list_members_by_responsable(
    responsable_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """
    Return basic user info for all members assigned to the given responsable.
    Authorization: admin or admingroup.
    """
    roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in roles
    is_group_admin = "admingroup" in roles
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Validate responsable exists
    if not db.query(Users).filter(Users.id == responsable_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Responsable not found"
        )

    users = (
        db.query(Users)
        .join(FamilyAssignation, FamilyAssignation.users_assigned_id == Users.id)
        .filter(FamilyAssignation.users_responsable_id == responsable_id)
        .order_by(Users.firstname, Users.lastname)
        .all()
    )
    return [
        {
            "id": u.id,
            "firstname": u.firstname,
            "lastname": u.lastname,
            "username": u.username,
            "email": u.email,
            "image_url": getattr(u, "image_url", None),
        }
        for u in users
    ]


@router.post("/family-assignations/copy")
async def copy_family_assignations(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
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
    roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in roles
    is_group_admin = "admingroup" in roles
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # verify responsables exist
    if not db.query(Users).filter(Users.id == from_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source responsable not found"
        )
    if not db.query(Users).filter(Users.id == to_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Target responsable not found"
        )

    async def get_assigned_ids(responsable_id: int) -> List[int]:
        rows = (
            db.query(FamilyAssignation.users_assigned_id)
            .filter(FamilyAssignation.users_responsable_id == responsable_id)
            .all()
        )
        return list(dict.fromkeys(int(r[0]) for r in rows))

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
    try:
        for uid in to_insert:
            db.add(FamilyAssignation(users_assigned_id=int(uid), users_responsable_id=to_id))
        db.commit()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    return {
        "count": len(to_insert),
        "assigned_count": len(assigned_source),
        "inserted": len(to_insert),
    }


@router.post("/family-assignations/transfer")
async def transfer_family_assignations(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
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
    roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in roles
    is_group_admin = "admingroup" in roles
    if not (is_admin or is_group_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # verify responsables exist
    if not db.query(Users).filter(Users.id == from_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Source responsable not found"
        )
    if not db.query(Users).filter(Users.id == to_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Target responsable not found"
        )

    # get all assigned to from_id
    rows = (
        db.query(FamilyAssignation.users_assigned_id)
        .filter(FamilyAssignation.users_responsable_id == from_id)
        .all()
    )
    assigned = [int(r[0]) for r in rows]
    if not assigned:
        return {"count": 0}

    # insert those not already present for to_id
    existing_rows = (
        db.query(FamilyAssignation.users_assigned_id)
        .filter(FamilyAssignation.users_responsable_id == to_id)
        .filter(FamilyAssignation.users_assigned_id.in_(assigned))
        .all()
    )
    existing_ids = {int(r[0]) for r in existing_rows}
    to_insert = [uid for uid in assigned if uid not in existing_ids]

    try:
        if to_insert:
            for uid in to_insert:
                db.add(FamilyAssignation(users_assigned_id=int(uid), users_responsable_id=to_id))

        # delete all assignments from source for these users
        (
            db.query(FamilyAssignation)
            .filter(FamilyAssignation.users_responsable_id == from_id)
            .filter(FamilyAssignation.users_assigned_id.in_(assigned))
            .delete(synchronize_session=False)
        )
        db.commit()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    # Return how many were transferred (those originally assigned to from_id)
    return {"count": len(assigned)}
