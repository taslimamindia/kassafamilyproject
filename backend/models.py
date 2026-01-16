from typing import Optional, Union, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator

class EmptyToNoneMixin:
    """Mixin to convert empty strings to None."""
    @field_validator('*', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    identifier: str
    password: str

class UserBase(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    telephone: Optional[str] = None
    birthday: Optional[str] = None
    image_url: Optional[str] = None
    # 'male' | 'female'
    gender: Optional[str] = None
    contribution_tier: Optional[str] = None

class UserUpdate(UserBase):
    pass
    # Validator inherited via Mixin? No, field_validator needs to be applied to specific fields or *
    
    @field_validator('email', 'telephone', 'birthday', 'image_url', 'gender', 'contribution_tier', mode='before')
    @classmethod
    def _empty_to_none(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        if isinstance(v, str):
            vv = v.strip().lower()
            if vv not in ("male", "female"):
                return v  # ignore strict validation here; DB may accept broader values
            return vv
        return v

class UserCreate(UserBase):
    firstname: str
    lastname: str
    username: Optional[str] = None # Generated mostly
    isactive: Optional[int] = 0
    isfirstlogin: Optional[int] = 1
    id_father: Optional[int] = None
    id_mother: Optional[int] = None

    @field_validator('email', 'telephone', 'birthday', 'image_url', 'gender', 'contribution_tier', mode='before')
    @classmethod
    def _empty_to_none(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        if isinstance(v, str):
            vv = v.strip().lower()
            if vv in ("male", "female"):
                return vv
            return v
        return v

class UserAdminUpdate(UserBase):
    id_father: Optional[int] = None
    id_mother: Optional[int] = None
    isactive: Optional[int] = None
    isfirstlogin: Optional[int] = None

    @field_validator('email', 'telephone', 'birthday', 'image_url', 'gender', 'contribution_tier', mode='before')
    @classmethod
    def _empty_to_none(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        if isinstance(v, str):
            vv = v.strip().lower()
            if vv in ("male", "female"):
                return vv
            return v
        return v

class UserBulkTierUpdate(BaseModel):
    user_ids: List[int]
    contribution_tier: Optional[str] = None

class Role(BaseModel):
    id: Optional[int] = None
    role: str

class RoleAttributionCreate(BaseModel):
    users_id: int
    roles_id: int

class RoleAttributionBulkCreate(BaseModel):
    users_ids: List[int]
    roles_id: int

class Message(BaseModel):
    id: int
    message: Optional[str] = None
    message_type: Optional[str] = None
    received_at: datetime
    isread: int
    sended_by_id: Optional[int] = None
    received_by_id: Optional[int] = None
    link: Optional[str] = None

class MessageCreate(BaseModel):
    message: str
    recipient_type: str  # 'support', 'board', 'treasury', 'member'
    # For members we can accept a single id or a list of ids
    recipient_id: Optional[Union[int, List[int]]] = None
