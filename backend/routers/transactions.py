from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Query,
    status,
    UploadFile,
    File,
    Form,
)
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text, func, exists
from models_orm.dependencies import get_db, get_current_user, get_user_roles
from models_orm.users import Users, FamilyAssignation
from models_orm.finance import PaymentMethods, Transactions, TransactionApprovals
from models_orm.access_control import Roles, RoleAttribution
from settings import settings
from aws_file import AwsFile
import uuid
from routers.messages import send_notification


router = APIRouter()
logger = logging.getLogger("transactions")

# Allowed payment method names (ENUM-like constraint at app level)
ALLOWED_PAYMENT_METHODS = [
    "Orange money",
    "Argent compte",
    "Virement bancaire",
]

ALLOWED_TYPE_OF_PROOF = {"TRANSACTIONNUMBER", "LINK", "BOTH"}


# -----------------------------
# Models (local to this router)
# -----------------------------


class PaymentMethodCreate(BaseModel):
    name: str
    isactive: Optional[int] = 1
    type_of_proof: Optional[str] = "BOTH"
    account_number: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str):
        vv = (v or "").strip()
        if vv not in ALLOWED_PAYMENT_METHODS:
            raise ValueError("Unsupported payment method name")
        return vv

    @field_validator("type_of_proof")
    @classmethod
    def validate_type_of_proof(cls, v: Optional[str]):
        vv = (v or "").strip().upper() or "BOTH"
        if vv not in ALLOWED_TYPE_OF_PROOF:
            raise ValueError("type_of_proof must be TRANSACTIONNUMBER, LINK or BOTH")
        return vv


class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    isactive: Optional[int] = None
    type_of_proof: Optional[str] = None
    account_number: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]):
        if v is None:
            return v
        vv = (v or "").strip()
        if vv and vv not in ALLOWED_PAYMENT_METHODS:
            raise ValueError("Unsupported payment method name")
        return vv

    @field_validator("type_of_proof")
    @classmethod
    def validate_type_of_proof(cls, v: Optional[str]):
        if v is None:
            return v
        vv = (v or "").strip().upper()
        if vv and vv not in ALLOWED_TYPE_OF_PROOF:
            raise ValueError("type_of_proof must be TRANSACTIONNUMBER, LINK or BOTH")
        return vv


class TransactionCreate(BaseModel):
    amount: float
    proof_reference: str
    users_id: int
    payment_methods_id: int
    transaction_type: str  # 'INCOME' | 'EXPENSE'
    issubmitted: Optional[int] = 0  # 0 | 1

    @field_validator("transaction_type")
    @classmethod
    def validate_type(cls, v: str):
        vv = (v or "").strip().upper()
        if vv not in {"CONTRIBUTION", "DONATIONS", "EXPENSE"}:
            raise ValueError(
                "transaction_type must be CONTRIBUTION, DONATIONS or EXPENSE"
            )
        return vv

    @field_validator("issubmitted")
    @classmethod
    def validate_issubmitted(cls, v: Optional[int]):
        if v is None:
            return 0
        try:
            vi = int(v)
        except Exception:
            raise ValueError("issubmitted must be 0 or 1")
        if vi not in (0, 1):
            raise ValueError("issubmitted must be 0 or 1")
        return vi


class TransactionStatusUpdate(BaseModel):
    status: str  # 'PENDING' | 'PARTIALLY_APPROVED' | 'VALIDATED' | 'REJECTED'

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str):
        vv = (v or "").strip().upper()
        allowed = {"PENDING", "PARTIALLY_APPROVED", "VALIDATED", "REJECTED", "SAVED"}
        if vv not in allowed:
            raise ValueError("Invalid status")
        return vv


class TransactionApprovalCreate(BaseModel):
    note: Optional[str] = None


class TransactionProofUpdate(BaseModel):
    url: str


class TransactionBulkSubmit(BaseModel):
    transaction_ids: List[int]


class TransactionBulkApprove(BaseModel):
    transaction_ids: List[int]
    note: Optional[str] = None


class TransactionReject(BaseModel):
    reason: Optional[str] = None


class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    proof_reference: Optional[str] = None
    payment_methods_id: Optional[int] = None
    transaction_type: Optional[str] = None  # 'CONTRIBUTION' | 'DONATIONS' | 'EXPENSE'

    @field_validator("transaction_type")
    @classmethod
    def validate_type(cls, v: Optional[str]):
        if v is None:
            return v
        vv = (v or "").strip().upper()
        if vv not in {"CONTRIBUTION", "DONATIONS", "EXPENSE"}:
            raise ValueError(
                "transaction_type must be CONTRIBUTION, DONATIONS or EXPENSE"
            )
        return vv


# -----------------------------
# Helpers
# -----------------------------


async def notify_transactions_validated(db: Session, tx_ids: List[int]):
    if not tx_ids:
        return
    rows = (
        db.query(Transactions.id, Transactions.users_id, Transactions.recorded_by_id)
        .filter(Transactions.id.in_(tx_ids))
        .all()
    )

    # Map user_id -> { as_owner: count, as_creator: count }
    # optimizing to just counts to avoid huge messages list, generic message is better for bulk
    notifications = {}

    for r in rows:
        tid = r["id"] if isinstance(r, dict) else r[0]
        uid = r["users_id"] if isinstance(r, dict) else r[1]
        rid = r["recorded_by_id"] if isinstance(r, dict) else r[2]

        # Check eligibility for owner
        if uid not in notifications:
            notifications[uid] = {"owner_cnt": 0, "creator_cnt": 0}
        notifications[uid]["owner_cnt"] += 1

        # Check eligibility for creator (if different)
        if rid != uid:
            if rid not in notifications:
                notifications[rid] = {"owner_cnt": 0, "creator_cnt": 0}
            notifications[rid]["creator_cnt"] += 1

    all_user_ids = list(notifications.keys())
    if not all_user_ids:
        return

    # Check isactive=1 and role='member' via ORM
    valid_rows = (
        db.query(Users.id)
        .join(RoleAttribution, RoleAttribution.users_id == Users.id)
        .join(Roles, Roles.id == RoleAttribution.roles_id)
        .filter(Users.id.in_(all_user_ids))
        .filter(Users.isactive == 1)
        .filter(Roles.role == "member")
        .distinct()
        .all()
    )
    valid_ids = set(int(r[0]) for r in valid_rows)

    # Send messages
    for uid, data in notifications.items():
        if uid not in valid_ids:
            continue

        parts = []
        oc = data["owner_cnt"]
        cc = data["creator_cnt"]

        if oc > 0:
            parts.append(
                f"{'Vos transactions' if oc > 1 else 'Votre transaction'} ({oc}) {'ont' if oc > 1 else 'a'} été validée{'s' if oc > 1 else ''}."
            )
        if cc > 0:
            parts.append(
                f"{'Les transactions' if cc > 1 else 'La transaction'} ({cc}) que vous avez initiée{'s' if cc > 1 else ''} {'ont' if cc > 1 else 'a'} été validée{'s' if cc > 1 else ''}."
            )

        if parts:
            msg = " ".join(parts)
            # Resolve the 'system' user id from DB to use as sender (avoids FK issues)
            await send_notification(
                db=db,
                sender_id=None,  # Will be resolved to 'system' user in send_notification
                recipient_ids=[uid],
                message_text=msg,
                message_type="APPROVAL",
                link="/transactions",
            )


async def notify_treasurers_new_transaction(
    db: Session, sender_id: int, count: int = 1
):
    """
    Sends a notification to all users with 'treasury' role
    that a new transaction is pending validation.
    """
    # Fetch sender details
    sender = (
        db.query(Users.firstname, Users.lastname)
        .filter(Users.id == int(sender_id))
        .first()
    )
    sender_name = "Utilisateur Inconnu"
    if sender:
        # SQLAlchemy row supports attribute access; fall back defensively
        fn = getattr(sender, "firstname", None)
        ln = getattr(sender, "lastname", None)
        if fn is None or ln is None:
            try:
                fn = sender[0]
                ln = sender[1]
            except Exception:
                fn = fn or ""
                ln = ln or ""
        sender_name = f"{(fn or '')} {(ln or '')}".strip() or sender_name

    rows = (
        db.query(RoleAttribution.users_id)
        .join(Roles, Roles.id == RoleAttribution.roles_id)
        .filter(Roles.role == "treasury")
        .distinct()
        .all()
    )
    treasurer_ids = [int(r[0]) for r in rows]

    if not treasurer_ids:
        return

    msg_text = f"{sender_name} vous a soumis {'une transaction' if count == 1 else f'{count} transactions'} à valider"

    await send_notification(
        db=db,
        recipient_ids=treasurer_ids,
        message_text=msg_text,
        sender_id=sender_id,
        message_type="APPROVAL",
        link="/approvals",
    )


# -----------------------------
# Payment Methods endpoints
# -----------------------------


@router.get("/payment-methods")
async def list_payment_methods(
    active: Optional[bool] = Query(None, description="Filter active methods"),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """List payment methods. Optionally filter by active state (ORM)."""
    q = db.query(PaymentMethods).filter(
        PaymentMethods.name.in_(ALLOWED_PAYMENT_METHODS)
    )
    if active is not None:
        q = q.filter(PaymentMethods.isactive == (1 if active else 0))
    rows = q.order_by(PaymentMethods.name).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "type_of_proof": r.type_of_proof,
            "isactive": int(1 if r.isactive else 0),
            "created_at": r.created_at,
            "updated_at": r.updated_at,
            "account_number": r.account_number,
        }
        for r in rows
    ]


@router.post("/payment-methods")
async def create_payment_method(
    body: PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """
    Create a new payment method. Admin-only (ORM).
    """

    roles = await get_user_roles(db, current_user.id)
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Enforce unique name and allowed set at application level
    exists = db.query(PaymentMethods).filter(PaymentMethods.name == body.name).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment method name already exists",
        )

    pm = PaymentMethods(
        name=body.name,
        type_of_proof=body.type_of_proof,
        isactive=bool(body.isactive if body.isactive is not None else 1),
        account_number=(body.account_number or ""),
    )
    db.add(pm)
    try:
        db.commit()
        db.refresh(pm)
    except Exception:
        logger.exception("[transactions] Commit failed during create_payment_method")
        raise HTTPException(status_code=500, detail="Database commit failed")

    return {
        "id": pm.id,
        "name": pm.name,
        "type_of_proof": pm.type_of_proof,
        "isactive": int(1 if pm.isactive else 0),
        "created_at": pm.created_at,
        "updated_at": pm.updated_at,
        "account_number": pm.account_number,
    }


@router.patch("/payment-methods/{pm_id}")
async def update_payment_method(
    pm_id: int,
    body: PaymentMethodUpdate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Update a payment method. Admin-only (ORM)."""
    roles = await get_user_roles(db, current_user.id)
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    pm = db.query(PaymentMethods).filter(PaymentMethods.id == pm_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")

    if body.name is not None:
        exists = (
            db.query(PaymentMethods)
            .filter(PaymentMethods.name == body.name)
            .filter(PaymentMethods.id != pm_id)
            .first()
        )
        if exists:
            raise HTTPException(
                status_code=409, detail="Payment method name already exists"
            )
        pm.name = body.name
    if body.isactive is not None:
        pm.isactive = bool(body.isactive)
    if body.type_of_proof is not None:
        pm.type_of_proof = body.type_of_proof
    if body.account_number is not None:
        pm.account_number = body.account_number
    pm.updated_at = datetime.now()

    try:
        db.commit()
        db.refresh(pm)
    except Exception:
        logger.exception("[transactions] Commit failed during update_payment_method")
        raise HTTPException(status_code=500, detail="Database commit failed")

    return {
        "id": pm.id,
        "name": pm.name,
        "type_of_proof": pm.type_of_proof,
        "isactive": int(1 if pm.isactive else 0),
        "created_at": pm.created_at,
        "updated_at": pm.updated_at,
        "account_number": pm.account_number,
    }


# -----------------------------
# Transactions endpoints
# -----------------------------


@router.get("/transactions")
async def list_transactions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """List transactions with optional filters via query params."""
    qp = request.query_params
    where: List[str] = []
    params: dict = {}

    status_q = (qp.get("status") or "").strip().upper()
    if status_q in {"PENDING", "PARTIALLY_APPROVED", "VALIDATED", "REJECTED", "SAVED"}:
        where.append("t.status = :p_status")
        params["p_status"] = status_q

    for key in ("users_id", "recorded_by_id", "payment_methods_id"):
        if qp.get(key):
            pname = f"p_{key}"
            where.append(f"t.{key} = :{pname}")
            params[pname] = int(qp.get(key))

    ttype = (qp.get("transaction_type") or "").strip().upper()
    if ttype in {"CONTRIBUTION", "DONATIONS", "EXPENSE"}:
        where.append("t.transaction_type = :p_ttype")
        params["p_ttype"] = ttype

    date_from = qp.get("date_from")
    date_to = qp.get("date_to")
    if date_from:
        where.append("t.created_at >= :p_from")
        params["p_from"] = date_from
    if date_to:
        where.append("t.created_at <= :p_to")
        params["p_to"] = date_to

    # Role-based access
    roles = await get_user_roles(db, current_user.id) or []
    lowered = [r.lower() for r in roles]
    is_admin = "admin" in lowered
    is_treasury = "treasury" in lowered
    is_group_admin = "admingroup" in lowered
    if not (is_admin or is_treasury):
        if is_group_admin:
            # Group admin: own + assigned + all VALIDATED
            where.append(
                "(t.users_id = :p_me OR t.users_id IN (SELECT users_assigned_id FROM family_assignation WHERE users_responsable_id = :p_me) OR t.status = 'VALIDATED')"
            )
            params["p_me"] = current_user.id
        else:
            # Regular members: own + all VALIDATED
            where.append("(t.users_id = :p_me OR t.status = 'VALIDATED')")
            params["p_me"] = current_user.id

    # Build ORM query for transactions
    q = (
        db.query(Transactions)
        .join(Users, Users.id == Transactions.users_id)
        .join(PaymentMethods, PaymentMethods.id == Transactions.payment_methods_id)
    )
    # Apply filters from params
    if "p_status" in params:
        q = q.filter(Transactions.status == params["p_status"])
    for key in ("users_id", "recorded_by_id", "payment_methods_id"):
        pname = f"p_{key}"
        if pname in params:
            q = q.filter(getattr(Transactions, key) == params[pname])
    if "p_ttype" in params:
        q = q.filter(Transactions.transaction_type == params["p_ttype"])
    if "p_from" in params:
        q = q.filter(Transactions.created_at >= params["p_from"])
    if "p_to" in params:
        q = q.filter(Transactions.created_at <= params["p_to"])

    # Role-based access already handled via where clauses above; replicate logic
    if not (is_admin or is_treasury):
        if is_group_admin:
            q = q.filter(
                (Transactions.users_id == current_user.id)
                | (
                    db.query(FamilyAssignation)
                    .filter(FamilyAssignation.users_responsable_id == current_user.id)
                    .filter(
                        FamilyAssignation.users_assigned_id == Transactions.users_id
                    )
                    .exists()
                )
                | (Transactions.status == "VALIDATED")
            )
        else:
            q = q.filter(
                (Transactions.users_id == current_user.id)
                | (Transactions.status == "VALIDATED")
            )

    rows = q.order_by(Transactions.created_at.desc()).all()
    transactions = []
    for t in rows:
        pm = t.payment_method
        u = t.user
        rb = t.recorded_by
        item = {
            "id": t.id,
            "amount": t.amount,
            "status": t.status,
            "proof_reference": t.proof_reference,
            "validated_at": t.validated_at,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "issubmitted": int(1 if t.issubmitted else 0),
            "recorded_by_id": t.recorded_by_id,
            "users_id": t.users_id,
            "updated_by": t.updated_by,
            "payment_methods_id": t.payment_methods_id,
            "transaction_type": t.transaction_type,
            "user_username": getattr(u, "username", None),
            "user_firstname": getattr(u, "firstname", None),
            "user_lastname": getattr(u, "lastname", None),
            "user_image_url": getattr(u, "image_url", None),
            "recorded_by_username": getattr(rb, "username", None),
            "recorded_by_firstname": getattr(rb, "firstname", None),
            "recorded_by_lastname": getattr(rb, "lastname", None),
            "payment_method_name": getattr(pm, "name", None),
            "payment_method_type_of_proof": getattr(pm, "type_of_proof", None),
            "payment_method_account_number": getattr(pm, "account_number", None),
        }
        # Add account_number conditionally
        pm_name = (item["payment_method_name"] or "").lower()
        if pm_name in ["orange money", "virement bancaire"]:
            item["account_number"] = item.get("payment_method_account_number")
        else:
            item["account_number"] = None
        transactions.append(item)

    if transactions:
        # Fetch approvals for these transactions via ORM
        tx_ids = [t["id"] for t in transactions]
        rows_app = (
            db.query(
                TransactionApprovals,
                Users.username.label("approved_by_username"),
                Users.firstname.label("approved_by_firstname"),
                Users.lastname.label("approved_by_lastname"),
            )
            .join(Users, Users.id == TransactionApprovals.users_id)
            .filter(TransactionApprovals.transactions_id.in_(tx_ids))
            .order_by(TransactionApprovals.approved_at.asc())
            .all()
        )
        all_approvals = []
        for ta, u_username, u_firstname, u_lastname in rows_app:
            all_approvals.append(
                {
                    "id": ta.id,
                    "role_at_approval": ta.role_at_approval,
                    "approved_at": ta.approved_at,
                    "note": ta.note,
                    "transactions_id": ta.transactions_id,
                    "users_id": ta.users_id,
                    "approved_by_username": u_username,
                    "approved_by_firstname": u_firstname,
                    "approved_by_lastname": u_lastname,
                }
            )

        # Map approvals to transactions
        approval_map = {}
        for app in all_approvals:
            tid = app["transactions_id"]
            if tid not in approval_map:
                approval_map[tid] = []
            approval_map[tid].append(app)

        for tx in transactions:
            tx["approvals"] = approval_map.get(tx["id"], [])
            # Add account_number for Orange money or Virement bancaire
            pm_name = tx.get("payment_method_name", "").lower()
            if pm_name in ["orange money", "virement bancaire"]:
                tx["account_number"] = tx.get("payment_method_account_number")
            else:
                tx["account_number"] = None

    return transactions


@router.post("/transactions")
async def create_transaction(
    body: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Create a transaction using ORM. Restricted to admin/group admin/member; EXPENSE only by board/treasury."""
    roles = await get_user_roles(db, current_user.id)
    lowered = set(roles)
    if not (
        "member" in lowered
        or "admin" in lowered
        or "admingroup" in lowered
        or "treasury" in lowered
        or "board" in lowered
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Validate foreign keys
    if not db.query(Users).filter(Users.id == body.users_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    pm = (
        db.query(PaymentMethods)
        .filter(PaymentMethods.id == body.payment_methods_id)
        .first()
    )
    if not pm or not bool(pm.isactive):
        raise HTTPException(
            status_code=400, detail="Invalid or inactive payment method"
        )
    # Validate proof_reference: accept either transaction number (non-empty text) or URL for all methods
    pr = (body.proof_reference or "").strip()
    if len(pr) == 0:
        raise HTTPException(
            status_code=400, detail="Proof required (transaction number or URL)"
        )

    # Expense creation only allowed to 'board' or 'treasury'
    if body.transaction_type.upper() == "EXPENSE":
        if not ("board" in lowered or "treasury" in lowered):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only board or treasury can create EXPENSE transactions",
            )

    # Additional rule: if creating for another user, must be treasury or admingroup
    # A simple member can only create a transaction for themselves
    if int(body.users_id) != int(current_user.id):
        is_treasury = "treasury" in lowered
        if is_treasury:
            pass
        else:
            is_group_admin = "admingroup" in lowered
            if not is_group_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only treasury or admingroup can create transactions for another user",
                )
            # For admingroup, target user must be assigned to them
            row = (
                db.query(FamilyAssignation)
                .filter(FamilyAssignation.users_responsable_id == current_user.id)
                .filter(FamilyAssignation.users_assigned_id == body.users_id)
                .first()
            )
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not assigned to this group admin",
                )

    now = datetime.now()
    # validated_at is NOT NULL in schema; initialize with created_at
    # Default status depends on submission flag
    default_status = "PENDING" if (body.issubmitted or 0) == 1 else "SAVED"
    params = (
        body.amount,
        default_status,
        body.proof_reference,
        now,  # validated_at initial
        now,  # created_at
        current_user.id,  # recorded_by_id
        body.users_id,
        current_user.id,  # updated_by
        body.payment_methods_id,
        body.transaction_type,
        now,  # updated_at
        body.issubmitted or 0,
    )

    tx = Transactions(
        amount=body.amount,
        status=default_status,
        proof_reference=body.proof_reference,
        validated_at=now,
        created_at=now,
        recorded_by_id=current_user.id,
        users_id=body.users_id,
        updated_by=current_user.id,
        payment_methods_id=body.payment_methods_id,
        transaction_type=body.transaction_type,
        updated_at=now,
        issubmitted=bool(body.issubmitted or 0),
    )
    db.add(tx)

    if (body.issubmitted or 0) == 1:
        await notify_treasurers_new_transaction(db, current_user.id)

        # Auto-approval for treasury if creating a CONTRIBUTION/DONATIONS
        user_roles = await get_user_roles(db, current_user.id) or []
        lowered_roles = [r.lower() for r in user_roles]
        if "treasury" in lowered_roles and body.transaction_type.upper() in (
            "CONTRIBUTION",
            "DONATIONS",
        ):
            now2 = datetime.now()
            # Insert approval
            db.add(
                TransactionApprovals(
                    role_at_approval="treasury",
                    approved_at=now2,
                    note="Auto-approval on creation",
                    transactions_id=tx.id,
                    users_id=current_user.id,
                )
            )
            # Update status to PARTIALLY_APPROVED
            tx.status = "PARTIALLY_APPROVED"
            tx.updated_by = current_user.id
            tx.updated_at = now2

        try:
            db.commit()
            db.refresh(tx)
        except Exception:
            logger.exception("[transactions] Commit failed during create_transaction")
            raise HTTPException(status_code=500, detail="Database commit failed")

    return {
        "id": tx.id,
        "amount": tx.amount,
        "status": tx.status,
        "proof_reference": tx.proof_reference,
        "validated_at": tx.validated_at,
        "created_at": tx.created_at,
        "recorded_by_id": tx.recorded_by_id,
        "users_id": tx.users_id,
        "updated_by": tx.updated_by,
        "payment_methods_id": tx.payment_methods_id,
        "transaction_type": tx.transaction_type,
        "updated_at": tx.updated_at,
        "issubmitted": int(1 if tx.issubmitted else 0),
    }


@router.post("/transactions/proof-upload")
async def upload_transaction_proof(
    file: UploadFile = File(...),
    tx_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Upload an image proof to S3 under the 'transactions' folder.
    The file will be named using the next id from `transactions`:
    `transaction_{next_id}` to ensure the image name matches the eventual transaction id.
    Returns the public URL and the S3 key.
    """
    # Require elevated role to upload proofs (same as creating transactions)
    # Note: Regular members need to upload proofs for their contributions too.
    roles = await get_user_roles(db, current_user.id)
    lowered = set(roles)
    if not (
        "admin" in lowered
        or "admingroup" in lowered
        or "treasury" in lowered
        or "board" in lowered
        or "member" in lowered
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if tx_id:
        filename = f"transaction_{tx_id}"
    else:
        # Determine next id from transactions for deterministic file naming
        max_id = db.query(func.coalesce(func.max(Transactions.id), 0)).scalar() or 0
        next_id = int(max_id) + 1
        filename = f"transaction_{next_id}"

    aws = AwsFile(settings)
    try:
        # Determine filename: transactions/transaction_{next_id}
        result = aws.add_image(file, folder="transactions", filename=filename)
        return {"url": result.get("url"), "key": result.get("key")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/transactions/proof-delete")
async def delete_transaction_proof(
    url: str = Query(..., description="S3 URL to delete"),
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Delete a proof image from S3."""
    roles = await get_user_roles(db, current_user.id)
    lowered = set(roles)
    if not (
        "admin" in lowered
        or "admingroup" in lowered
        or "treasury" in lowered
        or "board" in lowered
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    aws = AwsFile(settings)
    ok = aws.delete_image(url)
    if not ok:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "deleted"}


@router.patch("/transactions/{tx_id}/proof")
async def set_transaction_proof(
    tx_id: int,
    body: TransactionProofUpdate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Set the proof URL for a transaction. Requires elevated roles (same as upload)."""
    roles = await get_user_roles(db, current_user.id)
    lowered = set(roles)
    if not (
        "admin" in lowered
        or "admingroup" in lowered
        or "treasury" in lowered
        or "board" in lowered
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    tx = db.query(Transactions).filter(Transactions.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    tx.proof_reference = body.url
    tx.updated_by = current_user.id
    tx.updated_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(tx)
    except Exception:
        logger.exception("[transactions] Commit failed during set_transaction_proof")
        raise HTTPException(status_code=500, detail="Database commit failed")
    
    return {
        "id": tx.id,
        "amount": tx.amount,
        "status": tx.status,
        "proof_reference": tx.proof_reference,
        "validated_at": tx.validated_at,
        "created_at": tx.created_at,
        "recorded_by_id": tx.recorded_by_id,
        "users_id": tx.users_id,
        "updated_by": tx.updated_by,
        "payment_methods_id": tx.payment_methods_id,
        "transaction_type": tx.transaction_type,
        "updated_at": tx.updated_at,
        "issubmitted": int(1 if tx.issubmitted else 0),
    }


@router.patch("/transactions/{tx_id}")
async def update_transaction(
    tx_id: int,
    body: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Update transaction core fields: amount, payment method, type, proof_reference.
    Permissions:
    - The user who recorded (created) the transaction can edit when status == SAVED.
    - If the user has 'treasury' role and recorded the transaction, they can edit when status in (SAVED, PENDING).
    - Changing type to EXPENSE requires 'board' or 'treasury' role.
    Member (users_id) cannot be changed via this endpoint.
    """
    # Fetch transaction
    tx = db.query(Transactions).filter(Transactions.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Determine permissions
    recorded_by_id = int(tx.recorded_by_id)
    status_val = tx.status
    is_me_recorder = recorded_by_id == int(current_user.id)
    user_roles = await get_user_roles(db, current_user.id) or []
    lowered = set(r.lower() for r in user_roles)
    is_treasury = "treasury" in lowered

    allowed = False
    if is_me_recorder and status_val == "SAVED":
        allowed = True
    if is_me_recorder and is_treasury and status_val in ("SAVED", "PENDING"):
        allowed = True

    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Validate fields and build update
    fields = []
    vals: List[object] = []

    if body.amount is not None:
        try:
            tx.amount = float(body.amount)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid amount")

    if body.payment_methods_id is not None:
        pm_id = int(body.payment_methods_id)
        pm = db.query(PaymentMethods).filter(PaymentMethods.id == pm_id).first()
        if not pm or not bool(pm.isactive):
            raise HTTPException(
                status_code=400, detail="Invalid or inactive payment method"
            )
        tx.payment_methods_id = pm_id

    if body.transaction_type is not None:
        tt = body.transaction_type.strip().upper()
        if tt == "EXPENSE" and not ("board" in lowered or "treasury" in lowered):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only board or treasury can set EXPENSE",
            )
        tx.transaction_type = tt

    if body.proof_reference is not None:
        pr = (body.proof_reference or "").strip()
        if not pr:
            raise HTTPException(
                status_code=400, detail="Proof reference cannot be empty"
            )
        tx.proof_reference = pr

    # Always update metadata
    tx.updated_by = current_user.id
    tx.updated_at = datetime.now()

    try:
        db.commit()
        db.refresh(tx)
    except Exception:
        logger.exception("[transactions] Commit failed during update_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")

    return {
        "id": tx.id,
        "amount": tx.amount,
        "status": tx.status,
        "proof_reference": tx.proof_reference,
        "validated_at": tx.validated_at,
        "created_at": tx.created_at,
        "recorded_by_id": tx.recorded_by_id,
        "users_id": tx.users_id,
        "updated_by": tx.updated_by,
        "payment_methods_id": tx.payment_methods_id,
        "transaction_type": tx.transaction_type,
        "updated_at": tx.updated_at,
        "issubmitted": int(1 if tx.issubmitted else 0),
    }


@router.patch("/transactions/{tx_id}/status")
async def update_transaction_status(
    tx_id: int,
    body: TransactionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Update a transaction status. Restricted to treasury only."""
    roles = await get_user_roles(db, current_user.id)
    if "treasury" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    tx = db.query(Transactions).filter(Transactions.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    now = datetime.now()
    tx.status = body.status
    tx.updated_by = current_user.id
    tx.updated_at = now
    if body.status == "VALIDATED":
        tx.validated_at = now

    if body.status == "PENDING":
        await notify_treasurers_new_transaction(db, current_user.id)

    if body.status == "VALIDATED":
        try:
            await notify_transactions_validated(db, [tx_id])
        except Exception as e:
            logger.warning(f"Failed to notify validation: {e}")

    try:
        db.commit()
        db.refresh(tx)
    except Exception:
        logger.exception(
            "[transactions] Commit failed during update_transaction_status"
        )
        raise HTTPException(status_code=500, detail="Database commit failed")

    return {
        "id": tx.id,
        "amount": tx.amount,
        "status": tx.status,
        "proof_reference": tx.proof_reference,
        "validated_at": tx.validated_at,
        "created_at": tx.created_at,
        "recorded_by_id": tx.recorded_by_id,
        "users_id": tx.users_id,
        "updated_by": tx.updated_by,
        "payment_methods_id": tx.payment_methods_id,
        "transaction_type": tx.transaction_type,
        "updated_at": tx.updated_at,
        "issubmitted": int(1 if tx.issubmitted else 0),
    }


@router.get("/transactions/{tx_id}")
async def get_transaction_by_id(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Fetch a single transaction by id."""
    tx = db.query(Transactions).filter(Transactions.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Role-based access: admin/treasury any; admingroup only for assigned users (or self); members only self
    roles = await get_user_roles(db, current_user.id) or []
    lowered = [r.lower() for r in roles]
    is_admin = "admin" in lowered
    is_treasury = "treasury" in lowered
    is_group_admin = "admingroup" in lowered
    target_uid = int(tx.users_id)
    if is_admin or is_treasury:
        return {
            "id": tx.id,
            "amount": tx.amount,
            "status": tx.status,
            "proof_reference": tx.proof_reference,
            "validated_at": tx.validated_at,
            "created_at": tx.created_at,
            "recorded_by_id": tx.recorded_by_id,
            "users_id": tx.users_id,
            "updated_by": tx.updated_by,
            "payment_methods_id": tx.payment_methods_id,
            "transaction_type": tx.transaction_type,
            "updated_at": tx.updated_at,
            "issubmitted": int(1 if tx.issubmitted else 0),
        }
        
    if is_group_admin:
        if target_uid == int(current_user.id):
            return {
                "id": tx.id,
                "amount": tx.amount,
                "status": tx.status,
                "proof_reference": tx.proof_reference,
                "validated_at": tx.validated_at,
                "created_at": tx.created_at,
                "recorded_by_id": tx.recorded_by_id,
                "users_id": tx.users_id,
                "updated_by": tx.updated_by,
                "payment_methods_id": tx.payment_methods_id,
                "transaction_type": tx.transaction_type,
                "updated_at": tx.updated_at,
                "issubmitted": int(1 if tx.issubmitted else 0),
            }
            
        row = (
            db.query(FamilyAssignation)
            .filter(FamilyAssignation.users_responsable_id == current_user.id)
            .filter(FamilyAssignation.users_assigned_id == target_uid)
            .first()
        )
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
            
        return {
            "id": tx.id,
            "amount": tx.amount,
            "status": tx.status,
            "proof_reference": tx.proof_reference,
            "validated_at": tx.validated_at,
            "created_at": tx.created_at,
            "recorded_by_id": tx.recorded_by_id,
            "users_id": tx.users_id,
            "updated_by": tx.updated_by,
            "payment_methods_id": tx.payment_methods_id,
            "transaction_type": tx.transaction_type,
            "updated_at": tx.updated_at,
            "issubmitted": int(1 if tx.issubmitted else 0),
        }
    
    # Regular member
    if target_uid != int(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    
    return {
        "id": tx.id,
        "amount": tx.amount,
        "status": tx.status,
        "proof_reference": tx.proof_reference,
        "validated_at": tx.validated_at,
        "created_at": tx.created_at,
        "recorded_by_id": tx.recorded_by_id,
        "users_id": tx.users_id,
        "updated_by": tx.updated_by,
        "payment_methods_id": tx.payment_methods_id,
        "transaction_type": tx.transaction_type,
        "updated_at": tx.updated_at,
        "issubmitted": int(1 if tx.issubmitted else 0),
    }


@router.post("/transactions/{tx_id}/submit")
async def submit_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Submit a SAVED transaction. Changes status to PENDING and issubmitted to 1."""
    tx = db.query(Transactions).filter(Transactions.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Only the creator or admin can submit?
    # Usually the person who recorded it.
    roles = await get_user_roles(db, current_user.id)
    is_admin = "admin" in roles
    if int(tx.recorded_by_id) != int(current_user.id) and not is_admin:
        raise HTTPException(
            status_code=403, detail="Not authorized to submit this transaction"
        )

    if tx.status != "SAVED":
        raise HTTPException(
            status_code=400, detail="Only SAVED transactions can be submitted"
        )

    now = datetime.now()
    tx.status = "PENDING"
    tx.issubmitted = True
    tx.updated_at = now
    tx.updated_by = current_user.id

    await notify_treasurers_new_transaction(db, current_user.id)

    # Auto-approval for treasury if submitting a CONTRIBUTION/DONATIONS
    user_roles = await get_user_roles(db, current_user.id) or []
    lowered_roles = [r.lower() for r in user_roles]
    tx_type = (tx.transaction_type or "").upper()
    if "treasury" in lowered_roles and tx_type in ("CONTRIBUTION", "DONATIONS"):
        # Check if already approved
        row = (
            db.query(TransactionApprovals)
            .filter(TransactionApprovals.transactions_id == tx_id)
            .filter(TransactionApprovals.users_id == current_user.id)
            .first()
        )
        if not row:
            now2 = datetime.now()
            db.add(
                TransactionApprovals(
                    role_at_approval="treasury",
                    approved_at=now2,
                    note="Auto-approval on submission",
                    transactions_id=tx_id,
                    users_id=current_user.id,
                )
            )
            tx.status = "PARTIALLY_APPROVED"
            tx.updated_by = current_user.id
            tx.updated_at = now2

    try:
        db.commit()
        db.refresh(tx)
    except Exception:
        logger.exception("[transactions] Commit failed during submit_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")
    
    return {
        "id": tx.id,
        "amount": tx.amount,
        "status": tx.status,
        "proof_reference": tx.proof_reference,
        "validated_at": tx.validated_at,
        "created_at": tx.created_at,
        "recorded_by_id": tx.recorded_by_id,
        "users_id": tx.users_id,
        "updated_by": tx.updated_by,
        "payment_methods_id": tx.payment_methods_id,
        "transaction_type": tx.transaction_type,
        "updated_at": tx.updated_at,
        "issubmitted": int(1 if tx.issubmitted else 0),
    }


@router.post("/transactions/{tx_id}/reject")
async def reject_transaction(
    tx_id: int,
    body: TransactionReject,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Reject a transaction."""
    tx = db.query(Transactions).filter(Transactions.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Identify user role suitable for this transaction type
    user_roles_list = await get_user_roles(db, current_user.id) or []
    user_roles = set(r.lower() for r in user_roles_list)
    tx_type = (tx.transaction_type or "").upper()

    rec_role = None
    allowed = False

    if tx_type == "EXPENSE":
        if "board" in user_roles:
            rec_role, allowed = "board", True
        elif "admin" in user_roles:
            rec_role, allowed = "board", True  # Admin acts as board
    elif tx_type in ("CONTRIBUTION", "DONATIONS"):
        if "treasury" in user_roles:
            rec_role, allowed = "treasury", True
        elif "admin" in user_roles:
            rec_role, allowed = "treasury", True  # Admin acts as treasury
    else:
        # Fallback or other types if exist
        if "admin" in user_roles:
            rec_role, allowed = "admin", True

    if not allowed or not rec_role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    now = datetime.now()

    # 1. Archive the rejection note in transaction_approvals (even though it's a rejection)
    # The requirement is explicit: "stocker cette note dans transaction_approvals.note"
    # We use the determined role.
    if body.reason:
        db.add(
            TransactionApprovals(
                role_at_approval=rec_role,
                approved_at=now,
                note=f"REJETÉ: {body.reason}",
                transactions_id=tx_id,
                users_id=current_user.id,
            )
        )

    # 2. Update status to REJECTED
    try:
        tx.status = "REJECTED"
        tx.updated_by = current_user.id
        tx.updated_at = now
        db.commit()
        db.refresh(tx)
    except Exception:
        logger.exception("[transactions] Commit failed during reject_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")

    return {
        "id": tx.id,
        "amount": tx.amount,
        "status": tx.status,
        "proof_reference": tx.proof_reference,
        "validated_at": tx.validated_at,
        "created_at": tx.created_at,
        "recorded_by_id": tx.recorded_by_id,
        "users_id": tx.users_id,
        "updated_by": tx.updated_by,
        "payment_methods_id": tx.payment_methods_id,
        "transaction_type": tx.transaction_type,
        "updated_at": tx.updated_at,
        "issubmitted": int(1 if tx.issubmitted else 0),
    }


@router.post("/transactions/bulk-submit")
async def bulk_submit_transactions(
    body: TransactionBulkSubmit,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Submit multiple SAVED transactions."""
    ids = body.transaction_ids
    if not ids:
        return {"count": 0}

    is_admin = "admin" in (await get_user_roles(db, current_user.id))
    rows = db.query(Transactions).filter(Transactions.id.in_(ids)).all()
    valid_ids = []
    for tx in rows:
        if tx.status != "SAVED":
            continue
        if int(tx.recorded_by_id) != int(current_user.id) and not is_admin:
            continue
        valid_ids.append(tx.id)

    if not valid_ids:
        return {"count": 0}

    try:
        now = datetime.now()
        for tx in rows:
            if tx.id in valid_ids:
                tx.status = "PENDING"
                tx.issubmitted = True
                tx.updated_at = now
                tx.updated_by = current_user.id
    except Exception:
        logger.exception("[transactions] Commit failed during bulk_submit_transactions")
        raise HTTPException(status_code=500, detail="Database commit failed")

    await notify_treasurers_new_transaction(db, current_user.id, count=len(valid_ids))
    
    try:
        db.commit()
        db.refresh(tx)
    except Exception:
        logger.exception("[transactions] Commit failed during bulk_submit_transactions")
        raise HTTPException(status_code=500, detail="Database commit failed")
    
    return {"count": len(valid_ids)}


@router.post("/transactions/bulk-approve")
async def bulk_approve_transactions(
    body: TransactionBulkApprove,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Bulk approve transactions."""
    ids = body.transaction_ids
    if not ids:
        return {"count": 0, "validated": 0}

    validated_ids = []
    processed_count = 0

    user_roles_list = await get_user_roles(db, current_user.id) or []
    user_roles = set(r.lower() for r in user_roles_list)

    # Cache board count
    row_board = (
        db.query(func.count(func.distinct(RoleAttribution.users_id)).label("total"))
        .join(Roles, Roles.id == RoleAttribution.roles_id)
        .filter(Roles.role == "board")
        .first()
    )
    total_board = row_board.total if row_board else 0

    for tx_id in ids:
        tx = db.query(Transactions).filter(Transactions.id == tx_id).first()
        if not tx:
            continue

        if tx.status not in ("PENDING", "PARTIALLY_APPROVED"):
            continue

        tx_type = (tx.transaction_type or "").upper()

        # Access control
        rec_role = None
        allowed = False
        if tx_type == "EXPENSE":
            if "board" in user_roles:
                rec_role, allowed = "board", True
            elif "admin" in user_roles:
                rec_role, allowed = "admin", True
        elif tx_type in ("CONTRIBUTION", "DONATIONS"):
            if "treasury" in user_roles:
                rec_role, allowed = "treasury", True
            elif "admin" in user_roles:
                rec_role, allowed = "admin", True
        else:
            if "admin" in user_roles:
                rec_role, allowed = "admin", True

        if not allowed or not rec_role:
            continue

        # Duplicate check
        row_dup = (
            db.query(TransactionApprovals)
            .filter(TransactionApprovals.transactions_id == tx_id)
            .filter(TransactionApprovals.users_id == current_user.id)
            .first()
        )
        if row_dup:
            continue

        # Insert approval
        now = datetime.now()
        db.add(
            TransactionApprovals(
                role_at_approval=rec_role,
                approved_at=now,
                note=body.note,
                transactions_id=tx_id,
                users_id=current_user.id,
            )
        )
        # Flush to ensure counts include this approval
        try:
            db.flush()
        except Exception:
            logger.exception("[transactions] Flush failed during bulk_approve_transactions")
            raise HTTPException(status_code=500, detail="Database flush failed")
        processed_count += 1

        # Check threshold
        cnt = (
            db.query(TransactionApprovals.users_id)
            .filter(TransactionApprovals.transactions_id == tx_id)
            .distinct()
            .count()
        )

        validated = False

        if tx_type == "EXPENSE":
            if total_board > 0 and cnt >= total_board:
                validated = True
        elif tx_type in ("CONTRIBUTION", "DONATIONS"):
            if cnt >= 2:
                validated = True

        if validated:
            tx.status = "VALIDATED"
            tx.validated_at = now
            tx.updated_by = current_user.id
            tx.updated_at = now
            validated_ids.append(tx_id)
        else:
            tx.status = "PARTIALLY_APPROVED"
            tx.updated_by = current_user.id
            tx.updated_at = now

    if validated_ids:
        try:
            await notify_transactions_validated(db, validated_ids)
        except Exception:
            logger.exception("[transactions] Notification failed during bulk_approve_transactions")
            raise HTTPException(status_code=500, detail="Notification failed")

    try:
        db.commit()
        db.refresh(tx)
    except Exception:
        logger.exception(
            "[transactions] Commit failed during update_transaction_status"
        )
        raise HTTPException(status_code=500, detail="Database commit failed")

    return {"processed": processed_count, "validated": len(validated_ids)}


@router.delete("/transactions/{tx_id}")
async def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Delete a transaction. Restricted to elevated roles. Only PENDING or SAVED transactions can be deleted.
    Also deletes any related approvals to satisfy FK constraints.
    """
    roles = await get_user_roles(db, current_user.id)
    lowered = set(roles)
    if not (
        "admin" in lowered
        or "admingroup" in lowered
        or "treasury" in lowered
        or "board" in lowered
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    tx = db.query(Transactions).filter(Transactions.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if tx.status not in ("PENDING", "SAVED"):
        raise HTTPException(
            status_code=400, detail="Only PENDING or SAVED transactions can be deleted"
        )

    # Restrict admingroup to assigned users (or self)
    roles_set = set(await get_user_roles(db, current_user.id))
    is_admin = "admin" in roles_set
    is_treasury = "treasury" in roles_set
    is_board = "board" in roles_set
    is_group_admin = "admingroup" in roles_set
    if is_group_admin and not (is_admin or is_treasury or is_board):
        if tx.users_id != int(current_user.id):
            row = (
                db.query(FamilyAssignation)
                .filter(FamilyAssignation.users_responsable_id == current_user.id)
                .filter(FamilyAssignation.users_assigned_id == tx.users_id)
                .first()
            )
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                )

    proof_ref = tx.proof_reference

    # Delete approvals first
    db.query(TransactionApprovals).filter(
        TransactionApprovals.transactions_id == tx_id
    ).delete(synchronize_session=False)
    # Delete transaction
    db.delete(tx)

    # Attempt to delete proof image if it exists
    if proof_ref and (
        str(proof_ref).startswith("http://") or str(proof_ref).startswith("https://")
    ):
        try:
            aws = AwsFile(settings)
            aws.delete_image(proof_ref)
        except Exception:
            logger.warning(
                f"Failed to delete proof image for transaction {tx_id}", exc_info=True
            )
    
    try:
        db.commit()
        db.refresh(tx)
    except Exception:
        logger.exception("[transactions] Commit failed during delete_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")

    return {"status": "deleted"}


# -----------------------------
# Transaction approvals
# -----------------------------


@router.get("/transactions/{tx_id}/approvals")
async def list_transaction_approvals(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """List approvals for a given transaction."""
    rows = (
        db.query(TransactionApprovals, Users.username.label("approved_by_username"))
        .join(Users, Users.id == TransactionApprovals.users_id)
        .filter(TransactionApprovals.transactions_id == tx_id)
        .order_by(TransactionApprovals.approved_at.desc())
        .all()
    )
    out = []
    for ta, uname in rows:
        out.append(
            {
                "id": ta.id,
                "role_at_approval": ta.role_at_approval,
                "approved_at": ta.approved_at,
                "note": ta.note,
                "transactions_id": ta.transactions_id,
                "users_id": ta.users_id,
                "approved_by_username": uname,
            }
        )
    return out


@router.post("/transactions/{tx_id}/approvals")
async def approve_transaction(
    tx_id: int,
    body: TransactionApprovalCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Approve a transaction.
    Rules:
    - Contribution/Donations: Treasury (or Admin) can approve. Validation requires 2 approvals.
    - Expense: Board (or Admin) can approve. Validation requires ALL board members.
    """
    tx = db.query(Transactions).filter(Transactions.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Check status
    if tx.status not in ("PENDING", "PARTIALLY_APPROVED"):
        raise HTTPException(
            status_code=400, detail="Transaction cannot be approved in current status"
        )

    # Determine user roles
    user_roles_list = await get_user_roles(db, current_user.id) or []
    user_roles = set(r.lower() for r in user_roles_list)

    tx_type = (tx.transaction_type or "").upper()  # CONTRIBUTION, DONATIONS, EXPENSE

    # 1. Access Control & Role Selection
    rec_role = None

    if tx_type == "EXPENSE":
        allowed = False
        if "board" in user_roles:
            rec_role = "board"
            allowed = True
        elif "admin" in user_roles:
            rec_role = "admin"
            allowed = True

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Board members can approve expenses",
            )

    elif tx_type in ("CONTRIBUTION", "DONATIONS"):
        allowed = False
        if "treasury" in user_roles:
            rec_role = "treasury"
            allowed = True
        elif "admin" in user_roles:
            rec_role = "admin"
            allowed = True

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Treasury members can approve contributions/donations",
            )
    else:
        if "admin" in user_roles:
            rec_role = "admin"
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden transaction type",
            )

    # 2. Duplicate Check
    if (
        db.query(TransactionApprovals)
        .filter(TransactionApprovals.transactions_id == tx_id)
        .filter(TransactionApprovals.users_id == current_user.id)
        .first()
    ):
        raise HTTPException(
            status_code=409, detail="You have already approved this transaction"
        )

    now = datetime.now()
    db.add(
        TransactionApprovals(
            role_at_approval=rec_role,
            approved_at=now,
            note=body.note,
            transactions_id=tx_id,
            users_id=current_user.id,
        )
    )
    # Ensure the new approval is flushed so the subsequent count includes it
    try:
        db.flush()
    except Exception:
        raise HTTPException(status_code=500, detail="Database flush failed")

    # 3. Check Validation Threshold
    cnt = (
        db.query(TransactionApprovals.users_id)
        .filter(TransactionApprovals.transactions_id == tx_id)
        .distinct()
        .count()
    )

    validated = False

    if tx_type == "EXPENSE":
        # Get total board members
        row_board = (
            db.query(func.count(func.distinct(RoleAttribution.users_id)).label("total"))
            .join(Roles, Roles.id == RoleAttribution.roles_id)
            .filter(Roles.role == "board")
            .first()
        )
        total_board = row_board.total if row_board else 0

        if total_board > 0 and cnt >= total_board:
            validated = True

    elif tx_type in ("CONTRIBUTION", "DONATIONS"):
        if cnt >= 2:
            validated = True

    if validated:
        tx.status = "VALIDATED"
        tx.validated_at = now
        tx.updated_by = current_user.id
        tx.updated_at = now
    else:
        tx.status = "PARTIALLY_APPROVED"
        tx.updated_by = current_user.id
        tx.updated_at = now

    if validated:
        try:
            await notify_transactions_validated(db, [tx_id])
        except Exception as e:
            logger.warning(f"Failed to notify validation: {e}")

    try:
        db.commit()
        db.refresh(tx)
    except Exception:
        logger.exception("[transactions] Commit failed during approve_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")

    return {
        "transaction": {
            "id": tx.id,
            "amount": tx.amount,
            "status": tx.status,
            "proof_reference": tx.proof_reference,
            "validated_at": tx.validated_at,
            "created_at": tx.created_at,
            "recorded_by_id": tx.recorded_by_id,
            "users_id": tx.users_id,
            "updated_by": tx.updated_by,
            "payment_methods_id": tx.payment_methods_id,
            "transaction_type": tx.transaction_type,
            "updated_at": tx.updated_at,
            "issubmitted": int(1 if tx.issubmitted else 0),
        },
        "approver_role": rec_role,
    }
