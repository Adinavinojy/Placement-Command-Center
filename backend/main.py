import json
import os
import shutil
import base64
import fitz
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
from contextlib import asynccontextmanager
import traceback

from core import db, vault, agent, scheduler, memory
from core.auth import (
    register_or_update_user, 
    verify_local_login, 
    create_session, 
    get_email_from_token, 
    change_password, 
    requires_password,
    hash_password
)

# JWT Bearer for token extraction
security = HTTPBearer()

def get_current_user(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    elif "token" in request.query_params:
        token = request.query_params.get("token")
        
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    email = get_email_from_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return email

# Gemini model used specifically for study plan generation
GEMINI_PLAN_MODEL = "gemini-flash-latest"

is_generating_plan = {}
last_plan_generated_at = {}  # dict of unix timestamps of last successful plan generation per user
PLAN_DEBOUNCE_SECONDS = 60    # ignore triggers within 60s of each other

def trigger_plan_regeneration(email: str, trigger: str = "manual"):
    global is_generating_plan, last_plan_generated_at
    if is_generating_plan.get(email, False):
        print(f"[Plan] Skipping regen for '{trigger}' — already generating for {email}.")
        return
    import time as _time
    since_last = _time.time() - last_plan_generated_at.get(email, 0.0)
    if since_last < PLAN_DEBOUNCE_SECONDS and trigger != "manual":
        print(f"[Plan] Debounce: last plan was {since_last:.0f}s ago, skipping '{trigger}'.")
        return
    is_generating_plan[email] = True
    try:
        with db.conn(email) as c:
            rows = c.execute("SELECT company, title, due_at FROM deadlines ORDER BY due_at ASC").fetchall()
        matrix = ", ".join([f"{r['company']} ({r['title']}) due on {r['due_at']}" for r in rows]) or "No deadlines yet"

        tt_content = vault.read_timetable(email)
        available_hours = agent.calculate_available_hours(tt_content) if tt_content else 4.0

        plan_json = agent.generate_study_plan(matrix, available_hours)

        plan_json = plan_json.strip()
        if plan_json.startswith("```json"): plan_json = plan_json[7:]
        if plan_json.endswith("```"): plan_json = plan_json[:-3]
        plan_json = plan_json.strip()

        parsed = json.loads(plan_json)
        if isinstance(parsed, list) and len(parsed) > 0:
            version_file = vault.save_study_plan_version(email, plan_json, trigger, available_hours)
            last_plan_generated_at[email] = _time.time()
    except Exception as e:
        traceback.print_exc()
    finally:
        is_generating_plan[email] = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Migration: Move existing global DB and Personal folders to adinavinoji05@gmail.com
    target_email = "adinavinoji05@gmail.com"
    old_db = Path("placement.db")
    old_vault_personal = Path("knowledge_vault/Personal")
    
    target_vault = vault.get_vault_path(target_email)
    target_vault.mkdir(parents=True, exist_ok=True)
    
    if old_db.exists():
        print(f"Migrating {old_db} to {target_vault / 'placement.db'}")
        shutil.move(str(old_db), str(target_vault / "placement.db"))
    
    if old_vault_personal.exists() and not (target_vault / "Personal").exists():
        print(f"Migrating {old_vault_personal} to {target_vault / 'Personal'}")
        shutil.move(str(old_vault_personal), str(target_vault / "Personal"))
        
    # Migrate Companies, Subjects, etc if they exist
    for folder in ["Communication", "Aptitude", "Subjects", "Companies", "10th Grade", "12th Grade", "CV_Resume", "Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"]:
        old_path = Path(f"knowledge_vault/{folder}")
        if old_path.exists() and not (target_vault / folder).exists():
            shutil.move(str(old_path), str(target_vault / folder))

    # Register default user
    register_or_update_user(target_email, "Adina")
    vault.init_vault(target_email)
    db.init(target_email)
    
    # Seed demo account for portfolio
    register_or_update_user("demo@pcc.dev", "Demo Recruiter", hash_password("Demo@123"))

    # Resilient Queue: Resume unprocessed assessments
    import threading
    vault_base = Path("knowledge_vault")
    if vault_base.exists():
        for user_folder in vault_base.iterdir():
            if user_folder.is_dir():
                payload_file = user_folder / "Generated" / "latest_assessment.json"
                if payload_file.exists():
                    try:
                        payload = json.loads(payload_file.read_text(encoding="utf-8"))
                        user_email = user_folder.name
                        print(f"[Resiliency] Found unprocessed assessment for {user_email}. Resuming...")
                        
                        def process_offline(email, data, p_file):
                            try:
                                existing_skills = db.get_skill_levels(email)
                                existing_skills_dict = [{"topic": r['topic'], "proficiency": r['proficiency']} for r in existing_skills]
                                updated_skills = agent.evaluate_assessment_results(data, existing_skills_dict)
                                if updated_skills:
                                    db.bulk_update_skills(email, updated_skills)
                                    for m in data.get("mistakes", []):
                                        db.insert_mistake(email, m["question"], m["options"], m["correct_answer"])
                                    done_flag = p_file.parent / "ai_evaluation_done.json"
                                    done_flag.write_text("{}")
                                    p_file.unlink()
                                    print(f"[Resiliency] Successfully processed offline assessment for {email}.")
                            except Exception as ex:
                                print(f"[Resiliency] Error processing offline assessment for {email}: {ex}")

                        threading.Thread(target=process_offline, args=(user_email, payload, payload_file)).start()
                    except Exception as e:
                        print(f"Failed to read unprocessed assessment for {user_folder.name}: {e}")

    scheduler.start_scheduler()
    yield
    scheduler.stop_scheduler()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from auth_routes import add_auth_routes
add_auth_routes(app)

@app.get("/api/profile")
def get_profile(email: str = Depends(get_current_user)):
    profile_path = vault.get_vault_path(email) / "Generated" / "profile.json"
    if profile_path.exists():
        with open(profile_path, 'r') as f:
            return {"exists": True, "profile": json.load(f)}
    return {"exists": False}

class ProfileSetup(BaseModel):
    name: str
    course: str
    semester: str
    education: str

@app.post("/api/profile/setup")
async def setup_profile(data: ProfileSetup, email: str = Depends(get_current_user)):
    personal_dir = vault.get_vault_path(email) / "Generated"
    personal_dir.mkdir(parents=True, exist_ok=True)
    
    profile_dict = data.dict()
    
    with open(personal_dir / "profile.json", "w") as f:
        json.dump(profile_dict, f, indent=4)
        
    return {"status": "success"}

@app.get("/api/onboarding/status")
def get_onboarding_status(email: str = Depends(get_current_user)):
    # 1. Profile JSON exists
    profile_path = vault.get_vault_path(email) / "Generated" / "profile.json"
    has_profile = profile_path.exists()
    
    # 2. Assessment taken (now relies on a fast flag)
    assessment_flag = vault.get_vault_path(email) / "Generated" / "assessment_taken.json"
    has_taken_assessment = assessment_flag.exists()
    
    # 3. Documents uploaded (Only CV required for unlocking)
    def has_doc(folder):
        d = vault.get_vault_path(email) / folder
        if not d.exists(): return False
        return any(f.is_file() for f in d.iterdir())
        
    has_cv = has_doc("CV")
    
    # Is locked if ANY of the MANDATORY items are missing
    # User requested ONLY Assessment and CV to unlock.
    is_locked = not (has_taken_assessment and has_cv)
    
    # Fetch name from users.json
    users_path = Path("users.json")
    user_name = "Student"
    if users_path.exists():
        try:
            users = json.loads(users_path.read_text(encoding="utf-8"))
            if email in users:
                user_name = users[email].get("name", "Student")
        except:
            pass

    return {
        "email": email,
        "name": user_name,
        "has_profile": has_profile, # kept for UI backward compatibility
        "has_taken_assessment": has_taken_assessment,
        "has_docs": has_cv, 
        "has_cv": has_cv,
        "is_locked": is_locked
    }

class CompanyData(BaseModel):
    name: str
    role: str
    matrix: str
    rounds: list[dict]

@app.post("/api/companies/add")
def add_company(data: CompanyData, email: str = Depends(get_current_user)):
    with db.conn(email) as c:
        try:
            c.execute("INSERT INTO companies (name, role, status, notes) VALUES (?, ?, ?, ?)",
                      (data.name, data.role, 'applied', data.matrix))
            company_id = c.lastrowid
            
            for r in data.rounds:
                c.execute("INSERT INTO rounds (company_id, round_name, date) VALUES (?, ?, ?)",
                          (company_id, r['name'], r['date']))
                db.upsert_deadline(email, data.name, r['name'], r['date'])
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    return {"status": "success", "study_plan": agent.generate_study_plan(data.matrix, 3.0)}

class EventRequest(BaseModel):
    title: str
    company: str
    date: str

@app.post("/api/events")
def add_event(req: EventRequest, background_tasks: BackgroundTasks, email: str = Depends(get_current_user)):
    try:
        db.upsert_deadline(email, req.company, req.title, req.date)
        background_tasks.add_task(trigger_plan_regeneration, email, trigger=f"Event added: {req.company} {req.title}")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard")
def get_dashboard(email: str = Depends(get_current_user)):
    levels = db.get_skill_levels(email)
    
    with db.conn(email) as c:
        rows = c.execute("SELECT d.id, d.company, d.title, d.due_at, d.notified, c.role FROM deadlines d LEFT JOIN companies c ON d.company = c.name ORDER BY d.due_at ASC").fetchall()
    deadlines = [{"id": r['id'], "company": r['company'], "role": r['role'] or "Role", "title": r['title'], "due_at": r['due_at'], "notified": r['notified']} for r in rows]

    tt_content = vault.read_timetable(email)
    available_hours = 0
    if tt_content:
        available_hours = agent.calculate_available_hours(tt_content)

    failed_flag = vault.get_vault_path(email) / "Generated" / "ai_evaluation_failed.json"

    # AI-generated dashboard insight (fast Ollama, non-blocking best-effort)
    import datetime as _dt
    today_str = _dt.date.today().isoformat()
    insight_cache_path = vault.get_vault_path(email) / "Generated" / "daily_insight.json"
    insight = ""
    try:
        skills_list = [{"topic": r['topic'], "proficiency": r['proficiency']} for r in levels]
        if insight_cache_path.exists():
            try:
                cache_data = json.loads(insight_cache_path.read_text(encoding="utf-8"))
                if cache_data.get("date") == today_str:
                    insight = cache_data.get("insight", "")
            except:
                pass
        
        if not insight:
            insight = agent.generate_dashboard_insight(skills_list, deadlines, available_hours)
            insight_cache_path.parent.mkdir(parents=True, exist_ok=True)
            insight_cache_path.write_text(json.dumps({
                "date": today_str,
                "insight": insight
            }), encoding="utf-8")
    except Exception as insight_err:
        print(f"[Dashboard] Insight generation skipped: {insight_err}")

    # Check for upcoming rounds within 48 hrs for prep tip trigger
    import datetime as _dt
    today = _dt.date.today()
    urgent_round = None
    for d in deadlines:
        try:
            due = _dt.date.fromisoformat(str(d.get("due_at", ""))[:10])
            days_left = (due - today).days
            if 0 <= days_left <= 2:
                urgent_round = {"company": d["company"], "title": d["title"], "days_left": days_left}
                break
        except:
            pass

    # Fetch Quick Stats
    stats_path = vault.get_vault_path(email) / "Generated" / "stats.json"
    stats = {"questions": 0, "tests": 0}
    if stats_path.exists():
        try:
            stats = json.loads(stats_path.read_text(encoding="utf-8"))
        except:
            pass

    return {
        "skills": [{"topic": r['topic'], "proficiency": r['proficiency'], "last_tested": r['last_tested']} for r in levels],
        "deadlines": deadlines,
        "available_hours": available_hours,
        "ai_evaluation_failed": failed_flag.exists(),
        "insight": insight,
        "urgent_round": urgent_round,
        "stats": stats
    }


@app.get("/api/assessment/generate")
def generate_assessment(background_tasks: BackgroundTasks, email: str = Depends(get_current_user)):
    """
    Instantly selects questions from the local banks, and quietly triggers
    a background task to replenish those categories via Gemini.
    """
    try:
        import datetime, json as _json, random, os

        skill_levels = db.get_skill_levels(email)
        weak_skills = [s['topic'] for s in sorted(skill_levels, key=lambda x: x['proficiency'])[:5]] if skill_levels else []

        # ── Aptitude: Pull from static bank ────────────
        base_dir = os.path.dirname(os.path.abspath(__file__))
        qbank_path = os.path.join(base_dir, "question_bank.json")
        seen_path  = vault.get_vault_path(email) / "Generated" / "seen_questions.json"
        with open(qbank_path, encoding="utf-8") as f:
            qbank = _json.load(f)
        seen = {}
        if os.path.exists(seen_path):
            with open(seen_path, encoding="utf-8") as f:
                seen = _json.load(f)

        def pick_unseen(pool, section_key, n=2):
            seen_ids = set(seen.get(section_key, []))
            unseen = [q for q in pool if q["id"] not in seen_ids]
            if len(unseen) < n:
                seen[section_key] = []
                unseen = list(pool)
            chosen = random.sample(unseen, min(n, len(unseen)))
            seen.setdefault(section_key, []).extend(q["id"] for q in chosen)
            return chosen

        verbal_qs  = pick_unseen(qbank.get("verbal", []),       "verbal",       2)
        quant_qs   = pick_unseen(qbank.get("quantitative", []), "quantitative", 2)
        logical_qs = pick_unseen(qbank.get("logical", []),      "logical",      2)
        with open(seen_path, "w", encoding="utf-8") as f:
            _json.dump(seen, f, indent=2)

        aptitude = []
        for q in verbal_qs:  aptitude.append({**q, "section": "Verbal"})
        for q in quant_qs:   aptitude.append({**q, "section": "Quantitative"})
        for q in logical_qs: aptitude.append({**q, "section": "Logical"})

        # Trigger background replenishment for aptitude
        background_tasks.add_task(agent.replenish_aptitude_bank_background, ["verbal", "quantitative", "logical"])

        # ── Detect today's topic from study plan ────────────────────────────
        plan_path = vault.get_vault_path(email) / "Generated" / "study_plan.json"
        today_topic = weak_skills[0] if weak_skills else "Data Structures and Algorithms"
        if plan_path.exists():
            plan = _json.loads(plan_path.read_text(encoding="utf-8"))
            today_str = datetime.date.today().strftime("%B %d, %Y")
            for day in plan:
                day_date = day.get("date", "") or day.get("day", "")
                if today_str in day_date or day_date in today_str:
                    today_topic = day.get("focus", today_topic)
                    break
            else:
                if plan:
                    today_topic = plan[-1].get("focus", today_topic)

        # ── Coding: Pull from local lc_map ──────────────────
        lc_path = os.path.join(base_dir, "leetcode_map.json")
        with open(lc_path, encoding="utf-8") as f:
            lc_map = _json.load(f)
        
        coding_problems = None
        matched_topic = "default"
        for key in lc_map:
            if key.lower() in today_topic.lower() or today_topic.lower() in key.lower():
                coding_problems = lc_map[key]
                matched_topic = key
                break
        if not coding_problems:
            for key in lc_map:
                if any(w in key.lower() for w in today_topic.lower().split() if len(w) > 3):
                    coding_problems = lc_map[key]
                    matched_topic = key
                    break
        if not coding_problems and weak_skills:
            for ws in weak_skills:
                for key in lc_map:
                    if ws.lower() in key.lower():
                        coding_problems = lc_map[key]
                        matched_topic = key
                        break
                if coding_problems: break
        
        if not coding_problems:
            coding_problems = lc_map.get("default", [])
            matched_topic = "default"

        # Trigger background replenishment for coding
        background_tasks.add_task(agent.replenish_coding_bank_background, [matched_topic])

        return {"topic": today_topic, "aptitude": aptitude, "coding": coding_problems[:2]}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/assessment/initial")
def get_initial_assessment(email: str = Depends(get_current_user)):
    """
    Returns the cached initial assessment or generates one via Gemini (runs once).
    The result is saved to Generated/initial_assessment.json and reused on future calls.
    """
    try:
        cache_path = vault.get_vault_path(email) / "Generated" / "initial_assessment.json"
        if cache_path.exists():
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            if data.get("aptitude") and data.get("coding"):
                print("[Assessment] Serving cached initial assessment")
                return data

        print("[Assessment] Serving baseline initial assessment (instant)...")
        data = {
                "topic": "Baseline",
                "aptitude": [
                    { "id": "APT-001", "section": "Verbal", "difficulty": "Medium", "question": "Choose the word most nearly opposite in meaning to 'LOQUACIOUS':", "options": ["Talkative", "Reticent", "Fluent", "Verbose"], "answer": "B", "explanation": "Loquacious means very talkative. Reticent means not revealing thoughts — the direct antonym." },
                    { "id": "APT-002", "section": "Verbal", "difficulty": "Hard", "question": "In the sentence 'Neither the manager nor the employees was present at the meeting', identify the error:", "options": ["Neither the manager", "nor the employees", "was present", "at the meeting"], "answer": "C", "explanation": "With 'neither...nor', verb agrees with the nearest subject. 'employees' is plural, so 'were' is correct." },
                    { "id": "APT-003", "section": "Verbal", "difficulty": "Medium", "question": "Choose the word closest in meaning to 'EPHEMERAL':", "options": ["Eternal", "Transient", "Substantial", "Resilient"], "answer": "B", "explanation": "Ephemeral means lasting for a very short time. Transient is a synonym." },
                    { "id": "APT-004", "section": "Verbal", "difficulty": "Hard", "question": "Choose the word that best completes the analogy: MENDACIOUS : TRUTH :: PARSIMONIOUS : ___", "options": ["Wealth", "Generosity", "Poverty", "Greed"], "answer": "B", "explanation": "Mendacious opposes truth. Parsimonious (miserly) opposes generosity." },
                    { "id": "APT-005", "section": "Quantitative", "difficulty": "Medium", "question": "A sum of money doubles itself at compound interest in 4 years. In how many years will it become 16 times?", "options": ["8", "12", "16", "20"], "answer": "C", "explanation": "Doubles every 4 years: 2x→4y, 4x→8y, 8x→12y, 16x→16y." },
                    { "id": "APT-006", "section": "Quantitative", "difficulty": "Hard", "question": "Find the total ways to seat 5 men and 4 women so that women occupy even positions (positions 2,4,6,8):", "options": ["2880", "5760", "14400", "1440"], "answer": "A", "explanation": "4! ways for women × 5! ways for men = 24 × 120 = 2880." },
                    { "id": "APT-007", "section": "Quantitative", "difficulty": "Medium", "question": "A person sold two articles at Rs 990 each. On one he gained 10% and on the other lost 10%. Net gain/loss %:", "options": ["1% gain", "1% loss", "No profit no loss", "2% loss"], "answer": "B", "explanation": "Formula: loss% = (common%)²/100 = 100/100 = 1% loss." },
                    { "id": "APT-008", "section": "Logical", "difficulty": "Medium", "question": "Pointing to a photograph, a man says 'She is the daughter of my grandfather\\'s only son.' How is she related?", "options": ["Sister", "Aunt", "Mother", "Daughter"], "answer": "A", "explanation": "Grandfather's only son = father. Father's daughter = sister." },
                    { "id": "APT-009", "section": "Logical", "difficulty": "Hard", "question": "All roses are flowers. Some flowers fade quickly. Therefore:", "options": ["All roses fade quickly", "Some roses fade quickly", "No rose fades quickly", "None of the above"], "answer": "D", "explanation": "We cannot conclude any of A, B, or C from the premises alone." },
                    { "id": "APT-010", "section": "Logical", "difficulty": "Medium", "question": "Find the next number in: 8, 27, 64, 100, 125, 216. What is the odd one out?", "options": ["8", "100", "125", "216"], "answer": "B", "explanation": "All are perfect cubes except 100 (4.64³ ≈ 100, not exact)." }
                ],
                "coding": [
                    { "title": "Two Sum", "url": "https://leetcode.com/problems/two-sum/", "difficulty": "Easy" },
                    { "title": "Longest Substring Without Repeating Characters", "url": "https://leetcode.com/problems/longest-substring-without-repeating-characters/", "difficulty": "Medium" },
                    { "title": "Merge k Sorted Lists", "url": "https://leetcode.com/problems/merge-k-sorted-lists/", "difficulty": "Hard" }
                ]
            }
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return data
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class ExplainRequest(BaseModel):
    question: str
    options: list
    correct_answer: str
    user_answer: str

@app.post("/api/assessment/explain")
def explain_wrong_answer(data: ExplainRequest, email: str = Depends(get_current_user)):
    """Uses qwen3:8b locally to generate a step-by-step explanation for a wrong answer."""
    try:
        explanation = agent.generate_wrong_answer_explanation(
            data.question, data.options, data.correct_answer, data.user_answer
        )
        return {"explanation": explanation}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class AssessmentSubmitData(BaseModel):
    aptAnswers: dict
    codingScores: dict
    aptTime: int
    codingTime: int
    mistakes: list = []

@app.post("/api/assessment/submit")
def submit_assessment(data: AssessmentSubmitData, background_tasks: BackgroundTasks, email: str = Depends(get_current_user)):
    try:
        # Save a flag so they've taken the assessment instantly
        personal_dir = vault.get_vault_path(email) / "Generated"
        personal_dir.mkdir(parents=True, exist_ok=True)
        (personal_dir / "assessment_taken.json").write_text("{}")
        
        # Cleanup initial assessment file since they've now submitted it
        initial_file = personal_dir / "initial_assessment.json"
        if initial_file.exists():
            initial_file.unlink()
        
        # Update Quick Stats
        stats_path = personal_dir / "stats.json"
        stats = {"questions": 0, "tests": 0}
        if stats_path.exists():
            try:
                stats = json.loads(stats_path.read_text(encoding="utf-8"))
            except:
                pass
        
        apt_count = len(data.dict().get('aptAnswers', {}))
        code_count = len(data.dict().get('codingScores', {}))
        stats["questions"] += apt_count + code_count
        stats["tests"] += 1
        stats_path.write_text(json.dumps(stats), encoding="utf-8")
        
        # Save payload to disk in case AI evaluation fails and they need to retry
        (personal_dir / "latest_assessment.json").write_text(json.dumps(data.dict()))
            
        def process_and_update(payload):
            done_flag   = personal_dir / "ai_evaluation_done.json"
            if done_flag.exists():   done_flag.unlink()
            
            while True:
                try:
                    existing_skills = db.get_skill_levels(email)
                    existing_skills_dict = [{"topic": r['topic'], "proficiency": r['proficiency']} for r in existing_skills]
                    updated_skills = agent.evaluate_assessment_results(payload, existing_skills_dict)
                    if updated_skills:
                        db.bulk_update_skills(email, updated_skills)
                        
                        # Store mistakes securely
                        for m in payload.get("mistakes", []):
                            db.insert_mistake(email, m["question"], m["options"], m["correct_answer"])

                        done_flag.write_text("{}")
                        
                        # Assessment fully processed; delete resilient queue file
                        payload_file = personal_dir / "latest_assessment.json"
                        if payload_file.exists(): payload_file.unlink()
                        break
                    else:
                        raise Exception("AI returned empty or unparseable skills")
                except Exception as ex:
                    print(f"Error evaluating assessment skills, retrying in 10s: {ex}")
                    time.sleep(10)

        background_tasks.add_task(process_and_update, data.dict())
        return {"status": "success", "message": "Assessment submitted for evaluation."}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/mistakes")
def get_user_mistakes(email: str = Depends(get_current_user)):
    try:
        mistakes = db.get_mistakes(email)
        return {"status": "success", "mistakes": mistakes}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/assessment/eval_status")
def get_eval_status(email: str = Depends(get_current_user)):
    """Poll this endpoint to check if AI skill evaluation has finished."""
    gen_dir = vault.get_vault_path(email) / "Generated"
    done_flag   = gen_dir / "ai_evaluation_done.json"
    if done_flag.exists():
        return {"status": "done"}
    return {"status": "pending"}

class RoundPrepRequest(BaseModel):
    company: str
    round_name: str
    days_left: int

@app.post("/api/round_prep")
def get_round_prep(data: RoundPrepRequest, email: str = Depends(get_current_user)):
    """Uses Gemini to generate personalized prep tips for an upcoming round."""
    try:
        levels = db.get_skill_levels(email)
        skills = [{"topic": r['topic'], "proficiency": r['proficiency']} for r in levels]
        tips = agent.generate_round_prep_tips(data.company, data.round_name, data.days_left, skills)
        return {"tips": tips}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def chat_file_upload(file: UploadFile = File(...), email: str = Depends(get_current_user)):
    try:
        content = await file.read()
        extracted_text = ""
        ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        
        if ext == 'pdf':
            try:
                import fitz
                doc = fitz.open(stream=content, filetype="pdf")
                extracted_text = chr(10).join([page.get_text() for page in doc])
                doc.close()
            except Exception as e:
                extracted_text = f"[PDF Parsing Error: {e}]"
        else:
            try:
                extracted_text = content.decode('utf-8')
            except:
                extracted_text = "[Binary File]"

        # Ask Gemini to categorize it
        classification_prompt = f"""
        You are an AI assistant categorizing an uploaded file based on its name and content.
        File Name: {file.filename}
        Content Snippet: {extracted_text[:1000]}
        
        Categorize this file into EXACTLY ONE of the following: "CV", "Notes", "Generated", or "Personal".
        - If it looks like a resume, CV, or portfolio, choose "CV".
        - If it contains study material, lecture notes, textbook chapters, or academic notes, choose "Notes".
        - If it looks like an AI-generated study plan, timetable, or career review, choose "Generated".
        - Otherwise, choose "Personal".
        
        Return ONLY the category name. No other text.
        """
        category = agent._call_fast(classification_prompt).strip().strip('"').strip("'")
        valid_categories = ["CV", "Notes", "Generated", "Personal"]
        if category not in valid_categories:
            category = "Personal"

        # Save the file
        file_path = vault.get_vault_path(email) / category / file.filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(content)
        
        # Also generate thumbnail if it's a Note
        if category == "Notes" and ext == 'pdf':
            try:
                import fitz
                doc = fitz.open(stream=content, filetype="pdf")
                page = doc.load_page(0)
                pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
                thumbnail_path = file_path.parent / f"thumbnail_{file.filename}.png"
                pix.save(str(thumbnail_path))
                doc.close()
            except Exception as ex:
                print(f"Failed to generate thumbnail: {ex}")

        if category == "Notes" and extracted_text.strip():
            memory.add_note_to_chroma(email, file.filename, extracted_text)

        return {"text": extracted_text, "category": category, "message": f"Saved automatically to {category}/"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/vault/upload")
async def upload_file(category: str = Form(...), company: str = Form(None), file: UploadFile = File(...), email: str = Depends(get_current_user)):
    try:
        content = await file.read()
        if category == "Companies":
            if not company:
                raise HTTPException(status_code=400, detail="Company name required for Companies category")
            vault.save_and_index(email, company, file.filename, content)
            return {"message": f"Saved to Companies/{company}/"}
        else:
            file_path = vault.get_vault_path(email) / category / file.filename
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(content)
            
            # Generate thumbnail if it's a Note and a PDF
            if category == "Notes" and file.filename.lower().endswith(".pdf"):
                try:
                    doc = fitz.open(stream=content, filetype="pdf")
                    page = doc.load_page(0)  # first page
                    pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))  # scale down to 50% for lighter thumbnail
                    thumbnail_path = file_path.parent / f"thumbnail_{file.filename}.png"
                    pix.save(str(thumbnail_path))
                    doc.close()
                except Exception as ex:
                    print(f"Failed to generate thumbnail for {file.filename}: {ex}")
            # Insert into ChromaDB
            if category == "Notes":
                try:
                    ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
                    note_text = ""
                    if ext == 'pdf':
                        import fitz
                        doc = fitz.open(stream=content, filetype="pdf")
                        note_text = chr(10).join([p.get_text() for p in doc])
                        doc.close()
                    else:
                        try:
                            note_text = content.decode('utf-8')
                        except:
                            pass
                    if note_text.strip():
                        memory.add_note_to_chroma(email, file.filename, note_text)
                except Exception as ex:
                    print(f"Error extracting note text for ChromaDB: {ex}")

            return {"message": f"Saved {file.filename} to {category}/"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class NotesSearchRequest(BaseModel):
    query: str
    
@app.post("/api/notes/search")
def search_notes_api(req: NotesSearchRequest, email: str = Depends(get_current_user)):
    try:
        results = memory.search_notes(email, req.query)
        return {"results": results}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/notes/reindex")
def reindex_notes(background_tasks: BackgroundTasks, email: str = Depends(get_current_user)):
    """Re-indexes all existing notes files into ChromaDB for semantic search."""
    def do_reindex():
        notes_dir = memory._get_vault_path(email) / "Notes"
        gen_dir = memory._get_vault_path(email) / "Generated"
        gen_dir.mkdir(parents=True, exist_ok=True)
        
        if not notes_dir.exists():
            print(f"[Reindex] Notes dir not found: {notes_dir}")
            # Write done flag even if no notes dir
            (gen_dir / "notes_indexed.json").write_text(json.dumps({"indexed": 0, "attempted": 0}))
            return
        
        files = [f for f in notes_dir.iterdir() if f.is_file() and not f.name.startswith("thumbnail_")]
        attempted = 0
        indexed = 0
        
        for filepath in files:
            attempted += 1
            try:
                content = filepath.read_bytes()
                ext = filepath.suffix.lower()
                note_text = ""
                if ext == ".pdf":
                    try:
                        import fitz
                        doc = fitz.open(stream=content, filetype="pdf")
                        note_text = chr(10).join([p.get_text() for p in doc])
                        doc.close()
                    except Exception:
                        pass
                    # Fallback to pypdf if fitz extracted nothing
                    if not note_text.strip():
                        try:
                            from pypdf import PdfReader
                            import io
                            reader = PdfReader(io.BytesIO(content))
                            note_text = chr(10).join(p.extract_text() or "" for p in reader.pages)
                        except Exception as e2:
                            print(f"[Reindex] pypdf also failed for {filepath.name}: {e2}")
                else:
                    try:
                        note_text = content.decode("utf-8")
                    except:
                        pass
                
                if note_text.strip():
                    memory.add_note_to_chroma(email, filepath.name, note_text)
                    indexed += 1
                else:
                    print(f"[Reindex] No text extractable (likely scanned/image PDF): {filepath.name}")
            except Exception as ex:
                print(f"[Reindex] Error for {filepath.name}: {ex}")
        
        # Write a done flag so the status endpoint knows reindex has been attempted
        (gen_dir / "notes_indexed.json").write_text(
            json.dumps({"indexed": indexed, "attempted": attempted})
        )
        print(f"[Reindex] Done. Indexed {indexed}/{attempted} notes for {email}.")
    
    background_tasks.add_task(do_reindex)
    return {"message": "Reindexing started in the background."}

@app.get("/api/notes/status")
def notes_index_status(email: str = Depends(get_current_user)):
    """Returns indexing status. ready=True once reindex has been run at least once."""
    try:
        uploaded = memory.get_uploaded_notes_count(email)
        indexed = memory.get_indexed_notes_count(email)
        # Check if reindex was ever run (flag file written by do_reindex)
        flag = memory._get_vault_path(email) / "Generated" / "notes_indexed.json"
        reindex_done = flag.exists()
        # ready = reindex was run OR all uploaded notes are already indexed
        ready = reindex_done or (uploaded > 0 and indexed >= uploaded)
        return {
            "uploaded": uploaded,
            "indexed": indexed,
            "ready": ready
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
def get_documents(email: str = Depends(get_current_user)):
    import os
    vault_path = str(vault.get_vault_path(email))
    docs = {}
    
    if not os.path.exists(vault_path):
        return {"documents": docs}
        
    for root, dirs, files in os.walk(vault_path):
        rel_path = os.path.relpath(root, vault_path)
        
        # Determine the category based on the relative path
        category = "General" if rel_path == "." else rel_path.replace("\\", "/")
        
        if category not in docs:
            docs[category] = []
            
        for file in files:
            # We skip internal DB/chroma files if any exist here, but normally it's just docs
            docs[category].append(file)
            
    # Remove empty categories
    docs = {k: v for k, v in docs.items() if v}
    return {"documents": docs}

from fastapi.responses import FileResponse
import json

@app.delete("/api/documents/{category}/{filename}")
def delete_document_endpoint(category: str, filename: str, email: str = Depends(get_current_user)):
    success = vault.delete_document(email, category, filename)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Document not found or could not be deleted")

@app.get("/api/documents/{category}/{filename}")
def download_document_endpoint(category: str, filename: str, email: str = Depends(get_current_user)):
    file_path = vault.get_vault_path(email) / category / filename
    if file_path.exists():
        return FileResponse(path=file_path)
    raise HTTPException(status_code=404, detail="Document not found")

import shutil
import os
from fastapi.responses import FileResponse

@app.get("/api/export")
def export_data(email: str = Depends(get_current_user)):
    # Zip the knowledge_vault directory and return it
    vault_dir = str(vault.get_vault_path(email))
    zip_path = f"export_data_{email}.zip"
    if os.path.exists(vault_dir):
        shutil.make_archive(f"export_data_{email}", 'zip', vault_dir)
        return FileResponse(path=zip_path, filename="mentor_ai_data_export.zip", media_type="application/zip")
    raise HTTPException(status_code=404, detail="No data to export")

@app.delete("/api/delete_all")
def delete_all_data(email: str = Depends(get_current_user)):
    # Delete the user's entire isolated vault
    vault_dir = vault.get_vault_path(email)
    if vault_dir.exists():
        shutil.rmtree(vault_dir)
        # Recreate the base folder structure
        vault.init_vault(email)
        return {"status": "success", "message": "All personal data cleared"}
    return {"status": "success", "message": "No data found to delete"}

@app.get("/api/academic_profile")
def get_academic_profile(email: str = Depends(get_current_user)):
    profile_path = vault.get_vault_path(email) / "Generated" / "academic_profile.json"
    if profile_path.exists():
        return json.loads(profile_path.read_text(encoding="utf-8"))
    return {}

@app.post("/api/academic_profile")
async def save_academic_profile(request: Request, email: str = Depends(get_current_user)):
    data = await request.json()
    profile_path = vault.get_vault_path(email) / "Generated" / "academic_profile.json"
    profile_path.parent.mkdir(parents=True, exist_ok=True)
    profile_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return {"status": "success"}

@app.post("/api/improvement_review/generate")
def generate_improvement_review(email: str = Depends(get_current_user)):
    try:
        cv_text = vault.get_cv_text(email)
        profile_path = vault.get_vault_path(email) / "Generated" / "academic_profile.json"
        academic_data = profile_path.read_text(encoding="utf-8") if profile_path.exists() else "{}"
        
        review_markdown = agent.generate_career_review(cv_text, academic_data)
        
        gen_dir = vault.get_vault_path(email) / "Generated"
        gen_dir.mkdir(parents=True, exist_ok=True)
        (gen_dir / "career_review.md").write_text(review_markdown, encoding="utf-8")
        
        return {"review": review_markdown}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/improvement_review/saved")
def get_saved_improvement_review(email: str = Depends(get_current_user)):
    try:
        file_path = vault.get_vault_path(email) / "Generated" / "career_review.md"
        if file_path.exists():
            return {"review": file_path.read_text(encoding="utf-8")}
        return {"review": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/manual")
def get_user_manual():
    try:
        content = Path("../README.md").read_text(encoding="utf-8")
        return {"content": content}
    except Exception as e:
        return {"content": f"Failed to load user manual: {e}"}

@app.delete("/api/profile/data")
def clear_profile_data(email: str = Depends(get_current_user)):
    try:
        import shutil
        vault_path = vault.get_vault_path(email)
        if vault_path.exists():
            shutil.rmtree(vault_path)
        return {"status": "success", "message": "All data cleared successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/profile/account")
def delete_account(email: str = Depends(get_current_user)):
    try:
        import shutil
        import json
        vault_path = vault.get_vault_path(email)
        if vault_path.exists():
            shutil.rmtree(vault_path)
        
        users_path = Path("users.json")
        if users_path.exists():
            users = json.loads(users_path.read_text(encoding="utf-8"))
            if email in users:
                del users[email]
                users_path.write_text(json.dumps(users, indent=2), encoding="utf-8")
                
        return {"status": "success", "message": "Account permanently deleted."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error deleting account: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/assess/baseline")
def get_baseline(email: str = Depends(get_current_user)):
    try:
        questions = agent.get_baseline_test()
        return {"questions": questions}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class EvaluateRequest(BaseModel):
    question: str
    type: str
    approach: str
    solved: bool

@app.post("/api/assess/evaluate")
def evaluate_answer(req: EvaluateRequest, email: str = Depends(get_current_user)):
    try:
        is_correct = agent.evaluate_answer(req.question, req.approach, req.solved)
        topic = "Coding" if req.type == "Coding" else "Aptitude"
        db.update_skill(email, topic, is_correct)
        return {"correct": is_correct, "message": "Skill profile updated."}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ChatMessage(BaseModel):
    message: str

@app.post("/api/commands")
def handle_command(msg: ChatMessage, background_tasks: BackgroundTasks, email: str = Depends(get_current_user)):
    try:
        text = msg.message.strip()
        if text.startswith("/status"):
            with db.conn(email) as c:
                deadlines = c.execute("SELECT title, company, due_at FROM deadlines ORDER BY due_at ASC LIMIT 3").fetchall()
                avg_prof = c.execute("SELECT AVG(proficiency) as avg FROM skill_levels").fetchone()['avg'] or 0
                
            report = f"### 📊 Mentor AI Executive Status\n\n**🎯 Average Proficiency:** {avg_prof:.1f}%\n\n**📅 Upcoming Deadlines:**\n"
            if deadlines:
                for d in deadlines:
                    report += f"- **{d['company']}**: {d['title']} (Due: {d['due_at']})\n"
            else:
                report += "- No upcoming deadlines!\n"
            report += "\n**💡 Focus Today:** Let's grind some DSA or clear those pending mock tests!"
            return {"response": report}

        resp = agent.process_pcc_command(text)
        
        if text.startswith("/timetable"):
            import re
            # Extract JSON block if it exists
            json_match = re.search(r'```json\n(.*?)\n```', resp, re.DOTALL)
            raw_json = json_match.group(1) if json_match else resp
            try:
                # Attempt to parse json
                start = raw_json.find('{')
                end = raw_json.rfind('}')
                if start != -1 and end != -1:
                    data = json.loads(raw_json[start:end+1])
                    formatted_tt = ""
                    for key in ["CollegeHours", "CourseHours", "SleepTime", "OtherTime"]:
                        if key in data:
                            formatted_tt += f"{key}: {data[key]}\n"
                    if formatted_tt:
                        vault.write_timetable(email, formatted_tt)
                        # AUTO-TRIGGER: regenerate study plan with new available hours
                        background_tasks.add_task(trigger_plan_regeneration, email, trigger="timetable_update")
                        return {"response": "✅ Timetable saved! Regenerating your study plan with your updated schedule in the background..."}
            except Exception as e:
                print("Could not parse timetable JSON", e)
                pass
                
        elif text.startswith("/company"):
            import re
            json_match = re.search(r'```json\n(.*?)\n```', resp, re.DOTALL)
            raw_json = json_match.group(1) if json_match else resp
            try:
                start = raw_json.find('{')
                end = raw_json.rfind('}')
                if start != -1 and end != -1:
                    data = json.loads(raw_json[start:end+1])
                    company_data = data.get("company", data) if isinstance(data, dict) else data
                    if "name" in company_data and "rounds" in company_data:
                        with db.conn(email) as c:
                            c.execute("INSERT OR REPLACE INTO companies (name, role, status, notes) VALUES (?, ?, ?, ?)",
                                      (company_data.get("name"), company_data.get("role", "SDE"), 'applied', company_data.get("matrix", "")))
                            
                            row = c.execute("SELECT id FROM companies WHERE name = ?", (company_data.get("name"),)).fetchone()
                            if row:
                                company_id = row['id']
                                for r in company_data.get("rounds", []):
                                    c.execute("INSERT OR REPLACE INTO rounds (company_id, round_name, date) VALUES (?, ?, ?)",
                                              (company_id, r.get("name"), r.get("date")))
                                    c.execute("INSERT INTO deadlines (company, title, due_at) VALUES (?, ?, ?)",
                                              (company_data.get("name"), r.get("name"), r.get("date")))
                                              
                        rows = c.execute("SELECT company, title, due_at FROM deadlines WHERE company = ?", (company_data.get("name"),)).fetchall()
                        matrix_str = ", ".join([f"{r['company']} ({r['title']}) due on {r['due_at']}" for r in rows])

                        background_tasks.add_task(trigger_plan_regeneration, email, trigger=f"Added company: {company_data['name']}")

                        return {"response": f"✅ Company **'{company_data['name']}'** added! Deadlines saved. Regenerating your study plan in the background..."}
            except Exception as e:
                print("Could not parse company JSON", e)
                pass

        elif text.startswith("/delete"):
            import re
            json_match = re.search(r'```json\n(.*?)\n```', resp, re.DOTALL)
            raw_json = json_match.group(1) if json_match else resp
            try:
                start = raw_json.find('{')
                end = raw_json.rfind('}')
                if start != -1 and end != -1:
                    data = json.loads(raw_json[start:end+1])
                    if "company" in data:
                        with db.conn(email) as c:
                            round_val = (data.get("round") or "all").lower()
                            company_query = f"%{data.get('company')}%"
                            if round_val == "all":
                                c.execute("DELETE FROM deadlines WHERE company LIKE ?", (company_query,))
                                # Also cascade to rounds
                                row = c.execute("SELECT id FROM companies WHERE name LIKE ?", (company_query,)).fetchone()
                                if row:
                                    c.execute("DELETE FROM rounds WHERE company_id = ?", (row['id'],))
                                return {"response": f"All upcoming deadlines and rounds for '{data['company']}' have been deleted."}
                            else:
                                round_query = f"%{data.get('round')}%"
                                c.execute("DELETE FROM deadlines WHERE company LIKE ? AND title LIKE ?", (company_query, round_query))
                                return {"response": f"The '{data['round']}' deadline for '{data['company']}' has been deleted."}
            except Exception as e:
                print("Could not parse delete JSON", e)
                pass

        elif text.startswith("/skill"):
            import re
            json_match = re.search(r'```json\n(.*?)\n```', resp, re.DOTALL)
            raw_json = json_match.group(1) if json_match else resp
            try:
                start = raw_json.find('{')
                end = raw_json.rfind('}')
                if start != -1 and end != -1:
                    data = json.loads(raw_json[start:end+1])
                    if "topic" in data and "level" in data:
                        existing_skills = [s['topic'] for s in db.get_skill_levels(email)]
                        matched_topic = agent.match_skill(data['topic'], existing_skills)
                        
                        with db.conn(email) as c:
                            from datetime import datetime
                            now_str = datetime.now().isoformat()
                            if matched_topic == "NEW":
                                c.execute("INSERT INTO skill_levels (topic, proficiency, last_tested) VALUES (?, ?, ?)", 
                                          (data['topic'], data['level'], now_str))
                                final_topic = data['topic']
                            else:
                                c.execute("UPDATE skill_levels SET proficiency = ?, last_tested = ? WHERE topic = ?", 
                                          (data['level'], now_str, matched_topic))
                                final_topic = matched_topic
                                
                        return {"response": f"Skill updated! Proficiency for '{final_topic}' is now {data['level']}%."}
            except Exception as e:
                print("Could not parse skill JSON", e)
                
        elif text.startswith("/doc"):
            import re
            json_match = re.search(r'```json\n(.*?)\n```', resp, re.DOTALL)
            raw_json = json_match.group(1) if json_match else resp
            try:
                start = raw_json.find('{')
                end = raw_json.rfind('}')
                if start != -1 and end != -1:
                    data = json.loads(raw_json[start:end+1])
                    if "title" in data and "summary" in data:
                        return {"response": f"**Document Ingested: {data['title']}**\n\n{data['summary']}\n\n*This document has been safely stored in your Knowledge Vault for future semantic search.*"}
            except Exception as e:
                print("Could not parse doc JSON", e)

        elif text.startswith("/study"):
            import re
            # Parse the response from agent (which handles /study update and info)
            try:
                parsed_resp = agent._extract_json_object(resp)

                if parsed_resp.get("action") == "info":
                    # /study regenerate was removed — inform the user
                    return {"response": parsed_resp.get("message", "Your study plan auto-updates when you add a company or change your timetable.")}

                elif parsed_resp.get("action") == "update" and "instruction" in parsed_resp:
                    instruction = parsed_resp["instruction"]
                    # Instead of sending the full plan JSON to Gemini (expensive),
                    # regenerate a fresh plan with the instruction baked in as context.
                    background_tasks.add_task(trigger_plan_regeneration, email, trigger=f"Study update: {instruction[:80]}")
                    return {"response": f"✅ Updating your study plan with: *'{instruction}'*. Ready in a few seconds..."}

            except Exception as e:
                print("Could not parse /study response", e)

        # Handle focus_update action (from free chat: "I want to focus on Graphs")
        try:
            parsed = agent._extract_json_object(resp)
            if parsed.get("action") == "focus_update":
                topics = parsed.get("topics", "")
                background_tasks.add_task(trigger_plan_regeneration, email, trigger=f"Focus request: {topics}")
                return {"response": f"✅ Got it! I'll focus your study plan on **{topics}**. Updating in the background..."}
        except Exception:
            pass

        return {"response": resp}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
def handle_chat(msg: ChatMessage, email: str = Depends(get_current_user)):
    try:
        # Retrieve past conversation context semantically
        chat_context = memory.get_chat_memory(email, msg.message)
        
        # Process command with context
        resp = agent.process_pcc_command(msg.message, chat_context=chat_context)
        
        # Save this interaction to memory
        memory.add_chat_memory(email, msg.message, resp)
        
        return {"response": resp}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/study_plan")
def get_study_plan(email: str = Depends(get_current_user)):
    try:
        plan_path = vault.get_vault_path(email) / "Generated" / "study_plan.json"
        if plan_path.exists():
            plan_data = json.loads(plan_path.read_text(encoding="utf-8"))
            return {"plan": plan_data}
        return {"plan": []}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/study_plan/versions")
def get_study_plan_versions(email: str = Depends(get_current_user)):
    """Returns the list of all versioned study plans (newest first)."""
    try:
        return {"versions": vault.list_study_plan_versions(email)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/study_plan/versions/{filename}")
def get_study_plan_version(filename: str, email: str = Depends(get_current_user)):
    """Returns the content of a specific versioned study plan."""
    try:
        data = vault.get_study_plan_version(email, filename)
        if not data:
            raise HTTPException(status_code=404, detail="Version not found")
        return data
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status/study_plan")
def get_study_plan_status(email: str = Depends(get_current_user)):
    global is_generating_plan
    return {"is_generating": is_generating_plan.get(email, False)}

class AtsRequest(BaseModel):
    job_description: str

@app.post("/api/ats/scan")
def scan_ats(req: AtsRequest, email: str = Depends(get_current_user)):
    try:
        cv_dir = vault.get_vault_path(email) / "CV"
        if not cv_dir.exists():
            raise HTTPException(status_code=404, detail="CV not found. Please upload a CV first.")
        
        cv_files = list(cv_dir.glob("*"))
        if not cv_files:
            raise HTTPException(status_code=404, detail="CV not found. Please upload a CV first.")
            
        cv_path = cv_files[0]
        from core.vault import _text
        cv_text = _text(cv_path)
        
        report = agent.generate_ats_report(cv_text, req.job_description)
        return report
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
