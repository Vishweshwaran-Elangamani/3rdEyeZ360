from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserModel(BaseModel):
    user_id: str
    keycloak_id: str
    name: str
    email: str
    role: str
    status: str = "Active"
    created_at: datetime = None
    last_login: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True