from fastapi import APIRouter
from pydantic import BaseModel
from app.core.security import create_access_token

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post('/login')
def login(data: LoginRequest):
    # Placeholder: replace with real user verification
    token = create_access_token(subject=data.email)
    return {'access_token': token, 'token_type': 'bearer'}
