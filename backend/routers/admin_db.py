from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Dict, Any, Optional, Tuple
import logging

from dependencies import get_cursor, get_current_user, has_role

router = APIRouter()
logger = logging.getLogger("admin_db")


async def _get_db_name(cursor) -> str:
    await cursor.execute("SELECT DATABASE() AS db")
    row = await cursor.fetchone() or {}
    db = row.get("db") or row.get("DATABASE()")
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cannot detect current database",
        )
    return str(db)


async def _ensure_admin(cursor, current_user: dict):
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized"
        )
    if not await has_role(cursor, current_user["id"], "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")


@router.get("/admin/db/tables")
async def list_tables(
    cursor=Depends(get_cursor), current_user: dict = Depends(get_current_user)
):
    await _ensure_admin(cursor, current_user)
    db = await _get_db_name(cursor)
    await cursor.execute(
        """
        SELECT TABLE_NAME AS name, TABLE_ROWS AS rowCount
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
        """,
        (db,),
    )
    rows = await cursor.fetchall() or []
    result = []
    for r in rows:
        name = r.get("name") or r.get("TABLE_NAME")
        rc = r.get("rowCount") or r.get("TABLE_ROWS")
        try:
            rc = int(rc) if rc is not None else None
        except Exception:
            rc = None
        result.append({"name": name, "rowCount": rc})
    return result


@router.get("/admin/db/deletion-order")
async def deletion_order(
    cursor=Depends(get_cursor), current_user: dict = Depends(get_current_user)
):
    await _ensure_admin(cursor, current_user)
    db = await _get_db_name(cursor)
    # child -> parent edges (child depends on parent)
    await cursor.execute(
        """
        SELECT DISTINCT kcu.TABLE_NAME AS child, kcu.REFERENCED_TABLE_NAME AS parent
        FROM information_schema.KEY_COLUMN_USAGE kcu
        WHERE kcu.TABLE_SCHEMA = %s AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        """,
        (db,),
    )
    edges = await cursor.fetchall() or []

    # Build adjacency and in-degree
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
    await cursor.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s AND TABLE_TYPE='BASE TABLE'",
        (db,),
    )
    all_tables = [r.get("TABLE_NAME") for r in (await cursor.fetchall() or [])]
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
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    await _ensure_admin(cursor, current_user)
    db = await _get_db_name(cursor)
    if not await _table_exists(cursor, db, table):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Table not found"
        )
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

    pk = await _resolve_pk(cursor, db, table)

    # Total count
    await cursor.execute(f"SELECT COUNT(*) AS c FROM `{table}`")
    total_row = await cursor.fetchone() or {}
    total = int(total_row.get("c") or 0)

    # Fetch rows
    if pk:
        await cursor.execute(
            f"SELECT * FROM `{table}` ORDER BY `{pk}` DESC LIMIT %s OFFSET %s",
            (size, offset),
        )
    else:
        await cursor.execute(
            f"SELECT * FROM `{table}` LIMIT %s OFFSET %s", (size, offset)
        )
    rows = await cursor.fetchall() or []
    # Ensure an 'id' key exists for UI selection
    if pk:
        for r in rows:
            if "id" not in r:
                r["id"] = r.get(pk)
    return {"rows": rows, "total": total, "pk": pk}


@router.delete("/admin/db/tables/{table}/rows")
async def delete_rows_endpoint(
    table: str,
    body: Dict[str, Any],
    cursor=Depends(get_cursor),
    current_user: dict = Depends(get_current_user),
):
    await _ensure_admin(cursor, current_user)
    db = await _get_db_name(cursor)
    if not await _table_exists(cursor, db, table):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Table not found"
        )

    ids = body.get("ids")
    if not isinstance(ids, list) or len(ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'ids' array required",
        )

    pk = await _resolve_pk(cursor, db, table)
    if not pk:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primary key not found for table",
        )

    # Prepare placeholders and values
    placeholders = ",".join(["%s"] * len(ids))
    sql = f"DELETE FROM `{table}` WHERE `{pk}` IN ({placeholders})"

    try:
        await cursor.execute(sql, tuple(ids))
        await cursor.commit()
    except Exception as e:
        # MySQL FK constraint error typically 1451
        msg = str(e)
        if "1451" in msg or "foreign key constraint fails" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Suppression bloquée par une contrainte de clé étrangère. Supprimez d'abord les lignes dans les tables dépendantes (voir ordre de suppression).",
            )
        logger.exception("[admin_db] Delete failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Delete failed"
        )

    return {"deleted": cursor.rowcount}
