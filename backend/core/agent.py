import json
import os
import re
import time
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Model Configuration
# ---------------------------------------------------------------------------
# Smart model: handles complex tasks (study plans, chat, assessments)
SMART_MODEL = "qwen3:8b"
# Fast model: handles simple extraction tasks (JSON parsing, yes/no, matching)
FAST_MODEL = "qwen2.5:1.5b"
# Gemini API fallback (used only when ollama is unreachable)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-flash-latest"
# Gemini model used specifically for study plan generation
# gemini-flash-latest: active free tier model without limit: 0 restrictions
GEMINI_PLAN_MODEL = "gemini-flash-latest"

# ---------------------------------------------------------------------------
# Core Helpers
# ---------------------------------------------------------------------------

def _strip_thinking(text: str) -> str:
    """
    qwen3 models wrap their reasoning in <think>...</think> tags.
    This strips those tags and returns only the final answer.
    """
    # Remove <think>...</think> blocks (including multiline)
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    return cleaned.strip()


def _extract_json_object(text: str) -> dict:
    """
    Robustly extracts a JSON object {...} from messy LLM output.
    Handles markdown fences, thinking tags, and surrounding prose.
    """
    text = _strip_thinking(text)
    # Remove markdown code fences
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()

    # Find the first { and last } to extract JSON object
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    return {}


def _extract_json_array(text: str) -> list:
    """
    Robustly extracts a JSON array [...] from messy LLM output.
    Handles markdown fences, thinking tags, and surrounding prose.
    """
    text = _strip_thinking(text)
    # Remove markdown code fences
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()

    # Find the first [ and last ] to extract JSON array
    start = text.find('[')
    end = text.rfind(']')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    return []


def _call_ollama(prompt: str, system: str = None, model: str = None, timeout: int = 180) -> str:
    """
    Calls ollama and returns the clean text response.
    Strips thinking tags from qwen3 models.
    Falls back to Gemini REST API if ollama is unreachable.
    """
    if model is None:
        model = SMART_MODEL

    # Build messages list
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        import ollama
        resp = ollama.chat(model=model, messages=messages)
        text = resp['message']['content']
        return _strip_thinking(text).strip()
    except ImportError:
        print("[Agent] ollama package not installed, falling back to Gemini API")
        return _call_gemini_fallback(prompt, system)
    except Exception as e:
        error_msg = str(e).lower()
        if "connection" in error_msg or "refused" in error_msg or "timeout" in error_msg:
            print(f"[Agent] Ollama unreachable ({e}), falling back to Gemini API")
            return _call_gemini_fallback(prompt, system)
        else:
            print(f"[Agent] Ollama error: {e}")
            return ""


def _call_gemini_plan(prompt: str, system: str = None) -> str:
    """
    Dedicated Gemini API caller for study plan generation.
    Uses gemini-2.0-flash for high-quality, fast plan output.
    Falls back to _call_fast (local) if API key is missing or quota exceeded.
    """
    if not GEMINI_API_KEY:
        print("[Gemini] No API key — falling back to local model for plan generation.")
        return _call_fast(prompt, system=system)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_PLAN_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    if system:
        payload["system_instruction"] = {"parts": [{"text": system}]}

    for attempt in range(4):
        try:
            r = requests.post(url, json=payload, timeout=120)
            if r.status_code == 200:
                parts = r.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
                text = ""
                for part in parts:
                    if "text" in part:
                        text = part["text"]
                print(f"[Gemini] Plan generated successfully ({len(text)} chars)")
                return text.strip()
            elif r.status_code == 429:
                wait = 2 ** attempt
                print(f"[Gemini] Rate limited on plan model, retrying in {wait}s...")
                time.sleep(wait)
            else:
                print(f"[Gemini] Plan API error {r.status_code}: {r.text[:200]}")
                print("[Gemini] Falling back to local model for plan generation.")
                return _call_fast(prompt, system=system)
        except Exception as e:
            print(f"[Gemini] Plan request error: {e}")
            return _call_fast(prompt, system=system)
    print("[Gemini] Max retries hit — falling back to local model.")
    return _call_fast(prompt, system=system)


def _call_gemini_fallback(prompt: str, system: str = None) -> str:
    """
    Fallback: calls Gemini REST API when ollama is down.
    """
    if not GEMINI_API_KEY:
        print("[Agent] No Gemini API key configured and ollama is down.")
        return ""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    if system:
        payload["system_instruction"] = {"parts": [{"text": system}]}

    for attempt in range(6):
        try:
            r = requests.post(url, json=payload, timeout=120)
            if r.status_code == 200:
                parts = r.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
                text = ""
                for part in parts:
                    if "text" in part:
                        text = part["text"]
                return text.strip()
            elif r.status_code == 429:
                wait = 5 * (attempt + 1)
                print(f"[Gemini] Rate limited, retrying in {wait}s...")
                time.sleep(wait)
            else:
                print(f"[Gemini] Error {r.status_code}: {r.text[:200]}")
                return ""
        except Exception as e:
            print(f"[Gemini] Request error: {e}")
            return ""
    return ""


def _call_fast(prompt: str, system: str = None) -> str:
    """Routes to the fast (small) model for simple extraction tasks."""
    return _call_gemini_fallback(prompt, system=system)


def _call_smart(prompt: str, system: str = None) -> str:
    """Routes to the smart (large) model for complex reasoning tasks."""
    return _call_gemini_fallback(prompt, system=system)


# ---------------------------------------------------------------------------
# Per-Command Mini Prompts (tiny = fast)
# ---------------------------------------------------------------------------

_PROMPT_TIMETABLE = '''Extract schedule hours from the text. Map synonyms appropriately (e.g., class/school/college -> CollegeHours, misc/others -> OtherTime, study/prep -> CourseHours). Missing categories must be 0. Output ONLY valid JSON with keys: CollegeHours, CourseHours, SleepTime, OtherTime.
Example Input: "sleep=8, class=7, others=4"
Example Output: {"CollegeHours": 7, "CourseHours": 0, "SleepTime": 8, "OtherTime": 4}

Text: '''
_PROMPT_COMPANY = 'Extract company details from the text below. Output ONLY a JSON object with keys: "name" (string), "role" (string), "matrix" (string describing what they test on), "rounds" (array of objects with "name" and "date" in ISO-8601 format like "2026-07-25T00:00:00"). Assume current year is 2026. No explanation.\n\nText: '
_PROMPT_SKILL = 'Extract the topic name and proficiency level (0-100) from the text below. Output ONLY a JSON object: {"topic": "TOPIC_NAME", "level": NUMBER}. Use the EXACT number the user specified. No explanation.\n\nText: '
_PROMPT_DELETE = 'Extract the company name and round to delete from the text below. Output ONLY a JSON object: {"company": "NAME", "round": "ROUND_NAME"}. If no specific round, set "round" to "all". No explanation.\n\nText: '
_PROMPT_STUDY = 'The user wants to modify their study plan. If they want to rebuild/reset/regenerate completely, output: {"action": "regenerate"}. If they want to edit/update specific parts, output: {"action": "update", "instruction": "WHAT_THEY_WANT"}. Output ONLY raw JSON, no explanation.\n\nText: '
_PROMPT_DOC = 'Summarize the document described below into 2-3 sentences. Output ONLY a JSON object: {"title": "TITLE", "summary": "SUMMARY"}. No explanation.\n\nText: '
_PROMPT_CHAT = 'You are a concise, professional placement-prep mentor for a CSE student. Answer helpfully in 2-4 sentences. Be actionable.'


# ---------------------------------------------------------------------------
# Public API Functions
# ---------------------------------------------------------------------------

def answer(company, question, chunks, tracker_info, chat_context=""):
    """
    Assembles a prompt with context and sends it to the fast LLM for instant chat (~5s).
    """
    system = (
        "You are a professional placement-prep assistant. Answer ONLY from the "
        "TRACKER and CONTEXT below. If the information isn't there, say you "
        "don't have that information. Be concise and actionable.\n\n"
        f"PAST CONVERSATIONS (Semantic Memory):\n{chat_context}\n\n"
        f"TRACKER DATA:\n{tracker_info}\n\n"
        f"CONTEXT (notes/JDs on {company}):\n"
        + "\n---\n".join(chunks)
    )

    result = _call_fast(question, system=system)
    return result if result else "I am currently offline or experiencing an issue. Please try again."


def process_pcc_command(message: str, chat_context: str = "") -> str:
    """
    Routes each slash command to deterministic parsing (0.001s) or fast model (~5s).
    """
    text = message.strip()

    if text.startswith("/skill"):
        body = text[len("/skill"):].strip()
        # Deterministic extraction: /skill <topic> <level>
        match = re.search(r'^(?P<topic>.+?)\s+(?P<level>\d+)\s*$', body)
        if match:
            return json.dumps({"topic": match.group("topic").strip(), "level": int(match.group("level"))})
        return _call_fast(_PROMPT_SKILL + body)

    elif text.startswith("/delete"):
        body = text[len("/delete"):].strip()
        # Deterministic extraction if possible
        match = re.search(r'^(?P<company>.+?)(?:\s+(?P<round>all|oa|technical|interview|round.*))?$', body, re.I)
        if match and len(body.split()) <= 4:
            company = match.group("company").strip()
            rnd = match.group("round") or "all"
            return json.dumps({"company": company, "round": rnd.strip()})
        return _call_fast(_PROMPT_DELETE + body)

    elif text.startswith("/timetable"):
        body = text[len("/timetable"):].strip()
        return _call_fast(_PROMPT_TIMETABLE + body)

    elif text.startswith("/company"):
        body = text[len("/company"):].strip()
        return _call_fast(_PROMPT_COMPANY + body)

    elif text.startswith("/study"):
        body = text[len("/study"):].strip()
        # /study regenerate is removed — auto-triggers handle it
        if re.search(r'^regenerate?|^reset|^rebuild|^redo', body, re.I):
            return json.dumps({"action": "info", "message": "Your study plan auto-updates whenever you add a company or change your timetable — no need to regenerate manually!"})
        # /study update <instruction> is kept
        return _call_fast(_PROMPT_STUDY + body)

    elif text.startswith("/doc"):
        body = text[len("/doc"):].strip()
        return _call_fast(_PROMPT_DOC + body)

    elif text.startswith("/status"):
        return '{"status": "ok"}'

    else:
        # Free-text chat — detect focus intent before calling LLM
        # e.g. "I want to focus on Graphs and DP" → trigger plan update
        focus_match = re.search(
            r'\b(?:focus|concentrate|work|practice|study|revise|brush up)\s+(?:on|more on)?\s+(.+)',
            text, re.I
        )
        if focus_match:
            topics = focus_match.group(1).strip().rstrip('.')
            return json.dumps({"action": "focus_update", "topics": topics})

        sys_prompt = _PROMPT_CHAT + f"\n\nPAST CONVERSATIONS (Semantic Memory):\n{chat_context}"
        result = _call_fast(text, system=sys_prompt)
        return result if result else "I'm having trouble responding right now. Please try again."


def make_plan(company, days_left, chunks, tracker_info):
    """
    Specialized function to generate a study plan.
    """
    q = (f"My process for {company} is in {days_left} days. Using the tracker "
         f"state and my notes, output a day-by-day prep plan as a markdown table: "
         "| Day | Focus | Task | Done? |. Prioritize topics from the notes.")
    return answer(company, q, chunks, tracker_info)


from core import vault, db


def get_baseline_test():
    """
    Generates a comprehensive diagnostic test based on the user's tech stack.
    Tests all core topics (DSA, Aptitude, OS, DBMS, Networks, System Design).
    """
    profile_path = vault.VAULT / "Generated" / "profile.json"
    tech_stack = "Python, Java, C++"
    if profile_path.exists():
        try:
            with open(profile_path, 'r') as f:
                prof = json.load(f)
                tech_stack = prof.get("languages", tech_stack)
        except Exception:
            pass

    prompt = f"""
    The user's preferred coding languages are: {tech_stack}.
    Generate a comprehensive technical baseline assessment consisting of exactly 8 questions:
    - 2 Coding questions (1 Medium, 1 Hard) in {tech_stack}. MUST include realistic LeetCode/NeetCode/HackerRank clickable URLs.
    - 1 Aptitude/Reasoning question.
    - 1 Operating Systems question.
    - 1 Database Management Systems question.
    - 1 Computer Networks question.
    - 1 System Design question.
    - 1 language-specific conceptual question for {tech_stack}.
    
    Return the response STRICTLY as a JSON array of objects. 
    Each object must have exactly these keys: "title", "topic" (DSA, Aptitude, OS, DBMS, Networks, System Design, Language), "link" (URL or empty string).
    Do NOT include any markdown formatting, backticks, or extra text. Just the raw JSON array.
    """

    content = _call_smart(prompt)
    questions = _extract_json_array(content)

    if questions:
        return questions

    # Fallback to default questions if LLM output couldn't be parsed
    print("[Agent] Failed to parse LLM JSON output. Falling back to default questions.")
    return [
        {"title": "Two Sum", "topic": "DSA", "link": "https://leetcode.com/problems/two-sum/"},
        {"title": "Merge k Sorted Lists", "topic": "DSA", "link": "https://leetcode.com/problems/merge-k-sorted-lists/"},
        {"title": "Explain ACID properties.", "topic": "DBMS", "link": ""},
        {"title": "What is a deadlock?", "topic": "OS", "link": ""},
        {"title": "TCP vs UDP", "topic": "Networks", "link": ""},
        {"title": "Design a URL shortener", "topic": "System Design", "link": ""}
    ]


def generate_study_plan(company_matrix, available_hours):
    """
    Generates a personalized daily study schedule using the smart model.
    """
    skill_levels = db.get_skill_levels()
    mastery_str = ", ".join([f"{s['topic']}: {s['proficiency']}%" for s in skill_levels])

    current_date_obj = datetime.now()
    dates_list = []

    # Pre-compute exact 14 dates
    for i in range(14):
        date_str = (current_date_obj + timedelta(days=i)).strftime('%B %d, %Y')
        dates_list.append(date_str)

    dates_str = ", ".join(dates_list)

    prompt = f"""
    You are the PCC Roadmap Architect. Generate a JSON study plan that satisfies the following:
    
    Context:
    - User's daily free time: {available_hours} hours.
    - User's current mastery levels: {mastery_str}
    - Target evaluation matrix (Upcoming deadlines): {company_matrix}
    
    Guidelines:
    1. Exact 14-Day Sprint: You MUST generate exactly 14 JSON objects, one for each of these exact dates in order: {dates_str}. Do not stop early.
    2. Buffer Days: For every 4th day (i.e. {dates_list[3]}, {dates_list[7]}, {dates_list[11]}), YOU MUST set "task_type": "Review" and schedule NO new topics.
    3. Pre-Deadline Prep: If any company in the evaluation matrix has a deadline falling within these 14 days, BOTH the actual deadline date AND the date immediately BEFORE that deadline MUST be set to "task_type": "Review" and focus exclusively on mock tests for that company.
    4. Mastery-Based: Do not schedule introductory content for topics with >70% mastery. Assign 'Speed Runs' for these topics instead.
    5. Task Content: Do NOT assign specific LeetCode problem numbers. Instead, suggest the exact conceptual topics, algorithms, and theory to study (e.g. "Review Dijkstra's algorithm", "Understand DP state transitions", "Speed Run: Graph conceptual review").
    6. Prioritization: Weigh focus areas by company proximity.
    7. Format: Output ONLY a JSON array with exactly this structure for ALL 14 days: [{{"date": "July 18, 2026", "focus": "Graphs", "time": "2 hours", "tasks": ["Review Dijkstra's theory", "Understand union-find concept"], "task_type": "Learning"}}]
    
    Do not include any explanation or "Here is your plan:" text. Output ONLY the JSON array.
    """

    # Use Gemini API for high-quality, fast study plan generation
    content = _call_gemini_plan(prompt)

    if not content:
        return "[]"

    # Try to extract as a valid JSON array
    parsed = _extract_json_array(content)
    if parsed:
        return json.dumps(parsed)

    # If extraction failed, return raw cleaned content and let the caller handle it
    content = _strip_thinking(content)
    content = re.sub(r'```json\s*', '', content)
    content = re.sub(r'```\s*', '', content)
    return content.strip()


def evaluate_answer(question_text, approach, solved_it):
    """
    Evaluates the user's approach to a question using the fast model.
    Returns True if correct/satisfactory, False otherwise.
    """
    if not solved_it:
        return False

    prompt = (
        f"The question was: '{question_text}'. The user claims they solved it "
        f"and their approach was: '{approach}'. Is this approach generally valid "
        f"for this problem? Reply with exactly YES or NO."
    )

    result = _call_fast(prompt)
    return "YES" in result.upper() if result else False


def calculate_available_hours(timetable_text):
    """
    Uses the offline Ollama model to calculate available study hours from the timetable text.
    It performs 24 - (CollegeHours + CourseHours + SleepTime + OtherTime).
    """
    prompt = f"""
    You are a timetable calculator. I will give you a list of hours spent on various activities.
    Your task is to calculate the remaining available hours in a 24-hour day.
    Formula: 24 - (CollegeHours + CourseHours + SleepTime + OtherTime)
    
    If an activity is missing, treat its value as 0.
    
    Timetable:
    {timetable_text}
    
    Output ONLY a raw JSON object with the key "available_hours" mapped to the calculated number.
    Do not include markdown or explanations.
    """
    content = _call_fast(prompt)
    if not content:
        return 4.0
        
    result = _extract_json_object(content)
    if result and "available_hours" in result:
        try:
            return float(result["available_hours"])
        except (ValueError, TypeError):
            pass
            
    return 4.0


def evaluate_assessment_results(results_data: dict, existing_skills: list = None) -> list[dict]:
    existing_skills_str = json.dumps(existing_skills, indent=2) if existing_skills else "[]"
    
    # Build summary
    apt_answers = results_data.get('aptAnswers', {})
    mistakes = results_data.get('mistakes', [])
    total_attempted = len(apt_answers)
    wrong_count = len(mistakes)
    correct_count = total_attempted - wrong_count
    
    # Build a list of wrong question topics from the mistakes
    mistake_topics = [m.get('topic', m.get('question', '')[:40]) for m in mistakes]
    
    prompt = f"""
    Evaluate the following assessment results and return a JSON list of updated skill proficiencies.
    
    Existing Skill Levels (these are the ONLY topic names you are allowed to use unless absolutely necessary to create a new one):
    {existing_skills_str}
    
    Assessment Summary:
    - Aptitude Questions Attempted: {total_attempted}
    - Correct Answers: {correct_count}
    - Wrong Answers: {wrong_count}
    - Accuracy: {round(correct_count / total_attempted * 100) if total_attempted > 0 else 0}%
    
    Topics of wrong answers (subjects to DECREASE):
    {json.dumps(mistake_topics, indent=2)}
    
    Coding Self Report (self-assessed solved/not):
    {json.dumps(results_data.get('codingScores', {}), indent=2)}
    
    Total Aptitude Time Taken: {results_data.get('aptTime', 0)} seconds
    Total Coding Time Taken: {results_data.get('codingTime', 0)} seconds
    
    CRITICAL INSTRUCTIONS:
    1. Map ALL skills strictly to names already in Existing Skill Levels. If "DSA" exists, never create "Data Structures", "Data Structures and Algorithms", etc. ONLY create a brand new skill name if no existing skill comes close.
    2. INCREMENTAL updates ONLY. Maximum change is ±10 points per evaluation. Never jump to 0 or 100.
       - If correct_count / total_attempted >= 0.8: increment by 5-10 points
       - If correct_count / total_attempted >= 0.5: increment by 2-5 points
       - If correct_count / total_attempted < 0.5: decrement by 5-10 points
    3. Only consider time taken for CORRECT answers — wrong answers get no time bonus.
    4. Coding: if "solved": true, increment the related skill by 5; if false, decrement by 5.
    5. Return ONLY a valid JSON array: [{{"topic": "Exact Skill Name", "proficiency": 80}}]
    6. Proficiency must be clamped between 5 and 99.
    """
    system = "You are a precise JSON-only API that evaluates technical assessments. Output ONLY a raw JSON array with no markdown, no explanations, no extra text."
    resp = _call_smart(prompt, system=system)
    return _extract_json_array(resp)



def extract_academic_info(text: str) -> dict:
    """
    Extracts 12th percentage and current CGPA from document text using the fast model.
    """
    prompt = f"""
    You are a document extraction AI. Extract the 12th grade percentage (or equivalent) and current CGPA from the text below.
    If you cannot find one of them, return null for that field.
    Return ONLY a raw JSON object with keys "12th_percentage" and "cgpa". Do not include markdown blocks or any other text.
    
    TEXT:
    {text[:4000]}
    """
    content = _call_fast(prompt)

    if not content:
        return {"12th_percentage": None, "cgpa": None}

    result = _extract_json_object(content)
    if result:
        return result

    return {"12th_percentage": None, "cgpa": None}


def match_skill(requested_topic: str, existing_topics: list) -> str:
    """
    Uses the offline Ollama model to match a requested topic to a list of existing topics.
    """
    req_clean = requested_topic.strip()
    if not req_clean or not existing_topics:
        return "NEW"

    # exact match check as a fast path
    for existing in existing_topics:
        if req_clean.lower() == existing.lower():
            return existing

    prompt = f"""
    You are a skill matcher. I have a requested topic: "{req_clean}"
    And a list of existing topics: {existing_topics}
    
    Is the requested topic essentially the same as any of the existing topics (allowing for slight typos, plural/singular forms, or case differences)?
    
    Output ONLY a raw JSON object with the key "matched_topic".
    If there is a match, set "matched_topic" to the EXACT string from the existing topics list.
    If there is no good match, set "matched_topic" to "NEW".
    Do not include markdown or explanations.
    """
    content = _call_fast(prompt)
    if not content:
        return "NEW"
        
    result = _extract_json_object(content)
    if result and "matched_topic" in result:
        matched = result["matched_topic"]
        if matched in existing_topics:
            return matched
            
    return "NEW"

def sanitize_cv(cv_text: str) -> str:
    """
    Uses the local offline model to strip PII from CV text, keeping only skills, projects, and work experience.
    """
    if not cv_text.strip():
        return ""
    prompt = f"""
    You are a data privacy filter. I will provide you with a CV text.
    Your task is to extract ONLY the technical skills, projects, and work experience.
    You MUST completely remove and ignore any personal identifiable information (PII) such as:
    - Names, Phone numbers, Email addresses
    - GitHub links, LinkedIn links, URLs
    - Physical addresses, Photos
    
    Output the cleaned summary in plain text.
    
    CV TEXT:
    {cv_text[:4000]}
    """
    cleaned = _call_fast(prompt)
    return cleaned if cleaned else "No technical skills extracted."

def generate_career_review(cv_text: str, academic_profile: str) -> str:
    """
    Generates a detailed career review and improvement assessment based on uploaded academic documents.
    Uses Gemini API for deeper analysis.
    """
    sanitized_cv = sanitize_cv(cv_text)
    
    prompt = f"""
    You are an expert tech career counselor. I am providing you with my academic performance data and the sanitized summary of my CV (skills/projects).
    
    Your task:
    1. Summarize my profile and current academic standing based on the scores provided.
    2. Assess my strengths and weaknesses based on the academic scores and CV projects/skills.
    3. Provide a detailed review and specific areas of improvement for different trending CS career paths (e.g., AI/Machine Learning, Full-Stack Engineering, Data Science, Cybersecurity).
    
    Format your response in clean Markdown with clear headings, bullet points, and actionable advice.
    
    ACADEMIC SCORES (Manually verified):
    {academic_profile}
    
    CV EXTRACT (Skills & Projects):
    {sanitized_cv}
    """
    return _call_gemini_fallback(prompt)


# ─── Assessment AI Agents ─────────────────────────────────────────────────────

def generate_aptitude_questions(weak_skills: list, count: int = 6) -> list:
    """
    Uses qwen3:8b (local) to generate fresh Medium/Hard aptitude questions
    targeted at the user's weakest skill areas.
    Returns a list of question dicts or [] on failure.
    """
    skills_str = ", ".join(weak_skills[:5]) if weak_skills else "general aptitude"
    sections_needed = count // 3  # 2 per section for 6-question set
    prompt = f"""You are a placement exam question generator. Generate exactly {count} aptitude questions.
The user's weakest areas are: {skills_str}. Bias questions toward Quantitative and Logical reasoning.

Rules:
- ALL questions MUST be Medium or Hard difficulty. No Easy questions.
- Distribute as: {sections_needed*1} Verbal, {sections_needed*1} Quantitative, {sections_needed*1} Logical (adjust for count).
- For count=6: exactly 2 Verbal, 2 Quantitative, 2 Logical.
- For count=10: exactly 4 Verbal, 3 Quantitative, 3 Logical.
- Each question must be 100% mathematically and logically correct.

Return ONLY a JSON array. Each element must have:
{{"id": "GEN-<section_abbr>-<3digit_number>", "section": "Verbal|Quantitative|Logical", "difficulty": "Medium|Hard", "question": "...", "options": ["A text","B text","C text","D text"], "answer": "A|B|C|D", "explanation": "clear step-by-step reasoning"}}

The "options" array must contain plain strings (the text only, no letter prefix).
The "answer" must be only the letter A, B, C, or D.
Output ONLY the JSON array, nothing else."""

    system = "You are a precise JSON-only API that generates placement aptitude questions. Output raw JSON array only. No markdown, no prose."
    resp = _call_smart(prompt, system=system)
    result = _extract_json_array(resp)
    # Validate structure
    valid = []
    for q in result:
        if all(k in q for k in ["id", "section", "question", "options", "answer"]) and len(q.get("options", [])) == 4:
            valid.append(q)
    return valid


def select_leetcode_problems(topic: str) -> list:
    """
    Uses Gemini to select the single best Medium + Hard LeetCode problem
    for the given topic. Returns list of 2 dicts with title, url, difficulty.
    Falls back to local lc_map if Gemini fails.
    """
    prompt = f"""I need exactly 2 real LeetCode problems for the topic: "{topic}".
Select 1 Medium and 1 Hard difficulty problem that best represent this topic.
Only use real LeetCode problems with valid URLs in the format: https://leetcode.com/problems/<slug>/

Return ONLY a JSON array with exactly 2 elements:
[
  {{"title": "Problem Name", "url": "https://leetcode.com/problems/problem-slug/", "difficulty": "Medium"}},
  {{"title": "Problem Name", "url": "https://leetcode.com/problems/problem-slug/", "difficulty": "Hard"}}
]

Output ONLY the JSON array. No markdown, no explanations."""

    resp = _call_gemini_fallback(prompt)
    result = _extract_json_array(resp)
    # Validate we got 2 valid problems
    valid = [p for p in result if all(k in p for k in ["title", "url", "difficulty"])
             and "leetcode.com/problems/" in p.get("url", "")]
    if len(valid) >= 2:
        return valid[:2]
    return []  # Caller falls back to lc_map


def generate_initial_assessment_questions() -> dict:
    """
    Uses Gemini to generate the one-time baseline assessment (10 aptitude + 3 coding).
    This is called ONCE and cached in Generated/initial_assessment.json.
    """
    prompt = """Generate a comprehensive baseline placement assessment with:
- 10 aptitude questions: 4 Verbal (Hard), 3 Quantitative (Hard), 3 Logical (Hard)
- 3 coding problems: 1 Easy, 1 Medium, 1 Hard (real LeetCode problems)

The aptitude questions must be challenging and suitable for campus placement screening.
The coding problems must be real LeetCode problems with valid URLs.

Return ONLY a JSON object:
{
  "aptitude": [
    {"id": "APT-001", "section": "Verbal", "difficulty": "Hard", "question": "...", "options": ["text","text","text","text"], "answer": "A|B|C|D", "explanation": "step-by-step reasoning"},
    ... (10 total)
  ],
  "coding": [
    {"title": "Problem Name", "url": "https://leetcode.com/problems/slug/", "difficulty": "Easy"},
    {"title": "Problem Name", "url": "https://leetcode.com/problems/slug/", "difficulty": "Medium"},
    {"title": "Problem Name", "url": "https://leetcode.com/problems/slug/", "difficulty": "Hard"}
  ]
}

Rules:
- options arrays must contain only plain text strings (no letter prefixes like "A.")
- answer must be only the letter A, B, C, or D
- All aptitude questions must be 100% correct
- Use real, well-known LeetCode problems only
Output ONLY the JSON object, nothing else."""

    resp = _call_gemini_fallback(prompt)
    result = _extract_json_object(resp)
    if result and "aptitude" in result and "coding" in result:
        if len(result["aptitude"]) >= 8 and len(result["coding"]) >= 3:
            return result
    return {}


def replenish_aptitude_bank_background(consumed_categories: list):
    """
    Background task to generate new aptitude questions for the categories consumed
    and append them to question_bank.json.
    """
    try:
        import json as _json, os
        base_dir = os.path.dirname(os.path.abspath(__file__))
        qbank_path = os.path.join(base_dir, "..", "question_bank.json")
        if not os.path.exists(qbank_path):
            return
            
        with open(qbank_path, "r", encoding="utf-8") as f:
            qbank = _json.load(f)
            
        new_questions = []
        for cat in set(consumed_categories):
            prompt = f"""Generate 2 fresh, unique Medium/Hard aptitude questions for the category: {cat}.
            Format as JSON array of objects:
            [ {{"id": "NEW-ID", "difficulty": "Hard", "question": "...", "options": ["A", "B", "C", "D"], "answer": "A", "explanation": "..."}} ]
            """
            resp = _call_gemini_fallback(prompt)
            parsed = _extract_json_array(resp)
            for q in parsed:
                if all(k in q for k in ["question", "options", "answer", "explanation"]):
                    import uuid
                    q["id"] = f"{cat[:3].upper()}-{str(uuid.uuid4())[:6]}"
                    q["difficulty"] = q.get("difficulty", "Hard")
                    qbank.setdefault(cat.lower(), []).append(q)
                    
        with open(qbank_path, "w", encoding="utf-8") as f:
            _json.dump(qbank, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        print(f"[Replenish] Failed to replenish aptitude bank: {e}")

def replenish_coding_bank_background(consumed_topics: list):
    """
    Background task to generate new LeetCode questions for the topics consumed
    and append them to leetcode_map.json.
    """
    try:
        import json as _json, os
        base_dir = os.path.dirname(os.path.abspath(__file__))
        lc_path = os.path.join(base_dir, "..", "leetcode_map.json")
        if not os.path.exists(lc_path):
            return
            
        with open(lc_path, "r", encoding="utf-8") as f:
            lc_map = _json.load(f)
            
        for topic in set(consumed_topics):
            prompt = f"""Find 2 fresh, real LeetCode problems (1 Medium, 1 Hard) for the topic: {topic}.
            Ensure they are DIFFERENT from commonly known ones if possible.
            Format as JSON array:
            [ {{"title": "...", "url": "https://leetcode.com/problems/...", "difficulty": "Medium"}} ]
            """
            resp = _call_gemini_fallback(prompt)
            parsed = _extract_json_array(resp)
            for q in parsed:
                if all(k in q for k in ["title", "url", "difficulty"]) and "leetcode.com" in q.get("url", ""):
                    # Append to map under the topic (create topic if not exists)
                    lc_map.setdefault(topic, []).append(q)
                    
        with open(lc_path, "w", encoding="utf-8") as f:
            _json.dump(lc_map, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        print(f"[Replenish] Failed to replenish coding bank: {e}")


def generate_wrong_answer_explanation(question: str, options: list, correct_answer: str, user_answer: str) -> str:
    """
    Uses qwen3:8b (local, deep reasoning) to generate a step-by-step explanation
    for a wrong aptitude answer. Returns plain text explanation.
    """
    correct_idx = ["A", "B", "C", "D"].index(correct_answer) if correct_answer in ["A","B","C","D"] else 0
    correct_text = options[correct_idx] if correct_idx < len(options) else correct_answer
    user_idx = ["A", "B", "C", "D"].index(user_answer) if user_answer in ["A","B","C","D"] else -1
    user_text = options[user_idx] if 0 <= user_idx < len(options) else "Not answered"

    prompt = f"""Explain why the answer to this aptitude question is {correct_answer} and not {user_answer}.

Question: {question}
Options: {chr(10).join(f"{chr(65+i)}. {opt}" for i, opt in enumerate(options))}
Correct Answer: {correct_answer}. {correct_text}
User's Answer: {user_answer}. {user_text}

Write a clear, concise step-by-step explanation (3-5 sentences max) that:
1. States the correct approach/formula/reasoning
2. Shows how to arrive at {correct_text}
3. Explains why {user_text} is incorrect

Write in plain text. No markdown, no bullet points."""

    system = "You are a clear, patient aptitude coach. Explain solutions concisely in plain text."
    resp = _call_smart(prompt, system=system)
    return resp.strip() if resp else f"The correct answer is {correct_answer}. {correct_text}."


# ─── Dashboard AI Agents ──────────────────────────────────────────────────────

def generate_dashboard_insight(skills: list, deadlines: list, available_hours: float) -> str:
    """
    Uses qwen2.5:1.5b (fast, local) to generate a short personalized
    'Today's Focus' insight shown at the top of the right sidebar.
    """
    if not skills and not deadlines:
        return ""

    # Build compact context
    weak = sorted(skills, key=lambda s: s.get("proficiency", 50))[:3]
    weak_str = ", ".join(f"{s['topic']} ({s['proficiency']}%)" for s in weak) if weak else "none yet"

    urgent = []
    import datetime
    today = datetime.date.today()
    for d in deadlines:
        try:
            due = datetime.date.fromisoformat(str(d.get("due_at", ""))[:10])
            days_left = (due - today).days
            if 0 <= days_left <= 7:
                urgent.append(f"{d['company']} {d['title']} in {days_left} day(s)")
        except:
            pass

    urgent_str = "; ".join(urgent[:2]) if urgent else "no urgent deadlines"

    prompt = f"""You are a placement coach. Write a single, personalized 2-sentence coaching insight for today.

User data:
- Study hours available today: {available_hours} hrs
- Weakest skills: {weak_str}
- Urgent deadlines: {urgent_str}

Write exactly 2 sentences. Be direct, specific, and motivating. Use numbers where available.
Example style: "You have 3 hrs today and Google OA is in 2 days — prioritize Arrays (currently 30%). Spend at least 90 min on two-pointer and sliding window problems."

Output ONLY the 2-sentence insight. No labels, no formatting."""

    resp = _call_fast(prompt)
    # Strip thinking tags, limit to 2 sentences
    resp = resp.strip()
    sentences = [s.strip() for s in resp.split('.') if s.strip()]
    result = '. '.join(sentences[:2])
    if result and not result.endswith('.'):
        result += '.'
    return result


def generate_round_prep_tips(company: str, round_name: str, days_left: int, skills: list) -> str:
    """
    Uses Gemini to generate specific preparation tips for an upcoming round.
    Called when a round is within 48 hours (days_left <= 2).
    Returns markdown string.
    """
    weak = sorted(skills, key=lambda s: s.get("proficiency", 50))[:5]
    weak_str = ", ".join(f"{s['topic']} ({s['proficiency']}%)" for s in weak) if weak else "general topics"

    prompt = f"""You are a placement preparation expert. Generate a focused preparation guide for:

Company: {company}
Round: {round_name}
Time Remaining: {days_left} day(s)
User's Weakest Skills: {weak_str}

Write a concise, actionable preparation guide with:
1. A 2-sentence overview of what to expect in this round
2. Top 3-5 specific topics to revise NOW (prioritized by weakness)
3. 2-3 quick tips specific to this round type
4. One final motivational sentence

Format as clean Markdown with ## headings. Keep it under 200 words. Be specific and practical."""

    resp = _call_gemini_fallback(prompt)
    return resp.strip() if resp else ""