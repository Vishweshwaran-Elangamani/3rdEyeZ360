from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserModel(BaseModel):
    user_id: str
    keycloak_id: str
    name: str
    first_name: str
    last_name: str
    email: EmailStr
    role: str
    status: str = "Active"
    created_at: datetime = None
    last_login: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True