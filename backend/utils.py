from fastapi import Request, UploadFile
from typing import Optional, Tuple
from datetime import datetime
import logging

logger = logging.getLogger("users")

async def parse_create_request(request: Request) -> Tuple[dict, Optional[UploadFile]]:
    """Helper to parse mixed JSON/Form data for creation."""
    try:
        form = await request.form()
        if form:
            logger.info("[users] parse_create_request: CT=%s; keys=%s", request.headers.get("content-type"), list(form.keys()))
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
            }
            upload = form.get("file")
            logger.info("[users] parse_create_request: form['file'] type=%s", type(upload).__name__ if upload is not None else None)
            # Consider file present only if it has a non-empty filename
            if not getattr(upload, "filename", None):
                upload = None
            # Read client intent flag (do not include in returned data)
            with_image_raw = form.get("with_image")
            try:
                with_image = int(with_image_raw) if with_image_raw not in (None, "") else 0
            except Exception:
                with_image = 0
            logger.info("[users] create intent: with_image=%s, upload_present=%s", with_image, bool(upload))
            if with_image == 1 and not upload:
                logger.warning("[users] intent mismatch: with_image=1 but no file provided")
            if with_image == 0 and upload:
                logger.warning("[users] intent mismatch: with_image=0 but file provided")
            return data, upload
    except Exception as e:
        logger.warning("[users] parse_create_request: failed to parse form; CT=%s; err=%s", request.headers.get("content-type"), e)
        
    try:
        json_body = await request.json()
        if isinstance(json_body, dict):
            with_image_raw = json_body.get("with_image")
            try:
                with_image = int(with_image_raw) if with_image_raw not in (None, "") else 0
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
            logger.info("[users] parse_update_request: CT=%s; keys=%s", request.headers.get("content-type"), list(form.keys()))
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
                remove_image = str(remove_image_raw).strip().lower() in {"1", "true", "yes", "on"}
            if remove_image:
                data["remove_image"] = True
            upload = form.get("file")
            logger.info("[users] parse_update_request: form['file'] type=%s", type(upload).__name__ if upload is not None else None)
            # Consider file present only if it has a non-empty filename
            if not getattr(upload, "filename", None):
                upload = None
            # Read client intent flag (do not include in returned data)
            with_image_raw = form.get("with_image")
            try:
                with_image = int(with_image_raw) if with_image_raw not in (None, "") else 0
            except Exception:
                with_image = 0
            logger.info("[users] update intent: with_image=%s, upload_present=%s", with_image, bool(upload))
            if with_image == 1 and not upload:
                logger.warning("[users] intent mismatch: with_image=1 but no file provided")
            if with_image == 0 and upload:
                logger.warning("[users] intent mismatch: with_image=0 but file provided")
            return data, upload
    except Exception as e:
        logger.warning("[users] parse_update_request: failed to parse form; CT=%s; err=%s", request.headers.get("content-type"), e)
    try:
        json_body = await request.json()
        if isinstance(json_body, dict):
            with_image_raw = json_body.get("with_image")
            try:
                with_image = int(with_image_raw) if with_image_raw not in (None, "") else 0
            except Exception:
                with_image = 0
            logger.info("[users] update intent (JSON): with_image=%s", with_image)
            jb = dict(json_body)
            if "remove_image" in jb:
                rem = jb.get("remove_image")
                if isinstance(rem, str):
                    jb["remove_image"] = rem.strip().lower() in {"1", "true", "yes", "on"}
                else:
                    jb["remove_image"] = bool(rem)
            jb.pop("with_image", None)
            return jb, None
    except Exception as e:
        logger.warning("[users] parse_update_request: failed to parse json; err=%s", e)
    return {}, None

def _base_username_from_names(firstname: str, lastname: str, birthday: Optional[str]) -> str:
    parts = []
    if firstname:
        parts.extend([p for p in firstname.strip().split() if p])
    if lastname:
        parts.extend([p for p in lastname.strip().split() if p])
    initials = ''.join([p[0].lower() for p in parts if p])
    year = ''
    try:
        if birthday:
            year = str(datetime.fromisoformat(birthday).year)
    except Exception:
        year = ''
    return (initials + year).strip()

def ensure_unique_username(desired: str, cursor, exclude_user_id: Optional[int] = None, max_tries: int = 1000) -> str:
    """Ensure uniqueness by appending a numeric suffix when needed.
    If `exclude_user_id` is provided, the current user's username won't count as a collision.
    """
    import string
    base = (desired or '').strip()
    if base == '':
        raise ValueError("Nom d'utilisateur vide")
    # Try without suffix first
    candidate = base
    cursor.execute("SELECT id FROM users WHERE username = %s LIMIT 1", (candidate,))
    row = cursor.fetchone()
    if not row:
        return candidate
    if exclude_user_id is not None:
        found_id = row[0] if not isinstance(row, dict) else row.get('id')
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
            found_id = row[0] if not isinstance(row, dict) else row.get('id')
            if found_id == exclude_user_id:
                return candidate

    # Try with a-z and numeric suffix
    for letter in string.ascii_lowercase:
        for i in range(1, max_tries):
            candidate = f"{base}{letter}{i}"
            cursor.execute("SELECT id FROM users WHERE username = %s LIMIT 1", (candidate,))
            row = cursor.fetchone()
            if not row:
                return candidate
            if exclude_user_id is not None:
                found_id = row[0] if not isinstance(row, dict) else row.get('id')
                if found_id == exclude_user_id:
                    return candidate
    raise ValueError("Impossible de générer un nom d'utilisateur unique")

def generate_username_logic(firstname: str, lastname: str, birthday: Optional[str], cursor) -> str:
    base = _base_username_from_names(firstname, lastname, birthday)
    return ensure_unique_username(base, cursor)