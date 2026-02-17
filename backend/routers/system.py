from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    WebSocket,
    WebSocketDisconnect,
)
import logging
from sqlalchemy.orm import Session
from jose import jwt, JWTError, ExpiredSignatureError
import asyncio
import psutil
from datetime import datetime, date
from settings import settings
from auth_utils import hash_password
from models_orm.database import SessionLocal
from models_orm.dependencies import get_db, get_current_user
from models_orm.users import Users
from models_orm.access_control import Roles, RoleAttribution
from models_orm.auth import RevokedToken

router = APIRouter()
logger = logging.getLogger("system")


@router.get("/info-base")
async def check_db(
    db: Session = Depends(get_db), current_user: Users = Depends(get_current_user)
):
    """Return environment and database connection info using ORM."""
    try:
        bind = db.get_bind()
        db_name = getattr(getattr(bind, "url", None), "database", None)
    except Exception:
        db_name = None
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
    session: Session | None = None
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        user_id_raw = payload.get("sub")
        jti = payload.get("jti")
        try:
            user_id = int(user_id_raw) if user_id_raw is not None else None
        except (TypeError, ValueError):
            user_id = None
        if user_id is None:
            await websocket.close(code=4401)
            return

        session = SessionLocal()

        # Check token revocation by jti
        if jti:
            revoked = (
                session.query(RevokedToken).filter(RevokedToken.jti == jti).first()
            )
            if revoked:
                await websocket.close(code=4401)
                return

        # Load roles via ORM
        rows = (
            session.query(Roles.role)
            .join(RoleAttribution, Roles.id == RoleAttribution.roles_id)
            .filter(RoleAttribution.users_id == user_id)
            .all()
        )
        roles = [str(r.role).lower() for r in rows if getattr(r, "role", None)]
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
            if session:
                session.close()
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
        done, pending = await asyncio.wait(
            {recv_task, send_task}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
    except Exception:
        # Ensure socket is closed on unexpected errors
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@router.get("/setup-database")
async def setup_database(
    db: Session = Depends(get_db), current_user: Users = Depends(get_current_user)
):
    """Seed initial data using ORM. Idempotent ensures existence without raw SQL."""
    try:
        # Ensure users
        def ensure_user(uid: int, **fields):
            u = db.query(Users).filter(Users.id == uid).first()
            if not u:
                u = Users(id=uid, **fields)
                db.add(u)
                db.flush()
            return u

        # Parse birthday if provided
        def parse_bday(val):
            if not val:
                return None
            try:
                # Expect YYYY-MM-DD
                parts = str(val).split("-")
                return date(int(parts[0]), int(parts[1]), int(parts[2]))
            except Exception:
                return None

        ensure_user(
            1,
            firstname="Kassa",
            lastname="Famille",
            username="kassa",
            password=hash_password(settings.user_password_default),
            isfirstlogin=0,
            isactive=1,
        )

        ensure_user(
            2,
            firstname="admin",
            lastname="admin",
            username=settings.admin_username,
            password=hash_password(settings.admin_password),
            email=settings.admin_email,
            telephone=settings.admin_telephone,
            birthday=parse_bday(settings.admin_birthday),
            isfirstlogin=0,
            isactive=1,
        )

        ensure_user(
            3,
            firstname="Thierno Mamoudou Foulah",
            lastname="Barry",
            username="thierno",
            password=hash_password(settings.user_password_default),
            isfirstlogin=0,
            isactive=1,
        )
        ensure_user(
            4,
            firstname="Mamadou Kindy",
            lastname="Barry",
            username="mamadou",
            password=hash_password(settings.user_password_default),
            isfirstlogin=0,
            isactive=1,
        )

        # Roles ensure
        def ensure_role(rid: int, name: str):
            r = db.query(Roles).filter(Roles.id == rid).first()
            if not r:
                r = Roles(id=rid, role=name)
                db.add(r)
            else:
                r.role = name
            db.flush()
            return r

        ensure_role(1, "admin")
        ensure_role(2, "user")
        ensure_role(3, "guest")
        ensure_role(4, "norole")
        ensure_role(5, "admingroup")

        # Create users for each role
        ensure_user(
            5,
            firstname="Guest",
            lastname="User",
            username="guest",
            password=hash_password(settings.user_password_default),
            isfirstlogin=0,
            isactive=1,
        )
        ensure_user(
            6,
            firstname="No",
            lastname="Role",
            username="norole",
            password=hash_password(settings.user_password_default),
            isfirstlogin=0,
            isactive=1,
        )

        # Role assignments (idempotent)
        def ensure_role_attrib(uid: int, rid: int):
            exists = (
                db.query(RoleAttribution)
                .filter(RoleAttribution.users_id == uid)
                .filter(RoleAttribution.roles_id == rid)
                .first()
            )
            if not exists:
                db.add(RoleAttribution(users_id=uid, roles_id=rid))
                db.flush()

        # Admin gets admin,user,guest
        for rid in (1, 2, 3):
            ensure_role_attrib(2, rid)

        # Norole for kassa (1), child 3 and 4
        for uid in (1, 3, 4):
            ensure_role_attrib(uid, 4)

        # Guest gets guest
        ensure_role_attrib(5, 3)
        # Norole gets norole
        ensure_role_attrib(6, 4)

        db.commit()
        return {"status": "Success", "message": "Ensure initial data exists"}
    except Exception as e:
        logger.exception("[system] setup_database failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
