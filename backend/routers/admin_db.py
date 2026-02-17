from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Dict, Any, Optional
import logging
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy import Table, MetaData
from sqlalchemy.engine import Result
from sqlalchemy import delete as sqla_delete
from sqlalchemy import desc
from sqlalchemy import inspect

from models_orm.dependencies import get_db, get_current_user, get_user_roles
from settings import settings
from aws_file import AwsFile

router = APIRouter()
logger = logging.getLogger("admin_db")


def _get_db_name(db: Session) -> Optional[str]:
    try:
        bind = db.get_bind()
        return getattr(getattr(bind, "url", None), "database", None)
    except Exception:
        return None


async def _ensure_admin(db: Session, current_user):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    roles = await get_user_roles(db, current_user.id)
    if "admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")


@router.get("/admin/db/tables")
async def list_tables(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    await _ensure_admin(db, current_user)
    insp = inspect(db.get_bind())
    table_names = sorted(insp.get_table_names())
    result = []
    metadata = MetaData()
    for name in table_names:
        try:
            tbl = Table(name, metadata, autoload_with=db.get_bind())
            cnt = db.execute(select(func.count()).select_from(tbl)).scalar()
            row_count = int(cnt or 0)
        except Exception:
            row_count = None
        result.append({"name": name, "rowCount": row_count})
    return result


@router.get("/admin/db/deletion-order")
async def deletion_order(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    await _ensure_admin(db, current_user)
    insp = inspect(db.get_bind())
    table_names = insp.get_table_names()
    # child -> parent edges
    edges = []
    for t in table_names:
        fks = insp.get_foreign_keys(t)
        for fk in fks:
            parent = fk.get("referred_table")
            child = t
            if parent:
                edges.append({"child": child, "parent": parent})

    children: Dict[str, List[str]] = {}
    parents: Dict[str, List[str]] = {}
    nodes: set[str] = set()
    for e in edges:
        c = e.get("child")
        p = e.get("parent")
        if not c or not p:
            continue
        nodes.add(c)
        nodes.add(p)
        children.setdefault(c, []).append(p)
        parents.setdefault(p, []).append(c)

    # Include tables with no FKs
    all_tables = table_names
    for t in all_tables:
        nodes.add(t)
        children.setdefault(t, [])
        parents.setdefault(t, [])

    # Topological sort: we want children (dependent tables) first
    indeg: Dict[str, int] = {n: 0 for n in nodes}
    for c, plist in children.items():
        for p in plist:
            indeg[p] = indeg.get(p, 0) + 1

    order: List[str] = []
    # Start with those that have zero in-degree (no other tables depend on them)
    q = [n for n, d in indeg.items() if d == 0]
    # tie-breaker by name for consistency
    q.sort()
    while q:
        n = q.pop(0)
        order.append(n)
        for child in parents.get(n, []):
            indeg[child] -= 1
            if indeg[child] == 0:
                q.append(child)
                q.sort()

    # if cycle, append leftovers alphabetically
    leftovers = [n for n in nodes if n not in order]
    order.extend(sorted(leftovers))

    result = [{"table": t, "dependsOn": children.get(t, [])} for t in order]
    return result


async def _resolve_pk(cursor, db: str, table: str) -> Optional[str]:
    await cursor.execute(
        """
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_KEY = 'PRI'
        ORDER BY ORDINAL_POSITION
        LIMIT 1
        """,
        (db, table),
    )
    row = await cursor.fetchone()
    return row.get("COLUMN_NAME") if row else None


async def _table_exists(cursor, db: str, table: str) -> bool:
    await cursor.execute(
        "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s",
        (db, table),
    )
    return bool(await cursor.fetchone())


@router.get("/admin/db/tables/{table}/rows")
async def get_rows(
    table: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await _ensure_admin(db, current_user)
    insp = inspect(db.get_bind())
    if table not in insp.get_table_names():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
    qp = request.query_params
    try:
        page = max(1, int(qp.get("page") or 1))
    except Exception:
        page = 1
    try:
        size = max(1, min(200, int(qp.get("size") or 50)))
    except Exception:
        size = 50
    offset = (page - 1) * size

    # Resolve primary key
    pk_info = insp.get_pk_constraint(table) or {}
    pk_cols = pk_info.get("constrained_columns") or []
    pk = pk_cols[0] if pk_cols else None

    # Total count
    metadata = MetaData()
    tbl = Table(table, metadata, autoload_with=db.get_bind())
    total = int(db.execute(select(func.count()).select_from(tbl)).scalar() or 0)

    # Fetch rows
    stmt = select(tbl)
    if pk:
        stmt = stmt.order_by(desc(tbl.c[pk]))
    stmt = stmt.limit(size).offset(offset)
    res: Result = db.execute(stmt)
    out_rows: List[Dict[str, Any]] = []
    cols = [c.name for c in tbl.columns]
    for row in res.fetchall():
        d = {col: row._mapping[col] for col in cols}
        if pk and "id" not in d:
            d["id"] = d.get(pk)
        out_rows.append(d)
    return {"rows": out_rows, "total": total, "pk": pk}


@router.delete("/admin/db/tables/{table}/rows")
async def delete_rows_endpoint(
    table: str,
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await _ensure_admin(db, current_user)
    insp = inspect(db.get_bind())
    if table not in insp.get_table_names():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")

    ids = body.get("ids")
    if not isinstance(ids, list) or len(ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'ids' array required",
        )

    pk_info = insp.get_pk_constraint(table) or {}
    pk_cols = pk_info.get("constrained_columns") or []
    pk = pk_cols[0] if pk_cols else None
    if not pk:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primary key not found for table",
        )

    # Prepare placeholders and values
    metadata = MetaData()
    tbl = Table(table, metadata, autoload_with=db.get_bind())

    # Before deletion: collect URLs to delete from AWS for specific tables
    urls_to_delete: list[str] = []
    t_lower = table.lower()
    if t_lower in {"users", "transactions"}:
        # Fetch rows to determine URLs to delete
        stmt_sel = select(tbl).where(tbl.c[pk].in_(ids))
        res_sel = db.execute(stmt_sel)
        cols = [c.name for c in tbl.columns]
        has_image_url = "image_url" in cols
        has_url_image = "url_image" in cols
        has_proof = "proof_reference" in cols
        for row in res_sel.fetchall():
            m = row._mapping
            if t_lower == "users":
                url = None
                if has_image_url:
                    url = m.get("image_url")
                elif has_url_image:
                    url = m.get("url_image")
                if isinstance(url, str) and url.startswith(("http://", "https://")):
                    urls_to_delete.append(url)
            elif t_lower == "transactions" and has_proof:
                ref = m.get("proof_reference")
                if isinstance(ref, str) and ref.startswith(("http://", "https://")):
                    urls_to_delete.append(ref)

    # Delete rows
    try:
        stmt_del = sqla_delete(tbl).where(tbl.c[pk].in_(ids))
        res_del = db.execute(stmt_del)
        db.commit()
    except Exception as e:
        msg = str(e)
        if "1451" in msg or "foreign key constraint fails" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Suppression bloquée par une contrainte de clé étrangère. Supprimez d'abord les lignes dans les tables dépendantes (voir ordre de suppression).",
            )
        logger.exception("[admin_db] Delete failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Delete failed")
    # After successful DB deletion, best-effort delete AWS images
    if urls_to_delete:
        try:
            aws = AwsFile(settings)
            for url in urls_to_delete:
                try:
                    ok = aws.delete_image(url)
                    if not ok:
                        logger.warning(f"[admin_db] AWS delete failed for url={url}")
                except Exception:
                    logger.exception(f"[admin_db] Exception while deleting AWS image url={url}")
        except Exception:
            # Do not fail the endpoint if AWS setup has issues; just log
            logger.exception("[admin_db] AWS client initialization failed; skipping image deletions")

    try:
        deleted_count = int(res_del.rowcount or 0)
    except Exception:
        deleted_count = 0
    return {"deleted": deleted_count}
