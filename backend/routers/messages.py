from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from models_orm.dependencies import get_db, get_current_user
from models import Message, MessageCreate, MessageUserInfo
from models_orm.users import Users
from models_orm.messaging import Messages, MessageRecipients
from models_orm.access_control import Roles, RoleAttribution
from settings import settings
import httpx
import logging


router = APIRouter()
logger = logging.getLogger("Messages")


async def send_notification(
    db: Session,
    recipient_ids: List[int],
    message_text: str,
    sender_id: Optional[int] = None,
    message_type: str = "MESSAGE",
    link: Optional[str] = None,
    exclude_sender: bool = True,
):
    """
    Sends a message to a list of recipients.
    Handles 'messages' insertion and 'messages_recipients' entries.
    Auto-excludes sender_id from recipient_ids if present (unless exclude_sender=False).
    """
    
    if sender_id is None:
        try:
            sys_row = db.query(Users.id).filter(Users.username == "system").first()
            sender_id = int(sys_row[0]) if sys_row else 1
        except Exception:
            logger.error("Failed to resolve system sender ID")
            raise HTTPException(status_code=500, detail="Failed to resolve system sender ID")
    
    if not recipient_ids:
        return

    # Filter out sender if present, and remove duplicates
    targets = set(recipient_ids)
    if exclude_sender and sender_id is not None and sender_id in targets:
        try:
            targets.remove(sender_id)
        except KeyError:
            raise HTTPException(
                status_code=500, detail="Error excluding sender from recipients"
            )

    if not targets:
        return

    now = datetime.now()
    try:
        # Create message ORM object
        msg_obj = Messages(
            message=message_text, message_type=message_type, received_at=now, link=link
        )
        db.add(msg_obj)
        db.flush()  # obtain msg_obj.id

        # Create recipients via ORM
        for receiver_id in targets:
            # ensure sender_id not None for schema constraints; keep None -> 0 if required
            sid = sender_id if sender_id is not None else 0
            rec = MessageRecipients(
                isreaded=0,
                sender_id=sid,
                receiver_id=int(receiver_id),
                messages_id=msg_obj.id,
            )
            db.add(rec)

        logger.info(f"Notification sent to {len(targets)} recipients.")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"[utils] send_notification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {e}")


async def validate_message_with_ai(content: str) -> bool:
    if not settings.fireworks_api_key:
        return True

    url = "https://api.fireworks.ai/inference/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.fireworks_api_key}",
        "Content-Type": "application/json",
    }

    prompt = (
        "Classify the following message as SAFE or UNSAFE.\n"
        "SAFE: Appropriate content.\n"
        "UNSAFE: Hate speech, violence, sexual content, harassment.\n"
        "Reply ONLY with the word SAFE or UNSAFE. Do not provide explanations.\n\n"
        f'Message: "{content}"'
    )

    payload = {
        "model": settings.fireworks_model_name
        or "accounts/fireworks/models/llama-v3-8b-instruct",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1000,
        "temperature": 0.0,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url, json=payload, headers=headers, timeout=10.0
            )
            if response.status_code == 200:
                result = response.json()
                if "choices" in result and len(result["choices"]) > 0:
                    message_obj = result["choices"][0].get("message", {})
                    # Get content safely
                    answer = (message_obj.get("content") or "").strip().upper()

                    # Reject only when explicitly UNSAFE
                    if "UNSAFE" in answer:
                        return False
                    # Accept if explicitly SAFE or unclear
                    return True
            # If the moderation service doesn't respond as expected, be permissive
            return True
    except Exception:
        # On moderation failure, default to allowing the message
        return True


@router.get("/messages", response_model=List[Message])
async def get_my_messages(
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
    last_id: Optional[int] = Query(
        0, description="ID du dernier message reçu pour l'optimisation"
    ),
):
    user_id = int(current_user.id)
    # Query recipients joined with messages
    q = (
        db.query(MessageRecipients)
        .join(Messages)
        .filter(MessageRecipients.receiver_id == user_id)
    )
    if last_id and last_id > 0:
        q = q.filter(Messages.id > int(last_id))
    q = q.order_by(Messages.received_at.desc())

    results = q.all()
    out = []
    for mr in results:
        m = mr.message
        out.append(
            {
                "id": m.id,
                "message": m.message,
                "message_type": m.message_type,
                "received_at": m.received_at,
                "link": m.link,
                "isread": mr.isreaded,
                "sended_by_id": mr.sender_id,
                "received_by_id": mr.receiver_id,
            }
        )
    return out


@router.put("/messages/{message_id}/read")
async def mark_message_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    user_id = int(current_user.id)
    # Verify ownership in the join table
    rec = (
        db.query(MessageRecipients)
        .filter(
            MessageRecipients.messages_id == message_id,
            MessageRecipients.receiver_id == user_id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(
            status_code=404, detail="Message not found associated with this user"
        )

    rec.isreaded = 1
    db.commit()
    return {"status": "success"}


@router.put("/messages/read-all")
async def mark_all_messages_read(
    db: Session = Depends(get_db), current_user: Users = Depends(get_current_user)
):
    user_id = int(current_user.id)
    try:
        db.query(MessageRecipients).filter(
            MessageRecipients.receiver_id == user_id, MessageRecipients.isreaded == 0
        ).update({MessageRecipients.isreaded: 1}, synchronize_session=False)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to mark messages as read")
    return {"status": "success"}


@router.post("/messages")
async def send_message(
    msg: MessageCreate,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    # AI Moderation Check
    if not await validate_message_with_ai(msg.message):
        raise HTTPException(
            status_code=400,
            detail="Le contenu du message est inapproprié et a été bloqué.",
        )

    user_id = int(current_user.id)
    target_users_ids = []

    if msg.recipient_type == "member":
        if not msg.recipient_id:
            raise HTTPException(
                status_code=400,
                detail="Le champ recipient_id est requis pour les membres.",
            )
        # recipient_id may be a single int or a list of ints
        if isinstance(msg.recipient_id, list):
            target_users_ids.extend(msg.recipient_id)
        else:
            target_users_ids.append(msg.recipient_id)
    else:
        role_map = {"support": "admin", "board": "board", "treasury": "treasury"}
        role_name = role_map.get(msg.recipient_type)
        if not role_name:
            raise HTTPException(status_code=400, detail="Type de destinataire invalide")

        # Use ORM to find users with the given role
        ras = (
            db.query(RoleAttribution)
            .join(Roles, RoleAttribution.roles_id == Roles.id)
            .filter(Roles.role == role_name)
            .all()
        )
        target_users_ids = [int(r.users_id) for r in ras]

    if not target_users_ids:
        raise HTTPException(status_code=400, detail="Aucun destinataire valide trouvé.")

    created_at = datetime.now()
    message_type = "MESSAGE"

    try:
        # Create message ORM object
        msg_obj = Messages(
            message=msg.message, message_type=message_type, received_at=created_at
        )
        db.add(msg_obj)
        db.flush()

        # Create recipients
        for dest_id in target_users_ids:
            rec = MessageRecipients(
                isreaded=0,
                sender_id=user_id,
                receiver_id=int(dest_id),
                messages_id=msg_obj.id,
            )
            db.add(rec)

        db.commit()
        return {"status": "success", "count": len(target_users_ids)}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"send_message failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")


@router.get("/messages/{message_id}/user-info", response_model=MessageUserInfo)
async def get_user_message_info(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: Users = Depends(get_current_user),
):
    """Return minimal sender info for a message the current user received.

    Requires authentication and that the current user is the receiver for the given message.
    """
    user_id = int(current_user.id)
    # Ensure the message belongs to current user as receiver and get sender
    rec = (
        db.query(MessageRecipients)
        .filter(
            MessageRecipients.messages_id == message_id,
            MessageRecipients.receiver_id == user_id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(status_code=403, detail="Not authorized for this message")

    sender_id = int(rec.sender_id)
    receiver_id = int(rec.receiver_id)

    sender_obj = db.query(Users).filter(Users.id == sender_id).first()
    if not sender_obj:
        raise HTTPException(status_code=404, detail="Sender not found")

    sender = {
        "id": sender_obj.id,
        "firstname": getattr(sender_obj, "firstname", None),
        "lastname": getattr(sender_obj, "lastname", None),
        "image_url": getattr(sender_obj, "image_url", None),
    }

    return {
        "message_id": message_id,
        "receiver_id": receiver_id,
        "sender": sender,
    }
