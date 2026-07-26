import re

with open("backend/main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Fix non-default argument following default argument
# Basically if we see `(email: str = Depends(get_current_user), something_else)`
# we should move `email: str = Depends(get_current_user)` to the end of the args.

def fix_args(match):
    # match.group(1) is the whole arg list inside ()
    args = match.group(1)
    if "email: str = Depends(get_current_user)" in args:
        parts = [p.strip() for p in args.split(",") if p.strip()]
        # Remove it
        parts.remove("email: str = Depends(get_current_user)")
        # Add it back at the end
        parts.append("email: str = Depends(get_current_user)")
        return "(" + ", ".join(parts) + ")"
    return "(" + args + ")"

content = re.sub(r'\(([^)]+)\)', fix_args, content)

with open("backend/main.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Syntax fixed!")
