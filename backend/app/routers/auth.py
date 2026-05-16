from fastapi import APIRouter, HTTPException, status
from app.schemas.auth import LoginRequest, LoginResponse
from app.auth import create_token
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    if req.password != settings.app_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Senha incorreta")
    return LoginResponse(token=create_token())
