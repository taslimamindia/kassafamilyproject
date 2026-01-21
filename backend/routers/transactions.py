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
from dependencies import get_cursor, get_current_user, has_role, get_user_roles
from settings import settings
from aws_file import AwsFile
import uuid
from utils import send_notification


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


async def notify_transactions_validated(cursor, tx_ids: List[int]):
    if not tx_ids:
        return

    placeholders = ",".join(["%s"] * len(tx_ids))
    
    # Fetch details: id, users_id, recorded_by_id
    query = f"""
        SELECT t.id, t.users_id, t.recorded_by_id
        FROM transactions t
        WHERE t.id IN ({placeholders})
    """
    await cursor.execute(query, tuple(tx_ids))
    rows = await cursor.fetchall()
    
    # Map user_id -> { as_owner: count, as_creator: count }
    # optimizing to just counts to avoid huge messages list, generic message is better for bulk
    notifications = {} 

    for r in rows:
        tid = r["id"] if isinstance(r, dict) else r[0]
        uid = r["users_id"] if isinstance(r, dict) else r[2]
        rid = r["recorded_by_id"] if isinstance(r, dict) else r[3]
        
        # Check eligibility for owner
        if uid not in notifications: notifications[uid] = {"owner_cnt": 0, "creator_cnt": 0}
        notifications[uid]["owner_cnt"] += 1
        
        # Check eligibility for creator (if different)
        if rid != uid:
            if rid not in notifications: notifications[rid] = {"owner_cnt": 0, "creator_cnt": 0}
            notifications[rid]["creator_cnt"] += 1

    all_user_ids = list(notifications.keys())
    if not all_user_ids:
        return

    placeholders_u = ",".join(["%s"] * len(all_user_ids))
    
    # Check isactive=1 and role='member'
    check_sql = f"""
        SELECT DISTINCT u.id
        FROM users u
        JOIN role_attribution ra ON ra.users_id = u.id
        JOIN roles r ON r.id = ra.roles_id
        WHERE u.id IN ({placeholders_u})
          AND u.isactive = 1
          AND r.role = 'member'
    """
    await cursor.execute(check_sql, tuple(all_user_ids))
    valid_rows = await cursor.fetchall()
    valid_ids = set(r["id"] if isinstance(r, dict) else r[0] for r in valid_rows)

    # Send messages
    for uid, data in notifications.items():
        if uid not in valid_ids:
            continue
        
        parts = []
        oc = data["owner_cnt"]
        cc = data["creator_cnt"]

        if oc > 0:
            parts.append(f"{'Vos transactions' if oc > 1 else 'Votre transaction'} ({oc}) {'ont' if oc > 1 else 'a'} été validée{'s' if oc > 1 else ''}.")
        if cc > 0:
            parts.append(f"{'Les transactions' if cc > 1 else 'La transaction'} ({cc}) que vous avez initiée{'s' if cc > 1 else ''} {'ont' if cc > 1 else 'a'} été validée{'s' if cc > 1 else ''}.")

        if parts:
            msg = " ".join(parts)
            # Use sender_id=None (System) or maybe the treasurer who triggered it? 
            # But in bulk there might be multiple approvers over time, this is the final validation event.
            # We'll use None or 1.
            await send_notification(cursor, [uid], msg, link="/transactions")


async def notify_treasurers_new_transaction(cursor, sender_id: int, count: int = 1):
    """
    Sends a notification to all users with 'treasury' role
    that a new transaction is pending validation.
    """
    # Fetch sender details
    await cursor.execute(
        "SELECT firstname, lastname FROM users WHERE id = %s", (sender_id,)
    )
    sender = await cursor.fetchone()
    sender_name = "Utilisateur Inconnu"
    if sender:
        fn = sender.get("firstname") or ""
        ln = sender.get("lastname") or ""
        sender_name = f"{fn} {ln}".strip() or sender_name

    await cursor.execute(
        """
        SELECT DISTINCT ra.users_id 
        FROM role_attribution ra
        JOIN roles r ON r.id = ra.roles_id
        WHERE r.role = 'treasury'
    """
    )
    rows = await cursor.fetchall()
    treasurer_ids = [r["users_id"] if isinstance(r, dict) else r[0] for r in rows]

    if not treasurer_ids:
        return

    msg_text = f"{sender_name} vous a soumis {'une transaction' if count == 1 else f'{count} transactions'} à valider"
    
    await send_notification(cursor, treasurer_ids, msg_text, sender_id=sender_id, link="/approvals")


# -----------------------------
# Payment Methods endpoints
# -----------------------------


@router.get("/payment-methods")
async def list_payment_methods(
    active: Optional[bool] = Query(None, description="Filter active methods"),
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """List payment methods. Optionally filter by active state."""
    where = []
    vals: List[object] = []
    if active is not None:
        where.append("isactive = %s")
        vals.append(1 if active else 0)
    # Restrict to allowed names only
    name_placeholders = ", ".join(["%s"] * len(ALLOWED_PAYMENT_METHODS))
    where.append(f"name IN ({name_placeholders})")
    vals.extend(ALLOWED_PAYMENT_METHODS)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    await cursor.execute(
        f"SELECT id, name, type_of_proof, isactive, created_at, updated_at FROM payment_methods {clause} ORDER BY name",
        tuple(vals),
    )
    return await cursor.fetchall()


@router.post("/payment-methods")
async def create_payment_method(
    body: PaymentMethodCreate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Create a new payment method. Admin-only."""
    if not await has_role(cursor, current_user["id"], "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Enforce unique name and allowed set at application level
    await cursor.execute("SELECT id FROM payment_methods WHERE name = %s", (body.name,))
    if await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment method name already exists",
        )

    now = datetime.now()
    await cursor.execute(
        """
		INSERT INTO payment_methods (name, type_of_proof, isactive, created_at, updated_at)
		VALUES (%s, %s, %s, %s, %s)
		""",
        (
            body.name,
            body.type_of_proof,
            body.isactive if body.isactive is not None else 1,
            now,
            now,
        ),
    )
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[transactions] Commit failed during create_payment_method")
        raise HTTPException(status_code=500, detail="Database commit failed")

    new_id = cursor.lastrowid
    await cursor.execute("SELECT * FROM payment_methods WHERE id = %s", (new_id,))
    return await cursor.fetchone()


@router.patch("/payment-methods/{pm_id}")
async def update_payment_method(
    pm_id: int,
    body: PaymentMethodUpdate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Update a payment method. Admin-only."""
    if not await has_role(cursor, current_user["id"], "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Exists?
    await cursor.execute("SELECT * FROM payment_methods WHERE id = %s", (pm_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Payment method not found")

    fields = []
    vals: List[object] = []
    if body.name is not None:
        # Check uniqueness
        await cursor.execute(
            "SELECT id FROM payment_methods WHERE name = %s AND id != %s",
            (body.name, pm_id),
        )
        if await cursor.fetchone():
            raise HTTPException(
                status_code=409, detail="Payment method name already exists"
            )
        fields.append("name = %s")
        vals.append(body.name)
    if body.isactive is not None:
        fields.append("isactive = %s")
        vals.append(body.isactive)
    if body.type_of_proof is not None:
        fields.append("type_of_proof = %s")
        vals.append(body.type_of_proof)
    fields.append("updated_at = %s")
    vals.append(datetime.now())

    if not fields:
        await cursor.execute("SELECT * FROM payment_methods WHERE id = %s", (pm_id,))
        return await cursor.fetchone()

    sql = f"UPDATE payment_methods SET {', '.join(fields)} WHERE id = %s"
    vals.append(pm_id)
    await cursor.execute(sql, tuple(vals))
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[transactions] Commit failed during update_payment_method")
        raise HTTPException(status_code=500, detail="Database commit failed")
    await cursor.execute("SELECT * FROM payment_methods WHERE id = %s", (pm_id,))
    return await cursor.fetchone()


# -----------------------------
# Transactions endpoints
# -----------------------------


@router.get("/transactions")
async def list_transactions(
    request: Request,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """List transactions with optional filters via query params."""
    qp = request.query_params
    where: List[str] = []
    vals: List[object] = []

    status_q = (qp.get("status") or "").strip().upper()
    if status_q in {"PENDING", "PARTIALLY_APPROVED", "VALIDATED", "REJECTED", "SAVED"}:
        where.append("t.status = %s")
        vals.append(status_q)

    for key in ("users_id", "recorded_by_id", "payment_methods_id"):
        if qp.get(key):
            where.append(f"t.{key} = %s")
            vals.append(int(qp.get(key)))

    ttype = (qp.get("transaction_type") or "").strip().upper()
    if ttype in {"CONTRIBUTION", "DONATIONS", "EXPENSE"}:
        where.append("t.transaction_type = %s")
        vals.append(ttype)

    date_from = qp.get("date_from")
    date_to = qp.get("date_to")
    if date_from:
        where.append("t.created_at >= %s")
        vals.append(date_from)
    if date_to:
        where.append("t.created_at <= %s")
        vals.append(date_to)

    # Role-based access
    roles = await get_user_roles(cursor, current_user["id"]) or []
    lowered = [r.lower() for r in roles]
    is_admin = "admin" in lowered
    is_treasury = "treasury" in lowered
    is_group_admin = "admingroup" in lowered
    if not (is_admin or is_treasury or is_group_admin):
        # Regular members: only their own transactions
        where.append("t.users_id = %s")
        vals.append(current_user["id"])
    elif is_group_admin and not (is_admin or is_treasury):
        # Group admin: only for assigned users (plus self)
        where.append(
            "(t.users_id = %s OR t.users_id IN (SELECT users_assigned_id FROM family_assignation WHERE users_responsable_id = %s))"
        )
        vals.extend([current_user["id"], current_user["id"]])

    clause = ("WHERE " + " AND ".join(where)) if where else ""
    sql = f"""
		SELECT t.*, 
            u.username AS user_username, u.firstname AS user_firstname, u.lastname AS user_lastname, u.image_url AS user_image_url,
            rb.username AS recorded_by_username, rb.firstname AS recorded_by_firstname, rb.lastname AS recorded_by_lastname,
			pm.name AS payment_method_name
		FROM transactions t
		JOIN users u ON u.id = t.users_id
		JOIN users rb ON rb.id = t.recorded_by_id
		JOIN payment_methods pm ON pm.id = t.payment_methods_id
		{clause}
		ORDER BY t.created_at DESC
	"""
    await cursor.execute(sql, tuple(vals))
    transactions = await cursor.fetchall()

    if transactions:
        # Fetch approvals for these transactions
        tx_ids = [t["id"] for t in transactions]
        # Depending on list size, IN clause might optionally need chunking, but for now assuming reasonable page size
        format_strings = ",".join(["%s"] * len(tx_ids))
        await cursor.execute(
            f"""
            SELECT ta.*, u.username as approved_by_username, u.firstname as approved_by_firstname, u.lastname as approved_by_lastname
            FROM transaction_approvals ta
            JOIN users u ON u.id = ta.users_id
            WHERE ta.transactions_id IN ({format_strings})
            ORDER BY ta.approved_at ASC
            """,
            tuple(tx_ids),
        )
        all_approvals = await cursor.fetchall()

        # Map approvals to transactions
        approval_map = {}
        for app in all_approvals:
            tid = app["transactions_id"]
            if tid not in approval_map:
                approval_map[tid] = []
            approval_map[tid].append(app)

        for tx in transactions:
            tx["approvals"] = approval_map.get(tx["id"], [])

    return transactions


@router.post("/transactions")
async def create_transaction(
    body: TransactionCreate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Create a transaction. Restricted to admin and group admin. Additional rule: only 'board' or 'treasury' can create EXPENSE."""
    if not (
        await has_role(cursor, current_user["id"], "member")
        or await has_role(cursor, current_user["id"], "admin")
        or await has_role(cursor, current_user["id"], "admingroup")
        or await has_role(cursor, current_user["id"], "treasury")
        or await has_role(cursor, current_user["id"], "board")
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Validate foreign keys
    await cursor.execute("SELECT id FROM users WHERE id = %s", (body.users_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="User not found")
    await cursor.execute(
        "SELECT id FROM payment_methods WHERE id = %s AND isactive = 1",
        (body.payment_methods_id,),
    )
    pm_row = await cursor.fetchone()
    if not pm_row:
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
        if not (
            await has_role(cursor, current_user["id"], "board")
            or await has_role(cursor, current_user["id"], "treasury")
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only board or treasury can create EXPENSE transactions",
            )

    # Additional rule: if creating for another user, must be treasury or admingroup
    # A simple member can only create a transaction for themselves
    if int(body.users_id) != int(current_user["id"]):
        is_treasury = await has_role(cursor, current_user["id"], "treasury")
        if is_treasury:
            pass
        else:
            is_group_admin = await has_role(cursor, current_user["id"], "admingroup")
            if not is_group_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only treasury or admingroup can create transactions for another user",
                )
            # For admingroup, target user must be assigned to them
            await cursor.execute(
                "SELECT 1 FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id = %s",
                (current_user["id"], body.users_id),
            )
            if not await cursor.fetchone():
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
        current_user["id"],  # recorded_by_id
        body.users_id,
        current_user["id"],  # updated_by
        body.payment_methods_id,
        body.transaction_type,
        now,  # updated_at
        body.issubmitted or 0,
    )

    await cursor.execute(
        """
        INSERT INTO transactions (
            amount, status, proof_reference, validated_at, created_at,
            recorded_by_id, users_id, updated_by, payment_methods_id,
            transaction_type, updated_at, issubmitted
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        params,
    )

    if (body.issubmitted or 0) == 1:
        await notify_treasurers_new_transaction(cursor, current_user["id"])

        # Auto-approval for treasury if creating a CONTRIBUTION/DONATIONS
        user_roles = await get_user_roles(cursor, current_user["id"]) or []
        lowered_roles = [r.lower() for r in user_roles]
        if "treasury" in lowered_roles and body.transaction_type.upper() in (
            "CONTRIBUTION",
            "DONATIONS",
        ):
            now = datetime.now()
            # Insert approval
            await cursor.execute(
                """
                INSERT INTO transaction_approvals (role_at_approval, approved_at, note, transactions_id, users_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    "treasury",
                    now,
                    "Auto-approval on creation",
                    new_id,
                    current_user["id"],
                ),
            )
            # Update status to PARTIALLY_APPROVED
            # (Assume < 2 total since it's just created, unless user is somehow double-role but creator is singular)
            await cursor.execute(
                "UPDATE transactions SET status = 'PARTIALLY_APPROVED', updated_by = %s, updated_at = %s WHERE id = %s",
                (current_user["id"], now, new_id),
            )

    try:
        await cursor.commit()
    except Exception:
        logger.exception("[transactions] Commit failed during create_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")
    new_id = cursor.lastrowid
    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (new_id,))
    return await cursor.fetchone()


@router.post("/transactions/proof-upload")
async def upload_transaction_proof(
    file: UploadFile = File(...),
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Upload an image proof to S3 under the 'transactions' folder.
    The file will be named using the next id from `transactions`:
    `transaction_{next_id}` to ensure the image name matches the eventual transaction id.
    Returns the public URL and the S3 key.
    """
    # Require elevated role to upload proofs (same as creating transactions)
    if not (
        await has_role(cursor, current_user["id"], "admin")
        or await has_role(cursor, current_user["id"], "admingroup")
        or await has_role(cursor, current_user["id"], "treasury")
        or await has_role(cursor, current_user["id"], "board")
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Determine next id from transactions for deterministic file naming
    await cursor.execute("SELECT IFNULL(MAX(id), 0) + 1 AS next_id FROM transactions")
    row = await cursor.fetchone()
    if isinstance(row, dict):
        next_id = int(row.get("next_id") or 1)
    else:
        next_id = int(row[0] if row and len(row) > 0 else 1)

    aws = AwsFile(settings)
    try:
        # Determine filename: transactions/transaction_{next_id}
        filename = f"transaction_{next_id}"
        result = aws.add_image(file, folder="transactions", filename=filename)
        return {"url": result.get("url"), "key": result.get("key")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/transactions/proof-delete")
async def delete_transaction_proof(
    url: str = Query(..., description="S3 URL to delete"),
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Delete a proof image from S3."""
    if not (
        await has_role(cursor, current_user["id"], "admin")
        or await has_role(cursor, current_user["id"], "admingroup")
        or await has_role(cursor, current_user["id"], "treasury")
        or await has_role(cursor, current_user["id"], "board")
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
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Set the proof URL for a transaction. Requires elevated roles (same as upload)."""
    if not (
        await has_role(cursor, current_user["id"], "admin")
        or await has_role(cursor, current_user["id"], "admingroup")
        or await has_role(cursor, current_user["id"], "treasury")
        or await has_role(cursor, current_user["id"], "board")
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    await cursor.execute("SELECT id FROM transactions WHERE id = %s", (tx_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Transaction not found")

    now = datetime.now()
    await cursor.execute(
        "UPDATE transactions SET proof_reference = %s, updated_by = %s, updated_at = %s WHERE id = %s",
        (body.url, current_user["id"], now, tx_id),
    )
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[transactions] Commit failed during set_transaction_proof")
        raise HTTPException(status_code=500, detail="Database commit failed")
    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
    return await cursor.fetchone()


@router.patch("/transactions/{tx_id}")
async def update_transaction(
    tx_id: int,
    body: TransactionUpdate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Update transaction core fields: amount, payment method, type, proof_reference.
    Permissions:
    - The user who recorded (created) the transaction can edit when status == SAVED.
    - If the user has 'treasury' role and recorded the transaction, they can edit when status in (SAVED, PENDING).
    - Changing type to EXPENSE requires 'board' or 'treasury' role.
    Member (users_id) cannot be changed via this endpoint.
    """
    # Fetch transaction
    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
    tx = await cursor.fetchone()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Determine permissions
    recorded_by_id = int(tx["recorded_by_id"]) if isinstance(tx, dict) else int(tx[5])
    status_val = tx["status"] if isinstance(tx, dict) else tx[1]
    is_me_recorder = recorded_by_id == int(current_user["id"])
    user_roles = await get_user_roles(cursor, current_user["id"]) or []
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
            amt = float(body.amount)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid amount")
        fields.append("amount = %s")
        vals.append(amt)

    if body.payment_methods_id is not None:
        pm_id = int(body.payment_methods_id)
        await cursor.execute(
            "SELECT id, isactive FROM payment_methods WHERE id = %s",
            (pm_id,),
        )
        pm = await cursor.fetchone()
        if not pm or (pm.get("isactive") if isinstance(pm, dict) else pm[1]) != 1:
            raise HTTPException(status_code=400, detail="Invalid or inactive payment method")
        fields.append("payment_methods_id = %s")
        vals.append(pm_id)

    if body.transaction_type is not None:
        tt = body.transaction_type.strip().upper()
        if tt == "EXPENSE" and not ("board" in lowered or "treasury" in lowered):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only board or treasury can set EXPENSE",
            )
        fields.append("transaction_type = %s")
        vals.append(tt)

    if body.proof_reference is not None:
        pr = (body.proof_reference or "").strip()
        if not pr:
            raise HTTPException(status_code=400, detail="Proof reference cannot be empty")
        fields.append("proof_reference = %s")
        vals.append(pr)

    # Always update metadata
    fields.append("updated_by = %s")
    vals.append(current_user["id"])
    fields.append("updated_at = %s")
    vals.append(datetime.now())

    if not [f for f in fields if not f.startswith("updated_")]:
        # Nothing to update besides metadata
        await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
        return await cursor.fetchone()

    sql = f"UPDATE transactions SET {', '.join(fields)} WHERE id = %s"
    vals.append(tx_id)
    await cursor.execute(sql, tuple(vals))
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[transactions] Commit failed during update_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")

    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
    return await cursor.fetchone()


@router.patch("/transactions/{tx_id}/status")
async def update_transaction_status(
    tx_id: int,
    body: TransactionStatusUpdate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Update a transaction status. Restricted to treasury only."""
    if not await has_role(cursor, current_user["id"], "treasury"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Transaction not found")

    fields = ["status = %s", "updated_by = %s", "updated_at = %s"]
    vals: List[object] = [body.status, current_user["id"], datetime.now()]
    if body.status == "VALIDATED":
        fields.append("validated_at = %s")
        vals.append(datetime.now())

    sql = f"UPDATE transactions SET {', '.join(fields)} WHERE id = %s"
    vals.append(tx_id)
    await cursor.execute(sql, tuple(vals))

    if body.status == "PENDING":
        await notify_treasurers_new_transaction(cursor, current_user["id"])

    try:
        await cursor.commit()
    except Exception:
        logger.exception(
            "[transactions] Commit failed during update_transaction_status"
        )
        raise HTTPException(status_code=500, detail="Database commit failed")

    if body.status == "VALIDATED":
        try:
            await notify_transactions_validated(cursor, [tx_id])
        except Exception as e:
            logger.warning(f"Failed to notify validation: {e}")

    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
    return await cursor.fetchone()


@router.get("/transactions/{tx_id}")
async def get_transaction_by_id(
    tx_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Fetch a single transaction by id."""
    await cursor.execute(
        """
		SELECT t.*, u.username AS user_username, rb.username AS recorded_by_username,
			pm.name AS payment_method_name, u.firstname AS user_firstname, u.lastname AS user_lastname
		FROM transactions t
		JOIN users u ON u.id = t.users_id
		JOIN users rb ON rb.id = t.recorded_by_id
		JOIN payment_methods pm ON pm.id = t.payment_methods_id
		WHERE t.id = %s
		""",
        (tx_id,),
    )
    tx = await cursor.fetchone()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    # Role-based access: admin/treasury any; admingroup only for assigned users (or self); members only self
    roles = await get_user_roles(cursor, current_user["id"]) or []
    lowered = [r.lower() for r in roles]
    is_admin = "admin" in lowered
    is_treasury = "treasury" in lowered
    is_group_admin = "admingroup" in lowered
    target_uid = int(tx.get("users_id"))
    if is_admin or is_treasury:
        return tx
    if is_group_admin:
        if target_uid == int(current_user["id"]):
            return tx
        await cursor.execute(
            "SELECT 1 FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id = %s",
            (current_user["id"], target_uid),
        )
        if not await cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
            )
        return tx
    # Regular member
    if target_uid != int(current_user["id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return tx
    return tx


@router.post("/transactions/{tx_id}/submit")
async def submit_transaction(
    tx_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Submit a SAVED transaction. Changes status to PENDING and issubmitted to 1."""
    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
    tx = await cursor.fetchone()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Only the creator or admin can submit?
    # Usually the person who recorded it.
    is_admin = await has_role(cursor, current_user["id"], "admin")
    if int(tx["recorded_by_id"]) != int(current_user["id"]) and not is_admin:
        raise HTTPException(
            status_code=403, detail="Not authorized to submit this transaction"
        )

    if tx["status"] != "SAVED":
        raise HTTPException(
            status_code=400, detail="Only SAVED transactions can be submitted"
        )

    now = datetime.now()
    await cursor.execute(
        "UPDATE transactions SET status = 'PENDING', issubmitted = 1, updated_at = %s, updated_by = %s WHERE id = %s",
        (now, current_user["id"], tx_id),
    )

    await notify_treasurers_new_transaction(cursor, current_user["id"])

    # Auto-approval for treasury if submitting a CONTRIBUTION/DONATIONS
    user_roles = await get_user_roles(cursor, current_user["id"]) or []
    lowered_roles = [r.lower() for r in user_roles]
    tx_type = (tx.get("transaction_type") or "").upper()
    if "treasury" in lowered_roles and tx_type in ("CONTRIBUTION", "DONATIONS"):
        # Check if already approved (unlikely if it was just SAVED, but possible if logic changes)
        await cursor.execute(
            "SELECT id FROM transaction_approvals WHERE transactions_id = %s AND users_id = %s",
            (tx_id, current_user["id"]),
        )
        if not await cursor.fetchone():
            now = datetime.now()
            await cursor.execute(
                """
                INSERT INTO transaction_approvals (role_at_approval, approved_at, note, transactions_id, users_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    "treasury",
                    now,
                    "Auto-approval on submission",
                    tx_id,
                    current_user["id"],
                ),
            )
            await cursor.execute(
                "UPDATE transactions SET status = 'PARTIALLY_APPROVED', updated_by = %s, updated_at = %s WHERE id = %s",
                (current_user["id"], now, tx_id),
            )

    try:
        await cursor.commit()
    except Exception:
        logger.exception("[transactions] Commit failed during submit_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")

    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
    return await cursor.fetchone()


@router.post("/transactions/bulk-submit")
async def bulk_submit_transactions(
    body: TransactionBulkSubmit,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Submit multiple SAVED transactions."""
    ids = body.transaction_ids
    if not ids:
        return {"count": 0}

    # Verify ownership or admin
    placeholders = ",".join(["%s"] * len(ids))
    await cursor.execute(f"SELECT id, recorded_by_id, status FROM transactions WHERE id IN ({placeholders})", tuple(ids))
    rows = await cursor.fetchall()

    valid_ids = []
    is_admin = await has_role(cursor, current_user["id"], "admin")
    
    for r in rows:
        tid = r["id"] if isinstance(r, dict) else r[0]
        rid = r["recorded_by_id"] if isinstance(r, dict) else r[1]
        st = r["status"] if isinstance(r, dict) else r[2]
        
        if st != 'SAVED': continue
        if int(rid) != int(current_user["id"]) and not is_admin: continue
        valid_ids.append(tid)

    if not valid_ids:
        return {"count": 0}

    now = datetime.now()
    p_valid = ",".join(["%s"] * len(valid_ids))
    update_sql = f"UPDATE transactions SET status = 'PENDING', issubmitted = 1, updated_at = %s, updated_by = %s WHERE id IN ({p_valid})"
    await cursor.execute(update_sql, (now, current_user["id"]) + tuple(valid_ids))
    await cursor.commit()

    await notify_treasurers_new_transaction(cursor, current_user["id"], count=len(valid_ids))
    
    return {"count": len(valid_ids)}


@router.post("/transactions/bulk-approve")
async def bulk_approve_transactions(
    body: TransactionBulkApprove,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Bulk approve transactions."""
    ids = body.transaction_ids
    if not ids: return {"count": 0, "validated": 0}
    
    validated_ids = []
    processed_count = 0
    
    user_roles_list = await get_user_roles(cursor, current_user["id"]) or []
    user_roles = set(r.lower() for r in user_roles_list)
    
    # Cache board count
    await cursor.execute(
        """
        SELECT COUNT(DISTINCT ra.users_id) as total 
        FROM role_attribution ra 
        JOIN roles r ON ra.roles_id = r.id
        WHERE r.role = 'board'
        """
    )
    row_board = await cursor.fetchone()
    total_board = row_board["total"] if row_board else 0

    for tx_id in ids:
        # Fetch tx
        await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
        tx = await cursor.fetchone()
        if not tx: continue
        
        if tx["status"] not in ("PENDING", "PARTIALLY_APPROVED"): continue
        
        tx_type = (tx["transaction_type"] or "").upper()
        
        # Access control
        rec_role = None
        allowed = False
        if tx_type == "EXPENSE":
            if "board" in user_roles: rec_role, allowed = "board", True
            elif "admin" in user_roles: rec_role, allowed = "admin", True
        elif tx_type in ("CONTRIBUTION", "DONATIONS"):
            if "treasury" in user_roles: rec_role, allowed = "treasury", True
            elif "admin" in user_roles: rec_role, allowed = "admin", True
        else:
            if "admin" in user_roles: rec_role = "admin", True
        
        if not allowed or not rec_role: continue

        # Duplicate check
        await cursor.execute("SELECT 1 FROM transaction_approvals WHERE transactions_id = %s AND users_id = %s", (tx_id, current_user["id"]))
        if await cursor.fetchone(): continue
        
        # Insert approval
        now = datetime.now()
        await cursor.execute(
            """INSERT INTO transaction_approvals (role_at_approval, approved_at, note, transactions_id, users_id)
               VALUES (%s, %s, %s, %s, %s)""",
            (rec_role, now, body.note, tx_id, current_user["id"])
        )
        processed_count += 1
        
        # Check threshold
        await cursor.execute(
            "SELECT COUNT(DISTINCT users_id) as cnt FROM transaction_approvals WHERE transactions_id = %s",
            (tx_id,),
        )
        row = await cursor.fetchone()
        cnt = row["cnt"] if row else 0

        validated = False

        if tx_type == "EXPENSE":
            if total_board > 0 and cnt >= total_board:
                validated = True
        elif tx_type in ("CONTRIBUTION", "DONATIONS"):
            if cnt >= 2:
                validated = True

        if validated:
            await cursor.execute(
                "UPDATE transactions SET status = %s, validated_at = %s, updated_by = %s, updated_at = %s WHERE id = %s",
                ("VALIDATED", now, current_user["id"], now, tx_id),
            )
            validated_ids.append(tx_id)
        else:
            await cursor.execute(
                "UPDATE transactions SET status = %s, updated_by = %s, updated_at = %s WHERE id = %s",
                ("PARTIALLY_APPROVED", current_user["id"], now, tx_id),
            )
        
    await cursor.commit()
    
    if validated_ids:
        try:
            await notify_transactions_validated(cursor, validated_ids)
        except Exception:
            pass
    
    return {"processed": processed_count, "validated": len(validated_ids)}


@router.delete("/transactions/{tx_id}")
async def delete_transaction(
    tx_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Delete a transaction. Restricted to elevated roles. Only PENDING or SAVED transactions can be deleted.
    Also deletes any related approvals to satisfy FK constraints.
    """
    if not (
        await has_role(cursor, current_user["id"], "admin")
        or await has_role(cursor, current_user["id"], "admingroup")
        or await has_role(cursor, current_user["id"], "treasury")
        or await has_role(cursor, current_user["id"], "board")
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    await cursor.execute(
        "SELECT status, proof_reference, users_id FROM transactions WHERE id = %s",
        (tx_id,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if isinstance(row, dict):
        status_val = row["status"]
        proof_ref = row.get("proof_reference")
        target_uid = int(row.get("users_id"))
    else:
        # Fallback for tuple cursor if any
        status_val = row[0]
        proof_ref = row[1] if len(row) > 1 else None
        target_uid = int(row[2]) if len(row) > 2 else None

    if status_val not in ("PENDING", "SAVED"):
        raise HTTPException(
            status_code=400, detail="Only PENDING or SAVED transactions can be deleted"
        )

    # Restrict admingroup to assigned users (or self)
    is_admin = await has_role(cursor, current_user["id"], "admin")
    is_treasury = await has_role(cursor, current_user["id"], "treasury")
    is_board = await has_role(cursor, current_user["id"], "board")
    is_group_admin = await has_role(cursor, current_user["id"], "admingroup")
    if is_group_admin and not (is_admin or is_treasury or is_board):
        if target_uid != int(current_user["id"]):
            await cursor.execute(
                "SELECT 1 FROM family_assignation WHERE users_responsable_id = %s AND users_assigned_id = %s",
                (current_user["id"], target_uid),
            )
            if not await cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                )

    # Delete approvals first (FK constraint NO ACTION)
    await cursor.execute(
        "DELETE FROM transaction_approvals WHERE transactions_id = %s",
        (tx_id,),
    )
    # Delete the transaction itself
    await cursor.execute("DELETE FROM transactions WHERE id = %s", (tx_id,))
    try:
        await cursor.commit()
    except Exception:
        logger.exception("[transactions] Commit failed during delete_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")

    # Attempt to delete proof image if it exists
    if proof_ref and (
        proof_ref.startswith("http://") or proof_ref.startswith("https://")
    ):
        try:
            aws = AwsFile(settings)
            aws.delete_image(proof_ref)
        except Exception:
            logger.warning(
                f"Failed to delete proof image for transaction {tx_id}", exc_info=True
            )

    return {"status": "deleted"}


# -----------------------------
# Transaction approvals
# -----------------------------


@router.get("/transactions/{tx_id}/approvals")
async def list_transaction_approvals(
    tx_id: int,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """List approvals for a given transaction."""
    await cursor.execute(
        """
		SELECT ta.* , u.username AS approved_by_username
		FROM transaction_approvals ta
		JOIN users u ON u.id = ta.users_id
		WHERE ta.transactions_id = %s
		ORDER BY ta.approved_at DESC
		""",
        (tx_id,),
    )
    return await cursor.fetchall()


@router.post("/transactions/{tx_id}/approvals")
async def approve_transaction(
    tx_id: int,
    body: TransactionApprovalCreate,
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    """Approve a transaction.
    Rules:
    - Contribution/Donations: Treasury (or Admin) can approve. Validation requires 2 approvals.
    - Expense: Board (or Admin) can approve. Validation requires ALL board members.
    """
    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
    tx = await cursor.fetchone()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Check status
    if tx["status"] not in ("PENDING", "PARTIALLY_APPROVED"):
        raise HTTPException(
            status_code=400, detail="Transaction cannot be approved in current status"
        )

    # Determine user roles
    user_roles_list = await get_user_roles(cursor, current_user["id"]) or []
    user_roles = set(r.lower() for r in user_roles_list)

    tx_type = (tx["transaction_type"] or "").upper()  # CONTRIBUTION, DONATIONS, EXPENSE

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
    await cursor.execute(
        "SELECT id FROM transaction_approvals WHERE transactions_id = %s AND users_id = %s",
        (tx_id, current_user["id"]),
    )
    if await cursor.fetchone():
        raise HTTPException(
            status_code=409, detail="You have already approved this transaction"
        )

    now = datetime.now()
    await cursor.execute(
        """
		INSERT INTO transaction_approvals (role_at_approval, approved_at, note, transactions_id, users_id)
		VALUES (%s, %s, %s, %s, %s)
		""",
        (rec_role, now, body.note, tx_id, current_user["id"]),
    )

    # 3. Check Validation Threshold
    await cursor.execute(
        "SELECT COUNT(DISTINCT users_id) as cnt FROM transaction_approvals WHERE transactions_id = %s",
        (tx_id,),
    )
    row = await cursor.fetchone()
    cnt = row["cnt"] if row else 0

    validated = False

    if tx_type == "EXPENSE":
        # "tous les membres du conseils d'administration"
        await cursor.execute(
            """
            SELECT COUNT(DISTINCT ra.users_id) as total 
            FROM role_attribution ra 
            JOIN roles r ON ra.roles_id = r.id
            WHERE r.role = 'board'
        """
        )
        row_board = await cursor.fetchone()
        total_board = row_board["total"] if row_board else 0

        if total_board > 0 and cnt >= total_board:
            validated = True

    elif tx_type in ("CONTRIBUTION", "DONATIONS"):
        # "c'est deux personnes"
        if cnt >= 2:
            validated = True

    if validated:
        await cursor.execute(
            "UPDATE transactions SET status = %s, validated_at = %s, updated_by = %s, updated_at = %s WHERE id = %s",
            ("VALIDATED", now, current_user["id"], now, tx_id),
        )
    else:
        await cursor.execute(
            "UPDATE transactions SET status = %s, updated_by = %s, updated_at = %s WHERE id = %s",
            ("PARTIALLY_APPROVED", current_user["id"], now, tx_id),
        )

    try:
        await cursor.commit()
    except Exception:
        logger.exception("[transactions] Commit failed during approve_transaction")
        raise HTTPException(status_code=500, detail="Database commit failed")

    if validated:
        try:
            await notify_transactions_validated(cursor, [tx_id])
        except Exception as e:
            logger.warning(f"Failed to notify validation: {e}")

    await cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
    return {
        "transaction": await cursor.fetchone(),
        "approver_role": rec_role,
    }
