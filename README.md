# Placement Command Center (PCC)

> An AI-powered, full-stack placement preparation platform built with **FastAPI**, **React**, and **Gemini AI**. Tracks your skills, manages company deadlines, runs adaptive assessments, and gives you a personalized study plan — all from a single dashboard.

---

## 🗂️ Table of Contents

1. [Features](#-features)
2. [Tech Stack](#-tech-stack)
3. [Project Structure](#-project-structure)
4. [Prerequisites](#-prerequisites)
5. [Installation & Setup](#-installation--setup)
6. [Running the App](#-running-the-app)
7. [Feature Guide](#-feature-guide)
8. [API Reference](#-api-reference)
9. [Notes on AI & Rate Limits](#-notes-on-ai--rate-limits)
10. [Troubleshooting](#-troubleshooting)

---

## ✨ Features

| Feature | Description |
|---|---|
| **AI Chat** | Natural-language interface with long-term semantic memory (ChromaDB). The AI remembers past conversations. |
| **Adaptive Skill Board** | Tracks proficiency across DSA, Aptitude, OS, DBMS, Networks, and System Design. Updated after every assessment via Gemini AI. |
| **Assessment Engine** | Coding + Aptitude tests drawn from a curated question bank. Results evaluated by AI with incremental skill scoring. |
| **Mistakes Tracker** | Every wrong answer is permanently stored. Expandable per-mistake AI explanations show step-by-step reasoning. |
| **Daily Test** | Quick 5-question coding or aptitude test to maintain streaks and refine skills. |
| **Auto Study Plan** | AI-generated day-by-day study plan. Regenerates automatically when you add a company, change your timetable, or request a focus shift. |
| **Career Review** | Reads your CV + academic scores and generates a structured strengths/weaknesses analysis for CS career paths. |
| **Semantic Notes Search** | Upload study PDFs/text files. ChromaDB embeds them so you can search by concept (e.g. "what is binary search?"). |
| **Knowledge Vault** | Organised file storage (CV, Marksheets, Notes, Company JDs, Generated files). |
| **Company Tracker** | Add companies with deadlines and round types. The AI auto-generates prep tips within 48 hours of a round. |
| **Calendar** | Visual deadline calendar for all tracked companies. |
| **Settings** | Dark/Light theme, data export (.zip), account deletion. |

---

## 🛠 Tech Stack

### Backend
- **Python 3.10+**
- **FastAPI** + **Uvicorn** — REST API server
- **SQLite** (`placement.db`) — persistent storage for skills, mistakes, users
- **ChromaDB** — local vector database for semantic search and AI memory
- **Gemini API** (`gemini-flash-latest`) — AI evaluation, study plan generation, chat
- **PyMuPDF (fitz)** + **pypdf** — PDF text extraction (dual-fallback)
- **python-jose** + **bcrypt** — JWT authentication
- **APScheduler** — background task scheduling

### Frontend
- **React 18** + **Vite**
- **TailwindCSS** — styling
- **Framer Motion** — animations
- **Lucide React** — icons
- **React Markdown** — markdown rendering

---

## 📁 Project Structure

```
PlacementAgent/
├── backend/
│   ├── main.py                  # FastAPI app — all API routes
│   ├── auth_routes.py           # JWT login/register endpoints
│   ├── users.json               # Registered user store
│   ├── placement.db             # SQLite DB (skills, mistakes, users)
│   ├── question_bank.json       # Aptitude question pool
│   ├── leetcode_map.json        # Coding question pool
│   ├── seen_questions.json      # Per-user question history (avoids repeats)
│   ├── .env                     # Environment variables (GEMINI_API_KEY)
│   ├── knowledge_vault/
│   │   └── <user_email>/
│   │       ├── CV/              # Uploaded CV files
│   │       ├── Notes/           # Study notes (PDF/text)
│   │       ├── Generated/       # AI-generated files (study plans, profile)
│   │       ├── Companies/       # Company JDs and roadmaps
│   │       ├── 10th Grade/ … Semester 8/   # Academic documents
│   │       └── chroma_store/    # Per-user ChromaDB vector store
│   └── core/
│       ├── agent.py             # All Gemini AI calls, prompts, evaluation logic
│       ├── db.py                # SQLite helpers (skills, mistakes, users)
│       ├── vault.py             # File storage and company-doc retrieval
│       ├── memory.py            # ChromaDB: notes indexing + chat memory
│       ├── auth.py              # Password hashing, JWT token generation
│       └── scheduler.py        # Background study plan refresh jobs
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main shell: routing, sidebar, tab rendering
│   │   ├── api.js               # fetchAuth() helper (auto-injects JWT token)
│   │   └── components/
│   │       ├── Assessment.jsx   # Adaptive test UI + submission
│   │       ├── NotesView.jsx    # Notes upload + semantic search
│   │       ├── DocumentsView.jsx # General vault file manager
│   │       ├── MistakesView.jsx # Mistakes log with AI explanations
│   │       ├── CalendarView.jsx # Company deadline calendar
│   │       ├── SettingsView.jsx # Theme, export, account management
│   │       ├── Login.jsx        # Auth screen
│   │       └── Onboarding.jsx   # First-run profile setup wizard
│   └── package.json
├── start_app.bat                # One-click launcher (Windows)
├── requirements.txt             # Python dependencies
└── README.md                    # This file
```

---

## 📋 Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ | Tested on 3.10 |
| Node.js | 18+ | For React frontend |
| npm | 9+ | Comes with Node.js |
| Google Gemini API Key | — | Free tier at [aistudio.google.com](https://aistudio.google.com) |

> **No Ollama required.** The app previously used Ollama for local LLM inference. It now uses Gemini API exclusively with an automatic exponential backoff retry (up to 6 attempts with 5–30s delays) for rate limits.

---

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd PlacementAgent
```

### 2. Set up the Python virtual environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure the Gemini API Key
Create `backend/.env` (or edit if it exists):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get a free key at: https://aistudio.google.com/app/apikey

### 5. Install frontend dependencies
```bash
cd frontend
npm install
cd ..
```

---

## 🚀 Running the App

### Windows — one click
```batch
start_app.bat
```
This opens two terminal windows:
- **Backend:** `http://127.0.0.1:8000`
- **Frontend:** `http://localhost:5173`

### Manual start (any OS)

**Backend:**
```bash
cd backend
uvicorn main:app --reload
```

**Frontend** (in a separate terminal):
```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## 📖 Feature Guide

### First Run
1. Open the app → you'll land on the **Login / Register** screen.
2. Register with your email and a password.
3. Complete the **Onboarding Wizard**: enter your name, target companies, and upload your CV.
4. Take the **Initial Assessment** to calibrate your Skill Board.
5. All other tabs unlock after assessment is complete.

### AI Chat
Chat naturally or use slash commands:

| Command | Description |
|---|---|
| `/skill <topic> <level>` | Manually set a skill level, e.g. `/skill DSA 65` |
| `/company <details>` | Add a company, e.g. `/company Google OA on 2024-08-10` |
| `/timetable <schedule>` | Set your daily schedule, e.g. `/timetable 9-12 study, 2-4 practice` |
| `/delete <company>` | Remove a company from tracker |
| `/status` | Quick summary of deadlines and top skills |

### Assessment Engine
- **Initial Assessment:** 8 questions (2 Coding + 6 Conceptual). Taken once after onboarding.
- **Daily Test:** Quick 5-question coding or aptitude test accessible from the Assessment tab.
- **Scoring Logic:** AI evaluates answers incrementally (±5–10 points max per test). Correct answers with fast times score higher. Wrong answers get a penalty regardless of speed.
- **Mistakes Tracker:** Wrong answers are stored forever. Click any date entry to expand and see the AI's explanation of why the answer was wrong.

### Semantic Notes Search
1. Go to **Study Notes** tab.
2. Upload a **text-based PDF** or `.txt`/`.md` file (scanned/image PDFs won't index — no selectable text).
3. Click **Index Notes** — ChromaDB will embed the content. A ✅ badge appears when indexing is complete.
4. Search by concept: *"What is a binary heap?"*, *"Explain TCP vs UDP"*, etc.
5. The search bar is **locked** until indexing is confirmed complete.

> **Note:** ChromaDB downloads its embedding model (`all-MiniLM-L6-v2`, ~79 MB) the first time you index. This is a one-time download cached locally.

### Study Plan
- Auto-generated by Gemini based on your skill levels, company deadlines, and timetable.
- Regenerates automatically when you:
  - Add a company
  - Change your timetable
  - Ask the AI to focus on a new topic
- Use **Version History** dropdown to browse older plan versions (last 15 saved).

### Career Review
1. Upload your CV to the **Documents** tab under "CV".
2. Enter your academic scores (10th %, 12th %, Semester CGPAs) in the Career Review tab.
3. Click **Generate Review** — takes ~10–20 seconds.
4. The review is saved and auto-loads on future visits.

---

## 📡 API Reference

All endpoints require a JWT token in the `Authorization: Bearer <token>` header unless stated.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive JWT token |
| `GET` | `/api/dashboard` | Full dashboard data (skills, deadlines, stats) |
| `GET` | `/api/assessment/initial` | Get the initial assessment questions |
| `POST` | `/api/assessment/submit` | Submit assessment answers |
| `GET` | `/api/assessment/eval_status` | Poll AI evaluation status (`pending`/`done`) |
| `GET` | `/api/mistakes` | Get all stored mistakes |
| `POST` | `/api/assessment/explain` | Get AI explanation for a wrong answer |
| `POST` | `/api/chat` | Send a chat message (with semantic memory) |
| `POST` | `/api/upload` | Upload a file via chat (auto-categorized) |
| `POST` | `/api/vault/upload` | Upload a file to a specific vault category |
| `GET` | `/api/documents` | List all vault documents |
| `DELETE` | `/api/documents/{category}/{filename}` | Delete a file |
| `POST` | `/api/notes/reindex` | Re-index all Notes into ChromaDB |
| `GET` | `/api/notes/status` | Check notes indexing status |
| `POST` | `/api/notes/search` | Semantic search across notes |
| `GET` | `/api/study_plan` | Get current study plan |
| `GET` | `/api/improvement_review/saved` | Get saved career review |
| `POST` | `/api/improvement_review/generate` | Generate career review from CV |
| `GET` | `/api/academic_profile` | Get saved academic scores |
| `POST` | `/api/academic_profile` | Save academic scores |
| `GET` | `/api/settings/export` | Export all user data as ZIP |

---

## 🤖 Notes on AI & Rate Limits

- The app uses **Gemini Flash** (`gemini-flash-latest`) for all AI operations.
- If a `429 Rate Limited` response is received, the backend **automatically retries** up to 6 times with increasing delays (5s, 10s, 15s…). You won't see an error — it just waits and retries silently.
- All AI evaluation happens in the **background** — submitting an assessment returns immediately, and the Skill Board updates once the AI finishes (you'll see a spinning indicator).
- If the app is restarted while an evaluation is pending, it automatically resumes on next boot.

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| **Backend won't start** | Ensure you're in the `venv` and have run `pip install -r requirements.txt` |
| **"Gemini API key not configured"** | Add `GEMINI_API_KEY=...` to `backend/.env` |
| **Skills not updating after assessment** | The AI evaluation runs in background. Wait ~10–30s and refresh. Check backend console for `[Gemini] Rate limited` messages. |
| **Notes search not working** | Click "Index Notes" first. Wait for ✅ badge. Scanned/image PDFs won't index — use text-based PDFs. |
| **ChromaDB slow first time** | It downloads `all-MiniLM-L6-v2` (~79MB) on first use. One-time only. |
| **"No extractable text" from PDF** | The PDF is image-based (scanned). Convert to text-based PDF or use a `.txt` file. |
| **Frontend shows blank / 404** | Make sure `npm run dev` is running inside the `frontend/` directory. |
| **Login fails after reinstall** | User data is in `backend/users.json` and `backend/placement.db`. Delete both to reset. |
