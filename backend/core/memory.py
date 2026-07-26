import time
import textwrap
import chromadb
from pathlib import Path

# Absolute path to the backend folder — vault is always relative to THIS file
_BACKEND_DIR = Path(__file__).resolve().parent.parent  # backend/core/../ = backend/

def _get_vault_path(email: str) -> Path:
    """Returns the absolute vault path for this user."""
    return _BACKEND_DIR / "knowledge_vault" / email

_chroma_clients = {}

def get_chroma_client(email: str):
    if email not in _chroma_clients:
        store_path = _get_vault_path(email) / "chroma_store"
        store_path.mkdir(parents=True, exist_ok=True)
        _chroma_clients[email] = chromadb.PersistentClient(path=str(store_path))
    return _chroma_clients[email]

def add_chat_memory(email: str, prompt: str, response: str):
    try:
        client = get_chroma_client(email)
        col = client.get_or_create_collection("chat_memory")
        ts = str(time.time())
        doc = f"User: {prompt}\nAI: {response}"
        col.add(
            documents=[doc],
            metadatas=[{"timestamp": ts}],
            ids=[ts]
        )
    except Exception as e:
        print(f"[Memory] Error adding chat memory: {e}")

def get_chat_memory(email: str, query: str, k: int = 3) -> str:
    try:
        client = get_chroma_client(email)
        col = client.get_or_create_collection("chat_memory")
        if col.count() == 0:
            return ""
        results = col.query(query_texts=[query], n_results=min(k, col.count()))
        if results and results.get('documents') and len(results['documents'][0]) > 0:
            return "\n---\n".join(results['documents'][0])
        return ""
    except Exception as e:
        print(f"[Memory] Error retrieving chat memory: {e}")
        return ""

def add_note_to_chroma(email: str, filename: str, text: str):
    try:
        client = get_chroma_client(email)
        col = client.get_or_create_collection("notes")
        
        # Check if already indexed
        existing = col.get(where={"filename": filename})
        if existing and existing.get("ids") and len(existing["ids"]) > 0:
            print(f"[Memory] File {filename} already indexed in ChromaDB.")
            return

        chunks = textwrap.wrap(text, width=1000)
        docs = []
        ids = []
        metas = []
        for i, c in enumerate(chunks):
            docs.append(c)
            ids.append(f"{filename}_{i}_{int(time.time()*1000)}")
            metas.append({"filename": filename})
            
        if docs:
            col.add(documents=docs, metadatas=metas, ids=ids)
            print(f"[Memory] Indexed {len(docs)} chunks for {filename}.")
    except Exception as e:
        print(f"[Memory] Error adding note to chroma: {e}")

def search_notes(email: str, query: str, k: int = 5) -> list:
    try:
        client = get_chroma_client(email)
        col = client.get_or_create_collection("notes")
        if col.count() == 0:
            return []
            
        results = col.query(query_texts=[query], n_results=min(k, col.count()))
        ret = []
        if results and results.get('documents') and len(results['documents'][0]) > 0:
            for doc, meta in zip(results['documents'][0], results['metadatas'][0]):
                ret.append({"text": doc, "filename": meta.get("filename", "Unknown")})
        return ret
    except Exception as e:
        print(f"[Memory] Error searching notes: {e}")
        return []

def get_indexed_notes_count(email: str) -> int:
    """Returns the number of unique note filenames indexed in ChromaDB."""
    try:
        client = get_chroma_client(email)
        col = client.get_or_create_collection("notes")
        if col.count() == 0:
            return 0
        all_metas = col.get()["metadatas"]
        return len(set(m.get("filename", "") for m in all_metas if m.get("filename")))
    except Exception as e:
        print(f"[Memory] Error getting indexed count: {e}")
        return 0

def get_uploaded_notes_count(email: str) -> int:
    """Returns the number of non-thumbnail files in the Notes folder."""
    try:
        notes_dir = _get_vault_path(email) / "Notes"
        if not notes_dir.exists():
            return 0
        return sum(
            1 for f in notes_dir.iterdir()
            if f.is_file() and not f.name.startswith("thumbnail_")
        )
    except Exception as e:
        print(f"[Memory] Error counting uploaded notes: {e}")
        return 0
