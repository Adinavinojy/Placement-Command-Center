import os
import shutil

def process_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements
    changes = [
        ('"Personal" / "academic_profile.json"', '"Generated" / "academic_profile.json"'),
        ('"Personal" / "assessment_taken.json"', '"Generated" / "assessment_taken.json"'),
        ('"Personal" / "latest_assessment.json"', '"Generated" / "latest_assessment.json"'),
        ('"Personal" / "profile.json"', '"Generated" / "profile.json"'),
        ('"Personal" / "study_plan.json"', '"Generated" / "study_plan.json"'),
        ('"Personal" / "ai_evaluation_failed.json"', '"Generated" / "ai_evaluation_failed.json"'),
        ('"Personal" / "timetable.txt"', '"Generated" / "timetable.txt"'),
        ('"Personal" / "study_plan_versions"', '"Generated" / "study_plan_versions"'),
        ('"Personal" / "profile.md"', '"Generated" / "profile.md"')
    ]
    
    for old, new in changes:
        content = content.replace(old, new)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('backend/main.py')
process_file('backend/core/vault.py')
process_file('backend/core/agent.py')

# Now move existing files for the user
vault_dir = "knowledge_vault/adinavinoji05@gmail.com"
personal_dir = os.path.join(vault_dir, "Personal")
gen_dir = os.path.join(vault_dir, "Generated")

if os.path.exists(personal_dir):
    os.makedirs(gen_dir, exist_ok=True)
    files_to_move = [
        "academic_profile.json", "assessment_taken.json", "latest_assessment.json",
        "profile.json", "study_plan.json", "ai_evaluation_failed.json",
        "timetable.txt", "profile.md"
    ]
    for filename in files_to_move:
        src = os.path.join(personal_dir, filename)
        dst = os.path.join(gen_dir, filename)
        if os.path.exists(src):
            shutil.move(src, dst)
            print(f"Moved {filename}")
            
    versions_src = os.path.join(personal_dir, "study_plan_versions")
    versions_dst = os.path.join(gen_dir, "study_plan_versions")
    if os.path.exists(versions_src):
        if not os.path.exists(versions_dst):
            shutil.move(versions_src, versions_dst)
            print("Moved study_plan_versions")
            
print('Replacements and migrations done.')
