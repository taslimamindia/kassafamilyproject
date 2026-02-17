from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional
import logging
import re
from datetime import datetime
import asyncio

from sqlalchemy.orm import Session, aliased
from sqlalchemy import text, func, or_, cast, String
from routers.messages import send_notification
from models_orm.dependencies import get_db, get_current_user, get_user_roles
from models import (
    UserCreate,
    UserAdminUpdate,
    UserUpdate,
    UserBulkTierUpdate,
    UserSchema,
)
from models_orm.users import Users, FamilyAssignation
from models_orm.access_control import Roles, RoleAttribution
from models_orm.messaging import Messages, MessageRecipients
from utils import (
    parse_create_request,
    parse_update_request,
)
from auth_utils import hash_password
from settings import settings
from aws_file import AwsFile


router = APIRouter()
logger = logging.getLogger("users")


def _user_to_dict(u: Users) -> dict:
    return {
        "id": getattr(u, "id", None),
        "firstname": getattr(u, "firstname", None),
        "lastname": getattr(u, "lastname", None),
        "username": getattr(u, "username", None),
        "email": getattr(u, "email", None),
        "telephone": getattr(u, "telephone", None),
        "password": getattr(u, "password", None),
        "birthday": getattr(u, "birthday", None),
        "image_url": getattr(u, "image_url", None),
        "gender": getattr(u, "gender", None),
        "contribution_tier": getattr(u, "contribution_tier", None),
        "id_father": getattr(u, "id_father", None),
        "id_mother": getattr(u, "id_mother", None),
        "isactive": getattr(u, "isactive", None),
        "isfirstlogin": getattr(u, "isfirstlogin", None),
        "createdby": getattr(u, "createdby", None),
        "updatedby": getattr(u, "updatedby", None),
        "createdat": getattr(u, "createdat", None),
        "updatedat": getattr(u, "updatedat", None),
    }


@router.get("/users/receivers", response_model=List[dict])
async def get_receivers(
    db: Session = Depends(get_db), current_user: Users = Depends(get_current_user)
):
    """
    Get list of users eligible to receive messages from the current user (member to member).
    Logic: isactive=1, role='member', exclude current user.
    """
    q = (
        db.query(Users.id, Users.firstname, Users.lastname, Users.username, Users.image_url)
        .join(RoleAttribution, RoleAttribution.users_id == Users.id)
        .join(Roles, Roles.id == RoleAttribution.roles_id)
        .filter(Users.isactive == 1)
        .filter(Roles.role == "member")
        .filter(Users.id != int(current_user.id))
        .order_by(Users.firstname, Users.lastname)
        .distinct()
    )
    rows = q.all()
    return [
        {
            "id": r[0],
            "firstname": r[1],
            "lastname": r[2],
            "username": r[3],
            "image_url": r[4],
        }
        for r in rows
    ]


@router.get("/users/{user_id}")
async def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_obj = db.query(Users).filter(Users.id == user_id).first()
    if not user_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    # Authorization: admin and treasury can view any; admingroup can view only assigned members via family_assignation (or self); others forbidden
    roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in roles
    is_treasury = "treasury" in roles
    if not (is_admin or is_treasury):
        if "admingroup" in roles:
            if int(user_obj.id) != int(current_user.id):
                exists = (
                    db.query(FamilyAssignation)
                    .filter(
                        FamilyAssignation.users_responsable_id == current_user.id,
                        FamilyAssignation.users_assigned_id == user_id,
                    )
                    .first()
                    is not None
                )
                if not exists:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                    )
        else:
            if int(user_obj.id) != int(current_user.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                )
    out = _user_to_dict(user_obj)
    out.pop("password", None)
    return out


@router.get("/users")
async def get_members(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    # Admin and treasury see all; group admin sees only assigned users via family_assignation (plus themselves)
    roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in roles
    is_treasury = "treasury" in roles
    is_group_admin = "admingroup" in roles

    # Query filters: status (active/inactive/all), first_login (yes/no/all), q (search)
    qp = request.query_params
    status = (qp.get("status") or "active").lower()
    first_login = (qp.get("first_login") or "all").lower()
    role_filter = qp.get("role") or "all"
    q = qp.get("q") or None

    # Base query: Users with optional roles via outer joins
    query = (
        db.query(Users, Roles)
        .outerjoin(RoleAttribution, RoleAttribution.users_id == Users.id)
        .outerjoin(Roles, Roles.id == RoleAttribution.roles_id)
    )

    # Scope by role of current_user
    if is_admin or is_treasury:
        pass  # full scope
    elif is_group_admin:
        # Only users assigned to the current group admin, plus themselves
        query = (
            query.outerjoin(FamilyAssignation, FamilyAssignation.users_assigned_id == Users.id)
            .filter(
                or_(
                    FamilyAssignation.users_responsable_id == int(current_user.id),
                    Users.id == int(current_user.id),
                )
            )
        )
    else:
        # Regular users: only themselves
        query = query.filter(Users.id == int(current_user.id))

    # Filters
    if status in {"active", "inactive"}:
        query = query.filter(Users.isactive == (1 if status == "active" else 0))

    if first_login in {"yes", "no"}:
        query = query.filter(Users.isfirstlogin == (1 if first_login == "yes" else 0))

    if role_filter != "all":
        roles_list = [r.strip() for r in role_filter.split(",") if r.strip()]
        if roles_list:
            if len(roles_list) == 1:
                query = query.filter(Roles.role == roles_list[0])
            else:
                query = query.filter(Roles.role.in_(roles_list))

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                cast(Users.id, String).like(like),
                Users.firstname.like(like),
                Users.lastname.like(like),
                Users.username.like(like),
                Users.email.like(like),
                Users.telephone.like(like),
                cast(Users.birthday, String).like(like),
            )
        )

    # Generic column filters
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
            col = getattr(Users, key, None)
            if col is not None:
                if "," in val:
                    vals = [v.strip() for v in val.split(",")]
                    query = query.filter(col.in_(vals))
                else:
                    query = query.filter(col == val)

    # Ordering to match previous behavior
    query = query.order_by(Users.id, Roles.id)

    results = query.all()

    # Aggregate roles per user
    users_by_id = {}
    for user_obj, role_obj in results:
        uid = int(getattr(user_obj, "id"))
        if uid not in users_by_id:
            user_data = _user_to_dict(user_obj)
            user_data.pop("password", None)
            user_data["roles"] = []
            users_by_id[uid] = user_data

        if role_obj is not None and getattr(role_obj, "id", None) is not None:
            rid = int(role_obj.id)
            if not any(r["id"] == rid for r in users_by_id[uid]["roles"]):
                users_by_id[uid]["roles"].append({"id": rid, "role": role_obj.role})

    return list(users_by_id.values())


@router.post("/users")
async def create_user(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    data, upload = await parse_create_request(request)
    body = UserCreate(**data)

    if not body.username or not body.username.strip():
        # Build base username from names and birthday, then ensure uniqueness via ORM
        from utils import _base_username_from_names

        base = _base_username_from_names(
            body.firstname or "", body.lastname or "", body.birthday
        )
        if not base:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Nom d'utilisateur vide"
            )
        candidate = base
        exists = db.query(Users.id).filter(Users.username == candidate).first()
        if exists:
            import string

            ok = False
            for letter in string.ascii_lowercase:
                candidate = f"{base}{letter}"
                if not db.query(Users.id).filter(Users.username == candidate).first():
                    ok = True
                    break
            if not ok:
                for letter in string.ascii_lowercase:
                    for i in range(1, 1000):
                        candidate = f"{base}{letter}{i}"
                        if not db.query(Users.id).filter(Users.username == candidate).first():
                            ok = True
                            break
                    if ok:
                        break
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Impossible de générer un nom d'utilisateur unique",
                )
        body.username = candidate
    else:
        # Ensure uniqueness with ORM
        desired = body.username.strip()
        if not desired:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Nom d'utilisateur vide"
            )
        exists = db.query(Users.id).filter(Users.username == desired).first()
        if exists:
            import string
            base = desired
            candidate = base
            ok = False
            for letter in string.ascii_lowercase:
                candidate = f"{base}{letter}"
                if not db.query(Users.id).filter(Users.username == candidate).first():
                    ok = True
                    break
            if not ok:
                for letter in string.ascii_lowercase:
                    for i in range(1, 1000):
                        candidate = f"{base}{letter}{i}"
                        if not db.query(Users.id).filter(Users.username == candidate).first():
                            ok = True
                            break
                    if ok:
                        break
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Impossible de générer un nom d'utilisateur unique",
                )
            body.username = candidate

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
        if not db.query(Users.id).filter(Users.id == body.id_father).first():
            body.id_father = None
    if body.id_mother:
        if not db.query(Users.id).filter(Users.id == body.id_mother).first():
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

    # Authorization for creation: admin anytime; group admin allowed; others forbidden
    roles = await get_user_roles(db, current_user.id)
    if "admin" not in roles:
        if "admingroup" not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    clean_tel = re.sub(r"[\s-]", "", body.telephone) if body.telephone else None

    new_user = Users(
        firstname=body.firstname,
        lastname=body.lastname,
        username=body.username,
        password=default_hashed,
        email=body.email,
        telephone=clean_tel,
        birthday=body.birthday,
        image_url=body.image_url,
        gender=body.gender,
        contribution_tier=body.contribution_tier,
        id_father=body.id_father,
        id_mother=body.id_mother,
        isactive=(body.isactive if body.isactive is not None else 0),
        isfirstlogin=(body.isfirstlogin if body.isfirstlogin is not None else 1),
        createdby=int(current_user.id),
        updatedby=int(current_user.id),
        createdat=datetime.now(),
        updatedat=datetime.now(),
    )
    db.add(new_user)
    try:
        db.flush()
    except Exception:
        logger.exception("[users] Insert failed during create_user")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database insert failed",
        )
    new_id = int(new_user.id)

    # Handle optional role assignment on creation
    input_role = data.get("role")
    if input_role:
        r_str = str(input_role).lower().strip()
        if r_str != "norole":
            # Check if role exists
            r_row = db.query(Roles).filter(Roles.role == r_str).first()
            if r_row:
                rid = int(r_row.id)
                # Permission check
                is_adm = "admin" in roles
                is_grp = "admingroup" in roles

                allowed = False
                if is_adm:
                    allowed = True
                elif is_grp and r_str in ("admingroup", "user", "member"):
                    allowed = True

                if allowed:
                    try:
                        db.add(RoleAttribution(users_id=new_id, roles_id=rid))
                    except Exception:
                        db.rollback()
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to assign role {r_str} to user {new_id}",
                        )

    # Auto-assignments when created by a group admin
    try:
        if ("admin" not in roles) and ("admingroup" in roles):
            assignments_to_insert = []

            # Check if assignment to current admingroup already exists
            exists_self = (
                db.query(FamilyAssignation)
                .filter(
                    FamilyAssignation.users_responsable_id == int(current_user.id),
                    FamilyAssignation.users_assigned_id == new_id,
                )
                .first()
            )

            if not exists_self:
                assignments_to_insert.append((new_id, int(current_user.id)))

            # Find co-responsables (role admingroup) who share at least one assigned user with current admingroup
            FA_self = aliased(FamilyAssignation)
            FA_other = aliased(FamilyAssignation)
            co_rows = (
                db.query(FA_other.users_responsable_id)
                .select_from(FA_self)
                .join(FA_other, FA_self.users_assigned_id == FA_other.users_assigned_id)
                .join(RoleAttribution, RoleAttribution.users_id == FA_other.users_responsable_id)
                .join(Roles, Roles.id == RoleAttribution.roles_id)
                .filter(FA_self.users_responsable_id == int(current_user.id))
                .filter(FA_other.users_responsable_id != int(current_user.id))
                .filter(Roles.role == "admingroup")
                .distinct()
                .all()
            )
            co_ids = []
            for r in co_rows:
                try:
                    rid = int(r[0])
                except Exception:
                    continue
                if rid != int(current_user.id):
                    co_ids.append(rid)

            for rid in co_ids:
                exists_row = (
                    db.query(FamilyAssignation)
                    .filter(
                        FamilyAssignation.users_responsable_id == rid,
                        FamilyAssignation.users_assigned_id == new_id,
                    )
                    .first()
                )
                if not exists_row:
                    assignments_to_insert.append((new_id, rid))

            if assignments_to_insert:
                try:
                    for ua, ur in assignments_to_insert:
                        db.add(
                            FamilyAssignation(
                                users_assigned_id=ua, users_responsable_id=ur
                            )
                        )
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error during auto-assignments",
        )

    user_obj = db.query(Users).filter(Users.id == new_id).first()

    # Notify admins about new user (use centralized helper)
    if "admin" not in roles:
        try:
            admin_ids = [
                int(ra.users_id)
                for ra in db.query(RoleAttribution)
                .join(Roles, Roles.id == RoleAttribution.roles_id)
                .filter(Roles.role == "admin")
                .all()
            ]

            # Sender informations
            sender_name = f"{getattr(current_user, 'firstname', '')} {getattr(current_user, 'lastname', '')} ({getattr(current_user, 'username', '')})".strip()
            # New user name
            user_name = f"{body.firstname} {body.lastname}".strip()
            message_text = f"{sender_name} a créé un nouvel utilisateur {user_name}."

            await send_notification(
                db,
                admin_ids,
                message_text,
                sender_id=int(current_user.id),
                link="/users",
            )
        except Exception as e:
            logger.warning(f"[users] Failed to notify admins about new user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to notify admins about new user",
            )

    # Global commit
    try:
        db.commit()
    except Exception:
        logger.exception("[users] Commit failed during create_user")
        db.rollback()
        raise HTTPException(status_code=500, detail="Database commit failed")

    if user_obj:
        user_dict = _user_to_dict(user_obj)
        user_dict.pop("password", None)
        return user_dict
    return _user_to_dict(new_user)


@router.patch("/users/bulk-tier")
async def bulk_update_user_tier(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    try:
        data = await request.json()
        body = UserBulkTierUpdate(**data)
    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=422, detail=str(e))

    # Only admin can do bulk update for now
    roles = await get_user_roles(db, current_user.id)
    if ("admin" not in roles) and ("admingroup" not in roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if not body.user_ids:
        return {"message": "No users updated"}

    if not body.user_ids:
        return {"message": "No users updated"}

    (
        db.query(Users)
        .filter(Users.id.in_(body.user_ids))
        .update({Users.contribution_tier: body.contribution_tier}, synchronize_session=False)
    )
    try:
        db.commit()
    except Exception as e:
        logger.error(f"Error updating bulk tiers: {e}")
        raise HTTPException(status_code=500, detail="Database error")

    return {"message": "Updated successfully"}


@router.patch("/users/{user_id}")
async def update_user_by_id(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    data, upload = await parse_update_request(request)
    body = UserAdminUpdate(**data)

    user_obj = db.query(Users).filter(Users.id == user_id).first()
    if not user_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    roles = await get_user_roles(db, current_user.id)
    # Allow full access to admins and group admins; regular users can only modify their own profile
    if not ("admin" in roles or "admingroup" in roles):
        if user_obj.id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if body.firstname is not None:
        user_obj.firstname = body.firstname
    if body.lastname is not None:
        user_obj.lastname = body.lastname
    if body.username is not None:
        desired = (body.username or "").strip()
        if desired == "":
            raise HTTPException(status_code=422, detail="Username cannot be empty")
        other = db.query(Users.id).filter(Users.username == desired).first()
        if other and int(other[0]) != int(user_id):
            raise HTTPException(status_code=422, detail="Username already exists")
        user_obj.username = desired
    if body.email is not None:
        user_obj.email = body.email
    if body.telephone is not None:
        user_obj.telephone = body.telephone
    if body.birthday is not None:
        user_obj.birthday = body.birthday
    if body.gender is not None:
        user_obj.gender = body.gender
    if "contribution_tier" in data:
        user_obj.contribution_tier = body.contribution_tier
    if body.id_father is not None:
        if db.query(Users.id).filter(Users.id == body.id_father).first() is None:
            raise HTTPException(status_code=422, detail="Invalid father id")
        user_obj.id_father = body.id_father
    if body.id_mother is not None:
        if db.query(Users.id).filter(Users.id == body.id_mother).first() is None:
            raise HTTPException(status_code=422, detail="Invalid mother id")
        user_obj.id_mother = body.id_mother
    if user_obj.id_father and user_obj.id_mother and user_obj.id_father == user_obj.id_mother:
        raise HTTPException(status_code=422, detail="Le père et la mère doivent être différents")

    final_birthday = body.birthday if body.birthday is not None else getattr(user_obj, "birthday", None)
    if final_birthday:
        try:
            bd = datetime.strptime(str(final_birthday), "%Y-%m-%d").date()
        except Exception:
            bd = None
        if bd:
            today = datetime.now().date()
            age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
            if age < 18:
                user_obj.isactive = 0
    # Image handling: upload, explicit image_url, or remove_image
    # Initialize AWS service if available
    service = None
    try:
        service = AwsFile(settings)
    except Exception:
        service = None

    old_image = getattr(user_obj, "image_url", None)

    # 1) If a file was uploaded, store it on S3 and set new URL; delete previous S3 object if present
    if upload is not None:
        if service is None:
            logger.warning("[users] Upload requested but AWS not configured; skipping upload")
        else:
            try:
                up_res = await asyncio.to_thread(
                    service.add_image, upload, "users", getattr(user_obj, "username", None)
                )
                new_url = up_res.get("url")
                user_obj.image_url = new_url
                logger.info(f"User {user_id} image_url updated from upload to {new_url}")
                # remove old image from S3 if it exists and differs
                if old_image and old_image != new_url:
                    try:
                        await asyncio.to_thread(service.delete_image, old_image)
                    except Exception:
                        logger.exception("[users] Failed to delete old image for user %s", user_id)
            except Exception:
                logger.exception("[users] Failed to upload image for user %s", user_id)
                raise HTTPException(
                    status_code=500, detail="Echec d'upload image"
                )

    # 2) If client requested to remove image, delete S3 object (if any) and clear DB field
    elif data.get("remove_image", False):
        if old_image:
            if service is not None:
                try:
                    await asyncio.to_thread(service.delete_image, old_image)
                except Exception:
                    logger.exception("[users] Failed to delete image for user %s", user_id)
        user_obj.image_url = None
        logger.info(f"User {user_id} image removed as requested")

    # 3) If an explicit image_url was provided (no upload), set it and delete old S3 object if different
    elif body.image_url is not None and upload is None:
        # if replacing an existing S3 image with a new URL, try to delete the old S3 object
        if old_image and old_image != body.image_url and service is not None:
            try:
                await asyncio.to_thread(service.delete_image, old_image)
            except Exception:
                logger.exception("[users] Failed to delete old image for user %s", user_id)
        user_obj.image_url = body.image_url
        logger.info(f"User {user_id} image_url updated to {body.image_url} without upload")
    if body.isactive is not None:
        user_obj.isactive = body.isactive
    if body.isfirstlogin is not None:
        user_obj.isfirstlogin = body.isfirstlogin
        if body.isfirstlogin == 1:
            user_obj.password = hash_password(settings.user_password_default)

    user_obj.updatedby = int(current_user.id)
    user_obj.updatedat = datetime.now()
    db.add(user_obj)
    try:
        db.commit()
    except Exception:
        logger.exception("[users] Commit failed during update_user_by_id")
        db.rollback()
        raise HTTPException(status_code=500, detail="Database commit failed")

    return _user_to_dict(user_obj)


@router.delete("/users/{user_id}")
async def delete_user_by_id(
    user_id: int,
    hard: bool = False,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    # Authorization: admin ok; group admin only if target assigned via family_assignation (or self); others forbidden
    target_obj = db.query(Users).filter(Users.id == user_id).first()
    if not target_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in roles

    if not is_admin:
        if hard:
            # Only admins can hard delete
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can perform hard delete",
            )

        if "admingroup" in roles:
            target_id = int(target_obj.id)
            if target_id != int(current_user.id):
                exists = (
                    db.query(FamilyAssignation)
                    .filter(
                        FamilyAssignation.users_responsable_id == current_user.id,
                        FamilyAssignation.users_assigned_id == target_id,
                    )
                    .first()
                    is not None
                )
                if not exists:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                    )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )

    if hard:
        try:
            # Attempt to delete user's image from S3 before hard-deleting DB rows
            try:
                service = AwsFile(settings)
                try:
                    img = getattr(target_obj, "image_url", None)
                    if img:
                        await asyncio.to_thread(service.delete_image, img)
                except Exception:
                    logger.exception("[users] Failed to delete image for hard-deleted user %s", user_id)
            except Exception:
                # AWS not configured or client error; continue with DB deletion
                pass
            # First remove role attributions using ORM
            db.query(RoleAttribution).filter(RoleAttribution.users_id == user_id).delete(synchronize_session=False)
            db.query(Users).filter(Users.id == user_id).delete(synchronize_session=False)
            db.commit()
            
            return {"status": "deleted", "id": user_id}
        except Exception:
            logger.exception("[users] Hard delete failed")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Impossible de supprimer l'utilisateur (contraintes DB?)",
            )

    # Soft deactivate via ORM
    target_obj.isactive = 0
    target_obj.updatedby = int(current_user.id)
    target_obj.updatedat = datetime.now()
    db.add(target_obj)
    try:
        db.commit()
    except Exception:
        logger.exception("[users] Commit failed during delete_user_by_id")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )
    return {"status": "deactivated", "id": user_id}


@router.get("/user")
async def get_current_user_profile(
    db: Session = Depends(get_db), current_user: Users = Depends(get_current_user)
):
    rows = (
        db.query(Roles.role)
        .join(RoleAttribution, Roles.id == RoleAttribution.roles_id)
        .filter(RoleAttribution.users_id == current_user.id)
        .all()
    )
    roles = [{"role": r[0]} for r in rows]
    u = {
        "id": current_user.id,
        "firstname": getattr(current_user, "firstname", None),
        "lastname": getattr(current_user, "lastname", None),
        "username": getattr(current_user, "username", None),
        "email": getattr(current_user, "email", None),
        "telephone": getattr(current_user, "telephone", None),
        "birthday": getattr(current_user, "birthday", None),
        "image_url": getattr(current_user, "image_url", None),
        "gender": getattr(current_user, "gender", None),
        "contribution_tier": getattr(current_user, "contribution_tier", None),
        "isactive": getattr(current_user, "isactive", None),
        "isfirstlogin": getattr(current_user, "isfirstlogin", None),
    }
    u["roles"] = roles
    return u


@router.get("/tree", response_model=List[UserSchema])
async def get_tree(db: Session = Depends(get_db)):
    users = db.query(Users).order_by(Users.id).all()

    users_map = {}
    children_map = {}
    for u in users:
        uid = u.id
        users_map[uid] = {
            "id": uid,
            "firstname": getattr(u, "firstname", None),
            "lastname": getattr(u, "lastname", None),
            "image_url": getattr(u, "image_url", None),
            "birthday": str(getattr(u, "birthday", "")) if getattr(u, "birthday", None) else None,
            "id_father": getattr(u, "id_father", None),
            "id_mother": getattr(u, "id_mother", None),
            "gender": (getattr(u, "gender", "") or "").strip().lower(),
            "_fullname": f"{getattr(u, 'firstname', '')} {getattr(u, 'lastname', '')}".strip(),
        }
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
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    # Apply updates via ORM
    has_update = False
    if body.firstname is not None:
        current_user.firstname = body.firstname
        has_update = True
    if body.lastname is not None:
        current_user.lastname = body.lastname
        has_update = True
    if body.email is not None:
        current_user.email = body.email
        has_update = True
    if body.telephone is not None:
        current_user.telephone = body.telephone
        has_update = True
    if body.birthday is not None:
        current_user.birthday = body.birthday
        has_update = True
    if body.image_url is not None:
        current_user.image_url = body.image_url
        has_update = True
    if body.gender is not None:
        current_user.gender = body.gender
        has_update = True

    if not has_update:
        # Return current user state without password
        updated = {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "firstname": current_user.firstname,
            "lastname": current_user.lastname,
            "telephone": getattr(current_user, "telephone", None),
            "birthday": getattr(current_user, "birthday", None),
            "image_url": getattr(current_user, "image_url", None),
            "gender": getattr(current_user, "gender", None),
        }
        return updated

    db.add(current_user)
    try:
        db.commit()
    except Exception:
        logger.exception("[users] Commit failed during update_current_user_profile")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database commit failed",
        )

    try:
        db.refresh(current_user)
    except Exception:
        pass
    updated = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "firstname": current_user.firstname,
        "lastname": current_user.lastname,
        "telephone": getattr(current_user, "telephone", None),
        "birthday": getattr(current_user, "birthday", None),
        "image_url": getattr(current_user, "image_url", None),
        "gender": getattr(current_user, "gender", None),
    }
    return updated


@router.get("/users/{user_id}/parents")
async def get_parents_by_user_id(
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Public endpoint: returns father and mother for a given user id in a single call.
    Response: { father: User | null, mother: User | null }
    """
    u = db.query(Users).filter(Users.id == user_id).first()
    if not u:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    fid = getattr(u, "id_father", None)
    mid = getattr(u, "id_mother", None)

    father = None
    mother = None

    if fid is not None:
        f = db.query(Users).filter(Users.id == fid).first()
        if f:
            father = _user_to_dict(f)
            father.pop("password", None)
    if mid is not None:
        m = db.query(Users).filter(Users.id == mid).first()
        if m:
            mother = _user_to_dict(m)
            mother.pop("password", None)

    return {"father": father, "mother": mother}
