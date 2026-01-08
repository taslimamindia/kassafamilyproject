import mysql.connector
from mysql.connector import pooling
import uuid
from settings import settings
import logging

# Global pool for connection reuse (Warm Start)
_db_pool = None
logger = logging.getLogger("db")

def get_db_connection(autocommit: bool = True):
    """Return a pooled MySQL connection; create pool on first use.
    Autocommit is enabled by default but can be disabled for transactions.
    """
    global _db_pool
    config = settings.get_db_config()

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
