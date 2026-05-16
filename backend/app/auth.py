from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings

class OAuth2Bearer(HTTPBearer):
    """HTTPBearer that returns 401 (not 403) when credentials are missing."""
    async def __call__(self, request: Request):
        try:
            return await super().__call__(request)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")

bearer = OAuth2Bearer()

def create_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    return jwt.encode({"exp": expire}, settings.secret_key, algorithm=settings.jwt_algorithm)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> bool:
    try:
        jwt.decode(credentials.credentials, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return True
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
