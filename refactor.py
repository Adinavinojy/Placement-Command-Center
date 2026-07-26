import re

with open("backend/main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add get_current_user to endpoints that don't have it
def inject_dependency(match):
    decorator = match.group(1)
    func_def = match.group(2)
    
    if "get_current_user" in func_def or "login" in decorator or "get_profile" in func_def:
        return match.group(0)

    # Insert `email: str = Depends(get_current_user)` as the first parameter
    if "(" in func_def and ")" in func_def:
        parts = func_def.split("(", 1)
        params = parts[1].split(")", 1)[0]
        
        if params.strip() == "":
            new_params = "email: str = Depends(get_current_user)"
        else:
            new_params = "email: str = Depends(get_current_user), " + params
            
        new_func_def = parts[0] + "(" + new_params + ")" + parts[1].split(")", 1)[1]
        return f"{decorator}\n{new_func_def}"
    return match.group(0)

# Replace all @app.get/post etc.
content = re.sub(r'(@app\.[a-z]+\("[^"]+"\))\n(async def [a-zA-Z0-9_]+\([^)]*\):|def [a-zA-Z0-9_]+\([^)]*\):)', inject_dependency, content)

# Now, we also need to pass `email` to vault.* and db.* calls.
content = content.replace("vault.VAULT", "vault.get_vault_path(email)")
content = content.replace("db.conn()", "db.conn(email)")

content = re.sub(r'vault\.(\w+)\((?!email)', r'vault.\1(email, ', content)
# Fix cases where vault function took no args: vault.read_timetable(email, ) -> vault.read_timetable(email)
content = content.replace("(email, )", "(email)")

content = re.sub(r'db\.(\w+)\((?!email)', r'db.\1(email, ', content)
content = content.replace("(email, )", "(email)")

# Fix specific manual replacements
content = content.replace('db.conn(email, email)', 'db.conn(email)')
content = content.replace('vault.init_vault(email, target_email)', 'vault.init_vault(target_email)')
content = content.replace('db.init(email, target_email)', 'db.init(target_email)')
content = content.replace('vault.get_vault_path(email, email)', 'vault.get_vault_path(email)')

with open("backend/main.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Refactored main.py successfully!")
