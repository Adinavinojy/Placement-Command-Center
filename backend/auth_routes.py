from fastapi import APIRouter
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests

class LoginRequest(BaseModel):
    username: str
    password: str

class GoogleLoginRequest(BaseModel):
    token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class SetPasswordRequest(BaseModel):
    password: str

CLIENT_ID = "280196074572-8q2p3a92dtiddin028jahplpfe0blnpn.apps.googleusercontent.com"

# Define the endpoints inside a function so we can attach them to app
def add_auth_routes(app):
    from core.auth import (
        verify_local_login, 
        create_session, 
        register_or_update_user,
        requires_password,
        change_password
    )
    from main import get_current_user
    from fastapi import Depends, HTTPException

    @app.post("/api/auth/login")
    def login(req: LoginRequest):
        if verify_local_login(req.username, req.password):
            token = create_session(req.username)
            return {"token": token, "user": {"name": req.username}, "requires_password": False}
        raise HTTPException(status_code=401, detail="Invalid credentials")

    @app.post("/api/auth/google")
    def google_login(req: GoogleLoginRequest):
        try:
            idinfo = id_token.verify_oauth2_token(req.token, requests.Request(), CLIENT_ID)
            email = idinfo['email']
            name = idinfo.get('name', email.split('@')[0])
            
            # Register them if they don't exist
            register_or_update_user(email, name)
            
            token = create_session(email)
            return {
                "token": token, 
                "user": {"name": name}, 
                "requires_password": requires_password(email)
            }
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Google verification failed: {str(e)}")

    @app.post("/api/auth/set_password")
    def set_password(req: SetPasswordRequest, email: str = Depends(get_current_user)):
        # Allow setting password if they don't have one
        if requires_password(email):
            from core.auth import _load_users, _save_users, hash_password
            users = _load_users()
            users[email]["password"] = hash_password(req.password)
            _save_users(users)
            return {"status": "success"}
        raise HTTPException(status_code=400, detail="Password already set")

    @app.post("/api/auth/change_password")
    def change_pwd(req: ChangePasswordRequest, email: str = Depends(get_current_user)):
        if change_password(email, req.current_password, req.new_password):
            return {"status": "success"}
        raise HTTPException(status_code=400, detail="Invalid current password")
