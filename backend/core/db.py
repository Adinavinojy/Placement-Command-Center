import sqlite3
from pathlib import Path
from datetime import datetime
from core.vault import get_vault_path

from contextlib import contextmanager

def get_db_path(email: str) -> Path:
    # Place the DB inside the user's isolated vault folder
    db_path = get_vault_path(email) / "placement.db"
    return db_path

@contextmanager
def conn(email: str):
    """Establishes a connection to the SQLite database for a specific user."""
    c = sqlite3.connect(get_db_path(email))
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()

def init(email: str):
    """Initializes the database schema (tables) if they don't exist."""
    with conn(email) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS companies(
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            role TEXT,
            status TEXT DEFAULT 'applied',
            next_deadline TEXT,
            notes TEXT
        );
        CREATE TABLE IF NOT EXISTS rounds(
            id INTEGER PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            round_name TEXT, 
            date TEXT, 
            outcome TEXT, 
            notes TEXT
        );
        CREATE TABLE IF NOT EXISTS skill_levels(
            topic TEXT PRIMARY KEY,
            proficiency INTEGER DEFAULT 0,
            last_tested TEXT
        );
        CREATE TABLE IF NOT EXISTS deadlines(
            id INTEGER PRIMARY KEY,
            company TEXT,
            title TEXT,
            due_at TEXT,
            notified INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS mistakes(
            id INTEGER PRIMARY KEY,
            date TEXT,
            question TEXT,
            options TEXT,
            correct_answer TEXT
        );
        """)
    init_skills(email)

def init_skills(email: str):
    """Initializes the database with core topics at 0 proficiency if they don't exist."""
    topics = [
        "Arrays and Hashing", "Two Pointers", "Sliding Window", "Stack", 
        "Binary Search", "Linked List", "Trees", "Heap / Priority Queue", 
        "Backtracking", "Tries", "Graphs", "Advanced Graphs", 
        "1D DP", "2D DP", "Greedy", "Intervals", 
        "Math and Geometry", "Bit Manipulation",
        "DSA", "Aptitude", "OS", "DBMS", "Networks", "System Design"
    ]
    with conn(email) as c:
        for t in topics:
            c.execute("""
                INSERT OR IGNORE INTO skill_levels (topic, proficiency, last_tested)
                VALUES (?, 0, NULL)
            """, (t,))

def update_skill(email: str, topic: str, correct: bool):
    with conn(email) as c:
        row = c.execute("SELECT proficiency FROM skill_levels WHERE topic = ?", (topic,)).fetchone()
        if row:
            prof = row['proficiency']
            new_prof = min(5, prof + 1) if correct else max(1, prof - 1)
        else:
            new_prof = 2 if correct else 1
            
        now_str = datetime.now().isoformat()
        c.execute("""
            INSERT INTO skill_levels (topic, proficiency, last_tested)
            VALUES (?, ?, ?)
            ON CONFLICT(topic) DO UPDATE SET
                proficiency=excluded.proficiency,
                last_tested=excluded.last_tested
        """, (topic, new_prof, now_str))

def bulk_update_skills(email: str, skills: list[dict]):
    """
    Updates multiple skills from AI evaluation. 
    skills = [{"topic": "DSA", "proficiency": 80}, ...]
    """
    now_str = datetime.now().isoformat()
    with conn(email) as c:
        for s in skills:
            # AI might return numbers 0-100.
            prof = s.get('proficiency', 0)
            topic = s.get('topic')
            if not topic: continue
            
            c.execute("""
                INSERT INTO skill_levels (topic, proficiency, last_tested)
                VALUES (?, ?, ?)
                ON CONFLICT(topic) DO UPDATE SET
                    proficiency=excluded.proficiency,
                    last_tested=excluded.last_tested
            """, (topic, prof, now_str))

def get_skill_levels(email: str):
    with conn(email) as c:
        return c.execute("SELECT topic, proficiency, last_tested FROM skill_levels").fetchall()

def upsert_deadline(email: str, company: str, title: str, due_at: str):
    with conn(email) as c:
        c.execute("""
            INSERT INTO deadlines (company, title, due_at)
            VALUES (?, ?, ?)
        """, (company, title, due_at))

def get_upcoming_deadlines(email: str, window_minutes: int):
    with conn(email) as c:
        now = datetime.now()
        rows = c.execute("SELECT id, company, title, due_at FROM deadlines WHERE notified = 0").fetchall()
        
        upcoming = []
        for row in rows:
            try:
                due_dt = datetime.fromisoformat(row['due_at'])
                diff = (due_dt - now).total_seconds() / 60.0
                if 0 <= diff <= window_minutes:
                    upcoming.append(row)
            except ValueError:
                pass
        return upcoming

def mark_notified(email: str, deadline_id: int):
    with conn(email) as c:
        c.execute("UPDATE deadlines SET notified = 1 WHERE id = ?", (deadline_id,))

def insert_mistake(email: str, question: str, options: list, correct_answer: str):
    import json
    from datetime import datetime
    with conn(email) as c:
        now_str = datetime.now().isoformat()
        c.execute("""
            INSERT INTO mistakes (date, question, options, correct_answer)
            VALUES (?, ?, ?, ?)
        """, (now_str, question, json.dumps(options), correct_answer))

def get_mistakes(email: str) -> list[dict]:
    import json
    with conn(email) as c:
        rows = c.execute("SELECT * FROM mistakes ORDER BY date DESC").fetchall()
    
    res = []
    for r in rows:
        res.append({
            "id": r["id"],
            "date": r["date"],
            "question": r["question"],
            "options": json.loads(r["options"]) if r["options"] else [],
            "correct_answer": r["correct_answer"]
        })
    return res

if __name__ == "__main__":
    pass