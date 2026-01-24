from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import httpx
from dependencies import get_cursor, get_current_user
from models import Message, MessageCreate, MessageUserInfo
from settings import settings


router = APIRouter()


async def validate_message_with_ai(content: str) -> bool:
    if not settings.fireworks_api_key:
        return True

    url = "https://api.fireworks.ai/inference/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.fireworks_api_key}",
        "Content-Type": "application/json"
    }
    
    prompt = (
        "Classify the following message as SAFE or UNSAFE.\n"
        "SAFE: Appropriate content.\n"
        "UNSAFE: Hate speech, violence, sexual content, harassment.\n"
        "Reply ONLY with the word SAFE or UNSAFE. Do not provide explanations.\n\n"
        f"Message: \"{content}\""
    )
    
    payload = {
        "model": settings.fireworks_model_name or "accounts/fireworks/models/llama-v3-8b-instruct",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1000,
        "temperature": 0.0
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            if response.status_code == 200:
                result = response.json()
                if "choices" in result and len(result["choices"]) > 0:
                    message_obj = result["choices"][0]["message"]
                    # Get content safely
                    answer = message_obj.get("content", "") or ""
                    answer = answer.strip().upper()
                    
                    # Check for UNSAFE
                    if "UNSAFE" in answer:
                        return False
            return False
    except Exception as e:
        return False


@router.get("/messages", response_model=List[Message])
async def get_my_messages(
    cursor = Depends(get_cursor), 
    current_user: dict = Depends(get_current_user),
    last_id: Optional[int] = Query(0, description="ID du dernier message reçu pour l'optimisation")
):
    user_id = current_user["id"]
    
    query = """
        SELECT m.id, m.message, m.message_type, m.received_at, m.link, 
            mr.isreaded as isread, mr.sender_id as sended_by_id, mr.receiver_id as received_by_id
        FROM messages m
        JOIN messages_recipients mr ON m.id = mr.messages_id
        WHERE mr.receiver_id = %s 
    """
    params = [user_id]

    if last_id and last_id > 0:
        query += " AND m.id > %s "
        params.append(last_id)

    query += " ORDER BY m.received_at DESC"

    await cursor.execute(query, tuple(params))
    rows = await cursor.fetchall()
    return rows


@router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: int, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    # Verify ownership in the join table
    await cursor.execute("""
        SELECT id FROM messages_recipients 
        WHERE messages_id = %s AND receiver_id = %s
    """, (message_id, user_id))
    
    rec_record = await cursor.fetchone()
    if not rec_record:
        # Check if message exists to differentiate 404 vs 403/other
        # But keeping it simple for now
        raise HTTPException(status_code=404, detail="Message not found associated with this user")
    
    await cursor.execute("UPDATE messages_recipients SET isreaded = 1 WHERE id = %s", (rec_record['id'],))
    await cursor.commit()
    return {"status": "success"}


@router.put("/messages/read-all")
async def mark_all_messages_read(cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    await cursor.execute("""
        UPDATE messages_recipients 
        SET isreaded = 1 
        WHERE receiver_id = %s AND isreaded = 0
    """, (user_id,))
    await cursor.commit()
    return {"status": "success"}


@router.post("/messages")
async def send_message(msg: MessageCreate, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    # AI Moderation Check
    if not await validate_message_with_ai(msg.message):
        raise HTTPException(status_code=400, detail="Le contenu du message est inapproprié et a été bloqué.")

    user_id = current_user["id"]
    target_users_ids = []

    if msg.recipient_type == 'member':
        if not msg.recipient_id:
            raise HTTPException(status_code=400, detail="Le champ recipient_id est requis pour les membres.")
        # recipient_id may be a single int or a list of ints
        if isinstance(msg.recipient_id, list):
            target_users_ids.extend(msg.recipient_id)
        else:
            target_users_ids.append(msg.recipient_id)
    else:
        role_map = {
            'support': 'admin',
            'board': 'board',
            'treasury': 'treasury'
        }
        role_name = role_map.get(msg.recipient_type)
        if not role_name:
            raise HTTPException(status_code=400, detail="Type de destinataire invalide")
        
        # Find role ID first (optional, but safer to join) or join directly
        # users_id is in role_attribution
        await cursor.execute("""
            SELECT ra.users_id 
            FROM role_attribution ra
            JOIN roles r ON r.id = ra.roles_id
            WHERE r.role = %s
        """, (role_name,))
        rows = await cursor.fetchall()
        target_users_ids = [r['users_id'] for r in rows]
    
    if not target_users_ids:
        # If no one has the role, maybe we should warn? For now let's just return success or error
        pass

    created_at = datetime.now()
    message_type = 'MESSAGE'

    # Insert message once
    await cursor.execute("""
        INSERT INTO messages (message, message_type, received_at)
        VALUES (%s, %s, %s)
    """, (msg.message, message_type, created_at))
    
    # Get the last inserted ID
    await cursor.execute("SELECT LAST_INSERT_ID() as id")
    res = await cursor.fetchone()
    new_message_id = res['id']

    # We need to manually generate IDs for messages_recipients because it lacks AUTO_INCREMENT in the provided schema
    # Ideally should be fixed in DB schema. Here we do a best-effort approach:
    # Get max id
    await cursor.execute("SELECT MAX(id) as max_id FROM messages_recipients")
    row = await cursor.fetchone()
    next_id = (row['max_id'] or 0) + 1

    for dest_id in target_users_ids:
        await cursor.execute("""
            INSERT INTO messages_recipients (id, isreaded, sender_id, receiver_id, messages_id)
            VALUES (%s, 0, %s, %s, %s)
        """, (next_id, user_id, dest_id, new_message_id))
        next_id += 1
    
    await cursor.commit()
    return {"status": "success", "count": len(target_users_ids)}


@router.get("/messages/{message_id}/user-info", response_model=MessageUserInfo)
async def get_user_message_info(message_id: int, cursor = Depends(get_cursor), current_user: dict = Depends(get_current_user)):
    """Return minimal sender info for a message the current user received.

    Requires authentication and that the current user is the receiver for the given message.
    """
    user_id = current_user["id"]
    # Ensure the message belongs to current user as receiver and get sender
    await cursor.execute(
        """
        SELECT sender_id, receiver_id
        FROM messages_recipients
        WHERE messages_id = %s AND receiver_id = %s
        """,
        (message_id, user_id),
    )
    rec = await cursor.fetchone()
    if not rec:
        # Either message doesn't exist or not addressed to this user
        raise HTTPException(status_code=403, detail="Not authorized for this message")

    sender_id = rec["sender_id"]
    receiver_id = rec["receiver_id"]

    # Fetch minimal sender info
    await cursor.execute(
        """
        SELECT id, firstname, lastname, image_url
        FROM users
        WHERE id = %s
        """,
        (sender_id,),
    )
    sender = await cursor.fetchone()
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")

    return {
        "message_id": message_id,
        "receiver_id": receiver_id,
        "sender": sender,
    }
