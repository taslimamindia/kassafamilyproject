from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
import logging
from dependencies import get_db_connection, get_cursor, get_current_user, AsyncCursor
from settings import settings
from auth_utils import hash_password
from jose import jwt, JWTError, ExpiredSignatureError
import asyncio
import psutil
from datetime import datetime

router = APIRouter()
logger = logging.getLogger("system")

@router.get("/info-base")
async def check_db(cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    await cursor.execute("SELECT DATABASE();")
    row = await cursor.fetchone()
    db_name = (row or {}).get("DATABASE()") if isinstance(row, dict) else (row[0] if row else None)
    db_type = "production" if settings.env == "production" else "development"
    return {
        "env": settings.env,
        "db": db_name,
        "status": "Connected",
        "db_type": db_type,
    }


@router.websocket("/ws/memory")
async def memory_ws(websocket: WebSocket):
    # Expect a Bearer token via query parameter for WS auth
    token = websocket.query_params.get("token")
    if not token:
        # 4401: Unauthorized (custom close code)
        try:
            await websocket.close(code=4401)
        except Exception:
            pass
        return

    # Validate token and ensure admin role
    conn = None
    acursor: AsyncCursor | None = None
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id_raw = payload.get("sub")
        jti = payload.get("jti")
        try:
            user_id = int(user_id_raw) if user_id_raw is not None else None
        except (TypeError, ValueError):
            user_id = None
        if user_id is None:
            await websocket.close(code=4401)
            return

        conn = get_db_connection()
        acursor = AsyncCursor(conn)

        if jti:
            await acursor.execute("SELECT id FROM revoked_tokens WHERE jti = %s", (jti,))
            if await acursor.fetchone():
                await websocket.close(code=4401)
                return

        await acursor.execute(
            """
            SELECT r.role
            FROM role_attribution ra
            JOIN roles r ON r.id = ra.roles_id
            WHERE ra.users_id = %s
            """,
            (user_id,),
        )
        rows = await acursor.fetchall() or []
        roles = [str(r.get("role")).lower() for r in rows if r and r.get("role") is not None]
        if "admin" not in roles:
            await websocket.close(code=4403)  # Forbidden
            return

    except ExpiredSignatureError:
        try:
            await websocket.close(code=4401)
        except Exception:
            pass
        return
    except JWTError:
        try:
            await websocket.close(code=4401)
        except Exception:
            pass
        return
    finally:
        try:
            if acursor:
                await acursor.close()
            elif conn:
                conn.close()
        except Exception:
            pass

    await websocket.accept()

    # Heartbeat-based idle timeout: if client doesn't send anything for IDLE_TIMEOUT seconds, disconnect
    IDLE_TIMEOUT = 45.0  # seconds
    last_client_msg = asyncio.get_event_loop().time()

    async def recv_loop():
        nonlocal last_client_msg
        try:
            while True:
                # Any message from client updates last seen; ignore content
                await websocket.receive_text()
                last_client_msg = asyncio.get_event_loop().time()
        except WebSocketDisconnect:
            # Client closed the connection
            pass
        except Exception:
            # Treat other receive errors as disconnects
            try:
                await websocket.close(code=1011)
            except Exception:
                pass

    async def send_loop():
        try:
            proc = psutil.Process()
            while True:
                now = asyncio.get_event_loop().time()
                if now - last_client_msg > IDLE_TIMEOUT:
                    # Idle timeout reached: close connection
                    try:
                        await websocket.close(code=4408)  # Policy/timeout
                    except Exception:
                        pass
                    break
                vm = psutil.virtual_memory()
                swap = psutil.swap_memory()
                rss = proc.memory_info().rss
                proc_percent = proc.memory_percent()
                await websocket.send_json(
                    {
                        "total": vm.total,
                        "available": vm.available,
                        "used": vm.used,
                        "percent": vm.percent,
                        "swap_total": swap.total,
                        "swap_used": swap.used,
                        "swap_percent": swap.percent,
                        "rss": rss,
                        "proc_percent": proc_percent,
                        "ts": datetime.utcnow().isoformat() + "Z",
                    }
                )
                await asyncio.sleep(1.0)
        except WebSocketDisconnect:
            # Client disconnected
            pass
        except Exception:
            logger.exception("[system] memory_ws streaming error")
            try:
                await websocket.close(code=1011)  # Internal error
            except Exception:
                pass

    # Run both loops concurrently; stop when either finishes
    try:
        recv_task = asyncio.create_task(recv_loop())
        send_task = asyncio.create_task(send_loop())
        done, pending = await asyncio.wait({recv_task, send_task}, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
    except Exception:
        # Ensure socket is closed on unexpected errors
        try:
            await websocket.close(code=1011)
        except Exception:
            pass

@router.get("/setup-database")
async def setup_database(cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    try:
        # Ensure transactional behavior
        try:
            # Disable autocommit for this transactional route
            cursor._conn.autocommit = False
        except Exception:
            pass

        # Insert father (ID 1)
        sql_father = (
            "INSERT INTO users (id, firstname, lastname, username, password, isfirstlogin) "
            "VALUES (1, %s, %s, %s, %s, %s) "
            "ON DUPLICATE KEY UPDATE id=id"
        )
        await cursor.execute(
            sql_father,
            (
                "Kassa",
                "Famille",
                "kassa",
                hash_password(settings.user_password_default),
                0,
            ),
        )

        # Insert admin (ID 2)
        sql_admin = (
            "INSERT INTO users (id, firstname, lastname, username, password, email, telephone, birthday, isfirstlogin, isactive) "
            "VALUES (2, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON DUPLICATE KEY UPDATE id=id"
        )
        await cursor.execute(
            sql_admin,
            (
                "admin",
                "admin",
                settings.admin_username,
                hash_password(settings.admin_password),
                settings.admin_email,
                settings.admin_telephone,
                settings.admin_birthday,
                0,
                1,
            ),
        )

        children = [
            (
                3,
                "Thierno Mamoudou Foulah",
                "Barry",
                "thierno",
                hash_password(settings.user_password_default),
                1,
                0,
            ),
            (
                4,
                "Mamadou Kindy",
                "Barry",
                "mamadou",
                hash_password(settings.user_password_default),
                1,
                0,
            ),
        ]
        sql_child = (
            "INSERT INTO users (id, firstname, lastname, username, password, id_father, isfirstlogin) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE id=id"
        )
        # executemany is blocking; run in threadpool
        await asyncio.to_thread(cursor._cursor.executemany, sql_child, children)

        # Roles
        await cursor.execute(
            "INSERT INTO roles (id, role) VALUES (1, 'admin') "
            "ON DUPLICATE KEY UPDATE role='admin'"
        )
        await cursor.execute(
            "INSERT INTO roles (id, role) VALUES (2, 'user') "
            "ON DUPLICATE KEY UPDATE role='user'"
        )
        await cursor.execute(
            "INSERT INTO roles (id, role) VALUES (3, 'guest') "
            "ON DUPLICATE KEY UPDATE role='guest'"
        )
        await cursor.execute(
            "INSERT INTO roles (id, role) VALUES (4, 'norole') "
            "ON DUPLICATE KEY UPDATE role='norole'"
        )
        await cursor.execute(
            "INSERT INTO roles (id, role) VALUES (5, 'admingroup') "
            "ON DUPLICATE KEY UPDATE role='admingroup'"
        )

        # Create users for each role
        # Guest user (ID 5)
        sql_role_user = (
            "INSERT INTO users (id, firstname, lastname, username, password, isfirstlogin) "
            "VALUES (%s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE id=id"
        )
        await cursor.execute(
            sql_role_user,
            (
                5,
                "Guest",
                "User",
                "guest",
                hash_password(settings.user_password_default),
                0,
            ),
        )
        # Norole user (ID 6)
        await cursor.execute(
            sql_role_user,
            (
                6,
                "No",
                "Role",
                "norole",
                hash_password(settings.user_password_default),
                0,
            ),
        )

        # Role assignments
        # Admin gets everything
        for rid in (1, 2, 3):
            await cursor.execute(
                "INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (2, %s)",
                (rid,),
            )

        # No user add norole for kassa, father and mother
        for uid in (1, 3, 4):
            await cursor.execute(
                "INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (%s, 4)",
                (uid,),
            )

        # Guest gets guest role
        await cursor.execute(
            "INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (5, 3)"
        )

        # Norole gets norole role
        await cursor.execute(
            "INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (6, 4)"
        )

        await cursor.commit()

        return {"status": "Success", "message": "Ensure initial data exists"}
    
    except Exception as e:
        try:
            await cursor.rollback()
        except Exception:
            pass
        logger.exception("[system] setup_database failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        try:
            await cursor.close()
        except Exception:
            pass
