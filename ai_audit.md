# PlacementAgent — AI Audit & Upgrade Roadmap

## What's Already AI-Driven (You're Further Than You Think)

| Feature | Model | How It Works |
|---|---|---|
| Study plan generation | Gemini | 14-day personalized sprint based on companies, skills, timetable |
| Study plan updates | Gemini | Surgical edits based on user chat intent |
| Career review | Gemini + Ollama | Ollama sanitizes CV (PII removal), Gemini analyzes |
| Timetable parsing | Ollama qwen2.5 | Extracts free hours from natural language schedule |
| Command parsing (`/company`, `/skill`) | Ollama qwen2.5 | Extracts structured data from free text |
| Assessment skill evaluation | Ollama | Reads scores + timing, assigns proficiency levels |
| Skill topic matching | Ollama | Matches user-typed topics to existing DB entries |
| Question bank replenishment | Gemini | Adds new M/H questions when bank runs low |
| Document categorization (chat upload) | Ollama | Decides CV/Notes/Generated/Personal automatically |

---

## What Is Still Hardcoded (Opportunities)

### 🔴 High Impact — Should Be AI ASAP

| What | Current | AI Replacement |
|---|---|---|
| **Initial assessment questions** | Fixed 10+3 in code | Gemini generates once on first login, caches in `Generated/` |
| **Regular assessment aptitude** | Static JSON bank | Ollama (qwen3:8b) generates 6 fresh M/H questions targeted at user's weakest skills |
| **LeetCode problem selection** | Hardcoded 25-topic map | Gemini picks the single best Medium + Hard LC problem for any topic from its full knowledge |
| **Wrong-answer explanations** | Pre-written in JSON | Ollama (qwen3:8b) generates step-by-step logic for each wrong answer in real-time |

### 🟡 Medium Impact — Great Showcases

| What | Current | AI Replacement |
|---|---|---|
| **Dashboard "Today's Focus"** | Raw stats displayed | Ollama generates a 2–3 sentence personalized insight: *"You have Google OA in 4 days and your Arrays score is 30%. Prioritize array problems today."* |
| **Smart notifications** | Plain text: *"Deadline in 3 days"* | Ollama writes personalized, motivational messages based on skill gaps + round type |
| **Deadline priority ranking** | Sorted by date only | Ollama agents ranks companies by urgency × skill gap — surface the one you should focus on **first** |
| **ChromaDB** (already installed!) | Only used for document retrieval | Use it for **semantic conversation memory** — the AI remembers context from 3 days ago |
| **Interview round prep tips** | None | When a round is 48 hrs away, Gemini auto-generates a mini prep guide specific to that round type (OA/Technical/HR) |

### 🟢 Advanced — True AI/ML Showcase Features

| What | Current | AI Replacement |
|---|---|---|
| **Skill trajectory prediction** | None | Track assessment scores over time → Ollama builds a linear model to predict readiness date for each company |
| **Adaptive plan re-evaluation** | Plan only regenerates on explicit triggers | After each assessment, Ollama decides *whether* the plan needs restructuring based on performance delta |
| **CV gap analysis** | Manual career review | On CV upload, Ollama auto-compares your skills vs the uploaded company matrix and lists specific missing skills |
| **Mock interview generator** | None | Gemini generates 5 company-specific mock interview questions based on the company's stored `matrix` |
| **Timetable optimization** | Stores hours as-is | Ollama suggests better time block distribution — *"Your current plan gives 2 hrs/day. For Google in 4 days, you need 5 hrs."* |
| **Notes semantic search** | No search | ChromaDB powers vector search across all your notes — type a concept, surface the relevant notes |
| **Progress benchmarking** | None | Ollama compares your aptitude scores week-over-week and writes a short written trend analysis |

---

## The Architecture You're Building Toward

```
User Input (chat / action)
        │
        ▼
  ┌─────────────┐     ┌─────────────────────────┐
  │ Ollama Fast │────►│ Command parsing, routing │
  │ qwen2.5:1.5b│     │ Skill matching, PII strip│
  └─────────────┘     └─────────────────────────┘
        │
        ▼
  ┌─────────────┐     ┌─────────────────────────┐
  │ Ollama Deep │────►│ Assessment questions     │
  │ qwen3:8b    │     │ Explanations, evaluation │
  └─────────────┘     │ Skill trajectory insight │
                      └─────────────────────────┘
        │
        ▼
  ┌─────────────┐     ┌─────────────────────────┐
  │  Gemini API │────►│ Study plan generation   │
  │ Flash-Lite  │     │ Career review            │
  └─────────────┘     │ LeetCode selection       │
                      │ Round prep tips          │
                      └─────────────────────────┘
        │
        ▼
  ┌─────────────┐     ┌─────────────────────────┐
  │  ChromaDB   │────►│ Document retrieval       │
  │  (local)    │     │ Conversation memory      │
  └─────────────┘     │ Notes semantic search    │
                      └─────────────────────────┘
```

---

## What This Demonstrates (For Your Portfolio)

| AI/ML Concept | Where It Shows |
|---|---|
| **Multi-agent orchestration** | 2 Ollama models + 1 Gemini each with distinct roles |
| **RAG (Retrieval-Augmented Generation)** | ChromaDB stores your docs → LLM answers with context |
| **LLM prompt engineering** | Every AI call uses carefully designed system prompts |
| **Local LLM deployment** | Ollama running qwen3:8b offline — privacy-preserving |
| **Agentic decision-making** | AI decides when to regenerate plan, what topic to test, which company to prioritize |
| **Structured output parsing** | Every AI call returns JSON, extracted with robust regex fallbacks |
| **Background task AI pipelines** | Skill evaluation runs async in background — non-blocking AI |
| **Semantic vector search** | ChromaDB enables concept-level document lookup |
| **Adaptive personalization** | Questions, plans, and insights are all user-profile-specific |

> [!TIP]
> The features in the **🟡 Medium Impact** row are the ones that will look most impressive in a demo — especially the "Dashboard insight" and "48-hour round prep tips". They show AI taking proactive initiative, not just responding to commands.
