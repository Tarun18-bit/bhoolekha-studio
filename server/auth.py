"""
Simple role-based access control for the workbench.

Roles (separation of duties):
  operator  - ingests scans, corrects fields, adds missed holders/plots
  verifier  - everything an operator can do on a record, plus resolves discrepancies and approves (seals)
  admin     - everything, plus user listing

Tokens are HMAC-SHA256 signed "username|expiry" strings (stateless, no extra dependency).
Passwords are PBKDF2-SHA256 with a per-user salt.
"""
import base64
import contextvars
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import Depends, Header, HTTPException
from sqlalchemy import Column, String
from sqlalchemy.orm import Session

from database import Base, get_db

TOKEN_TTL_SECONDS = 12 * 3600
_SECRET_FILE = Path(__file__).parent / ".auth_secret"

ROLE_PERMISSIONS = {
    "operator": {"ingest", "edit", "read"},
    "verifier": {"edit", "resolve", "approve", "read"},
    "admin": {"ingest", "edit", "resolve", "approve", "read", "admin"},
}

# Who is acting in the current request. The audit-chain hook reads this so every
# audit entry carries the real logged-in officer, whatever the calling code passed.
current_officer: contextvars.ContextVar[Optional[Dict[str, Any]]] = contextvars.ContextVar("current_officer", default=None)


class AppUser(Base):
    __tablename__ = "app_users"
    username = Column(String(64), primary_key=True)
    display_name = Column(String(128), nullable=False)
    designation = Column(String(128), nullable=False)
    role = Column(String(16), nullable=False)
    officer_id = Column(String(64), nullable=False)
    salt = Column(String(64), nullable=False)
    pw_hash = Column(String(128), nullable=False)

    def public(self) -> Dict[str, Any]:
        return {"username": self.username, "displayName": self.display_name, "designation": self.designation,
                "role": self.role, "officerId": self.officer_id,
                "permissions": sorted(ROLE_PERMISSIONS.get(self.role, set()))}


def _secret() -> bytes:
    env = os.getenv("AUTH_SECRET")
    if env:
        return env.encode()
    if not _SECRET_FILE.exists():
        _SECRET_FILE.write_text(secrets.token_hex(32))
    return _SECRET_FILE.read_text().strip().encode()


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()


# Demo accounts. Override the shared password with DEMO_PASSWORD in server/.env.
DEMO_USERS = [
    ("operator", "Data Entry Operator", "Tehsil Record Room", "operator", "OPR-001"),
    ("verifier", "Naib Tehsildar", "Revenue Verifier", "verifier", "VER-001"),
    ("admin", "District Admin", "DLRC Administrator", "admin", "ADM-001"),
]


def seed_users(db: Session):
    pw = os.getenv("DEMO_PASSWORD", "demo@123")
    for username, name, desig, role, oid in DEMO_USERS:
        if db.query(AppUser).filter(AppUser.username == username).first():
            continue
        salt = secrets.token_hex(16)
        db.add(AppUser(username=username, display_name=name, designation=desig, role=role,
                       officer_id=oid, salt=salt, pw_hash=hash_password(pw, salt)))
    db.commit()


def authenticate(db: Session, username: str, password: str) -> Optional[AppUser]:
    u = db.query(AppUser).filter(AppUser.username == (username or "").strip().lower()).first()
    if not u:
        return None
    if not hmac.compare_digest(u.pw_hash, hash_password(password or "", u.salt)):
        return None
    return u


def issue_token(username: str) -> str:
    payload = json.dumps({"u": username, "exp": int(time.time()) + TOKEN_TTL_SECONDS}).encode()
    body = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    sig = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def _read_token(token: str) -> Optional[str]:
    try:
        body, sig = token.split(".", 1)
        good = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, good):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        if payload.get("exp", 0) < time.time():
            return None
        return payload.get("u")
    except Exception:
        return None


def require(permission: str):
    """FastAPI dependency: the caller must be logged in and hold `permission`."""
    async def dep(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)) -> AppUser:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Login required.")
        username = _read_token(authorization[7:].strip())
        user = db.query(AppUser).filter(AppUser.username == username).first() if username else None
        if not user:
            raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")
        if permission not in ROLE_PERMISSIONS.get(user.role, set()):
            raise HTTPException(status_code=403,
                                detail=f"Your role ({user.role}) is not allowed to {permission}.")
        current_officer.set({"id": user.officer_id, "name": user.display_name, "designation": user.designation,
                             "role": user.role, "username": user.username})
        return user
    return dep
