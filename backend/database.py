import mysql.connector
from mysql.connector import pooling
import uuid
from settings import settings
import logging
import atexit
from typing import Optional
import os

_ssh_tunnel = None  # type: Optional[object]

try:
    from sshtunnel import SSHTunnelForwarder
except Exception:  # pragma: no cover
    SSHTunnelForwarder = None  # type: ignore
try:
    import paramiko
except Exception:
    paramiko = None

# Global pool for connection reuse (Warm Start)
_db_pool = None
logger = logging.getLogger("db")

def get_db_connection(autocommit: bool = True):
    """Return a pooled MySQL connection; create pool on first use.
    Autocommit is enabled by default but can be disabled for transactions.
    """
    global _db_pool, _ssh_tunnel
    base_config = settings.get_db_config()

    # If SSH tunneling is enabled, ensure the tunnel is started and override host/port
    if getattr(settings, "db_via_ssh", False):
        if SSHTunnelForwarder is None:
            raise RuntimeError("sshtunnel is not installed but BACKEND_DB_VIA_SSH=true. Add 'sshtunnel' to requirements and install.")

        if _ssh_tunnel is None or not getattr(_ssh_tunnel, "is_active", False):
            if not settings.ssh_host or not settings.ssh_user or not settings.ssh_key_path:
                raise RuntimeError("SSH DB mode requires BACKEND_SSH_HOST, BACKEND_SSH_USER and BACKEND_SSH_KEY_PATH in .env")
            tunnel_kwargs = dict(
                ssh_username=settings.ssh_user,
                remote_bind_address=(settings.ssh_remote_bind_host, settings.ssh_remote_bind_port),
                set_keepalive=10.0,
                allow_agent=False,
            )
            # Optional: SSH password support
            if getattr(settings, "ssh_password", None):
                tunnel_kwargs["ssh_password"] = settings.ssh_password
            # Try to load the PEM key explicitly using Paramiko for better compatibility
            pkey_obj = None
            if paramiko is not None and os.path.exists(settings.ssh_key_path or ""):
                key_pw = getattr(settings, "ssh_key_password", None)
                for KeyCls in (
                    getattr(paramiko, "RSAKey", None),
                    getattr(paramiko, "Ed25519Key", None),
                    getattr(paramiko, "ECDSAKey", None),
                    getattr(paramiko, "DSSKey", None),
                ):
                    if KeyCls is None:
                        continue
                    try:
                        pkey_obj = KeyCls.from_private_key_file(settings.ssh_key_path, password=key_pw)
                        break
                    except Exception:
                        # Try next key type
                        pass
            # Fall back to path if explicit load failed
            if pkey_obj is not None:
                tunnel_kwargs["ssh_pkey"] = pkey_obj
            else:
                tunnel_kwargs["ssh_pkey"] = settings.ssh_key_path
            # If a passphrase is set, inform sshtunnel
            if getattr(settings, "ssh_key_password", None):
                tunnel_kwargs["ssh_private_key_password"] = settings.ssh_key_password
            
            _ssh_tunnel = SSHTunnelForwarder(
                (settings.ssh_host, settings.ssh_port),
                **tunnel_kwargs,
            )
            _ssh_tunnel.start()

            # Stop tunnel on process exit
            def _stop_tunnel():
                try:
                    if _ssh_tunnel and getattr(_ssh_tunnel, "is_active", False):
                        _ssh_tunnel.stop()
                except Exception:
                    pass

            atexit.register(_stop_tunnel)

        effective_host = "127.0.0.1"
        effective_port = int(getattr(_ssh_tunnel, "local_bind_port", 3306))
    else:
        effective_host = base_config.get("host")
        effective_port = base_config.get("port")

    config = dict(base_config)
    config.update({"host": effective_host, "port": effective_port})

    # Create pool lazily
    if _db_pool is None:
        try:
            _db_pool = pooling.MySQLConnectionPool(
                pool_name="kassa_pool",
                pool_size=5,
                **config,
            )
        except mysql.connector.Error as e:
            # Fallback: try creating the pool again with a unique name
            logger.warning(f"[db] Initial pool creation failed, retrying with unique name: {e}")
            _db_pool = pooling.MySQLConnectionPool(
                pool_name=f"kassa_pool_{uuid.uuid4().hex[:8]}",
                pool_size=5,
                **config,
            )

    conn = _db_pool.get_connection()
    # Ensure connection liveness
    try:
        conn.ping(reconnect=True, attempts=3, delay=1)
    except Exception as e:
        # If ping fails, get a fresh connection from pool
        try:
            conn.close()
        except Exception as ce:
            logger.warning(f"[db] Closing dead connection failed: {ce}")
        conn = _db_pool.get_connection()
        try:
            conn.ping(reconnect=True, attempts=3, delay=1)
        except Exception as e2:
            logger.warning(f"[db] Second ping attempt failed: {e2}")

    # Set autocommit as requested
    try:
        conn.autocommit = autocommit
    except Exception as e:
        logger.warning(f"[db] Failed to set autocommit={autocommit}: {e}")

    return conn
