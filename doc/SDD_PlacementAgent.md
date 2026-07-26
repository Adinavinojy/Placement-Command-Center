System Design Document

PlacementAgent - Personal Offline Placement Preparation System

Version 1.0 | 16 July 2026

# 1\. Introduction

This System Design Document (SDD) describes how PlacementAgent is structured internally to satisfy the requirements laid out in the companion SRS. It covers architecture, data design, module responsibilities, and key process flows. Like the SRS, it is written as a lightweight, practical reference for a personal project rather than a formal enterprise design spec.

# 2\. Design Goals

- Offline-first: every feature must work with zero network access except the local Ollama process.
- Modular: each concern (data, assessment, scheduling, presentation) lives in its own file with a narrow interface.
- Minimal dependencies: prefer the standard library and a handful of well-known packages (sqlite3, streamlit, plyer, an ollama client).
- Extensible: adding a new company, subject, or topic should mean adding a folder/row, not changing code.

# 3\. System Architecture

PlacementAgent is a single-process-family desktop application: a CLI agent, an optional Streamlit dashboard, and a lightweight scheduled notifier, all sharing one SQLite database and one knowledge_vault/ folder tree.

| **Component**        | **File**                      | **Responsibility**                                                                                                 |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Agent Core           | agent.py                      | Main CLI loop; loads profile, routes queries to Ollama, calls into db.py and assess.py.                            |
| Data Layer           | db.py                         | Owns the SQLite connection and schema (init, migrations); CRUD helpers for companies, deadlines, and skill_levels. |
| Assessment Engine    | assess.py                     | Baseline test, daily diagnostic question generation, proficiency calibration logic.                                |
| Knowledge Vault      | knowledge_vault/ (filesystem) | Structured store of static reference material read by the agent for context.                                       |
| Scheduler / Notifier | notifier.py                   | Polls upcoming deadlines and fires OS notifications via plyer at the right lead time.                              |
| Dashboard            | dashboard.py                  | Streamlit app; visualizes deadlines (calendar/agenda) and proficiency-by-topic.                                    |
| LLM Backend          | Ollama (external process)     | Serves chat completions and question generation to agent.py and assess.py.                                         |

**Layered view, top to bottom:**

- Presentation layer - CLI (agent.py) and Streamlit dashboard (dashboard.py).
- Logic layer - assess.py (calibration) and notifier.py (scheduling).
- Data layer - db.py over SQLite, and the knowledge_vault/ file tree.
- External layer - the local Ollama model server.

# 4\. Data Design

## 4.1 Vault Directory Structure

| **Path**                                  | **Purpose**                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| knowledge_vault/Personal/                 | Resume, LinkedIn/GitHub links, certificates, profile.md (self-summary read at launch).                     |
| knowledge_vault/Communication/            | Group discussion notes, interview transcripts.                                                             |
| knowledge_vault/Aptitude/                 | Formulae sheets, puzzle collections.                                                                       |
| knowledge_vault/Subjects/                 | Per-subject notes: Python, AI, OS, DBMS, etc. - these topic names double as the keys used in skill_levels. |
| knowledge_vault/Companies/{Company_Name}/ | One folder per target company: JD, interview process notes, and a generated prep roadmap.                  |

## 4.2 Database Schema (SQLite)

_skill_levels is specified explicitly in the request and is treated as confirmed. The other tables below (companies, deadlines) are inferred from context - e.g. the mention of "next_deadline data" implies some deadlines table - and should be reconciled with whatever db.py already contains._

| **Table**                                         | **Columns**                                                                           | **Notes**                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| skill_levels (confirmed)                          | topic TEXT PRIMARY KEY proficiency INTEGER DEFAULT 1 last_tested TEXT                 | One row per Subjects/ topic. proficiency is 1-5. Updated by assess.py after every test.            |
| companies (assumed existing)                      | name TEXT PRIMARY KEY jd_path TEXT roadmap_path TEXT status TEXT                      | Mirrors a Companies/{Company_Name}/ folder; status could be e.g. researching/applied/interviewing. |
| deadlines (assumed existing, holds next_deadline) | id INTEGER PRIMARY KEY company TEXT title TEXT due_at TEXT notified INTEGER DEFAULT 0 | due_at is an ISO timestamp; notified flags whether the notifier has already fired for this row.    |

# 5\. Module Design

## 5.1 db.py

- init(conn) - creates all tables (including skill_levels) if not present; safe to call on every startup.
- get_connection() - returns a single shared sqlite3 connection for the process.
- update_skill(topic, correct: bool) - adjusts proficiency up/down within the 1-5 bound and stamps last_tested.
- upsert_deadline(company, title, due_at) / get_upcoming_deadlines(window) - CRUD used by the dashboard and notifier.

## 5.2 assess.py

- run_baseline_test() - asks 10 questions across topics on first run and seeds skill_levels.
- get_daily_diagnostic(topic) - builds a proficiency-aware prompt and sends it to Ollama for a single question.
- calibrate(topic, correct) - thin wrapper around db.update_skill(), called after every answered question.
- pick_next_topic() - chooses which topic to quiz next; default strategy is lowest-proficiency-first.
- refresh_roadmap(company) - regenerates that company's roadmap file when a relevant proficiency score changes (FR-9).

## 5.3 agent.py

- main() - CLI loop: load Personal/profile.md, greet, dispatch user input either to free-form chat (Ollama) or to assess.py/db.py commands.
- load_profile() - reads and summarizes Personal/profile.md as system context for the LLM.

## 5.4 dashboard.py (Streamlit)

- Reads deadlines and skill_levels via db.py and renders a calendar/agenda view plus a proficiency-by-topic chart.
- Read-only by design - all writes still go through agent.py/assess.py to keep a single write path.

## 5.5 notifier.py

- On each run, queries db.get_upcoming_deadlines(window) and calls plyer.notification.notify() for any row inside the configured lead time that hasn't already fired.
- Design gap: plyer only displays a notification when called - it does not itself schedule anything. Something has to invoke notifier.py at the right cadence. Two practical options: (a) a Windows Task Scheduler entry running notifier.py every few minutes, or (b) an in-process scheduler such as APScheduler running inside a long-lived background thread. Either is consistent with the offline/local-only constraint; this SDD recommends (a) for simplicity in a personal project.

# 6\. Key Process Flows

## 6.1 First-Run Baseline Test

- agent.py detects skill_levels is empty and calls assess.run_baseline_test().
- assess.py asks 10 questions spanning Subjects/ topics via Ollama.
- Each answer is scored and passed to db.update_skill().
- skill_levels is now seeded; assess.refresh_roadmap() runs for any active company.

## 6.2 Daily Diagnostic

- agent.py (or a scheduled trigger) calls assess.pick_next_topic().
- assess.get_daily_diagnostic(topic) builds a proficiency-aware prompt and queries Ollama for one question.
- The user answers; assess.calibrate(topic, correct) updates skill_levels.
- If proficiency changed, assess.refresh_roadmap() updates the relevant Companies/\*/roadmap file.

## 6.3 Deadline Reminder

- A deadline row is created via agent.py (e.g. "interview with X on date/time").
- notifier.py, invoked on its schedule, calls db.get_upcoming_deadlines() and finds rows due within the lead time.
- plyer.notification.notify() fires a native OS toast; the row is marked notified = 1.
- dashboard.py independently reflects the same row on its calendar view whenever it is opened.

# 7\. Technology Stack

| **Layer**                | **Technology**                        | **Notes**                                                                |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------ |
| Language/runtime         | Python 3.x                            | Single shared virtual environment.                                       |
| LLM                      | Ollama (local)                        | Any locally pulled model; no cloud calls.                                |
| Storage                  | SQLite (stdlib sqlite3)               | One file, e.g. placement_agent.db.                                       |
| Dashboard                | Streamlit                             | Served locally, browser-based, read-only against the DB.                 |
| Notifications            | plyer                                 | Cross-platform wrapper; native toasts confirmed on Windows.              |
| Scheduling (recommended) | Windows Task Scheduler or APScheduler | Not in the original list - added here to close the gap described in 5.5. |

# 8\. Security & Privacy Considerations

- No network egress is required at runtime other than the local Ollama process (typically localhost).
- The SQLite file and knowledge_vault/ contain personal data (resume, transcripts); no encryption is assumed, consistent with a single-user local machine, but the user should exclude these paths from any cloud-synced folder (e.g. OneDrive) if privacy matters.
- No authentication layer exists or is planned, since the system is single-user by design.

# 9\. Limitations & Future Work

- The adaptive baseline test uses a simple correct/incorrect calibration rather than a full item-response-theory model; this could be revisited if proficiency scores feel inaccurate in practice.
- plyer notifications require an external scheduler (Section 5.5); this SDD recommends Task Scheduler for now but APScheduler would let notifier.py run as one long-lived process.
- Cross-platform notification support (macOS/Linux) is best-effort only and not a current priority.

# 10\. Assumptions Log

Mirrors Section 6 of the SRS - recorded here for design traceability:

- Existence and exact shape of a companies table and a deadlines table beyond skill_levels.
- Lowest-proficiency-first strategy for choosing the daily diagnostic topic.
- Windows Task Scheduler (not an in-process loop) as the trigger for notifier.py.