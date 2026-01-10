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
        return {"env": settings.env, "db": db_name, "status": "Connected"}
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

    # Stream memory stats periodically
    try:
        proc = psutil.Process()
        while True:
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

@router.get("/setup-database")
def setup_database(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection(autocommit=False)
    cursor = conn.cursor()
    try:        
        # Insert father (ID 1)
        sql_father = "INSERT INTO users (id, firstname, lastname, username, password) VALUES (1, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE id=id"
        cursor.execute(sql_father, ("Kassa", "Famille", "kassa", hash_password(settings.user_password_default)))
        
        # Insert admin (ID 2)
        sql_admin = "INSERT INTO users (id, firstname, lastname, username, password, email, telephone, birthday) VALUES (2, %s, %s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE id=id"
        cursor.execute(
            sql_admin,
            ("admin", "admin", settings.admin_username, hash_password(settings.admin_password), settings.admin_email, settings.admin_telephone, settings.admin_birthday),
        )
            
        children = [
            (3, "Thierno Mahamoudou", "Barry", "thierno", hash_password(settings.user_password_default), 1),
            (4, "Mamadou Kindy", "Barry", "mamadou", hash_password(settings.user_password_default), 1),
        ]
        sql_child = "INSERT INTO users (id, firstname, lastname, username, password, id_father) VALUES (%s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE id=id"
        cursor.executemany(sql_child, children)
        
        # Roles
        cursor.execute("INSERT INTO roles (id, role) VALUES (1, 'admin') ON DUPLICATE KEY UPDATE role='admin'")
        cursor.execute("INSERT INTO roles (id, role) VALUES (2, 'user') ON DUPLICATE KEY UPDATE role='user'")
        cursor.execute("INSERT INTO roles (id, role) VALUES (3, 'guest') ON DUPLICATE KEY UPDATE role='guest'")

        # Role assignments
        # Admin gets everything
        for rid in (1, 2, 3):
            cursor.execute("INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (2, %s)", (rid,))

        # Others get user
        for uid in (1, 3, 4):
            cursor.execute("INSERT IGNORE INTO role_attribution (users_id, roles_id) VALUES (%s, 2)", (uid,))
        
        conn.commit()
        return {"status": "Success", "message": "Ensure initial data exists"}
    
    except Exception as e:
        conn.rollback()
        logger.exception("[system] setup_database failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        cursor.close()
        conn.close()
