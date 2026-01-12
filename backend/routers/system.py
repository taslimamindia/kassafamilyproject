from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
import logging
from dependencies import get_db_connection, get_cursor, get_current_user
from settings import settings
from auth_utils import hash_password
from jose import jwt, JWTError, ExpiredSignatureError
import asyncio
import psutil
from datetime import datetime

router = APIRouter()
logger = logging.getLogger("system")

@router.get("/info-base")
def check_db(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT DATABASE();")
        db_name = cursor.fetchone()[0]
        # On Lightsail or Local, we now treat connection as 'local' (host-wise)
        # but we can distinguish based on env name
        db_type = "production" if settings.env == "production" else "development"
        return {
            "env": settings.env,
            "db": db_name,
            "status": "Connected",
            "db_type": db_type,
        }
    finally:
        cursor.close()
        conn.close()


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
    cursor = None
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
        cursor = conn.cursor(dictionary=True)

        if jti:
            cursor.execute("SELECT id FROM revoked_tokens WHERE jti = %s", (jti,))
            if cursor.fetchone():
                await websocket.close(code=4401)
                return

        cursor.execute(
            """
            SELECT r.role
            FROM role_attribution ra
            JOIN roles r ON r.id = ra.roles_id
            WHERE ra.users_id = %s
            """,
            (user_id,),
        )
        rows = cursor.fetchall() or []
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
            if cursor:
                cursor.close()
        finally:
            try:
                if conn:
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
                rss = proc.memory_info().rss
                proc_percent = proc.memory_percent()
                await websocket.send_json(
                    {
                        "total": vm.total,
                        "available": vm.available,
                        "used": vm.used,
                        "percent": vm.percent,
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
def setup_database(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection(autocommit=False)
    cursor = conn.cursor()
    try:
        # Insert father (ID 1)
        sql_father = (
            "INSERT INTO users (id, firstname, lastname, username, password, isfirstlogin) "
            "VALUES (1, %s, %s, %s, %s, %s) "
            "ON DUPLICATE KEY UPDATE id=id"
        )
        cursor.execute(
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
        cursor.execute(
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
                "Thierno Mahamoudou",
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
        cursor.executemany(sql_child, children)

        # Roles
        cursor.execute(
            "INSERT INTO roles (id, role) VALUES (1, 'admin') "
            "ON DUPLICATE KEY UPDATE role='admin'"
        )
        cursor.execute(
            "INSERT INTO roles (id, role) VALUES (2, 'user') "
            "ON DUPLICATE KEY UPDATE role='user'"
        )
        cursor.execute(
            "INSERT INTO roles (id, role) VALUES (3, 'guest') "
            "ON DUPLICATE KEY UPDATE role='guest'"
        )
        cursor.execute(
            "INSERT INTO roles (id, role) VALUES (4, 'norole') "
            "ON DUPLICATE KEY UPDATE role='norole'"
        )
        cursor.execute(
            "INSERT INTO roles (id, role) VALUES (5, 'admingroup') "
            "ON DUPLICATE KEY UPDATE role='admingroup'"
        )

        # Create users for each role
        # Guest user (ID 5)
        sql_role_user = (
            "INSERT INTO users (id, firstname, lastname, username, password, isfirstlogin) "
            "VALUES (%s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE id=id"
        )
        cursor.execute(
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
        cursor.execute(
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
            cursor.execute(
                "INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (2, %s)",
                (rid,),
            )

        # No user add norole for kassa, father and mother
        for uid in (1, 3, 4):
            cursor.execute(
                "INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (%s, 4)",
                (uid,),
            )

        # Guest gets guest role
        cursor.execute(
            "INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (5, 3)"
        )

        # Norole gets norole role
        cursor.execute(
            "INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (6, 4)"
        )

        conn.commit()

        return {"status": "Success", "message": "Ensure initial data exists"}
    
    except Exception as e:
        conn.rollback()
        logger.exception("[system] setup_database failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        cursor.close()
        conn.close()
