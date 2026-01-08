from fastapi import APIRouter, Depends, HTTPException, status
import logging
from dependencies import get_db_connection, get_cursor, get_current_user
from settings import settings
from auth_utils import hash_password

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

@router.get("/setup-database")
def setup_database(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection(autocommit=False)
    cursor = conn.cursor()
    try:
        # Note: In production you probably do NOT want a route that resets your DB.
        # But keeping it since it's in the original code, perhaps for dev/demo.
        
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
