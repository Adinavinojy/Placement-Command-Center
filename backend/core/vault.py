import hashlib
from pathlib import Path
import chromadb
from pypdf import PdfReader
import shutil

# Base directory for the vault
BASE_VAULT = Path("knowledge_vault")

def get_vault_path(email: str) -> Path:
    if not email:
        email = "default"
    return BASE_VAULT / email

# We will instantiate chromadb lazily per user to avoid locking issues, or keep a global client
_chroma_client = chromadb.PersistentClient(path="chroma_store")

def _get_col(email: str):
    # Chroma collections cannot have @ or ., so we sanitize the email for the collection name
    safe_name = "".join([c if c.isalnum() else "_" for c in email])
    return _chroma_client.get_or_create_collection(f"vault_{safe_name}")

def _text(path: Path) -> str:
    """Extracts text from a PDF or plain text file."""
    if path.suffix.lower() == ".pdf":
        return "\n".join(p.extract_text() or "" for p in PdfReader(path).pages)
    return path.read_text(errors="ignore")

def _chunks(text, size=900, overlap=150):
    return [text[i:i+size] for i in range(0, len(text), size - overlap)]

def save_and_index(email: str, company: str, filename: str, data: bytes):
    d = get_vault_path(email) / company
    d.mkdir(parents=True, exist_ok=True)
    
    file_path = d / filename
    file_path.write_bytes(data)
    
    chunks = _chunks(_text(file_path))
    if not chunks: return
    
    col = _get_col(email)
    col.add(
        documents=chunks,
        metadatas=[{"company": company, "file": filename}] * len(chunks),
        ids=[hashlib.md5(f"{company}/{filename}/{i}".encode()).hexdigest() for i in range(len(chunks))],
    )

def retrieve(email: str, company: str, query: str, k=6) -> list[str]:
    col = _get_col(email)
    r = col.query(query_texts=[query], n_results=k, where={"company": company})
    if not r["documents"] or not r["documents"][0]:
        return []
    return r["documents"][0]

def init_vault(email: str):
    vault_path = get_vault_path(email)
    folders = [
        "Personal", "Communication", "Aptitude", "Subjects", "Companies", 
        "10th Grade", "12th Grade", "CV",
        "Semester 1", "Semester 2", "Semester 3", "Semester 4",
        "Semester 5", "Semester 6", "Semester 7", "Semester 8"
    ]
    for folder in folders:
        (vault_path / folder).mkdir(parents=True, exist_ok=True)
        
def delete_document(email: str, category: str, filename: str) -> bool:
    file_path = get_vault_path(email) / category / filename
    if file_path.exists():
        try:
            file_path.unlink()
            return True
        except Exception:
            return False
    return False

def get_cv_text(email: str) -> str:
    folder_path = get_vault_path(email) / "CV"
    if not folder_path.exists():
        return ""
    combined_text = ""
    for file_path in folder_path.glob("*.pdf"):
        try:
            text = _text(file_path)
            combined_text += f"\n\n--- DOCUMENT: CV_Resume/{file_path.name} ---\n{text}"
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    return combined_text
        
def read_profile(email: str) -> str:
    profile_path = get_vault_path(email) / "Generated" / "profile.md"
    if profile_path.exists():
        return profile_path.read_text(encoding="utf-8")
    return ""

def read_roadmap(email: str, company: str) -> str:
    roadmap_path = get_vault_path(email) / "Companies" / company / "roadmap.md"
    if roadmap_path.exists():
        return roadmap_path.read_text(encoding="utf-8")
    return ""

def write_roadmap(email: str, company: str, content: str):
    company_dir = get_vault_path(email) / "Companies" / company
    company_dir.mkdir(parents=True, exist_ok=True)
    roadmap_path = company_dir / "roadmap.md"
    roadmap_path.write_text(content, encoding="utf-8")

def read_timetable(email: str) -> str:
    tt_path = get_vault_path(email) / "Generated" / "timetable.txt"
    if tt_path.exists():
        return tt_path.read_text(encoding="utf-8")
    return ""

def write_timetable(email: str, content: str):
    tt_path = get_vault_path(email) / "Generated" / "timetable.txt"
    tt_path.write_text(content, encoding="utf-8")

def save_study_plan_version(email: str, plan_json: str, trigger: str, available_hours: float) -> str:
    import json as _json
    from datetime import datetime

    versions_dir = get_vault_path(email) / "Generated" / "study_plan_versions"
    versions_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    version_filename = f"plan_{timestamp}.json"

    envelope = {
        "version": timestamp,
        "trigger": trigger,
        "available_hours": available_hours,
        "generated_at": datetime.now().isoformat(),
        "plan": _json.loads(plan_json) if isinstance(plan_json, str) else plan_json
    }
    envelope_str = _json.dumps(envelope, indent=2)

    (versions_dir / version_filename).write_text(envelope_str, encoding="utf-8")
    (get_vault_path(email) / "Generated" / "study_plan.json").write_text(plan_json, encoding="utf-8")

    all_versions = sorted(versions_dir.glob("plan_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    for old in all_versions[15:]:
        old.unlink(missing_ok=True)

    return version_filename

def list_study_plan_versions(email: str) -> list:
    import json as _json
    versions_dir = get_vault_path(email) / "Generated" / "study_plan_versions"
    if not versions_dir.exists():
        return []

    results = []
    for f in sorted(versions_dir.glob("plan_*.json"), key=lambda f: f.stat().st_mtime, reverse=True):
        try:
            data = _json.loads(f.read_text(encoding="utf-8"))
            results.append({
                "filename": f.name,
                "version": data.get("version", f.stem),
                "trigger": data.get("trigger", "manual"),
                "generated_at": data.get("generated_at", ""),
                "available_hours": data.get("available_hours", 0),
            })
        except Exception:
            pass
    return results

def get_study_plan_version(email: str, filename: str) -> dict:
    import json as _json
    version_path = get_vault_path(email) / "Generated" / "study_plan_versions" / filename
    if version_path.exists():
        try:
            return _json.loads(version_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}