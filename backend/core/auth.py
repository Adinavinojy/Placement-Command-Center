import json
from pathlib import Path
import uuid
import hashlib

USERS_FILE = Path("users.json")
SESSIONS_FILE = Path("sessions.json")

def _load_sessions():
    if not SESSIONS_FILE.exists():
        return {}
    try:
        return json.loads(SESSIONS_FILE.read_text(encoding="utf-8"))
    except:
        return {}

def _save_sessions(sessions: dict):
    SESSIONS_FILE.write_text(json.dumps(sessions, indent=2), encoding="utf-8")

def _load_users():
    if not USERS_FILE.exists():
        return {}
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except:
        return {}

def _save_users(users: dict):
    USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def register_or_update_user(email: str, name: str, password_hash: str = None) -> dict:
    users = _load_users()
    is_new_user = email not in users
    if is_new_user:
        users[email] = {"name": name, "password": password_hash}
    else:
        if password_hash:
            users[email]["password"] = password_hash
        if name:
            users[email]["name"] = name
    _save_users(users)
    
    # Initialize their vault and db if they don't exist yet
    from core.vault import init_vault, get_vault_path
    from core.db import init as init_db
    
    user_vault = get_vault_path(email)
    if not user_vault.exists():
        init_vault(email)
        init_db(email)
        
    return users[email]

def verify_local_login(email: str, password: str) -> bool:
    users = _load_users()
    if email not in users:
        return False
    user = users[email]
    if user.get("password") == hash_password(password):
        return True
    return False

def requires_password(email: str) -> bool:
    users = _load_users()
    if email not in users:
        return True
    return not bool(users[email].get("password"))

def create_session(email: str) -> str:
    token = str(uuid.uuid4())
    sessions = _load_sessions()
    sessions[token] = email
    _save_sessions(sessions)
    return token

def get_email_from_token(token: str) -> str:
    sessions = _load_sessions()
    return sessions.get(token)

def change_password(email: str, current_pass: str, new_pass: str) -> bool:
    users = _load_users()
    if email not in users:
        return False
    user = users[email]
    if user.get("password") == hash_password(current_pass):
        user["password"] = hash_password(new_pass)
        _save_users(users)
        return True
    return False
