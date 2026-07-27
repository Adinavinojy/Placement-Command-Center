import os
import glob

# The string to find
target = "${import.meta.env.VITE_API_URL || 'http://localhost:8000'}"
# The string to replace with
replacement = "${API_BASE}"

# The import to add
import_str = "import { fetchAuth, API_BASE } from '../api';"
import_str_app = "import { fetchAuth, API_BASE } from './api';"

for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith('.jsx') or file.endswith('.js'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if target in content:
                content = content.replace(target, replacement)
                
                # Update import if API_BASE is missing
                if 'API_BASE' not in content:
                    if "fetchAuth" in content:
                        content = content.replace("import { fetchAuth } from '../api';", import_str)
                        content = content.replace("import { fetchAuth } from './api';", import_str_app)
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Updated {filepath}")
