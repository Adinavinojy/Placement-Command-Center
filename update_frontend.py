import os
import re

frontend_files = [
    "frontend/src/App.jsx",
    "frontend/src/components/Assessment.jsx",
    "frontend/src/components/Onboarding.jsx",
    "frontend/src/components/SettingsView.jsx",
    "frontend/src/components/DocumentsView.jsx"
]

for file in frontend_files:
    if not os.path.exists(file):
        continue
    with open(file, "r", encoding="utf-8") as f:
        content = f.read()

    # Add import statement if we have fetch calls
    if "fetch(" in content or "fetch(" in content:
        if "import { fetchAuth }" not in content:
            # Insert after the last import
            last_import = content.rfind("import ")
            end_of_last_import = content.find("\n", last_import)
            content = content[:end_of_last_import+1] + "import { fetchAuth } from '../api';\n" + content[end_of_last_import+1:]

    # Replace fetch('http://localhost:8000/ with fetchAuth('http://localhost:8000/
    content = content.replace("fetch('http://localhost:8000/", "fetchAuth('http://localhost:8000/")
    content = content.replace('fetch("http://localhost:8000/', 'fetchAuth("http://localhost:8000/')

    with open(file, "w", encoding="utf-8") as f:
        f.write(content)

print("Frontend fetch references updated successfully.")
