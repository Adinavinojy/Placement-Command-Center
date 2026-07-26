import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for i, line in enumerate(lines):
        if 'def ' in line and 'Depends(get_current_user)' in line:
            # We want to extract `email: str = Depends(get_current_user)` and move it to the end of the argument list.
            # Example: `def add_company(email: str = Depends(get_current_user), data: CompanyData):`
            
            # Simple string manipulation
            start = line.find('(')
            end = line.rfind(')')
            if start != -1 and end != -1:
                args_str = line[start+1:end]
                # Split by comma but be careful with Depends(get_current_user) having parens
                # A simple hack: replace Depends(get_current_user) with a token
                args_str = args_str.replace('Depends(get_current_user)', 'DEPENDS_TOKEN')
                args = [a.strip() for a in args_str.split(',') if a.strip()]
                
                # Find the email arg
                email_arg_idx = -1
                for j, arg in enumerate(args):
                    if 'DEPENDS_TOKEN' in arg:
                        email_arg_idx = j
                        break
                        
                if email_arg_idx != -1 and len(args) > 1 and email_arg_idx != len(args) - 1:
                    email_arg = args.pop(email_arg_idx)
                    args.append(email_arg)
                    
                    new_args_str = ', '.join(args).replace('DEPENDS_TOKEN', 'Depends(get_current_user)')
                    lines[i] = line[:start+1] + new_args_str + line[end:]
                    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)

fix_file('backend/main.py')
print("Fixed!")
