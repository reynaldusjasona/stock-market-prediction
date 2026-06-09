from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

import os
from dotenv import load_dotenv

load_dotenv()

_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hashPassword(password: str) -> str:
    return _pwd_context.hash(password)


def verifyPassword(plain_password: str, hashed_password: str) -> bool:
    return _pwd_context.verify(plain_password, hashed_password)


def createAccessToken(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(minutes=_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, _SECRET_KEY, algorithm=_ALGORITHM)


def decodeAccessToken(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
    except JWTError:
        return None


_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(_oauth2_scheme)) -> dict:
    payload = decodeAccessToken(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
