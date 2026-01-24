from fastapi import Request, UploadFile
from typing import Optional, Tuple, Iterable, Set, List, Dict, Any, Union
from datetime import datetime
import logging
import asyncio

import networkx as nx  # type: ignore

from database import get_db_connection

logger = logging.getLogger("users")


async def parse_create_request(request: Request) -> Tuple[dict, Optional[UploadFile]]:
    """Helper to parse mixed JSON/Form data for creation."""
    try:
        form = await request.form()
        if form:
            logger.info(
                "[users] parse_create_request: CT=%s; keys=%s",
                request.headers.get("content-type"),
                list(form.keys()),
            )

            def _opt(name):
                v = form.get(name)
                return v if v not in (None, "") else None

            def _int(name):
                v = form.get(name)
                try:
                    return int(v) if v not in (None, "") else None
                except Exception:
                    return None

            data = {
                "firstname": form.get("firstname") or None,
                "lastname": form.get("lastname") or None,
                "username": _opt("username"),
                "email": _opt("email"),
                "telephone": _opt("telephone"),
                "birthday": _opt("birthday"),
                "gender": _opt("gender"),
                "id_father": _int("id_father"),
                "id_mother": _int("id_mother"),
                "isactive": _int("isactive"),
                "isfirstlogin": _int("isfirstlogin"),
                "contribution_tier": _opt("contribution_tier"),
                "role": _opt("role"),
            }
            upload = form.get("file")
            logger.info(
                "[users] parse_create_request: form['file'] type=%s",
                type(upload).__name__ if upload is not None else None,
            )
            # Consider file present only if it has a non-empty filename
            if not getattr(upload, "filename", None):
                upload = None
            # Read client intent flag (do not include in returned data)
            with_image_raw = form.get("with_image")
            try:
                with_image = (
                    int(with_image_raw) if with_image_raw not in (None, "") else 0
                )
            except Exception:
                with_image = 0
            logger.info(
                "[users] create intent: with_image=%s, upload_present=%s",
                with_image,
                bool(upload),
            )
            if with_image == 1 and not upload:
                logger.warning(
                    "[users] intent mismatch: with_image=1 but no file provided"
                )
            if with_image == 0 and upload:
                logger.warning(
                    "[users] intent mismatch: with_image=0 but file provided"
                )
            return data, upload

    except Exception as e:
        logger.warning(
            "[users] parse_create_request: failed to parse form; CT=%s; err=%s",
            request.headers.get("content-type"),
            e,
        )

    try:
        json_body = await request.json()


        if isinstance(json_body, dict):
            with_image_raw = json_body.get("with_image")
            try:
                with_image = (
                    int(with_image_raw) if with_image_raw not in (None, "") else 0
                )
            except Exception:
                with_image = 0
            logger.info("[users] create intent (JSON): with_image=%s", with_image)
            jb = dict(json_body)
            jb.pop("with_image", None)
            return jb, None
    except Exception as e:
        logger.warning("[users] parse_create_request: failed to parse json; err=%s", e)
    return {}, None


async def parse_update_request(request: Request) -> Tuple[dict, Optional[UploadFile]]:
    """Helper to parse mixed JSON/Form data for updates."""
    try:
        form = await request.form()
        if form:
            logger.info(
                "[users] parse_update_request: CT=%s; keys=%s",
                request.headers.get("content-type"),
                list(form.keys()),
            )

            def _opt(name):
                v = form.get(name)
                return v if v not in (None, "") else None

            def _int(name):
                v = form.get(name)
                try:
                    return int(v) if v not in (None, "") else None
                except Exception:
                    return None

            data = {
                "firstname": _opt("firstname"),
                "lastname": _opt("lastname"),
                "username": _opt("username"),
                "email": _opt("email"),
                "telephone": _opt("telephone"),
                "birthday": _opt("birthday"),
                "image_url": _opt("image_url"),
                "gender": _opt("gender"),
                "id_father": _int("id_father"),
                "id_mother": _int("id_mother"),
                "isactive": _int("isactive"),
                "isfirstlogin": _int("isfirstlogin"),
            }
            remove_image_raw = form.get("remove_image")
            remove_image = False
            if remove_image_raw is not None:
                remove_image = str(remove_image_raw).strip().lower() in {
                    "1",
                    "true",
                    "yes",
                    "on",
                }
            if remove_image:
                data["remove_image"] = True
            upload = form.get("file")
            logger.info(
                "[users] parse_update_request: form['file'] type=%s",
                type(upload).__name__ if upload is not None else None,
            )
            # Consider file present only if it has a non-empty filename
            if not getattr(upload, "filename", None):
                upload = None
            # Read client intent flag (do not include in returned data)
            with_image_raw = form.get("with_image")
            try:
                with_image = (
                    int(with_image_raw) if with_image_raw not in (None, "") else 0
                )
            except Exception:
                with_image = 0
            logger.info(
                "[users] update intent: with_image=%s, upload_present=%s",
                with_image,
                bool(upload),
            )
            if with_image == 1 and not upload:
                logger.warning(
                    "[users] intent mismatch: with_image=1 but no file provided"
                )
            if with_image == 0 and upload:
                logger.warning(
                    "[users] intent mismatch: with_image=0 but file provided"
                )
            return data, upload
    except Exception as e:
        logger.warning(
            "[users] parse_update_request: failed to parse form; CT=%s; err=%s",
            request.headers.get("content-type"),
            e,
        )
    try:
        json_body = await request.json()
        if isinstance(json_body, dict):
            with_image_raw = json_body.get("with_image")
            try:
                with_image = (
                    int(with_image_raw) if with_image_raw not in (None, "") else 0
                )
            except Exception:
                with_image = 0
            logger.info("[users] update intent (JSON): with_image=%s", with_image)
            jb = dict(json_body)
            if "remove_image" in jb:
                rem = jb.get("remove_image")
                if isinstance(rem, str):
                    jb["remove_image"] = rem.strip().lower() in {
                        "1",
                        "true",
                        "yes",
                        "on",
                    }
                else:
                    jb["remove_image"] = bool(rem)
            jb.pop("with_image", None)
            return jb, None
    except Exception as e:
        logger.warning("[users] parse_update_request: failed to parse json; err=%s", e)
    return {}, None


def _base_username_from_names(
    firstname: str, lastname: str, birthday: Optional[str]
) -> str:
    parts = []
    if firstname:
        parts.extend([p for p in firstname.strip().split() if p])
    if lastname:
        parts.extend([p for p in lastname.strip().split() if p])
    initials = "".join([p[0].lower() for p in parts if p])
    year = ""
    try:
        if birthday:
            year = str(datetime.fromisoformat(birthday).year)
    except Exception:
        year = ""
    return (initials + year).strip()


def ensure_unique_username(
    desired: str, cursor, exclude_user_id: Optional[int] = None, max_tries: int = 1000
) -> str:
    """Ensure uniqueness by appending a numeric suffix when needed.
    If `exclude_user_id` is provided, the current user's username won't count as a collision.
    """
    import string

    base = (desired or "").strip()
    if base == "":
        raise ValueError("Nom d'utilisateur vide")
    # Try without suffix first
    candidate = base
    cursor.execute("SELECT id FROM users WHERE username = %s LIMIT 1", (candidate,))
    row = cursor.fetchone()
    if not row:
        return candidate
    if exclude_user_id is not None:
        found_id = row[0] if not isinstance(row, dict) else row.get("id")
        if found_id == exclude_user_id:
            return candidate

    # Try with a-z appended
    for letter in string.ascii_lowercase:
        candidate = f"{base}{letter}"
        cursor.execute("SELECT id FROM users WHERE username = %s LIMIT 1", (candidate,))
        row = cursor.fetchone()
        if not row:
            return candidate
        if exclude_user_id is not None:
            found_id = row[0] if not isinstance(row, dict) else row.get("id")
            if found_id == exclude_user_id:
                return candidate

    # Try with a-z and numeric suffix
    for letter in string.ascii_lowercase:
        for i in range(1, max_tries):
            candidate = f"{base}{letter}{i}"
            cursor.execute(
                "SELECT id FROM users WHERE username = %s LIMIT 1", (candidate,)
            )
            row = cursor.fetchone()
            if not row:
                return candidate
            if exclude_user_id is not None:
                found_id = row[0] if not isinstance(row, dict) else row.get("id")
                if found_id == exclude_user_id:
                    return candidate
    raise ValueError("Impossible de générer un nom d'utilisateur unique")


def generate_username_logic(
    firstname: str, lastname: str, birthday: Optional[str], cursor
) -> str:
    base = _base_username_from_names(firstname, lastname, birthday)
    return ensure_unique_username(base, cursor)


# ------------------------------
# Graph building and lineage API
# ------------------------------


def _build_graph_from_rows(rows: Iterable[Union[Dict[str, Any], tuple]]):
    """
    Build a directed graph of users from DB rows.
    Nodes: user ids
    Edges: father->child (relation='father'), mother->child (relation='mother')
    """
    if nx is None:
        raise RuntimeError("networkx is required to build the family graph")
    G = nx.DiGraph()
    for row in rows:
        # Row may be dict (dictionary=True) or tuple in (id, id_father, id_mother)
        if isinstance(row, dict):
            uid = row.get("id")
            fid = row.get("id_father")
            mid = row.get("id_mother")
        else:
            uid, fid, mid = row
        if uid is None:
            continue
        G.add_node(uid)
        if fid:
            G.add_edge(fid, uid, relation="father")
        if mid:
            G.add_edge(mid, uid, relation="mother")
    return G


def init_users_graph(app) -> None:
    """
    Initialize and store the users graph in app.state at application startup.
    Uses a synchronous pooled DB connection.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, id_father, id_mother FROM users")
        rows = cursor.fetchall() or []
        G = _build_graph_from_rows(rows)
        # Attach to app state
        if not hasattr(app.state, "users_graph_lock"):
            # Lazy import to avoid threading in constrained envs
            import threading

            app.state.users_graph_lock = threading.Lock()
        with app.state.users_graph_lock:
            app.state.users_graph = G
            app.state.users_graph_version = (
                getattr(app.state, "users_graph_version", 0) + 1
            )
        logger.info(
            "[graph] Initialized users_graph with %s nodes, %s edges",
            G.number_of_nodes(),
            G.number_of_edges(),
        )
    except Exception:
        logger.exception("[graph] Failed to initialize users graph")
    finally:
        try:
            if cursor:
                cursor.close()
        finally:
            try:
                if conn:
                    conn.close()
            except Exception:
                pass


async def update_users_graph(app, cursor_async=None) -> None:
    """
    Refresh the users graph stored in app.state.
    If an async cursor is provided, it will be used. Otherwise, a sync connection is used.
    """
    rows: List[Union[Dict[str, Any], tuple]] = []
    if cursor_async is not None:
        try:
            await cursor_async.execute("SELECT id, id_father, id_mother FROM users")
            rows = await cursor_async.fetchall() or []
        except Exception:
            logger.exception(
                "[graph] Failed to fetch rows with async cursor; falling back to sync"
            )
    if not rows:
        # Fallback to sync query in thread
        def _fetch_sync():
            conn_ = None
            cur_ = None
            try:
                conn_ = get_db_connection()
                cur_ = conn_.cursor(dictionary=True)
                cur_.execute("SELECT id, id_father, id_mother FROM users")
                return cur_.fetchall() or []
            finally:
                try:
                    if cur_:
                        cur_.close()
                finally:
                    try:
                        if conn_:
                            conn_.close()
                    except Exception:
                        pass

        rows = await asyncio.to_thread(_fetch_sync)

    G = _build_graph_from_rows(rows)
    if not hasattr(app.state, "users_graph_lock"):
        import threading

        app.state.users_graph_lock = threading.Lock()
    with app.state.users_graph_lock:
        app.state.users_graph = G
        app.state.users_graph_version = getattr(app.state, "users_graph_version", 0) + 1
    logger.info(
        "[graph] Updated users_graph to version %s (%s nodes, %s edges)",
        getattr(app.state, "users_graph_version", "?"),
        G.number_of_nodes(),
        G.number_of_edges(),
    )


def get_family_ids(graph: Any, user_id: int) -> Set[int]:
    """
    Extract the family lineage set for a user:
    - Find the user's father and mother (incoming edges with relation father/mother)
    - From those parents, traverse descendants (successors) to include all children down to leaves
    - For every child encountered, also include their parents
    Returns the set of user ids representing this family group.
    """
    if nx is None:
        raise RuntimeError("networkx is required for lineage extraction")
    parents: List[int] = []
    if user_id in graph:
        for pred in graph.predecessors(user_id):
            rel = graph.get_edge_data(pred, user_id).get("relation")
            if rel in ("father", "mother"):
                parents.append(pred)
    if not parents:
        return {user_id}

    family_ids: Set[int] = set(parents)
    visited: Set[int] = set()
    queue: List[int] = list(parents)
    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        # Add direct children
        for child in graph.successors(current):
            if child not in family_ids:
                family_ids.add(child)
                queue.append(child)
            # Add the parents of each encountered child
            for parent in graph.predecessors(child):
                rel = graph.get_edge_data(parent, child).get("relation")
                if rel in ("father", "mother") and parent not in family_ids:
                    family_ids.add(parent)
                    queue.append(parent)
    return family_ids


async def get_family_rows(
    cursor_async, graph: Any, user_id: int
) -> List[Dict[str, Any]]:
    """
    Async helper: return basic user rows for the extracted family ids.
    Columns: id, firstname, lastname, id_father, id_mother
    """
    ids = get_family_ids(graph, user_id)
    if not ids:
        return []
    placeholders = ",".join(["%s"] * len(ids))
    sql = f"SELECT id, firstname, lastname, id_father, id_mother FROM users WHERE id IN ({placeholders})"
    await cursor_async.execute(sql, tuple(ids))
    rows = await cursor_async.fetchall() or []
    # Normalize to dict list
    out: List[Dict[str, Any]] = []
    for r in rows:
        if isinstance(r, dict):
            out.append(r)
        else:
            uid, fn, ln, fid, mid = r
            out.append(
                {
                    "id": uid,
                    "firstname": fn,
                    "lastname": ln,
                    "id_father": fid,
                    "id_mother": mid,
                }
            )
    return out


async def send_notification(
    cursor,
    recipient_ids: List[int],
    message_text: str,
    sender_id: Optional[int] = None,
    message_type: str = "MESSAGE",
    link: Optional[str] = None,
):
    """
    Sends a message to a list of recipients.
    Handles 'messages' insertion and 'messages_recipients' entries.
    Auto-excludes sender_id from recipient_ids if present.
    """
    if not recipient_ids:
        return

    # Filter out sender if present, and remove duplicates
    targets = set(recipient_ids)
    if sender_id is not None and sender_id in targets:
        try:
            targets.remove(sender_id)
        except KeyError:
            pass
    
    if not targets:
        return

    now = datetime.now()
    try:
        # 1. Insert message body
        await cursor.execute(
            """
            INSERT INTO messages (message, message_type, received_at, link)
            VALUES (%s, %s, %s, %s)
            """,
            (message_text, message_type, now, link),
        )
        msg_id = cursor.lastrowid

        # 3. Insert recipients
        values = []
        for rid in targets:
            sid = sender_id if sender_id else 1 
            values.append((0, sid, rid, msg_id))
            next_rec_id += 1

        if values:
            await cursor.executemany(
                """
                INSERT INTO messages_recipients (isreaded, sender_id, receiver_id, messages_id)
                VALUES (%s, %s, %s, %s)
                """,
                values,
            )
    except Exception as e:
        logger.error(f"[utils] send_notification failed: {e}")
