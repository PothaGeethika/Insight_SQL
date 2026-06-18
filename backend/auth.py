"""
JWT authentication helpers for the FastAPI backend.

The frontend signs JWTs using the same JWT_SECRET used in the Next.js API routes.
The backend verifies these tokens to protect every endpoint.
"""

import os
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from logger_config import get_logger

log = get_logger("auth")

JWT_SECRET = os.getenv("JWT_SECRET", "insightsql_jwt_secret_key_2025_secure")
JWT_ALGORITHM = "HS256"


def _extract_token(request: Request) -> str | None:
    # 1. Try Authorization: Bearer <token> header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    # 2. Try auth_token cookie (set by Next.js login route)
    return request.cookies.get("auth_token")


def get_current_user(request: Request) -> dict:
    """FastAPI dependency – returns decoded JWT payload or raises 401."""
    token = _extract_token(request)
    if not token:
        log.warning("[AUTH] Request rejected – no token provided.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("id") or payload.get("sub")
        if not user_id:
            raise JWTError("Missing subject claim")
        log.debug("[AUTH] Authenticated user id=%s  email=%s", user_id, payload.get("email"))
        return {"id": user_id, "email": payload.get("email"), "name": payload.get("name")}
    except JWTError as e:
        log.warning("[AUTH] Token validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
