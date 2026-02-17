from fastapi import APIRouter, Depends, HTTPException, status, Request
import logging
from sqlalchemy.orm import Session
from sqlalchemy import func

from models_orm.dependencies import get_db, get_current_user, get_user_roles
from models import Role as RoleSchema, RoleAttributionCreate, RoleAttributionBulkCreate
from models_orm.access_control import Roles, RoleAttribution
from models_orm.users import Users, FamilyAssignation

router = APIRouter()
logger = logging.getLogger("roles")


@router.get("/roles")
async def list_roles(
    db: Session = Depends(get_db), current_user: Users = Depends(get_current_user)
):
    roles = db.query(Roles).order_by(Roles.id).all()
    return [{"id": r.id, "role": r.role} for r in roles]


@router.get("/roles/{role_id}")
async def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    role = db.query(Roles).filter(Roles.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    return {"id": role.id, "role": role.role}


@router.post("/roles")
async def create_role(
    body: RoleSchema,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_roles = await get_user_roles(db, current_user.id)
    if "admin" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can create roles"
        )

    new_id = body.id
    if new_id is None:
        next_id = db.query(func.coalesce(func.max(Roles.id), 0)).scalar() or 0
        new_id = int(next_id) + 1

    role = Roles(id=new_id, role=body.role)
    db.add(role)
    try:
        db.commit()
        db.refresh(role)
    except Exception:
        logger.exception("[roles] Commit failed during create_role")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"id": role.id, "role": role.role}


@router.patch("/roles/{role_id}")
async def update_role(
    role_id: int,
    body: RoleSchema,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_roles = await get_user_roles(db, current_user.id)
    if "admin" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can update roles"
        )

    role = db.query(Roles).filter(Roles.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    role.role = body.role
    try:
        db.commit()
        db.refresh(role)
    except Exception:
        logger.exception("[roles] Commit failed during update_role")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"id": role.id, "role": role.role}


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_roles = await get_user_roles(db, current_user.id)
    if "admin" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can delete roles"
        )

    db.query(RoleAttribution).filter(RoleAttribution.roles_id == role_id).delete()
    db.query(Roles).filter(Roles.id == role_id).delete()
    try:
        db.commit()
    except Exception:
        logger.exception("[roles] Commit failed during delete_role")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"status": "deleted", "id": role_id}


@router.get("/role-attributions")
async def list_role_attributions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    # Optional filter: status (active/inactive/all) — defaults to active
    qp = request.query_params
    status = (qp.get("status") or "active").lower()
    where = ""
    vals: list = []
    if status in {"active", "inactive"}:
        where = "WHERE u.isactive = %s"
        vals.append(1 if status == "active" else 0)
    q = (
        db.query(
            RoleAttribution.id,
            RoleAttribution.users_id,
            RoleAttribution.roles_id,
            Users.username,
            Users.firstname,
            Users.lastname,
            Roles.role,
            Users.isactive,
        )
        .join(Users, Users.id == RoleAttribution.users_id)
        .join(Roles, Roles.id == RoleAttribution.roles_id)
        .order_by(RoleAttribution.id)
    )
    if status in {"active", "inactive"}:
        q = q.filter(Users.isactive == (1 if status == "active" else 0))
    rows = q.all()
    return [
        {
            "id": rid,
            "users_id": uid,
            "roles_id": roid,
            "username": uname,
            "firstname": fname,
            "lastname": lname,
            "role": rname,
        }
        for (rid, uid, roid, uname, fname, lname, rname, _isactive) in rows
    ]


@router.get("/users/{user_id}/roles")
async def list_roles_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    # Fetch role attributions and resolve role names robustly
    ras = db.query(RoleAttribution).filter(RoleAttribution.users_id == user_id).all()
    result = []
    for ra in ras:
        role_obj = db.query(Roles).filter(Roles.id == ra.roles_id).first()
        if role_obj:
            result.append({"id": role_obj.id, "role": role_obj.role})
    return result


@router.post("/role-attributions")
async def assign_role(
    body: RoleAttributionCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in user_roles
    is_group_admin = "admingroup" in user_roles

    target = db.query(Users).filter(Users.id == body.users_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    role_obj = db.query(Roles).filter(Roles.id == body.roles_id).first()
    if not role_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )

    role_name = (role_obj.role or "").lower()
    if not is_admin:
        if is_group_admin:
            if role_name not in {"admingroup", "user", "member", "norole"}:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Role not allowed for group admin",
                )
            allowed = (int(body.users_id) == int(current_user.id)) or (
                db.query(FamilyAssignation)
                .filter(
                    FamilyAssignation.users_responsable_id == current_user.id,
                    FamilyAssignation.users_assigned_id == body.users_id,
                )
                .first()
                is not None
            )
            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Target user not in your group",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    exists = (
        db.query(RoleAttribution)
        .filter(
            RoleAttribution.users_id == body.users_id,
            RoleAttribution.roles_id == body.roles_id,
        )
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Role already assigned to user"
        )

    ra = RoleAttribution(users_id=body.users_id, roles_id=body.roles_id)
    db.add(ra)
    try:
        db.commit()
        db.refresh(ra)
    except Exception:
        logger.exception("[roles] Commit failed during assign_role")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"id": ra.id, "users_id": ra.users_id, "roles_id": ra.roles_id}


@router.post("/role-attributions/bulk")
async def assign_role_bulk(
    body: RoleAttributionBulkCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in user_roles
    is_group_admin = "admingroup" in user_roles

    if not body.users_ids:
        return {"count": 0}

    role_obj = db.query(Roles).filter(Roles.id == body.roles_id).first()
    if not role_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    role_name = (role_obj.role or "").lower()

    if not is_admin:
        if is_group_admin:
            if role_name not in {"admingroup", "user", "member", "norole"}:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Role not allowed for group admin",
                )
            # Verify all users are in group
            for uid in body.users_ids:
                if uid != current_user.id:
                    if (
                        db.query(FamilyAssignation)
                        .filter(
                            FamilyAssignation.users_responsable_id == current_user.id,
                            FamilyAssignation.users_assigned_id == uid,
                        )
                        .first()
                        is None
                    ):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"User {uid} not in your group",
                        )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    existing = (
        db.query(RoleAttribution.users_id)
        .filter(
            RoleAttribution.roles_id == body.roles_id,
            RoleAttribution.users_id.in_(body.users_ids),
        )
        .all()
    )
    existing_ids = {uid for (uid,) in existing}
    to_insert = [uid for uid in body.users_ids if uid not in existing_ids]

    if not to_insert:
        return {"count": 0}

    try:
        for uid in to_insert:
            db.add(RoleAttribution(users_id=uid, roles_id=body.roles_id))
        db.commit()
    except Exception:
        logger.exception("[roles] Commit failed during assign_role_bulk")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"count": len(to_insert)}


@router.post("/role-attributions/bulk-delete")
async def remove_role_bulk(
    body: RoleAttributionBulkCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in user_roles
    is_group_admin = "admingroup" in user_roles

    if not body.users_ids:
        return {"count": 0}

    role_obj = db.query(Roles).filter(Roles.id == body.roles_id).first()
    if not role_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    role_name = (role_obj.role or "").lower()

    if not is_admin:
        if is_group_admin:
            if role_name not in {"admingroup", "user"}:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Role modification forbidden for group admin",
                )
            for uid in body.users_ids:
                if uid != current_user.id:
                    if (
                        db.query(FamilyAssignation)
                        .filter(
                            FamilyAssignation.users_responsable_id == current_user.id,
                            FamilyAssignation.users_assigned_id == uid,
                        )
                        .first()
                        is None
                    ):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"User {uid} not in your group",
                        )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    try:
        deleted = (
            db.query(RoleAttribution)
            .filter(
                RoleAttribution.roles_id == body.roles_id,
                RoleAttribution.users_id.in_(body.users_ids),
            )
            .delete(synchronize_session=False)
        )
        db.commit()
    except Exception:
        logger.exception("[roles] Commit failed during remove_role_bulk")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"count": deleted}


@router.delete("/role-attributions/{attrib_id}")
async def remove_role_attribution(
    attrib_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_roles = await get_user_roles(db, current_user.id)
    if "admin" not in user_roles:
        row = (
            db.query(
                RoleAttribution.id,
                RoleAttribution.users_id,
                RoleAttribution.roles_id,
                Roles.role,
            )
            .join(Roles, Roles.id == RoleAttribution.roles_id)
            .filter(RoleAttribution.id == attrib_id)
            .first()
        )
        if not row:
            return {"status": "deleted", "id": attrib_id}
        role_name = (row[3] or "").lower()
        if role_name not in {"admingroup", "user"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
        # Ensure current user manages this user or self
        managed = (
            db.query(FamilyAssignation)
            .filter(
                FamilyAssignation.users_responsable_id == current_user.id,
                FamilyAssignation.users_assigned_id == row[1],
            )
            .first()
            is not None
        )
        if not managed and int(row[1]) != int(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
    deleted = db.query(RoleAttribution).filter(RoleAttribution.id == attrib_id).delete()
    try:
        db.commit()
    except Exception:
        logger.exception("[roles] Commit failed during remove_role_attribution")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"status": "deleted", "id": attrib_id}


@router.delete("/users/{user_id}/roles/{role_id}")
async def remove_role_from_user(
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_roles = await get_user_roles(db, current_user.id)
    # Allow full access to admins and group-admins
    if ("admin" not in user_roles) and ("admingroup" not in user_roles):
        r = db.query(Roles).filter(Roles.id == role_id).first()
        if not r:
            return {"status": "deleted", "user_id": user_id, "role_id": role_id}
        role_name = (r.role or "").lower()
        if role_name not in {"admingroup", "user", "member"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

        allowed = (user_id == int(current_user.id)) or (
            db.query(FamilyAssignation)
            .filter(
                FamilyAssignation.users_responsable_id == current_user.id,
                FamilyAssignation.users_assigned_id == user_id,
            )
            .first()
            is not None
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
    db.query(RoleAttribution).filter(
        RoleAttribution.users_id == user_id, RoleAttribution.roles_id == role_id
    ).delete()
    try:
        db.commit()
    except Exception:
        logger.exception("[roles] Commit failed during remove_role_from_user")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"status": "deleted", "user_id": user_id, "role_id": role_id}
